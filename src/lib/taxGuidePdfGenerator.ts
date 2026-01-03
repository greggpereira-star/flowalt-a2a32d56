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

// Gera linha digitável fictícia baseada nos dados
const generateLinhaDigitavel = (value: number, dueDate: Date, competencia: Date): string => {
  const valorStr = Math.round(value * 100).toString().padStart(10, '0');
  const vencStr = format(dueDate, 'ddMMyyyy');
  const compStr = format(competencia, 'MMyyyy');
  
  // Formato fictício para visualização: XXXXX.XXXXX XXXXX.XXXXXX XXXXX.XXXXXX X XXXXXXXXXXXXXXXX
  const part1 = `85810${compStr.slice(0, 1)}`;
  const part2 = `${compStr.slice(1, 6)}0`;
  const part3 = `00000${valorStr.slice(0, 1)}`;
  const part4 = `${valorStr.slice(1, 7)}`;
  const part5 = `${valorStr.slice(7)}${vencStr.slice(0, 3)}`;
  const part6 = `${vencStr.slice(3)}00`;
  const dv = ((value * 7) % 9) + 1;
  const final = `${dv}${vencStr}${valorStr}`;
  
  return `${part1}.${part2} ${part3}.${part4} ${part5}.${part6} ${dv} ${final}`;
};

// Gera código de barras visual simplificado
const drawBarcode = (doc: jsPDF, x: number, y: number, width: number, height: number, value: number): void => {
  const numBars = 44;
  const barWidth = width / numBars;
  const seed = Math.round(value * 100);
  
  doc.setFillColor(0, 0, 0);
  
  for (let i = 0; i < numBars; i++) {
    // Padrão pseudo-aleatório baseado no valor
    const isFilled = ((seed * (i + 1) * 7) % 3) !== 0;
    if (isFilled) {
      const thisBarWidth = ((seed * i) % 2 === 0) ? barWidth * 0.6 : barWidth * 1.2;
      doc.rect(x + (i * barWidth), y, Math.min(thisBarWidth, barWidth * 1.5), height, 'F');
    }
  }
};

