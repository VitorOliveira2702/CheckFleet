import type { jsPDF } from 'jspdf';
import { ROTULO_STATUS, StatusItem, Vistoria, calcularConformidade, calcularParecer } from './vistoria.model';

/*
 * Laudo em PDF gerado no próprio navegador (jsPDF), sem depender do servidor:
 * funciona offline, logo depois de salvar a vistoria.
 *
 * O jsPDF é carregado com import() dinâmico, só quando o usuário pede um PDF,
 * para não pesar o carregamento inicial do app.
 */

type RGB = [number, number, number];

const COR = {
  primary: [15, 59, 110],
  accent: [245, 166, 35],
  ink: [16, 24, 40],
  muted: [91, 102, 118],
  border: [217, 223, 231],
  OK: [30, 142, 78],
  ATENCAO: [199, 119, 0],
  DEFEITO: [198, 40, 40],
} satisfies Record<string, RGB>;

const MARGEM = 16;
const LARGURA = 210; // A4 em mm
const ALTURA = 297;

export function nomeArquivoLaudo(v: Vistoria): string {
  return `laudo-${v.placa}-${v.id.slice(0, 8)}.pdf`;
}

export async function gerarLaudoPdf(v: Vistoria): Promise<Blob> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const hash = await calcularHash(v);

  let y = cabecalho(doc);

  // ---- Dados da vistoria ----
  y = tituloSecao(doc, 'Identificação', y);
  const dados: [string, string, boolean][] = [
    ['Placa', v.placa, true],
    ['Data', v.dataHora ? new Date(v.dataHora).toLocaleString('pt-BR') : new Date().toLocaleString('pt-BR'), false],
    ['Finalidade', v.finalidade || '—', false],
    ['Hodômetro', v.hodometro != null ? `${v.hodometro.toLocaleString('pt-BR')} km` : '—', true],
    ['Vistoriador', v.vistoriadorNome || v.vistoriadorEmail || '—', false],
  ];
  dados.forEach(([rotulo, valor, mono], i) => {
    const x = MARGEM + (i % 2) * 89;
    const linhaY = y + Math.floor(i / 2) * 13;
    doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(...COR.muted).text(rotulo.toUpperCase(), x, linhaY);
    doc
      .setFont(mono ? 'courier' : 'helvetica', mono ? 'bold' : 'normal')
      .setFontSize(11)
      .setTextColor(...COR.ink)
      .text(valor, x, linhaY + 5);
  });
  y += Math.ceil(dados.length / 2) * 13 + 4;

  // ---- Parecer e índice de conformidade ----
  const parecer = calcularParecer(v.itens);
  const conformidade = calcularConformidade(v.itens);
  const corParecer = parecer === 'Aprovada' ? COR.OK : parecer === 'Reprovada' ? COR.DEFEITO : COR.ATENCAO;
  doc.setDrawColor(...corParecer).setLineWidth(0.6).roundedRect(MARGEM, y, LARGURA - 2 * MARGEM, 20, 3, 3);
  doc.setFont('helvetica', 'bold').setFontSize(22).setTextColor(...corParecer).text(`${conformidade}%`, MARGEM + 6, y + 13);
  doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(...COR.muted).text('ÍNDICE DE CONFORMIDADE', MARGEM + 40, y + 8);
  doc.setFont('helvetica', 'bold').setFontSize(13).setTextColor(...corParecer).text(`Parecer: ${parecer}`, MARGEM + 40, y + 15);
  y += 28;

  // ---- Checklist ----
  y = tituloSecao(doc, 'Checklist', y);
  for (const item of v.itens) {
    const observacao = item.observacao ? doc.setFontSize(9).splitTextToSize(item.observacao, 110) : [];
    const alturaLinha = 9 + observacao.length * 4;
    y = garantirEspaco(doc, y, alturaLinha);

    doc.setFont('helvetica', 'bold').setFontSize(11).setTextColor(...COR.ink).text(item.nome, MARGEM, y + 5);
    seloStatus(doc, item.status, LARGURA - MARGEM, y + 5);
    if (observacao.length) {
      doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(...COR.muted).text(observacao, MARGEM, y + 10);
    }
    y += alturaLinha;
    doc.setDrawColor(...COR.border).setLineWidth(0.2).line(MARGEM, y, LARGURA - MARGEM, y);
    y += 2;
  }
  y += 6;

  // ---- Fotos (2 por linha) ----
  if (v.fotos?.length) {
    const larguraFoto = (LARGURA - 2 * MARGEM - 6) / 2;
    const alturaFoto = larguraFoto * 0.75;
    // O título só fica nesta página se a primeira linha de fotos couber junto.
    y = garantirEspaco(doc, y, 7 + alturaFoto + 10);
    y = tituloSecao(doc, `Registro fotográfico (${v.fotos.length})`, y);
    for (let i = 0; i < v.fotos.length; i += 2) {
      y = garantirEspaco(doc, y, alturaFoto + 10);
      v.fotos.slice(i, i + 2).forEach((foto, j) => {
        const x = MARGEM + j * (larguraFoto + 6);
        doc.addImage(foto.dataUrl, 'JPEG', x, y, larguraFoto, alturaFoto, undefined, 'FAST');
        doc
          .setFont('helvetica', 'normal')
          .setFontSize(8)
          .setTextColor(...COR.muted)
          .text(foto.legenda || `Foto ${i + j + 1}`, x, y + alturaFoto + 4);
      });
      y += alturaFoto + 10;
    }
  }

  rodapes(doc, v.id, hash);
  return doc.output('blob');
}

