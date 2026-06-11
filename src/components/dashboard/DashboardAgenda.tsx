import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Calendar, 
  Clock, 
  User, 
  ChevronRight, 
  MapPin, 
  ExternalLink,
  Briefcase
} from 'lucide-react';
import { format, isToday, isTomorrow, parseISO, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';

interface DashboardAgendaProps {
  limit?: number;
}

export const DashboardAgenda: React.FC<DashboardAgendaProps> = ({ limit = 5 }) => {
  const { currentWorkspace } = useWorkspace();
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: agendaData, isLoading } = useQuery({
    queryKey: ['dashboard-agenda', currentWorkspace?.id, user?.id],
    queryFn: async () => {
      if (!currentWorkspace?.id || !user?.id) return [];

      const today = startOfDay(new Date());
      const endOfToday = endOfDay(new Date());

      // 1. Get user's participations
      const { data: participations } = await supabase
        .from('event_participants')
        .select('event_id')
        .eq('user_id', user.id);

      const eventIds = participations?.map(p => p.event_id) || [];

      // 2. Query events (user created OR user participates)
      let query = supabase
        .from('events')
        .select(`
          *,
          card:cards(id, title, client_name)
        `)
        .eq('workspace_id', currentWorkspace.id)
        .gte('start_time', today.toISOString())
        .lte('start_time', endOfToday.toISOString())
        .order('start_time', { ascending: true });

      if (eventIds.length > 0) {
        query = query.or(`created_by.eq.${user.id},id.in.(${eventIds.join(',')})`);
      } else {
        query = query.eq('created_by', user.id);
      }

      const { data: events, error } = await query;
      if (error) throw error;

      // 3. For each event, get other participants
      const eventsWithDetails = await Promise.all((events || []).map(async (event) => {
        const { data: participants } = await supabase
          .from('event_participants')
          .select('user_id, status')
          .eq('event_id', event.id);
        
        const otherParticipantIds = participants
          ?.filter(p => p.user_id !== user.id)
          .map(p => p.user_id) || [];
        
        let participantProfiles = [];
        if (otherParticipantIds.length > 0) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, full_name, avatar_url')
            .in('id', otherParticipantIds);
          participantProfiles = profiles || [];
        }

        return {
          ...event,
          participants: participantProfiles
        };
      }));

      return eventsWithDetails;
    },
    enabled: !!currentWorkspace?.id && !!user?.id,
  });

  const getEventBadgeColor = (type: string) => {
    switch (type) {
      case 'meeting': return 'bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 border-blue-200';
      case 'recording': return 'bg-purple-500/10 text-purple-600 hover:bg-purple-500/20 border-purple-200';
      case 'milestone': return 'bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 border-amber-200';
      case 'deadline': return 'bg-rose-500/10 text-rose-600 hover:bg-rose-500/20 border-rose-200';
      default: return 'bg-slate-500/10 text-slate-600 hover:bg-slate-500/20 border-slate-200';
    }
  };

  const getEventTypeName = (type: string) => {
    switch (type) {
      case 'meeting': return 'Reunião';
      case 'recording': return 'Gravação';
      case 'milestone': return 'Marco';
      case 'deadline': return 'Prazo';
      default: return 'Evento';
    }
  };

  if (isLoading) {
    return (
      <Card className="h-full border-none shadow-none bg-transparent">
        <CardHeader className="px-0 pt-0">
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent className="px-0 space-y-4">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Agenda de Hoje
          </h2>
          <p className="text-sm text-muted-foreground">
            {agendaData && agendaData.length > 0 
              ? `Você tem ${agendaData.length} compromisso${agendaData.length > 1 ? 's' : ''} hoje.`
              : 'Nenhum compromisso agendado para hoje.'}
          </p>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          className="rounded-full gap-2 border-primary/20 hover:bg-primary/5 hover:text-primary transition-all"
          onClick={() => navigate('/calendar')}
        >
          Ver agenda completa
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid gap-4">
        {agendaData && agendaData.length > 0 ? (
          agendaData.slice(0, limit).map((event) => {
            const clientName = (event.card as any)?.client_name || event.location;
            const startTime = parseISO(event.start_time);
            
            return (
              <Card 
                key={event.id} 
                className="group relative overflow-hidden border-none bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm transition-all hover:shadow-xl hover:shadow-primary/5 hover:-translate-y-1 ring-1 ring-slate-200 dark:ring-slate-800"
              >
                {/* Visual time indicator line */}
                <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-primary/40 group-hover:bg-primary transition-colors" />
                
                <CardContent className="p-5">
                  <div className="flex flex-col md:flex-row md:items-center gap-4 justify-between">
                    <div className="flex items-start gap-4">
                      {/* Time Slot */}
                      <div className="flex flex-col items-center justify-center min-w-[70px] py-2 rounded-xl bg-primary/5 text-primary border border-primary/10">
                        <span className="text-lg font-bold leading-none">
                          {format(startTime, 'HH:mm')}
                        </span>
                        <span className="text-[10px] uppercase tracking-wider font-semibold opacity-70">
                          {format(startTime, 'aaa')}
                        </span>
                      </div>

                      <div className="space-y-1.5 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge 
                            variant="outline" 
                            className={`text-[10px] px-2 py-0 h-5 font-bold uppercase tracking-tight ${getEventBadgeColor(event.event_type)}`}
                          >
                            {getEventTypeName(event.event_type)}
                          </Badge>
                          {clientName && (
                            <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-md">
                              <Briefcase className="h-3 w-3" />
                              <span className="truncate max-w-[150px]">{clientName}</span>
                            </div>
                          )}
                        </div>
                        
                        <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 group-hover:text-primary transition-colors truncate">
                          {event.title}
                        </h3>

                        {event.description && (
                          <p className="text-sm text-muted-foreground line-clamp-1 max-w-xl">
                            {event.description}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-4 pl-[86px] md:pl-0">
                      {/* Participants */}
                      {event.participants && event.participants.length > 0 && (
                        <div className="flex -space-x-2">
                          {event.participants.map((participant: any) => (
                            <Avatar key={participant.id} className="h-8 w-8 border-2 border-background ring-1 ring-slate-200 dark:ring-slate-800">
                              <AvatarImage src={participant.avatar_url} />
                              <AvatarFallback className="text-[10px] bg-slate-100 text-slate-600">
                                {participant.full_name?.[0] || 'U'}
                              </AvatarFallback>
                            </Avatar>
                          ))}
                        </div>
                      )}

                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-10 w-10 rounded-full opacity-0 group-hover:opacity-100 group-hover:bg-primary/10 group-hover:text-primary transition-all"
                        onClick={() => navigate('/calendar')}
                      >
                        <ExternalLink className="h-5 w-5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        ) : (
          <div className="flex flex-col items-center justify-center py-12 px-6 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-50/50 dark:bg-slate-900/20">
            <div className="p-4 rounded-full bg-slate-100 dark:bg-slate-800 mb-4 ring-8 ring-slate-50 dark:ring-slate-900">
              <Calendar className="h-8 w-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Tudo calmo por aqui</h3>
            <p className="text-sm text-muted-foreground max-w-xs mt-1">
              Você não tem compromissos agendados para hoje. Aproveite para organizar suas tarefas!
            </p>
            <Button 
              variant="outline" 
              className="mt-6 rounded-full"
              onClick={() => navigate('/calendar')}
            >
              Agendar novo evento
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
