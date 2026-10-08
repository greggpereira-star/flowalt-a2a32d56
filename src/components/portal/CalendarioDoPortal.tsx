import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { addMonths, addWeeks, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameMonth, isToday, startOfMonth, startOfWeek } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ItemDoCalendario {
  id: string;
  title: string;
  date: string;
  type: string | null;
  platform: string | null;
  situation: 'aguardando' | 'ajustes' | 'aprovado' | 'publicado';
}

const TIPOS: Record<string, string> = { post: 'Post', story: 'Story', reels: 'Reels', video: 'Vídeo', carousel: 'Carrossel', ad: 'Anúncio' };
const SITUACAO: Record<ItemDoCalendario['situation'], { rotulo: string; chip: string; ponto: string }> = {
  aguardando: { rotulo: 'Aguardando você', chip: 'bg-amber-50 text-amber-900 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-200 dark:ring-amber-500/30', ponto: 'bg-amber-500' },
  ajustes: { rotulo: 'Ajustes em andamento', chip: 'bg-rose-50 text-rose-900 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-200 dark:ring-rose-500/30', ponto: 'bg-rose-500' },
  aprovado: { rotulo: 'Aprovado', chip: 'bg-emerald-50 text-emerald-900 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-200 dark:ring-emerald-500/30', ponto: 'bg-emerald-500' },
  publicado: { rotulo: 'Publicado', chip: 'bg-violet-50 text-violet-900 ring-violet-200 dark:bg-violet-500/10 dark:text-violet-200 dark:ring-violet-500/30', ponto: 'bg-violet-500' },
};
const DIAS_CURTOS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const chave = (d: Date) => format(d, 'yyyy-MM-dd');
const dataLocal = (iso: string) => new Date(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));

interface Props {
  itens: ItemDoCalendario[];
  token: string;
}

