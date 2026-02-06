import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { useViewTemplates, useCreateFolderViewFromTemplate } from '@/hooks/useViewTemplates';
import { useCreateFolderView } from '@/hooks/useSocialMediaTemplates';
import { useSocialMediaTracking } from '@/hooks/useSocialMediaTracking';
import { useToast } from '@/hooks/use-toast';
import {
  Kanban,
  Calendar,
  List,
  Lightbulb,
  CheckCircle,
  Megaphone,
  BarChart,
  LayoutGrid,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface CreateViewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folderId: string | null;
  spaceType: string;
  onSuccess?: (viewId: string, viewType: string) => void;
}

const iconMap: Record<string, React.ElementType> = {
  kanban: Kanban,
  calendar: Calendar,
  list: List,
  lightbulb: Lightbulb,
  'check-circle': CheckCircle,
  megaphone: Megaphone,
  'bar-chart': BarChart,
  'layout-grid': LayoutGrid,
};

const getIcon = (iconName: string) => iconMap[iconName] || LayoutGrid;

// Default view types when no templates are available
const DEFAULT_VIEW_TYPES = [
  {
    id: 'kanban',
    name: 'Kanban',
    description: 'Organize cards em colunas por status',
    icon: 'kanban',
    view_type: 'kanban',
  },
  {
    id: 'list',
    name: 'Lista',
    description: 'Visualização em tabela detalhada',
    icon: 'list',
    view_type: 'list',
  },
  {
    id: 'calendar',
    name: 'Calendário',
    description: 'Visualize por datas e prazos',
    icon: 'calendar',
    view_type: 'calendar',
  },
  {
    id: 'gantt',
    name: 'Gantt',
    description: 'Timeline para projetos complexos',
    icon: 'bar-chart',
    view_type: 'gantt',
    coming: true,
  },
  {
    id: 'mindmap',
    name: 'Mapa Mental',
    description: 'Visualização em árvore de ideias',
    icon: 'lightbulb',
    view_type: 'mindmap',
    coming: true,
  },
];

export const CreateViewDialog: React.FC<CreateViewDialogProps> = ({
  open,
  onOpenChange,
  folderId,
  spaceType,
  onSuccess,
}) => {
  const { toast } = useToast();
  const { data: templates, isLoading } = useViewTemplates(spaceType);
  const createFromTemplate = useCreateFolderViewFromTemplate();
  const createBasicView = useCreateFolderView();
  const { trackViewCreated } = useSocialMediaTracking();

  const [viewName, setViewName] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [creationMode, setCreationMode] = useState<'template' | 'basic'>('template');

  // Use templates from DB, or fallback to default view types
  const viewOptions = templates && templates.length > 0 ? templates : DEFAULT_VIEW_TYPES;

  // Auto-select first option
  useEffect(() => {
    if (viewOptions.length > 0 && !selectedTemplateId) {
      setSelectedTemplateId(viewOptions[0].id);
    }
  }, [viewOptions, selectedTemplateId]);

  // Reset on open
  useEffect(() => {
    if (open) {
      setViewName('');
      setSelectedTemplateId(viewOptions[0]?.id || null);
      setCreationMode('template');
    }
  }, [open, viewOptions]);

  const selectedOption = viewOptions.find((t) => t.id === selectedTemplateId);

  const handleCreate = async () => {
    if (!folderId) {
      toast({
        title: 'Erro',
        description: 'Nenhuma pasta selecionada.',
        variant: 'destructive',
      });
      return;
    }

    if (!viewName.trim()) {
      toast({
        title: 'Erro',
        description: 'O nome da view é obrigatório.',
        variant: 'destructive',
      });
      return;
    }

    try {
      let view;

      // Check if using a DB template or default view type
      const isDbTemplate = templates && templates.length > 0 && templates.some(t => t.id === selectedTemplateId);

      if (isDbTemplate && selectedTemplateId && selectedOption) {
        view = await createFromTemplate.mutateAsync({
          folderId,
          templateId: selectedTemplateId,
          name: viewName.trim(),
        });

        trackViewCreated({
          folder_id: folderId,
          view_id: view.id,
          view_template: selectedOption.name.toLowerCase().replace(/\s+/g, '_') as any,
          view_name: viewName.trim(),
        });
      } else {
        // Create basic view with selected view type
        const viewType = selectedOption?.view_type || 'list';
        view = await createBasicView.mutateAsync({
          folderId,
          name: viewName.trim(),
          viewType,
        });

        trackViewCreated({
          folder_id: folderId,
          view_id: view.id,
          view_template: viewType as any,
          view_name: viewName.trim(),
        });
      }

      toast({
        title: 'View criada!',
        description: `A view "${viewName}" foi criada com sucesso.`,
      });

      onOpenChange(false);
      onSuccess?.(view.id, view.view_type);
    } catch (error) {
      console.error('Error creating view:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível criar a view.',
        variant: 'destructive',
      });
    }
  };

  const isPending = createFromTemplate.isPending || createBasicView.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nova View</DialogTitle>
          <DialogDescription>
            Crie uma nova visualização para organizar os cards desta pasta.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* View Name */}
          <div className="space-y-2">
            <Label htmlFor="viewName">Nome da View</Label>
            <Input
              id="viewName"
              placeholder="Ex: Cliente X — Demandas"
              value={viewName}
              onChange={(e) => setViewName(e.target.value)}
              autoFocus
            />
          </div>

          {/* Template Selection */}
          <div className="space-y-2">
            <Label>Tipo/Template da View</Label>
            
            {isLoading ? (
              <div className="grid grid-cols-2 gap-2">
                <Skeleton className="h-20" />
                <Skeleton className="h-20" />
                <Skeleton className="h-20" />
                <Skeleton className="h-20" />
              </div>
            ) : (
              <ScrollArea className="h-64">
                <div className="grid grid-cols-2 gap-2 pr-4">
                  {viewOptions.map((option) => {
                    const Icon = getIcon(option.icon);
                    const isSelected = selectedTemplateId === option.id;
                    const isComing = 'coming' in option && option.coming;

                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => {
                          if (!isComing) {
                            setSelectedTemplateId(option.id);
                            setCreationMode('template');
                          }
                        }}
                        disabled={isComing}
                        className={cn(
                          'flex flex-col items-start gap-2 p-3 rounded-lg border-2 transition-all text-left relative',
                          isComing && 'opacity-50 cursor-not-allowed',
                          isSelected
                            ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                            : 'border-border hover:border-muted-foreground/30 hover:bg-muted/50'
                        )}
                      >
                        {isComing && (
                          <span className="absolute top-1 right-1 text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                            Em breve
                          </span>
                        )}
                        <div className="flex items-center gap-2">
                          <div
                            className={cn(
                              'p-1.5 rounded-md',
                              isSelected ? 'bg-primary/10' : 'bg-muted'
                            )}
                          >
                            <Icon
                              className={cn(
                                'h-4 w-4',
                                isSelected ? 'text-primary' : 'text-muted-foreground'
                              )}
                            />
                          </div>
                          <span
                            className={cn(
                              'text-sm font-medium',
                              isSelected ? 'text-primary' : ''
                            )}
                          >
                            {option.name}
                          </span>
                        </div>
                        {option.description && (
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {option.description}
                          </p>
                        )}
                      </button>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleCreate} disabled={isPending || !viewName.trim()}>
            {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Criar View
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
