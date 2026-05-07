import React, { useEffect, useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
} from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useIsMobile } from '@/hooks/use-mobile';
import { useCreateCard, useShareCardAcrossSpaces } from '@/hooks/useCards';
import { useWorkspaceMembers } from '@/hooks/useWorkspaceMembers';
import { useClientCards } from '@/hooks/useClientCards';
import { useSpaces } from '@/hooks/useSpaces';
import { useToast } from '@/hooks/use-toast';
import { cn, getErrorMessage } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import {
  CalendarIcon,
  Plus,
  X,
  CheckSquare,
  Paperclip,
  Upload,
  Copy,
  Users,
} from 'lucide-react';
import type { CardStatus, CardUrgency } from '@/lib/supabase';


type QuickAddMode = 'quick' | 'full';

interface QuickAddCardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  spaceId: string;
  folderId?: string;
  defaultStatus?: CardStatus;
  initialMode?: QuickAddMode;
  isSocialMedia?: boolean;
}

const STATUS_OPTIONS: { value: CardStatus; label: string }[] = [
  { value: 'backlog', label: 'Backlog' },
  { value: 'briefing', label: 'Briefing' },
  { value: 'todo', label: 'A Fazer' },
  { value: 'in_progress', label: 'Em Progresso' },
];

const URGENCY_OPTIONS: { value: CardUrgency; label: string; color: string }[] = [
  { value: 'low', label: 'Baixa', color: 'bg-slate-500' },
  { value: 'medium', label: 'Média', color: 'bg-blue-500' },
  { value: 'high', label: 'Alta', color: 'bg-orange-500' },
  { value: 'critical', label: 'Crítica', color: 'bg-red-500' },
];

interface ChecklistItem {
  id: string;
  title: string;
}

