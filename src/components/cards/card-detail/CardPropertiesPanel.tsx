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
import { PROPERTY_TRIGGER_BASE } from './badgeStyles';
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
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { CardStatus, CardUrgency } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { useCardMembers, useAddCardMember, useRemoveCardMember } from '@/hooks/useCardMembers';
import { useWorkspaceMembers } from '@/hooks/useWorkspaceMembers';
import { useSugestaoResponsavel } from '@/hooks/useSugestaoResponsavel';
import { ResponsavelCommand } from './ResponsavelCommand';
import { useFeatureFlags, FEATURE_FLAGS } from '@/hooks/useFeatureFlags';
import { CARD_STATUS_OPTIONS } from '@/lib/cards/cardStatusLabels';

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
  /** Linhas extras logo abaixo do prazo (ex.: Data de postagem nos spaces de Social Media). */
  extraDateRows?: React.ReactNode;
}

const STATUS_OPTIONS: { value: CardStatus; label: string }[] = CARD_STATUS_OPTIONS;

const URGENCY_OPTIONS: { value: CardUrgency; label: string; color: string }[] = [
  { value: 'low', label: 'Baixa', color: 'text-muted-foreground' },
  { value: 'medium', label: 'Média', color: 'text-warning' },
  { value: 'high', label: 'Alta', color: 'text-orange-500' },
  { value: 'critical', label: 'Crítica', color: 'text-destructive' },
];

const getInitials = (name: string | null | undefined) => {
  if (!name) return '?';
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
};

interface FieldRowProps {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
  className?: string;
}

