/**
 * OK = conforme, ATENCAO = passa mas precisa de acompanhamento,
 * DEFEITO = reprovado. O nome DEFEITO foi mantido para continuar compatível
 * com as vistorias que já estão no banco.
 */
export type StatusItem = 'OK' | 'ATENCAO' | 'DEFEITO';

export const ROTULO_STATUS: Record<StatusItem, string> = {
  OK: 'OK',
  ATENCAO: 'Atenção',
  DEFEITO: 'Reprovado',
};

export interface ItemChecklist {
  nome: string;
  status: StatusItem;
  observacao: string;
}

/** Foto comprimida no navegador, guardada como data URL (base64). */
export interface FotoVistoria {
  legenda: string;
  dataUrl: string;
}

export interface Vistoria {
  id: string;
  placa: string;
  finalidade?: string;
  hodometro?: number | null;
  itens: ItemChecklist[];
  fotos: FotoVistoria[];
  // Preenchidos pelo servidor (data do registro e quem estava logado).
  dataHora?: string;
  vistoriadorNome?: string;
  vistoriadorEmail?: string;
}

export const FINALIDADES = ['Cautelar / Procedência', 'Transferência Detran', 'Prévia de Seguro'];

/** Limite de fotos por vistoria (o backend também valida esse máximo). */
export const MAX_FOTOS = 12;

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

export type Parecer = 'Aprovada' | 'Com ressalvas' | 'Reprovada';

/** Um item reprovado reprova a vistoria; um item em atenção gera ressalva. */
export function calcularParecer(itens: ItemChecklist[]): Parecer {
  if (itens.some((i) => i.status === 'DEFEITO')) return 'Reprovada';
  if (itens.some((i) => i.status === 'ATENCAO')) return 'Com ressalvas';
  return 'Aprovada';
}

/** Índice de conformidade de 0 a 100: OK vale 1 ponto, Atenção vale meio. */
export function calcularConformidade(itens: ItemChecklist[]): number {
  if (itens.length === 0) return 0;
  const pontos = itens.reduce((soma, i) => soma + (i.status === 'OK' ? 1 : i.status === 'ATENCAO' ? 0.5 : 0), 0);
  return Math.round((pontos / itens.length) * 100);
}