/** Calendario de publicacoes do portal: grade mensal ou semanal; cada peca abre a aprovacao dela. Em tela estreita vira lista por dia. */
export function CalendarioDoPortal({ itens, token }: Props) {
  const [modo, setModo] = useState<'mes' | 'semana'>('mes');
  const [ancora, setAncora] = useState(() => new Date());

  const porDia = useMemo(() => {
    const m = new Map<string, ItemDoCalendario[]>();
    itens.forEach(i => m.set(i.date, [...(m.get(i.date) ?? []), i]));
    return m;
  }, [itens]);

  const inicio = modo === 'mes' ? startOfWeek(startOfMonth(ancora)) : startOfWeek(ancora);
  const fim = modo === 'mes' ? endOfWeek(endOfMonth(ancora)) : endOfWeek(ancora);
  const dias = eachDayOfInterval({ start: inicio, end: fim });
  const titulo = modo === 'mes'
    ? format(ancora, "MMMM 'de' yyyy", { locale: ptBR })
    : `${format(inicio, "d 'de' MMM", { locale: ptBR })} a ${format(fim, "d 'de' MMM", { locale: ptBR })}`;
  const mover = (n: number) => setAncora(a => (modo === 'mes' ? addMonths(a, n) : addWeeks(a, n)));

  const diasComPecas = dias.filter(d => (porDia.get(chave(d))?.length ?? 0) > 0 && (modo === 'semana' || isSameMonth(d, ancora)));
  const totalNoPeriodo = diasComPecas.reduce((n, d) => n + (porDia.get(chave(d))?.length ?? 0), 0);

  const linkDe = (i: ItemDoCalendario) => `/portal/${token}/aprovacao/${i.id}`;

  return (
    <section aria-label="Calendário de publicações" className="overflow-hidden rounded-2xl border bg-card shadow-sm">
      <header className="flex flex-wrap items-center gap-3 border-b px-4 py-3">
        <h2 className="flex items-center gap-2 text-[15px] font-bold">
          <CalendarDays className="h-4 w-4 text-primary" /> Calendário de publicações
        </h2>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg bg-muted p-0.5 text-xs font-semibold" role="group" aria-label="Visualização">
            {(['mes', 'semana'] as const).map(m => (
              <button
                key={m}
                type="button"
                aria-pressed={modo === m}
                onClick={() => setModo(m)}
                className={cn('rounded-md px-3 py-1.5 transition-colors', modo === m ? 'bg-card shadow-sm' : 'text-muted-foreground hover:text-foreground')}
              >
                {m === 'mes' ? 'Mês' : 'Semana'}
              </button>
            ))}
          </div>
          <div className="inline-flex items-center gap-1">
            <button type="button" aria-label="Anterior" onClick={() => mover(-1)} className="flex h-8 w-8 items-center justify-center rounded-lg border hover:bg-muted">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button type="button" onClick={() => setAncora(new Date())} className="h-8 rounded-lg border px-3 text-xs font-semibold hover:bg-muted">
              Hoje
            </button>
            <button type="button" aria-label="Próximo" onClick={() => mover(1)} className="flex h-8 w-8 items-center justify-center rounded-lg border hover:bg-muted">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
        <p className="w-full text-sm font-semibold first-letter:uppercase" aria-live="polite">{titulo}</p>
      </header>

      {/* Grade (telas largas) */}
      <div className="hidden sm:block">
        <div className="grid grid-cols-7 border-b bg-muted/30 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {DIAS_CURTOS.map(d => <div key={d} className="py-2">{d}</div>)}
        </div>
        <div className="grid grid-cols-7">
          {dias.map((d, idx) => {
            const doMes = modo === 'semana' || isSameMonth(d, ancora);
            const lista = porDia.get(chave(d)) ?? [];
            const limite = modo === 'semana' ? 12 : 3;
            return (
              <div
                key={chave(d)}
                className={cn(
                  'flex flex-col gap-1 border-b border-r p-1.5',
                  modo === 'mes' ? 'min-h-[120px]' : 'min-h-[220px]',
                  (idx + 1) % 7 === 0 && 'border-r-0',
                  !doMes && 'bg-muted/20',
                )}
              >
                <span
                  className={cn(
                    'ml-auto flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-xs tabular-nums',
                    isToday(d) ? 'bg-primary font-bold text-primary-foreground' : doMes ? 'font-medium text-foreground' : 'text-muted-foreground/60',
                  )}
                >
                  {format(d, 'd')}
                </span>
                {lista.slice(0, limite).map(i => (
                  <Link
                    key={i.id}
                    to={linkDe(i)}
                    title={`${i.title} · ${SITUACAO[i.situation].rotulo}`}
                    className={cn('block rounded-md px-1.5 py-1 text-[11px] font-medium leading-tight ring-1 ring-inset transition-shadow hover:shadow', SITUACAO[i.situation].chip)}
                  >
                    <span className="flex items-center gap-1">
                      <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', SITUACAO[i.situation].ponto)} aria-hidden />
                      <span className={cn(modo === 'semana' ? 'line-clamp-3' : 'line-clamp-2')}>{i.title}</span>
                    </span>
                    {modo === 'semana' && (
                      <span className="mt-0.5 block truncate pl-2.5 text-[10px] opacity-75">
                        {[TIPOS[i.type ?? ''] ?? null, i.platform].filter(Boolean).join(' · ') || SITUACAO[i.situation].rotulo}
                      </span>
                    )}
                  </Link>
                ))}
                {lista.length > limite && <span className="px-1 text-[10px] font-semibold text-muted-foreground">+{lista.length - limite} peças</span>}
              </div>
            );
          })}
        </div>
      </div>

      {/* Lista por dia (celular) */}
      <div className="sm:hidden">
        {diasComPecas.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">Nenhuma peça com data neste período.</p>
        ) : (
          <ul className="divide-y">
            {diasComPecas.map(d => (
              <li key={chave(d)} className="px-4 py-3">
                <p className={cn('text-xs font-semibold first-letter:uppercase', isToday(d) ? 'text-primary' : 'text-muted-foreground')}>
                  {format(d, "EEEE, d 'de' MMM", { locale: ptBR })}{isToday(d) ? ' · hoje' : ''}
                </p>
                <ul className="mt-2 space-y-1.5">
                  {(porDia.get(chave(d)) ?? []).map(i => (
                    <li key={i.id}>
                      <Link to={linkDe(i)} className={cn('flex items-center gap-2.5 rounded-xl px-3 py-2.5 ring-1 ring-inset', SITUACAO[i.situation].chip)}>
                        <span className={cn('h-2 w-2 shrink-0 rounded-full', SITUACAO[i.situation].ponto)} aria-hidden />
                        <span className="min-w-0 flex-1">
                          <span className="line-clamp-2 block text-sm font-semibold leading-snug">{i.title}</span>
                          <span className="block truncate text-xs opacity-75">
                            {[TIPOS[i.type ?? ''] ?? null, i.platform].filter(Boolean).join(' · ') || 'Peça'} · {SITUACAO[i.situation].rotulo}
                          </span>
                        </span>
                        <ChevronRight className="h-4 w-4 shrink-0 opacity-60" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </div>

      <footer className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t bg-muted/20 px-4 py-2.5 text-[11px] text-muted-foreground">
        {(Object.keys(SITUACAO) as ItemDoCalendario['situation'][]).map(k => (
          <span key={k} className="inline-flex items-center gap-1.5">
            <span className={cn('h-2 w-2 rounded-full', SITUACAO[k].ponto)} aria-hidden /> {SITUACAO[k].rotulo}
          </span>
        ))}
        <span className="ml-auto tabular-nums">{totalNoPeriodo} {totalNoPeriodo === 1 ? 'peça' : 'peças'} no período</span>
      </footer>
    </section>
  );
}
