import React from 'react';
import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  tip?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  tip,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center py-12 px-4 text-center',
        className
      )}
    >
      <div className="relative mb-4">
        <div className="absolute inset-0 bg-primary/10 blur-xl rounded-full scale-150" />
        <div className="relative p-4 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20">
          <Icon className="h-10 w-10 text-primary/70" />
        </div>
      </div>
      
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-muted-foreground max-w-sm mb-4">{description}</p>
      
      {tip && (
        <div className="bg-muted/50 rounded-lg px-4 py-2 mb-4 max-w-md">
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">💡 Dica:</span> {tip}
          </p>
        </div>
      )}
      
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

// Preset empty states for common scenarios
export const EMPTY_STATES = {
  cards: {
    icon: 'FileText' as const,
    title: 'Nenhum card ainda',
    description: 'Crie seu primeiro card para começar a organizar o trabalho.',
    tip: 'Cards são unidades de trabalho. Cada card pode ter briefing, checklist, anexos e muito mais.',
  },
  spaces: {
    icon: 'Folder' as const,
    title: 'Nenhum espaço criado',
    description: 'Espaços organizam seus projetos e áreas de trabalho.',
    tip: 'Crie espaços para diferentes áreas como "Produção", "Comercial" ou projetos específicos.',
  },
  timeEntries: {
    icon: 'Clock' as const,
    title: 'Nenhum tempo registrado',
    description: 'Comece a registrar o tempo gasto nas atividades.',
    tip: 'Registrar tempo ajuda a entender onde está o esforço e melhorar estimativas futuras.',
  },
  events: {
    icon: 'Calendar' as const,
    title: 'Agenda vazia',
    description: 'Nenhum evento agendado para este período.',
    tip: 'Agende reuniões, deadlines e lembretes para manter a equipe sincronizada.',
  },
  transactions: {
    icon: 'DollarSign' as const,
    title: 'Nenhuma transação',
    description: 'Registre receitas e despesas para ter visibilidade financeira.',
    tip: 'Categorize suas transações para entender melhor o fluxo de caixa.',
  },
  notifications: {
    icon: 'Bell' as const,
    title: 'Tudo em dia!',
    description: 'Você não tem notificações pendentes.',
    tip: 'Notificações aparecem aqui quando há atualizações importantes.',
  },
  comments: {
    icon: 'MessageSquare' as const,
    title: 'Sem comentários',
    description: 'Seja o primeiro a comentar neste card.',
    tip: 'Use @ para mencionar pessoas e notificá-las diretamente.',
  },
  checklists: {
    icon: 'CheckSquare' as const,
    title: 'Checklist vazio',
    description: 'Adicione itens para organizar as etapas do trabalho.',
    tip: 'Cada item pode ser atribuído a uma pessoa específica.',
  },
  webhooks: {
    icon: 'Webhook' as const,
    title: 'Nenhum webhook configurado',
    description: 'Webhooks permitem integrar com sistemas externos.',
    tip: 'Configure webhooks para receber atualizações em tempo real.',
  },
  apiKeys: {
    icon: 'Key' as const,
    title: 'Nenhuma API key',
    description: 'Crie uma API key para integrar via REST API.',
    tip: 'API keys permitem que sistemas externos acessem seus dados de forma segura.',
  },
  goals: {
    icon: 'Target' as const,
    title: 'Nenhuma meta ativa',
    description: 'Metas ajudam a motivar a equipe com objetivos claros.',
    tip: 'Defina metas semanais alcançáveis para manter o ritmo de produção.',
  },
  rankings: {
    icon: 'Trophy' as const,
    title: 'Ranking ainda não calculado',
    description: 'O ranking é atualizado diariamente.',
    tip: 'Complete cards e registre tempo para subir no ranking.',
  },
};
