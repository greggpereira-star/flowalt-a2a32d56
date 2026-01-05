import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { useSpace } from '@/hooks/useSpaces';
import { useFolders, useCreateFolder, useUpdateFolder, useDeleteFolder } from '@/hooks/useFolders';
import { useCards, useCardsByFolder } from '@/hooks/useCards';
import { useRealtimeCards } from '@/hooks/useRealtimeCards';
import { useShortcutEvent } from '@/hooks/useGlobalShortcuts';
import { useSocialMediaTracking } from '@/hooks/useSocialMediaTracking';
import { KanbanBoard } from '@/components/cards/KanbanBoard';
import { KanbanAdvanced } from '@/components/cards/KanbanAdvanced';
import { ListView } from '@/components/cards/ListView';
import { CreateCardDialog } from '@/components/cards/CreateCardDialog';
import { DemandFormDialog } from '@/components/cards/DemandFormDialog';
import { QuickAddCard } from '@/components/cards/QuickAddCard';
import { CardDetailSheet } from '@/components/cards/CardDetailSheet';
import { WorkflowInitializer } from '@/components/workflow/WorkflowInitializer';
import { CreateFolderWithTemplateDialog } from '@/components/social-media/CreateFolderWithTemplateDialog';
import { ApprovalsPendingView } from '@/components/social-media/ApprovalsPendingView';
import { WeeklyChecklistView } from '@/components/social-media/WeeklyChecklistView';
import { IdeasBankView } from '@/components/social-media/IdeasBankView';
import { FiltersToolbar } from '@/components/filters';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Loader2,
  Plus,
  LayoutGrid,
  List,
  Calendar,
  FolderPlus,
  Search,
  Folder,
  Sparkles,
  X,
  Trash2,
  Pencil,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Card } from '@/hooks/useCards';
import type { CardStatus } from '@/lib/supabase';
import type { FilterQuery } from '@/hooks/useCardFilters';

type ViewType = 'kanban' | 'kanban-advanced' | 'list' | 'calendar' | 'approvals' | 'checklist' | 'ideas';

