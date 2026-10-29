import { Injectable, effect, inject, signal, untracked } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { ConectividadeService } from '../shared/conectividade.service';
import { VistoriaLocal, VistoriaLocalService } from './vistoria-local.service';
import { VistoriaService } from './vistoria.service';
import { Vistoria } from './vistoria.model';

/** Quantas vistorias vão por requisição (cada uma pode ter até 12 fotos). */
const TAMANHO_LOTE = 10;

/**
 * Fila de sincronização offline-first (RF05 / RF06).
 *
 * Fluxo:
 * 1. `registrar()` grava a vistoria no IndexedDB como "pendente" e só depois
 *    tenta enviar. Ou seja, salvar nunca depende da internet.
 * 2. `sincronizar()` pega todas as pendentes e manda em lotes para
 *    POST /api/vistorias/lote. Só as que o servidor devolveu viram "sincronizada".
 * 3. Se a rede cair no meio, as que não foram confirmadas continuam pendentes
 *    e são reenviadas na próxima tentativa. O servidor reconhece o UUID e não
 *    duplica (RF09 / RNF05).
 *
 * A sincronização é disparada ao salvar, ao abrir o app e quando o navegador
 * avisa que a conexão voltou (evento `online`).
 */
@Injectable({ providedIn: 'root' })
export class SincronizacaoService {
  private readonly local = inject(VistoriaLocalService);
  private readonly api = inject(VistoriaService);
  private readonly auth = inject(AuthService);
  private readonly conectividade = inject(ConectividadeService);

  /** Ids das vistorias que ainda estão só no aparelho (para o banner e os chips). */
  readonly idsPendentes = signal<Set<string>>(new Set());
  readonly sincronizando = signal(false);

  constructor() {
    this.atualizarPendentes();
    // effect: roda de novo sempre que `online` ou `logado` mudam.
    // `untracked` impede que os signals lidos dentro de sincronizar() também
    // disparem o effect (senão uma falha de rede viraria um loop de tentativas).
    effect(() => {
      if (this.conectividade.online() && this.auth.logado()) {
        untracked(() => this.sincronizar());
      }
    });
  }

  /** Salva no aparelho (sempre funciona) e tenta enviar em seguida. */
  async registrar(vistoria: Vistoria): Promise<void> {
    await this.local.salvar({ ...vistoria, statusSync: 'pendente' });
    await this.atualizarPendentes();
    this.sincronizar(); // sem await: a tela não espera a rede
  }

  async sincronizar(): Promise<void> {
    if (this.sincronizando() || !navigator.onLine || !this.auth.logado()) return;

    const pendentes = await this.local.pendentes();
    if (pendentes.length === 0) return;

    this.sincronizando.set(true);
    try {
      for (let i = 0; i < pendentes.length; i += TAMANHO_LOTE) {
        const lote = pendentes.slice(i, i + TAMANHO_LOTE).map(semStatus);
        const confirmadas = await firstValueFrom(this.api.enviarLote(lote));
        // Grava a versão do servidor (com vistoriador e data confirmados).
        for (const v of confirmadas) {
          await this.local.salvar({ ...v, statusSync: 'sincronizada' });
        }
        await this.atualizarPendentes();
      }
    } catch (erro) {
      // Sem rede ou servidor fora do ar: tudo que não foi confirmado continua
      // na fila e será reenviado na próxima tentativa.
      console.warn('Sincronização adiada:', erro);
    } finally {
      this.sincronizando.set(false);
    }
  }

  /**
   * Lista para as telas: tenta atualizar com o servidor (se online) e sempre
   * responde a partir do IndexedDB, então funciona offline.
   */
  async listar(): Promise<VistoriaLocal[]> {
    if (navigator.onLine && this.auth.logado()) {
      await this.sincronizar();
      try {
        await this.local.salvarDoServidor(await firstValueFrom(this.api.listar()));
      } catch (erro) {
        console.warn('Usando apenas os dados do aparelho:', erro);
      }
    }
    return this.local.listar();
  }

  private async atualizarPendentes(): Promise<void> {
    const pendentes = await this.local.pendentes();
    this.idsPendentes.set(new Set(pendentes.map((v) => v.id)));
  }
}

/** O campo statusSync é só do aparelho; não vai para o servidor. */
function semStatus({ statusSync, ...vistoria }: VistoriaLocal): Vistoria {
  return vistoria;
}
