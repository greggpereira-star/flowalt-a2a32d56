import React, { useState, useEffect } from 'react';
import {
  Sheet,
  SheetContent,
} from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { StatusBadge, UrgencyBadge } from './CardBadges';
import { BriefingForm, type BriefingData } from './BriefingForm';
import { TrafficBriefingForm, type TrafficBriefingData } from './TrafficBriefingForm';
import { ChecklistPanel } from './ChecklistPanel';
import { TimeTrackingPanel } from './TimeTrackingPanel';
import { CommentsPanel } from './CommentsPanel';
import { AttachmentsPanel } from './AttachmentsPanel';
import { CardExecutionAssistantWrapper } from './CardExecutionAssistantWrapper';
import { TagManagerWrapper } from './TagManagerWrapper';
import { NextBestAction } from './NextBestAction';
import { CardFinancialTab } from './CardFinancialTab';
import { CardInvitePanel } from './CardInvitePanel';
import {
  CalendarIcon,
  FileText,
  CheckSquare,
  Clock,
  Truck,
  Loader2,
  MessageSquare,
  Paperclip,
  Sparkles,
  Tags,
  ChevronRight,
  User,
  Target,
  AlertCircle,
  CheckCircle2,
  X,
  Play,
  Pause,
  DollarSign,
  UserPlus,
} from 'lucide-react';
import { format, formatDistanceToNow, isPast, isToday, isTomorrow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useCard, useUpdateCard, type Card } from '@/hooks/useCards';
import { useSpace } from '@/hooks/useSpaces';
import { useChecklists } from '@/hooks/useChecklists';
import { useComments } from '@/hooks/useComments';
import { useAttachments } from '@/hooks/useAttachments';
import { useRunningTimer, useStartTimer, useStopTimer } from '@/hooks/useTimeEntries';
import { useCardDependencies } from '@/hooks/useDependencies';
import type { CardStatus, CardUrgency } from '@/lib/supabase';
import { toast } from 'sonner';

