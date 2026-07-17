import { toPng } from 'html-to-image';
import jsPDF from 'jspdf';

/**
 * Rasteriza cada elemento de página A4 (um por opção "Orçamento N") e monta
 * um PDF multi-página. Fidelidade pixel-perfect: o que está na tela é o PDF.
 */
export async function exportProposalPagesToPdf(
  pageElements: HTMLElement[],
  filename = 'proposta.pdf'
): Promise<void> {
  if (pageElements.length === 0) return;

  // Formato explícito em px (794x1123 = A4 @ 96dpi) — evita depender do preset
  // 'a4' do jsPDF sob unidade 'px', que pode não corresponder ao render real.
  const firstEl = pageElements[0];
  const pxW = firstEl.offsetWidth;
  const pxH = firstEl.offsetHeight;
  const doc = new jsPDF({ unit: 'px', format: [pxW, pxH], orientation: 'portrait', compress: true });
  const pageWidth = pxW;
  const pageHeight = pxH;

  for (let i = 0; i < pageElements.length; i++) {
    const el = pageElements[i];
    const dataUrl = await toPng(el, {
      pixelRatio: 2,
      width: el.offsetWidth,
      height: el.offsetHeight,
      style: { margin: '0' },
    });

    if (i > 0) doc.addPage();
    doc.addImage(dataUrl, 'PNG', 0, 0, pageWidth, pageHeight, undefined, 'FAST');
  }

  doc.save(filename);
}

/** Gera o PDF como Blob (para upload/anexo em vez de download direto). */
export async function renderProposalPagesToPdfBlob(pageElements: HTMLElement[]): Promise<Blob> {
  if (pageElements.length === 0) throw new Error('Nenhuma página para exportar.');

  // Formato explícito em px (794x1123 = A4 @ 96dpi) — evita depender do preset
  // 'a4' do jsPDF sob unidade 'px', que pode não corresponder ao render real.
  const firstEl = pageElements[0];
  const pxW = firstEl.offsetWidth;
  const pxH = firstEl.offsetHeight;
  const doc = new jsPDF({ unit: 'px', format: [pxW, pxH], orientation: 'portrait', compress: true });
  const pageWidth = pxW;
  const pageHeight = pxH;

  for (let i = 0; i < pageElements.length; i++) {
    const el = pageElements[i];
    const dataUrl = await toPng(el, {
      pixelRatio: 2,
      width: el.offsetWidth,
      height: el.offsetHeight,
      style: { margin: '0' },
    });
    if (i > 0) doc.addPage();
    doc.addImage(dataUrl, 'PNG', 0, 0, pageWidth, pageHeight, undefined, 'FAST');
  }

  return doc.output('blob');
}
