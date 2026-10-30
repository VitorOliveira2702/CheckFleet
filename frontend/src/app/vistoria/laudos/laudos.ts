import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Icone } from '../../shared/icone';
import { ChipParecer } from '../chip-parecer';
import { SincronizacaoService } from '../sincronizacao.service';
import { VistoriaLocal } from '../vistoria-local.service';
import { Vistoria, calcularConformidade, calcularParecer } from '../vistoria.model';
import { baixarLaudo, compartilharLaudo } from '../laudo-pdf';

/** Lista de todas as vistorias, com laudo em PDF para baixar ou enviar por e-mail. */
@Component({
  selector: 'app-laudos',
  imports: [DatePipe, FormsModule, RouterLink, Icone, ChipParecer],
  templateUrl: './laudos.html',
  styleUrl: './laudos.css',
})
export class Laudos {
  protected readonly sync = inject(SincronizacaoService);

  protected readonly carregando = signal(true);
  protected readonly erro = signal(false);
  protected readonly vistorias = signal<VistoriaLocal[]>([]);
  protected readonly busca = signal('');
  protected readonly gerando = signal<string | null>(null);
  protected readonly mensagem = signal<string | null>(null);

  protected readonly filtradas = computed(() => {
    const termo = this.busca().replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    return termo ? this.vistorias().filter((v) => v.placa.includes(termo)) : this.vistorias();
  });

  protected readonly parecer = calcularParecer;
  protected readonly conformidade = calcularConformidade;

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
    await this.executar(v, () => baixarLaudo(v));
  }

  protected async compartilhar(v: Vistoria): Promise<void> {
    await this.executar(v, async () => {
      if ((await compartilharLaudo(v)) === 'email-aberto') {
        this.mensagem.set('PDF baixado. Anexe o arquivo no e-mail que foi aberto.');
      }
    });
  }

  private async executar(v: Vistoria, acao: () => Promise<unknown>): Promise<void> {
    this.gerando.set(v.id);
    this.mensagem.set(null);
    try {
      await acao();
    } catch (err) {
      this.mensagem.set('Não foi possível gerar o PDF.');
      console.error(err);
    } finally {
      this.gerando.set(null);
    }
  }
}