interface CardDetailSheetProps {
  cardId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const STATUS_OPTIONS: { value: CardStatus; label: string; icon: React.ReactNode }[] = [
  { value: 'backlog', label: 'Backlog', icon: <div className="w-2 h-2 rounded-full bg-status-backlog" /> },
  { value: 'todo', label: 'A Fazer', icon: <div className="w-2 h-2 rounded-full bg-status-todo" /> },
  { value: 'in_progress', label: 'Em Progresso', icon: <div className="w-2 h-2 rounded-full bg-status-inProgress" /> },
  { value: 'review', label: 'Revisão', icon: <div className="w-2 h-2 rounded-full bg-status-review" /> },
  { value: 'approved', label: 'Aprovado', icon: <div className="w-2 h-2 rounded-full bg-status-approved" /> },
  { value: 'delivered', label: 'Entregue', icon: <div className="w-2 h-2 rounded-full bg-status-delivered" /> },
];

const URGENCY_OPTIONS: { value: CardUrgency; label: string; color: string }[] = [
  { value: 'low', label: 'Baixa', color: 'bg-urgency-low' },
  { value: 'medium', label: 'Média', color: 'bg-urgency-medium' },
  { value: 'high', label: 'Alta', color: 'bg-urgency-high' },
  { value: 'critical', label: 'Crítica', color: 'bg-urgency-critical' },
];

const getStatusIndex = (status: CardStatus): number => {
  const index = STATUS_OPTIONS.findIndex(s => s.value === status);
  return index >= 0 ? index : 0;
};

const getStatusProgress = (status: CardStatus): number => {
  const index = getStatusIndex(status);
  return ((index + 1) / STATUS_OPTIONS.length) * 100;
};

export const CardDetailSheet: React.FC<CardDetailSheetProps> = ({
  cardId,
  open,
  onOpenChange,
}) => {
  const { data: card, isLoading } = useCard(cardId || undefined);
  const { data: space } = useSpace(card?.space_id);
  const { data: checklists } = useChecklists(cardId || undefined);
  const { data: comments } = useComments(cardId || undefined);
  const { data: attachments } = useAttachments(cardId || undefined);
  const { data: runningTimer } = useRunningTimer(cardId || undefined);
  const { data: cardDependencies } = useCardDependencies(cardId || undefined);
  const startTimer = useStartTimer();
  const stopTimer = useStopTimer();
  const updateCard = useUpdateCard();

  // Calculate blocking cards
  const blockingCards = cardDependencies?.blocking
    ?.filter(dep => dep.blocking_card?.status !== 'delivered')
    ?.map(dep => ({ 
      id: dep.blocking_card?.id || '', 
      title: dep.blocking_card?.title || '' 
    }))
    .filter(c => c.id) || [];
  const isBlocked = blockingCards.length > 0;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<CardStatus>('backlog');
  const [urgency, setUrgency] = useState<CardUrgency>('medium');
  const [dueDate, setDueDate] = useState<Date | undefined>();
  const [estimatedHours, setEstimatedHours] = useState('');
  const [activeTab, setActiveTab] = useState('overview');
  const [briefingData, setBriefingData] = useState<BriefingData>({
    context: '',
    target_audience: '',
    deliverables: '',
    references: '',
    deadline_notes: '',
    special_instructions: '',
  });
  const [trafficBriefingData, setTrafficBriefingData] = useState<TrafficBriefingData>({
    objective: '',
    platform: '',
    campaign_type: '',
    budget: '',
    audience_description: '',
    audience_age_min: '',
    audience_age_max: '',
    audience_gender: '',
    audience_interests: '',
    audience_locations: '',
    start_date: '',
    end_date: '',
    kpis: '',
    landing_page: '',
    pixel_events: '',
    additional_notes: '',
  });

  // Computed values
  const checklistCompleted = checklists?.filter(c => c.is_completed).length || 0;
  const checklistTotal = checklists?.length || 0;
  const checklistProgress = checklistTotal > 0 ? (checklistCompleted / checklistTotal) * 100 : 0;
  const commentsCount = comments?.length || 0;
  const attachmentsCount = attachments?.length || 0;

  // Sync state with card data
  useEffect(() => {
    if (card) {
      setTitle(card.title);
      setDescription(card.description || '');
      setStatus(card.status);
      setUrgency(card.urgency);
      setDueDate(card.due_date ? new Date(card.due_date) : undefined);
      setEstimatedHours(card.estimated_hours?.toString() || '');

      if (card.briefing_data && typeof card.briefing_data === 'object') {
        setBriefingData({
          context: (card.briefing_data as Record<string, string>).context || '',
          target_audience: (card.briefing_data as Record<string, string>).target_audience || '',
          deliverables: (card.briefing_data as Record<string, string>).deliverables || '',
          references: (card.briefing_data as Record<string, string>).references || '',
          deadline_notes: (card.briefing_data as Record<string, string>).deadline_notes || '',
          special_instructions: (card.briefing_data as Record<string, string>).special_instructions || '',
        });
      }

      if (card.traffic_briefing_data && typeof card.traffic_briefing_data === 'object' && !Array.isArray(card.traffic_briefing_data)) {
        const tbd = card.traffic_briefing_data as Record<string, string>;
        setTrafficBriefingData({
          objective: tbd.objective || '',
          platform: tbd.platform || '',
          campaign_type: tbd.campaign_type || '',
          budget: tbd.budget || '',
          audience_description: tbd.audience_description || '',
          audience_age_min: tbd.audience_age_min || '',
          audience_age_max: tbd.audience_age_max || '',
          audience_gender: tbd.audience_gender || '',
          audience_interests: tbd.audience_interests || '',
          audience_locations: tbd.audience_locations || '',
          start_date: tbd.start_date || '',
          end_date: tbd.end_date || '',
          kpis: tbd.kpis || '',
          landing_page: tbd.landing_page || '',
          pixel_events: tbd.pixel_events || '',
          additional_notes: tbd.additional_notes || '',
        });
      }
    }
  }, [card]);

  const handleSave = async (updates: Partial<{
    title: string;
    description: string;
    status: CardStatus;
    urgency: CardUrgency;
    due_date: string | null;
    estimated_hours: number | null;
    briefing_completed: boolean;
  }>) => {
    if (!card) return;

    try {
      await updateCard.mutateAsync({
        id: card.id,
        ...updates,
      });
    } catch (error) {
      toast.error('Erro ao salvar alterações');
    }
  };

  const handleStatusChange = async (newStatus: CardStatus) => {
    if (!card) return;

    const briefingRequired = !card.briefing_completed;
    const advancingPastBriefing =
      ['in_progress', 'review', 'approved', 'delivered'].includes(newStatus) &&
      ['backlog', 'todo'].includes(status);

    if (briefingRequired && advancingPastBriefing) {
      toast.error('Complete o briefing antes de avançar o card');
      return;
    }

    setStatus(newStatus);
    await handleSave({ status: newStatus });
  };

  const handleMarkBriefingComplete = async () => {
    if (!card) return;
    await handleSave({ briefing_completed: true });
    toast.success('Briefing marcado como completo');
  };

  const handleToggleTimer = async () => {
    if (!card) return;

    if (runningTimer) {
      await stopTimer.mutateAsync({
        id: runningTimer.id,
        card_id: card.id,
      });
      toast.success('Timer pausado');
    } else {
      await startTimer.mutateAsync({
        card_id: card.id,
      });
      toast.success('Timer iniciado');
    }
  };

  // Handler for NextBestAction
  const handleNextAction = (actionId: string) => {
    switch (actionId) {
      case 'unblock':
        toast.info(`Dependência bloqueante: "${blockingCards[0]?.title}"`);
        break;
      case 'complete-briefing':
        setActiveTab('overview');
        toast.info('Complete o briefing abaixo');
        break;
      case 'set-deadline':
        setActiveTab('overview');
        toast.info('Defina um prazo para o card');
        break;
      case 'start-checklist':
        setActiveTab('checklist');
        break;
      case 'start-timer':
        handleToggleTimer();
        break;
      case 'start-work':
        handleStatusChange('in_progress');
        break;
    }
  };

  const getDueDateStatus = () => {
    if (!dueDate) return null;
    if (isPast(dueDate) && !isToday(dueDate)) return 'overdue';
    if (isToday(dueDate)) return 'today';
    if (isTomorrow(dueDate)) return 'tomorrow';
    return 'future';
  };

  const dueDateStatus = getDueDateStatus();
  const isTrafficSpace = space?.type === 'traffic';

  if (!cardId) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-3xl p-0 flex flex-col overflow-hidden">
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : card ? (
          <>
            {/* Compact Header */}
            <div className="flex-shrink-0 border-b bg-card">
              {/* Top bar with close & quick actions */}
              <div className="flex items-center justify-between pl-4 pr-12 py-3 border-b border-border/50">
                <div className="flex items-center gap-3 flex-wrap">
                  <StatusBadge status={status} />
                  <UrgencyBadge urgency={urgency} />
                  {!card.briefing_completed && (
                    <Badge variant="outline" className="text-warning border-warning text-xs">
                      <AlertCircle className="w-3 h-3 mr-1" />
                      Brief Pendente
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {/* Timer Quick Action */}
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant={runningTimer ? 'default' : 'outline'}
                          size="sm"
                          className={cn(
                            'h-8 gap-1.5',
                            runningTimer && 'bg-status-inProgress hover:bg-status-inProgress/90'
                          )}
                          onClick={handleToggleTimer}
                        >
                          {runningTimer ? (
                            <>
                              <Pause className="h-3.5 w-3.5" />
                              <span className="text-xs font-mono">
                                {formatDistanceToNow(new Date(runningTimer.started_at), { locale: ptBR })}
                              </span>
                            </>
                          ) : (
                            <>
                              <Play className="h-3.5 w-3.5" />
                              <span className="text-xs">Iniciar</span>
                            </>
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {runningTimer ? 'Pausar timer' : 'Iniciar timer'}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>

              {/* Title & Progress */}
              <div className="px-4 py-4">
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onBlur={() => title !== card.title && handleSave({ title })}
                  className="text-lg font-semibold border-none p-0 h-auto focus-visible:ring-0 focus-visible:ring-offset-0 bg-transparent"
                  placeholder="Título do card..."
                />

                {/* Visual Progress Bar */}
                <div className="mt-4 space-y-2">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Progresso do Workflow</span>
                    <span className="font-medium">{Math.round(getStatusProgress(status))}%</span>
                  </div>
                  <div className="relative">
                    <Progress value={getStatusProgress(status)} className="h-2" />
                    <div className="flex justify-between mt-1">
                      {STATUS_OPTIONS.map((opt, idx) => (
                        <TooltipProvider key={opt.value}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                onClick={() => handleStatusChange(opt.value)}
                                className={cn(
                                  'w-3 h-3 rounded-full border-2 transition-all hover:scale-125',
                                  getStatusIndex(status) >= idx
                                    ? 'bg-primary border-primary'
                                    : 'bg-muted border-muted-foreground/30'
                                )}
                              />
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="text-xs">
                              {opt.label}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Quick Stats */}
              <div className="px-4 pb-3 flex items-center gap-4 text-sm">
                {/* Due Date */}
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      className={cn(
                        'flex items-center gap-1.5 px-2 py-1 rounded-md transition-colors hover:bg-accent',
                        dueDateStatus === 'overdue' && 'text-destructive',
                        dueDateStatus === 'today' && 'text-warning',
                        !dueDate && 'text-muted-foreground'
                      )}
                    >
                      <CalendarIcon className="h-3.5 w-3.5" />
                      <span className="text-xs">
                        {dueDate
                          ? dueDateStatus === 'overdue'
                            ? `Atrasado (${format(dueDate, 'dd/MM')})`
                            : dueDateStatus === 'today'
                              ? 'Hoje'
                              : dueDateStatus === 'tomorrow'
                                ? 'Amanhã'
                                : format(dueDate, 'dd/MM')
                          : 'Sem prazo'}
                      </span>
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dueDate}
                      onSelect={(date) => {
                        setDueDate(date);
                        handleSave({ due_date: date ? date.toISOString() : null });
                      }}
                      locale={ptBR}
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>

                <Separator orientation="vertical" className="h-4" />

                {/* Checklist Progress */}
                <button
                  onClick={() => setActiveTab('checklist')}
                  className="flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-accent transition-colors"
                >
                  <CheckSquare className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs">
                    {checklistCompleted}/{checklistTotal}
                  </span>
                  {checklistTotal > 0 && (
                    <div className="w-12 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-success transition-all"
                        style={{ width: `${checklistProgress}%` }}
                      />
                    </div>
                  )}
                </button>

                <Separator orientation="vertical" className="h-4" />

                {/* Comments */}
                <button
                  onClick={() => setActiveTab('comments')}
                  className="flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-accent transition-colors"
                >
                  <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs">{commentsCount}</span>
                </button>

                {/* Attachments */}
                <button
                  onClick={() => setActiveTab('attachments')}
                  className="flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-accent transition-colors"
                >
                  <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs">{attachmentsCount}</span>
                </button>
              </div>

              {/* NextBestAction - positioned after Quick Stats */}
              {card && (
                <div className="px-4 pb-4">
                  <NextBestAction
                    card={card}
                    checklistProgress={{ completed: checklistCompleted, total: checklistTotal }}
                    isBlocked={isBlocked}
                    blockingCards={blockingCards}
                    onAction={handleNextAction}
                  />
                </div>
              )}
            </div>

            {/* Tabs Content */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
              <div className="border-b flex-shrink-0 px-2">
                <TabsList className="w-full h-9 bg-transparent p-0 justify-start">
                  <TooltipProvider delayDuration={300}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <TabsTrigger
                          value="overview"
                          className="flex-1 max-w-[100px] h-9 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent bg-transparent shadow-none text-xs gap-1.5"
                        >
                          <Target className="h-3.5 w-3.5" />
                          <span className="hidden sm:inline">Geral</span>
                        </TabsTrigger>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="text-xs">Visão Geral</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <TabsTrigger
                          value="assistant"
                          className="flex-1 max-w-[60px] h-9 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent bg-transparent shadow-none text-xs gap-1.5"
                        >
                          <Sparkles className="h-3.5 w-3.5" />
                          <span className="hidden sm:inline">IA</span>
                        </TabsTrigger>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="text-xs">Assistente IA</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <TabsTrigger
                          value="checklist"
                          className="flex-1 max-w-[90px] h-9 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent bg-transparent shadow-none text-xs gap-1.5"
                        >
                          <CheckSquare className="h-3.5 w-3.5" />
                          <span className="hidden sm:inline">Tarefas</span>
                          {checklistTotal > 0 && (
                            <span className="text-[10px] text-muted-foreground">{checklistCompleted}/{checklistTotal}</span>
                          )}
                        </TabsTrigger>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="text-xs">Checklist de Tarefas</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <TabsTrigger
                          value="time"
                          className="flex-1 max-w-[80px] h-9 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent bg-transparent shadow-none text-xs gap-1.5"
                        >
                          <Clock className="h-3.5 w-3.5" />
                          <span className="hidden sm:inline">Tempo</span>
                        </TabsTrigger>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="text-xs">Controle de Tempo</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <TabsTrigger
                          value="comments"
                          className="flex-1 max-w-[70px] h-9 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent bg-transparent shadow-none text-xs gap-1.5"
                        >
                          <MessageSquare className="h-3.5 w-3.5" />
                          <span className="hidden sm:inline">Chat</span>
                          {commentsCount > 0 && (
                            <span className="text-[10px] text-muted-foreground">{commentsCount}</span>
                          )}
                        </TabsTrigger>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="text-xs">Comentários</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <TabsTrigger
                          value="attachments"
                          className="flex-1 max-w-[80px] h-9 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent bg-transparent shadow-none text-xs gap-1.5"
                        >
                          <Paperclip className="h-3.5 w-3.5" />
                          <span className="hidden sm:inline">Arquivos</span>
                          {attachmentsCount > 0 && (
                            <span className="text-[10px] text-muted-foreground">{attachmentsCount}</span>
                          )}
                        </TabsTrigger>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="text-xs">Anexos</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <TabsTrigger
                          value="financial"
                          className="flex-1 max-w-[40px] h-9 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent bg-transparent shadow-none text-xs gap-1.5"
                        >
                          <DollarSign className="h-3.5 w-3.5" />
                        </TabsTrigger>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="text-xs">Financeiro</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <TabsTrigger
                          value="invites"
                          className="flex-1 max-w-[40px] h-9 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent bg-transparent shadow-none text-xs gap-1.5"
                        >
                          <UserPlus className="h-3.5 w-3.5" />
                        </TabsTrigger>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="text-xs">Convidar</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </TabsList>
              </div>

              <ScrollArea className="flex-1">
                {/* Overview Tab - New consolidated view */}
                <TabsContent value="overview" className="m-0 p-4 space-y-6">
                  {/* Quick Controls Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">Status</label>
                      <Select value={status} onValueChange={handleStatusChange}>
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {STATUS_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              <div className="flex items-center gap-2">
                                {opt.icon}
                                {opt.label}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">Urgência</label>
                      <Select
                        value={urgency}
                        onValueChange={(v: CardUrgency) => {
                          setUrgency(v);
                          handleSave({ urgency: v });
                        }}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {URGENCY_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              <div className="flex items-center gap-2">
                                <div className={cn('w-2 h-2 rounded-full', opt.color)} />
                                {opt.label}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">Prazo</label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              'h-9 w-full justify-start text-left font-normal',
                              !dueDate && 'text-muted-foreground'
                            )}
                          >
                            <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                            {dueDate ? format(dueDate, 'dd/MM/yy') : 'Definir'}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={dueDate}
                            onSelect={(date) => {
                              setDueDate(date);
                              handleSave({ due_date: date ? date.toISOString() : null });
                            }}
                            locale={ptBR}
                            className="pointer-events-auto"
                          />
                        </PopoverContent>
                      </Popover>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">Horas Est.</label>
                      <Input
                        type="number"
                        placeholder="0h"
                        value={estimatedHours}
                        onChange={(e) => setEstimatedHours(e.target.value)}
                        onBlur={() => {
                          const hours = parseFloat(estimatedHours) || null;
                          if (hours !== card.estimated_hours) {
                            handleSave({ estimated_hours: hours });
                          }
                        }}
                        className="h-9"
                      />
                    </div>
                  </div>

                  {/* Description */}
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                      <FileText className="h-3.5 w-3.5" />
                      Descrição
                    </label>
                    <Textarea
                      placeholder="Adicione uma descrição detalhada..."
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      onBlur={() => description !== card.description && handleSave({ description })}
                      className="min-h-[100px] resize-none"
                    />
                  </div>

                  {/* Briefing Section */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                        <FileText className="h-3.5 w-3.5" />
                        Briefing
                        {card.briefing_completed && (
                          <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                        )}
                      </label>
                      {!card.briefing_completed && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={handleMarkBriefingComplete}
                        >
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Marcar Completo
                        </Button>
                      )}
                    </div>
                    <div className="rounded-lg border bg-muted/30 p-4">
                      <BriefingForm
                        data={briefingData}
                        onChange={setBriefingData}
                        isCompleted={card.briefing_completed}
                        onMarkComplete={handleMarkBriefingComplete}
                      />
                    </div>
                  </div>

                  {/* Traffic Briefing (conditional) */}
                  {isTrafficSpace && (
                    <div className="space-y-3">
                      <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                        <Truck className="h-3.5 w-3.5" />
                        Briefing de Tráfego
                      </label>
                      <div className="rounded-lg border bg-muted/30 p-4">
                        <TrafficBriefingForm
                          data={trafficBriefingData}
                          onChange={setTrafficBriefingData}
                        />
                      </div>
                    </div>
                  )}

                  {/* Tags */}
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                      <Tags className="h-3.5 w-3.5" />
                      Tags
                    </label>
                    <TagManagerWrapper cardId={card.id} />
                  </div>
                </TabsContent>

                <TabsContent value="assistant" className="m-0 p-4">
                  <CardExecutionAssistantWrapper cardId={card.id} />
                </TabsContent>

                <TabsContent value="checklist" className="m-0 p-4">
                  <ChecklistPanel cardId={card.id} />
                </TabsContent>

                <TabsContent value="time" className="m-0 p-4">
                  <TimeTrackingPanel cardId={card.id} />
                </TabsContent>

                <TabsContent value="comments" className="m-0 p-4">
                  <CommentsPanel cardId={card.id} />
                </TabsContent>

                <TabsContent value="attachments" className="m-0 p-4">
                  <AttachmentsPanel cardId={card.id} />
                </TabsContent>

                <TabsContent value="financial" className="m-0">
                  <CardFinancialTab cardId={card.id} />
                </TabsContent>

                <TabsContent value="invites" className="m-0 p-4">
                  <CardInvitePanel cardId={card.id} />
                </TabsContent>
              </ScrollArea>
            </Tabs>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-muted-foreground">Card não encontrado</p>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};
