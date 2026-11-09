import { IDBFactory } from 'fake-indexeddb';
import { HttpClient } from '@angular/common/http';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { ConectividadeService } from '../shared/conectividade.service';
import { SincronizacaoService } from '../vistoria/sincronizacao.service';
import { VistoriaLocalService } from '../vistoria/vistoria-local.service';
import { VistoriaService } from '../vistoria/vistoria.service';
import { Vistoria } from '../vistoria/vistoria.model';
import { FerramentasTeste } from './ferramentas-teste';

/**
 * Testes das ferramentas usadas nos testes T03 a T08 e no experimento
 * comparativo. O servidor é simulado, como em sincronizacao.service.spec.ts.
 */
describe('FerramentasTeste', () => {
  let ferramentas: FerramentasTeste;
  let sync: SincronizacaoService;
  let local: VistoriaLocalService;
  const api = { enviarLote: vi.fn(), listar: vi.fn() };
  const http = { post: vi.fn(), get: vi.fn(), delete: vi.fn() };

  /** Espera os envios disparados em segundo plano e esvazia o que sobrou na fila. */
  async function sincronizarTudo(): Promise<void> {
    await vi.waitFor(() => expect(sync.sincronizando()).toBe(false));
    await sync.sincronizar();
  }

  beforeEach(() => {
    globalThis.indexedDB = new IDBFactory(); // banco vazio a cada teste
    localStorage.clear();
    api.enviarLote.mockReset();
    api.listar.mockReset();
    http.delete.mockReset();
    TestBed.configureTestingModule({
      providers: [
        { provide: VistoriaService, useValue: api },
        { provide: HttpClient, useValue: http },
        { provide: AuthService, useValue: { logado: () => true, usuario: () => ({ nome: 'Inspetor', email: 'i@x.com' }) } },
        { provide: ConectividadeService, useValue: { online: signal(false) } },
      ],
    });
    ferramentas = TestBed.inject(FerramentasTeste);
    sync = TestBed.inject(SincronizacaoService);
    local = TestBed.inject(VistoriaLocalService);
  });

  it('gera vistorias de teste que ficam pendentes no aparelho com o servidor fora (T03)', async () => {
    api.enviarLote.mockReturnValue(throwError(() => new Error('sem rede')));

    const resultado = await ferramentas.gerar(5, { fotos: 2, kbPorFoto: 1 });
    await vi.waitFor(() => expect(sync.sincronizando()).toBe(false));

    expect(resultado).toMatchObject({ modo: 'offline-first', geradas: 5, salvas: 5, perdidas: 0 });
    const pendentes = await local.pendentes();
    expect(pendentes.map((v) => v.placa).sort()).toEqual(['TST0001', 'TST0002', 'TST0003', 'TST0004', 'TST0005']);
    expect(pendentes[0].fotos).toHaveLength(2);
    expect(sync.idsPendentes().size).toBe(5);
  });

  it('confere que o servidor recebeu o mesmo conteúdo, mesmo com outra ordem e outro formato de data', async () => {
    const recebidas: Vistoria[] = [];
    api.enviarLote.mockImplementation((lote: Vistoria[]) => {
      recebidas.push(...lote);
      return of(lote);
    });
    await ferramentas.gerar(3);
    await sincronizarTudo();

    // O servidor devolve o mesmo dado com diferenças de forma, e uma vistoria adulterada.
    const doServidor = recebidas.map((v) => ({
      ...v,
      dataHora: v.dataHora!.replace('Z', '+00:00'),
      finalidade: v.finalidade ?? undefined,
      itens: [...v.itens].reverse(),
      vistoriadorNome: 'Nome que veio do token',
    }));
    doServidor[2] = { ...doServidor[2], hodometro: 1 };
    api.listar.mockReturnValue(of(doServidor));

    expect(await ferramentas.conferir()).toEqual({
      geradas: 3,
      noServidor: 3,
      integras: 2,
      faltando: 0,
      divergentes: 1,
      duplicadas: 0,
      pendentesNoAparelho: 0,
    });
  });

  it('registra o tempo e os lotes de cada sincronização (T05)', async () => {
    api.enviarLote.mockReturnValue(throwError(() => new Error('sem rede')));
    await ferramentas.gerar(25);
    await vi.waitFor(() => expect(sync.sincronizando()).toBe(false));
    sync.medicoes.length = 0;

    api.enviarLote.mockImplementation((lote: Vistoria[]) => of(lote));
    const medicao = await ferramentas.sincronizar();

    expect(medicao).toMatchObject({ pendentesNoInicio: 25, confirmadas: 25, falhou: false });
    expect(medicao!.temposLoteMs).toHaveLength(3); // lotes de 10, 10 e 5
  });

  it('reenvia os mesmos UUIDs de vistorias já confirmadas (T08)', async () => {
    const idsEnviados: string[] = [];
    api.enviarLote.mockImplementation((lote: Vistoria[]) => {
      idsEnviados.push(...lote.map((v) => v.id));
      return of(lote);
    });
    await ferramentas.gerar(3);
    await sincronizarTudo();
    const idsOriginais = new Set(idsEnviados);

    expect(await ferramentas.reenviar(2)).toBe(2);
    expect(sync.idsPendentes().size).toBe(2);
    await ferramentas.sincronizar();

    expect(new Set(idsEnviados)).toEqual(idsOriginais); // nenhum UUID novo foi criado
    expect(await local.pendentes()).toHaveLength(0);
  });

  it('no modo tradicional a vistoria se perde quando o servidor falha (grupo de controle)', async () => {
    ferramentas.modo('tradicional');
    api.enviarLote.mockReturnValue(throwError(() => new Error('sem rede')));

    const resultado = await ferramentas.gerar(4);

    expect(resultado).toMatchObject({ modo: 'tradicional', salvas: 0, perdidas: 4 });
    expect(await local.listar()).toHaveLength(0); // nada ficou guardado para reenviar

    api.listar.mockReturnValue(of([]));
    expect(await ferramentas.conferir()).toMatchObject({ geradas: 4, noServidor: 0, faltando: 4 });
  });

  it('limpa só as vistorias de teste do aparelho', async () => {
    api.enviarLote.mockReturnValue(throwError(() => new Error('sem rede')));
    http.delete.mockReturnValue(of({ apagadas: 0 }));
    await ferramentas.gerar(2);
    await local.salvar({ id: 'real', placa: 'ABC1D23', itens: [], fotos: [], statusSync: 'pendente' });
    await vi.waitFor(() => expect(sync.sincronizando()).toBe(false));

    const resultado = await ferramentas.limpar();

    expect(resultado).toEqual({ apagadasNoAparelho: 2, apagadasNoServidor: 0 });
    expect((await local.listar()).map((v) => v.placa)).toEqual(['ABC1D23']);
    expect(sync.idsPendentes()).toEqual(new Set(['real']));
  });
});
