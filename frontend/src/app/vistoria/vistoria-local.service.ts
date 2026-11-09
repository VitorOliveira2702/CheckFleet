import { Injectable } from '@angular/core';
import { Vistoria } from './vistoria.model';

/** pendente = só existe no aparelho; sincronizada = o servidor já confirmou. */
export type StatusSync = 'pendente' | 'sincronizada';

export interface VistoriaLocal extends Vistoria {
  statusSync: StatusSync;
}

const NOME_BANCO = 'checkfleet';
// Versão 2: navegadores que rodaram a versão antiga do app já têm o banco na
// versão 1 sem o índice 'statusSync'. Subir a versão força o onupgradeneeded.
const VERSAO = 2;
const STORE = 'vistorias';

/**
 * Persistência local das vistorias no IndexedDB (RF04).
 *
 * Toda vistoria é gravada aqui primeiro, com ou sem internet. Ela só sai do
 * status "pendente" quando o servidor confirma o recebimento (ver
 * SincronizacaoService). Assim, fechar o app, ficar sem bateria ou perder o
 * sinal não perde dados: o IndexedDB fica no disco do aparelho.
 *
 * Usa a API nativa do navegador, sem biblioteca. A API do IndexedDB é baseada
 * em eventos (onsuccess/onerror); a função `aguardar` abaixo transforma isso
 * em Promise para podermos usar async/await.
 */
@Injectable({ providedIn: 'root' })
export class VistoriaLocalService {
  private banco?: Promise<IDBDatabase>;

  /** Grava (ou substitui, se o id já existir) uma vistoria no aparelho. */
  async salvar(vistoria: VistoriaLocal): Promise<void> {
    const store = await this.store('readwrite');
    await aguardar(store.put(vistoria));
  }

  /** Todas as vistorias do aparelho, da mais recente para a mais antiga. */
  async listar(): Promise<VistoriaLocal[]> {
    const store = await this.store('readonly');
    const todas = await aguardar<VistoriaLocal[]>(store.getAll());
    return todas.sort((a, b) => (b.dataHora ?? '').localeCompare(a.dataHora ?? ''));
  }

  /** A fila de sincronização (RF05): vistorias que o servidor ainda não confirmou. */
  async pendentes(): Promise<VistoriaLocal[]> {
    const store = await this.store('readonly');
    return aguardar<VistoriaLocal[]>(store.index('statusSync').getAll('pendente'));
  }

  /** Só os ids da fila, sem carregar os dados (e as fotos) de cada vistoria. */
  async idsPendentes(): Promise<string[]> {
    const store = await this.store('readonly');
    return aguardar(store.index('statusSync').getAllKeys('pendente')) as Promise<string[]>;
  }

  /** Remove uma vistoria do aparelho. Usado apenas pelas ferramentas de teste. */
  async excluir(id: string): Promise<void> {
    const store = await this.store('readwrite');
    await aguardar(store.delete(id));
  }

  /**
   * Guarda a lista vinda do servidor como "sincronizada", para o painel e os
   * laudos continuarem disponíveis offline. Vistorias ainda pendentes neste
   * aparelho não são sobrescritas.
   */
  async salvarDoServidor(lista: Vistoria[]): Promise<void> {
    const pendentes = new Set(await this.idsPendentes());
    const store = await this.store('readwrite');
    await Promise.all(
      lista.filter((v) => !pendentes.has(v.id)).map((v) => aguardar(store.put({ ...v, statusSync: 'sincronizada' }))),
    );
  }

  private async store(modo: IDBTransactionMode): Promise<IDBObjectStore> {
    const banco = await this.abrir();
    return banco.transaction(STORE, modo).objectStore(STORE);
  }

  private abrir(): Promise<IDBDatabase> {
    this.banco ??= new Promise((resolve, reject) => {
      const requisicao = indexedDB.open(NOME_BANCO, VERSAO);

      // Roda só na primeira vez (ou quando VERSAO aumenta): cria a "tabela".
      // Cria só o que ainda não existe, para servir tanto para um banco novo
      // quanto para um banco antigo que já tem a store mas não tem o índice.
      requisicao.onupgradeneeded = () => {
        const banco = requisicao.result;
        const store = banco.objectStoreNames.contains(STORE)
          ? requisicao.transaction!.objectStore(STORE)
          : banco.createObjectStore(STORE, { keyPath: 'id' });
        // Índice para buscar rápido só as pendentes (a fila de sincronização).
        if (!store.indexNames.contains('statusSync')) {
          store.createIndex('statusSync', 'statusSync');
        }
      };
      requisicao.onsuccess = () => resolve(requisicao.result);
      requisicao.onerror = () => reject(requisicao.error);
    });
    return this.banco;
  }
}

function aguardar<T>(requisicao: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    requisicao.onsuccess = () => resolve(requisicao.result);
    requisicao.onerror = () => reject(requisicao.error);
  });
}
