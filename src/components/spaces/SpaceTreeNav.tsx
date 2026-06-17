import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { useFolders, useDeleteFolder } from '@/hooks/useFolders';
import { useFolderViews, useDeleteFolderView } from '@/hooks/useSocialMediaTemplates';
import { useExpandedFolders } from '@/hooks/useUserPreferences';
import { useFolderPermissions, useIsAdmin } from '@/hooks/useFolderPermissions';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useAuth } from '@/contexts/AuthContext';
import { RestrictedBadge } from '@/components/governance';
import { CreateFolderWithTemplateDialog } from '@/components/social-media/CreateFolderWithTemplateDialog';
import { CreateViewDialog } from '@/components/social-media/CreateViewDialog';
import { SaveSpaceAsTemplateDialog } from '@/components/spaces/SaveSpaceAsTemplateDialog';
import { useToast } from '@/hooks/use-toast';
import { EditFolderDialog } from './EditFolderDialog';
import {
  ChevronDown,
  Folder,
  FolderOpen,
  Plus,
  LayoutGrid,
  Kanban,
  Calendar,
  List,
  Lightbulb,
  CheckCircle,
  Megaphone,
  BarChart,
  MoreHorizontal,
  Trash2,
  Lock,
  Palette,
  Video,
  Share2,
  Target,
  Briefcase,
  Save,
  Pencil,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface SpaceTreeNavProps {
  spaceId: string;
  spaceName: string;
  spaceColor?: string;
  spaceIcon?: string;
  spaceType?: string;
}

const spaceIconMap: Record<string, React.ElementType> = {
  'palette': Palette,
  'video': Video,
  'share-2': Share2,
  'target': Target,
  'briefcase': Briefcase,
  'folder': Folder,
};

const viewTypeIcons: Record<string, React.ElementType> = {
  kanban: Kanban,
  calendar: Calendar,
  list: List,
  ideas: Lightbulb,
  approvals: CheckCircle,
  campaigns: Megaphone,
  reports: BarChart,
};

const getViewIcon = (viewType: string, viewName?: string) => {
  const nameLower = viewName?.toLowerCase() || '';
  if (nameLower.includes('ideias') || nameLower.includes('ideas')) return Lightbulb;
  if (nameLower.includes('aprovação') || nameLower.includes('approval')) return CheckCircle;
  if (nameLower.includes('campanha') || nameLower.includes('campaign')) return Megaphone;
  if (nameLower.includes('relatório') || nameLower.includes('report')) return BarChart;
  
  return viewTypeIcons[viewType] || LayoutGrid;
};

interface FolderItemProps {
  folder: { id: string; name: string; color: string | null; owner_id: string | null; is_personal?: boolean };
  spaceId: string;
  spaceType: string;
  isExpanded: boolean;
  onToggle: () => void;
  selectedViewId?: string | null;
  onViewSelect: (viewId: string, viewType: string) => void;
  onCreateView: () => void;
  onEditFolder: () => void;
  onDeleteFolder: () => void;
  onDeleteView: (viewId: string) => void;
  currentUserId?: string;
}

const FolderItem: React.FC<FolderItemProps> = ({
  folder,
  spaceId,
  spaceType,
  isExpanded,
  onToggle,
  selectedViewId,
  onViewSelect,
  onCreateView,
  onEditFolder,
  onDeleteFolder,
  onDeleteView,
  currentUserId,
}) => {
  const { data: views, isLoading } = useFolderViews(folder.id);
  const folderPermissions = useFolderPermissions(folder.id, folder.owner_id);
  
  const isPersonalFolder = folder.is_personal && folder.owner_id;
  const isOwnFolder = folder.owner_id === currentUserId;
  const isRestrictedFolder = isPersonalFolder && !isOwnFolder;

  return (
    <Collapsible open={isExpanded} onOpenChange={onToggle}>
      <div className="flex items-center group rounded-md hover:bg-muted/30 transition-colors duration-150 cursor-pointer min-w-0 w-full">
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            title={folder.name}
            className="flex-1 min-w-0 justify-start gap-1 px-2 h-8 font-normal hover:bg-transparent overflow-hidden"
          >
            <ChevronDown 
              className={cn(
                "h-3.5 w-3.5 text-muted-foreground flex-shrink-0 transition-transform duration-200",
                isExpanded && "rotate-180"
              )}
            />
            {isRestrictedFolder ? (
              <Lock className="h-4 w-4 flex-shrink-0 text-warning" />
            ) : isExpanded ? (
              <FolderOpen
                className="h-4 w-4 flex-shrink-0"
                style={{ color: folder.color || undefined }}
              />
            ) : (
              <Folder
                className="h-4 w-4 flex-shrink-0"
                style={{ color: folder.color || undefined }}
              />
            )}
            <span className="truncate text-sm">{folder.name}</span>
            {isOwnFolder && isPersonalFolder && (
              <RestrictedBadge type="owner" size="sm" showLabel={false} />
            )}
            {isRestrictedFolder && (
              <RestrictedBadge 
                type="restricted" 
                size="sm" 
                showLabel={false}
                tooltipContent="Pasta pessoal de outro usuário"
              />
            )}
          </Button>
        </CollapsibleTrigger>
        
        {folderPermissions.canManageViews && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onCreateView}>
                <Plus className="h-4 w-4 mr-2" />
                Nova View
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onEditFolder}>
                <Pencil className="h-4 w-4 mr-2" />
                Editar Pasta
              </DropdownMenuItem>
              {folderPermissions.canDelete && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    onClick={onDeleteFolder}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Excluir Pasta
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <CollapsibleContent className="data-[state=open]:animate-fade-in">
        <div className="ml-4 pl-2 border-l border-border/50 space-y-0.5 py-0.5">
          {isLoading ? (
            <>
              <Skeleton className="h-7 w-full" />
              <Skeleton className="h-7 w-full" />
            </>
          ) : views && views.length > 0 ? (
            views.map((view) => {
              const Icon = getViewIcon(view.view_type, view.name);
              const isActive = selectedViewId === view.id;

              return (
                <div key={view.id} className="flex items-center group/view">
                  <Button
                    variant={isActive ? 'secondary' : 'ghost'}
                    size="sm"
                    asChild
                    className={cn(
                      'flex-1 justify-start gap-2 px-2 h-7 font-normal text-sm',
                      isActive && 'bg-primary/10 text-primary'
                    )}
                  >
                    <Link to={`/space/${spaceId}?view=${view.id}`}>
                      <Icon className="h-3.5 w-3.5 flex-shrink-0" />
                      <span className="truncate">{view.name}</span>
                    </Link>
                  </Button>
                  
                  {folderPermissions.canManageViews && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 opacity-0 group-hover/view:opacity-100 transition-opacity flex-shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteView(view.id);
                      }}
                    >
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  )}
                </div>
              );
            })
          ) : (
            <p className="text-xs text-muted-foreground px-2 py-1">Sem views</p>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};

export const SpaceTreeNav: React.FC<SpaceTreeNavProps> = ({
  spaceId,
  spaceName,
  spaceColor,
  spaceIcon = 'folder',
  spaceType = 'blank',
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { currentRole } = useWorkspace();
  const { user } = useAuth();
  const isAdmin = useIsAdmin();
  
  const { data: folders, isLoading: foldersLoading } = useFolders(spaceId);
  const { value: expandedFolders, setValue: setExpandedFolders } = useExpandedFolders(spaceId);
  
  const deleteFolder = useDeleteFolder();
  const deleteView = useDeleteFolderView();

  const [createFolderOpen, setCreateFolderOpen] = useState(false);
  const [createViewOpen, setCreateViewOpen] = useState(false);
  const [saveTemplateOpen, setSaveTemplateOpen] = useState(false);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  
  const [deleteFolderDialog, setDeleteFolderDialog] = useState<{ open: boolean; folderId: string; folderName: string } | null>(null);
  const [editFolderDialog, setEditFolderDialog] = useState<{ open: boolean; folder: { id: string; name: string } } | null>(null);
  const [deleteViewDialog, setDeleteViewDialog] = useState<{ open: boolean; viewId: string; folderId: string } | null>(null);

  const searchParams = new URLSearchParams(location.search);
  const currentViewId = searchParams.get('view');

  const [isSpaceCollapsed, setIsSpaceCollapsed] = useState(() => {
    const saved = localStorage.getItem(`space-collapsed-${spaceId}`);
    return saved === 'true';
  });

  useEffect(() => {
    localStorage.setItem(`space-collapsed-${spaceId}`, String(isSpaceCollapsed));
  }, [isSpaceCollapsed, spaceId]);

  const handleToggleFolder = useCallback(
    (folderId: string, isCurrentlyExpanded: boolean) => {
      const newExpanded = isCurrentlyExpanded
        ? expandedFolders.filter((id) => id !== folderId)
        : [...expandedFolders, folderId];
      setExpandedFolders(newExpanded);
    },
    [expandedFolders, setExpandedFolders]
  );

  const handleToggleSpace = useCallback(() => {
    setIsSpaceCollapsed((prev) => !prev);
  }, []);

  const handleViewSelect = useCallback(
    (viewId: string, viewType: string) => {
      navigate(`/space/${spaceId}?view=${viewId}`);
    },
    [navigate, spaceId]
  );

  const handleCreateViewForFolder = (folderId: string) => {
    setSelectedFolderId(folderId);
    setCreateViewOpen(true);
  };

  const handleDeleteFolder = async (folderId: string) => {
    try {
      await deleteFolder.mutateAsync({ id: folderId, spaceId });
      toast({ title: 'Pasta excluída', description: 'A pasta foi excluída com sucesso.' });
      setDeleteFolderDialog(null);
    } catch (error) {
      toast({ 
        title: 'Erro ao excluir pasta', 
        description: 'Você não tem permissão para excluir esta pasta.',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteView = async (viewId: string) => {
    try {
      await deleteView.mutateAsync(viewId);
      toast({ title: 'View excluída', description: 'A view foi excluída com sucesso.' });
      setDeleteViewDialog(null);
      
      if (currentViewId === viewId) {
        navigate(`/space/${spaceId}`);
      }
    } catch (error) {
      toast({ 
        title: 'Erro ao excluir view', 
        description: 'Você não tem permissão para excluir esta view.',
        variant: 'destructive',
      });
    }
  };

  const SpaceIcon = spaceIconMap[spaceIcon] || Folder;

  return (
    <div className="space-y-1">
      {/* Space Header */}
      <div className="flex items-center justify-between px-2 py-1 group rounded-md hover:bg-muted/50 transition-colors duration-150">
        <div 
          className="flex items-center gap-2 min-w-0 cursor-pointer flex-1"
          onClick={handleToggleSpace}
        >
          <SpaceIcon 
            className="h-4 w-4 flex-shrink-0" 
            style={{ color: spaceColor }}
          />
          <span className="text-sm font-medium truncate">{spaceName}</span>
          <ChevronDown 
            className={cn(
              "h-3.5 w-3.5 text-muted-foreground flex-shrink-0 transition-transform duration-200",
              !isSpaceCollapsed && "rotate-180"
            )}
          />
        </div>
        <div className="flex items-center gap-0.5">
          {isAdmin && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                onClick={() => setCreateFolderOpen(true)}
                title="Adicionar Pasta"
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
              {folders && folders.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MoreHorizontal className="h-3.5 w-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setSaveTemplateOpen(true)}>
                      <Save className="h-4 w-4 mr-2" />
                      Salvar como Template
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </>
          )}
        </div>
      </div>

      {/* Folders Tree */}
      {!isSpaceCollapsed && (
        <div className="space-y-0.5">
          {foldersLoading ? (
            <>
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </>
          ) : folders && folders.length > 0 ? (
            folders.map((folder) => (
              <FolderItem
                key={folder.id}
                folder={folder}
                spaceId={spaceId}
                spaceType={spaceType}
                isExpanded={expandedFolders.includes(folder.id)}
                onToggle={() =>
                  handleToggleFolder(folder.id, expandedFolders.includes(folder.id))
                }
                selectedViewId={currentViewId}
                onViewSelect={handleViewSelect}
                onCreateView={() => handleCreateViewForFolder(folder.id)}
                onEditFolder={() => setEditFolderDialog({
                  open: true,
                  folder: { id: folder.id, name: folder.name }
                })}
                onDeleteFolder={() => setDeleteFolderDialog({ 
                  open: true, 
                  folderId: folder.id, 
                  folderName: folder.name 
                })}
                onDeleteView={(viewId) => setDeleteViewDialog({ 
                  open: true, 
                  viewId, 
                  folderId: folder.id 
                })}
                currentUserId={user?.id}
              />
            ))
          ) : (
            <p className="text-xs text-muted-foreground px-2 py-2">
              {isAdmin ? 'Nenhuma pasta. Clique em + para criar.' : 'Nenhuma pasta disponível.'}
            </p>
          )}
        </div>
      )}

      {/* Create Folder Dialog */}
      <CreateFolderWithTemplateDialog
        open={createFolderOpen}
        onOpenChange={setCreateFolderOpen}
        spaceId={spaceId}
        spaceType={spaceType}
      />

      {/* Create View Dialog */}
      <CreateViewDialog
        open={createViewOpen}
        onOpenChange={setCreateViewOpen}
        folderId={selectedFolderId}
        spaceType={spaceType}
        onSuccess={(viewId, viewType) => {
          handleViewSelect(viewId, viewType);
        }}
      />

      {/* Delete Folder Confirmation */}
      {deleteFolderDialog && (
        <AlertDialog 
          open={deleteFolderDialog.open} 
          onOpenChange={(open) => !open && setDeleteFolderDialog(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir pasta "{deleteFolderDialog.folderName}"?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta ação não pode ser desfeita. Todos os cards e views dentro desta pasta serão arquivados e o histórico de alterações será registrado para auditoria.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction 
                onClick={() => handleDeleteFolder(deleteFolderDialog.folderId)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Excluir Permanentemente
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {/* Edit Folder Dialog */}
      <EditFolderDialog
        open={!!editFolderDialog?.open}
        onOpenChange={(open) => !open && setEditFolderDialog(null)}
        folder={editFolderDialog?.folder || null}
      />

      {/* Delete View Confirmation */}
      {deleteViewDialog && (
        <AlertDialog 
          open={deleteViewDialog.open} 
          onOpenChange={(open) => !open && setDeleteViewDialog(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir view?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta ação não pode ser desfeita. A view será removida permanentemente.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction 
                onClick={() => handleDeleteView(deleteViewDialog.viewId)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {/* Save as Template Dialog */}
      <SaveSpaceAsTemplateDialog
        open={saveTemplateOpen}
        onOpenChange={setSaveTemplateOpen}
        spaceId={spaceId}
        spaceName={spaceName}
        spaceIcon={spaceIcon}
        spaceColor={spaceColor || '#6366f1'}
      />
    </div>
  );
};
