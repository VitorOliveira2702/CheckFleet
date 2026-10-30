import { IDBFactory } from 'fake-indexeddb';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { ConectividadeService } from '../shared/conectividade.service';
import { SincronizacaoService } from './sincronizacao.service';
import { VistoriaLocalService } from './vistoria-local.service';
import { VistoriaService } from './vistoria.service';
import { Vistoria, criarChecklistPadrao } from './vistoria.model';

/**
 * Testes da fila offline-first (RF04, RF05, RF06, RF09 / RNF05).
 * O servidor é simulado: em cada teste decidimos se ele "cai" ou responde.
 */
describe('SincronizacaoService', () => {
  let sync: SincronizacaoService;
  let local: VistoriaLocalService;
  const api = { enviarLote: vi.fn(), listar: vi.fn(() => of([])) };

  function novaVistoria(placa: string): Vistoria {
    return { id: crypto.randomUUID(), placa, dataHora: new Date().toISOString(), itens: criarChecklistPadrao(), fotos: [] };
  }

  /** Espera a tentativa de envio disparada em segundo plano terminar. */
  async function aguardarEnvio(): Promise<void> {
    await vi.waitFor(() => expect(sync.sincronizando()).toBe(false));
    await new Promise((r) => setTimeout(r));
  }

  beforeEach(() => {
    globalThis.indexedDB = new IDBFactory(); // banco vazio a cada teste
    api.enviarLote.mockReset();
    TestBed.configureTestingModule({
      providers: [
        { provide: VistoriaService, useValue: api },
        { provide: AuthService, useValue: { logado: () => true } },
        // offline para o effect não disparar envios por conta própria
        { provide: ConectividadeService, useValue: { online: signal(false) } },
      ],
    });
    sync = TestBed.inject(SincronizacaoService);
    local = TestBed.inject(VistoriaLocalService);
  });

  it('salva no aparelho como pendente quando o servidor está fora (RF04/RF05)', async () => {
    api.enviarLote.mockReturnValue(throwError(() => new Error('sem rede')));
    const v = novaVistoria('ABC1D23');

    await sync.registrar(v);
    await aguardarEnvio();

    const pendentes = await local.pendentes();
    expect(pendentes.map((p) => p.id)).toEqual([v.id]);
    expect(sync.idsPendentes().has(v.id)).toBe(true);
  });

  it('envia a fila em lote quando o servidor volta e marca como sincronizada (RF06)', async () => {
    api.enviarLote.mockReturnValue(throwError(() => new Error('sem rede')));
    const a = novaVistoria('AAA1A11');
    const b = novaVistoria('BBB2B22');
    await sync.registrar(a);
    await aguardarEnvio();
    await sync.registrar(b);
    await aguardarEnvio();

    // servidor volta e confirma tudo que recebeu
    api.enviarLote.mockImplementation((lote: Vistoria[]) => of(lote));
    await sync.sincronizar();

    const ultimoLote: Vistoria[] = api.enviarLote.mock.lastCall![0];
    expect(ultimoLote.map((v) => v.id).sort()).toEqual([a.id, b.id].sort());
    expect(ultimoLote[0]).not.toHaveProperty('statusSync'); // campo local não vai ao servidor
    expect(await local.pendentes()).toHaveLength(0);
    expect(sync.idsPendentes().size).toBe(0);
  });

  it('reenvia o mesmo UUID após falha e não duplica no aparelho (RF09/RNF05)', async () => {
    api.enviarLote.mockReturnValue(throwError(() => new Error('timeout')));
    const v = novaVistoria('CCC3C33');
    await sync.registrar(v);
    await aguardarEnvio();
    await sync.sincronizar(); // segunda falha

    api.enviarLote.mockImplementation((lote: Vistoria[]) => of(lote));
    await sync.sincronizar();

    const idsEnviados = api.enviarLote.mock.calls.flatMap((chamada) => (chamada[0] as Vistoria[]).map((x) => x.id));
    expect(new Set(idsEnviados)).toEqual(new Set([v.id])); // sempre o mesmo UUID
    const todas = await local.listar();
    expect(todas).toHaveLength(1);
    expect(todas[0].statusSync).toBe('sincronizada');
  });

  it('só confirma as vistorias que o servidor devolveu', async () => {
    api.enviarLote.mockReturnValue(throwError(() => new Error('sem rede')));
    const a = novaVistoria('DDD4D44');
    const b = novaVistoria('EEE5E55');
    await sync.registrar(a);
    await aguardarEnvio();
    await sync.registrar(b);
    await aguardarEnvio();

    // servidor responde, mas só com uma delas (ex.: falha parcial)
    api.enviarLote.mockImplementation((lote: Vistoria[]) => of(lote.filter((x) => x.id === a.id)));
    await sync.sincronizar();

    expect((await local.pendentes()).map((p) => p.id)).toEqual([b.id]);
  });
});
