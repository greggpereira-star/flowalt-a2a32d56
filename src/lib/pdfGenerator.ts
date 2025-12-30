import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export interface ReportData {
  title: string;
  subtitle?: string;
  generatedAt: Date;
  sections: ReportSection[];
}

export interface ReportSection {
  title: string;
  type: 'table' | 'summary' | 'chart-placeholder';
  data?: ReportTableData;
  summary?: ReportSummaryItem[];
}

export interface ReportTableData {
  headers: string[];
  rows: string[][];
}

export interface ReportSummaryItem {
  label: string;
  value: string | number;
  trend?: 'up' | 'down' | 'neutral';
}

export const generatePDFReport = (report: ReportData): jsPDF => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  let yPosition = 20;

  // Header
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text(report.title, pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 10;

  if (report.subtitle) {
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100);
    doc.text(report.subtitle, pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 8;
  }

  // Generated date
  doc.setFontSize(10);
  doc.setTextColor(150);
  doc.text(
    `Gerado em: ${format(report.generatedAt, "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}`,
    pageWidth / 2,
    yPosition,
    { align: 'center' }
  );
  yPosition += 15;

  // Line separator
  doc.setDrawColor(200);
  doc.line(14, yPosition, pageWidth - 14, yPosition);
  yPosition += 10;

  // Sections
  report.sections.forEach((section) => {
    // Check if we need a new page
    if (yPosition > 250) {
      doc.addPage();
      yPosition = 20;
    }

    // Section title
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0);
    doc.text(section.title, 14, yPosition);
    yPosition += 8;

    if (section.type === 'table' && section.data) {
      autoTable(doc, {
        startY: yPosition,
        head: [section.data.headers],
        body: section.data.rows,
        theme: 'striped',
        headStyles: {
          fillColor: [99, 102, 241], // Primary color (indigo)
          textColor: 255,
          fontStyle: 'bold',
        },
        alternateRowStyles: {
          fillColor: [245, 247, 250],
        },
        margin: { left: 14, right: 14 },
      });
      yPosition = (doc as any).lastAutoTable.finalY + 15;
    }

    if (section.type === 'summary' && section.summary) {
      const summaryBoxWidth = (pageWidth - 28 - 10 * (section.summary.length - 1)) / section.summary.length;
      
      section.summary.forEach((item, index) => {
        const xPos = 14 + index * (summaryBoxWidth + 10);
        
        // Draw box
        doc.setFillColor(245, 247, 250);
        doc.roundedRect(xPos, yPosition, summaryBoxWidth, 30, 3, 3, 'F');
        
        // Value
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0);
        doc.text(String(item.value), xPos + summaryBoxWidth / 2, yPosition + 12, { align: 'center' });
        
        // Label
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100);
        doc.text(item.label, xPos + summaryBoxWidth / 2, yPosition + 22, { align: 'center' });
      });
      
      yPosition += 40;
    }
  });

  // Footer
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(
      `Página ${i} de ${totalPages}`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: 'center' }
    );
    doc.text(
      'Flowalt - Relatório Automatizado',
      14,
      doc.internal.pageSize.getHeight() - 10
    );
  }

  return doc;
};

export const downloadPDF = (doc: jsPDF, filename: string) => {
  doc.save(`${filename}.pdf`);
};
