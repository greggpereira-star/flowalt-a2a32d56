import jsPDF from 'jspdf';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export interface TaxGuideData {
  guideName: string;
  guideCode?: string;
  competencia: Date;
  dueDate: Date;
  value: number;
  revenue: number;
  regime: string;
  effectiveRate: number;
  breakdown?: {
    label: string;
    value: number;
    percentage: number;
  }[];
}

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
};

const regimeLabels: Record<string, string> = {
  simples_nacional: "Simples Nacional",
  lucro_presumido: "Lucro Presumido",
  lucro_real: "Lucro Real",
};

export const generateTaxGuidePDF = (data: TaxGuideData): jsPDF => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 210mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 297mm
  const margin = 15;
  const contentWidth = pageWidth - (margin * 2);
  
  let y = margin;

  // ============ HEADER - Faixa azul ============
  doc.setFillColor(37, 99, 235); // Blue-600
  doc.rect(0, 0, pageWidth, 45, 'F');

  // Logo/Nome do sistema
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(255, 255, 255);
  doc.text('FLOWALT', margin, 12);

  // Título principal
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text(data.guideName, margin, 28);

  // Subtítulo
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  const competenciaText = format(data.competencia, "MMMM 'de' yyyy", { locale: ptBR });
  doc.text(`Competência: ${competenciaText}`, margin, 38);

  // Badge de código no canto direito
  if (data.guideCode) {
    const badgeWidth = 35;
    const badgeX = pageWidth - margin - badgeWidth;
    doc.setFillColor(255, 255, 255, 0.2);
    doc.roundedRect(badgeX, 22, badgeWidth, 12, 2, 2, 'F');
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(data.guideCode, badgeX + badgeWidth / 2, 30, { align: 'center' });
  }

  y = 55;

  // ============ INFORMAÇÕES PRINCIPAIS ============
  // Box com valor principal
  const mainBoxHeight = 50;
  doc.setFillColor(248, 250, 252); // Slate-50
  doc.setDrawColor(226, 232, 240); // Slate-200
  doc.roundedRect(margin, y, contentWidth, mainBoxHeight, 4, 4, 'FD');

  // Valor da guia (destaque)
  doc.setFontSize(32);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42); // Slate-900
  doc.text(formatCurrency(data.value), margin + contentWidth / 2, y + 22, { align: 'center' });

  // Label do valor
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139); // Slate-500
  doc.text('VALOR A PAGAR', margin + contentWidth / 2, y + 32, { align: 'center' });

  // Vencimento
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(220, 38, 38); // Red-600
  doc.text(`Vencimento: ${format(data.dueDate, "dd/MM/yyyy")}`, margin + contentWidth / 2, y + 44, { align: 'center' });

  y += mainBoxHeight + 15;

  // ============ GRID DE INFORMAÇÕES ============
  const gridCols = 3;
  const colWidth = contentWidth / gridCols;
  const gridHeight = 45;

  // Background do grid
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, y, contentWidth, gridHeight, 4, 4, 'FD');

  // Linhas divisórias verticais
  doc.setDrawColor(226, 232, 240);
  doc.line(margin + colWidth, y + 8, margin + colWidth, y + gridHeight - 8);
  doc.line(margin + colWidth * 2, y + 8, margin + colWidth * 2, y + gridHeight - 8);

  // Coluna 1: Competência
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(format(data.competencia, "MM/yyyy"), margin + colWidth / 2, y + 18, { align: 'center' });
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text('COMPETÊNCIA', margin + colWidth / 2, y + 28, { align: 'center' });

  // Coluna 2: Regime
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  const regimeText = regimeLabels[data.regime] || data.regime;
  doc.text(regimeText, margin + colWidth + colWidth / 2, y + 18, { align: 'center' });
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text('REGIME TRIBUTÁRIO', margin + colWidth + colWidth / 2, y + 28, { align: 'center' });

  // Coluna 3: Alíquota
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(`${data.effectiveRate.toFixed(2)}%`, margin + colWidth * 2 + colWidth / 2, y + 18, { align: 'center' });
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text('ALÍQUOTA EFETIVA', margin + colWidth * 2 + colWidth / 2, y + 28, { align: 'center' });

  y += gridHeight + 15;

  // ============ BASE DE CÁLCULO ============
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('Base de Cálculo', margin, y);
  y += 8;

  // Box da receita
  doc.setFillColor(240, 253, 244); // Emerald-50
  doc.setDrawColor(187, 247, 208); // Emerald-200
  doc.roundedRect(margin, y, contentWidth, 35, 4, 4, 'FD');

  // Ícone de receita (círculo verde)
  doc.setFillColor(34, 197, 94); // Emerald-500
  doc.circle(margin + 15, y + 17.5, 8, 'F');
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('R$', margin + 15, y + 20, { align: 'center' });

  // Valor da receita
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(22, 101, 52); // Emerald-800
  doc.text(formatCurrency(data.revenue), margin + 35, y + 15);

  // Label
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(34, 197, 94);
  doc.text('Receita Bruta do Período', margin + 35, y + 26);

  y += 45;

  // ============ COMPOSIÇÃO DOS TRIBUTOS ============
  if (data.breakdown && data.breakdown.length > 0) {
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text('Composição dos Tributos', margin, y);
    y += 8;

    // Box de breakdown
    const breakdownHeight = 10 + data.breakdown.length * 18 + 10;
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(margin, y, contentWidth, breakdownHeight, 4, 4, 'FD');

    let breakdownY = y + 12;
    
    data.breakdown.forEach((item, index) => {
      // Label
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105); // Slate-600
      doc.text(item.label, margin + 10, breakdownY);

      // Percentage
      doc.text(`${item.percentage.toFixed(2)}%`, margin + contentWidth / 2, breakdownY, { align: 'center' });

      // Value
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text(formatCurrency(item.value), margin + contentWidth - 10, breakdownY, { align: 'right' });

      // Linha divisória (exceto última)
      if (index < data.breakdown!.length - 1) {
        doc.setDrawColor(241, 245, 249); // Slate-100
        doc.line(margin + 10, breakdownY + 6, margin + contentWidth - 10, breakdownY + 6);
      }

      breakdownY += 18;
    });

    y += breakdownHeight + 10;
  }

  // ============ INSTRUÇÕES DE PAGAMENTO ============
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('Instruções de Pagamento', margin, y);
  y += 8;

  // Box de instruções
  doc.setFillColor(254, 252, 232); // Yellow-50
  doc.setDrawColor(253, 224, 71); // Yellow-300
  doc.roundedRect(margin, y, contentWidth, 40, 4, 4, 'FD');

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(113, 63, 18); // Yellow-900

  const instructions = [
    '• Este documento é uma estimativa. Gere a guia oficial no Portal do Simples Nacional ou e-CAC.',
    '• O pagamento deve ser efetuado até a data de vencimento para evitar multas e juros.',
    '• Em caso de dúvidas, consulte seu contador ou acesse o portal da Receita Federal.',
  ];

  let instrY = y + 12;
  instructions.forEach(instr => {
    doc.text(instr, margin + 8, instrY);
    instrY += 10;
  });

  // ============ FOOTER ============
  // Linha divisória
  doc.setDrawColor(226, 232, 240);
  doc.line(margin, pageHeight - 25, pageWidth - margin, pageHeight - 25);

  // Data de geração
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184); // Slate-400
  doc.text(
    `Documento gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`,
    margin,
    pageHeight - 18
  );

  // Aviso legal
  doc.setFontSize(7);
  doc.text(
    'Este documento é um cálculo estimado e não substitui a guia oficial emitida pelos órgãos competentes.',
    margin,
    pageHeight - 12
  );

  // Logo Flowalt
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(37, 99, 235);
  doc.text('FLOWALT', pageWidth - margin, pageHeight - 15, { align: 'right' });
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184);
  doc.text('Sistema de Gestão Financeira', pageWidth - margin, pageHeight - 10, { align: 'right' });

  return doc;
};

export const downloadTaxGuidePDF = (doc: jsPDF, guideId: string, competencia: Date): void => {
  const filename = `${guideId}_${format(competencia, "yyyy-MM")}.pdf`;
  doc.save(filename);
};
