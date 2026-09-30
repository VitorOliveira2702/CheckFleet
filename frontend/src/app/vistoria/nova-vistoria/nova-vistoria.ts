import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { VistoriaService } from '../vistoria.service';
import { ItemChecklist, Vistoria, criarChecklistPadrao } from '../vistoria.model';

@Component({
  selector: 'app-nova-vistoria',
  imports: [FormsModule],
  templateUrl: './nova-vistoria.html',
  styleUrl: './nova-vistoria.css',
})
export class NovaVistoria {
  private readonly service = inject(VistoriaService);

  protected placa = '';
  protected itens: ItemChecklist[] = criarChecklistPadrao();

  protected enviando = signal(false);
  protected mensagem = signal<string | null>(null);
  protected erro = signal<string | null>(null);
  protected vistorias = signal<Vistoria[]>([]);

  constructor() {
    this.carregarVistorias();
  }

  protected salvar(): void {
    if (!this.placa.trim()) {
      this.erro.set('Informe a placa do veículo.');
      return;
    }

    const vistoria: Vistoria = {
      // UUID gerado no dispositivo (RF09): é o que garante que, se essa vistoria
      // for reenviada mais tarde pela fila de sincronização, o servidor não
      // crie um registro duplicado (RNF05).
      id: crypto.randomUUID(),
      placa: this.placa.trim().toUpperCase(),
      itens: this.itens,
    };

    this.enviando.set(true);
    this.erro.set(null);
    this.mensagem.set(null);

    this.service.cadastrar(vistoria).subscribe({
      next: () => {
        this.mensagem.set(`Vistoria da placa ${vistoria.placa} cadastrada com sucesso.`);
        this.resetarFormulario();
        this.carregarVistorias();
        this.enviando.set(false);
      },
      error: (err) => {
        this.erro.set('Não foi possível cadastrar a vistoria. Verifique se o backend está rodando.');
        this.enviando.set(false);
        console.error(err);
      },
    });
  }

  private resetarFormulario(): void {
    this.placa = '';
    this.itens = criarChecklistPadrao();
  }

  private carregarVistorias(): void {
    this.service.listar().subscribe({
      next: (lista) => this.vistorias.set(lista),
      error: (err) => console.error(err),
    });
  }
}
