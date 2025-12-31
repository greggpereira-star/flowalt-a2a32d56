import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
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
import { useSocialMediaTracking } from '@/hooks/useSocialMediaTracking';
import { useFolderPermissions, useIsAdmin } from '@/hooks/useFolderPermissions';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { CreateFolderWithTemplateDialog } from './CreateFolderWithTemplateDialog';
import { CreateViewDialog } from './CreateViewDialog';
import { useToast } from '@/hooks/use-toast';
import {
  ChevronRight,
  ChevronDown,
  ChevronsDown,
  ChevronsUp,
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
  Edit,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface SocialMediaTreeNavProps {
  spaceId: string;
  spaceName: string;
  spaceColor?: string;
}

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
  folder: { id: string; name: string; color: string | null; owner_id: string | null };
  spaceId: string;
  isExpanded: boolean;
  onToggle: () => void;
  selectedViewId?: string | null;
  onViewSelect: (viewId: string, viewType: string) => void;
  onCreateView: () => void;
  onDeleteFolder: () => void;
  onDeleteView: (viewId: string) => void;
}

const FolderItem: React.FC<FolderItemProps> = ({
  folder,
  spaceId,
  isExpanded,
  onToggle,
  selectedViewId,
  onViewSelect,
  onCreateView,
  onDeleteFolder,
  onDeleteView,
}) => {
  const { data: views, isLoading } = useFolderViews(folder.id);
  const folderPermissions = useFolderPermissions(folder.owner_id);

  return (
    <Collapsible open={isExpanded} onOpenChange={onToggle}>
      <div className="flex items-center group">
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="flex-1 justify-start gap-1 px-2 h-8 font-normal hover:bg-muted/50"
          >
            {isExpanded ? (
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
            )}
            {isExpanded ? (
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
          </Button>
        </CollapsibleTrigger>
        
        {/* Folder actions - only for those with permission */}
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

      <CollapsibleContent>
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
                    className={cn(
                      'flex-1 justify-start gap-2 px-2 h-7 font-normal text-sm',
                      isActive && 'bg-primary/10 text-primary'
                    )}
                    onClick={() => onViewSelect(view.id, view.view_type)}
                  >
                    <Icon className="h-3.5 w-3.5 flex-shrink-0" />
                    <span className="truncate">{view.name}</span>
                  </Button>
                  
                  {/* View delete - only for admin or folder owner */}
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

export const SocialMediaTreeNav: React.FC<SocialMediaTreeNavProps> = ({
  spaceId,
  spaceName,
  spaceColor,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { currentRole } = useWorkspace();
  const isAdmin = useIsAdmin();
  
  const { data: folders, isLoading: foldersLoading } = useFolders(spaceId);
  const { value: expandedFolders, setValue: setExpandedFolders } = useExpandedFolders(spaceId);
  const { 
    trackFolderExpanded, 
    trackFolderCollapsed, 
    trackViewOpened,
    trackRbacFolderDelete,
    trackRbacViewDelete,
  } = useSocialMediaTracking();
  
  const deleteFolder = useDeleteFolder();
  const deleteView = useDeleteFolderView();

  const [createFolderOpen, setCreateFolderOpen] = useState(false);
  const [createViewOpen, setCreateViewOpen] = useState(false);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  
  // Delete confirmation dialogs
  const [deleteFolderDialog, setDeleteFolderDialog] = useState<{ open: boolean; folderId: string; folderName: string } | null>(null);
  const [deleteViewDialog, setDeleteViewDialog] = useState<{ open: boolean; viewId: string; folderId: string } | null>(null);

  const searchParams = new URLSearchParams(location.search);
  const currentViewId = searchParams.get('view');

  const handleToggleFolder = useCallback(
    (folderId: string, isCurrentlyExpanded: boolean) => {
      const newExpanded = isCurrentlyExpanded
        ? expandedFolders.filter((id) => id !== folderId)
        : [...expandedFolders, folderId];

      setExpandedFolders(newExpanded);

      if (isCurrentlyExpanded) {
        trackFolderCollapsed(spaceId, folderId);
      } else {
        trackFolderExpanded(spaceId, folderId);
      }
    },
    [expandedFolders, setExpandedFolders, spaceId, trackFolderExpanded, trackFolderCollapsed]
  );

  // State for collapsing entire space
  const [isSpaceCollapsed, setIsSpaceCollapsed] = useState(() => {
    const saved = localStorage.getItem(`space-collapsed-${spaceId}`);
    return saved === 'true';
  });

  // Persist collapse state
  useEffect(() => {
    localStorage.setItem(`space-collapsed-${spaceId}`, String(isSpaceCollapsed));
  }, [isSpaceCollapsed, spaceId]);

  const handleExpandAll = useCallback(() => {
    setIsSpaceCollapsed(false);
    if (folders && folders.length > 0) {
      const allFolderIds = folders.map((f) => f.id);
      setExpandedFolders(allFolderIds);
    }
  }, [folders, setExpandedFolders]);

  const handleCollapseAll = useCallback(() => {
    setIsSpaceCollapsed(true);
    setExpandedFolders([]);
  }, [setExpandedFolders]);

  const handleToggleSpace = useCallback(() => {
    setIsSpaceCollapsed((prev) => !prev);
  }, []);

  const handleViewSelect = useCallback(
    (viewId: string, viewType: string) => {
      navigate(`/space/${spaceId}?view=${viewId}`);
      trackViewOpened({ space_id: spaceId, view_id: viewId, view_type: viewType });
    },
    [navigate, spaceId, trackViewOpened]
  );

  const handleCreateViewForFolder = (folderId: string) => {
    setSelectedFolderId(folderId);
    setCreateViewOpen(true);
  };

  const handleDeleteFolder = async (folderId: string) => {
    trackRbacFolderDelete(folderId, 'attempt', currentRole || undefined);
    
    try {
      await deleteFolder.mutateAsync({ id: folderId, spaceId });
      trackRbacFolderDelete(folderId, 'success', currentRole || undefined);
      toast({ title: 'Pasta excluída', description: 'A pasta foi excluída com sucesso.' });
      setDeleteFolderDialog(null);
    } catch (error) {
      trackRbacFolderDelete(folderId, 'denied', currentRole || undefined, (error as Error).message);
      toast({ 
        title: 'Erro ao excluir pasta', 
        description: 'Você não tem permissão para excluir esta pasta.',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteView = async (viewId: string, folderId: string) => {
    trackRbacViewDelete(viewId, folderId, 'attempt', currentRole || undefined);
    
    try {
      await deleteView.mutateAsync(viewId);
      trackRbacViewDelete(viewId, folderId, 'success', currentRole || undefined);
      toast({ title: 'View excluída', description: 'A view foi excluída com sucesso.' });
      setDeleteViewDialog(null);
      
      // If current view was deleted, navigate away
      if (currentViewId === viewId) {
        navigate(`/space/${spaceId}`);
      }
    } catch (error) {
      trackRbacViewDelete(viewId, folderId, 'denied', currentRole || undefined, (error as Error).message);
      toast({ 
        title: 'Erro ao excluir view', 
        description: 'Você não tem permissão para excluir esta view.',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-1">
      {/* Space Header */}
      <div className="flex items-center justify-between px-2 py-1 group">
        <div 
          className="flex items-center gap-2 min-w-0 cursor-pointer flex-1"
          onClick={handleToggleSpace}
        >
          {isSpaceCollapsed ? (
            <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          )}
          <div
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: spaceColor }}
          />
          <span className="text-sm font-medium truncate">{spaceName}</span>
        </div>
        <div className="flex items-center gap-0.5">
          {/* Expand/Collapse All - mostra se tem pelo menos 1 pasta */}
          {folders && folders.length > 0 && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                onClick={handleExpandAll}
                title="Expandir todas as pastas"
              >
                <ChevronsDown className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                onClick={handleCollapseAll}
                title="Minimizar todas as pastas"
              >
                <ChevronsUp className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
          {/* Only admins can create folders for other users */}
          {isAdmin && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
              onClick={() => setCreateFolderOpen(true)}
              title="Adicionar Pasta"
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* Folders Tree - only show when space is not collapsed */}
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
                isExpanded={expandedFolders.includes(folder.id)}
                onToggle={() =>
                  handleToggleFolder(folder.id, expandedFolders.includes(folder.id))
                }
                selectedViewId={currentViewId}
                onViewSelect={handleViewSelect}
                onCreateView={() => handleCreateViewForFolder(folder.id)}
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
              />
            ))
          ) : (
            <p className="text-xs text-muted-foreground px-2 py-2">
              {isAdmin ? 'Nenhuma pasta. Clique em + para criar.' : 'Nenhuma pasta atribuída a você.'}
            </p>
          )}
        </div>
      )}

      {/* Create Folder Dialog */}
      <CreateFolderWithTemplateDialog
        open={createFolderOpen}
        onOpenChange={setCreateFolderOpen}
        spaceId={spaceId}
        spaceType="social_media"
      />

      {/* Create View Dialog */}
      <CreateViewDialog
        open={createViewOpen}
        onOpenChange={setCreateViewOpen}
        folderId={selectedFolderId}
        spaceType="social_media"
        onSuccess={(viewId, viewType) => {
          handleViewSelect(viewId, viewType);
        }}
      />

      {/* Delete Folder Confirmation */}
      <AlertDialog 
        open={deleteFolderDialog?.open} 
        onOpenChange={(open) => !open && setDeleteFolderDialog(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir pasta "{deleteFolderDialog?.folderName}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Todos os cards e views dentro desta pasta serão arquivados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => deleteFolderDialog && handleDeleteFolder(deleteFolderDialog.folderId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete View Confirmation */}
      <AlertDialog 
        open={deleteViewDialog?.open} 
        onOpenChange={(open) => !open && setDeleteViewDialog(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir esta view?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A view será removida permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => deleteViewDialog && handleDeleteView(deleteViewDialog.viewId, deleteViewDialog.folderId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