// Hook to fetch a specific folder view
function useFolderView(viewId: string | null) {
  return useQuery({
    queryKey: ['folder-view', viewId],
    queryFn: async () => {
      if (!viewId) return null;
      
      const { data, error } = await supabase
        .from('folder_views')
        .select('*, folders!inner(id, name, space_id)')
        .eq('id', viewId)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!viewId,
  });
}

const SpacePage: React.FC = () => {
  const { spaceId } = useParams<{ spaceId: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Get view ID from URL
  const activeViewId = searchParams.get('view');

  const { data: space, isLoading: spaceLoading } = useSpace(spaceId);
  const { data: folders, isLoading: foldersLoading } = useFolders(spaceId);
  const { data: activeView, isLoading: viewLoading } = useFolderView(activeViewId);
  const createFolder = useCreateFolder();
  const updateFolder = useUpdateFolder();
  const deleteFolder = useDeleteFolder();
  
  // Social media tracking
  const { trackEvent } = useSocialMediaTracking();

  // Determine active folder ID from view or manual selection
  const activeFolderId = activeView?.folder_id || null;

  // Fetch cards: folder-scoped when folder is active, space-scoped otherwise
  const { data: spaceCards, isLoading: spaceCardsLoading } = useCards(spaceId);
  const { data: folderCards, isLoading: folderCardsLoading } = useCardsByFolder(activeFolderId || undefined);

  // Use folder cards when folder is active, otherwise space cards
  const cards = activeFolderId ? folderCards : spaceCards;
  const cardsLoading = activeFolderId ? folderCardsLoading : spaceCardsLoading;

  // Track scope resolution
  useEffect(() => {
    if (cards !== undefined && spaceId) {
      trackEvent('social.cards.scope_resolved' as any, {
        space_id: spaceId,
        folder_id: activeFolderId || undefined,
        scope: activeFolderId ? 'folder' : 'space',
        count_cards: cards?.length || 0,
      } as any);
    }
  }, [activeFolderId, spaceId, cards?.length, trackEvent]);

  // Enable realtime updates for cards
  useRealtimeCards(spaceId);

  // Lock body scrolling: only the Kanban area should scroll
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  // Determine view type from active view or default
  const getViewTypeFromConfig = useCallback((viewType: string | undefined, viewName?: string): ViewType => {
    // Check for special social media views by name
    const nameLower = viewName?.toLowerCase() || '';
    if (nameLower.includes('aprovações') || nameLower.includes('aprovacoes') || nameLower.includes('pendente')) {
      return 'approvals';
    }
    if (nameLower.includes('checklist') || nameLower.includes('semanal')) {
      return 'checklist';
    }
    if (nameLower.includes('ideias') || nameLower.includes('banco') || nameLower.includes('referência')) {
      return 'ideas';
    }
    if (viewType === 'kanban') return 'kanban';
    if (viewType === 'calendar') return 'calendar';
    if (viewType === 'list') return 'list';
    return 'kanban';
  }, []);

  const [view, setView] = useState<ViewType>('kanban');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [createCardOpen, setCreateCardOpen] = useState(false);
  const [createFolderOpen, setCreateFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [defaultStatus, setDefaultStatus] = useState<CardStatus>('backlog');
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickAddInitialMode, setQuickAddInitialMode] = useState<'quick' | 'full'>('quick');
  const [demandFormOpen, setDemandFormOpen] = useState(false);
  const [advancedFilters, setAdvancedFilters] = useState<FilterQuery>({});
  
  // Folder edit/delete states
  const [editingFolder, setEditingFolder] = useState<{ id: string; name: string } | null>(null);
  const [deletingFolderId, setDeletingFolderId] = useState<string | null>(null);

  // Update view type and folder when active view changes
  useEffect(() => {
    if (activeView) {
      setView(getViewTypeFromConfig(activeView.view_type, activeView.name));
      // Set the folder from the view
      if (activeView.folder_id) {
        setSelectedFolder(activeView.folder_id);
      }
      // Track view opened
      trackEvent('social.view.opened', {
        space_id: spaceId,
        folder_id: activeView.folder_id || undefined,
        view_id: activeView.id,
        view_type: activeView.view_type,
      });
    }
  }, [activeView, getViewTypeFromConfig, spaceId, trackEvent]);

  // Keyboard shortcut handlers
  useShortcutEvent('flowalt:newCard', useCallback(() => setCreateCardOpen(true), []));
  useShortcutEvent('flowalt:focusSearch', useCallback(() => searchInputRef.current?.focus(), []));
  useShortcutEvent('flowalt:viewChange', useCallback((e?: Event) => {
    const detail = (e as CustomEvent)?.detail;
    if (detail?.view && ['kanban', 'list', 'calendar'].includes(detail.view)) {
      setView(detail.view);
    }
  }, []));

  const handleAddCard = (status: CardStatus) => {
    setDefaultStatus(status);
    setCreateCardOpen(true);
  };

  const handleCardClick = (card: Card) => {
    setSelectedCardId(card.id);
  };

  const handleCreateFolder = async () => {
    if (!spaceId || !newFolderName.trim()) return;

    await createFolder.mutateAsync({
      space_id: spaceId,
      name: newFolderName.trim(),
    });

    setNewFolderName('');
    setCreateFolderOpen(false);
  };

  const handleClearView = () => {
    setSearchParams({});
    setSelectedFolder(null);
  };

  // Apply view config filters
  const viewConfig = activeView?.view_config as Record<string, any> | undefined;

  // Filter cards by search, view config, and advanced filters
  const filteredCards = useMemo(() => {
    let result = cards || [];

    // Apply view config filters
    if (viewConfig?.filters && Array.isArray(viewConfig.filters)) {
      viewConfig.filters.forEach((filter: any) => {
        if (filter.field === 'status' && filter.operator === 'eq') {
          result = result.filter(card => card.status === filter.value);
        }
      });
    }

    // Filter by search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(card =>
        card.title.toLowerCase().includes(query) ||
        card.description?.toLowerCase().includes(query)
      );
    }

    // Apply advanced filters from FiltersToolbar
    if (advancedFilters.search) {
      const q = advancedFilters.search.toLowerCase();
      result = result.filter(card =>
        card.title.toLowerCase().includes(q) ||
        card.description?.toLowerCase().includes(q)
      );
    }

    if (advancedFilters.status?.card_status?.length) {
      result = result.filter(card => advancedFilters.status!.card_status!.includes(card.status));
    }

    if (advancedFilters.priority?.urgency?.length) {
      result = result.filter(card => advancedFilters.priority!.urgency!.includes(card.urgency as any));
    }

    if (advancedFilters.people?.assignee?.length) {
      result = result.filter(card => card.owner_id && advancedFilters.people!.assignee!.includes(card.owner_id));
    }

    if (advancedFilters.context?.client_id?.length) {
      result = result.filter(card => card.client_id && advancedFilters.context!.client_id!.includes(card.client_id));
    }

    if (advancedFilters.quality?.briefing_pending) {
      result = result.filter(card => !card.briefing_completed);
    }

    if (advancedFilters.time?.due === 'today') {
      const today = new Date().toISOString().split('T')[0];
      result = result.filter(card => card.due_date?.startsWith(today));
    } else if (advancedFilters.time?.due === 'overdue') {
      const today = new Date().toISOString().split('T')[0];
      result = result.filter(card => 
        card.due_date && card.due_date < today && !['done', 'delivered', 'archived'].includes(card.status)
      );
    } else if (advancedFilters.time?.due === 'none') {
      result = result.filter(card => !card.due_date);
    }

    return result;
  }, [cards, viewConfig, searchQuery, advancedFilters]);

  // Get view title
  const viewTitle = activeView?.name || space?.name || 'Espaço';

  if (spaceLoading) {
    return (
      <AppLayout>
        <div className="p-6">
          <Skeleton className="h-8 w-48 mb-4" />
          <Skeleton className="h-[400px] w-full" />
        </div>
      </AppLayout>
    );
  }

  if (!space) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
          <p className="text-muted-foreground">Espaço não encontrado</p>
          <Button variant="outline" onClick={() => navigate('/')} className="mt-4">
            Voltar ao início
          </Button>
        </div>
      </AppLayout>
    );
  }

  const isSocialMedia = space.type === 'social_media';

  return (
    <AppLayout spaceId={spaceId} folderId={selectedFolder || undefined}>
      <div className="flex flex-col h-full min-h-0 overflow-hidden">
        {/* Fixed Header - Always visible */}
        <div className="flex-shrink-0 border-b border-border bg-background">
          <div className="px-4 py-2.5 flex items-center justify-between gap-3">
            {/* Left: View name with breadcrumb */}
            <div className="flex items-center gap-2 min-w-0 flex-shrink-0">
              <div
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: space.color }}
              />
              {activeView ? (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-muted-foreground truncate max-w-[80px]">
                    {space.name}
                  </span>
                  <span className="text-muted-foreground">/</span>
                  <h1 className="text-sm font-semibold truncate max-w-[120px] sm:max-w-[200px]">
                    {activeView.name}
                  </h1>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5 ml-1"
                    onClick={handleClearView}
                    title="Ver todos os cards"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <h1 className="text-sm font-semibold truncate max-w-[120px] sm:max-w-none">
                  {space.name}
                </h1>
              )}
              {viewLoading && <Loader2 className="h-3 w-3 animate-spin" />}
            </div>

            {/* Center: Search + Filters */}
            <div className="flex items-center gap-2 flex-1 max-w-xl">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  ref={searchInputRef}
                  placeholder="Buscar... (/)"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-9 w-full text-sm bg-muted/50 border-0 focus-visible:ring-1"
                />
              </div>
              <FiltersToolbar
                scopeType="space"
                scopeId={spaceId}
                onFiltersChange={setAdvancedFilters}
              />
            </div>

            {/* Right: View Switcher + Add Button */}
            <div className="flex items-center gap-2 flex-shrink-0">
              {/* View Switcher - only show if no active view or view allows switching */}
              {!activeView && (
                <Tabs value={view} onValueChange={(v) => setView(v as ViewType)}>
                  <TabsList className="h-9 bg-muted/50">
                    <TabsTrigger value="kanban" className="px-3 h-8" title="Kanban Simples">
                      <LayoutGrid className="h-4 w-4" />
                    </TabsTrigger>
                    <TabsTrigger value="kanban-advanced" className="px-3 h-8" title="Kanban Avançado">
                      <LayoutGrid className="h-4 w-4" />
                      <span className="text-[9px] ml-0.5 font-bold">+</span>
                    </TabsTrigger>
                    <TabsTrigger value="list" className="px-3 h-8" title="Lista">
                      <List className="h-4 w-4" />
                    </TabsTrigger>
                    <TabsTrigger value="calendar" className="px-3 h-8" title="Calendário">
                      <Calendar className="h-4 w-4" />
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              )}

              {/* Show view type badge when a view is active */}
              {activeView && (
                <Badge variant="secondary" className="gap-1 capitalize">
                  {activeView.view_type === 'kanban' && <LayoutGrid className="h-3 w-3" />}
                  {activeView.view_type === 'list' && <List className="h-3 w-3" />}
                  {activeView.view_type === 'calendar' && <Calendar className="h-3 w-3" />}
                  {activeView.view_type}
                </Badge>
              )}

              {/* Add Button */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="default" className="h-9 gap-2 px-4">
                    <Plus className="h-4 w-4" />
                    <span className="hidden sm:inline">Adicionar</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => { setQuickAddInitialMode('quick'); setQuickAddOpen(true); }}>
                    <Plus className="h-4 w-4 mr-2" />
                    Novo Card
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setDemandFormOpen(true)}>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Nova Demanda (Briefing)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setCreateFolderOpen(true)}>
                    <FolderPlus className="h-4 w-4 mr-2" />
                    Nova Pasta
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Folders Bar - Only show when no active view and not social_media (tree nav handles it) */}
          {!activeView && !isSocialMedia && folders && folders.length > 0 && (
            <div className="px-4 pb-2 flex items-center gap-1.5 overflow-x-auto">
              <Button
                variant={selectedFolder === null ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setSelectedFolder(null)}
                className="h-7 px-2.5 text-xs flex-shrink-0"
              >
                Todos
              </Button>
              {folders.map((folder) => (
                <ContextMenu key={folder.id}>
                  <ContextMenuTrigger asChild>
                    <Button
                      variant={selectedFolder === folder.id ? 'secondary' : 'ghost'}
                      size="sm"
                      onClick={() => setSelectedFolder(folder.id)}
                      className="h-7 px-2.5 text-xs flex-shrink-0"
                    >
                      <Folder className="h-3 w-3 mr-1" style={{ color: folder.color || undefined }} />
                      {folder.name}
                    </Button>
                  </ContextMenuTrigger>
                  <ContextMenuContent>
                    <ContextMenuItem onClick={() => setEditingFolder({ id: folder.id, name: folder.name })}>
                      <Pencil className="h-4 w-4 mr-2" />
                      Renomear
                    </ContextMenuItem>
                    <ContextMenuItem 
                      onClick={() => setDeletingFolderId(folder.id)}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Excluir
                    </ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>
              ))}
            </div>
          )}
        </div>

        {/* Content - Kanban area with internal scroll */}
        <div className="flex-1 min-h-0 overflow-hidden">
          <WorkflowInitializer>
            {cardsLoading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : view === 'kanban' ? (
              <div className="h-full p-4 overflow-x-auto overflow-y-hidden">
                <KanbanBoard
                  cards={filteredCards}
                  onCardClick={handleCardClick}
                  onAddCard={handleAddCard}
                />
              </div>
            ) : view === 'kanban-advanced' ? (
              <div className="h-full p-4 overflow-x-auto overflow-y-hidden">
                <KanbanAdvanced
                  cards={filteredCards}
                  onCardClick={handleCardClick}
                  onAddCard={handleAddCard}
                  spaceId={spaceId}
                />
              </div>
            ) : view === 'list' ? (
              <div className="h-full p-4 overflow-auto">
                <ListView cards={filteredCards} onCardClick={handleCardClick} />
              </div>
            ) : view === 'approvals' ? (
              <ApprovalsPendingView 
                cards={filteredCards} 
                onCardClick={handleCardClick}
                isLoading={cardsLoading}
              />
            ) : view === 'checklist' && activeViewId && selectedFolder ? (
              <WeeklyChecklistView 
                folderId={selectedFolder} 
                viewId={activeViewId}
              />
            ) : view === 'ideas' && activeViewId && selectedFolder ? (
              <IdeasBankView 
                folderId={selectedFolder} 
                viewId={activeViewId}
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  Visualização de calendário em breve
                </p>
              </div>
            )}
          </WorkflowInitializer>
        </div>
      </div>

      {/* Dialogs */}
      <CreateCardDialog
        open={createCardOpen}
        onOpenChange={setCreateCardOpen}
        spaceId={spaceId!}
        folderId={selectedFolder || undefined}
        defaultStatus={defaultStatus}
      />

      {/* Folder Dialog - Use template dialog for social_media spaces */}
      {isSocialMedia ? (
        <CreateFolderWithTemplateDialog
          open={createFolderOpen}
          onOpenChange={setCreateFolderOpen}
          spaceId={spaceId!}
          spaceType="social_media"
        />
      ) : (
        <Dialog open={createFolderOpen} onOpenChange={setCreateFolderOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nova Pasta</DialogTitle>
              <DialogDescription>
                Crie uma pasta para organizar seus cards.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-4">
              {/* Show current space info */}
              <div className="p-3 bg-muted/50 rounded-lg">
                <Label className="text-xs text-muted-foreground">Espaço selecionado</Label>
                <p className="text-sm font-medium mt-1 flex items-center gap-2">
                  <Folder className="h-4 w-4" style={{ color: space?.color || undefined }} />
                  {space?.name || 'Carregando...'}
                </p>
              </div>
              
              <div>
                <Label htmlFor="folderName">Nome da pasta</Label>
                <Input
                  id="folderName"
                  placeholder="Ex: Cliente X, Campanha Y..."
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  className="mt-2"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateFolderOpen(false)}>
                Cancelar
              </Button>
              <Button
                onClick={handleCreateFolder}
                disabled={!newFolderName.trim() || createFolder.isPending}
              >
                {createFolder.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Criar Pasta
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Folder Rename Dialog */}
      <Dialog open={!!editingFolder} onOpenChange={(open) => !open && setEditingFolder(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Renomear Pasta</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="editFolderName">Nome da pasta</Label>
            <Input
              id="editFolderName"
              value={editingFolder?.name || ''}
              onChange={(e) => setEditingFolder(prev => prev ? { ...prev, name: e.target.value } : null)}
              className="mt-2"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingFolder(null)}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                if (editingFolder && editingFolder.name.trim()) {
                  updateFolder.mutate(
                    { id: editingFolder.id, name: editingFolder.name.trim() },
                    { onSuccess: () => setEditingFolder(null) }
                  );
                }
              }}
              disabled={!editingFolder?.name.trim() || updateFolder.isPending}
            >
              {updateFolder.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Folder Delete Confirmation */}
      <AlertDialog open={!!deletingFolderId} onOpenChange={(open) => !open && setDeletingFolderId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir pasta?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação vai arquivar a pasta. Os cards dentro dela permanecerão no espaço, 
              apenas sem a organização da pasta.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deletingFolderId && spaceId) {
                  deleteFolder.mutate(
                    { id: deletingFolderId, spaceId },
                    { 
                      onSuccess: () => {
                        setDeletingFolderId(null);
                        if (selectedFolder === deletingFolderId) {
                          setSelectedFolder(null);
                        }
                      }
                    }
                  );
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteFolder.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Card Detail Sheet */}
      <CardDetailSheet
        cardId={selectedCardId}
        open={!!selectedCardId}
        onOpenChange={(open) => !open && setSelectedCardId(null)}
      />

      {/* Quick Add Card */}
      <QuickAddCard
        open={quickAddOpen}
        onOpenChange={setQuickAddOpen}
        spaceId={spaceId!}
        folderId={selectedFolder || undefined}
        defaultStatus={defaultStatus}
        initialMode={quickAddInitialMode}
      />

      {/* Demand Form Dialog (with Briefing) */}
      <DemandFormDialog
        open={demandFormOpen}
        onOpenChange={setDemandFormOpen}
        spaceId={spaceId}
        folderId={activeFolderId || undefined}
        onSuccess={(cardId) => setSelectedCardId(cardId)}
      />
    </AppLayout>
  );
};

export default SpacePage;
