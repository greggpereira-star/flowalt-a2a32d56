import React, { forwardRef } from 'react';
import { CardResourceTabs } from './CardResourceTabs';

export interface CardToolsSectionProps {
  cardId: string;
  clientId: string | null;
  activeTab: string;
  onTabChange: (value: string) => void;
  checklistCompleted: number;
  checklistTotal: number;
  attachmentsCount: number;
  hasSocialPublish: boolean;
  socialPostsCount: number;
}

/**
 * CardToolsSection
 * ------------------------------------------------------------------
 * Standardised "Ferramentas da demanda" section.
 *
 * Why a dedicated component:
 *  - Guarantees the same render order (header → tabs) wherever the
 *    section is mounted, so inline action handlers in the parent
 *    always target a stable layout.
 *  - Keeps responsive markup (px / py / scroll-mt) in a single place
 *    so we don't reintroduce layout drift when the modal is reused.
 *  - Provides a single ref target for scroll-into-view behaviour.
 */
export const CardToolsSection = forwardRef<HTMLDivElement, CardToolsSectionProps>(
  (
    {
      cardId,
      clientId,
      activeTab,
      onTabChange,
      checklistCompleted,
      checklistTotal,
      attachmentsCount,
      hasSocialPublish,
      socialPostsCount,
    },
    ref,
  ) => {
    return (
      <section
        ref={ref}
        data-testid="card-tools-section"
        aria-label="Ferramentas da demanda"
        className="pt-4 scroll-mt-4"
      >
        <header className="flex items-center gap-2 px-1 mb-2">
          <span className="h-3 w-[3px] rounded-full bg-primary" aria-hidden />
          <p className="text-[11px] font-semibold text-foreground uppercase tracking-wider">
            Ferramentas da demanda
          </p>
          <div
            className="flex-1 h-px bg-gradient-to-r from-border via-border/60 to-transparent ml-2"
            aria-hidden
          />
        </header>

        <CardResourceTabs
          value={activeTab}
          onValueChange={onTabChange}
          cardId={cardId}
          clientId={clientId}
          checklistCompleted={checklistCompleted}
          checklistTotal={checklistTotal}
          attachmentsCount={attachmentsCount}
          hasSocialPublish={hasSocialPublish}
          socialPostsCount={socialPostsCount}
        />
      </section>
    );
  },
);
CardToolsSection.displayName = 'CardToolsSection';
