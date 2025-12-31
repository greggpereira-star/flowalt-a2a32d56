import React, { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FileText,
  Database,
  Shield,
  Zap,
  Users,
  Workflow,
  LayoutGrid,
  Calendar,
  BarChart3,
  Settings,
  RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useDefaultWorkflow, useWorkflowStages } from '@/hooks/useWorkflow';
import { useAllCards } from '@/hooks/useCards';
import { useDependencies } from '@/hooks/useDependencies';
import { useAutomations } from '@/hooks/useAutomations';
import { useWorkspaceMembers } from '@/hooks/useWorkspaceMembers';
import { useSpaces } from '@/hooks/useSpaces';

interface QAItem {
  id: string;
  category: string;
  name: string;
  description: string;
  status: 'ok' | 'warning' | 'error' | 'pending';
  details?: string;
}

interface QACategory {
  id: string;
  name: string;
  icon: React.ElementType;
  items: QAItem[];
}

const STATUS_CONFIG = {
  ok: { label: 'OK', color: 'text-green-600', bg: 'bg-green-500/10', icon: CheckCircle2 },
  warning: { label: 'Atenção', color: 'text-yellow-600', bg: 'bg-yellow-500/10', icon: AlertTriangle },
  error: { label: 'Erro', color: 'text-red-600', bg: 'bg-red-500/10', icon: XCircle },
  pending: { label: 'Pendente', color: 'text-muted-foreground', bg: 'bg-muted', icon: RefreshCw },
};

