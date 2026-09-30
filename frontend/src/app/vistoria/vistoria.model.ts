export type StatusItem = 'OK' | 'DEFEITO';

export interface ItemChecklist {
  nome: string;
  status: StatusItem;
  observacao: string;
}

export interface Vistoria {
  id: string;
  placa: string;
  itens: ItemChecklist[];
}

/**
 * Itens padrão do checklist (RF01). Fixos por enquanto — o objetivo da PoC é
 * validar a arquitetura offline-first, não um cadastro configurável de itens.
 */
export function criarChecklistPadrao(): ItemChecklist[] {
  return [
    { nome: 'Pneus', status: 'OK', observacao: '' },
    { nome: 'Freios', status: 'OK', observacao: '' },
    { nome: 'Avarias na lataria', status: 'OK', observacao: '' },
    { nome: 'Nível de óleo', status: 'OK', observacao: '' },
    { nome: 'Luzes e sinalização', status: 'OK', observacao: '' },
  ];
}
