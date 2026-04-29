import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import * as VisuallyHidden from '@radix-ui/react-visually-hidden';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  CardDetailHeader,
  CardPropertiesPanel,
  CardDescriptionSection,
  CardActivityPanel,
  CardBriefingSection,
  CardToolsStack,
  InlineTimerWidget,
  AIBar,
  SectionHeader,
} from './card-detail';
import { BriefingDialog } from './BriefingDialog';
import type { BriefingData } from './BriefingForm';
import { TrafficBriefingForm, type TrafficBriefingData } from './TrafficBriefingForm';
import { AccessDeniedState, DestructiveActionGuard } from '@/components/governance';
import { SocialMediaCardFields } from '@/components/social-media/SocialMediaCardFields';
import { useSocialPostsByCard } from '@/hooks/useSocialPosts';
import { useEntitlementRegistry } from '@/hooks/useEntitlementRegistry';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/contexts/AuthContext';
import { Truck, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCard, useUpdateCard, useDeleteCard } from '@/hooks/useCards';
import { useSpace } from '@/hooks/useSpaces';
import { useChecklists } from '@/hooks/useChecklists';
import { useComments } from '@/hooks/useComments';
import { useAttachments } from '@/hooks/useAttachments';
import { useTimeEntries } from '@/hooks/useTimeEntries';
import { useCardDependencies } from '@/hooks/useDependencies';
import { useClients } from '@/hooks/useClients';
import { useClientCards } from '@/hooks/useClientCards';
import type { CardStatus, CardUrgency } from '@/lib/supabase';
import { toast } from 'sonner';

