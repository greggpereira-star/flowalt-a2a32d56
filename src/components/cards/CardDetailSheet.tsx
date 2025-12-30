import React, { useState, useEffect } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { StatusBadge, UrgencyBadge } from './CardBadges';
import { BriefingForm, type BriefingData } from './BriefingForm';
import { TrafficBriefingForm, type TrafficBriefingData } from './TrafficBriefingForm';
import { ChecklistPanel } from './ChecklistPanel';
import { TimeTrackingPanel } from './TimeTrackingPanel';
import { CommentsPanel } from './CommentsPanel';
import { AttachmentsPanel } from './AttachmentsPanel';
import {
  CalendarIcon,
  FileText,
  CheckSquare,
  Clock,
  Truck,
  Loader2,
  MessageSquare,
  Paperclip,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useCard, useUpdateCard, type Card } from '@/hooks/useCards';
import { useSpace } from '@/hooks/useSpaces';
import type { CardStatus, CardUrgency } from '@/lib/supabase';
import { toast } from 'sonner';

interface CardDetailSheetProps {
  cardId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const STATUS_OPTIONS: { value: CardStatus; label: string }[] = [
  { value: 'backlog', label: 'Backlog' },
  { value: 'briefing', label: 'Briefing' },
  { value: 'todo', label: 'A Fazer' },
  { value: 'in_progress', label: 'Em Progresso' },
  { value: 'review', label: 'Revisão' },
  { value: 'approved', label: 'Aprovado' },
  { value: 'delivered', label: 'Entregue' },
];

const URGENCY_OPTIONS: { value: CardUrgency; label: string }[] = [
  { value: 'low', label: 'Baixa' },
  { value: 'medium', label: 'Média' },
  { value: 'high', label: 'Alta' },
  { value: 'critical', label: 'Crítica' },
];

export const CardDetailSheet: React.FC<CardDetailSheetProps> = ({
  cardId,
  open,
  onOpenChange,
}) => {
  const { data: card, isLoading } = useCard(cardId || undefined);
  const { data: space } = useSpace(card?.space_id);
  const updateCard = useUpdateCard();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<CardStatus>('backlog');
  const [urgency, setUrgency] = useState<CardUrgency>('medium');
  const [dueDate, setDueDate] = useState<Date | undefined>();
  const [estimatedHours, setEstimatedHours] = useState('');
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

  // Sync state with card data
  useEffect(() => {
    if (card) {
      setTitle(card.title);
      setDescription(card.description || '');
      setStatus(card.status);
      setUrgency(card.urgency);
      setDueDate(card.due_date ? new Date(card.due_date) : undefined);
      setEstimatedHours(card.estimated_hours?.toString() || '');
      
      // Parse briefing data
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
      
      // Parse traffic briefing data
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
    
    // Business rule: Can't advance past briefing if not completed
    const briefingRequired = !card.briefing_completed;
    const advancingPastBriefing = 
      ['todo', 'in_progress', 'review', 'approved', 'delivered'].includes(newStatus) &&
      ['backlog', 'briefing'].includes(status);

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

  const isTrafficSpace = space?.type === 'traffic';

  if (!cardId) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl p-0 flex flex-col">
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : card ? (
          <>
            {/* Header */}
            <SheetHeader className="p-6 pb-4 border-b flex-shrink-0">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 space-y-1">
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    onBlur={() => title !== card.title && handleSave({ title })}
                    className="text-xl font-semibold border-none p-0 h-auto focus-visible:ring-0 focus-visible:ring-offset-0"
                  />
                  <div className="flex items-center gap-2 flex-wrap">
                    <StatusBadge status={status} />
                    <UrgencyBadge urgency={urgency} />
                    {!card.briefing_completed && (
                      <Badge variant="outline" className="text-warning border-warning">
                        Brief Pendente
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </SheetHeader>

            {/* Meta Controls */}
            <div className="px-6 py-4 border-b flex-shrink-0">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Status</Label>
                  <Select value={status} onValueChange={handleStatusChange}>
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Urgência</Label>
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
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Prazo</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          'h-9 w-full justify-start text-left font-normal',
                          !dueDate && 'text-muted-foreground'
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dueDate ? format(dueDate, 'dd/MM/yyyy') : 'Definir'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={dueDate}
                        onSelect={(date) => {
                          setDueDate(date);
                          handleSave({
                            due_date: date ? date.toISOString() : null,
                          });
                        }}
                        locale={ptBR}
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Horas Est.</Label>
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
                    className="h-9"
                  />
                </div>
              </div>
            </div>

            {/* Tabs Content */}
            <Tabs defaultValue="briefing" className="flex-1 flex flex-col min-h-0">
              <div className="border-b flex-shrink-0">
                <TabsList className="w-full justify-start h-auto p-0 bg-transparent rounded-none">
                  <TabsTrigger
                    value="briefing"
                    className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none"
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    Briefing
                  </TabsTrigger>
                  {isTrafficSpace && (
                    <TabsTrigger
                      value="traffic"
                      className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none"
                    >
                      <Truck className="h-4 w-4 mr-2" />
                      Tráfego
                    </TabsTrigger>
                  )}
                  <TabsTrigger
                    value="checklist"
                    className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none"
                  >
                    <CheckSquare className="h-4 w-4 mr-2" />
                    Checklist
                  </TabsTrigger>
                  <TabsTrigger
                    value="time"
                    className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none"
                  >
                    <Clock className="h-4 w-4 mr-2" />
                    Tempo
                  </TabsTrigger>
                  <TabsTrigger
                    value="comments"
                    className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none"
                  >
                    <MessageSquare className="h-4 w-4 mr-2" />
                    Comentários
                  </TabsTrigger>
                  <TabsTrigger
                    value="attachments"
                    className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none"
                  >
                    <Paperclip className="h-4 w-4 mr-2" />
                    Anexos
                  </TabsTrigger>
                </TabsList>
              </div>

              <ScrollArea className="flex-1">
                <TabsContent value="briefing" className="m-0 p-6">
                  {/* Description */}
                  <div className="mb-6">
                    <Label className="text-sm font-medium">Descrição</Label>
                    <Textarea
                      placeholder="Adicione uma descrição..."
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      onBlur={() =>
                        description !== card.description &&
                        handleSave({ description })
                      }
                      className="mt-2 min-h-[80px]"
                    />
                  </div>

                  <Separator className="my-6" />

                  <BriefingForm
                    data={briefingData}
                    onChange={setBriefingData}
                    isCompleted={card.briefing_completed}
                    onMarkComplete={handleMarkBriefingComplete}
                  />
                </TabsContent>

                {isTrafficSpace && (
                  <TabsContent value="traffic" className="m-0 p-6">
                    <TrafficBriefingForm
                      data={trafficBriefingData}
                      onChange={setTrafficBriefingData}
                    />
                  </TabsContent>
                )}

                <TabsContent value="checklist" className="m-0 p-6">
                  <ChecklistPanel cardId={card.id} />
                </TabsContent>

                <TabsContent value="time" className="m-0 p-6">
                  <TimeTrackingPanel cardId={card.id} />
                </TabsContent>

                <TabsContent value="comments" className="m-0 p-6">
                  <CommentsPanel cardId={card.id} />
                </TabsContent>

                <TabsContent value="attachments" className="m-0 p-6">
                  <AttachmentsPanel cardId={card.id} />
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
