import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
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
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useEvents,
  useCreateEvent,
  useUpdateEvent,
  useDeleteEvent,
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

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart, { locale: ptBR });
  const calendarEnd = endOfWeek(monthEnd, { locale: ptBR });

  const { data: events, isLoading } = useEvents(calendarStart, calendarEnd);
  const { data: spaces } = useSpaces();
  const { data: members } = useWorkspaceMembers();
  const { birthdayNotices } = useNotices();
  const createEvent = useCreateEvent();
  const updateEvent = useUpdateEvent();
  const deleteEvent = useDeleteEvent();

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

  const handleEventClick = (event: Event, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingEvent(event);
    const startDate = parseISO(event.start_time);
    const endDate = parseISO(event.end_time);
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
      participant_ids: [],
    });
    setDialogOpen(true);
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
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingEvent ? 'Editar Evento' : 'Novo Evento'}
            </DialogTitle>
            <DialogDescription>
              {selectedDate && !editingEvent && (
                <>Criando evento para {format(selectedDate, "dd 'de' MMMM", { locale: ptBR })}</>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">Título *</Label>
              <Input
                id="title"
                placeholder="Nome do evento"
                value={formData.title}
                onChange={(e) => setFormData(f => ({ ...f, title: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo</Label>
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
                          <config.icon className="h-4 w-4" />
                          {config.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Espaço</Label>
                <Select
                  value={formData.space_id}
                  onValueChange={(v) => setFormData(f => ({ ...f, space_id: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Opcional" />
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

            <div className="flex items-center gap-2">
              <Switch
                id="all_day"
                checked={formData.all_day}
                onCheckedChange={(c) => setFormData(f => ({ ...f, all_day: c }))}
              />
              <Label htmlFor="all_day">Dia inteiro</Label>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Data Início *</Label>
                <Input
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => setFormData(f => ({ ...f, start_date: e.target.value }))}
                />
              </div>
              {!formData.all_day && (
                <div className="space-y-2">
                  <Label>Hora Início</Label>
                  <Input
                    type="time"
                    value={formData.start_time}
                    onChange={(e) => setFormData(f => ({ ...f, start_time: e.target.value }))}
                  />
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Data Fim</Label>
                <Input
                  type="date"
                  value={formData.end_date}
                  onChange={(e) => setFormData(f => ({ ...f, end_date: e.target.value }))}
                />
              </div>
              {!formData.all_day && (
                <div className="space-y-2">
                  <Label>Hora Fim</Label>
                  <Input
                    type="time"
                    value={formData.end_time}
                    onChange={(e) => setFormData(f => ({ ...f, end_time: e.target.value }))}
                  />
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="location">Local</Label>
              <Input
                id="location"
                placeholder="Local ou link da reunião"
                value={formData.location}
                onChange={(e) => setFormData(f => ({ ...f, location: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descrição</Label>
              <Textarea
                id="description"
                placeholder="Detalhes do evento..."
                value={formData.description}
                onChange={(e) => setFormData(f => ({ ...f, description: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            {editingEvent && (
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={deleteEvent.isPending}
                className="sm:mr-auto"
              >
                Excluir
              </Button>
            )}
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createEvent.isPending || updateEvent.isPending}
            >
              {createEvent.isPending || updateEvent.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              {editingEvent ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
