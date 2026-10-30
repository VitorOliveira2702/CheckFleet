import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../auth/auth.service';
import { ConectividadeService } from '../../shared/conectividade.service';
import { Icone } from '../../shared/icone';
import { ChipParecer } from '../chip-parecer';
import { SincronizacaoService } from '../sincronizacao.service';
import { VistoriaLocal } from '../vistoria-local.service';
import { Vistoria, calcularParecer } from '../vistoria.model';
import { baixarLaudo } from '../laudo-pdf';

/** Tela 1 da especificação: Painel do Vistoriador. */
@Component({
  selector: 'app-painel',
  imports: [RouterLink, DatePipe, Icone, ChipParecer],
  templateUrl: './painel.html',
  styleUrl: './painel.css',
})
export class Painel {
  protected readonly sync = inject(SincronizacaoService);
  protected readonly auth = inject(AuthService);
  protected readonly conectividade = inject(ConectividadeService);

  protected readonly hoje = new Date();
  protected readonly carregando = signal(true);
  protected readonly erro = signal(false);
  protected readonly vistorias = signal<VistoriaLocal[]>([]);
  protected readonly gerandoPdf = signal<string | null>(null);

  protected readonly primeiroNome = computed(() => this.auth.usuario()?.nome.split(' ')[0] ?? '');
  protected readonly saudacao = this.hoje.getHours() < 12 ? 'Bom dia' : this.hoje.getHours() < 18 ? 'Boa tarde' : 'Boa noite';

  // KPIs calculados a partir da lista (computed recalcula sozinho quando a lista muda).
  protected readonly totalHoje = computed(
    () => this.vistorias().filter((v) => v.dataHora && new Date(v.dataHora).toDateString() === this.hoje.toDateString()).length,
  );
  protected readonly taxaAprovacao = computed(() => {
    const lista = this.vistorias();
    if (lista.length === 0) return null;
    const aprovadas = lista.filter((v) => calcularParecer(v.itens) === 'Aprovada').length;
    return Math.round((aprovadas / lista.length) * 100);
  });
  protected readonly recentes = computed(() => this.vistorias().slice(0, 5));

  protected readonly parecer = calcularParecer;

  constructor() {
    this.carregar();
  }

  /** Lê do IndexedDB (funciona offline); se houver conexão, atualiza com o servidor antes. */
  protected async carregar(): Promise<void> {
    this.carregando.set(true);
    this.erro.set(false);
    try {
      this.vistorias.set(await this.sync.listar());
    } catch (err) {
      this.erro.set(true);
      console.error(err);
    } finally {
      this.carregando.set(false);
    }
  }

  protected async baixar(v: Vistoria): Promise<void> {
    this.gerandoPdf.set(v.id);
    try {
      await baixarLaudo(v);
    } finally {
      this.gerandoPdf.set(null);
    }
  }
}
