import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { 
  Plus, 
  X, 
  CalendarIcon, 
  User,
  Zap,
  FileQuestion,
  Loader2
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { CardStatus, CardUrgency } from '@/lib/supabase';

interface KanbanInlineQuickAddProps {
  status: CardStatus;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (data: QuickAddData) => Promise<void>;
  members?: Array<{ user_id: string; profile?: { full_name?: string; email?: string } }>;
  isLoading?: boolean;
}

interface QuickAddData {
  title: string;
  status: CardStatus;
  urgency: CardUrgency;
  due_date?: string;
  owner_id?: string;
}

const URGENCY_OPTIONS: { value: CardUrgency; label: string; color: string; icon?: string }[] = [
  { value: 'low', label: 'Baixa', color: 'bg-slate-500' },
  { value: 'medium', label: 'Média', color: 'bg-blue-500' },
  { value: 'high', label: 'Alta', color: 'bg-orange-500' },
  { value: 'critical', label: 'Crítica', color: 'bg-red-500', icon: '🔥' },
];

export const KanbanInlineQuickAdd: React.FC<KanbanInlineQuickAddProps> = ({
  status,
  isOpen,
  onOpenChange,
  onCreate,
  members,
  isLoading = false,
}) => {
  const [title, setTitle] = useState('');
  const [urgency, setUrgency] = useState<CardUrgency>('medium');
  const [dueDate, setDueDate] = useState<Date | undefined>();
  const [ownerId, setOwnerId] = useState<string>('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleSubmit = async () => {
    if (!title.trim()) return;

    await onCreate({
      title: title.trim(),
      status,
      urgency,
      due_date: dueDate?.toISOString(),
      owner_id: ownerId || undefined,
    });

    // Reset form
    setTitle('');
    setUrgency('medium');
    setDueDate(undefined);
    setOwnerId('');
    setShowAdvanced(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
    if (e.key === 'Escape') {
      onOpenChange(false);
    }
  };

  const handleClose = () => {
    setTitle('');
    setUrgency('medium');
    setDueDate(undefined);
    setOwnerId('');
    setShowAdvanced(false);
    onOpenChange(false);
  };

  if (!isOpen) {
    return (
      <Button
        variant="ghost"
        size="sm"
        className="w-full h-9 justify-start gap-2 text-muted-foreground hover:text-foreground"
        onClick={() => onOpenChange(true)}
      >
        <Plus className="h-4 w-4" />
        <span className="text-sm">Adicionar card</span>
      </Button>
    );
  }

  return (
    <div className="p-3 bg-card/80 backdrop-blur-sm rounded-lg border border-border/50 shadow-sm space-y-3">
      {/* Title input */}
      <div className="relative">
        <Input
          ref={inputRef}
          placeholder="Nome do card..."
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={handleKeyDown}
          className="pr-20 h-10 text-sm"
          disabled={isLoading}
        />
        {title && (
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
            <Badge 
              variant="outline" 
              className="h-6 gap-1 text-[10px] text-amber-600 border-amber-300 bg-amber-50 dark:bg-amber-900/20"
            >
              <FileQuestion className="h-3 w-3" />
              Brief pendente
            </Badge>
          </div>
        )}
      </div>

      {/* Quick options */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Urgency */}
        <Select value={urgency} onValueChange={(v: CardUrgency) => setUrgency(v)}>
          <SelectTrigger className="h-8 w-auto min-w-[100px] text-xs">
            <div className="flex items-center gap-1.5">
              <div className={cn(
                'w-2 h-2 rounded-full',
                URGENCY_OPTIONS.find(o => o.value === urgency)?.color
              )} />
              <SelectValue />
            </div>
          </SelectTrigger>
          <SelectContent>
            {URGENCY_OPTIONS.map(opt => (
              <SelectItem key={opt.value} value={opt.value}>
                <div className="flex items-center gap-2">
                  <div className={cn('w-2 h-2 rounded-full', opt.color)} />
                  {opt.icon && <span>{opt.icon}</span>}
                  {opt.label}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Due date */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn(
                'h-8 px-2.5 gap-1.5 text-xs',
                !dueDate && 'text-muted-foreground'
              )}
            >
              <CalendarIcon className="h-3.5 w-3.5" />
              {dueDate ? format(dueDate, 'dd/MM', { locale: ptBR }) : 'Prazo'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar 
              mode="single" 
              selected={dueDate} 
              onSelect={setDueDate} 
              locale={ptBR}
              initialFocus 
            />
          </PopoverContent>
        </Popover>

        {/* Owner */}
        {members && members.length > 0 && (
          <Select value={ownerId} onValueChange={setOwnerId}>
            <SelectTrigger className="h-8 w-auto min-w-[120px] text-xs">
              <div className="flex items-center gap-1.5">
                <User className="h-3.5 w-3.5 text-muted-foreground" />
                <SelectValue placeholder="Responsável" />
              </div>
            </SelectTrigger>
            <SelectContent>
              {members.map(member => (
                <SelectItem key={member.user_id} value={member.user_id}>
                  {member.profile?.full_name || member.profile?.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pt-1">
        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-2 text-xs text-muted-foreground"
          onClick={handleClose}
          disabled={isLoading}
        >
          <X className="h-3.5 w-3.5 mr-1" />
          Cancelar
        </Button>

        <Button
          size="sm"
          className="h-8 px-4 text-xs gap-1.5"
          onClick={handleSubmit}
          disabled={!title.trim() || isLoading}
        >
          {isLoading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Zap className="h-3.5 w-3.5" />
          )}
          Criar
        </Button>
      </div>
    </div>
  );
};
