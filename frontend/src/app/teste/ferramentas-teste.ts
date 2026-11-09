import { HttpClient } from '@angular/common/http';
import { Injectable, Injector, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { MedicaoSync, SincronizacaoService } from '../vistoria/sincronizacao.service';
import { VistoriaLocalService } from '../vistoria/vistoria-local.service';
import { VistoriaService } from '../vistoria/vistoria.service';
import { FINALIDADES, FotoVistoria, MAX_FOTOS, StatusItem, Vistoria, criarChecklistPadrao } from '../vistoria/vistoria.model';

/** Toda vistoria de teste tem placa começando com TST, para contar e apagar sem tocar nas reais. */
const PREFIXO_PLACA = 'TST';
const CHAVE_GABARITO = 'checkfleet.teste.gabarito';
const API_TESTE = 'http://localhost:8080/api/teste';
const SITUACOES: StatusItem[] = ['OK', 'OK', 'OK', 'ATENCAO', 'DEFEITO'];

export interface ResultadoGeracao {
  modo: string;
  geradas: number;
  /** Aceitas pelo app (gravadas no aparelho ou, no modo tradicional, confirmadas pelo servidor). */
  salvas: number;
  /** Recusadas com erro: no modo tradicional, são vistorias perdidas. */
  perdidas: number;
  duracaoMs: number;
  kbDeFotosPorVistoria: number;
}

export interface ResultadoConferencia {
  geradas: number;
  noServidor: number;
  /** Chegaram ao servidor com exatamente o mesmo conteúdo que saiu do aparelho. */
  integras: number;
  faltando: number;
  divergentes: number;
  duplicadas: number;
  pendentesNoAparelho: number;
}

/**
 * Ferramentas dos testes da monografia (T03 a T08 e o experimento comparativo).
 *
 * Ficam disponíveis no console do navegador (F12) como `checkfleet`, inclusive
 * no build de produção, porque é nele que o Service Worker funciona.
 * Exemplo: `await checkfleet.gerar(100)`.
 *
 * Não fazem parte do app do inspetor: servem para criar volume de dados,
 * medir a sincronização e conferir o que chegou ao servidor.
 */
@Injectable({ providedIn: 'root' })
export class FerramentasTeste {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly local = inject(VistoriaLocalService);
  private readonly sync = inject(SincronizacaoService);
  private readonly api = inject(VistoriaService);

  /**
   * Cria vistorias de teste pelo mesmo caminho da tela de nova vistoria
   * (`SincronizacaoService.registrar`), para o teste exercitar o app de verdade.
   *
   * `fotos` é a quantidade de fotos por vistoria. As fotos são sintéticas: não
   * são imagens, só têm o tamanho de uma foto já comprimida (150 KB por padrão).
   */
  async gerar(quantidade: number, opcoes: { fotos?: number; kbPorFoto?: number } = {}): Promise<ResultadoGeracao> {
    const kbPorFoto = opcoes.kbPorFoto ?? 150;
    const fotos = criarFotosSinteticas(Math.min(opcoes.fotos ?? 0, MAX_FOTOS), kbPorFoto);
    const gabarito = this.lerGabarito();
    const jaGeradas = Object.keys(gabarito).length;
    let salvas = 0;

    const inicio = performance.now();
    for (let i = 1; i <= quantidade; i++) {
      const vistoria = this.criarVistoria(jaGeradas + i, fotos);
      gabarito[vistoria.id] = await impressaoDigital(vistoria);
      try {
        await this.sync.registrar(vistoria);
        salvas++;
      } catch {
        // Só acontece no modo tradicional: o servidor não respondeu e não há fila.
      }
    }
    const duracaoMs = Math.round(performance.now() - inicio);
    this.gravarGabarito(gabarito);

    return {
      modo: this.modo(),
      geradas: quantidade,
      salvas,
      perdidas: quantidade - salvas,
      duracaoMs,
      kbDeFotosPorVistoria: fotos.length * kbPorFoto,
    };
  }

  /**
   * Compara o que o servidor tem com o que foi gerado (critérios de integridade
   * e de duplicidade). Cada vistoria gerada deixou uma impressão digital
   * (SHA-256 do conteúdo); aqui ela é recalculada sobre a versão do servidor.
   */
  async conferir(): Promise<ResultadoConferencia> {
    const gabarito = this.lerGabarito();
    const noServidor = (await firstValueFrom(this.api.listar())).filter(ehDeTeste);
    const porId = new Map(noServidor.map((v) => [v.id, v]));

    const faltando: string[] = [];
    const divergentes: string[] = [];
    let integras = 0;
    for (const [id, esperada] of Object.entries(gabarito)) {
      const recebida = porId.get(id);
      if (!recebida) faltando.push(id);
      else if ((await impressaoDigital(recebida)) === esperada) integras++;
      else divergentes.push(id);
    }
    if (faltando.length) console.warn('Vistorias que não estão no servidor:', faltando);
    if (divergentes.length) console.warn('Vistorias com conteúdo diferente no servidor:', divergentes);

    return {
      geradas: Object.keys(gabarito).length,
      noServidor: noServidor.length,
      integras,
      faltando: faltando.length,
      divergentes: divergentes.length,
      duplicadas: noServidor.length - porId.size,
      pendentesNoAparelho: (await this.local.idsPendentes()).length,
    };
  }

  /** Dispara a sincronização, espera terminar e devolve a medição dela. */
  async sincronizar(): Promise<MedicaoSync | undefined> {
    const antes = this.sync.medicoes.length;
    await this.sync.sincronizar();
    return this.sync.medicoes.length > antes ? this.sync.medicoes.at(-1) : undefined;
  }

  /**
   * Devolve à fila vistorias de teste que o servidor já confirmou, para a
   * próxima sincronização reenviar os mesmos UUIDs (T08). Se a idempotência
   * funciona, a contagem no servidor não muda.
   */
  async reenviar(quantas: number): Promise<number> {
    const confirmadas = (await this.local.listar())
      .filter((v) => ehDeTeste(v) && v.statusSync === 'sincronizada')
      .slice(0, quantas);
    for (const v of confirmadas) await this.local.salvar({ ...v, statusSync: 'pendente' });
    await this.sync.atualizarPendentes();
    return confirmadas.length;
  }

  /** Histórico das sincronizações desde que a página abriu (tempo total e por lote). */
  medicoes(): MedicaoSync[] {
    console.table(
      this.sync.medicoes.map((m) => ({
        inicio: m.inicio,
        pendentes: m.pendentesNoInicio,
        confirmadas: m.confirmadas,
        lotes: m.temposLoteMs.length,
        duracaoMs: m.duracaoMs,
        falhou: m.falhou,
      })),
    );
    return this.sync.medicoes;
  }

  /** Consulta ou troca o modo do experimento: 'offline-first' (padrão) ou 'tradicional'. */
  modo(novo?: 'offline-first' | 'tradicional'): string {
    if (novo) this.sync.definirModoTradicional(novo === 'tradicional');
    return this.sync.modoTradicional() ? 'tradicional' : 'offline-first';
  }

  /** Quanto espaço o app ocupa no aparelho e se o navegador pode apagar esses dados. */
  async armazenamento(): Promise<{ usadoMb: number; cotaMb: number; persistente: boolean }> {
    const { usage = 0, quota = 0 } = await navigator.storage.estimate();
    const emMb = (bytes: number) => Math.round((bytes / 1024 / 1024) * 10) / 10;
    return { usadoMb: emMb(usage), cotaMb: emMb(quota), persistente: await navigator.storage.persisted() };
  }

  /**
   * Faz a API gravar `quantas` vistorias e responder erro 500 na seguinte (T07).
   * A falha acontece uma vez só. Exige a API rodando com o perfil `teste`.
   */
  falharApos(quantas: number): Promise<unknown> {
    return firstValueFrom(this.http.post(`${API_TESTE}/falha`, null, { params: { apos: quantas } }));
  }

  /** Quantas vistorias de teste o servidor tem (contagem direta no banco). */
  servidor(): Promise<unknown> {
    return firstValueFrom(this.http.get(`${API_TESTE}/resumo`));
  }

  /** Apaga as vistorias de teste do aparelho e do servidor, para começar outra rodada do zero. */
  async limpar(): Promise<{ apagadasNoAparelho: number; apagadasNoServidor: number | null }> {
    const locais = (await this.local.listar()).filter(ehDeTeste);
    for (const v of locais) await this.local.excluir(v.id);
    await this.sync.atualizarPendentes();
    localStorage.removeItem(CHAVE_GABARITO);
    this.sync.medicoes.length = 0;

    let apagadasNoServidor: number | null = null;
    try {
      const resposta = await firstValueFrom(this.http.delete<{ apagadas: number }>(`${API_TESTE}/vistorias`));
      apagadasNoServidor = resposta.apagadas;
    } catch {
      console.warn('Não limpei o servidor: a API está fora do ar ou sem o perfil "teste".');
    }
    return { apagadasNoAparelho: locais.length, apagadasNoServidor };
  }

  ajuda(): void {
    console.info(
      [
        'checkfleet.gerar(100)                   cria 100 vistorias de teste (placa TST...)',
        'checkfleet.gerar(20, { fotos: 3 })      idem, com 3 fotos sintéticas de 150 KB cada',
        'checkfleet.sincronizar()                envia a fila e devolve a medição',
        'checkfleet.medicoes()                   tempo de cada sincronização',
        'checkfleet.conferir()                   compara o servidor com o que foi gerado',
        "checkfleet.modo('tradicional')          desliga a fila (grupo de controle)",
        "checkfleet.modo('offline-first')        volta ao normal",
        'checkfleet.falharApos(25)               API dá erro 500 depois de gravar 25',
        'checkfleet.reenviar(10)                 põe 10 já confirmadas de volta na fila',
        'checkfleet.servidor()                   contagem de vistorias de teste no banco',
        'checkfleet.armazenamento()              espaço usado no aparelho',
        'checkfleet.limpar()                     apaga os dados de teste',
      ].join('\n'),
    );
  }

  /** O conteúdo depende só do número da vistoria, para as rodadas serem comparáveis. */
  private criarVistoria(numero: number, fotos: FotoVistoria[]): Vistoria {
    const usuario = this.auth.usuario();
    const itens = criarChecklistPadrao().map((item, j) => {
      const status = SITUACOES[(numero + j) % SITUACOES.length];
      return { ...item, status, observacao: status === 'OK' ? '' : `Observação de teste ${numero}` };
    });
    return {
      id: crypto.randomUUID(),
      placa: PREFIXO_PLACA + String(numero).padStart(4, '0'),
      dataHora: new Date().toISOString(),
      finalidade: FINALIDADES[numero % FINALIDADES.length],
      hodometro: 10000 + numero,
      itens,
      fotos,
      vistoriadorNome: usuario?.nome,
      vistoriadorEmail: usuario?.email,
    };
  }

  private lerGabarito(): Record<string, string> {
    return JSON.parse(localStorage.getItem(CHAVE_GABARITO) ?? '{}');
  }

  private gravarGabarito(gabarito: Record<string, string>): void {
    localStorage.setItem(CHAVE_GABARITO, JSON.stringify(gabarito));
  }
}

/** Deixa as ferramentas acessíveis no console do navegador como `checkfleet`. */
export function instalarFerramentasTeste(injector: Injector): void {
  (window as unknown as { checkfleet: FerramentasTeste }).checkfleet = injector.get(FerramentasTeste);
}

function ehDeTeste(v: Vistoria): boolean {
  return v.placa.startsWith(PREFIXO_PLACA);
}

/**
 * Texto com o conteúdo da vistoria num formato fixo, para comparar o que saiu
 * do aparelho com o que o servidor devolve. Ignora diferenças que não mudam o
 * dado: o formato da data, campo vazio como null e a ordem dos itens e das
 * fotos (o banco não guarda essa ordem). O vistoriador fica de fora porque o
 * servidor o preenche a partir do token.
 */
function formaCanonica(v: Vistoria): string {
  return JSON.stringify({
    id: v.id,
    placa: v.placa,
    finalidade: v.finalidade ?? null,
    hodometro: v.hodometro ?? null,
    dataHora: v.dataHora ? new Date(v.dataHora).getTime() : null,
    itens: v.itens.map((i) => JSON.stringify([i.nome, i.status, i.observacao ?? ''])).sort(),
    fotos: v.fotos.map((f) => JSON.stringify([f.legenda ?? '', f.dataUrl])).sort(),
  });
}

async function impressaoDigital(v: Vistoria): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(formaCanonica(v)));
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Fotos de mentira com o tamanho de uma foto comprimida. O conteúdo de cada
 * uma é aleatório e diferente das outras, como em fotos de verdade: se fossem
 * iguais, o navegador guardaria uma cópia só e o espaço medido no IndexedDB
 * ficaria menor que o real.
 */
function criarFotosSinteticas(quantas: number, kbPorFoto: number): FotoVistoria[] {
  return Array.from({ length: Math.max(quantas, 0) }, (_, k) => {
    const bytes = new Uint8Array(kbPorFoto * 1024);
    // getRandomValues aceita no máximo 65536 bytes por chamada.
    for (let i = 0; i < bytes.length; i += 65536) crypto.getRandomValues(bytes.subarray(i, i + 65536));
    let binario = '';
    for (let i = 0; i < bytes.length; i += 32768) binario += String.fromCharCode(...bytes.subarray(i, i + 32768));
    return { legenda: `Foto de teste ${k + 1}`, dataUrl: `data:image/jpeg;base64,${btoa(binario)}` };
  });
}
