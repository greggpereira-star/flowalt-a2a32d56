import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useIdeaBoards, IdeaBoard } from '@/hooks/useIdeaBoards';
import { useToast } from '@/hooks/use-toast';
import { Copy, ExternalLink, Globe, Link2, Loader2 } from 'lucide-react';

interface Props {
  board: IdeaBoard | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

export const ShareBoardDialog: React.FC<Props> = ({ board, open, onOpenChange }) => {
  const { enableShare, disableShare } = useIdeaBoards();
  const { toast } = useToast();
  const [enabled, setEnabled] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [expiresIn, setExpiresIn] = useState<'never' | '7d' | '30d'>('never');

  useEffect(() => {
    if (board && open) {
      setEnabled(!!board.is_public);
      setToken(board.share_token ?? null);
    }
  }, [board, open]);

  if (!board) return null;
  const shareUrl = token ? `${window.location.origin}/share/board/${token}` : '';

  const handleToggle = async (next: boolean) => {
    setEnabled(next);
    if (!next) {
      await disableShare.mutateAsync(board.id);
      setToken(null);
    } else {
      const expiresAt = expiresIn === '7d'
        ? new Date(Date.now() + 7 * 86400000).toISOString()
        : expiresIn === '30d'
          ? new Date(Date.now() + 30 * 86400000).toISOString()
          : null;
      const t = await enableShare.mutateAsync({ boardId: board.id, expiresAt });
      setToken(t);
    }
  };

  const copy = async () => {
    await navigator.clipboard.writeText(shareUrl);
    toast({ title: 'Link copiado' });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" /> Compartilhar moodboard
          </DialogTitle>
          <DialogDescription>
            Gere um link público (somente leitura) para compartilhar essa pasta com clientes ou colegas externos.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label className="text-sm font-medium">Link público ativo</Label>
              <p className="text-xs text-muted-foreground">Qualquer pessoa com o link visualiza as referências.</p>
            </div>
            <Switch checked={enabled} onCheckedChange={handleToggle} disabled={enableShare.isPending || disableShare.isPending} />
          </div>

          {!enabled && (
            <div className="space-y-2">
              <Label className="text-xs">Expiração</Label>
              <div className="flex gap-2">
                {(['never', '7d', '30d'] as const).map(opt => (
                  <Button key={opt} size="sm" variant={expiresIn === opt ? 'secondary' : 'outline'}
                    onClick={() => setExpiresIn(opt)}>
                    {opt === 'never' ? 'Nunca' : opt === '7d' ? '7 dias' : '30 dias'}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {enabled && token && (
            <div className="space-y-2">
              <Label className="text-xs flex items-center gap-1"><Link2 className="h-3 w-3" /> URL pública</Label>
              <div className="flex gap-2">
                <Input value={shareUrl} readOnly className="text-xs" />
                <Button size="icon" variant="outline" onClick={copy}><Copy className="h-4 w-4" /></Button>
                <Button size="icon" variant="outline" onClick={() => window.open(shareUrl, '_blank')}>
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
              {board.share_expires_at && (
                <p className="text-[11px] text-muted-foreground">
                  Expira em {new Date(board.share_expires_at).toLocaleDateString('pt-BR')}
                </p>
              )}
            </div>
          )}

          {(enableShare.isPending || disableShare.isPending) && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" /> Aplicando alterações...
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
