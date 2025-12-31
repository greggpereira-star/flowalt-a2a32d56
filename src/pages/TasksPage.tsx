import React, { useState, useMemo } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { EmptyState } from '@/components/ui/empty-state';
import {
  CheckSquare,
  Clock,
  AlertTriangle,
  Search,
  Calendar,
  FileText,
  Filter,
  ArrowRight,
  Play,
} from 'lucide-react';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, isToday, isTomorrow, isPast, isFuture, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { usePageTracking } from '@/hooks/usePageTracking';
import { CardDetailSheet } from '@/components/cards/CardDetailSheet';
import type { Card as CardType } from '@/hooks/useCards';

const STATUS_LABELS: Record<string, string> = {
  backlog: 'Backlog',
  briefing: 'Briefing',
  todo: 'A Fazer',
  in_progress: 'Em Progresso',
  review: 'Revisão',
  approved: 'Aprovado',
  delivered: 'Entregue',
};

const STATUS_COLORS: Record<string, string> = {
  backlog: 'bg-muted text-muted-foreground',
  briefing: 'bg-blue-500/20 text-blue-600 dark:text-blue-400',
  todo: 'bg-primary/20 text-primary',
  in_progress: 'bg-yellow-500/20 text-yellow-600 dark:text-yellow-400',
  review: 'bg-purple-500/20 text-purple-600 dark:text-purple-400',
  approved: 'bg-green-500/20 text-green-600 dark:text-green-400',
  delivered: 'bg-green-500/20 text-green-600 dark:text-green-400',
};

