import { cn } from '@/lib/utils';
import { EVENT_TYPE_ORDER, EVENT_TYPE_STYLES } from '@/lib/agenda/eventTypes';

/**
 * Legenda das cores por tipo de evento.
 *
 * Cor sem legenda só funciona depois que a pessoa decora — e quem entra novo no
 * time nunca decora. Aqui a associação fica visível o tempo todo, ao custo de
 * uma linha discreta no topo.
 *
 * Mostra ícone junto da cor porque a categoria não pode depender só do matiz:
 * quem não distingue certas cores lê pelo símbolo.
 */
export function EventTypeLegend({ className }: { className?: string }) {
  return (
    <ul
      className={cn('flex flex-wrap items-center gap-x-3 gap-y-1.5', className)}
      aria-label="Legenda de tipos de evento"
    >
      {EVENT_TYPE_ORDER.map((type) => {
        const style = EVENT_TYPE_STYLES[type];
        const Icon = style.icon;

        return (
          <li key={type} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className={cn('h-2 w-2 rounded-full', style.accent)} aria-hidden="true" />
            <Icon className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
            {style.label}
          </li>
        );
      })}
    </ul>
  );
}
