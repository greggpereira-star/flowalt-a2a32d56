import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useSpaces } from '@/hooks/useSpaces';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { IdeaReference } from '@/hooks/useIdeaReferences';
import { Loader2, MessageSquarePlus, Layers } from 'lucide-react';

interface Props {
  /** Single-reference mode */
  reference?: IdeaReference | null;
  /** Board mode: pass the full reference list of the folder to convert all of them at once */
  boardReferences?: IdeaReference[];
  boardId?: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  boardName?: string;
}

export const CreateCardFromIdeaDialog: React.FC<Props> = ({
  reference, boardReferences, boardId, open, onOpenChange, boardName,
}) => {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { currentWorkspace } = useWorkspace();
  const { data: spaces } = useSpaces();

  const isBoardMode = !!boardReferences && boardReferences.length > 0 && !reference;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [spaceId, setSpaceId] = useState('');
  const [urgency, setUrgency] = useState<'low' | 'medium' | 'high' | 'critical'>('medium');
  const [dueDate, setDueDate] = useState('');
  const [cardType, setCardType] = useState<'quick' | 'briefing'>(isBoardMode ? 'briefing' : 'quick');
  const [submitting, setSubmitting] = useState(false);

  // Thumbnails for the board-mode preview strip
  const thumbs = useMemo(
    () => (boardReferences || [])
      .map(r => r.thumbnail_url || r.media_url)
      .filter((u): u is string => !!u)
      .slice(0, 8),
    [boardReferences]
  );

  useEffect(() => {
    if (!open) return;
    if (isBoardMode) {
      setTitle(boardName ? `Campanha · ${boardName}` : 'Nova demanda do moodboard');
      setDescription(
        `Demanda criada a partir do moodboard "${boardName ?? ''}" com ${boardReferences!.length} referências anexadas.`
      );
      setCardType('briefing');
    } else if (reference) {
      setTitle(reference.title);
      setDescription(reference.description || '');
      setCardType('quick');
    }
  }, [open, isBoardMode, boardName, boardReferences, reference]);

  const submit = async () => {
    if (!currentWorkspace || !spaceId || !title.trim()) return;
    if (!isBoardMode && !reference) return;
    setSubmitting(true);
    try {
      const user = (await supabase.auth.getUser()).data.user;
      const { data: card, error } = await (supabase as any)
        .from('cards')
        .insert({
          workspace_id: currentWorkspace.id,
          space_id: spaceId,
          title: title.trim(),
          description: description.trim() || null,
          urgency,
          due_date: dueDate ? new Date(dueDate).toISOString() : null,
          owner_id: user?.id,
          created_by: user?.id,
          card_type: cardType === 'quick' ? 'quick' : 'demand',
          briefing_completed: cardType === 'quick',
        })
        .select()
        .single();
      if (error) throw error;

      // Link references → card (one row per reference)
      const refIds = isBoardMode
        ? boardReferences!.map(r => r.id)
        : [reference!.id];

      const links = refIds.map(rid => ({
        reference_id: rid,
        card_id: card.id,
        workspace_id: currentWorkspace.id,
        created_by: user?.id,
      }));
      if (links.length > 0) {
        await (supabase as any).from('idea_card_links').insert(links);
      }

      // Audit
      await (supabase as any).from('idea_audit_log').insert({
        workspace_id: currentWorkspace.id,
        entity_type: 'card_link',
        entity_id: card.id,
        action: isBoardMode ? 'card_from_board' : 'card_from_idea',
        user_id: user?.id,
        metadata: {
          board_id: boardId,
          board_name: boardName,
          reference_count: refIds.length,
        },
      });

      toast({
        title: 'Card criado',
        description: isBoardMode
          ? `"${title}" criado com ${refIds.length} referências anexadas.`
          : `"${title}" foi criado a partir da ideia.`,
      });
      qc.invalidateQueries({ queryKey: ['cards'] });
      refIds.forEach(rid => qc.invalidateQueries({ queryKey: ['idea-card-links', rid] }));
      onOpenChange(false);
      setTitle(''); setDescription(''); setDueDate('');
    } catch (e: any) {
      toast({ title: 'Erro ao criar card', description: e.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isBoardMode ? <Layers className="h-5 w-5" /> : <MessageSquarePlus className="h-5 w-5" />}
            {isBoardMode ? 'Transformar pasta em demanda' : 'Criar card a partir da ideia'}
          </DialogTitle>
        </DialogHeader>

        {isBoardMode && thumbs.length > 0 && (
          <div className="rounded-lg border bg-muted/20 p-2">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground">
                Moodboard anexado
              </span>
              <Badge variant="secondary" className="text-[10px]">
                {boardReferences!.length} referência{boardReferences!.length === 1 ? '' : 's'}
              </Badge>
            </div>
            <div className="grid grid-cols-4 gap-1">
              {thumbs.map((src, i) => (
                <img
                  key={i}
                  src={src}
                  alt=""
                  loading="lazy"
                  className="aspect-square w-full object-cover rounded-md"
                />
              ))}
            </div>
          </div>
        )}

        <div className="space-y-3 py-2">
          <div>
            <label className="text-sm font-medium mb-1.5 block">Espaço *</label>
            <Select value={spaceId} onValueChange={setSpaceId}>
              <SelectTrigger><SelectValue placeholder="Selecione o espaço" /></SelectTrigger>
              <SelectContent>
                {spaces?.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium mb-1.5 block">Tipo de card</label>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant={cardType === 'quick' ? 'default' : 'outline'}
                size="sm" onClick={() => setCardType('quick')}
              >Card rápido</Button>
              <Button
                variant={cardType === 'briefing' ? 'default' : 'outline'}
                size="sm" onClick={() => setCardType('briefing')}
              >Nova demanda (briefing)</Button>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium mb-1.5 block">Título *</label>
            <Input value={title} onChange={e => setTitle(e.target.value)} />
          </div>

          <div>
            <label className="text-sm font-medium mb-1.5 block">Descrição</label>
            <Textarea rows={3} value={description} onChange={e => setDescription(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Prazo</label>
              <Input type="datetime-local" value={dueDate} onChange={e => setDueDate(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Urgência</label>
              <Select value={urgency} onValueChange={(v: any) => setUrgency(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Baixa</SelectItem>
                  <SelectItem value="medium">Média</SelectItem>
                  <SelectItem value="high">Alta</SelectItem>
                  <SelectItem value="critical">Crítica</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={!spaceId || !title.trim() || submitting}>
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {isBoardMode ? 'Criar card com moodboard' : 'Criar card'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