const TasksPage: React.FC = () => {
  usePageTracking('cards');
  const { currentWorkspace } = useWorkspace();
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);

  // Fetch cards where user is owner or member
  const { data: myCards, isLoading } = useQuery({
    queryKey: ['my-tasks', currentWorkspace?.id, user?.id],
    queryFn: async () => {
      if (!currentWorkspace?.id || !user?.id) return [];

      // Get cards where user is owner
      const { data: ownedCards, error: ownedError } = await supabase
        .from('cards')
        .select(`
          *,
          space:spaces(name),
          client:clients(name)
        `)
        .eq('workspace_id', currentWorkspace.id)
        .eq('owner_id', user.id)
        .neq('status', 'archived')
        .neq('status', 'delivered')
        .order('due_date', { ascending: true, nullsFirst: false });

      if (ownedError) throw ownedError;

      // Get cards where user is a member
      const { data: memberCards, error: memberError } = await supabase
        .from('card_members')
        .select(`
          card:cards(
            *,
            space:spaces(name),
            client:clients(name)
          )
        `)
        .eq('user_id', user.id);

      if (memberError) throw memberError;

      // Combine and deduplicate
      const memberCardsList = memberCards
        ?.map((m) => m.card)
        .filter((c): c is (CardType & { space: { name: string }; client: { name: string } | null }) => 
          c !== null && (c as any).status !== 'archived' && (c as any).status !== 'delivered'
        );

      const allCards = [...(ownedCards || [])];
      memberCardsList?.forEach((card) => {
        if (!allCards.find((c) => c.id === card.id)) {
          allCards.push(card);
        }
      });

      return allCards.sort((a, b) => {
        if (!a.due_date && !b.due_date) return 0;
        if (!a.due_date) return 1;
        if (!b.due_date) return -1;
        return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
      });
    },
    enabled: !!currentWorkspace?.id && !!user?.id,
  });

  // Filter cards based on search
  const filteredCards = useMemo(() => {
    if (!myCards) return [];
    if (!searchQuery) return myCards;

    const query = searchQuery.toLowerCase();
    return myCards.filter((card) =>
      card.title.toLowerCase().includes(query) ||
      card.description?.toLowerCase().includes(query)
    );
  }, [myCards, searchQuery]);

  // Categorize cards
  const categorizedCards = useMemo(() => {
    const overdue: typeof filteredCards = [];
    const today: typeof filteredCards = [];
    const tomorrow: typeof filteredCards = [];
    const thisWeek: typeof filteredCards = [];
    const later: typeof filteredCards = [];
    const noDueDate: typeof filteredCards = [];

    const weekEnd = addDays(new Date(), 7);

    filteredCards.forEach((card) => {
      if (!card.due_date) {
        noDueDate.push(card);
        return;
      }

      const dueDate = new Date(card.due_date);
      
      if (isPast(dueDate) && !isToday(dueDate)) {
        overdue.push(card);
      } else if (isToday(dueDate)) {
        today.push(card);
      } else if (isTomorrow(dueDate)) {
        tomorrow.push(card);
      } else if (isFuture(dueDate) && dueDate <= weekEnd) {
        thisWeek.push(card);
      } else {
        later.push(card);
      }
    });

    return { overdue, today, tomorrow, thisWeek, later, noDueDate };
  }, [filteredCards]);

  const totalTasks = myCards?.length || 0;
  const overdueTasks = categorizedCards.overdue.length;
  const todayTasks = categorizedCards.today.length;
  const inProgressTasks = myCards?.filter((c) => c.status === 'in_progress').length || 0;

  if (isLoading) {
    return (
      <AppLayout>
        <div className="p-6 space-y-6">
          <Skeleton className="h-8 w-48" />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24" />)}
          </div>
          <Skeleton className="h-96" />
        </div>
      </AppLayout>
    );
  }

  const renderCardItem = (card: typeof filteredCards[0]) => (
    <div
      key={card.id}
      onClick={() => setSelectedCardId(card.id)}
      className="flex items-center gap-4 p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors cursor-pointer group"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <p className="font-medium truncate">{card.title}</p>
          {(card.space as { name: string } | null)?.name && (
            <Badge variant="outline" className="text-xs shrink-0">
              {(card.space as { name: string }).name}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {card.due_date && (
            <span className={isPast(new Date(card.due_date)) && !isToday(new Date(card.due_date)) ? 'text-destructive' : ''}>
              <Calendar className="inline h-3 w-3 mr-1" />
              {format(new Date(card.due_date), "dd 'de' MMM", { locale: ptBR })}
            </span>
          )}
          {card.actual_hours && card.actual_hours > 0 && (
            <span>
              <Clock className="inline h-3 w-3 mr-1" />
              {card.actual_hours.toFixed(1)}h
            </span>
          )}
        </div>
      </div>
      <Badge className={STATUS_COLORS[card.status]}>
        {STATUS_LABELS[card.status]}
      </Badge>
      <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
    </div>
  );

  const renderSection = (title: string, cards: typeof filteredCards, icon: React.ReactNode, variant?: 'destructive' | 'warning') => {
    if (cards.length === 0) return null;

    return (
      <div className="space-y-2">
        <h3 className={`text-sm font-semibold flex items-center gap-2 ${
          variant === 'destructive' ? 'text-destructive' : 
          variant === 'warning' ? 'text-yellow-600 dark:text-yellow-400' : ''
        }`}>
          {icon}
          {title}
          <Badge variant="secondary">{cards.length}</Badge>
        </h3>
        <div className="space-y-2">
          {cards.map(renderCardItem)}
        </div>
      </div>
    );
  };

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <CheckSquare className="h-6 w-6" />
              Minhas Tarefas
            </h1>
            <p className="text-muted-foreground">
              Cards onde você é responsável ou membro
            </p>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar tarefas..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 w-full sm:w-64"
            />
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                Total
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{totalTasks}</p>
              <p className="text-xs text-muted-foreground">Tarefas ativas</p>
            </CardContent>
          </Card>

          <Card className={overdueTasks > 0 ? 'border-destructive/50' : ''}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                Atrasadas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className={`text-2xl font-bold ${overdueTasks > 0 ? 'text-destructive' : ''}`}>{overdueTasks}</p>
              <p className="text-xs text-muted-foreground">Precisam atenção</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Calendar className="h-4 w-4 text-yellow-500" />
                Hoje
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{todayTasks}</p>
              <p className="text-xs text-muted-foreground">Para entregar hoje</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Play className="h-4 w-4 text-primary" />
                Em Progresso
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{inProgressTasks}</p>
              <p className="text-xs text-muted-foreground">Em andamento</p>
            </CardContent>
          </Card>
        </div>

        {/* Tasks List */}
        <Card>
          <CardHeader>
            <CardTitle>Suas Tarefas</CardTitle>
            <CardDescription>
              Organizadas por prazo de entrega
            </CardDescription>
          </CardHeader>
          <CardContent>
            {filteredCards.length > 0 ? (
              <ScrollArea className="h-[500px] pr-4">
                <div className="space-y-6">
                  {renderSection(
                    'Atrasadas',
                    categorizedCards.overdue,
                    <AlertTriangle className="h-4 w-4" />,
                    'destructive'
                  )}
                  {renderSection(
                    'Para Hoje',
                    categorizedCards.today,
                    <Calendar className="h-4 w-4" />,
                    'warning'
                  )}
                  {renderSection(
                    'Para Amanhã',
                    categorizedCards.tomorrow,
                    <Calendar className="h-4 w-4" />
                  )}
                  {renderSection(
                    'Esta Semana',
                    categorizedCards.thisWeek,
                    <Calendar className="h-4 w-4" />
                  )}
                  {renderSection(
                    'Próximas',
                    categorizedCards.later,
                    <Calendar className="h-4 w-4" />
                  )}
                  {renderSection(
                    'Sem Prazo',
                    categorizedCards.noDueDate,
                    <FileText className="h-4 w-4" />
                  )}
                </div>
              </ScrollArea>
            ) : (
              <EmptyState
                icon={<CheckSquare className="h-8 w-8" />}
                title="Nenhuma tarefa encontrada"
                description={searchQuery 
                  ? "Nenhuma tarefa corresponde à sua busca." 
                  : "Você não tem tarefas ativas no momento."}
                tip="Tarefas aparecem aqui quando você é designado como responsável ou membro."
              />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Card Detail Sheet */}
      <CardDetailSheet
        cardId={selectedCardId || undefined}
        open={!!selectedCardId}
        onOpenChange={(open) => !open && setSelectedCardId(null)}
      />
    </AppLayout>
  );
};

export default TasksPage;
