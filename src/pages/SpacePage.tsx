import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { useSpace } from '@/hooks/useSpaces';
import { useFolders, useCreateFolder } from '@/hooks/useFolders';
import { useCards } from '@/hooks/useCards';
import { KanbanBoard } from '@/components/cards/KanbanBoard';
import { ListView } from '@/components/cards/ListView';
import { CreateCardDialog } from '@/components/cards/CreateCardDialog';
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
  MoreHorizontal,
  Folder,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Card } from '@/hooks/useCards';
import type { CardStatus } from '@/lib/supabase';

type ViewType = 'kanban' | 'list' | 'calendar';

const SpacePage: React.FC = () => {
  const { spaceId } = useParams<{ spaceId: string }>();
  const navigate = useNavigate();

  const { data: space, isLoading: spaceLoading } = useSpace(spaceId);
  const { data: folders, isLoading: foldersLoading } = useFolders(spaceId);
  const { data: cards, isLoading: cardsLoading } = useCards(spaceId);
  const createFolder = useCreateFolder();

  const [view, setView] = useState<ViewType>('kanban');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [createCardOpen, setCreateCardOpen] = useState(false);
  const [createFolderOpen, setCreateFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [defaultStatus, setDefaultStatus] = useState<CardStatus>('backlog');

  const handleAddCard = (status: CardStatus) => {
    setDefaultStatus(status);
    setCreateCardOpen(true);
  };

  const handleCardClick = (card: Card) => {
    // Will navigate to card detail later
    console.log('Card clicked:', card.id);
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
    <AppLayout>
      <div className="flex flex-col h-[calc(100vh-56px)]">
        {/* Header */}
        <div className="flex-shrink-0 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="p-4 lg:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              {/* Title & Folder Breadcrumb */}
              <div className="flex items-center gap-3">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: space.color }}
                />
                <h1 className="text-xl font-semibold">{space.name}</h1>
                {selectedFolder && folders && (
                  <>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">
                      {folders.find(f => f.id === selectedFolder)?.name}
                    </span>
                  </>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar cards..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 w-48 lg:w-64"
                  />
                </div>

                {/* View Switcher */}
                <Tabs value={view} onValueChange={(v) => setView(v as ViewType)}>
                  <TabsList>
                    <TabsTrigger value="kanban" className="px-3">
                      <LayoutGrid className="h-4 w-4" />
                    </TabsTrigger>
                    <TabsTrigger value="list" className="px-3">
                      <List className="h-4 w-4" />
                    </TabsTrigger>
                    <TabsTrigger value="calendar" className="px-3">
                      <Calendar className="h-4 w-4" />
                    </TabsTrigger>
                  </TabsList>
                </Tabs>

                {/* Add Dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      Adicionar
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setCreateCardOpen(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Novo Card
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
              <div className="flex items-center gap-2 mt-4 overflow-x-auto pb-1">
                <Button
                  variant={selectedFolder === null ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setSelectedFolder(null)}
                  className="flex-shrink-0"
                >
                  Todos
                </Button>
                {folders.map((folder) => (
                  <Button
                    key={folder.id}
                    variant={selectedFolder === folder.id ? 'secondary' : 'ghost'}
                    size="sm"
                    onClick={() => setSelectedFolder(folder.id)}
                    className="flex-shrink-0"
                  >
                    <Folder className="h-3.5 w-3.5 mr-1.5" style={{ color: folder.color || undefined }} />
                    {folder.name}
                  </Button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4 lg:p-6">
          {cardsLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : view === 'kanban' ? (
            <KanbanBoard
              cards={filteredCards}
              onCardClick={handleCardClick}
              onAddCard={handleAddCard}
            />
          ) : view === 'list' ? (
            <ListView cards={filteredCards} onCardClick={handleCardClick} />
          ) : (
            <div className="flex flex-col items-center justify-center h-64 text-center">
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
    </AppLayout>
  );
};

export default SpacePage;
