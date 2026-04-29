import React, { useState } from 'react';
import {
  CheckSquare,
  Clock,
  Paperclip,
  Sparkles,
  DollarSign,
  Package,
  UserPlus,
  Share2,
  Tags,
  ChevronDown,
  Plus,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChecklistPanel } from '../ChecklistPanel';
import { TimeTrackingPanel } from '../TimeTrackingPanel';
import { AttachmentsPanel } from '../AttachmentsPanel';
import { CardExecutionAssistantWrapper } from '../CardExecutionAssistantWrapper';
import { TagManagerWrapper } from '../TagManagerWrapper';
import { CardFinancialTab } from '../CardFinancialTab';
import { CardKitTab } from '../CardKitTab';
import { CardInvitePanel } from '../CardInvitePanel';
import { SocialPostButton } from '@/components/social-media/SocialPostButton';

export interface CardToolsStackProps {
  cardId: string;
  clientId: string | null;
  checklistCompleted: number;
  checklistTotal: number;
  attachmentsCount: number;
  hasSocialPublish: boolean;
  socialPostsCount: number;
  /** Optional ids that should start expanded (deep-link from inline actions). */
  forceOpenId?: string | null;
}

type SectionId =
  | 'checklist'
  | 'tags'
  | 'time'
  | 'attachments'
  | 'financial'
  | 'kit'
  | 'invites'
  | 'assistant'
  | 'social';

interface SectionDef {
  id: SectionId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: string; // tailwind text color class for the icon
  defaultOpen: boolean;
  count?: number | string | null;
  hidden?: boolean;
}

/**
 * CardToolsStack
 * ------------------------------------------------------------------
 * ClickUp-style stacked sections. Every tool is mounted (or at least
 * collapsible) so the user always sees what exists on the card without
 * hopping between tabs. Sections with content default to expanded, the
 * rest stay collapsed to keep the modal scannable.
 */