interface CardDetailSheetProps {
  cardId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const CardDetailSheet: React.FC<CardDetailSheetProps> = ({
  cardId,
  open,
  onOpenChange,
}) => {
  const { data: card, isLoading } = useCard(cardId || undefined);
  const { data: space } = useSpace(card?.space_id);
  const { data: checklists } = useChecklists(cardId || undefined);
  const { data: comments } = useComments(cardId || undefined);
  const { data: attachments } = useAttachments(cardId || undefined);
  const { data: timeEntries } = useTimeEntries(cardId || undefined);
  const { data: cardDependencies } = useCardDependencies(cardId || undefined);
  const { data: legacyClients } = useClients();
  const { data: clientCards } = useClientCards();
  const { data: socialPosts } = useSocialPostsByCard(cardId);
  const { has } = useEntitlementRegistry();
  const { isOwner, isAdmin, isCoordinator, canDeleteCards } = usePermissions();
  const { user } = useAuth();
  const updateCard = useUpdateCard();
  const deleteCard = useDeleteCard();

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [briefingDialogOpen, setBriefingDialogOpen] = useState(false);
  const [activeResourceTab, setActiveResourceTab] = useState<string>('checklist');
  const resourceTabsRef = useRef<HTMLDivElement>(null);
  const didMountRef = useRef(false);

  /**
   * Reset session-bound UI state whenever the modal switches to a different
   * card (or is closed). Without this, reopening the modal could surface the
   * previous card's active tool tab and leave stale handlers wired to the
   * old card id.
   */
  useEffect(() => {
    setActiveResourceTab('checklist');
    setBriefingDialogOpen(false);
    setDeleteDialogOpen(false);
    didMountRef.current = false; // skip the next auto-scroll for the new card
  }, [cardId, open]);

  /**
   * Scroll the tools section into view reliably, including on small screens
   * where the Radix ScrollArea owns the overflow. We resolve the scroll
   * container by walking up from the section ref so we don't depend on
   * private Radix selectors. Falls back to scrollIntoView if no container
   * is found.
   */
  const scrollToTools = useCallback(() => {
    requestAnimationFrame(() => {
      const node = resourceTabsRef.current;
      if (!node) return;

      const viewport = node.closest<HTMLElement>(
        '[data-radix-scroll-area-viewport]',
      );

      if (viewport) {
        const top = node.getBoundingClientRect().top
          - viewport.getBoundingClientRect().top
          + viewport.scrollTop
          - 8; // breathing room above the header
        viewport.scrollTo({ top, behavior: 'smooth' });
      } else {
        node.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }

      // Move focus into the section for keyboard / screen-reader users
      // without stealing it away from typing inputs.
      const active = document.activeElement as HTMLElement | null;
      const isTyping = active && (active.tagName === 'INPUT'
        || active.tagName === 'TEXTAREA'
        || active.isContentEditable);
      if (!isTyping) {
        node.setAttribute('tabindex', '-1');
        node.focus({ preventScroll: true });
      }
    });
  }, []);

  // Auto-scroll the tools section into view whenever the active tool tab
  // changes via user action (e.g. switching to "checklist" on small screens).
  // We intentionally skip the very first render so we don't yank the modal
  // when it opens.
  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }
    scrollToTools();
  }, [activeResourceTab, scrollToTools]);

  const hasSocialPublish = has('social_publish');
  const socialPostsCount = socialPosts?.length || 0;

  // Build combined clients list
  const allClients = useMemo(() => {
    const clients: Array<{ id: string; name: string; color: string | null }> = [];
    
    legacyClients?.forEach(c => {
      clients.push({ id: c.id, name: c.name, color: c.color });
    });
    
    clientCards?.forEach(c => {
      if (!clients.some(existing => existing.id === c.id)) {
        clients.push({ id: c.id, name: c.name, color: c.color || null });
      }
    });
    
    return clients.sort((a, b) => a.name.localeCompare(b.name));
  }, [legacyClients, clientCards]);

  // Local state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<CardStatus>('backlog');
  const [urgency, setUrgency] = useState<CardUrgency>('medium');
  const [dueDate, setDueDate] = useState<Date | undefined>();
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [estimatedHours, setEstimatedHours] = useState('');
  const [clientId, setClientId] = useState<string | null>(null);
  const [briefingData, setBriefingData] = useState<BriefingData>({
    context: '',
    target_audience: '',
    deliverables: '',
    references: '',
    deadline_notes: '',
    special_instructions: '',
  });
  const [trafficBriefingData, setTrafficBriefingData] = useState<TrafficBriefingData>({
    objective: '',
    platform: '',
    campaign_type: '',
    budget: '',
    audience_description: '',
    audience_age_min: '',
    audience_age_max: '',
    audience_gender: '',
    audience_interests: '',
    audience_locations: '',
    start_date: '',
    end_date: '',
    kpis: '',
    landing_page: '',
    pixel_events: '',
    additional_notes: '',
  });

  // Computed values
  const checklistCompleted = checklists?.filter(c => c.is_completed).length || 0;
  const checklistTotal = checklists?.length || 0;
  const commentsCount = comments?.length || 0;
  const attachmentsCount = attachments?.length || 0;
  const timeEntriesCount = timeEntries?.length || 0;
  const hasHistory = checklistTotal > 0 || commentsCount > 0 || attachmentsCount > 0 || timeEntriesCount > 0;
  const isCardCreator = card?.created_by === user?.id;
  const canDelete = isOwner || isAdmin || isCoordinator || canDeleteCards || isCardCreator;
  const isTrafficSpace = space?.type === 'traffic';
  const isSocialMediaSpace = space?.type === 'social_media';
  const isQuickCard = (card as any)?.card_type === 'quick';

  // Sync state with card data
  useEffect(() => {
    if (card) {
      setTitle(card.title);
      setDescription(card.description || '');
      setStatus(card.status);
      setUrgency(card.urgency);
      setDueDate(card.due_date ? new Date(card.due_date) : undefined);
      setStartDate((card as any).start_date ? new Date((card as any).start_date) : undefined);
      setEstimatedHours(card.estimated_hours?.toString() || '');
      setClientId(card.client_id);

      if (card.briefing_data && typeof card.briefing_data === 'object') {
        setBriefingData({
          context: (card.briefing_data as Record<string, string>).context || '',
          target_audience: (card.briefing_data as Record<string, string>).target_audience || '',
          deliverables: (card.briefing_data as Record<string, string>).deliverables || '',
          references: (card.briefing_data as Record<string, string>).references || '',
          deadline_notes: (card.briefing_data as Record<string, string>).deadline_notes || '',
          special_instructions: (card.briefing_data as Record<string, string>).special_instructions || '',
        });
      }

      if (card.traffic_briefing_data && typeof card.traffic_briefing_data === 'object' && !Array.isArray(card.traffic_briefing_data)) {
        const tbd = card.traffic_briefing_data as Record<string, string>;
        setTrafficBriefingData({
          objective: tbd.objective || '',
          platform: tbd.platform || '',
          campaign_type: tbd.campaign_type || '',
          budget: tbd.budget || '',
          audience_description: tbd.audience_description || '',
          audience_age_min: tbd.audience_age_min || '',
          audience_age_max: tbd.audience_age_max || '',
          audience_gender: tbd.audience_gender || '',
          audience_interests: tbd.audience_interests || '',
          audience_locations: tbd.audience_locations || '',
          start_date: tbd.start_date || '',
          end_date: tbd.end_date || '',
          kpis: tbd.kpis || '',
          landing_page: tbd.landing_page || '',
          pixel_events: tbd.pixel_events || '',
          additional_notes: tbd.additional_notes || '',
        });
      }
    }
  }, [card]);

  const handleSave = async (updates: Partial<{
    title: string;
    description: string;
    status: CardStatus;
    urgency: CardUrgency;
    start_date: string | null;
    due_date: string | null;
    estimated_hours: number | null;
    briefing_completed: boolean;
    briefing_data: BriefingData;
  }>) => {
    if (!card) return;

    try {
      await updateCard.mutateAsync({
        id: card.id,
        ...updates,
      });
    } catch (error) {
      toast.error('Erro ao salvar alterações');
    }
  };

  const handleBriefingDataChange = (newData: BriefingData) => {
    setBriefingData(newData);
    handleSave({ briefing_data: newData });
  };

  const handleStatusChange = async (newStatus: CardStatus) => {
    if (!card) return;

    if (!isQuickCard) {
      const briefingRequired = !card.briefing_completed;
      const advancingPastBriefing =
        ['in_progress', 'review', 'approved', 'delivered'].includes(newStatus) &&
        ['backlog', 'todo'].includes(status);

      if (briefingRequired && advancingPastBriefing) {
        toast.error('Complete o briefing antes de avançar o card');
        return;
      }
    }

    setStatus(newStatus);
    await handleSave({ status: newStatus });
  };

  const handleMarkBriefingComplete = async () => {
    if (!card) return;
    await handleSave({ briefing_completed: true });
    toast.success('Briefing marcado como completo');
  };

  const handleDelete = async () => {
    if (!card) return;
    try {
      await deleteCard.mutateAsync(card.id);
      toast.success(hasHistory ? 'Card arquivado' : 'Card excluído');
      onOpenChange(false);
    } catch (error) {
      toast.error('Erro ao excluir card');
    }
  };

  if (!cardId) return null;

  const isRestrictedNoAccess = !isLoading && !card;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent 
          className="max-w-[1320px] w-[95vw] h-[min(92vh,860px)] p-0 flex flex-col overflow-hidden bg-background gap-0 rounded-xl shadow-lg"
          hideCloseButton
        >
        <VisuallyHidden.Root>
          <DialogTitle>Detalhes do Card</DialogTitle>
        </VisuallyHidden.Root>

        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : isRestrictedNoAccess ? (
          <div className="flex-1 flex items-center justify-center p-6">
            <AccessDeniedState
              type="restricted_card"
              showHomeButton={false}
              showContactAdmin={true}
            />
          </div>
        ) : card ? (
          <div className="flex flex-col h-full">
            {/* Header */}
            <CardDetailHeader
              title={title}
              cardId={card.id}
              cardType={(card as any).card_type}
              onTitleChange={setTitle}
              onTitleBlur={() => title !== card.title && handleSave({ title })}
              onClose={() => onOpenChange(false)}
              onDelete={() => setDeleteDialogOpen(true)}
              canDelete={canDelete}
              hasHistory={hasHistory}
              createdAt={card.created_at}
              spaceName={space?.name}
            />

            {/* Main content with 2 panels */}
            <div className="flex-1 flex min-h-0">
              {/* Left Panel - Main content */}
              <div className="flex-1 flex flex-col min-w-0 border-r border-border/40">
                <ScrollArea className="flex-1">
                  <div className="px-6 py-4 space-y-1">
                    {/* AI Bar */}
                    <AIBar />

                    {/* Properties - ClickUp-style field rows */}
                    <CardPropertiesPanel
                      cardId={card.id}
                      status={status}
                      urgency={urgency}
                      startDate={startDate}
                      dueDate={dueDate}
                      estimatedHours={estimatedHours}
                      actualHours={card.actual_hours || 0}
                      clientId={clientId}
                      clients={allClients}
                      onStatusChange={handleStatusChange}
                      onUrgencyChange={(u) => {
                        setUrgency(u);
                        handleSave({ urgency: u });
                      }}
                      onStartDateChange={(date) => {
                        setStartDate(date);
                        handleSave({ start_date: date ? date.toISOString() : null });
                      }}
                      onDueDateChange={(date) => {
                        setDueDate(date);
                        handleSave({ due_date: date ? date.toISOString() : null });
                      }}
                      onEstimatedHoursChange={setEstimatedHours}
                      onEstimatedHoursBlur={() => {
                        const hours = parseFloat(estimatedHours) || null;
                        if (hours !== card.estimated_hours) {
                          handleSave({ estimated_hours: hours });
                        }
                      }}
                      onClientChange={(id) => {
                        setClientId(id);
                        updateCard.mutate({ id: card.id, client_id: id });
                      }}
                    />

                    {/* Timer - integrated as field row */}
                    <InlineTimerWidget cardId={card.id} />

                    {/* Divider */}
                    <div className="border-t border-border/30 my-4" />

                    {/* Briefing Section - Only for non-quick cards */}
                    {!isQuickCard && (
                      <div className="pt-1">
                        <CardBriefingSection
                          isCompleted={card.briefing_completed || false}
                          briefingData={briefingData}
                          onOpenBriefing={() => setBriefingDialogOpen(true)}
                        />
                      </div>
                    )}

                    {/* Traffic Briefing - Conditional */}
                    {isTrafficSpace && (
                      <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 mt-4">
                        <div className="flex items-center gap-2 mb-3">
                          <Truck className="h-4 w-4 text-primary" />
                          <h4 className="text-sm font-medium">Briefing de Tráfego</h4>
                        </div>
                        <TrafficBriefingForm
                          data={trafficBriefingData}
                          onChange={setTrafficBriefingData}
                        />
                      </div>
                    )}

                    {/* Social Media Fields - Conditional */}
                    {isSocialMediaSpace && cardId && (
                      <div className="mt-4">
                        <SocialMediaCardFields cardId={cardId} spaceType="social_media" />
                      </div>
                    )}

                    {/* Section: Content & Description (acima das ferramentas) */}
                    <section className="card-section">
                      <SectionHeader title="Conteúdo & Descrição" />
                      <CardDescriptionSection
                        description={description}
                        onChange={setDescription}
                        onSave={() => description !== card.description && handleSave({ description })}
                        isDirty={description !== card.description}
                      />
                    </section>

                    {/* Tools / Resources — stacked sections, ClickUp-style */}
                    <section className="card-section">
                      <CardToolsStack
                        ref={resourceTabsRef}
                        cardId={card.id}
                        clientId={card.client_id}
                        checklistCompleted={checklistCompleted}
                        checklistTotal={checklistTotal}
                        attachmentsCount={attachmentsCount}
                        hasSocialPublish={hasSocialPublish}
                        socialPostsCount={socialPostsCount}
                        forceOpenId={activeResourceTab}
                      />
                    </section>

                  </div>
                </ScrollArea>
              </div>

              {/* Right Panel - Activity */}
              <div className="w-[400px] xl:w-[440px] flex-shrink-0 hidden lg:flex border-l border-border/40 min-w-0">
                <CardActivityPanel cardId={card.id} />
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-muted-foreground">Card não encontrado</p>
          </div>
        )}
      </DialogContent>

      {/* Dialogs */}
      <BriefingDialog
        open={briefingDialogOpen}
        onOpenChange={setBriefingDialogOpen}
        data={briefingData}
        onChange={handleBriefingDataChange}
        isCompleted={card?.briefing_completed || false}
        onMarkComplete={handleMarkBriefingComplete}
        cardTitle={card?.title || ''}
      />

      {card && (
        <DestructiveActionGuard
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          entityType="card"
          entityId={card.id}
          entityName={card.title}
          createdBy={card.created_by}
          hasHistory={hasHistory}
          dependentItems={[
            ...(checklistTotal > 0 ? [{ type: 'checklist(s)', count: checklistTotal }] : []),
            ...(commentsCount > 0 ? [{ type: 'comentário(s)', count: commentsCount }] : []),
            ...(attachmentsCount > 0 ? [{ type: 'anexo(s)', count: attachmentsCount }] : []),
            ...(timeEntriesCount > 0 ? [{ type: 'entrada(s) de tempo', count: timeEntriesCount }] : []),
          ]}
          onConfirm={handleDelete}
        />
      )}
    </Dialog>
  );
};
