import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Icone } from '../../shared/icone';
import { ChipParecer } from '../chip-parecer';
import { AuthService } from '../../auth/auth.service';
import { SincronizacaoService } from '../sincronizacao.service';
import {
  FINALIDADES,
  FotoVistoria,
  ItemChecklist,
  MAX_FOTOS,
  ROTULO_STATUS,
  StatusItem,
  Vistoria,
  calcularConformidade,
  calcularParecer,
  criarChecklistPadrao,
} from '../vistoria.model';
import { comprimirImagem } from '../foto.util';
import { baixarLaudo, compartilharLaudo } from '../laudo-pdf';

/**
 * Cadastro de vistoria (RF01) em 3 etapas, como no stepper da especificação:
 * 1. Identificação (placa, finalidade, hodômetro)
 * 2. Checklist + fotos
 * 3. Revisão (índice de conformidade, parecer) e envio
 */
@Component({
  selector: 'app-nova-vistoria',
  imports: [FormsModule, RouterLink, Icone, ChipParecer],
  templateUrl: './nova-vistoria.html',
  styleUrl: './nova-vistoria.css',
})
export class NovaVistoria {
  private readonly auth = inject(AuthService);
  protected readonly sync = inject(SincronizacaoService);

  protected readonly etapas = ['Identificação', 'Checklist', 'Revisão'];
  protected readonly etapa = signal(0);

  protected readonly finalidades = FINALIDADES;
  protected readonly maxFotos = MAX_FOTOS;
  protected readonly opcoesStatus: { valor: StatusItem; icone: string }[] = [
    { valor: 'OK', icone: 'check' },
    { valor: 'ATENCAO', icone: 'alerta' },
    { valor: 'DEFEITO', icone: 'x' },
  ];
  protected readonly rotuloStatus = ROTULO_STATUS;

  // Campos do formulário (ligados com [(ngModel)])
  protected placa = '';
  protected finalidade = '';
  protected hodometro: number | null = null;
  // Signals onde a tela precisa reagir a mudanças (resumo, contador de fotos).
  protected readonly itens = signal<ItemChecklist[]>(criarChecklistPadrao());
  protected readonly fotos = signal<FotoVistoria[]>([]);

  protected readonly processandoFoto = signal(false);
  protected readonly enviando = signal(false);
  protected readonly erro = signal<string | null>(null);
  /** Vistoria salva no aparelho; quando existe, mostramos a tela de concluído. */
  protected readonly salva = signal<Vistoria | null>(null);
  protected readonly gerandoPdf = signal(false);
  protected readonly mensagemPdf = signal<string | null>(null);

  protected readonly parecer = computed(() => calcularParecer(this.itens()));
  protected readonly conformidade = computed(() => calcularConformidade(this.itens()));

  protected avancar(): void {
    this.erro.set(null);
    if (this.etapa() === 0 && !this.placaValida()) {
      this.erro.set('Informe uma placa válida (ex.: ABC1D23).');
      return;
    }
    this.etapa.update((e) => Math.min(e + 1, this.etapas.length - 1));
    window.scrollTo({ top: 0 });
  }

  protected voltar(): void {
    this.erro.set(null);
    this.etapa.update((e) => Math.max(e - 1, 0));
  }

  protected definirStatus(item: ItemChecklist, status: StatusItem): void {
    // Cria um novo array para o signal perceber a mudança e recalcular o parecer.
    this.itens.update((lista) => lista.map((i) => (i === item ? { ...i, status } : i)));
  }

  protected atualizarObservacao(item: ItemChecklist, observacao: string): void {
    item.observacao = observacao;
  }

  /** Recebe as fotos escolhidas (câmera ou galeria) e comprime cada uma. */
  protected async anexarFotos(evento: Event): Promise<void> {
    const input = evento.target as HTMLInputElement;
    const arquivos = Array.from(input.files ?? []);
    input.value = ''; // permite escolher o mesmo arquivo de novo depois

    const espaco = MAX_FOTOS - this.fotos().length;
    if (arquivos.length > espaco) {
      this.erro.set(`Limite de ${MAX_FOTOS} fotos por vistoria.`);
    }

    this.processandoFoto.set(true);
    try {
      for (const arquivo of arquivos.slice(0, espaco)) {
        const dataUrl = await comprimirImagem(arquivo);
        this.fotos.update((lista) => [...lista, { legenda: '', dataUrl }]);
      }
      navigator.vibrate?.(30); // feedback tátil na captura
    } catch {
      this.erro.set('Não foi possível ler uma das imagens.');
    } finally {
      this.processandoFoto.set(false);
    }
  }

  protected removerFoto(indice: number): void {
    this.fotos.update((lista) => lista.filter((_, i) => i !== indice));
  }

  /**
   * Offline-first: grava no IndexedDB (RF04) e entra na fila de sincronização
   * (RF05). Não espera a internet, então funciona igual com ou sem sinal.
   */
  protected async salvar(): Promise<void> {
    const usuario = this.auth.usuario();
    const vistoria: Vistoria = {
      // UUID gerado no dispositivo (RF09): é o que garante que, se essa vistoria
      // for reenviada mais tarde pela fila de sincronização, o servidor não
      // crie um registro duplicado (RNF05).
      id: crypto.randomUUID(),
      placa: this.placaNormalizada(),
      // Hora real da inspeção, e não a hora em que a sincronização acontecer.
      dataHora: new Date().toISOString(),
      finalidade: this.finalidade || undefined,
      hodometro: this.hodometro,
      itens: this.itens(),
      fotos: this.fotos(),
      // Só para exibir no aparelho e no PDF; o servidor usa o token do Google.
      vistoriadorNome: usuario?.nome,
      vistoriadorEmail: usuario?.email,
    };

    this.enviando.set(true);
    this.erro.set(null);
    try {
      await this.sync.registrar(vistoria);
      this.salva.set(vistoria);
    } catch (err) {
      this.erro.set('Não foi possível salvar no aparelho. Verifique o espaço de armazenamento.');
      console.error(err);
    } finally {
      this.enviando.set(false);
    }
  }

  protected async baixarPdf(): Promise<void> {
    await this.comPdf(async (v) => {
      await baixarLaudo(v);
      this.mensagemPdf.set('PDF baixado.');
    });
  }

  protected async compartilharPdf(): Promise<void> {
    await this.comPdf(async (v) => {
      const resultado = await compartilharLaudo(v);
      if (resultado === 'email-aberto') {
        this.mensagemPdf.set('PDF baixado. Anexe o arquivo no e-mail que foi aberto.');
      }
    });
  }

  protected novaVistoria(): void {
    this.placa = '';
    this.finalidade = '';
    this.hodometro = null;
    this.itens.set(criarChecklistPadrao());
    this.fotos.set([]);
    this.salva.set(null);
    this.mensagemPdf.set(null);
    this.etapa.set(0);
  }

  private async comPdf(acao: (v: Vistoria) => Promise<void>): Promise<void> {
    const v = this.salva();
    if (!v) return;
    this.gerandoPdf.set(true);
    this.mensagemPdf.set(null);
    try {
      await acao(v);
    } catch (err) {
      this.mensagemPdf.set('Não foi possível gerar o PDF.');
      console.error(err);
    } finally {
      this.gerandoPdf.set(false);
    }
  }

  private placaNormalizada(): string {
    return this.placa.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  }

  /** Aceita o padrão antigo (ABC1234) e o Mercosul (ABC1D23). */
  private placaValida(): boolean {
    return /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(this.placaNormalizada());
  }
}
