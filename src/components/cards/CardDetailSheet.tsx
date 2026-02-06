import React, { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import * as VisuallyHidden from '@radix-ui/react-visually-hidden';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  CardDetailHeader,
  CardPropertiesPanel,
  CardDescriptionSection,
  CardActivityPanel,
} from './card-detail';
import { BriefingDialog } from './BriefingDialog';
import type { BriefingData } from './BriefingForm';
import { TrafficBriefingForm, type TrafficBriefingData } from './TrafficBriefingForm';
import { ChecklistPanel } from './ChecklistPanel';
import { TimeTrackingPanel } from './TimeTrackingPanel';
import { AttachmentsPanel } from './AttachmentsPanel';
import { CardExecutionAssistantWrapper } from './CardExecutionAssistantWrapper';
import { TagManagerWrapper } from './TagManagerWrapper';
import { CardFinancialTab } from './CardFinancialTab';
import { CardKitTab } from './CardKitTab';
import { CardInvitePanel } from './CardInvitePanel';
import { AccessDeniedState, DestructiveActionGuard } from '@/components/governance';
import { SocialMediaCardFields } from '@/components/social-media/SocialMediaCardFields';
import { SocialPostButton } from '@/components/social-media/SocialPostButton';
import { useSocialPostsByCard } from '@/hooks/useSocialPosts';
import { useEntitlementRegistry } from '@/hooks/useEntitlementRegistry';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/contexts/AuthContext';
import {
  FileText,
  CheckSquare,
  Clock,
  Truck,
  Loader2,
  Paperclip,
  Sparkles,
  ChevronRight,
  User,
  Target,
  AlertCircle,
  CheckCircle2,
  DollarSign,
  UserPlus,
  Package,
  Share2,
} from 'lucide-react';
import { format, isPast, isToday, isTomorrow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useCard, useUpdateCard, useDeleteCard, type Card } from '@/hooks/useCards';
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
  const [activeTab, setActiveTab] = useState('details');

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

  // Calculate blocking cards
  const blockingCards = cardDependencies?.blocking
    ?.filter(dep => dep.blocking_card?.status !== 'delivered')
    ?.map(dep => ({ 
      id: dep.blocking_card?.id || '', 
      title: dep.blocking_card?.title || '' 
    }))
    .filter(c => c.id) || [];

  // Local state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<CardStatus>('backlog');
  const [urgency, setUrgency] = useState<CardUrgency>('medium');
  const [dueDate, setDueDate] = useState<Date | undefined>();
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

  // Sync state with card data
  useEffect(() => {
    if (card) {
      setTitle(card.title);
      setDescription(card.description || '');
      setStatus(card.status);
      setUrgency(card.urgency);
      setDueDate(card.due_date ? new Date(card.due_date) : undefined);
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

    const isQuickCard = (card as any).card_type === 'quick';
    
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
        className="max-w-6xl w-[95vw] h-[90vh] max-h-[900px] p-0 flex flex-col overflow-hidden bg-background"
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
            />

            {/* Main content with 2 panels */}
            <div className="flex-1 flex min-h-0">
              {/* Left Panel - Main content */}
              <div className="flex-1 flex flex-col min-w-0">
                <ScrollArea className="flex-1">
                  <div className="p-6 space-y-6">
                    {/* AI Suggestion Banner */}
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-gradient-to-r from-primary/5 to-primary/10 border border-primary/20">
                      <Sparkles className="h-4 w-4 text-primary flex-shrink-0" />
                      <p className="text-sm text-muted-foreground">
                        Peça à IA para{' '}
                        <button className="text-primary hover:underline font-medium">Escrever uma descrição</button>
                        {', '}
                        <button className="text-primary hover:underline font-medium">criar um resumo</button>
                        {' ou '}
                        <button className="text-primary hover:underline font-medium">encontrar tarefas semelhantes</button>
                      </p>
                    </div>

                    {/* Properties Grid */}
                    <CardPropertiesPanel
                      status={status}
                      urgency={urgency}
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

                    <Separator />

                    {/* Description Section */}
                    <CardDescriptionSection
                      description={description}
                      onChange={setDescription}
                      onSave={() => description !== card.description && handleSave({ description })}
                      isDirty={description !== card.description}
                    />

                    <Separator />

                    {/* Briefing Section - Compact Card */}
                    {(card as any).card_type !== 'quick' && (
                      <>
                        <div className="space-y-3">
                          <div className="flex items-center gap-2">
                            <div className={cn(
                              "p-1.5 rounded-lg",
                              card.briefing_completed 
                                ? "bg-success/10 text-success" 
                                : "bg-warning/10 text-warning"
                            )}>
                              <FileText className="h-4 w-4" />
                            </div>
                            <div className="flex-1">
                              <label className="text-sm font-semibold flex items-center gap-1.5">
                                Briefing do Projeto
                                {card.briefing_completed && (
                                  <Badge variant="secondary" className="text-[10px] h-5 bg-success/10 text-success border-success/20">
                                    <CheckCircle2 className="h-3 w-3 mr-1" />
                                    Validado
                                  </Badge>
                                )}
                              </label>
                              <p className="text-[11px] text-muted-foreground">
                                {card.briefing_completed 
                                  ? "Briefing aprovado pela IA" 
                                  : "Preencha informações para liberar o card"
                                }
                              </p>
                            </div>
                          </div>
                          
                          <button
                            onClick={() => setBriefingDialogOpen(true)}
                            className={cn(
                              "w-full rounded-xl border-2 p-4 transition-all hover:shadow-md text-left group",
                              card.briefing_completed 
                                ? "border-success/20 bg-success/5 hover:border-success/40" 
                                : "border-warning/30 bg-warning/5 hover:border-warning/50"
                            )}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                {card.briefing_completed ? (
                                  <CheckCircle2 className="h-5 w-5 text-success" />
                                ) : (
                                  <AlertCircle className="h-5 w-5 text-warning" />
                                )}
                                <div>
                                  <p className={cn(
                                    "font-medium text-sm",
                                    card.briefing_completed ? "text-success" : "text-warning"
                                  )}>
                                    {card.briefing_completed ? "Briefing Completo" : "Completar Briefing"}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {card.briefing_completed 
                                      ? "Clique para visualizar ou editar"
                                      : "6 campos • 2 obrigatórios"
                                    }
                                  </p>
                                </div>
                              </div>
                              <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
                            </div>
                            
                            {(briefingData.context || briefingData.deliverables) && (
                              <div className="mt-3 pt-3 border-t border-border/50 flex gap-2 flex-wrap">
                                {briefingData.context && (
                                  <Badge variant="outline" className="text-[10px] h-5 gap-1">
                                    <FileText className="h-2.5 w-2.5" />
                                    Contexto
                                  </Badge>
                                )}
                                {briefingData.target_audience && (
                                  <Badge variant="outline" className="text-[10px] h-5 gap-1">
                                    <User className="h-2.5 w-2.5" />
                                    Público
                                  </Badge>
                                )}
                                {briefingData.deliverables && (
                                  <Badge variant="outline" className="text-[10px] h-5 gap-1">
                                    <Target className="h-2.5 w-2.5" />
                                    Entregáveis
                                  </Badge>
                                )}
                              </div>
                            )}
                          </button>
                        </div>

                        <Separator />
                      </>
                    )}

                    {/* Traffic Briefing (conditional) */}
                    {isTrafficSpace && (
                      <>
                        <div className="space-y-3">
                          <div className="flex items-center gap-2">
                            <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
                              <Truck className="h-4 w-4" />
                            </div>
                            <div>
                              <label className="text-sm font-semibold">Briefing de Tráfego</label>
                              <p className="text-[11px] text-muted-foreground">
                                Configurações específicas de mídia paga
                              </p>
                            </div>
                          </div>
                          <div className="rounded-xl border-2 border-primary/20 bg-primary/5 p-4">
                            <TrafficBriefingForm
                              data={trafficBriefingData}
                              onChange={setTrafficBriefingData}
                            />
                          </div>
                        </div>
                        <Separator />
                      </>
                    )}

                    {/* Social Media Custom Fields */}
                    {isSocialMediaSpace && cardId && (
                      <>
                        <SocialMediaCardFields cardId={cardId} spaceType="social_media" />
                        <Separator />
                      </>
                    )}

                    {/* Resources Tabs */}
                    <Tabs value={activeTab} onValueChange={setActiveTab}>
                      <TabsList className="w-full h-auto bg-transparent p-0 flex gap-1 justify-start">
                        <TabsTrigger
                          value="details"
                          className="h-8 px-3 text-xs data-[state=active]:bg-muted"
                        >
                          <Target className="h-3.5 w-3.5 mr-1.5" />
                          Tags
                        </TabsTrigger>
                        <TabsTrigger
                          value="checklist"
                          className="h-8 px-3 text-xs data-[state=active]:bg-muted relative"
                        >
                          <CheckSquare className="h-3.5 w-3.5 mr-1.5" />
                          Tarefas
                          {checklistTotal > 0 && (
                            <Badge variant="secondary" className="ml-1.5 h-4 px-1 text-[10px]">
                              {checklistCompleted}/{checklistTotal}
                            </Badge>
                          )}
                        </TabsTrigger>
                        <TabsTrigger
                          value="time"
                          className="h-8 px-3 text-xs data-[state=active]:bg-muted"
                        >
                          <Clock className="h-3.5 w-3.5 mr-1.5" />
                          Tempo
                        </TabsTrigger>
                        <TabsTrigger
                          value="attachments"
                          className="h-8 px-3 text-xs data-[state=active]:bg-muted relative"
                        >
                          <Paperclip className="h-3.5 w-3.5 mr-1.5" />
                          Arquivos
                          {attachmentsCount > 0 && (
                            <Badge variant="secondary" className="ml-1.5 h-4 px-1 text-[10px]">
                              {attachmentsCount}
                            </Badge>
                          )}
                        </TabsTrigger>
                        <TabsTrigger
                          value="financial"
                          className="h-8 px-3 text-xs data-[state=active]:bg-muted"
                        >
                          <DollarSign className="h-3.5 w-3.5 mr-1.5" />
                          Financeiro
                        </TabsTrigger>
                        <TabsTrigger
                          value="kit"
                          className="h-8 px-3 text-xs data-[state=active]:bg-muted"
                        >
                          <Package className="h-3.5 w-3.5 mr-1.5" />
                          Kit
                        </TabsTrigger>
                        <TabsTrigger
                          value="invites"
                          className="h-8 px-3 text-xs data-[state=active]:bg-muted"
                        >
                          <UserPlus className="h-3.5 w-3.5 mr-1.5" />
                          Convites
                        </TabsTrigger>
                        <TabsTrigger
                          value="assistant"
                          className="h-8 px-3 text-xs data-[state=active]:bg-muted"
                        >
                          <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                          IA
                        </TabsTrigger>
                        {hasSocialPublish && (
                          <TabsTrigger
                            value="social"
                            className="h-8 px-3 text-xs data-[state=active]:bg-muted"
                          >
                            <Share2 className="h-3.5 w-3.5 mr-1.5" />
                            Social
                          </TabsTrigger>
                        )}
                      </TabsList>

                      <div className="mt-4">
                        <TabsContent value="details" className="m-0">
                          <TagManagerWrapper cardId={card.id} />
                        </TabsContent>
                        <TabsContent value="checklist" className="m-0">
                          <ChecklistPanel cardId={card.id} />
                        </TabsContent>
                        <TabsContent value="time" className="m-0">
                          <TimeTrackingPanel cardId={card.id} />
                        </TabsContent>
                        <TabsContent value="attachments" className="m-0">
                          <AttachmentsPanel cardId={card.id} />
                        </TabsContent>
                        <TabsContent value="financial" className="m-0">
                          <CardFinancialTab cardId={card.id} />
                        </TabsContent>
                        <TabsContent value="kit" className="m-0">
                          <CardKitTab cardId={card.id} />
                        </TabsContent>
                        <TabsContent value="invites" className="m-0">
                          <CardInvitePanel cardId={card.id} />
                        </TabsContent>
                        <TabsContent value="assistant" className="m-0">
                          <CardExecutionAssistantWrapper cardId={card.id} />
                        </TabsContent>
                        {hasSocialPublish && (
                          <TabsContent value="social" className="m-0">
                            <div className="space-y-4">
                              <div className="flex items-center justify-between">
                                <h3 className="text-sm font-medium">Postagens Social Media</h3>
                                <SocialPostButton cardId={card.id} clientId={card.client_id} />
                              </div>
                              {socialPostsCount > 0 ? (
                                <div className="text-sm text-muted-foreground">
                                  {socialPostsCount} postagem(ns) vinculada(s) a este card
                                </div>
                              ) : (
                                <div className="text-center py-8 text-muted-foreground">
                                  <Share2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                  <p>Nenhuma postagem criada</p>
                                  <p className="text-xs mt-1">Clique em "Gerar Postagem" para criar</p>
                                </div>
                              )}
                            </div>
                          </TabsContent>
                        )}
                      </div>
                    </Tabs>
                  </div>
                </ScrollArea>
              </div>

              {/* Right Panel - Activity/Comments */}
              <div className="w-80 border-l flex-shrink-0 hidden lg:flex">
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
