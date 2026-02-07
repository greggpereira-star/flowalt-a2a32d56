import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { StatusBadge, UrgencyBadge } from '../CardBadges';
import {
  CircleDot,
  Users,
  Calendar as CalendarIcon,
  Flag,
  Clock,
  Timer,
  Building2,
  Plus,
  BanknoteIcon,
  X,
  Check,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { CardStatus, CardUrgency } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { useCardMembers, useAddCardMember, useRemoveCardMember } from '@/hooks/useCardMembers';
import { useWorkspaceMembers } from '@/hooks/useWorkspaceMembers';

interface Client {
  id: string;
  name: string;
  color: string | null;
}

interface CardPropertiesPanelProps {
  cardId: string;
  status: CardStatus;
  urgency: CardUrgency;
  startDate?: Date;
  dueDate?: Date;
  estimatedHours: string;
  actualHours: number;
  clientId: string | null;
  clients: Client[];
  onStatusChange: (status: CardStatus) => void;
  onUrgencyChange: (urgency: CardUrgency) => void;
  onStartDateChange: (date: Date | undefined) => void;
  onDueDateChange: (date: Date | undefined) => void;
  onEstimatedHoursChange: (hours: string) => void;
  onEstimatedHoursBlur: () => void;
  onClientChange: (clientId: string | null) => void;
}

const STATUS_OPTIONS: { value: CardStatus; label: string }[] = [
  { value: 'backlog', label: 'Backlog' },
  { value: 'todo', label: 'A Fazer' },
  { value: 'in_progress', label: 'Em Progresso' },
  { value: 'review', label: 'Revisão' },
  { value: 'approved', label: 'Aprovado' },
  { value: 'delivered', label: 'Entregue' },
];

const URGENCY_OPTIONS: { value: CardUrgency; label: string; color: string }[] = [
  { value: 'low', label: 'Baixa', color: 'text-success' },
  { value: 'medium', label: 'Média', color: 'text-warning' },
  { value: 'high', label: 'Alta', color: 'text-orange-500' },
  { value: 'critical', label: 'Urgente', color: 'text-destructive' },
];

interface PropertyItemProps {
  label: string;
  children: React.ReactNode;
  className?: string;
}

const PropertyItem: React.FC<PropertyItemProps> = ({ label, children, className }) => (
  <div className={cn("space-y-1.5", className)}>
    <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
      {label}
    </label>
    <div>{children}</div>
  </div>
);

export const CardPropertiesPanel: React.FC<CardPropertiesPanelProps> = ({
  cardId,
  status,
  urgency,
  startDate,
  dueDate,
  estimatedHours,
  actualHours,
  clientId,
  clients,
  onStatusChange,
  onUrgencyChange,
  onStartDateChange,
  onDueDateChange,
  onEstimatedHoursChange,
  onEstimatedHoursBlur,
  onClientChange,
}) => {
  const [memberPopoverOpen, setMemberPopoverOpen] = useState(false);
  const { data: cardMembers = [] } = useCardMembers(cardId);
  const { data: workspaceMembers = [] } = useWorkspaceMembers();
  const addMember = useAddCardMember();
  const removeMember = useRemoveCardMember();

  const selectedClient = clients.find(c => c.id === clientId);

  // Filter workspace members that are not already card members
  const availableMembers = workspaceMembers.filter(
    wm => !cardMembers.some(cm => cm.user_id === wm.user_id)
  );

  const handleAddMember = (userId: string) => {
    addMember.mutate({ cardId, userId });
  };

  const handleRemoveMember = (memberId: string) => {
    removeMember.mutate({ cardId, memberId });
  };

  const getInitials = (name: string | null | undefined) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
      {/* Status */}
      <PropertyItem label="Status">
        <Select value={status} onValueChange={onStatusChange}>
          <SelectTrigger className="h-9 w-full border-border/50 bg-muted/30 hover:bg-muted/50 transition-colors">
            <StatusBadge status={status} />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                <StatusBadge status={opt.value} />
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </PropertyItem>

      {/* Priority */}
      <PropertyItem label="Prioridade">
        <Select value={urgency} onValueChange={onUrgencyChange}>
          <SelectTrigger className="h-9 w-full border-border/50 bg-muted/30 hover:bg-muted/50 transition-colors">
            <UrgencyBadge urgency={urgency} />
          </SelectTrigger>
          <SelectContent>
            {URGENCY_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                <div className="flex items-center gap-2">
                  <Flag className={cn("h-3.5 w-3.5", opt.color)} />
                  {opt.label}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </PropertyItem>

      {/* Start Date */}
      <PropertyItem label="Início">
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn(
                "h-9 w-full justify-start text-left font-normal border-border/50 bg-muted/30 hover:bg-muted/50",
                !startDate && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="h-3.5 w-3.5 mr-2 text-success" />
              {startDate ? format(startDate, 'dd MMM yyyy', { locale: ptBR }) : 'Definir início'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={startDate}
              onSelect={onStartDateChange}
              locale={ptBR}
              className="pointer-events-auto"
            />
          </PopoverContent>
        </Popover>
      </PropertyItem>

      {/* Due Date */}
      <PropertyItem label="Término">
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn(
                "h-9 w-full justify-start text-left font-normal border-border/50 bg-muted/30 hover:bg-muted/50",
                !dueDate && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="h-3.5 w-3.5 mr-2 text-destructive" />
              {dueDate ? format(dueDate, 'dd MMM yyyy', { locale: ptBR }) : 'Definir término'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={dueDate}
              onSelect={onDueDateChange}
              locale={ptBR}
              className="pointer-events-auto"
            />
          </PopoverContent>
        </Popover>
      </PropertyItem>

      {/* Client */}
      <PropertyItem label="Cliente">
        <Select
          value={clientId || '__none__'}
          onValueChange={(v) => onClientChange(v === '__none__' ? null : v)}
        >
          <SelectTrigger className="h-9 w-full border-border/50 bg-muted/30 hover:bg-muted/50 transition-colors">
            {selectedClient ? (
              <div className="flex items-center gap-2 truncate">
                {selectedClient.color && (
                  <div 
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0" 
                    style={{ backgroundColor: selectedClient.color }}
                  />
                )}
                <span className="truncate text-sm">{selectedClient.name}</span>
              </div>
            ) : (
              <span className="text-sm text-muted-foreground flex items-center gap-2">
                <BanknoteIcon className="h-3.5 w-3.5" />
                Não faturável
              </span>
            )}
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">
              <div className="flex items-center gap-2 text-muted-foreground">
                <BanknoteIcon className="h-3.5 w-3.5" />
                Sem cliente
              </div>
            </SelectItem>
            {clients.map((client) => (
              <SelectItem key={client.id} value={client.id}>
                <div className="flex items-center gap-2">
                  {client.color ? (
                    <div 
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0" 
                      style={{ backgroundColor: client.color }}
                    />
                  ) : (
                    <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                  {client.name}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </PropertyItem>

      {/* Assignees */}
      <PropertyItem label="Responsáveis" className="col-span-2">
        <div className="space-y-2">
          {/* Current members */}
          {cardMembers.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {cardMembers.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center gap-1.5 pl-1 pr-2 py-1 rounded-full bg-muted/50 border border-border/50 group"
                >
                  <Avatar className="h-5 w-5">
                    {member.profile?.avatar_url && (
                      <AvatarImage src={member.profile.avatar_url} />
                    )}
                    <AvatarFallback className="text-[10px] bg-primary/20 text-primary">
                      {getInitials(member.profile?.full_name)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-xs font-medium text-foreground/80 truncate max-w-[100px]">
                    {member.profile?.full_name?.split(' ')[0] || member.profile?.email || 'Usuário'}
                  </span>
                  {!member.is_owner && (
                    <button
                      onClick={() => handleRemoveMember(member.id)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity h-4 w-4 rounded-full hover:bg-destructive/20 flex items-center justify-center"
                    >
                      <X className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Add member button */}
          <Popover open={memberPopoverOpen} onOpenChange={setMemberPopoverOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-8 justify-start border-dashed border-border/50 bg-transparent hover:bg-muted/50 text-muted-foreground"
              >
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                <span className="text-xs">Adicionar responsável</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-0" align="start">
              <Command className="[&_[cmdk-input-wrapper]]:border-none">
                <CommandInput placeholder="Buscar membro..." className="h-8 text-sm" />
                <CommandList>
                  <CommandEmpty>Nenhum membro encontrado</CommandEmpty>
                  <CommandGroup>
                    {availableMembers.map((member) => (
                      <CommandItem
                        key={member.user_id}
                        value={member.profile?.full_name || member.profile?.email || member.user_id}
                        onSelect={() => {
                          handleAddMember(member.user_id);
                          setMemberPopoverOpen(false);
                        }}
                        className="cursor-pointer"
                      >
                        <Avatar className="h-6 w-6 mr-2">
                          {member.profile?.avatar_url && (
                            <AvatarImage src={member.profile.avatar_url} />
                          )}
                          <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                            {getInitials(member.profile?.full_name)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm truncate">
                          {member.profile?.full_name || member.profile?.email || 'Usuário'}
                        </span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
      </PropertyItem>

      {/* Estimated Time */}
      <PropertyItem label="Tempo Estimado">
        <div className="flex items-center h-9 px-3 rounded-md border border-border/50 bg-muted/30">
          <Clock className="h-3.5 w-3.5 text-muted-foreground mr-2" />
          <Input
            type="number"
            value={estimatedHours}
            onChange={(e) => onEstimatedHoursChange(e.target.value)}
            onBlur={onEstimatedHoursBlur}
            placeholder="0"
            className="h-7 w-12 text-sm border-none bg-transparent p-0 focus-visible:ring-0"
          />
          <span className="text-xs text-muted-foreground ml-1">horas</span>
        </div>
      </PropertyItem>

      {/* Tracked Time */}
      <PropertyItem label="Tempo Rastreado">
        <Button
          variant="outline"
          size="sm"
          className="h-9 w-full justify-start border-border/50 bg-muted/30 hover:bg-muted/50"
        >
          <Timer className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
          {actualHours > 0 ? (
            <span className="text-sm">{actualHours.toFixed(1)}h</span>
          ) : (
            <span className="text-sm text-muted-foreground">0h</span>
          )}
        </Button>
      </PropertyItem>
    </div>
  );
};
