import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useSpaces } from '@/hooks/useSpaces';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { IdeaReference } from '@/hooks/useIdeaReferences';
import { Loader2, MessageSquarePlus } from 'lucide-react';

interface Props {
  reference: IdeaReference | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  boardName?: string;
}

export const CreateCardFromIdeaDialog: React.FC<Props> = ({ reference, open, onOpenChange, boardName }) => {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { currentWorkspace } = useWorkspace();
  const { data: spaces } = useSpaces();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [spaceId, setSpaceId] = useState('');
  const [urgency, setUrgency] = useState<'low' | 'medium' | 'high' | 'critical'>('medium');
  const [dueDate, setDueDate] = useState('');
  const [cardType, setCardType] = useState<'quick' | 'briefing'>('quick');
  const [submitting, setSubmitting] = useState(false);

  // (title/description are synced when the dialog opens, via onOpenChange below)


  const submit = async () => {
    if (!reference || !currentWorkspace || !spaceId || !title.trim()) return;
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

      // Link reference ↔ card
      await (supabase as any).from('idea_card_links').insert({
        reference_id: reference.id,
        card_id: card.id,
        workspace_id: currentWorkspace.id,
        created_by: user?.id,
      });

      // Audit
      await (supabase as any).from('idea_audit_log').insert({
        workspace_id: currentWorkspace.id,
        entity_type: 'card_link',
        entity_id: card.id,
        action: 'card_from_idea',
        user_id: user?.id,
        metadata: { reference_id: reference.id, board_name: boardName },
      });

      toast({ title: 'Card criado', description: `"${title}" foi criado a partir da ideia.` });
      qc.invalidateQueries({ queryKey: ['cards'] });
      qc.invalidateQueries({ queryKey: ['idea-card-links', reference.id] });
      onOpenChange(false);
      setTitle(''); setDescription(''); setDueDate('');
    } catch (e: any) {
      toast({ title: 'Erro ao criar card', description: e.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => {
      if (o && reference) { setTitle(reference.title); setDescription(reference.description || ''); }
      onOpenChange(o);
    }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquarePlus className="h-5 w-5" />Criar card a partir da ideia
          </DialogTitle>
        </DialogHeader>

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
            Criar card
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