export const CardToolsStack = React.forwardRef<HTMLDivElement, CardToolsStackProps>(
  (
    {
      cardId,
      clientId,
      checklistCompleted,
      checklistTotal,
      attachmentsCount,
      hasSocialPublish,
      socialPostsCount,
      forceOpenId,
    },
    ref,
  ) => {
    const sections: SectionDef[] = [
      {
        id: 'checklist',
        label: 'Tarefas & Checklist',
        icon: CheckSquare,
        accent: 'text-emerald-500',
        defaultOpen: true,
        count: checklistTotal > 0 ? `${checklistCompleted}/${checklistTotal}` : null,
      },
      {
        id: 'attachments',
        label: 'Arquivos & Anexos',
        icon: Paperclip,
        accent: 'text-amber-500',
        defaultOpen: true,
        count: attachmentsCount > 0 ? attachmentsCount : null,
      },
      {
        id: 'tags',
        label: 'Tags',
        icon: Tags,
        accent: 'text-violet-500',
        defaultOpen: false,
      },
      {
        id: 'time',
        label: 'Tempo trabalhado',
        icon: Clock,
        accent: 'text-blue-500',
        defaultOpen: false,
      },
      {
        id: 'financial',
        label: 'Financeiro',
        icon: DollarSign,
        accent: 'text-green-500',
        defaultOpen: false,
      },
      {
        id: 'kit',
        label: 'Equipamentos',
        icon: Package,
        accent: 'text-orange-500',
        defaultOpen: false,
      },
      {
        id: 'invites',
        label: 'Convites & Vínculos',
        icon: UserPlus,
        accent: 'text-pink-500',
        defaultOpen: false,
      },
      {
        id: 'assistant',
        label: 'Assistente IA',
        icon: Sparkles,
        accent: 'text-primary',
        defaultOpen: false,
      },
      {
        id: 'social',
        label: 'Social Media',
        icon: Share2,
        accent: 'text-fuchsia-500',
        defaultOpen: socialPostsCount > 0,
        count: socialPostsCount > 0 ? socialPostsCount : null,
        hidden: !hasSocialPublish,
      },
    ];

    const [openMap, setOpenMap] = useState<Record<string, boolean>>(() => {
      const initial: Record<string, boolean> = {};
      sections.forEach((s) => {
        if (!s.hidden) initial[s.id] = s.defaultOpen;
      });
      return initial;
    });

    // Honor deep-link requests (e.g. inline action "Adicionar subtarefa")
    React.useEffect(() => {
      if (!forceOpenId) return;
      setOpenMap((prev) => ({ ...prev, [forceOpenId]: true }));
    }, [forceOpenId]);

    const toggle = (id: string) =>
      setOpenMap((prev) => ({ ...prev, [id]: !prev[id] }));

    const renderBody = (id: SectionId) => {
      switch (id) {
        case 'checklist':
          return <ChecklistPanel cardId={cardId} />;
        case 'tags':
          return <TagManagerWrapper cardId={cardId} />;
        case 'time':
          return <TimeTrackingPanel cardId={cardId} />;
        case 'attachments':
          return <AttachmentsPanel cardId={cardId} />;
        case 'financial':
          return <CardFinancialTab cardId={cardId} />;
        case 'kit':
          return <CardKitTab cardId={cardId} />;
        case 'invites':
          return <CardInvitePanel cardId={cardId} />;
        case 'assistant':
          return <CardExecutionAssistantWrapper cardId={cardId} />;
        case 'social':
          return (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  {socialPostsCount > 0
                    ? `${socialPostsCount} postagem(ns) vinculada(s)`
                    : 'Nenhuma postagem criada ainda'}
                </p>
                <SocialPostButton cardId={cardId} clientId={clientId} />
              </div>
            </div>
          );
        default:
          return null;
      }
    };

    return (
      <section
        ref={ref}
        data-testid="card-tools-stack"
        aria-label="Ferramentas da demanda"
        className="pt-4 scroll-mt-4"
      >
        {/* Section meta header */}
        <header className="flex items-center gap-2 px-1 mb-3">
          <span className="h-3 w-[3px] rounded-full bg-primary" aria-hidden />
          <p className="text-[11px] font-semibold text-foreground uppercase tracking-wider">
            Ferramentas da demanda
          </p>
          <div
            className="flex-1 h-px bg-gradient-to-r from-border via-border/60 to-transparent ml-2"
            aria-hidden
          />
          <button
            type="button"
            onClick={() => {
              const allOpen = sections
                .filter((s) => !s.hidden)
                .every((s) => openMap[s.id]);
              const next: Record<string, boolean> = {};
              sections.forEach((s) => {
                if (!s.hidden) next[s.id] = !allOpen;
              });
              setOpenMap(next);
            }}
            className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
          >
            {sections.filter((s) => !s.hidden).every((s) => openMap[s.id])
              ? 'Recolher tudo'
              : 'Expandir tudo'}
          </button>
        </header>

        <div className="space-y-2">
          {sections
            .filter((s) => !s.hidden)
            .map((section) => {
              const Icon = section.icon;
              const isOpen = !!openMap[section.id];
              return (
                <div
                  key={section.id}
                  data-section-id={section.id}
                  className={cn(
                    'rounded-lg border border-border/60 bg-card transition-colors',
                    isOpen ? 'shadow-[0_1px_0_0_hsl(var(--border)/0.6)]' : 'hover:bg-muted/30',
                  )}
                >
                  <button
                    type="button"
                    onClick={() => toggle(section.id)}
                    aria-expanded={isOpen}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left group"
                  >
                    <ChevronDown
                      className={cn(
                        'h-3.5 w-3.5 text-muted-foreground transition-transform shrink-0',
                        isOpen ? 'rotate-0' : '-rotate-90',
                      )}
                    />
                    <Icon className={cn('h-3.5 w-3.5 shrink-0', section.accent)} />
                    <span className="text-[13px] font-semibold text-foreground tracking-tight">
                      {section.label}
                    </span>
                    {section.count != null && (
                      <Badge
                        variant="secondary"
                        className="ml-1 h-5 px-1.5 text-[10px] bg-muted text-muted-foreground font-medium"
                      >
                        {section.count}
                      </Badge>
                    )}
                  </button>

                  {isOpen && (
                    <div className="px-3 pb-3 pt-1 border-t border-border/40">
                      {renderBody(section.id)}
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      </section>
    );
  },
);
CardToolsStack.displayName = 'CardToolsStack';
