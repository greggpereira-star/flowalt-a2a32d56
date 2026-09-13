import { useNavigate } from 'react-router-dom';
import { format, differenceInMinutes } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  CalendarCheck, ArrowRight, Package, Bell, CheckCircle2,
  AlertTriangle, Clock, Info,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type {
  DashboardAgendaEvent, DashboardDelivery, OperationalAlert,
} from '@/lib/dashboard/dashboard-types';

interface TodayFocusPanelProps {
  agora: Date;
  prioridade: OperationalAlert;
  agenda: DashboardAgendaEvent[];
  entregas: DashboardDelivery[];
  alertas: OperationalAlert[];
  isLoading?: boolean;
}

/**
 * O bloco "Foco de Hoje".
 *
 * As quatro áreas respondem, em ordem, as perguntas que alguém faz ao abrir o
 * sistema de manhã: o que eu faço agora, o que tenho marcado, o que está
 * chegando e o que exige atenção. Ficam juntas de propósito — separadas em
 * cards distantes, obrigariam a varrer a tela para montar o quadro do dia.
 *
 * Mantive as quatro no mesmo arquivo por serem partes de uma composição só,
 * não peças reutilizáveis: nenhuma delas faz sentido isolada em outra tela.
 */
export function TodayFocusPanel({
  agora, prioridade, agenda, entregas, alertas, isLoading,
}: TodayFocusPanelProps) {
  return (
    <section className="rounded-xl border border-border/60 bg-card p-4 sm:p-5">
      <header className="mb-4 flex items-center gap-2">
        <CalendarCheck className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">
            Hoje, {format(agora, "d 'de' MMMM", { locale: ptBR })}
          </h2>
          <p className="text-xs text-muted-foreground">Seu foco para hoje</p>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-4">
        <AreaPrioridade prioridade={prioridade} isLoading={isLoading} />
        <AreaAgenda agenda={agenda} agora={agora} isLoading={isLoading} />
        <AreaEntregas entregas={entregas} isLoading={isLoading} />
        <AreaAlertas alertas={alertas} isLoading={isLoading} />
      </div>
    </section>
  );
}

