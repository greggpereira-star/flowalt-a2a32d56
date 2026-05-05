import React, { useState, useMemo, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  Calendar as CalendarIcon,
  Plus,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Video,
  Users,
  Flag,
  Clock,
  MapPin,
  Link2,
  Loader2,
  Cake,
  AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useEvents,
  useCreateEvent,
  useUpdateEvent,
  useDeleteEvent,
  useEventParticipants,
  useAddParticipant,
  useRemoveParticipant,
  type Event,
  type EventType,
} from '@/hooks/useEvents';
import { useCards } from '@/hooks/useCards';
import { useSpaces } from '@/hooks/useSpaces';
import { useWorkspaceMembers } from '@/hooks/useWorkspaceMembers';
import { useNotices } from '@/hooks/useNoticesModule';
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  startOfWeek,
  endOfWeek,
  isToday,
  parseISO,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

const EVENT_TYPE_CONFIG: Record<EventType, { label: string; icon: React.ElementType; color: string }> = {
  meeting: { label: 'Reunião', icon: Users, color: 'bg-blue-500' },
  recording: { label: 'Gravação', icon: Video, color: 'bg-red-500' },
  milestone: { label: 'Marco', icon: Flag, color: 'bg-green-500' },
  deadline: { label: 'Prazo', icon: Clock, color: 'bg-orange-500' },
  other: { label: 'Outro', icon: CalendarIcon, color: 'bg-gray-500' },
};

interface CalendarViewProps {
  onEventClick?: (event: Event) => void;
}

