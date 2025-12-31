import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useFolderViews,
  useCreateFolderView,
  useDeleteFolderView,
} from '@/hooks/useSocialMediaTemplates';
import { useToast } from '@/hooks/use-toast';
import {
  Kanban,
  Calendar,
  List,
  Plus,
  ChevronDown,
  Trash2,
  Loader2,
  LayoutGrid,
  CheckCircle2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface FolderViewSwitcherProps {
  folderId: string;
  currentViewId?: string | null;
  onViewChange: (viewId: string | null, viewType: string) => void;
}

const VIEW_TYPE_OPTIONS = [
  { value: 'kanban', label: 'Kanban', icon: Kanban },
  { value: 'list', label: 'Lista', icon: List },
  { value: 'calendar', label: 'Calendário', icon: Calendar },
];

export const FolderViewSwitcher: React.FC<FolderViewSwitcherProps> = ({
  folderId,
  currentViewId,
  onViewChange,
}) => {
  const { toast } = useToast();
  const { data: views, isLoading } = useFolderViews(folderId);
  const createView = useCreateFolderView();
  const deleteView = useDeleteFolderView();

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newViewName, setNewViewName] = useState('');
  const [newViewType, setNewViewType] = useState<string>('kanban');

  const currentView = views?.find((v) => v.id === currentViewId);

  const getViewIcon = (type: string) => {
    const ViewIcon = VIEW_TYPE_OPTIONS.find((v) => v.value === type)?.icon || LayoutGrid;
    return <ViewIcon className="h-4 w-4" />;
  };

  const handleCreateView = async () => {
    if (!newViewName.trim()) {
      toast({
        title: 'Erro',
        description: 'O nome da view é obrigatório.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const view = await createView.mutateAsync({
        folderId,
        name: newViewName.trim(),
        viewType: newViewType,
      });

      toast({
        title: 'View criada!',
        description: 'A nova view foi criada com sucesso.',
      });

      setNewViewName('');
      setNewViewType('kanban');
      setCreateDialogOpen(false);
      onViewChange(view.id, view.view_type);
    } catch (error) {
      console.error('Error creating view:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível criar a view.',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteView = async (viewId: string) => {
    try {
      await deleteView.mutateAsync(viewId);
      toast({
        title: 'View removida',
        description: 'A view foi removida com sucesso.',
      });
      // If we deleted the current view, switch to first available
      if (currentViewId === viewId && views && views.length > 1) {
        const nextView = views.find((v) => v.id !== viewId);
        if (nextView) {
          onViewChange(nextView.id, nextView.view_type);
        }
      }
    } catch (error) {
      console.error('Error deleting view:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível remover a view.',
        variant: 'destructive',
      });
    }
  };

  if (isLoading) {
    return <Skeleton className="h-9 w-40" />;
  }

  if (!views || views.length === 0) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => setCreateDialogOpen(true)}
        className="gap-2"
      >
        <Plus className="h-4 w-4" />
        Criar View
      </Button>
    );
  }

  return (
    <>
      <div className="flex items-center gap-1.5">
        {/* View Tabs */}
        <div className="flex items-center bg-muted/50 rounded-lg p-0.5">
          {views.map((view) => (
            <button
              key={view.id}
              onClick={() => onViewChange(view.id, view.view_type)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                currentViewId === view.id
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {getViewIcon(view.view_type)}
              <span className="hidden sm:inline">{view.name}</span>
            </button>
          ))}
        </div>

        {/* More Actions */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <Plus className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Nova View
            </DropdownMenuItem>
            {currentView && views.length > 1 && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => handleDeleteView(currentView.id)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Remover "{currentView.name}"
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Create View Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova View</DialogTitle>
            <DialogDescription>
              Crie uma nova visualização para organizar os cards desta pasta.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="viewName">Nome da View</Label>
              <Input
                id="viewName"
                placeholder="Ex: Kanban de Produção, Calendário..."
                value={newViewName}
                onChange={(e) => setNewViewName(e.target.value)}
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label>Tipo de Visualização</Label>
              <div className="grid grid-cols-3 gap-2">
                {VIEW_TYPE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setNewViewType(opt.value)}
                    className={cn(
                      'flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-colors',
                      newViewType === opt.value
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:bg-muted/50'
                    )}
                  >
                    <opt.icon className="h-6 w-6" />
                    <span className="text-sm font-medium">{opt.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreateView} disabled={createView.isPending}>
              {createView.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Criar View
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