function Coluna({ titulo, cta, href, children }: {
  titulo: string; cta?: string; href?: string; children: React.ReactNode;
}) {
  const navigate = useNavigate();
  return (
    <div className="flex min-w-0 flex-col">
      <h3 className="mb-2 text-xs font-medium text-muted-foreground">{titulo}</h3>
      <div className="flex-1 space-y-2">{children}</div>
      {cta && href && (
        <button
          type="button"
          onClick={() => navigate(href)}
          className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
        >
          {cta}
          <ArrowRight className="h-3 w-3" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

const ICONE_SEVERIDADE = {
  critical: AlertTriangle,
  warning: Clock,
  info: Info,
  success: CheckCircle2,
} as const;

const COR_SEVERIDADE = {
  critical: 'text-destructive',
  warning: 'text-amber-600',
  info: 'text-blue-600',
  success: 'text-emerald-600',
} as const;

function AreaPrioridade({ prioridade, isLoading }: { prioridade: OperationalAlert; isLoading?: boolean }) {
  const navigate = useNavigate();
  const Icone = ICONE_SEVERIDADE[prioridade.severity];

  if (isLoading) return <ColunaSkeleton titulo="Priorize o que importa" />;

  return (
    <Coluna titulo="Priorize o que importa">
      <div className="rounded-lg bg-muted/40 p-3">
        <div className="flex items-start gap-2">
          <Icone className={cn('mt-0.5 h-4 w-4 shrink-0', COR_SEVERIDADE[prioridade.severity])} aria-hidden="true" />
          {/* Só a descrição: o título do card repetia o nome da coluna. */}
          <p className="min-w-0 text-sm">{prioridade.description}</p>
        </div>

        {prioridade.route && prioridade.actionLabel && (
          <div className="mt-3 flex items-center gap-2">
            <Button size="sm" variant="secondary" className="h-7 text-xs"
              onClick={() => navigate(prioridade.route as string)}>
              {prioridade.actionLabel}
            </Button>
            {prioridade.count !== undefined && (
              <Badge variant="secondary" className="tabular-nums">{prioridade.count}</Badge>
            )}
          </div>
        )}
      </div>
    </Coluna>
  );
}

function AreaAgenda({ agenda, agora, isLoading }: {
  agenda: DashboardAgendaEvent[]; agora: Date; isLoading?: boolean;
}) {
  if (isLoading) return <ColunaSkeleton titulo="Agenda de Hoje" />;

  if (agenda.length === 0) {
    return (
      <Coluna titulo="Agenda de Hoje" cta="Agendar evento" href="/calendar">
        <p className="text-xs text-muted-foreground">Seu dia está livre neste momento.</p>
      </Coluna>
    );
  }

  return (
    <Coluna titulo="Agenda de Hoje" cta="Ver agenda completa" href="/calendar">
      {agenda.slice(0, 3).map(ev => {
        const minutos = differenceInMinutes(new Date(ev.startTime), agora);
        const emBreve = minutos >= 0 && minutos <= 30;
        return (
          <div key={ev.id} className="flex gap-2.5">
            {/* O proximo compromisso ganha marcador cheio; os demais ficam
                vazados. E o unico item da lista que muda de decisao agora. */}
            <div className="flex flex-col items-center pt-1">
              <span className={cn(
                'h-2 w-2 shrink-0 rounded-full',
                ev.isNext ? 'bg-primary' : 'border border-muted-foreground/40',
              )} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-medium tabular-nums text-muted-foreground">
                  {format(new Date(ev.startTime), 'HH:mm')}
                </span>
                {emBreve && <Badge variant="secondary" className="h-4 px-1 text-[10px]">Em breve</Badge>}
              </div>
              <p className={cn('truncate text-sm', ev.isNext ? 'font-medium' : 'text-foreground/80')}>
                {ev.title}
              </p>
              {(ev.durationMinutes || ev.spaceName) && (
                <p className="truncate text-[11px] text-muted-foreground">
                  {[ev.durationMinutes ? `${ev.durationMinutes} min` : null, ev.spaceName]
                    .filter(Boolean).join(' · ')}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </Coluna>
  );
}

function AreaEntregas({ entregas, isLoading }: { entregas: DashboardDelivery[]; isLoading?: boolean }) {
  if (isLoading) return <ColunaSkeleton titulo="Próximas Entregas" />;

  if (entregas.length === 0) {
    return (
      <Coluna titulo="Próximas Entregas">
        <p className="text-xs text-muted-foreground">Nenhuma entrega com prazo definido.</p>
      </Coluna>
    );
  }

  return (
    <Coluna titulo="Próximas Entregas" cta="Ver todas entregas" href="/tasks?filter=due-soon">
      {entregas.map(e => (
        <div key={e.cardId} className="flex items-start gap-2 rounded-lg border border-border/50 p-2">
          <Package className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm">{e.title}</p>
            <p className="truncate text-[11px] text-muted-foreground">
              Prazo: {format(new Date(e.dueDate), "d 'de' MMMM", { locale: ptBR })}
            </p>
          </div>
          <Badge
            variant={e.relativeLabel === 'Hoje' ? 'destructive' : 'secondary'}
            className="shrink-0 text-[10px]"
          >
            {e.relativeLabel}
          </Badge>
        </div>
      ))}
    </Coluna>
  );
}

function AreaAlertas({ alertas, isLoading }: { alertas: OperationalAlert[]; isLoading?: boolean }) {
  const navigate = useNavigate();
  if (isLoading) return <ColunaSkeleton titulo="Alertas Imediatos" />;

  return (
    <Coluna titulo="Alertas Imediatos" cta="Ver todos alertas" href="/tasks?filter=overdue">
      {alertas.map(a => {
        const Icone = ICONE_SEVERIDADE[a.severity];
        return (
          <button
            key={a.id}
            type="button"
            disabled={!a.route}
            onClick={() => a.route && navigate(a.route)}
            className={cn(
              'flex w-full items-start gap-2 rounded-lg border border-border/50 p-2 text-left',
              a.route && 'transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            )}
          >
            <Icone className={cn('mt-0.5 h-3.5 w-3.5 shrink-0', COR_SEVERIDADE[a.severity])} aria-hidden="true" />
            <span className="min-w-0">
              <span className="block truncate text-sm">{a.title}</span>
              <span className="block truncate text-[11px] text-muted-foreground">{a.description}</span>
            </span>
          </button>
        );
      })}
    </Coluna>
  );
}

function ColunaSkeleton({ titulo }: { titulo: string }) {
  return (
    <div className="flex min-w-0 flex-col">
      <h3 className="mb-2 text-xs font-medium text-muted-foreground">{titulo}</h3>
      <div className="space-y-2">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-8 w-3/4" />
      </div>
    </div>
  );
}