export const QAChecklist: React.FC = () => {
  const { currentWorkspace } = useWorkspace();
  const { data: workflow } = useDefaultWorkflow();
  const { data: stages = [] } = useWorkflowStages(workflow?.id);
  const { data: cards = [] } = useAllCards();
  const { data: dependencies = [] } = useDependencies();
  const { data: automations = [] } = useAutomations();
  const { data: members = [] } = useWorkspaceMembers();
  const { data: spaces = [] } = useSpaces();

  const qaCategories = useMemo((): QACategory[] => {
    const categories: QACategory[] = [];

    // 1. Workspace & RBAC
    categories.push({
      id: 'workspace',
      name: 'Workspace & RBAC',
      icon: Users,
      items: [
        {
          id: 'workspace-exists',
          category: 'workspace',
          name: 'Workspace configurado',
          description: 'Verificar se o workspace está ativo',
          status: currentWorkspace?.id ? 'ok' : 'error',
          details: currentWorkspace?.name || 'Sem workspace',
        },
        {
          id: 'members-count',
          category: 'workspace',
          name: 'Membros cadastrados',
          description: 'Pelo menos 1 membro ativo',
          status: members.length > 0 ? 'ok' : 'warning',
          details: `${members.length} membro(s)`,
        },
        {
          id: 'spaces-configured',
          category: 'workspace',
          name: 'Espaços configurados',
          description: 'Pelo menos 1 espaço criado',
          status: spaces.length > 0 ? 'ok' : 'warning',
          details: `${spaces.length} espaço(s)`,
        },
      ],
    });

    // 2. Workflow
    categories.push({
      id: 'workflow',
      name: 'Workflow',
      icon: Workflow,
      items: [
        {
          id: 'workflow-active',
          category: 'workflow',
          name: 'Workflow padrão ativo',
          description: 'Um workflow default configurado',
          status: workflow?.id ? 'ok' : 'error',
          details: workflow?.name || 'Sem workflow',
        },
        {
          id: 'stages-configured',
          category: 'workflow',
          name: 'Etapas configuradas',
          description: 'Mínimo de 3 etapas no workflow',
          status: stages.length >= 3 ? 'ok' : stages.length > 0 ? 'warning' : 'error',
          details: `${stages.length} etapa(s)`,
        },
        {
          id: 'initial-stage',
          category: 'workflow',
          name: 'Etapa inicial definida',
          description: 'Uma etapa marcada como inicial',
          status: stages.some(s => s.is_initial) ? 'ok' : 'error',
          details: stages.find(s => s.is_initial)?.name || 'Não definida',
        },
        {
          id: 'final-stage',
          category: 'workflow',
          name: 'Etapa final definida',
          description: 'Uma etapa marcada como final',
          status: stages.some(s => s.is_final) ? 'ok' : 'error',
          details: stages.find(s => s.is_final)?.name || 'Não definida',
        },
        {
          id: 'gates-configured',
          category: 'workflow',
          name: 'Gates de validação',
          description: 'Pelo menos 1 etapa com gate ativo',
          status: stages.some(s => s.requires_briefing || s.requires_checklist || s.requires_no_dependencies) 
            ? 'ok' : 'warning',
          details: `${stages.filter(s => s.requires_briefing || s.requires_checklist).length} etapa(s) com gates`,
        },
      ],
    });

    // 3. Cards & Data
    const cardsWithBriefing = cards.filter(c => c.briefing_completed);
    const cardsWithDueDate = cards.filter(c => c.due_date);
    const overdueCards = cards.filter(c => c.due_date && new Date(c.due_date) < new Date() && c.status !== 'delivered');

    categories.push({
      id: 'cards',
      name: 'Cards & Dados',
      icon: LayoutGrid,
      items: [
        {
          id: 'cards-count',
          category: 'cards',
          name: 'Cards cadastrados',
          description: 'Total de cards no workspace',
          status: cards.length > 0 ? 'ok' : 'warning',
          details: `${cards.length} card(s)`,
        },
        {
          id: 'briefing-rate',
          category: 'cards',
          name: 'Taxa de briefing completo',
          description: 'Cards com briefing preenchido',
          status: cards.length === 0 ? 'pending' : 
            (cardsWithBriefing.length / cards.length) > 0.7 ? 'ok' : 
            (cardsWithBriefing.length / cards.length) > 0.3 ? 'warning' : 'error',
          details: cards.length > 0 
            ? `${Math.round((cardsWithBriefing.length / cards.length) * 100)}%` 
            : 'N/A',
        },
        {
          id: 'deadline-rate',
          category: 'cards',
          name: 'Cards com prazo',
          description: 'Porcentagem de cards com due_date',
          status: cards.length === 0 ? 'pending' :
            (cardsWithDueDate.length / cards.length) > 0.8 ? 'ok' : 'warning',
          details: cards.length > 0 
            ? `${Math.round((cardsWithDueDate.length / cards.length) * 100)}%` 
            : 'N/A',
        },
        {
          id: 'overdue-cards',
          category: 'cards',
          name: 'Cards atrasados',
          description: 'Cards com prazo vencido',
          status: overdueCards.length === 0 ? 'ok' : overdueCards.length <= 3 ? 'warning' : 'error',
          details: `${overdueCards.length} atrasado(s)`,
        },
      ],
    });

    // 4. Dependencies
    categories.push({
      id: 'dependencies',
      name: 'Dependências',
      icon: Zap,
      items: [
        {
          id: 'deps-configured',
          category: 'dependencies',
          name: 'Dependências ativas',
          description: 'Total de dependências cadastradas',
          status: 'ok',
          details: `${dependencies.length} dependência(s)`,
        },
        {
          id: 'blocking-deps',
          category: 'dependencies',
          name: 'Cards bloqueados',
          description: 'Cards aguardando dependências',
          status: dependencies.filter(d => {
            const blockingCard = cards.find(c => c.id === d.blocking_card_id);
            return blockingCard && blockingCard.status !== 'delivered';
          }).length > 5 ? 'warning' : 'ok',
          details: `${dependencies.filter(d => {
            const blockingCard = cards.find(c => c.id === d.blocking_card_id);
            return blockingCard && blockingCard.status !== 'delivered';
          }).length} bloqueio(s) ativo(s)`,
        },
      ],
    });

    // 5. Automations
    const activeAutomations = automations.filter((a: any) => a.is_active);
    
    categories.push({
      id: 'automations',
      name: 'Automações',
      icon: Settings,
      items: [
        {
          id: 'automations-configured',
          category: 'automations',
          name: 'Automações cadastradas',
          description: 'Total de automações no workspace',
          status: automations.length > 0 ? 'ok' : 'warning',
          details: `${automations.length} automação(ões)`,
        },
        {
          id: 'automations-active',
          category: 'automations',
          name: 'Automações ativas',
          description: 'Automações em execução',
          status: activeAutomations.length > 0 ? 'ok' : 'warning',
          details: `${activeAutomations.length} ativa(s)`,
        },
      ],
    });

    return categories;
  }, [currentWorkspace, workflow, stages, cards, dependencies, automations, members, spaces]);

  const totalItems = qaCategories.reduce((acc, cat) => acc + cat.items.length, 0);
  const okItems = qaCategories.reduce(
    (acc, cat) => acc + cat.items.filter(i => i.status === 'ok').length, 
    0
  );
  const warningItems = qaCategories.reduce(
    (acc, cat) => acc + cat.items.filter(i => i.status === 'warning').length, 
    0
  );
  const errorItems = qaCategories.reduce(
    (acc, cat) => acc + cat.items.filter(i => i.status === 'error').length, 
    0
  );
  const progressPercent = Math.round((okItems / totalItems) * 100);

  return (
    <div className="space-y-6">
      {/* Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            QA Técnico e Funcional
          </CardTitle>
          <CardDescription>
            Checklist de verificação da implementação do blueprint
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Progress value={progressPercent} className="flex-1" />
            <span className="text-sm font-medium">{progressPercent}%</span>
          </div>
          
          <div className="grid grid-cols-4 gap-4">
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <p className="text-2xl font-bold">{totalItems}</p>
              <p className="text-xs text-muted-foreground">Total</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-green-500/10">
              <p className="text-2xl font-bold text-green-600">{okItems}</p>
              <p className="text-xs text-muted-foreground">OK</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-yellow-500/10">
              <p className="text-2xl font-bold text-yellow-600">{warningItems}</p>
              <p className="text-xs text-muted-foreground">Atenção</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-red-500/10">
              <p className="text-2xl font-bold text-red-600">{errorItems}</p>
              <p className="text-xs text-muted-foreground">Erro</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Categories */}
      <Card>
        <CardContent className="pt-6">
          <Accordion type="multiple" defaultValue={qaCategories.map(c => c.id)}>
            {qaCategories.map((category) => {
              const Icon = category.icon;
              const catOk = category.items.filter(i => i.status === 'ok').length;
              const catTotal = category.items.length;
              
              return (
                <AccordionItem key={category.id} value={category.id}>
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center gap-3 flex-1">
                      <Icon className="h-5 w-5 text-muted-foreground" />
                      <span className="font-medium">{category.name}</span>
                      <Badge variant="outline" className="ml-auto mr-2">
                        {catOk}/{catTotal}
                      </Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-2 pt-2">
                      {category.items.map((item) => {
                        const config = STATUS_CONFIG[item.status];
                        const StatusIcon = config.icon;
                        
                        return (
                          <div
                            key={item.id}
                            className={cn(
                              'flex items-center gap-3 p-3 rounded-lg',
                              config.bg
                            )}
                          >
                            <StatusIcon className={cn('h-5 w-5 shrink-0', config.color)} />
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm">{item.name}</p>
                              <p className="text-xs text-muted-foreground">{item.description}</p>
                            </div>
                            <div className="text-right shrink-0">
                              <Badge variant="secondary" className="text-xs">
                                {item.details}
                              </Badge>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        </CardContent>
      </Card>
    </div>
  );
};
