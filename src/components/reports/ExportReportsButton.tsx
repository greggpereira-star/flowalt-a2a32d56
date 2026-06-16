import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { Download, FileText, BarChart3, Clock, DollarSign, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAllCards } from '@/hooks/useCards';
import { useWorkspaceMembers } from '@/hooks/useWorkspaceMembers';
import { generatePDFReport, downloadPDF, ReportData, ReportSection } from '@/lib/pdfGenerator';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const STATUS_LABELS: Record<string, string> = {
  backlog: 'Backlog',
  todo: 'A Fazer',
  in_progress: 'Em Progresso',
  review: 'Revisão',
  delivered: 'Entregue',
  archived: 'Arquivado',
};

const URGENCY_LABELS: Record<string, string> = {
  low: 'Baixa',
  medium: 'Média',
  high: 'Alta',
  urgent: 'Urgente',
};

export const ExportReportsButton: React.FC = () => {
  const { toast } = useToast();
  const [isExporting, setIsExporting] = useState<string | null>(null);
  const { data: cards } = useAllCards();
  const { data: members } = useWorkspaceMembers();

  const generateCardsReport = async () => {
    if (!cards) return;
    setIsExporting('cards');

    try {
      const sections: ReportSection[] = [
        {
          title: 'Resumo',
          type: 'summary',
          summary: [
            { label: 'Total de Cards', value: cards.length },
            { label: 'Em Progresso', value: cards.filter(c => c.status === 'in_progress').length },
            { label: 'Entregues', value: cards.filter(c => c.status === 'delivered').length },
            { label: 'Atrasados', value: cards.filter(c => c.due_date && new Date(c.due_date) < new Date() && c.status !== 'delivered' && c.status !== 'approved').length },
          ],
        },
        {
          title: 'Lista de Cards',
          type: 'table',
          data: {
            headers: ['Título', 'Status', 'Urgência', 'Prazo', 'Horas'],
            rows: cards.slice(0, 50).map(card => [
              card.title.length > 40 ? card.title.substring(0, 40) + '...' : card.title,
              STATUS_LABELS[card.status] || card.status,
              URGENCY_LABELS[card.urgency] || card.urgency,
              card.due_date ? format(new Date(card.due_date), 'dd/MM/yyyy') : '-',
              card.actual_hours?.toFixed(1) || '0',
            ]),
          },
        },
      ];

      const report: ReportData = {
        title: 'Relatório de Cards',
        subtitle: 'Visão geral de todos os cards do workspace',
        generatedAt: new Date(),
        sections,
      };

      const doc = generatePDFReport(report);
      downloadPDF(doc, `relatorio-cards-${format(new Date(), 'yyyy-MM-dd')}`);

      toast({
        title: 'Relatório exportado',
        description: 'O PDF foi baixado com sucesso.',
      });
    } catch (error) {
      console.error('Error generating report:', error);
      toast({
        title: 'Erro ao exportar',
        description: 'Não foi possível gerar o relatório.',
        variant: 'destructive',
      });
    } finally {
      setIsExporting(null);
    }
  };

  const generateProductivityReport = async () => {
    if (!cards || !members) return;
    setIsExporting('productivity');

    try {
      // Group cards by status
      const statusCounts = cards.reduce((acc, card) => {
        acc[card.status] = (acc[card.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const sections: ReportSection[] = [
        {
          title: 'Métricas de Produtividade',
          type: 'summary',
          summary: [
            { label: 'Cards Entregues', value: statusCounts.delivered || 0 },
            { label: 'Em Andamento', value: statusCounts.in_progress || 0 },
            { label: 'Total de Horas', value: `${cards.reduce((sum, c) => sum + (c.actual_hours || 0), 0).toFixed(1)}h` },
            { label: 'Membros Ativos', value: members.length },
          ],
        },
        {
          title: 'Cards por Status',
          type: 'table',
          data: {
            headers: ['Status', 'Quantidade', 'Percentual'],
            rows: Object.entries(statusCounts).map(([status, count]) => [
              STATUS_LABELS[status] || status,
              String(count),
              `${((count / cards.length) * 100).toFixed(1)}%`,
            ]),
          },
        },
      ];

      const report: ReportData = {
        title: 'Relatório de Produtividade',
        subtitle: 'Análise de desempenho da equipe',
        generatedAt: new Date(),
        sections,
      };

      const doc = generatePDFReport(report);
      downloadPDF(doc, `relatorio-produtividade-${format(new Date(), 'yyyy-MM-dd')}`);

      toast({
        title: 'Relatório exportado',
        description: 'O PDF foi baixado com sucesso.',
      });
    } catch (error) {
      console.error('Error generating report:', error);
      toast({
        title: 'Erro ao exportar',
        description: 'Não foi possível gerar o relatório.',
        variant: 'destructive',
      });
    } finally {
      setIsExporting(null);
    }
  };

  const generateTimeReport = async () => {
    if (!cards) return;
    setIsExporting('time');

    try {
      const cardsWithTime = cards.filter(c => c.actual_hours && c.actual_hours > 0);
      const totalHours = cards.reduce((sum, c) => sum + (c.actual_hours || 0), 0);
      const estimatedHours = cards.reduce((sum, c) => sum + (c.estimated_hours || 0), 0);

      const sections: ReportSection[] = [
        {
          title: 'Resumo de Tempo',
          type: 'summary',
          summary: [
            { label: 'Horas Trabalhadas', value: `${totalHours.toFixed(1)}h` },
            { label: 'Horas Estimadas', value: `${estimatedHours.toFixed(1)}h` },
            { label: 'Cards com Tempo', value: cardsWithTime.length },
            { label: 'Média por Card', value: `${cardsWithTime.length > 0 ? (totalHours / cardsWithTime.length).toFixed(1) : 0}h` },
          ],
        },
        {
          title: 'Cards por Tempo Investido',
          type: 'table',
          data: {
            headers: ['Card', 'Estimado', 'Real', 'Diferença'],
            rows: cardsWithTime.slice(0, 30).map(card => {
              const diff = (card.actual_hours || 0) - (card.estimated_hours || 0);
              return [
                card.title.length > 35 ? card.title.substring(0, 35) + '...' : card.title,
                `${(card.estimated_hours || 0).toFixed(1)}h`,
                `${(card.actual_hours || 0).toFixed(1)}h`,
                `${diff >= 0 ? '+' : ''}${diff.toFixed(1)}h`,
              ];
            }),
          },
        },
      ];

      const report: ReportData = {
        title: 'Relatório de Tempo',
        subtitle: 'Análise de horas trabalhadas',
        generatedAt: new Date(),
        sections,
      };

      const doc = generatePDFReport(report);
      downloadPDF(doc, `relatorio-tempo-${format(new Date(), 'yyyy-MM-dd')}`);

      toast({
        title: 'Relatório exportado',
        description: 'O PDF foi baixado com sucesso.',
      });
    } catch (error) {
      console.error('Error generating report:', error);
      toast({
        title: 'Erro ao exportar',
        description: 'Não foi possível gerar o relatório.',
        variant: 'destructive',
      });
    } finally {
      setIsExporting(null);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Download className="h-4 w-4" />
          Exportar PDF
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Escolha um relatório</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={generateCardsReport} disabled={!!isExporting}>
          {isExporting === 'cards' ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <FileText className="h-4 w-4 mr-2" />
          )}
          Relatório de Cards
        </DropdownMenuItem>
        <DropdownMenuItem onClick={generateProductivityReport} disabled={!!isExporting}>
          {isExporting === 'productivity' ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <BarChart3 className="h-4 w-4 mr-2" />
          )}
          Relatório de Produtividade
        </DropdownMenuItem>
        <DropdownMenuItem onClick={generateTimeReport} disabled={!!isExporting}>
          {isExporting === 'time' ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Clock className="h-4 w-4 mr-2" />
          )}
          Relatório de Tempo
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
