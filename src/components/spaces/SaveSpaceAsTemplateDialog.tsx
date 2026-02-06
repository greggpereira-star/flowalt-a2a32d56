import React, { useState } from 'react';
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
import { Textarea } from '@/components/ui/textarea';
import { useFolders } from '@/hooks/useFolders';
import { useSaveSpaceAsTemplate } from '@/hooks/useSpaceTemplateActions';
import { Loader2, Folder, Eye, Save } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SaveSpaceAsTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  spaceId: string;
  spaceName: string;
  spaceIcon: string;
  spaceColor: string;
}

export const SaveSpaceAsTemplateDialog: React.FC<SaveSpaceAsTemplateDialogProps> = ({
  open,
  onOpenChange,
  spaceId,
  spaceName,
  spaceIcon,
  spaceColor,
}) => {
  const [name, setName] = useState(`Template - ${spaceName}`);
  const [description, setDescription] = useState('');
  
  const { data: folders, isLoading: foldersLoading } = useFolders(spaceId);
  const saveTemplate = useSaveSpaceAsTemplate();

  // Filter out personal folders
  const sharedFolders = folders?.filter(f => !f.is_personal) || [];

  const handleSave = async () => {
    if (!name.trim()) return;

    await saveTemplate.mutateAsync({
      spaceId,
      name: name.trim(),
      description: description.trim() || undefined,
      icon: spaceIcon,
      color: spaceColor,
    });

    onOpenChange(false);
    resetForm();
  };

  const resetForm = () => {
    setName(`Template - ${spaceName}`);
    setDescription('');
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      resetForm();
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Save className="w-5 h-5 text-primary" />
            Salvar como Template
          </DialogTitle>
          <DialogDescription>
            Salve a estrutura atual do espaço para reutilizar em novos espaços.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Template Name */}
          <div className="space-y-2">
            <Label htmlFor="template-name">Nome do Template</Label>
            <Input
              id="template-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Meu Template de Projetos"
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="template-description">Descrição (opcional)</Label>
            <Textarea
              id="template-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descreva quando usar este template..."
              rows={2}
            />
          </div>

          {/* Preview */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Eye className="w-4 h-4" />
              O que será salvo
            </Label>
            <div className="bg-muted/50 rounded-lg p-3 space-y-2 max-h-48 overflow-auto">
              {foldersLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Carregando...
                </div>
              ) : sharedFolders.length > 0 ? (
                sharedFolders.map((folder) => (
                  <div 
                    key={folder.id}
                    className="flex items-center gap-2 text-sm"
                  >
                    <Folder 
                      className="w-4 h-4 flex-shrink-0" 
                      style={{ color: folder.color || undefined }}
                    />
                    <span>{folder.name}</span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">
                  Nenhuma pasta compartilhada para salvar. 
                  Crie algumas pastas primeiro.
                </p>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Pastas pessoais não são incluídas no template.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancelar
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={!name.trim() || sharedFolders.length === 0 || saveTemplate.isPending}
          >
            {saveTemplate.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Salvar Template
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
