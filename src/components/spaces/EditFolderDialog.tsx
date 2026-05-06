import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useUpdateFolder } from '@/hooks/useFolders';
import { useToast } from '@/hooks/use-toast';

interface EditFolderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folder: { id: string; name: string } | null;
}

export const EditFolderDialog: React.FC<EditFolderDialogProps> = ({
  open,
  onOpenChange,
  folder,
}) => {
  const [name, setName] = useState('');
  const updateFolder = useUpdateFolder();
  const { toast } = useToast();

  useEffect(() => {
    if (folder) {
      setName(folder.name);
    }
  }, [folder]);

  const handleSave = async () => {
    if (!folder || !name.trim()) return;

    try {
      await updateFolder.mutateAsync({
        id: folder.id,
        name: name.trim(),
      });
      toast({
        title: 'Pasta atualizada',
        description: 'O nome da pasta foi alterado com sucesso.',
      });
      onOpenChange(false);
    } catch (error) {
      toast({
        title: 'Erro ao atualizar pasta',
        description: 'Não foi possível alterar o nome da pasta.',
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar Pasta</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="folder-name">Nome da Pasta</Label>
            <Input
              id="folder-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Digite o nome da pasta"
              autoFocus
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={updateFolder.isPending || !name.trim()}>
            {updateFolder.isPending ? 'Salvando...' : 'Salvar Alterações'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
