import React from 'react';
import { cn } from '@/lib/utils';

interface SectionHeaderProps {
  title: string;
  /** Tailwind color class for the leading accent bar (e.g. "bg-primary"). */
  accent?: string;
  /** Optional right-side controls (buttons, toggles, counts). */
  actions?: React.ReactNode;
  className?: string;
}

/**
 * SectionHeader
 * ----------------------------------------------------------------------------
 * Single source of truth for section titles inside the card detail view.
 * Standardizes:
 *  - Type scale: 11px uppercase, semibold, wide tracking
 *  - Leading accent bar (3px) + gradient divider
 *  - Bottom margin (mb-3) so siblings line up
 *
 * Pair with the `card-section` spacing class (see index.css) to keep vertical
 * rhythm between sections consistent.
 */
export const SectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  accent = 'bg-muted-foreground/40',
  actions,
  className,
}) => {
  return (
    <header className={cn('flex items-center gap-2 px-1 mb-3', className)}>
      <span className={cn('h-3 w-[3px] rounded-full', accent)} aria-hidden />
      <p className="text-[11px] font-semibold text-foreground uppercase tracking-wider">
        {title}
      </p>
      <div
        className="flex-1 h-px bg-gradient-to-r from-border via-border/60 to-transparent ml-2"
        aria-hidden
      />
      {actions && <div className="flex items-center gap-1.5 shrink-0">{actions}</div>}
    </header>
  );
};
