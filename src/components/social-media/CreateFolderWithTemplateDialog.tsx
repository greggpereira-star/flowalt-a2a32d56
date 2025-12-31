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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { useCreateFolder } from '@/hooks/useFolders';
import { useFolderTemplates, useApplyFolderTemplate } from '@/hooks/useSocialMediaTemplates';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useToast } from '@/hooks/use-toast';
import {
  Loader2,
  Folder,
  LayoutTemplate,
  Kanban,
  Calendar,
  List,
  CheckCircle2,
} from 'lucide-react';

interface CreateFolderWithTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  spaceId: string;
  spaceType?: string;
  collaboratorName?: string;
}

export const CreateFolderWithTemplateDialog: React.FC<CreateFolderWithTemplateDialogProps> = ({
  open,
  onOpenChange,
  spaceId,
  spaceType = 'default',
  collaboratorName,
}) => {
  const { toast } = useToast();
  const { currentWorkspace } = useWorkspace();
  const createFolder = useCreateFolder();
  const applyTemplate = useApplyFolderTemplate();
  const { data: templates, isLoading: templatesLoading } = useFolderTemplates(spaceType);

  const [folderName, setFolderName] = useState('');
  const [creationMode, setCreationMode] = useState<'empty' | 'template'>('template');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);

  // Auto-suggest folder name for social media
  useEffect(() => {
    if (open && spaceType === 'social_media' && collaboratorName) {
      setFolderName(`Social — ${collaboratorName}`);
    }
  }, [open, spaceType, collaboratorName]);

  // Auto-select first template
  useEffect(() => {
    if (templates && templates.length > 0 && !selectedTemplateId) {
      setSelectedTemplateId(templates[0].id);
    }
  }, [templates, selectedTemplateId]);

  const handleCreate = async () => {
    if (!currentWorkspace || !folderName.trim()) return;

    try {
      // Create the folder
      const folder = await createFolder.mutateAsync({
        space_id: spaceId,
        name: folderName.trim(),
      });

      // If template mode and template selected, apply it
      if (creationMode === 'template' && selectedTemplateId) {
        await applyTemplate.mutateAsync({
          folderId: folder.id,
          templateId: selectedTemplateId,
        });
      }

      toast({
        title: 'Pasta criada!',
        description: creationMode === 'template' 
          ? 'A pasta foi criada com as views do template.'
          : 'A pasta foi criada vazia.',
      });

      // Reset and close
      setFolderName('');
      setCreationMode('template');
      setSelectedTemplateId(null);
      onOpenChange(false);
    } catch (error) {
      console.error('Error creating folder:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível criar a pasta.',
        variant: 'destructive',
      });
    }
  };

  const selectedTemplate = templates?.find(t => t.id === selectedTemplateId);

  const getViewIcon = (viewType: string) => {
    switch (viewType) {
      case 'kanban':
        return <Kanban className="h-4 w-4" />;
      case 'calendar':
        return <Calendar className="h-4 w-4" />;
      case 'list':
        return <List className="h-4 w-4" />;
      default:
        return <List className="h-4 w-4" />;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Folder className="h-5 w-5 text-primary" />
            Nova Pasta
          </DialogTitle>
          <DialogDescription>
            {spaceType === 'social_media' 
              ? 'Crie uma pasta para organizar o conteúdo do colaborador.'
              : 'Crie uma pasta para organizar seus cards.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-4">
          {/* Folder Name */}
          <div className="space-y-2">
            <Label htmlFor="folderName">Nome da Pasta</Label>
            <Input
              id="folderName"
              placeholder={spaceType === 'social_media' 
                ? 'Ex: Social — Nome do Colaborador' 
                : 'Ex: Cliente X, Campanha Y...'}
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              autoFocus
            />
            {spaceType === 'social_media' && (
              <p className="text-xs text-muted-foreground">
                💡 Sugestão: use o padrão "Social — Nome" para facilitar a organização.
              </p>
            )}
          </div>

          <Separator />

          {/* Creation Mode */}
          <div className="space-y-3">
            <Label>Como criar?</Label>
            <RadioGroup
              value={creationMode}
              onValueChange={(v) => setCreationMode(v as 'empty' | 'template')}
              className="grid grid-cols-2 gap-3"
            >
              <div className="relative">
                <RadioGroupItem
                  value="empty"
                  id="empty"
                  className="peer sr-only"
                />
                <Label
                  htmlFor="empty"
                  className="flex flex-col items-center gap-2 p-4 rounded-lg border-2 cursor-pointer transition-colors peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 hover:bg-muted/50"
                >
                  <Folder className="h-8 w-8 text-muted-foreground" />
                  <span className="font-medium">Pasta Vazia</span>
                  <span className="text-xs text-muted-foreground text-center">
                    Organize do seu jeito
                  </span>
                </Label>
              </div>

              <div className="relative">
                <RadioGroupItem
                  value="template"
                  id="template"
                  className="peer sr-only"
                />
                <Label
                  htmlFor="template"
                  className="flex flex-col items-center gap-2 p-4 rounded-lg border-2 cursor-pointer transition-colors peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 hover:bg-muted/50"
                >
                  <LayoutTemplate className="h-8 w-8 text-primary" />
                  <span className="font-medium">Com Template</span>
                  <span className="text-xs text-muted-foreground text-center">
                    Views prontas para usar
                  </span>
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Template Selection */}
          {creationMode === 'template' && (
            <div className="space-y-3">
              <Label>Escolha o Template</Label>
              {templatesLoading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : templates && templates.length > 0 ? (
                <RadioGroup
                  value={selectedTemplateId || ''}
                  onValueChange={setSelectedTemplateId}
                  className="space-y-2"
                >
                  {templates.map((template) => (
                    <div key={template.id} className="relative">
                      <RadioGroupItem
                        value={template.id}
                        id={template.id}
                        className="peer sr-only"
                      />
                      <Label
                        htmlFor={template.id}
                        className="flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 hover:bg-muted/50"
                      >
                        <CheckCircle2 className="h-5 w-5 mt-0.5 text-primary opacity-0 peer-data-[state=checked]:opacity-100 transition-opacity" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{template.name}</span>
                            {template.is_default && (
                              <Badge variant="secondary" className="text-xs">
                                Recomendado
                              </Badge>
                            )}
                          </div>
                          {template.description && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {template.description}
                            </p>
                          )}
                        </div>
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              ) : (
                <p className="text-sm text-muted-foreground py-2">
                  Nenhum template disponível para este tipo de espaço.
                </p>
              )}

              {/* Template Preview */}
              {selectedTemplate && selectedTemplate.template_config && (
                <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Views incluídas
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {(selectedTemplate.template_config as { views?: Array<{ name: string; type: string }> }).views?.map((view, idx) => (
                      <Badge 
                        key={idx} 
                        variant="outline" 
                        className="gap-1.5 py-1"
                      >
                        {getViewIcon(view.type)}
                        {view.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleCreate}
            disabled={!folderName.trim() || createFolder.isPending || applyTemplate.isPending}
          >
            {(createFolder.isPending || applyTemplate.isPending) && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Criar Pasta
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
