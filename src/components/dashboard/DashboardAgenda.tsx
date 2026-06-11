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
            const style = EVENT_TYPE_STYLES[event.event_type] || EVENT_TYPE_STYLES.other;
            const TypeIcon = style.Icon;
            const startTime = parseISO(event.start_time);
            const endTime = parseISO(event.end_time);
            const duration = Math.max(differenceInMinutes(endTime, startTime), 0);
            const clientName = event.card?.clientName || event.card?.title || event.location || 'Sem cliente vinculado';
            const participantNames = event.participants.map(participant => getFirstName(participant.full_name, participant.email));

            return (
              <Card 
                key={event.id} 
                className="group relative overflow-hidden border-none bg-card/80 backdrop-blur-sm ring-1 ring-border transition-all hover:-translate-y-0.5 hover:ring-primary/30"
              >
                <div className={cn('absolute left-0 top-0 bottom-0 w-1.5 transition-colors', style.accent)} />
                
                <CardContent className="p-5">
                  <div className="flex flex-col gap-4">
                    <div className="flex items-start gap-4">
                      <div className={cn('flex min-w-[78px] flex-col items-center justify-center rounded-xl border px-3 py-2', style.timeBox)}>
                        <span className="text-lg font-bold leading-none">{event.all_day ? 'Dia' : format(startTime, 'HH:mm')}</span>
                        <span className="mt-1 text-[10px] font-semibold uppercase leading-none text-current/70">
                          {event.all_day ? 'inteiro' : format(endTime, 'HH:mm')}
                        </span>
                      </div>

                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge 
                            variant="outline" 
                            className={cn('h-6 gap-1.5 px-2 text-[10px] font-bold uppercase tracking-normal', style.badge)}
                          >
                            <TypeIcon className="h-3 w-3" />
                            {style.label}
                          </Badge>
                          <span className="text-xs font-medium text-muted-foreground">
                            {duration > 0 ? `${Math.floor(duration / 60)}h${duration % 60 ? ` ${duration % 60}min` : ''}` : 'Hoje'}
                          </span>
                        </div>
                        
                        <h3 className="truncate text-base font-bold text-foreground transition-colors group-hover:text-primary">
                          {event.title}
                        </h3>

                        <div className="grid gap-2 text-xs text-muted-foreground">
                          <div className="flex items-center gap-2 rounded-md bg-muted/45 px-2.5 py-1.5">
                            <Briefcase className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate font-medium text-foreground/80">{clientName}</span>
                          </div>
                          {participantNames.length > 0 && (
                            <div className="flex items-center gap-2 rounded-md bg-muted/45 px-2.5 py-1.5">
                              <Users className="h-3.5 w-3.5 shrink-0" />
                              <span className="truncate">{participantNames.join(', ')}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-3 pl-[94px]">
                      {event.participants && event.participants.length > 0 && (
                        <div className="flex items-center -space-x-2 overflow-hidden">
                          {event.participants.map((participant: any) => (
                            <Avatar key={participant.id} className="h-8 w-8 border-2 border-background ring-1 ring-border">
                              <AvatarImage src={participant.avatar_url || undefined} />
                              <AvatarFallback className="bg-muted text-[10px] font-semibold text-muted-foreground">
                                {getInitials(participant.full_name, participant.email)}
                              </AvatarFallback>
                            </Avatar>
                          ))}
                        </div>
                      )}

                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-9 w-9 shrink-0 rounded-full text-muted-foreground transition-all hover:bg-primary/10 hover:text-primary md:opacity-0 md:group-hover:opacity-100"
                        onClick={() => navigate('/calendar')}
                      >
                        <ExternalLink className="h-4 w-4" />
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
