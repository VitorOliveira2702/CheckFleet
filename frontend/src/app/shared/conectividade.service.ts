import { Injectable, signal } from '@angular/core';

/**
 * Indica se o aparelho está online, usando os eventos `online`/`offline` do
 * navegador. Alimenta o banner de conectividade ("estado sempre visível") e
 * será a base da fila de sincronização (RF05).
 */
@Injectable({ providedIn: 'root' })
export class ConectividadeService {
  readonly online = signal(navigator.onLine);

  constructor() {
    window.addEventListener('online', () => this.online.set(true));
    window.addEventListener('offline', () => this.online.set(false));
  }
}
