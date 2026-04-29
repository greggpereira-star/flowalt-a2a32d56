/**
 * Centralised style tokens for property badges/triggers used across the
 * task detail modal (Status, Prioridade, Urgência…).
 *
 * Goals:
 *  - Always render on a single line (no wrapping at any viewport).
 *  - Shrink-to-fit width — never inherit a row width that forces ellipsis.
 *  - Consistent paddings/heights so different field rows align visually.
 *  - Works inside Radix `SelectTrigger` (which wraps the value in a
 *    nested <span>), hence the `[&>span]:` modifiers.
 */

export const PROPERTY_BADGE_BASE =
  'inline-flex items-center gap-1 whitespace-nowrap leading-none';

export const PROPERTY_TRIGGER_BASE =
  // size + reset
  'h-7 w-auto min-w-fit max-w-full border-none bg-transparent shadow-none px-2 text-sm gap-1.5 ' +
  // hover affordance
  'hover:bg-muted/50 ' +
  // never wrap, even when parent row is narrow
  'whitespace-nowrap ' +
  // Radix nests the value inside a <span> — make it behave like a flex item
  // and forbid wrapping there too. Also prevent the chevron from being
  // squeezed away.
  '[&>span]:flex [&>span]:items-center [&>span]:whitespace-nowrap [&>span]:min-w-0 ' +
  '[&_svg]:flex-shrink-0';
