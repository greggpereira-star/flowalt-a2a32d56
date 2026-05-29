import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useIdeaBoards } from '@/hooks/useIdeaBoards';
import { Search, FolderOpen } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  excludeBoardId?: string;
  count: number;
  onConfirm: (boardId: string) => void;
}

export const MoveToBoardDialog: React.FC<Props> = ({ open, onOpenChange, excludeBoardId, count, onConfirm }) => {
  const { boards } = useIdeaBoards();
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return boards
      .filter(b => b.id !== excludeBoardId)
      .filter(b => !q.trim() || b.name.toLowerCase().includes(q.toLowerCase()));
  }, [boards, q, excludeBoardId]);

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) { setSelected(null); setQ(''); } }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Mover {count} {count === 1 ? 'referência' : 'referências'}</DialogTitle>
          <DialogDescription>Selecione a pasta de destino.</DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar pasta..." className="pl-8" />
        </div>

        <div className="max-h-72 overflow-auto space-y-1">
          {filtered.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">Nenhuma pasta disponível.</p>
          )}
          {filtered.map(b => (
            <button
              key={b.id}
              onClick={() => setSelected(b.id)}
              className={cn(
                'w-full flex items-center gap-2 p-2 rounded-md text-left text-sm hover:bg-muted transition-colors',
                selected === b.id && 'bg-primary/10 ring-1 ring-primary'
              )}
            >
              <FolderOpen className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <span className="truncate flex-1">{b.name}</span>
              <span className="text-xs text-muted-foreground">{b.reference_count ?? 0}</span>
            </button>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button disabled={!selected} onClick={() => { if (selected) { onConfirm(selected); onOpenChange(false); setSelected(null); } }}>
            Mover
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