export const generateTaxGuidePDF = (data: TaxGuideData): jsPDF => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = 210;
  const margin = 20;
  const contentWidth = pageWidth - (margin * 2);
  
  let y = margin;

  // ============ HEADER MINIMALISTA ============
  doc.setFillColor(30, 64, 175); // Blue-800
  doc.rect(0, 0, pageWidth, 35, 'F');

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(191, 219, 254); // Blue-200
  doc.text('FLOWALT • Sistema de Gestão', margin, 12);

  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text(data.guideName, margin, 25);

  y = 50;

  // ============ LINHA DIGITÁVEL (DESTAQUE) ============
  const linhaDigitavel = generateLinhaDigitavel(data.value, data.dueDate, data.competencia);
  
  doc.setFillColor(250, 250, 250);
  doc.setDrawColor(200, 200, 200);
  doc.roundedRect(margin, y, contentWidth, 28, 2, 2, 'FD');
  
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  doc.text('LINHA DIGITÁVEL', margin + 6, y + 8);
  
  doc.setFontSize(11);
  doc.setFont('courier', 'bold');
  doc.setTextColor(30, 30, 30);
  doc.text(linhaDigitavel, margin + 6, y + 20);

  y += 38;

  // ============ CÓDIGO DE BARRAS ============
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(220, 220, 220);
  doc.roundedRect(margin, y, contentWidth, 24, 2, 2, 'FD');
  
  drawBarcode(doc, margin + 10, y + 6, contentWidth - 20, 12, data.value);

  y += 34;

  // ============ INFORMAÇÕES PRINCIPAIS - 2 COLUNAS ============
  const col1Width = contentWidth * 0.5;
  const col2Width = contentWidth * 0.5;

  // Coluna esquerda - Valor
  doc.setFillColor(239, 246, 255); // Blue-50
  doc.setDrawColor(191, 219, 254); // Blue-200
  doc.roundedRect(margin, y, col1Width - 4, 44, 2, 2, 'FD');

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  doc.text('VALOR DO DOCUMENTO', margin + 8, y + 12);

  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 64, 175); // Blue-800
  doc.text(formatCurrency(data.value), margin + 8, y + 30);

  // Coluna direita - Vencimento
  doc.setFillColor(254, 242, 242); // Red-50
  doc.setDrawColor(254, 202, 202); // Red-200
  doc.roundedRect(margin + col1Width, y, col2Width, 44, 2, 2, 'FD');

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  doc.text('DATA DE VENCIMENTO', margin + col1Width + 8, y + 12);

  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(185, 28, 28); // Red-700
  doc.text(format(data.dueDate, 'dd/MM/yyyy'), margin + col1Width + 8, y + 30);

  y += 54;

  // ============ DADOS DO DOCUMENTO ============
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(60, 60, 60);
  doc.text('DADOS DO DOCUMENTO', margin, y);

  y += 8;

  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(230, 230, 230);
  doc.roundedRect(margin, y, contentWidth, 48, 2, 2, 'FD');

  // Linha 1
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(120, 120, 120);
  doc.text('Competência:', margin + 8, y + 12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(40, 40, 40);
  doc.text(format(data.competencia, "MMMM 'de' yyyy", { locale: ptBR }), margin + 45, y + 12);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(120, 120, 120);
  doc.text('Regime:', margin + contentWidth / 2 + 8, y + 12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(40, 40, 40);
  doc.text(regimeLabels[data.regime] || data.regime, margin + contentWidth / 2 + 35, y + 12);

  // Linha divisória
  doc.setDrawColor(240, 240, 240);
  doc.line(margin + 8, y + 20, margin + contentWidth - 8, y + 20);

  // Linha 2
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(120, 120, 120);
  doc.text('Base de Cálculo:', margin + 8, y + 30);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(40, 40, 40);
  doc.text(formatCurrency(data.revenue), margin + 50, y + 30);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(120, 120, 120);
  doc.text('Alíquota Efetiva:', margin + contentWidth / 2 + 8, y + 30);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(40, 40, 40);
  doc.text(`${data.effectiveRate.toFixed(2)}%`, margin + contentWidth / 2 + 50, y + 30);

  // Linha divisória
  doc.line(margin + 8, y + 38, margin + contentWidth - 8, y + 38);

  // Linha 3
  if (data.guideCode) {
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(120, 120, 120);
    doc.text('Código da Guia:', margin + 8, y + 46);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(40, 40, 40);
    doc.text(data.guideCode, margin + 50, y + 46);
  }

  y += 58;

  // ============ COMPOSIÇÃO TRIBUTÁRIA (se houver) ============
  if (data.breakdown && data.breakdown.length > 0) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(60, 60, 60);
    doc.text('COMPOSIÇÃO DOS TRIBUTOS', margin, y);

    y += 8;

    const rowHeight = 10;
    const tableHeight = 8 + (data.breakdown.length * rowHeight) + 8;

    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(230, 230, 230);
    doc.roundedRect(margin, y, contentWidth, tableHeight, 2, 2, 'FD');

    // Header da tabela
    doc.setFillColor(248, 248, 248);
    doc.rect(margin + 1, y + 1, contentWidth - 2, 10, 'F');
    
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 100, 100);
    doc.text('TRIBUTO', margin + 8, y + 7);
    doc.text('ALÍQUOTA', margin + contentWidth / 2, y + 7, { align: 'center' });
    doc.text('VALOR', margin + contentWidth - 8, y + 7, { align: 'right' });

    let tableY = y + 16;
    
    data.breakdown.forEach((item, index) => {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(60, 60, 60);
      doc.text(item.label, margin + 8, tableY);
      
      doc.setTextColor(100, 100, 100);
      doc.text(`${item.percentage.toFixed(2)}%`, margin + contentWidth / 2, tableY, { align: 'center' });
      
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(40, 40, 40);
      doc.text(formatCurrency(item.value), margin + contentWidth - 8, tableY, { align: 'right' });

      if (index < data.breakdown!.length - 1) {
        doc.setDrawColor(245, 245, 245);
        doc.line(margin + 8, tableY + 4, margin + contentWidth - 8, tableY + 4);
      }

      tableY += rowHeight;
    });

    y += tableHeight + 10;
  }

  // ============ AVISO IMPORTANTE - DESTAQUE MÁXIMO ============
  doc.setFillColor(254, 226, 226); // Red-100
  doc.setDrawColor(220, 38, 38); // Red-600
  doc.setLineWidth(0.8);
  doc.roundedRect(margin, y, contentWidth, 32, 2, 2, 'FD');
  doc.setLineWidth(0.2);

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(185, 28, 28); // Red-700
  doc.text('GUIA ESTIMADA - APENAS PARA PLANEJAMENTO', margin + 8, y + 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(127, 29, 29); // Red-900
  doc.text('Para efetuar o pagamento, gere a guia oficial no Portal PGDAS-D:', margin + 8, y + 22);
  
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 64, 175); // Blue-800
  doc.text('www8.receita.fazenda.gov.br/simplesnacional', margin + 8, y + 29);

  // ============ FOOTER ============
  const footerY = 280;
  
  doc.setDrawColor(220, 220, 220);
  doc.line(margin, footerY - 8, pageWidth - margin, footerY - 8);

  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(150, 150, 150);
  doc.text(`Gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })} • FLOWALT`, margin, footerY);
  doc.text('Este documento não substitui a guia oficial', pageWidth - margin, footerY, { align: 'right' });

  return doc;
};

export const downloadTaxGuidePDF = (doc: jsPDF, guideId: string, competencia: Date): void => {
  const filename = `${guideId}_${format(competencia, "yyyy-MM")}.pdf`;
  doc.save(filename);
};
