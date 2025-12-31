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

  // Auto-select first template
  useEffect(() => {
    if (templates && templates.length > 0 && !selectedTemplateId) {
      setSelectedTemplateId(templates[0].id);
    }
  }, [templates, selectedTemplateId]);

  // Reset on open
  useEffect(() => {
    if (open) {
      setViewName('');
      setSelectedTemplateId(templates?.[0]?.id || null);
      setCreationMode('template');
    }
  }, [open, templates]);

  const selectedTemplate = templates?.find((t) => t.id === selectedTemplateId);

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

      if (creationMode === 'template' && selectedTemplateId && selectedTemplate) {
        view = await createFromTemplate.mutateAsync({
          folderId,
          templateId: selectedTemplateId,
          name: viewName.trim(),
        });

        trackViewCreated({
          folder_id: folderId,
          view_id: view.id,
          view_template: selectedTemplate.name.toLowerCase().replace(/\s+/g, '_') as any,
          view_name: viewName.trim(),
        });
      } else {
        view = await createBasicView.mutateAsync({
          folderId,
          name: viewName.trim(),
          viewType: 'list',
        });

        trackViewCreated({
          folder_id: folderId,
          view_id: view.id,
          view_template: 'list' as any,
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
            ) : templates && templates.length > 0 ? (
              <ScrollArea className="h-64">
                <div className="grid grid-cols-2 gap-2 pr-4">
                  {templates.map((template) => {
                    const Icon = getIcon(template.icon);
                    const isSelected = selectedTemplateId === template.id;

                    return (
                      <button
                        key={template.id}
                        type="button"
                        onClick={() => {
                          setSelectedTemplateId(template.id);
                          setCreationMode('template');
                        }}
                        className={cn(
                          'flex flex-col items-start gap-2 p-3 rounded-lg border-2 transition-all text-left',
                          isSelected
                            ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                            : 'border-border hover:border-muted-foreground/30 hover:bg-muted/50'
                        )}
                      >
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
                            {template.name}
                          </span>
                        </div>
                        {template.description && (
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {template.description}
                          </p>
                        )}
                      </button>
                    );
                  })}
                </div>
              </ScrollArea>
            ) : (
              <div className="text-sm text-muted-foreground p-4 border rounded-lg text-center">
                Nenhum template disponível
              </div>
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