export const FieldRow: React.FC<FieldRowProps> = ({ icon, label, children, className }) => (
  <div className={cn(
    "flex items-center min-h-[36px] px-2 py-1 rounded-md transition-all hover:bg-muted/40 group",
    className
  )}>
    <div className="w-[140px] flex-shrink-0 flex items-center gap-2 text-[13px] text-muted-foreground">
      {icon}
      <span>{label}</span>
    </div>
    <div className="flex-1 min-w-0">{children}</div>
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
  extraDateRows,
}) => {
  const [memberPopoverOpen, setMemberPopoverOpen] = useState(false);
  const { data: cardMembers = [] } = useCardMembers(cardId);
  const { data: workspaceMembers = [] } = useWorkspaceMembers();
  const addMember = useAddCardMember();
  const { isEnabled } = useFeatureFlags();
  // Sugestão de responsável (Onda 6): só aparece com o card sem responsável, atrás da flag do radar.
  const sugerir = isEnabled(FEATURE_FLAGS.RISK_RADAR) && cardMembers.length === 0;
  const { sugestoes } = useSugestaoResponsavel(cardId, cardMembers.map(m => m.user_id), sugerir);
  const removeMember = useRemoveCardMember();

  const selectedClient = clients.find(c => c.id === clientId);
  const availableMembers = workspaceMembers.filter(
    wm => !cardMembers.some(cm => cm.user_id === wm.user_id)
  );

  const handleAddMember = (userId: string) => {
    addMember.mutate({ cardId, userId });
  };

  const handleRemoveMember = (memberId: string) => {
    removeMember.mutate({ cardId, memberId });
  };

  const applyTimeToDate = (baseDate: Date | undefined, value: string, fallbackHour = 18) => {
    const nextDate = baseDate ? new Date(baseDate) : new Date();
    if (!baseDate) nextDate.setHours(fallbackHour, 0, 0, 0);
    const [hours, minutes] = value.split(':').map(Number);
    if (Number.isFinite(hours) && Number.isFinite(minutes)) {
      nextDate.setHours(hours, minutes, 0, 0);
    }
    return nextDate;
  };

  // Atalhos do prazo: mantêm a hora já escolhida (ou 18:00 se ainda não havia prazo).
  const diaDaSemana = (alvo: number) => {
    const d = new Date();
    d.setDate(d.getDate() + (((alvo - d.getDay() + 7) % 7) || 7));
    return d;
  };
  const maisDias = (n: number) => {
    const d = new Date();
    d.setDate(d.getDate() + n);
    return d;
  };
  const atalhosPrazo: { rotulo: string; data: Date }[] = [
    { rotulo: 'Hoje', data: maisDias(0) },
    { rotulo: 'Amanhã', data: maisDias(1) },
    { rotulo: 'Sexta', data: diaDaSemana(5) },
    { rotulo: 'Próx. segunda', data: diaDaSemana(1) },
  ];
  const definirPrazo = (d: Date) => {
    if (dueDate) d.setHours(dueDate.getHours(), dueDate.getMinutes(), 0, 0);
    else d.setHours(18, 0, 0, 0);
    onDueDateChange(d);
  };

  return (
    <div className="space-y-0">
      {/* Two-column grid for fields */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-0">
        {/* Status */}
        <FieldRow icon={<CircleDot className="h-3.5 w-3.5" />} label="Status">
          <Select value={status} onValueChange={onStatusChange}>
            <SelectTrigger aria-label="Status" className={PROPERTY_TRIGGER_BASE} data-testid="status-trigger">
              <StatusBadge status={status} showChevron />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  <StatusBadge status={opt.value} />
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FieldRow>

        {/* Assignees */}
        <FieldRow icon={<Users className="h-3.5 w-3.5" />} label="Responsáveis">
          <div className="flex items-center gap-1.5 flex-wrap">
            {cardMembers.map((member) => (
              <div
                key={member.id}
                className="flex items-center gap-1 pl-0.5 pr-1.5 py-0.5 rounded-full bg-muted/50 group/member"
              >
                <Avatar className="h-5 w-5">
                  {member.profile?.avatar_url && (
                    <AvatarImage src={member.profile.avatar_url} />
                  )}
                  <AvatarFallback className="text-[9px] bg-primary/20 text-primary">
                    {getInitials(member.profile?.full_name)}
                  </AvatarFallback>
                </Avatar>
                <span className="text-xs text-foreground/80 max-w-[80px] truncate">
                  {member.profile?.full_name?.split(' ')[0] || 'Usuário'}
                </span>
                {!member.is_owner && (
                  <button
                    onClick={() => handleRemoveMember(member.id)}
                    aria-label="Remover responsável" className="opacity-0 group-hover/member:opacity-100 [@media(hover:none)]:opacity-100 h-3.5 w-3.5 [@media(pointer:coarse)]:h-6 [@media(pointer:coarse)]:w-6 rounded-full hover:bg-destructive/20 flex items-center justify-center transition-opacity"
                  >
                    <X className="h-2.5 w-2.5 text-muted-foreground hover:text-destructive" />
                  </button>
                )}
              </div>
            ))}
            <Popover open={memberPopoverOpen} onOpenChange={setMemberPopoverOpen}>
              <PopoverTrigger asChild>
                <button
                  aria-label={sugerir && sugestoes.length > 0 ? 'Adicionar responsável (há indicações)' : 'Adicionar responsável'}
                  className="relative h-5 w-5 [@media(pointer:coarse)]:h-9 [@media(pointer:coarse)]:w-9 rounded-full border border-dashed border-muted-foreground/30 flex items-center justify-center hover:border-primary hover:bg-primary/5 transition-colors"
                >
                  <Plus className="h-3 w-3 text-muted-foreground" />
                  {sugerir && sugestoes.length > 0 && (
                    <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-amber-500 ring-2 ring-background" aria-hidden />
                  )}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-[22rem] max-w-[calc(100vw-2rem)] p-2" align="start">
                <ResponsavelCommand
                  membros={availableMembers}
                  sugestoes={sugerir ? sugestoes : []}
                  onEscolher={(userId) => {
                    handleAddMember(userId);
                    setMemberPopoverOpen(false);
                  }}
                />
              </PopoverContent>
            </Popover>
          </div>
        </FieldRow>

        {/* Dates */}
        <FieldRow icon={<CalendarIcon className="h-3.5 w-3.5" />} label="Prazo da Tarefa">
          <div className="flex items-center gap-2 text-sm">
            <Popover>
              <PopoverTrigger asChild>
                <button aria-label="Início da tarefa" className={cn(
                  "px-1.5 py-0.5 rounded text-xs hover:bg-muted/50 transition-colors",
                  startDate ? "text-foreground" : "text-muted-foreground/50 border border-dashed border-muted-foreground/20"
                )}>
                  {startDate ? format(startDate, 'dd/MM HH:mm', { locale: ptBR }) : 'Início'}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <div className="p-3 border-b bg-muted/20">
                   <div className="flex items-center gap-2">
                     <Clock className="h-3 w-3 text-muted-foreground" />
                     <Input 
                       type="time" 
                       className="h-7 py-0 px-2 text-xs w-24"
                       value={startDate ? format(startDate, 'HH:mm') : ''}
                       onChange={(e) => onStartDateChange(applyTimeToDate(startDate, e.target.value, 9))}
                     />
                   </div>
                </div>
                <Calendar
                  mode="single"
                  selected={startDate}
                  onSelect={(date) => {
                    if (date) {
                      if (startDate) {
                        date.setHours(startDate.getHours(), startDate.getMinutes(), 0, 0);
                      } else {
                        date.setHours(9, 0, 0, 0);
                      }
                    }
                    onStartDateChange(date);
                  }}
                  locale={ptBR}
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
            <span className="text-muted-foreground/30">→</span>
            <Popover>
              <PopoverTrigger asChild>
                <button aria-label="Prazo de entrega" className={cn(
                  "px-1.5 py-0.5 rounded text-xs hover:bg-muted/50 transition-colors",
                  dueDate ? "text-foreground font-medium" : "text-muted-foreground/50 border border-dashed border-muted-foreground/20"
                )}>
                  {dueDate ? format(dueDate, 'dd/MM HH:mm', { locale: ptBR }) : 'Término'}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <div className="flex flex-wrap gap-1.5 border-b p-3">
                  {atalhosPrazo.map((a) => (
                    <button
                      key={a.rotulo}
                      type="button"
                      onClick={() => definirPrazo(a.data)}
                      className="rounded-full border border-border/60 px-2.5 py-1 text-xs font-medium transition-colors hover:bg-muted"
                    >
                      {a.rotulo}
                    </button>
                  ))}
                </div>
                <div className="p-3 border-b bg-muted/20">
                   <div className="flex items-center gap-2">
                     <Clock className="h-3 w-3 text-muted-foreground" />
                     <Input 
                       type="time" 
                       className="h-7 py-0 px-2 text-xs w-24"
                       value={dueDate ? format(dueDate, 'HH:mm') : ''}
                        onChange={(e) => onDueDateChange(applyTimeToDate(dueDate, e.target.value, 18))}
                     />
                   </div>
                </div>
                <Calendar
                  mode="single"
                  selected={dueDate}
                  onSelect={(date) => {
                    if (date) {
                      if (!dueDate) {
                        date.setHours(18, 0, 0, 0);
                      } else {
                        date.setHours(dueDate.getHours(), dueDate.getMinutes(), 0, 0);
                      }
                    }
                    onDueDateChange(date);
                  }}
                  locale={ptBR}
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>
        </FieldRow>

        {extraDateRows}

        {/* Priority */}
        <FieldRow icon={<Flag className="h-3.5 w-3.5" />} label="Prioridade">
          <Select value={urgency} onValueChange={onUrgencyChange}>
            <SelectTrigger aria-label="Prioridade" className={PROPERTY_TRIGGER_BASE} data-testid="priority-trigger">
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
        </FieldRow>

        {/* Estimated time */}
        <FieldRow icon={<Clock className="h-3.5 w-3.5" />} label="Estimativa">
          <div className="flex items-center gap-1">
            <Input
              type="number"
              value={estimatedHours}
              onChange={(e) => onEstimatedHoursChange(e.target.value)}
              onBlur={onEstimatedHoursBlur}
              placeholder="—"
              className="h-7 w-14 text-sm border-none bg-transparent p-1 focus-visible:ring-0 text-center"
            />
            <span className="text-xs text-muted-foreground">horas</span>
          </div>
        </FieldRow>

        {/* Client */}
        <FieldRow icon={<Building2 className="h-3.5 w-3.5" />} label="Cliente">
          <Select
            value={clientId || '__none__'}
            onValueChange={(v) => onClientChange(v === '__none__' ? null : v)}
          >
            <SelectTrigger aria-label="Cliente" className={cn(PROPERTY_TRIGGER_BASE, 'max-w-[220px]')} data-testid="client-trigger">
              {selectedClient ? (
                <div className="flex items-center gap-1.5 truncate">
                  {selectedClient.color && (
                    <div 
                      className="w-2 h-2 rounded-full flex-shrink-0" 
                      style={{ backgroundColor: selectedClient.color }}
                    />
                  )}
                  <span className="truncate text-sm">{selectedClient.name}</span>
                </div>
              ) : (
                <span className="text-sm text-muted-foreground/50">—</span>
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
                        className="w-2 h-2 rounded-full flex-shrink-0" 
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
        </FieldRow>
      </div>
    </div>
  );
};
