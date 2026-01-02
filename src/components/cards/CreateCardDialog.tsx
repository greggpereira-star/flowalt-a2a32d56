import React, { useState, useMemo } from 'react';
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
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AccessImpactSummary } from '@/components/governance/AccessImpactSummary';
import { useCreateCard } from '@/hooks/useCards';
import { useClientCards } from '@/hooks/useClientCards';
import { useToast } from '@/hooks/use-toast';
import { getErrorMessage } from '@/lib/utils';
import { Loader2, Building2, BanknoteIcon, Users } from 'lucide-react';
import type { CardStatus, CardUrgency } from '@/lib/supabase';
import { statusConfig, urgencyConfig } from './CardBadges';


interface CreateCardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  spaceId: string;
  folderId?: string;
  defaultStatus?: CardStatus;
}

export const CreateCardDialog: React.FC<CreateCardDialogProps> = ({
  open,
  onOpenChange,
  spaceId,
  folderId,
  defaultStatus = 'backlog',
}) => {
  const { toast } = useToast();
  const createCard = useCreateCard();
  const { data: clientCards } = useClientCards();

  // Use client_cards as the source for clients (new system)
  const allClients = useMemo(() => {
    if (!clientCards) return [];
    return clientCards
      .filter(c => c.status === 'active')
      .map(c => ({ id: c.id, name: c.name, color: c.color }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [clientCards]);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<CardStatus>(defaultStatus);
  const [urgency, setUrgency] = useState<CardUrgency>('medium');
  const [dueDate, setDueDate] = useState('');
  const [clientId, setClientId] = useState<string>('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      toast({
        title: 'Erro',
        description: 'O título é obrigatório.',
        variant: 'destructive',
      });
      return;
    }

    try {
      await createCard.mutateAsync({
        title: title.trim(),
        description: description.trim() || undefined,
        space_id: spaceId,
        folder_id: folderId,
        status,
        urgency,
        due_date: dueDate || undefined,
        client_id: clientId || undefined,
      });

      toast({
        title: 'Card criado!',
        description: 'O card foi criado com sucesso.',
      });

      // Reset form
      setTitle('');
      setDescription('');
      setStatus(defaultStatus);
      setUrgency('medium');
      setDueDate('');
      setClientId('');
      onOpenChange(false);
    } catch (error) {
      const message = getErrorMessage(error, 'Não foi possível criar o card.');
      console.error('CreateCardDialog: create card failed', error);
      toast({
        title: 'Erro',
        description: message,
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Novo Card</DialogTitle>
            <DialogDescription>
              Crie uma nova tarefa. O briefing pode ser preenchido depois.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">Título *</Label>
              <Input
                id="title"
                placeholder="Ex: Criar posts para campanha X"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descrição</Label>
              <Textarea
                id="description"
                placeholder="Descrição breve da tarefa..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={status} onValueChange={(v) => setStatus(v as CardStatus)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(statusConfig).map(([key, config]) => (
                      key !== 'archived' && (
                        <SelectItem key={key} value={key}>
                          {config.label}
                        </SelectItem>
                      )
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Urgência</Label>
                <Select value={urgency} onValueChange={(v) => setUrgency(v as CardUrgency)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(urgencyConfig).map(([key, config]) => (
                      <SelectItem key={key} value={key}>
                        {config.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="dueDate">Prazo</Label>
                <Input
                  id="dueDate"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5" />
                  Cliente
                  {!clientId && (
                    <Badge variant="outline" className="text-[9px] h-4 text-muted-foreground ml-1">
                      <BanknoteIcon className="h-2.5 w-2.5 mr-0.5" />
                      Não faturável
                    </Badge>
                  )}
                </Label>
                <Select
                  value={clientId || '__none__'}
                  onValueChange={(v) => setClientId(v === '__none__' ? '' : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecionar cliente..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <BanknoteIcon className="h-3 w-3" />
                        Sem cliente (Não faturável)
                      </div>
                    </SelectItem>
                    {allClients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        <div className="flex items-center gap-2">
                          {client.color && (
                            <div 
                              className="w-2 h-2 rounded-full" 
                              style={{ backgroundColor: client.color }}
                            />
                          )}
                          {!client.color && <Building2 className="h-3 w-3 text-muted-foreground" />}
                          {client.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Access Impact Summary - shows who will see the card */}
            <div className="pt-2 border-t">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
                <Users className="h-3.5 w-3.5" />
                <span>Visibilidade do card</span>
              </div>
              <AccessImpactSummary
                entityType="card"
                targetVisibility="public"
                showDetails={false}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={createCard.isPending}>
              {createCard.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Criar Card
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
