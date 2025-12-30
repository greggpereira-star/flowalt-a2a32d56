import React from 'react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Info } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MetricTooltipProps {
  title: string;
  description: string;
  importance: string;
  children: React.ReactNode;
  className?: string;
}

export function MetricTooltip({
  title,
  description,
  importance,
  children,
  className,
}: MetricTooltipProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className={cn('group relative cursor-help', className)}>
          {children}
          <Info className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity absolute top-0 right-0" />
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[300px] p-4">
        <div className="space-y-2">
          <p className="font-semibold text-sm">{title}</p>
          <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
          <div className="pt-2 border-t">
            <p className="text-xs">
              <span className="font-medium text-primary">Por que importa:</span>{' '}
              <span className="text-muted-foreground">{importance}</span>
            </p>
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

// Pre-defined metric tooltips for common metrics
export const METRIC_TOOLTIPS = {
  totalCards: {
    title: 'Total de Cards',
    description: 'Quantidade total de cards ativos no workspace, excluindo arquivados.',
    importance: 'Indica o volume total de trabalho sendo gerenciado. Um número muito alto pode indicar necessidade de arquivar cards antigos.',
  },
  completedCards: {
    title: 'Cards Entregues',
    description: 'Cards que foram concluídos e marcados como "Entregue".',
    importance: 'Mede a produtividade real da equipe. Compare com o período anterior para identificar tendências.',
  },
  inProgressCards: {
    title: 'Cards em Progresso',
    description: 'Cards que estão ativamente sendo trabalhados no momento.',
    importance: 'Se muito alto em relação à capacidade da equipe, pode indicar sobrecarga. Idealmente, cada pessoa deveria focar em 2-3 cards.',
  },
  overdueCards: {
    title: 'Cards Atrasados',
    description: 'Cards com data de entrega passada que ainda não foram concluídos.',
    importance: 'Indicador crítico de saúde do projeto. Atrasos recorrentes podem indicar estimativas ruins ou problemas de capacidade.',
  },
  weeklyHours: {
    title: 'Horas da Semana',
    description: 'Total de horas registradas pela equipe na semana atual.',
    importance: 'Permite comparar esforço planejado vs realizado e identificar semanas atípicas.',
  },
  completionRate: {
    title: 'Taxa de Conclusão',
    description: 'Percentual de cards concluídos em relação ao total criados no período.',
    importance: 'Alta taxa indica boa gestão de escopo. Taxa muito baixa pode indicar excesso de cards criados ou gargalos no fluxo.',
  },
  avgTimeToComplete: {
    title: 'Tempo Médio de Conclusão',
    description: 'Tempo médio entre criação e entrega de um card.',
    importance: 'Ajuda a prever prazos realistas para novos cards e identificar tipos de trabalho que demoram mais.',
  },
  capacityUtilization: {
    title: 'Utilização de Capacidade',
    description: 'Percentual da capacidade total da equipe que está sendo utilizada.',
    importance: 'Entre 70-85% é ideal. Muito baixo indica ociosidade, muito alto indica risco de burnout.',
  },
  revenue: {
    title: 'Receita',
    description: 'Total de receitas registradas no período selecionado.',
    importance: 'Principal indicador financeiro. Compare com despesas para entender a margem real.',
  },
  expenses: {
    title: 'Despesas',
    description: 'Total de despesas registradas no período, incluindo folha de pagamento.',
    importance: 'Controle de custos é essencial para manter margem saudável.',
  },
  margin: {
    title: 'Margem',
    description: 'Diferença entre receitas e despesas, representando o lucro.',
    importance: 'Margens abaixo de 20% podem indicar necessidade de revisar preços ou reduzir custos.',
  },
  hourManCost: {
    title: 'Custo Hora-Homem',
    description: 'Custo médio por hora trabalhada, considerando salários e overhead.',
    importance: 'Base para precificação de projetos. Se muito alto, compromete competitividade.',
  },
} as const;
