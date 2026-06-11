import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { 
  Calendar, 
  ChevronRight, 
  ExternalLink,
  Briefcase,
  Users,
  Video,
  Flag,
  AlertTriangle,
} from 'lucide-react';
import { differenceInMinutes, format, parseISO, startOfDay, endOfDay } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import type { EventType } from '@/hooks/useEvents';

interface DashboardAgendaProps {
  limit?: number;
}

type ParticipantProfile = {
  id: string;
  full_name: string | null;
  email?: string | null;
  avatar_url: string | null;
  status?: string | null;
};

type DashboardEvent = {
  id: string;
  title: string;
  description: string | null;
  event_type: EventType;
  start_time: string;
  end_time: string;
  all_day: boolean;
  location: string | null;
  card_id: string | null;
  created_by: string | null;
  card?: { id: string; title: string | null; clientName: string | null } | null;
  participants: ParticipantProfile[];
};

const EVENT_TYPE_STYLES: Record<EventType, {
  label: string;
  Icon: React.ElementType;
  accent: string;
  badge: string;
  timeBox: string;
}> = {
  meeting: {
    label: 'Reunião',
    Icon: Users,
    accent: 'bg-blue-500',
    badge: 'border-blue-200 bg-blue-500/10 text-blue-700 dark:border-blue-900/60 dark:text-blue-300',
    timeBox: 'border-blue-200 bg-blue-500/10 text-blue-700 dark:border-blue-900/60 dark:text-blue-300',
  },
  recording: {
    label: 'Gravação',
    Icon: Video,
    accent: 'bg-red-500',
    badge: 'border-red-200 bg-red-500/10 text-red-700 dark:border-red-900/60 dark:text-red-300',
    timeBox: 'border-red-200 bg-red-500/10 text-red-700 dark:border-red-900/60 dark:text-red-300',
  },
  milestone: {
    label: 'Marco',
    Icon: Flag,
    accent: 'bg-emerald-500',
    badge: 'border-emerald-200 bg-emerald-500/10 text-emerald-700 dark:border-emerald-900/60 dark:text-emerald-300',
    timeBox: 'border-emerald-200 bg-emerald-500/10 text-emerald-700 dark:border-emerald-900/60 dark:text-emerald-300',
  },
  deadline: {
    label: 'Prazo',
    Icon: AlertTriangle,
    accent: 'bg-orange-500',
    badge: 'border-orange-200 bg-orange-500/10 text-orange-700 dark:border-orange-900/60 dark:text-orange-300',
    timeBox: 'border-orange-200 bg-orange-500/10 text-orange-700 dark:border-orange-900/60 dark:text-orange-300',
  },
  other: {
    label: 'Outro',
    Icon: Calendar,
    accent: 'bg-slate-500',
    badge: 'border-slate-200 bg-slate-500/10 text-slate-700 dark:border-slate-800 dark:text-slate-300',
    timeBox: 'border-slate-200 bg-slate-500/10 text-slate-700 dark:border-slate-800 dark:text-slate-300',
  },
};

const getInitials = (name?: string | null, email?: string | null) => {
  const label = name || email || 'Usuário';
  return label
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase())
    .join('') || 'U';
};

const getFirstName = (name?: string | null, email?: string | null) => {
  return (name || email || 'Usuário').split(' ')[0];
};

export const DashboardAgenda: React.FC<DashboardAgendaProps> = ({ limit = 5 }) => {
  const { currentWorkspace } = useWorkspace();
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: agendaData, isLoading } = useQuery({
    queryKey: ['dashboard-agenda-participants-v2', currentWorkspace?.id, user?.id],
    queryFn: async () => {
      if (!currentWorkspace?.id || !user?.id) return [];

      const today = startOfDay(new Date());
      const endOfToday = endOfDay(new Date());

      const { data: myParticipations, error: participationError } = await supabase
        .from('event_participants')
        .select('event_id, status')
        .eq('user_id', user.id)
        .neq('status', 'declined');

      if (participationError) throw participationError;

      const myEventIds = new Set((myParticipations || []).map(participation => participation.event_id));

      const { data: events, error } = await supabase
        .from('events')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .lt('start_time', endOfToday.toISOString())
        .gt('end_time', today.toISOString())
        .order('start_time', { ascending: true });

      if (error) throw error;

      const visibleEvents = (events || []).filter(event => (
        myEventIds.has(event.id) || event.created_by === user.id
      ));

      if (visibleEvents.length === 0) return [];

      const eventIds = visibleEvents.map(event => event.id);
      const cardIds = visibleEvents.map(event => event.card_id).filter(Boolean) as string[];

      const [{ data: participants }, { data: cards }] = await Promise.all([
        supabase
          .from('event_participants')
          .select('event_id, user_id, status')
          .in('event_id', eventIds),
        cardIds.length > 0
          ? supabase
            .from('cards')
            .select('id, title, client_id')
            .in('id', cardIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);

      const participantUserIds = [...new Set((participants || []).map(participant => participant.user_id))];
      const clientIds = [...new Set((cards || []).map((card: any) => card.client_id).filter(Boolean))];

      const [{ data: profiles }, { data: clients }] = await Promise.all([
        participantUserIds.length > 0
          ? supabase
            .from('profiles')
            .select('id, full_name, email, avatar_url')
            .in('id', participantUserIds)
          : Promise.resolve({ data: [] as any[] }),
        clientIds.length > 0
          ? supabase
            .from('clients')
            .select('id, name')
            .in('id', clientIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);

      const profilesById = new Map((profiles || []).map(profile => [profile.id, profile]));
      const clientsById = new Map((clients || []).map((client: any) => [client.id, client]));
      const cardsById = new Map((cards || []).map((card: any) => [
        card.id,
        {
          id: card.id,
          title: card.title,
          clientName: card.client_id ? clientsById.get(card.client_id)?.name || null : null,
        },
      ]));

      return visibleEvents.map(event => {
        const eventParticipants = (participants || [])
          .filter(participant => participant.event_id === event.id)
          .map(participant => {
            const profile = profilesById.get(participant.user_id);
            return {
              id: participant.user_id,
              full_name: profile?.full_name || null,
              email: profile?.email || null,
              avatar_url: profile?.avatar_url || null,
              status: participant.status,
            };
          });

        return {
          ...event,
          card: event.card_id ? cardsById.get(event.card_id) || null : null,
          participants: eventParticipants,
        };
      }) as DashboardEvent[];
    },
    enabled: !!currentWorkspace?.id && !!user?.id,
  });

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
            const clientName = (event.card as any)?.client_name || event.location || 'Sem cliente';
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
