import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { useIdeaBoards } from '@/hooks/useIdeaBoards';
import { Loader2 } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  folderId?: string | null;
  onCreated?: (id: string) => void;
}

export const CreateBoardDialog: React.FC<Props> = ({ open, onOpenChange, folderId, onCreated }) => {
  const { create } = useIdeaBoards();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [tags, setTags] = useState('');
  const [coverUrl, setCoverUrl] = useState('');

  const submit = async () => {
    if (!name.trim()) return;
    const board = await create.mutateAsync({
      name: name.trim(),
      description: description.trim() || null,
      category: category.trim() || null,
      tags: tags.split(',').map(s => s.trim()).filter(Boolean),
      cover_url: coverUrl.trim() || null,
      folder_id: folderId ?? null,
    });
    onCreated?.(board.id);
    setName(''); setDescription(''); setCategory(''); setTags(''); setCoverUrl('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nova pasta de ideias</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <label className="text-sm font-medium mb-1.5 block">Nome *</label>
            <Input placeholder="Ex: Campanhas de verão" value={name} onChange={e => setName(e.target.value)} autoFocus />
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Descrição</label>
            <Textarea rows={2} placeholder="Sobre o que é esta pasta?" value={description} onChange={e => setDescription(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Categoria</label>
              <Input placeholder="Ex: Anúncios" value={category} onChange={e => setCategory(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Tags</label>
              <Input placeholder="instagram, ugc" value={tags} onChange={e => setTags(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">URL da capa (opcional)</label>
            <Input placeholder="https://..." value={coverUrl} onChange={e => setCoverUrl(e.target.value)} />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={!name.trim() || create.isPending}>
            {create.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Criar pasta
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