/** Baixa o PDF no aparelho. */
export async function baixarLaudo(v: Vistoria): Promise<void> {
  const blob = await gerarLaudoPdf(v);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = nomeArquivoLaudo(v);
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Envia o PDF por e-mail (ou WhatsApp etc.).
 *
 * No celular, usa o menu nativo de compartilhar (Web Share API), que já anexa
 * o arquivo no app de e-mail escolhido. Onde isso não existe (a maioria dos
 * navegadores de computador), baixa o PDF e abre um e-mail em branco para o
 * usuário anexar o arquivo — um link mailto: não consegue anexar sozinho.
 *
 * Retorna 'compartilhado' ou 'email-aberto' para a tela mostrar a mensagem certa.
 */
export async function compartilharLaudo(v: Vistoria): Promise<'compartilhado' | 'email-aberto' | 'cancelado'> {
  const blob = await gerarLaudoPdf(v);
  const arquivo = new File([blob], nomeArquivoLaudo(v), { type: 'application/pdf' });
  const assunto = `Laudo de vistoria - placa ${v.placa}`;

  if (navigator.canShare?.({ files: [arquivo] })) {
    try {
      await navigator.share({ files: [arquivo], title: assunto, text: `${assunto} (CheckFleet)` });
      return 'compartilhado';
    } catch {
      return 'cancelado'; // usuário fechou o menu de compartilhar
    }
  }

  await baixarLaudo(v);
  const corpo = `Segue em anexo o laudo de vistoria do veículo de placa ${v.placa}.\n\nArquivo: ${nomeArquivoLaudo(v)}`;
  window.location.href = `mailto:?subject=${encodeURIComponent(assunto)}&body=${encodeURIComponent(corpo)}`;
  return 'email-aberto';
}

// ---------------------------------------------------------------------------

function cabecalho(doc: jsPDF): number {
  doc.setFillColor(...COR.primary).rect(0, 0, LARGURA, 26, 'F');
  doc.setFillColor(...COR.accent).rect(0, 26, LARGURA, 1.2, 'F');
  doc.setTextColor(255, 255, 255).setFontSize(18);
  doc.setFont('helvetica', 'bold').text('Check', MARGEM, 16);
  const larguraCheck = doc.getTextWidth('Check');
  doc.setFont('helvetica', 'normal').text('Fleet', MARGEM + larguraCheck, 16);
  doc.setFontSize(11).text('Laudo de Vistoria Veicular', LARGURA - MARGEM, 16, { align: 'right' });
  return 38;
}

function tituloSecao(doc: jsPDF, titulo: string, y: number): number {
  doc.setFont('helvetica', 'bold').setFontSize(12).setTextColor(...COR.primary).text(titulo, MARGEM, y);
  return y + 7;
}

function seloStatus(doc: jsPDF, status: StatusItem, xDireita: number, y: number): void {
  const texto = ROTULO_STATUS[status].toUpperCase();
  doc.setFont('helvetica', 'bold').setFontSize(9);
  const largura = doc.getTextWidth(texto) + 8;
  doc.setFillColor(...COR[status]).roundedRect(xDireita - largura, y - 4.2, largura, 6, 3, 3, 'F');
  doc.setTextColor(255, 255, 255).text(texto, xDireita - largura / 2, y, { align: 'center' });
}

/** Se não couber na página atual, começa uma nova. */
function garantirEspaco(doc: jsPDF, y: number, altura: number): number {
  if (y + altura <= ALTURA - 24) return y;
  doc.addPage();
  return 20;
}

function rodapes(doc: jsPDF, id: string, hash: string): void {
  const paginas = doc.getNumberOfPages();
  for (let p = 1; p <= paginas; p++) {
    doc.setPage(p);
    doc.setDrawColor(...COR.border).setLineWidth(0.2).line(MARGEM, ALTURA - 16, LARGURA - MARGEM, ALTURA - 16);
    doc.setFont('courier', 'normal').setFontSize(7).setTextColor(...COR.muted);
    doc.text(`ID ${id}`, MARGEM, ALTURA - 11);
    doc.text(`SHA-256 ${hash}`, MARGEM, ALTURA - 7);
    doc.setFont('helvetica', 'normal').text(`${p}/${paginas}`, LARGURA - MARGEM, ALTURA - 11, { align: 'right' });
  }
}

/**
 * Impressão digital (SHA-256) do conteúdo da vistoria. Se alguém alterar os
 * dados do laudo, o hash recalculado deixa de bater com o impresso no PDF.
 */
async function calcularHash(v: Vistoria): Promise<string> {
  const conteudo = JSON.stringify({ id: v.id, placa: v.placa, itens: v.itens, fotos: v.fotos?.map((f) => f.dataUrl) });
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(conteudo));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}
