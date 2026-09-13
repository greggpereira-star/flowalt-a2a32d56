import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarDays, CalendarPlus, MapPin, Video } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { AgendaEventCard } from '@/components/agenda/AgendaEventCard';
import { useEventParticipantsBatch } from '@/hooks/agenda/useEventParticipantsBatch';
import type { HomeAgendaEvent } from '@/lib/home/home-types';

interface TodayAgendaProps {
  events: HomeAgendaEvent[];
  isLoading?: boolean;
  error?: unknown;
  onRetry?: () => void;
}

function eventDuration(event: HomeAgendaEvent): string | null {
  if (event.allDay) return 'Dia inteiro';
  if (!event.endTime) return null;

  const minutes = Math.round(
    (new Date(event.endTime).getTime() - new Date(event.startTime).getTime()) / 60000,
  );
  if (minutes <= 0) return null;
  if (minutes < 60) return `${minutes}min`;

  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours}h` : `${hours}h${rest}`;
}

/** Reunião online costuma ter link no campo de local. */
function isOnline(location: string | null): boolean {
  if (!location) return false;
  return /http|meet|zoom|teams|online/i.test(location);
}

export function TodayAgenda({ events, isLoading, error, onRetry }: TodayAgendaProps) {
  const navigate = useNavigate();
  // Uma consulta para todos os eventos da lista, nao uma por card.
  const { data: participantsByEvent } = useEventParticipantsBatch(events.map((e) => e.id));
  const today = format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR });

  return (
    <section
      aria-labelledby="today-agenda-title"
      className="flex flex-col rounded-2xl border border-slate-200/80 bg-white p-6 shadow-[0_1px_2px_rgba(16,24,40,0.03)]"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2
            id="today-agenda-title"
            className="flex items-center gap-2 text-base font-semibold text-slate-900"
          >
            <CalendarDays className="h-[18px] w-[18px] text-slate-400" strokeWidth={1.75} />
            Agenda de Hoje
          </h2>
          <p className="mt-0.5 text-sm capitalize text-slate-500">{today}</p>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate('/calendar')}>
            <CalendarPlus className="mr-1.5 h-3.5 w-3.5" />
            Agendar
          </Button>
          <Button size="sm" onClick={() => navigate('/calendar')}>
            Ver agenda
          </Button>
        </div>
      </div>

      <div className="mt-5 flex-1">
        {isLoading && (
          <div className="space-y-3" aria-busy="true">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-xl bg-slate-100" />
            ))}
          </div>
        )}

        {!isLoading && error && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center">
            <p className="text-sm text-slate-600">Não foi possível carregar sua agenda.</p>
            {onRetry && (
              <Button variant="outline" size="sm" className="mt-3" onClick={onRetry}>
                Tentar novamente
              </Button>
            )}
          </div>
        )}

        {!isLoading && !error && events.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 px-6 py-10 text-center">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100">
              <CalendarDays className="h-5 w-5 text-slate-400" strokeWidth={1.5} />
            </span>
            <p className="mt-3 text-sm font-medium text-slate-900">Tudo calmo por aqui</p>
            <p className="mt-1 text-sm text-slate-500">
              Nenhum compromisso agendado para hoje.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => navigate('/calendar')}
            >
              Agendar evento
            </Button>
          </div>
        )}

        {!isLoading && !error && events.length > 0 && (
          <ul className="space-y-1">
            {events.slice(0, 6).map((event) => (
              <li key={event.id}>
                <AgendaEventCard
                  title={event.title}
                  eventType={event.eventType}
                  startTime={event.startTime}
                  endTime={event.endTime}
                  allDay={event.allDay}
                  location={event.location}
                  participants={participantsByEvent?.[event.id] ?? []}
                  isNext={event.isNext}
                  isPast={event.isPast}
                  onClick={() => navigate('/calendar')}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