export const QuickAddCard: React.FC<QuickAddCardProps> = ({
  open,
  onOpenChange,
  spaceId,
  folderId,
  defaultStatus = 'backlog',
  initialMode = 'quick',
  isSocialMedia = false,
}) => {
  const isMobile = useIsMobile();
  const { toast } = useToast();
  const createCard = useCreateCard();
  const shareCard = useShareCardAcrossSpaces();
  const { data: members } = useWorkspaceMembers();
  const { data: clientCards } = useClientCards();
  const { data: spaces } = useSpaces();
  
  // Use only active clients from client_cards (new system)
  const clients = useMemo(() => {
    if (!clientCards) return [];
    return clientCards
      .filter(c => c.status === 'active')
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [clientCards]);

  // Form state
  const [mode, setMode] = useState<QuickAddMode>(initialMode);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<CardStatus>(defaultStatus);
  const [urgency, setUrgency] = useState<CardUrgency>('medium');
  const [dueDate, setDueDate] = useState<Date | undefined>();
  const [ownerId, setOwnerId] = useState<string>('');
  const [clientId, setClientId] = useState<string>('');
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [newChecklistItem, setNewChecklistItem] = useState('');
  
  // Cross-sector duplication
  const [isDuplicateEnabled, setIsDuplicateEnabled] = useState(false);
  const [duplicateToSpace, setDuplicateToSpace] = useState<string>('');

  useEffect(() => {
    if (open) setMode(initialMode);
  }, [open, initialMode]);

  // Reset form
  const resetForm = () => {
    setTitle('');
    setDescription('');
    setStatus(defaultStatus);
    setUrgency('medium');
    setDueDate(undefined);
    setOwnerId('');
    setClientId('');
    setChecklist([]);
    setNewChecklistItem('');
    setMode(initialMode);
    setIsDuplicateEnabled(false);
    setDuplicateToSpace('');
  };

  // Add checklist item
  const addChecklistItem = () => {
    if (!newChecklistItem.trim()) return;
    setChecklist([
      ...checklist,
      { id: Date.now().toString(), title: newChecklistItem },
    ]);
    setNewChecklistItem('');
  };

  // Remove checklist item
  const removeChecklistItem = (id: string) => {
    setChecklist(checklist.filter(item => item.id !== id));
  };

  // Submit handler
  const handleSubmit = async () => {
    if (!title.trim()) {
      toast({
        title: 'Título obrigatório',
        variant: 'destructive',
      });
      return;
    }

    try {
      const result = await createCard.mutateAsync({
        title,
        space_id: spaceId,
        folder_id: folderId,
        description: description || undefined,
        status,
        urgency,
        due_date: dueDate?.toISOString(),
        client_id: clientId || undefined,
        owner_id: ownerId || undefined,
        card_type: mode === 'quick' ? 'quick' : 'full',
      });

      // Handle cross-sector visibility using junction table card_spaces
      if (isDuplicateEnabled && duplicateToSpace) {
        try {
          await shareCard.mutateAsync({
            cardId: result.id,
            spaceId: duplicateToSpace,
          });
        } catch (dupError) {
          console.error('Error sharing card across spaces:', dupError);
        }
      }

      toast({ title: 'Card criado com sucesso!' });
      resetForm();
      onOpenChange(false);
    } catch (error) {
      const message = getErrorMessage(error, 'Não foi possível criar o card.');
      console.error('QuickAddCard: create card failed', error);
      toast({
        title: 'Erro ao criar card',
        description: message,
        variant: 'destructive',
      });
    }
  };

  const content = (
    <div className="space-y-4">
      <div className="grid w-full grid-cols-2 gap-1 rounded-md bg-muted p-1">
        <Button
          type="button"
          variant={mode === 'quick' ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => setMode('quick')}
          className="justify-center"
        >
          Rápido
        </Button>
        <Button
          type="button"
          variant={mode === 'full' ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => setMode('full')}
          className="justify-center"
        >
          Completo
        </Button>
      </div>

      {mode === 'quick' ? (
        <div className="space-y-4">
          {/* Title */}
          <div className="space-y-2">
            <Label>Título *</Label>
            <Input
              placeholder="Nome da tarefa..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
            />
          </div>

          {/* Quick options row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Urgência</Label>
              <Select value={urgency} onValueChange={(v: CardUrgency) => setUrgency(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {URGENCY_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      <div className="flex items-center gap-2">
                        <div className={cn('w-2 h-2 rounded-full', opt.color)} />
                        {opt.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Prazo</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal',
                      !dueDate && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dueDate ? format(dueDate, 'dd/MM', { locale: ptBR }) : 'Definir'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={dueDate} onSelect={setDueDate} locale={ptBR} />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Responsible */}
          <div className="space-y-2">
            <Label>Responsável</Label>
            <Select value={ownerId} onValueChange={setOwnerId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecionar..." />
              </SelectTrigger>
              <SelectContent>
                {members?.map((member) => (
                  <SelectItem key={member.user_id} value={member.user_id}>
                    {member.profile?.full_name || member.profile?.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      ) : (
        <ScrollArea className="h-[400px] pr-4">
          <div className="space-y-4">
            {/* Title */}
            <div className="space-y-2">
              <Label>Título *</Label>
              <Input
                placeholder="Nome da tarefa..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                autoFocus
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea
                placeholder="Descreva a tarefa..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>

            {/* Status and Urgency */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={status} onValueChange={(v: CardStatus) => setStatus(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Urgência</Label>
                <Select value={urgency} onValueChange={(v: CardUrgency) => setUrgency(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {URGENCY_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        <div className="flex items-center gap-2">
                          <div className={cn('w-2 h-2 rounded-full', opt.color)} />
                          {opt.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Date and Owner */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Prazo</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        'w-full justify-start text-left font-normal',
                        !dueDate && 'text-muted-foreground'
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dueDate ? format(dueDate, 'dd/MM/yyyy', { locale: ptBR }) : 'Definir'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={dueDate} onSelect={setDueDate} locale={ptBR} />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label>Responsável</Label>
                <Select value={ownerId} onValueChange={setOwnerId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecionar..." />
                  </SelectTrigger>
                  <SelectContent>
                    {members?.map((member) => (
                      <SelectItem key={member.user_id} value={member.user_id}>
                        {member.profile?.full_name || member.profile?.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Client */}
            <div className="space-y-2">
              <Label>Cliente</Label>
              <Select value={clientId || '__none__'} onValueChange={(v) => setClientId(v === '__none__' ? '' : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar cliente..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Nenhum</SelectItem>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      <div className="flex items-center gap-2">
                        {client.color && (
                          <div 
                            className="w-2 h-2 rounded-full" 
                            style={{ backgroundColor: client.color }}
                          />
                        )}
                        {client.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Checklist */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <CheckSquare className="h-4 w-4" />
                Checklist Inicial
              </Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Adicionar item..."
                  value={newChecklistItem}
                  onChange={(e) => setNewChecklistItem(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addChecklistItem()}
                />
                <Button variant="outline" size="icon" onClick={addChecklistItem}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {checklist.length > 0 && (
                <div className="space-y-1 mt-2">
                  {checklist.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-2 bg-muted/50 rounded"
                    >
                      <span className="text-sm">{item.title}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => removeChecklistItem(item.id)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Attachments placeholder */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Paperclip className="h-4 w-4" />
                Anexos
              </Label>
              <div className="border-2 border-dashed rounded-lg p-4 text-center">
                <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">Arraste arquivos ou clique para enviar</p>
              </div>
            </div>
          </div>
        </ScrollArea>
      )}

      {/* Duplication to other sectors */}
      {isSocialMedia && (
        <div className="p-3 rounded-lg border bg-primary/5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Copy className="h-4 w-4 text-primary" />
              <span className="text-xs font-semibold">Duplicar para outro setor</span>
            </div>
            <Switch 
              checked={isDuplicateEnabled} 
              onCheckedChange={setIsDuplicateEnabled}
            />
          </div>

          {isDuplicateEnabled && (
            <div className="animate-in fade-in slide-in-from-top-2 duration-300">
              <Select value={duplicateToSpace} onValueChange={setDuplicateToSpace}>
                <SelectTrigger className="bg-background h-8">
                  <SelectValue placeholder="Escolher setor responsável..." />
                </SelectTrigger>
                <SelectContent>
                  {spaces?.filter(s => s.id !== spaceId).map(space => (
                    <SelectItem key={space.id} value={space.id}>
                      <div className="flex items-center gap-2">
                        <Users className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-xs">{space.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      )}
    </div>
  );

  const footer = (
    <div className="flex gap-2 justify-end">
      <Button variant="outline" onClick={() => { resetForm(); onOpenChange(false); }}>
        Cancelar
      </Button>
      <Button onClick={handleSubmit} disabled={createCard.isPending}>
        {createCard.isPending ? 'Criando...' : 'Criar Card'}
      </Button>
    </div>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Novo Card</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-4">
            {content}
          </div>
          <DrawerFooter>
            {footer}
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Novo Card</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[80vh]">
          <div className="px-1 py-1">
            {content}
          </div>
        </ScrollArea>
        <DialogFooter>
          {footer}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
