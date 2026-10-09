import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { Film, Grid3x3, Images, Play } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ItemDoCalendario } from '@/components/portal/CalendarioDoPortal';

const SITUACAO: Record<ItemDoCalendario['situation'], { rotulo: string; chip: string }> = {
  aguardando: { rotulo: 'Aguardando', chip: 'bg-amber-500 text-white' },
  ajustes: { rotulo: 'Ajustes', chip: 'bg-rose-500 text-white' },
  aprovado: { rotulo: 'Aprovado', chip: 'bg-emerald-600 text-white' },
  publicado: { rotulo: 'Publicado', chip: 'bg-violet-600 text-white' },
};

const dataLocal = (iso: string) => new Date(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));

interface Props {
  itens: ItemDoCalendario[];
  token: string;
  cliente: string;
  logoUrl: string | null;
}

/** Previa do feed: a grade do perfil do cliente, com os proximos posts no topo e os ja publicados depois. */
export function FeedDoPortal({ itens, token, cliente, logoUrl }: Props) {
  const hoje = useMemo(() => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }), []);
  // Mais novo primeiro, como o Instagram mostra: o que vem pela frente fica no topo da grade.
  const ordenados = useMemo(() => [...itens].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 48), [itens]);
  const futuros = itens.filter(i => i.date >= hoje && i.situation !== 'publicado').length;
  const publicados = itens.filter(i => i.situation === 'publicado').length;

  if (ordenados.length === 0) return null;

  return (
    <section aria-label="Prévia do feed" className="overflow-hidden rounded-2xl border bg-card shadow-sm">
      <header className="flex items-center gap-3 border-b px-4 py-3.5">
        {logoUrl ? (
          <img src={logoUrl} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover ring-1 ring-border sm:h-11 sm:w-11" />
        ) : (
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary sm:h-11 sm:w-11">{cliente.trim().charAt(0).toUpperCase() || '·'}</span>
        )}
        <div className="min-w-0 flex-1 leading-tight">
          <h2 className="flex items-center gap-2 whitespace-nowrap text-sm font-bold sm:text-[15px]"><Grid3x3 className="h-4 w-4 text-primary" aria-hidden /> Prévia do feed</h2>
          <p className="truncate text-xs text-muted-foreground">{cliente}</p>
        </div>
        <dl className="flex shrink-0 gap-3 text-center text-[11px] sm:gap-4 sm:text-xs">
          <div><dt className="text-muted-foreground">Próximos</dt><dd className="text-base font-bold tabular-nums">{futuros}</dd></div>
          <div><dt className="text-muted-foreground">Publicados</dt><dd className="text-base font-bold tabular-nums">{publicados}</dd></div>
        </dl>
      </header>

      <ul className="grid grid-cols-3 gap-0.5 bg-border p-0.5">
        {ordenados.map(i => {
          return (
            <li key={i.id} className="bg-card">
              <Link
                to={`/portal/${token}/aprovacao/${i.id}`}
                title={`${i.title} · ${i.situation === 'aguardando' ? 'Aguardando você' : SITUACAO[i.situation].rotulo}`}
                className="group relative block aspect-[4/5] overflow-hidden bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {i.thumb && i.media === 'image' && <img src={i.thumb} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />}
                {i.thumb && i.media === 'video' && <video src={`${i.thumb}#t=0.1`} muted playsInline preload="metadata" className="h-full w-full object-cover" />}
                {!i.thumb && (
                  <span className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/10 to-muted p-3 text-center text-[11px] font-semibold leading-snug text-muted-foreground">
                    <span className="line-clamp-4">{i.title}</span>
                  </span>
                )}

                {i.media === 'video' && <Play className="absolute right-1.5 top-1.5 h-4 w-4 fill-white text-white drop-shadow" aria-hidden />}
                {i.type === 'carousel' && <Images className="absolute right-1.5 top-1.5 h-4 w-4 text-white drop-shadow" aria-hidden />}
                {(i.type === 'reels' || i.type === 'video') && i.media !== 'video' && <Film className="absolute right-1.5 top-1.5 h-4 w-4 text-white drop-shadow" aria-hidden />}

                <span className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-gradient-to-t from-black/70 to-transparent px-1.5 pb-1.5 pt-6">
                  <span className={cn('whitespace-nowrap rounded px-1 py-0.5 text-[8px] font-bold uppercase tracking-wide sm:px-1.5 sm:text-[9px]', SITUACAO[i.situation].chip)}>{SITUACAO[i.situation].rotulo}</span>
                  <span className="whitespace-nowrap text-[10px] font-semibold tabular-nums text-white">{format(dataLocal(i.date), 'dd/MM')}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>

      <p className="border-t bg-muted/20 px-4 py-2.5 text-[11px] text-muted-foreground">
        Os próximos posts aparecem primeiro, como vão ficar no seu perfil. Toque em um para ver os detalhes e aprovar.
      </p>
    </section>
  );
}