export const CalendarView: React.FC<CalendarViewProps> = ({ onEventClick }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [isParticipantsLoading, setIsParticipantsLoading] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart, { locale: ptBR });
  const calendarEnd = endOfWeek(monthEnd, { locale: ptBR });

  const { data: events, isLoading } = useEvents(calendarStart, calendarEnd);
  const { data: spaces } = useSpaces();
  const { data: members, isLoading: isMembersLoading } = useWorkspaceMembers();
  const { birthdayNotices } = useNotices();

  useEffect(() => {
    if (dialogOpen) {
      // Small timeout to ensure the modal is mounted before focusing
      const timer = setTimeout(() => {
        titleInputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [dialogOpen]);
  const createEvent = useCreateEvent();
  const updateEvent = useUpdateEvent();
  const deleteEvent = useDeleteEvent();
  const addParticipant = useAddParticipant();
  const removeParticipant = useRemoveParticipant();

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    event_type: 'meeting' as EventType,
    start_date: '',
    start_time: '09:00',
    end_date: '',
    end_time: '10:00',
    all_day: false,
    location: '',
    space_id: '',
    participant_ids: [] as string[],
  });

  const calendarDays = useMemo(() => {
    return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  }, [calendarStart, calendarEnd]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, (Event | { id: string; title: string; isBirthday: true })[]>();
    events?.forEach(event => {
      const dateKey = format(parseISO(event.start_time), 'yyyy-MM-dd');
      const existing = map.get(dateKey) || [];
      map.set(dateKey, [...existing, event]);
    });
    // Add birthday notices to calendar
    birthdayNotices.forEach(notice => {
      const dateKey = format(parseISO(notice.starts_at), 'yyyy-MM-dd');
      const existing = map.get(dateKey) || [];
      map.set(dateKey, [...existing, { id: notice.id, title: notice.title, isBirthday: true }]);
    });
    return map;
  }, [events, birthdayNotices]);

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      event_type: 'meeting',
      start_date: '',
      start_time: '09:00',
      end_date: '',
      end_time: '10:00',
      all_day: false,
      location: '',
      space_id: '',
      participant_ids: [],
    });
    setEditingEvent(null);
  };

  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
    const dateStr = format(date, 'yyyy-MM-dd');
    setFormData(f => ({
      ...f,
      start_date: dateStr,
      end_date: dateStr,
    }));
    setDialogOpen(true);
  };

  const handleEventClick = async (event: Event, e: React.MouseEvent) => {
    e.preventDefault();
    setEditingEvent(event);
    setIsParticipantsLoading(true);
    setDialogOpen(true);
    
    const startDate = parseISO(event.start_time);
    const endDate = parseISO(event.end_time);
    
    try {
      const { data: existingParticipants } = await supabase
        .from('event_participants')
        .select('user_id')
        .eq('event_id', event.id);
      
      const participantIds = existingParticipants?.map(p => p.user_id) || [];
      
      setFormData({
        title: event.title,
        description: event.description || '',
        event_type: event.event_type,
        start_date: format(startDate, 'yyyy-MM-dd'),
        start_time: format(startDate, 'HH:mm'),
        end_date: format(endDate, 'yyyy-MM-dd'),
        end_time: format(endDate, 'HH:mm'),
        all_day: event.all_day,
        location: event.location || '',
        space_id: event.space_id || '',
        participant_ids: participantIds,
      });
    } finally {
      setIsParticipantsLoading(false);
    }
    onEventClick?.(event);
  };

  const handleSubmit = async () => {
    if (!formData.title || !formData.start_date) {
      toast.error('Preencha os campos obrigatórios');
      return;
    }

    const startTime = formData.all_day
      ? new Date(`${formData.start_date}T00:00:00`).toISOString()
      : new Date(`${formData.start_date}T${formData.start_time}:00`).toISOString();

    const endTime = formData.all_day
      ? new Date(`${formData.end_date || formData.start_date}T23:59:59`).toISOString()
      : new Date(`${formData.end_date || formData.start_date}T${formData.end_time}:00`).toISOString();

    try {
      if (editingEvent) {
        await updateEvent.mutateAsync({
          id: editingEvent.id,
          title: formData.title,
          description: formData.description || null,
          event_type: formData.event_type,
          start_time: startTime,
          end_time: endTime,
          all_day: formData.all_day,
          location: formData.location || null,
          space_id: formData.space_id || null,
        });
        
        // Sync participants - get current, find diff, add/remove
        const { data: currentParticipants } = await supabase
          .from('event_participants')
          .select('user_id')
          .eq('event_id', editingEvent.id);
        
        const currentIds = currentParticipants?.map(p => p.user_id) || [];
        const toAdd = formData.participant_ids.filter(id => !currentIds.includes(id));
        const toRemove = currentIds.filter(id => !formData.participant_ids.includes(id));
        
        // Add new participants
        for (const userId of toAdd) {
          await addParticipant.mutateAsync({ event_id: editingEvent.id, user_id: userId });
        }
        
        // Remove old participants
        for (const userId of toRemove) {
          await removeParticipant.mutateAsync({ event_id: editingEvent.id, user_id: userId });
        }
        
        toast.success('Evento atualizado');
      } else {
        await createEvent.mutateAsync({
          title: formData.title,
          description: formData.description,
          event_type: formData.event_type,
          start_time: startTime,
          end_time: endTime,
          all_day: formData.all_day,
          location: formData.location,
          space_id: formData.space_id || undefined,
          participant_ids: formData.participant_ids,
        });
        toast.success('Evento criado');
      }
      setDialogOpen(false);
      resetForm();
    } catch {
      toast.error('Erro ao salvar evento');
    }
  };

  const handleDelete = async () => {
    if (!editingEvent) return;
    try {
      await deleteEvent.mutateAsync(editingEvent.id);
      toast.success('Evento excluído');
      setDialogOpen(false);
      resetForm();
    } catch {
      toast.error('Erro ao excluir evento');
    }
  };

  const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCurrentDate(subMonths(currentDate, 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h2 className="text-lg font-semibold min-w-[200px] text-center">
            {format(currentDate, 'MMMM yyyy', { locale: ptBR })}
          </h2>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCurrentDate(addMonths(currentDate, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCurrentDate(new Date())}
          >
            Hoje
          </Button>
        </div>
        <Button onClick={() => {
          resetForm();
          setDialogOpen(true);
        }}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Evento
        </Button>
      </div>

      {/* Calendar Grid */}
      <Card>
        <CardContent className="p-0">
          {/* Week Days Header */}
          <div className="grid grid-cols-7 border-b">
            {weekDays.map(day => (
              <div
                key={day}
                className="p-2 text-center text-sm font-medium text-muted-foreground border-r last:border-r-0"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Days */}
          <div className="grid grid-cols-7">
            {calendarDays.map((day, index) => {
              const dateKey = format(day, 'yyyy-MM-dd');
              const dayEvents = eventsByDay.get(dateKey) || [];
              const isCurrentMonth = isSameMonth(day, currentDate);
              const isCurrentDay = isToday(day);

              return (
                <div
                  key={index}
                  className={cn(
                    'min-h-[100px] p-1 border-r border-b last:border-r-0 cursor-pointer transition-colors hover:bg-muted/50',
                    !isCurrentMonth && 'bg-muted/30 text-muted-foreground'
                  )}
                  onClick={() => handleDateClick(day)}
                >
                  <div
                    className={cn(
                      'text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full mb-1',
                      isCurrentDay && 'bg-primary text-primary-foreground'
                    )}
                  >
                    {format(day, 'd')}
                  </div>
                  <div className="space-y-1">
                    {dayEvents.slice(0, 3).map(event => {
                      // Check if it's a birthday notice
                      if ('isBirthday' in event && event.isBirthday) {
                        return (
                          <div
                            key={event.id}
                            className="text-xs px-1.5 py-0.5 rounded truncate text-white cursor-default bg-pink-500 flex items-center gap-1"
                          >
                            <Cake className="h-3 w-3" />
                            {event.title.replace('🎉 ', '').replace('!', '')}
                          </div>
                        );
                      }
                      
                      const config = EVENT_TYPE_CONFIG[(event as Event).event_type];
                      return (
                        <div
                          key={event.id}
                          className={cn(
                            'text-xs px-1.5 py-0.5 rounded truncate text-white cursor-pointer hover:opacity-80',
                            (event as Event).color ? '' : config.color
                          )}
                          style={(event as Event).color ? { backgroundColor: (event as Event).color } : undefined}
                          onClick={(e) => handleEventClick(event as Event, e)}
                        >
                          {event.title}
                        </div>
                      );
                    })}
                    {dayEvents.length > 3 && (
                      <div className="text-xs text-muted-foreground px-1">
                        +{dayEvents.length - 3} mais
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Event Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => {
        setDialogOpen(open);
        if (!open) resetForm();
      }}>
        <DialogContent className="max-w-lg max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden">
          {/* Header */}
          <div className="px-6 py-5 border-b bg-muted/30 shrink-0">
            <DialogTitle className="text-lg font-semibold">
              {editingEvent ? 'Editar Evento' : 'Novo Evento'}
            </DialogTitle>
            {selectedDate && !editingEvent && (
              <p className="text-sm text-muted-foreground mt-1">
                {format(selectedDate, "EEEE, dd 'de' MMMM", { locale: ptBR })}
              </p>
            )}
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto scrollbar-minimal">
            <div className="p-6 space-y-6">
              
              {/* Section: Basic Info */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title" className="text-sm font-medium">
                    Título do evento <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="title"
                    ref={titleInputRef}
                    placeholder="Ex: Reunião de planejamento"
                    value={formData.title}
                    onChange={(e) => setFormData(f => ({ ...f, title: e.target.value }))}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Tipo</Label>
                    <Select
                      value={formData.event_type}
                      onValueChange={(v) => setFormData(f => ({ ...f, event_type: v as EventType }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(EVENT_TYPE_CONFIG).map(([type, config]) => (
                          <SelectItem key={type} value={type}>
                            <div className="flex items-center gap-2">
                              <div className={cn('w-2 h-2 rounded-full', config.color)} />
                              {config.label}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Espaço</Label>
                    <Select
                      value={formData.space_id}
                      onValueChange={(v) => setFormData(f => ({ ...f, space_id: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Nenhum" />
                      </SelectTrigger>
                      <SelectContent>
                        {spaces?.map(space => (
                          <SelectItem key={space.id} value={space.id}>
                            {space.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Divider */}
              <div className="border-t" />

              {/* Section: Date & Time */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    Data e Horário
                  </Label>
                  <div className="flex items-center gap-2">
                    <Switch
                      id="all_day"
                      checked={formData.all_day}
                      onCheckedChange={(c) => setFormData(f => ({ ...f, all_day: c }))}
                    />
                    <Label htmlFor="all_day" className="text-sm text-muted-foreground cursor-pointer">
                      Dia inteiro
                    </Label>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wide">Início</Label>
                    <Input
                      type="date"
                      value={formData.start_date}
                      onChange={(e) => setFormData(f => ({ ...f, start_date: e.target.value }))}
                    />
                    {!formData.all_day && (
                      <Input
                        type="time"
                        value={formData.start_time}
                        onChange={(e) => setFormData(f => ({ ...f, start_time: e.target.value }))}
                      />
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wide">Fim</Label>
                    <Input
                      type="date"
                      value={formData.end_date}
                      onChange={(e) => setFormData(f => ({ ...f, end_date: e.target.value }))}
                    />
                    {!formData.all_day && (
                      <Input
                        type="time"
                        value={formData.end_time}
                        onChange={(e) => setFormData(f => ({ ...f, end_time: e.target.value }))}
                      />
                    )}
                  </div>
                </div>
              </div>

              {/* Divider */}
              <div className="border-t" />

              {/* Section: Location */}
              <div className="space-y-2">
                <Label htmlFor="location" className="text-sm font-medium flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  Local ou Link
                </Label>
                <Input
                  id="location"
                  placeholder="Endereço, sala ou link de videoconferência"
                  value={formData.location}
                  onChange={(e) => setFormData(f => ({ ...f, location: e.target.value }))}
                />
              </div>

              {/* Divider */}
              <div className="border-t" />

              {/* Section: Participants */}
              <div className="space-y-3">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  Participantes
                  {formData.participant_ids.length > 0 && (
                    <Badge variant="secondary" className="ml-auto">
                      {formData.participant_ids.length} selecionado{formData.participant_ids.length > 1 ? 's' : ''}
                    </Badge>
                  )}
                </Label>
                <div className="border rounded-lg overflow-hidden">
                  <div className="max-h-36 overflow-y-auto scrollbar-minimal">
                    {isParticipantsLoading || isMembersLoading ? (
                      <div className="p-4 space-y-3">
                        {[1, 2, 3].map((i) => (
                          <div key={i} className="flex items-center gap-3">
                            <Skeleton className="h-8 w-8 rounded-full" />
                            <div className="space-y-1 flex-1">
                              <Skeleton className="h-4 w-3/4" />
                              <Skeleton className="h-3 w-1/2" />
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : members && members.length > 0 ? (
                      members.map((member, index) => {
                        const isSelected = formData.participant_ids.includes(member.user_id);
                        return (
                          <div
                            key={member.user_id}
                            onClick={() => {
                              if (!isSelected) {
                                setFormData(f => ({
                                  ...f,
                                  participant_ids: [...f.participant_ids, member.user_id],
                                }));
                              } else {
                                setFormData(f => ({
                                  ...f,
                                  participant_ids: f.participant_ids.filter(id => id !== member.user_id),
                                }));
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === ' ' || e.key === 'Enter') {
                                e.preventDefault();
                                if (!isSelected) {
                                  setFormData(f => ({
                                    ...f,
                                    participant_ids: [...f.participant_ids, member.user_id],
                                  }));
                                } else {
                                  setFormData(f => ({
                                    ...f,
                                    participant_ids: f.participant_ids.filter(id => id !== member.user_id),
                                  }));
                                }
                              }
                            }}
                            role="button"
                            tabIndex={0}
                            aria-pressed={isSelected}
                            className={cn(
                              'flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-all outline-none focus-visible:bg-muted',
                              index !== 0 && 'border-t',
                              isSelected 
                                ? 'bg-primary/5 border-l-2 border-l-primary' 
                                : 'hover:bg-muted/50 border-l-2 border-l-transparent'
                            )}
                          >
                            <Avatar className="h-8 w-8 shrink-0">
                              <AvatarImage src={member.profile?.avatar_url || undefined} />
                              <AvatarFallback className="text-xs bg-muted">
                                {(member.profile?.full_name || member.profile?.email || 'U')
                                  .split(' ')
                                  .map((n: string) => n[0])
                                  .join('')
                                  .toUpperCase()
                                  .slice(0, 2)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">
                                {member.profile?.full_name || member.profile?.email}
                              </p>
                              <p className="text-xs text-muted-foreground capitalize">
                                {member.role}
                              </p>
                            </div>
                            <div className={cn(
                              'w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all shrink-0',
                              isSelected 
                                ? 'bg-primary border-primary text-primary-foreground' 
                                : 'border-muted-foreground/30'
                            )}>
                              {isSelected && (
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-6">
                        Nenhum membro disponível
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Divider */}
              <div className="border-t" />

              {/* Section: Description */}
              <div className="space-y-2">
                <Label htmlFor="description" className="text-sm font-medium">
                  Descrição
                </Label>
                <Textarea
                  id="description"
                  placeholder="Adicione detalhes, pauta ou informações importantes..."
                  value={formData.description}
                  onChange={(e) => setFormData(f => ({ ...f, description: e.target.value }))}
                  className="resize-none min-h-[80px]"
                />
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t bg-muted/30 shrink-0">
            <div className="flex items-center gap-3">
              {editingEvent && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDelete}
                  disabled={deleteEvent.isPending}
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  Excluir
                </Button>
              )}
              <div className="flex-1" />
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={createEvent.isPending || updateEvent.isPending || !formData.title || !formData.start_date}
              >
                {(createEvent.isPending || updateEvent.isPending) && (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                )}
                {editingEvent ? 'Salvar Alterações' : 'Criar Evento'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
