import { Component, computed, input } from '@angular/core';
import { Icone } from '../shared/icone';
import { Parecer } from './vistoria.model';

/** Chip de status da vistoria: cor + ícone + texto (nunca só a cor). */
@Component({
  selector: 'app-chip-parecer',
  imports: [Icone],
  template: `
    <span class="chip" [class]="'chip ' + visual().classe">
      <app-icone [nome]="visual().icone" [tamanho]="16" />
      {{ parecer() }}
    </span>
  `,
})
export class ChipParecer {
  readonly parecer = input.required<Parecer>();

  protected readonly visual = computed(() => {
    switch (this.parecer()) {
      case 'Aprovada':
        return { classe: 'chip-success', icone: 'check' };
      case 'Reprovada':
        return { classe: 'chip-danger', icone: 'x' };
      default:
        return { classe: 'chip-warning', icone: 'alerta' };
    }
  });
}
