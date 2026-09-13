import { format } from 'date-fns';
import { Building2, MapPin, Video } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { getEventTypeStyle } from '@/lib/agenda/eventTypes';
import type { EventParticipantAvatar } from '@/hooks/agenda/useEventParticipantsBatch';

/** Quantos rostos cabem antes de virar contador. Média real é 2,4 por evento. */
const MAX_AVATARES = 3;

export interface AgendaEventCardProps {
  title: string;
  eventType: string | null;
  startTime: string;
  endTime: string | null;
  allDay?: boolean;
  location?: string | null;
  /** Nome do cliente, quando o evento está vinculado a um. */
  clientName?: string | null;
  participants?: EventParticipantAvatar[];
  isNext?: boolean;
  isPast?: boolean;
  onClick?: () => void;
}

function iniciais(nome: string): string {
  return nome
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

function duracao(start: string, end: string | null, allDay?: boolean): string | null {
  if (allDay) return 'Dia inteiro';
  if (!end) return null;
  const min = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000);
  if (min <= 0) return null;
  if (min < 60) return `${min}min`;
  const h = Math.floor(min / 60);
  const r = min % 60;
  return r === 0 ? `${h}h` : `${h}h${r}`;
}

/** Reunião online costuma ter link no campo de local. */
function ehOnline(local?: string | null): boolean {
  return !!local && /http|meet|zoom|teams|online/i.test(local);
}

export function AgendaEventCard({
  title,
  eventType,
  startTime,
  endTime,
  allDay,
  location,
  clientName,
  participants = [],
  isNext,
  isPast,
  onClick,
}: AgendaEventCardProps) {
  const style = getEventTypeStyle(eventType);
  const Icon = style.icon;
  const dur = duracao(startTime, endTime, allDay);
  const online = ehOnline(location);

  const visiveis = participants.slice(0, MAX_AVATARES);
  const excedente = participants.length - visiveis.length;

  return (
    <article
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={(e) => {
        if (onClick && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onClick();
        }
      }}
      className={cn(
        'group relative flex gap-3 overflow-hidden rounded-xl border bg-white p-3 pl-4 transition-all duration-200',
        isNext ? 'border-slate-300 shadow-[0_2px_10px_rgba(16,24,40,0.06)]' : 'border-slate-200/80',
        // Evento encerrado perde peso, mas continua legível: cinza mais claro
        // em vez de opacidade forte, que prejudicaria o contraste do texto.
        isPast && !isNext && 'bg-slate-50/60',
        onClick && 'cursor-pointer hover:border-slate-300 hover:shadow-[0_4px_14px_rgba(16,24,40,0.07)]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1',
      )}
    >
      {/* Barra lateral em vez de fundo colorido inteiro: identifica o tipo sem
          comprometer a legibilidade do texto nem empilhar blocos berrantes
          quando o dia tem vários compromissos. */}
      <span
        className={cn('absolute inset-y-0 left-0 w-1', style.accent)}
        aria-hidden="true"
      />

      <div className="flex w-[52px] shrink-0 flex-col">
        <span className="text-sm font-semibold tabular-nums text-slate-900">
          {allDay ? '--:--' : format(new Date(startTime), 'HH:mm')}
        </span>
        {dur && <span className="mt-0.5 text-[11px] text-slate-500">{dur}</span>}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          {/* Ícone + texto: a categoria não depende só da cor, para quem não
              distingue matiz conseguir ler a agenda. */}
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium',
              style.chip,
            )}
          >
            <Icon className="h-3 w-3" strokeWidth={2} />
            {style.label}
          </span>

          {isNext && (
            <span className="rounded-full bg-indigo-600 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
              Próximo
            </span>
          )}
        </div>

        <p className="mt-1 truncate text-sm font-medium text-slate-900">{title}</p>

        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
          {/* "Com quem" no sentido de negócio: reunião com cliente não é um
              tipo separado — é uma reunião que tem cliente. */}
          {clientName && (
            <span className="flex items-center gap-1 text-xs text-slate-600">
              <Building2 className="h-3 w-3 shrink-0 text-slate-400" />
              <span className="truncate">{clientName}</span>
            </span>
          )}

          {location && (
            <span className="flex min-w-0 items-center gap-1 text-xs text-slate-500">
              {online ? (
                <Video className="h-3 w-3 shrink-0" />
              ) : (
                <MapPin className="h-3 w-3 shrink-0" />
              )}
              <span className="truncate">{location}</span>
            </span>
          )}
        </div>
      </div>

      {participants.length > 0 && (
        <div className="flex shrink-0 items-center self-center">
          <div className="flex -space-x-2">
            {visiveis.map((p) => (
              <Tooltip key={p.userId}>
                <TooltipTrigger asChild>
                  <Avatar className="h-6 w-6 border-2 border-white">
                    <AvatarImage src={p.avatarUrl ?? undefined} alt={p.fullName} />
                    <AvatarFallback className="bg-slate-100 text-[9px] font-medium text-slate-600">
                      {iniciais(p.fullName)}
                    </AvatarFallback>
                  </Avatar>
                </TooltipTrigger>
                <TooltipContent>{p.fullName}</TooltipContent>
              </Tooltip>
            ))}

            {excedente > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-slate-200 text-[9px] font-semibold text-slate-600">
                    +{excedente}
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  {participants.slice(MAX_AVATARES).map((p) => p.fullName).join(', ')}
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>
      )}
    </article>
  );
}
