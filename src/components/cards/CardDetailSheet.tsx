import React, { useState, useEffect, useMemo } from 'react';
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
import { BriefingDialog } from './BriefingDialog';
import type { BriefingData } from './BriefingForm';
import { TrafficBriefingForm, type TrafficBriefingData } from './TrafficBriefingForm';
import { ChecklistPanel } from './ChecklistPanel';
import { TimeTrackingPanel } from './TimeTrackingPanel';
import { CommentsPanel } from './CommentsPanel';
import { AttachmentsPanel } from './AttachmentsPanel';
import { CardExecutionAssistantWrapper } from './CardExecutionAssistantWrapper';
import { TagManagerWrapper } from './TagManagerWrapper';
import { NextBestAction } from './NextBestAction';
import { CardFinancialTab } from './CardFinancialTab';
import { CardKitTab } from './CardKitTab';
import { CardInvitePanel } from './CardInvitePanel';
import { SocialMediaCardFields } from '@/components/social-media/SocialMediaCardFields';
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
  Package,
  Building2,
  BanknoteIcon,
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
import { useClients } from '@/hooks/useClients';
import { useClientCards } from '@/hooks/useClientCards';
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
  const { data: legacyClients } = useClients();
  const { data: clientCards } = useClientCards();
  const startTimer = useStartTimer();
  const stopTimer = useStopTimer();
  const updateCard = useUpdateCard();

  // Build combined clients list
  const allClients = useMemo(() => {
    const clients: Array<{ id: string; name: string; color: string | null }> = [];
    
    legacyClients?.forEach(c => {
      clients.push({ id: c.id, name: c.name, color: c.color });
    });
    
    clientCards?.forEach(c => {
      // Avoid duplicates if legacy_client_id links exist
      if (!clients.some(existing => existing.id === c.id)) {
        clients.push({ id: c.id, name: c.name, color: c.color || null });
      }
    });
    
    return clients.sort((a, b) => a.name.localeCompare(b.name));
  }, [legacyClients, clientCards]);

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
  const [clientId, setClientId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [briefingDialogOpen, setBriefingDialogOpen] = useState(false);
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
      setClientId(card.client_id);

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
    briefing_data: BriefingData;
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

  // Handler for briefing data changes with auto-save
  const handleBriefingDataChange = (newData: BriefingData) => {
    setBriefingData(newData);
    // Debounced save
    handleSave({ briefing_data: newData });
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
        setBriefingDialogOpen(true);
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
  const isSocialMediaSpace = space?.type === 'social_media';

  if (!cardId) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl p-0 flex flex-col overflow-hidden bg-background">
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : card ? (
          <>
            {/* Header Section */}
            <div className="flex-shrink-0 bg-card">
              {/* Top Status Bar */}
              <div className="flex items-center justify-between px-5 pr-14 py-3 border-b">
                <div className="flex items-center gap-2">
                  <StatusBadge status={status} />
                  <UrgencyBadge urgency={urgency} />
                  {!card.briefing_completed && (
                    <Badge variant="outline" className="text-warning border-warning/50 text-[10px] h-5">
                      <AlertCircle className="w-3 h-3 mr-1" />
                      Brief
                    </Badge>
                  )}
                </div>
                
                {/* Timer Button */}
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant={runningTimer ? 'default' : 'outline'}
                        size="sm"
                        className={cn(
                          'h-7 gap-1.5 text-xs',
                          runningTimer && 'bg-primary hover:bg-primary/90'
                        )}
                        onClick={handleToggleTimer}
                      >
                        {runningTimer ? (
                          <>
                            <Pause className="h-3 w-3" />
                            <span className="font-mono text-[10px]">
                              {formatDistanceToNow(new Date(runningTimer.started_at), { locale: ptBR })}
                            </span>
                          </>
                        ) : (
                          <>
                            <Play className="h-3 w-3" />
                            Iniciar
                          </>
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="left" className="text-xs">
                      {runningTimer ? 'Pausar timer' : 'Iniciar timer'}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>

              {/* Title Section */}
              <div className="px-5 py-4 space-y-4">
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onBlur={() => title !== card.title && handleSave({ title })}
                  className="text-xl font-semibold border-none p-0 h-auto focus-visible:ring-0 focus-visible:ring-offset-0 bg-transparent leading-tight"
                  placeholder="Título do card..."
                />

                {/* Progress Workflow */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Progresso</span>
                    <span className="text-xs font-semibold text-primary">{Math.round(getStatusProgress(status))}%</span>
                  </div>
                  <div className="relative">
                    <Progress value={getStatusProgress(status)} className="h-1.5" />
                    <div className="flex justify-between mt-2">
                      {STATUS_OPTIONS.map((opt, idx) => (
                        <TooltipProvider key={opt.value}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                onClick={() => handleStatusChange(opt.value)}
                                className={cn(
                                  'w-2.5 h-2.5 rounded-full border-2 transition-all hover:scale-150',
                                  getStatusIndex(status) >= idx
                                    ? 'bg-primary border-primary'
                                    : 'bg-muted border-muted-foreground/20'
                                )}
                              />
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="text-xs py-1 px-2">
                              {opt.label}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Quick Stats Bar */}
              <div className="px-5 pb-4">
                <div className="flex items-center gap-1 p-1.5 bg-muted/50 rounded-lg">
                  {/* Due Date */}
                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        className={cn(
                          'flex items-center gap-1.5 px-2.5 py-1.5 rounded-md transition-colors hover:bg-background text-xs',
                          dueDateStatus === 'overdue' && 'text-destructive bg-destructive/10',
                          dueDateStatus === 'today' && 'text-warning bg-warning/10',
                          !dueDate && 'text-muted-foreground'
                        )}
                      >
                        <CalendarIcon className="h-3.5 w-3.5" />
                        <span className="font-medium">
                          {dueDate
                            ? dueDateStatus === 'overdue'
                              ? `Atrasado`
                              : dueDateStatus === 'today'
                                ? 'Hoje'
                                : dueDateStatus === 'tomorrow'
                                  ? 'Amanhã'
                                  : format(dueDate, 'dd/MM')
                            : 'Prazo'}
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

                  <div className="w-px h-4 bg-border" />

                  {/* Checklist */}
                  <button
                    onClick={() => setActiveTab('checklist')}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md hover:bg-background transition-colors text-xs"
                  >
                    <CheckSquare className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="font-medium">{checklistCompleted}/{checklistTotal}</span>
                    {checklistTotal > 0 && (
                      <div className="w-10 h-1 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-success transition-all"
                          style={{ width: `${checklistProgress}%` }}
                        />
                      </div>
                    )}
                  </button>

                  <div className="w-px h-4 bg-border" />

                  {/* Comments */}
                  <button
                    onClick={() => setActiveTab('comments')}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md hover:bg-background transition-colors text-xs"
                  >
                    <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="font-medium">{commentsCount}</span>
                  </button>

                  <div className="w-px h-4 bg-border" />

                  {/* Attachments */}
                  <button
                    onClick={() => setActiveTab('attachments')}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md hover:bg-background transition-colors text-xs"
                  >
                    <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="font-medium">{attachmentsCount}</span>
                  </button>
                </div>
              </div>

              {/* Next Best Action */}
              {card && (
                <div className="px-5 pb-4">
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
              <div className="flex-shrink-0 px-3 py-2 border-b bg-gradient-to-b from-muted/40 to-muted/20">
                {/* Primary Actions Row */}
                <TabsList className="w-full h-auto bg-transparent p-0 grid grid-cols-5 gap-1.5">
                  <TabsTrigger
                    value="overview"
                    className="group flex flex-col items-center justify-center gap-0.5 h-14 rounded-xl bg-background/60 backdrop-blur-sm border border-border/50 shadow-sm
                      data-[state=active]:bg-primary/10 data-[state=active]:border-primary/40 data-[state=active]:shadow-md data-[state=active]:shadow-primary/10
                      hover:bg-background/80 hover:border-border hover:shadow-md hover:-translate-y-0.5
                      transition-all duration-200 ease-out"
                  >
                    <div className="p-1 rounded-lg bg-muted/50 group-data-[state=active]:bg-primary/20 transition-colors">
                      <Target className="h-4 w-4 group-data-[state=active]:text-primary" />
                    </div>
                    <span className="text-[11px] font-medium group-data-[state=active]:text-primary">Geral</span>
                  </TabsTrigger>
                  <TabsTrigger
                    value="assistant"
                    className="group flex flex-col items-center justify-center gap-0.5 h-14 rounded-xl bg-background/60 backdrop-blur-sm border border-border/50 shadow-sm
                      data-[state=active]:bg-primary/10 data-[state=active]:border-primary/40 data-[state=active]:shadow-md data-[state=active]:shadow-primary/10
                      hover:bg-background/80 hover:border-border hover:shadow-md hover:-translate-y-0.5
                      transition-all duration-200 ease-out"
                  >
                    <div className="p-1 rounded-lg bg-muted/50 group-data-[state=active]:bg-primary/20 transition-colors">
                      <Sparkles className="h-4 w-4 group-data-[state=active]:text-primary" />
                    </div>
                    <span className="text-[11px] font-medium group-data-[state=active]:text-primary">IA</span>
                  </TabsTrigger>
                  <TabsTrigger
                    value="checklist"
                    className="group flex flex-col items-center justify-center gap-0.5 h-14 rounded-xl bg-background/60 backdrop-blur-sm border border-border/50 shadow-sm relative
                      data-[state=active]:bg-primary/10 data-[state=active]:border-primary/40 data-[state=active]:shadow-md data-[state=active]:shadow-primary/10
                      hover:bg-background/80 hover:border-border hover:shadow-md hover:-translate-y-0.5
                      transition-all duration-200 ease-out"
                  >
                    <div className="p-1 rounded-lg bg-muted/50 group-data-[state=active]:bg-primary/20 transition-colors">
                      <CheckSquare className="h-4 w-4 group-data-[state=active]:text-primary" />
                    </div>
                    <span className="text-[11px] font-medium group-data-[state=active]:text-primary">Tarefas</span>
                    {checklistTotal > 0 && (
                      <Badge variant="secondary" className="absolute -top-1.5 -right-1.5 h-5 min-w-5 text-[10px] px-1.5 shadow-sm border border-border/50">
                        {checklistCompleted}/{checklistTotal}
                      </Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger
                    value="time"
                    className="group flex flex-col items-center justify-center gap-0.5 h-14 rounded-xl bg-background/60 backdrop-blur-sm border border-border/50 shadow-sm
                      data-[state=active]:bg-primary/10 data-[state=active]:border-primary/40 data-[state=active]:shadow-md data-[state=active]:shadow-primary/10
                      hover:bg-background/80 hover:border-border hover:shadow-md hover:-translate-y-0.5
                      transition-all duration-200 ease-out"
                  >
                    <div className="p-1 rounded-lg bg-muted/50 group-data-[state=active]:bg-primary/20 transition-colors">
                      <Clock className="h-4 w-4 group-data-[state=active]:text-primary" />
                    </div>
                    <span className="text-[11px] font-medium group-data-[state=active]:text-primary">Tempo</span>
                  </TabsTrigger>
                  <TabsTrigger
                    value="comments"
                    className="group flex flex-col items-center justify-center gap-0.5 h-14 rounded-xl bg-background/60 backdrop-blur-sm border border-border/50 shadow-sm relative
                      data-[state=active]:bg-primary/10 data-[state=active]:border-primary/40 data-[state=active]:shadow-md data-[state=active]:shadow-primary/10
                      hover:bg-background/80 hover:border-border hover:shadow-md hover:-translate-y-0.5
                      transition-all duration-200 ease-out"
                  >
                    <div className="p-1 rounded-lg bg-muted/50 group-data-[state=active]:bg-primary/20 transition-colors">
                      <MessageSquare className="h-4 w-4 group-data-[state=active]:text-primary" />
                    </div>
                    <span className="text-[11px] font-medium group-data-[state=active]:text-primary">Chat</span>
                    {commentsCount > 0 && (
                      <Badge variant="secondary" className="absolute -top-1.5 -right-1.5 h-5 min-w-5 text-[10px] px-1.5 shadow-sm border border-border/50">
                        {commentsCount}
                      </Badge>
                    )}
                  </TabsTrigger>
                </TabsList>
                
                {/* Divider */}
                <div className="flex items-center gap-2 my-2">
                  <div className="flex-1 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
                  <span className="text-[9px] uppercase tracking-widest text-muted-foreground/60 font-medium">Recursos</span>
                  <div className="flex-1 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
                </div>
                
                {/* Secondary Actions Row */}
                <TabsList className="w-full h-auto bg-transparent p-0 grid grid-cols-4 gap-1.5">
                  <TabsTrigger
                    value="attachments"
                    className="group flex flex-col items-center justify-center gap-0.5 h-14 rounded-xl bg-background/60 backdrop-blur-sm border border-border/50 shadow-sm relative
                      data-[state=active]:bg-primary/10 data-[state=active]:border-primary/40 data-[state=active]:shadow-md data-[state=active]:shadow-primary/10
                      hover:bg-background/80 hover:border-border hover:shadow-md hover:-translate-y-0.5
                      transition-all duration-200 ease-out"
                  >
                    <div className="p-1 rounded-lg bg-muted/50 group-data-[state=active]:bg-primary/20 transition-colors">
                      <Paperclip className="h-4 w-4 group-data-[state=active]:text-primary" />
                    </div>
                    <span className="text-[11px] font-medium group-data-[state=active]:text-primary">Arquivos</span>
                    {attachmentsCount > 0 && (
                      <Badge variant="secondary" className="absolute -top-1.5 -right-1.5 h-5 min-w-5 text-[10px] px-1.5 shadow-sm border border-border/50">
                        {attachmentsCount}
                      </Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger
                    value="financial"
                    className="group flex flex-col items-center justify-center gap-0.5 h-14 rounded-xl bg-background/60 backdrop-blur-sm border border-border/50 shadow-sm
                      data-[state=active]:bg-primary/10 data-[state=active]:border-primary/40 data-[state=active]:shadow-md data-[state=active]:shadow-primary/10
                      hover:bg-background/80 hover:border-border hover:shadow-md hover:-translate-y-0.5
                      transition-all duration-200 ease-out"
                  >
                    <div className="p-1 rounded-lg bg-muted/50 group-data-[state=active]:bg-primary/20 transition-colors">
                      <DollarSign className="h-4 w-4 group-data-[state=active]:text-primary" />
                    </div>
                    <span className="text-[11px] font-medium group-data-[state=active]:text-primary">Financeiro</span>
                  </TabsTrigger>
                  <TabsTrigger
                    value="kit"
                    className="group flex flex-col items-center justify-center gap-0.5 h-14 rounded-xl bg-background/60 backdrop-blur-sm border border-border/50 shadow-sm
                      data-[state=active]:bg-primary/10 data-[state=active]:border-primary/40 data-[state=active]:shadow-md data-[state=active]:shadow-primary/10
                      hover:bg-background/80 hover:border-border hover:shadow-md hover:-translate-y-0.5
                      transition-all duration-200 ease-out"
                  >
                    <div className="p-1 rounded-lg bg-muted/50 group-data-[state=active]:bg-primary/20 transition-colors">
                      <Package className="h-4 w-4 group-data-[state=active]:text-primary" />
                    </div>
                    <span className="text-[11px] font-medium group-data-[state=active]:text-primary">Kit</span>
                  </TabsTrigger>
                  <TabsTrigger
                    value="invites"
                    className="group flex flex-col items-center justify-center gap-0.5 h-14 rounded-xl bg-background/60 backdrop-blur-sm border border-border/50 shadow-sm
                      data-[state=active]:bg-primary/10 data-[state=active]:border-primary/40 data-[state=active]:shadow-md data-[state=active]:shadow-primary/10
                      hover:bg-background/80 hover:border-border hover:shadow-md hover:-translate-y-0.5
                      transition-all duration-200 ease-out"
                  >
                    <div className="p-1 rounded-lg bg-muted/50 group-data-[state=active]:bg-primary/20 transition-colors">
                      <UserPlus className="h-4 w-4 group-data-[state=active]:text-primary" />
                    </div>
                    <span className="text-[11px] font-medium group-data-[state=active]:text-primary">Convidar</span>
                  </TabsTrigger>
                </TabsList>
              </div>

              <ScrollArea className="flex-1">
                {/* Overview Tab */}
                <TabsContent value="overview" className="m-0 p-5 space-y-6">
                  
                  {/* Quick Controls Grid - Now first */}
                  <div className="space-y-3">
                    <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                      Configurações
                    </label>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-xs text-muted-foreground">Status</label>
                        <Select value={status} onValueChange={handleStatusChange}>
                          <SelectTrigger className="h-10">
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

                      <div className="space-y-2">
                        <label className="text-xs text-muted-foreground">Urgência</label>
                        <Select
                          value={urgency}
                          onValueChange={(v: CardUrgency) => {
                            setUrgency(v);
                            handleSave({ urgency: v });
                          }}
                        >
                          <SelectTrigger className="h-10">
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

                      <div className="space-y-2">
                        <label className="text-xs text-muted-foreground">Prazo</label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className={cn(
                                'h-10 w-full justify-start text-left font-normal',
                                !dueDate && 'text-muted-foreground'
                              )}
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {dueDate ? format(dueDate, 'dd/MM/yyyy') : 'Definir prazo'}
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

                      <div className="space-y-2">
                        <label className="text-xs text-muted-foreground">Horas Estimadas</label>
                        <Input
                          type="number"
                          placeholder="0"
                          value={estimatedHours}
                          onChange={(e) => setEstimatedHours(e.target.value)}
                          onBlur={() => {
                            const hours = parseFloat(estimatedHours) || null;
                            if (hours !== card.estimated_hours) {
                              handleSave({ estimated_hours: hours });
                            }
                          }}
                          className="h-10"
                        />
                      </div>
                    </div>

                    {/* Client Selector - spans full width */}
                    <div className="col-span-2 space-y-2">
                      <label className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <Building2 className="h-3 w-3" />
                        Cliente
                        {!clientId && (
                          <Badge variant="outline" className="text-[9px] h-4 text-muted-foreground">
                            <BanknoteIcon className="h-2.5 w-2.5 mr-0.5" />
                            Não faturável
                          </Badge>
                        )}
                      </label>
                      <Select
                        value={clientId || '__none__'}
                        onValueChange={(v) => {
                          const newClientId = v === '__none__' ? null : v;
                          setClientId(newClientId);
                          updateCard.mutate({ id: card.id, client_id: newClientId });
                        }}
                      >
                        <SelectTrigger className="h-10">
                          <SelectValue placeholder="Selecionar cliente..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <BanknoteIcon className="h-3 w-3" />
                              Sem cliente (Não faturável)
                            </div>
                          </SelectItem>
                          {allClients.map((client) => (
                            <SelectItem key={client.id} value={client.id}>
                              <div className="flex items-center gap-2">
                                {client.color && (
                                  <div 
                                    className="w-2 h-2 rounded-full" 
                                    style={{ backgroundColor: client.color }}
                                  />
                                )}
                                {!client.color && <Building2 className="h-3 w-3 text-muted-foreground" />}
                                {client.name}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <Separator />

                  {/* Description - moved here after settings */}
                  <div className="space-y-3">
                    <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                      <FileText className="h-3.5 w-3.5" />
                      Descrição
                    </label>
                    <Textarea
                      placeholder="Adicione uma descrição detalhada para este card..."
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      onBlur={() => description !== card.description && handleSave({ description })}
                      className="min-h-[120px] resize-none text-sm leading-relaxed"
                    />
                  </div>

                  {/* Social Media Custom Fields */}
                  {isSocialMediaSpace && cardId && (
                    <>
                      <Separator />
                      <SocialMediaCardFields cardId={cardId} spaceType="social_media" />
                    </>
                  )}

                  <Separator />

                  {/* Briefing Section - Compact Card */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <div className={cn(
                        "p-1.5 rounded-lg",
                        card.briefing_completed 
                          ? "bg-success/10 text-success" 
                          : "bg-warning/10 text-warning"
                      )}>
                        <FileText className="h-4 w-4" />
                      </div>
                      <div className="flex-1">
                        <label className="text-sm font-semibold flex items-center gap-1.5">
                          Briefing do Projeto
                          {card.briefing_completed && (
                            <Badge variant="secondary" className="text-[10px] h-5 bg-success/10 text-success border-success/20">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Validado
                            </Badge>
                          )}
                        </label>
                        <p className="text-[11px] text-muted-foreground">
                          {card.briefing_completed 
                            ? "Briefing aprovado pela IA" 
                            : "Preencha informações para liberar o card"
                          }
                        </p>
                      </div>
                    </div>
                    
                    {/* Briefing Preview Card */}
                    <button
                      onClick={() => setBriefingDialogOpen(true)}
                      className={cn(
                        "w-full rounded-xl border-2 p-4 transition-all hover:shadow-md text-left group",
                        card.briefing_completed 
                          ? "border-success/20 bg-success/5 hover:border-success/40" 
                          : "border-warning/30 bg-warning/5 hover:border-warning/50"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {card.briefing_completed ? (
                            <CheckCircle2 className="h-5 w-5 text-success" />
                          ) : (
                            <AlertCircle className="h-5 w-5 text-warning" />
                          )}
                          <div>
                            <p className={cn(
                              "font-medium text-sm",
                              card.briefing_completed ? "text-success" : "text-warning"
                            )}>
                              {card.briefing_completed ? "Briefing Completo" : "Completar Briefing"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {card.briefing_completed 
                                ? "Clique para visualizar ou editar"
                                : "6 campos • 2 obrigatórios"
                              }
                            </p>
                          </div>
                        </div>
                        <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
                      </div>
                      
                      {/* Quick preview of filled fields */}
                      {(briefingData.context || briefingData.deliverables) && (
                        <div className="mt-3 pt-3 border-t border-border/50 flex gap-2 flex-wrap">
                          {briefingData.context && (
                            <Badge variant="outline" className="text-[10px] h-5 gap-1">
                              <FileText className="h-2.5 w-2.5" />
                              Contexto
                            </Badge>
                          )}
                          {briefingData.target_audience && (
                            <Badge variant="outline" className="text-[10px] h-5 gap-1">
                              <User className="h-2.5 w-2.5" />
                              Público
                            </Badge>
                          )}
                          {briefingData.deliverables && (
                            <Badge variant="outline" className="text-[10px] h-5 gap-1">
                              <Target className="h-2.5 w-2.5" />
                              Entregáveis
                            </Badge>
                          )}
                        </div>
                      )}
                    </button>
                  </div>

                  {/* Briefing Dialog */}
                  <BriefingDialog
                    open={briefingDialogOpen}
                    onOpenChange={setBriefingDialogOpen}
                    data={briefingData}
                    onChange={handleBriefingDataChange}
                    isCompleted={card.briefing_completed || false}
                    onMarkComplete={handleMarkBriefingComplete}
                    cardTitle={card.title}
                  />

                  {/* Traffic Briefing (conditional) */}
                  {isTrafficSpace && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
                          <Truck className="h-4 w-4" />
                        </div>
                        <div>
                          <label className="text-sm font-semibold">Briefing de Tráfego</label>
                          <p className="text-[11px] text-muted-foreground">
                            Configurações específicas de mídia paga
                          </p>
                        </div>
                      </div>
                      <div className="rounded-xl border-2 border-primary/20 bg-primary/5 p-4">
                        <TrafficBriefingForm
                          data={trafficBriefingData}
                          onChange={setTrafficBriefingData}
                        />
                      </div>
                    </div>
                  )}

                  <Separator />

                  {/* Tags */}
                  <div className="space-y-3">
                    <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                      <Tags className="h-3.5 w-3.5" />
                      Tags
                    </label>
                    <TagManagerWrapper cardId={card.id} />
                  </div>
                </TabsContent>

                <TabsContent value="assistant" className="m-0 p-5">
                  <CardExecutionAssistantWrapper cardId={card.id} />
                </TabsContent>

                <TabsContent value="checklist" className="m-0 p-5">
                  <ChecklistPanel cardId={card.id} />
                </TabsContent>

                <TabsContent value="time" className="m-0 p-5">
                  <TimeTrackingPanel cardId={card.id} />
                </TabsContent>

                <TabsContent value="comments" className="m-0 p-5">
                  <CommentsPanel cardId={card.id} />
                </TabsContent>

                <TabsContent value="attachments" className="m-0 p-5">
                  <AttachmentsPanel cardId={card.id} />
                </TabsContent>

                <TabsContent value="financial" className="m-0 p-5">
                  <CardFinancialTab cardId={card.id} />
                </TabsContent>

                <TabsContent value="invites" className="m-0 p-5">
                  <CardInvitePanel cardId={card.id} />
                </TabsContent>

                <TabsContent value="kit" className="m-0">
                  <CardKitTab cardId={card.id} />
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
