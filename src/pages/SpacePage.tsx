import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { useSpace } from '@/hooks/useSpaces';
import { useFolders, useCreateFolder } from '@/hooks/useFolders';
import { useCards } from '@/hooks/useCards';
import { useRealtimeCards } from '@/hooks/useRealtimeCards';
import { useShortcutEvent } from '@/hooks/useGlobalShortcuts';
import { KanbanBoard } from '@/components/cards/KanbanBoard';
import { KanbanAdvanced } from '@/components/cards/KanbanAdvanced';
import { ListView } from '@/components/cards/ListView';
import { CreateCardDialog } from '@/components/cards/CreateCardDialog';
import { QuickAddCard } from '@/components/cards/QuickAddCard';
import { CardDetailSheet } from '@/components/cards/CardDetailSheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Card } from '@/hooks/useCards';
import type { CardStatus } from '@/lib/supabase';

type ViewType = 'kanban' | 'kanban-advanced' | 'list' | 'calendar';

const SpacePage: React.FC = () => {
  const { spaceId } = useParams<{ spaceId: string }>();
  const navigate = useNavigate();
  const searchInputRef = useRef<HTMLInputElement>(null);

  const { data: space, isLoading: spaceLoading } = useSpace(spaceId);
  const { data: folders, isLoading: foldersLoading } = useFolders(spaceId);
  const { data: cards, isLoading: cardsLoading } = useCards(spaceId);
  const createFolder = useCreateFolder();

  // Enable realtime updates for cards
  useRealtimeCards(spaceId);

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

  // Filter cards by search and folder
  const filteredCards = cards?.filter((card) => {
    const matchesSearch = !searchQuery || 
      card.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      card.description?.toLowerCase().includes(searchQuery.toLowerCase());
    
    return matchesSearch;
  }) || [];

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

  return (
    <AppLayout spaceId={spaceId} folderId={selectedFolder || undefined}>
      <div className="flex flex-col h-full overflow-hidden">
        {/* Fixed Header - Always visible */}
        <div className="flex-shrink-0 border-b border-border bg-background">
          <div className="px-4 py-2.5 flex items-center justify-between gap-3">
            {/* Left: Space name (minimal) */}
            <div className="flex items-center gap-2 min-w-0 flex-shrink-0">
              <div
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: space.color }}
              />
              <h1 className="text-sm font-semibold truncate max-w-[120px] sm:max-w-none">{space.name}</h1>
            </div>

            {/* Center: Search */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                ref={searchInputRef}
                placeholder="Buscar... (/)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 w-full text-sm bg-muted/50 border-0 focus-visible:ring-1"
              />
            </div>

            {/* Right: View Switcher + Add Button */}
            <div className="flex items-center gap-2 flex-shrink-0">
              {/* View Switcher */}
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
                    Novo Card (Rápido)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => { setQuickAddInitialMode('full'); setQuickAddOpen(true); }}>
                    <Plus className="h-4 w-4 mr-2" />
                    Novo Card (Completo)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setCreateFolderOpen(true)}>
                    <FolderPlus className="h-4 w-4 mr-2" />
                    Nova Pasta
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Folders Bar */}
          {folders && folders.length > 0 && (
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
                <Button
                  key={folder.id}
                  variant={selectedFolder === folder.id ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setSelectedFolder(folder.id)}
                  className="h-7 px-2.5 text-xs flex-shrink-0"
                >
                  <Folder className="h-3 w-3 mr-1" style={{ color: folder.color || undefined }} />
                  {folder.name}
                </Button>
              ))}
            </div>
          )}
        </div>

        {/* Content - Kanban area with internal scroll */}
        <div className="flex-1 min-h-0 overflow-hidden">
          {cardsLoading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : view === 'kanban' ? (
            <div className="h-full p-4 overflow-x-auto overflow-y-auto">
              <KanbanBoard
                cards={filteredCards}
                onCardClick={handleCardClick}
                onAddCard={handleAddCard}
              />
            </div>
          ) : view === 'kanban-advanced' ? (
            <div className="h-full p-4 overflow-x-auto overflow-y-auto">
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
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                Visualização de calendário em breve
              </p>
            </div>
          )}
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

      <Dialog open={createFolderOpen} onOpenChange={setCreateFolderOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Pasta</DialogTitle>
            <DialogDescription>
              Crie uma pasta para organizar seus cards neste espaço.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="folderName">Nome da pasta</Label>
            <Input
              id="folderName"
              placeholder="Ex: Cliente X, Campanha Y..."
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              className="mt-2"
            />
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
    </AppLayout>
  );
};

export default SpacePage;
