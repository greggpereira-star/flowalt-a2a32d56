import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Calendar, Users, Video, Flag, Clock, MapPin, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMyEvents, type Event, type EventType } from '@/hooks/useEvents';
import { format, parseISO, isToday, isTomorrow, startOfDay, endOfDay, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const EVENT_TYPE_CONFIG: Record<EventType, { label: string; icon: React.ElementType; color: string }> = {
  meeting: { label: 'Reunião', icon: Users, color: 'bg-blue-500' },
  recording: { label: 'Gravação', icon: Video, color: 'bg-red-500' },
  milestone: { label: 'Marco', icon: Flag, color: 'bg-green-500' },
  deadline: { label: 'Prazo', icon: Clock, color: 'bg-orange-500' },
  other: { label: 'Outro', icon: Calendar, color: 'bg-gray-500' },
};

interface UpcomingEventsProps {
  onEventClick?: (event: Event) => void;
  limit?: number;
}

export const UpcomingEvents: React.FC<UpcomingEventsProps> = ({
  onEventClick,
  limit = 5,
}) => {
  const startDate = startOfDay(new Date());
  const endDate = endOfDay(addDays(new Date(), 14)); // Next 2 weeks

  const { data: events, isLoading } = useMyEvents(startDate, endDate);

  const getDateLabel = (date: Date) => {
    if (isToday(date)) return 'Hoje';
    if (isTomorrow(date)) return 'Amanhã';
    return format(date, "EEEE, dd 'de' MMMM", { locale: ptBR });
  };

  const groupedEvents = React.useMemo(() => {
    if (!events) return new Map<string, Event[]>();

    const groups = new Map<string, Event[]>();
    events.slice(0, limit).forEach(event => {
      const dateKey = format(parseISO(event.start_time), 'yyyy-MM-dd');
      const existing = groups.get(dateKey) || [];
      groups.set(dateKey, [...existing, event]);
    });
    return groups;
  }, [events, limit]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Próximos Eventos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-12 bg-muted animate-pulse rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Calendar className="h-4 w-4" />
          Próximos Eventos
        </CardTitle>
        <CardDescription>Seus compromissos dos próximos dias</CardDescription>
      </CardHeader>
      <CardContent>
        {events?.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <Calendar className="h-10 w-10 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Nenhum evento agendado</p>
          </div>
        ) : (
          <ScrollArea className="h-[300px]">
            <div className="space-y-4 pr-4">
              {Array.from(groupedEvents.entries()).map(([dateKey, dayEvents]) => {
                const date = parseISO(dateKey);
                return (
                  <div key={dateKey}>
                    <h4 className="text-xs font-medium text-muted-foreground mb-2 capitalize">
                      {getDateLabel(date)}
                    </h4>
                    <div className="space-y-2">
                      {dayEvents.map(event => {
                        const config = EVENT_TYPE_CONFIG[event.event_type];
                        const Icon = config.icon;
                        const startTime = parseISO(event.start_time);

                        return (
                          <div
                            key={event.id}
                            className="flex items-center gap-4 p-3 rounded-xl border bg-card/50 hover:bg-accent/40 transition-all cursor-pointer group shadow-sm hover:shadow-md hover:translate-x-1"
                            onClick={() => onEventClick?.(event)}
                          >
                            <div
                              className={cn(
                                'w-1.5 h-12 rounded-full shrink-0 shadow-sm',
                                event.color ? '' : config.color
                              )}
                              style={event.color ? { backgroundColor: event.color } : undefined}
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold text-foreground group-hover:text-primary transition-colors truncate">
                                {event.title}
                              </p>
                              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                                <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-md">
                                  <Icon className="h-3 w-3 text-primary/70" />
                                  <span>{config.label}</span>
                                </div>
                                {!event.all_day && (
                                  <div className="flex items-center gap-1 text-[11px] font-semibold text-primary/80">
                                    <Clock className="h-3 w-3" />
                                    <span>{format(startTime, 'HH:mm')}</span>
                                  </div>
                                )}
                                {event.location && (
                                  <div className="flex items-center gap-1 text-[11px] text-muted-foreground italic truncate max-w-[150px]">
                                    <MapPin className="h-3 w-3 shrink-0" />
                                    <span className="truncate">{event.location}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="h-8 w-8 rounded-full bg-muted/30 flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                              <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
};
