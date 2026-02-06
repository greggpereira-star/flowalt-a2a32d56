import React from 'react';
import { Badge } from '@/components/ui/badge';
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
import { CardPropertyRow } from './CardPropertyRow';
import { StatusBadge, UrgencyBadge } from '../CardBadges';
import {
  CircleDot,
  Users,
  Calendar as CalendarIcon,
  Flag,
  Clock,
  Timer,
  Link2,
  Tags,
  Building2,
  Plus,
  BanknoteIcon,
  ChevronRight,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { CardStatus, CardUrgency } from '@/lib/supabase';
import { cn } from '@/lib/utils';

interface Client {
  id: string;
  name: string;
  color: string | null;
}

interface CardPropertiesPanelProps {
  status: CardStatus;
  urgency: CardUrgency;
  dueDate?: Date;
  estimatedHours: string;
  actualHours: number;
  clientId: string | null;
  clients: Client[];
  onStatusChange: (status: CardStatus) => void;
  onUrgencyChange: (urgency: CardUrgency) => void;
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

export const CardPropertiesPanel: React.FC<CardPropertiesPanelProps> = ({
  status,
  urgency,
  dueDate,
  estimatedHours,
  actualHours,
  clientId,
  clients,
  onStatusChange,
  onUrgencyChange,
  onDueDateChange,
  onEstimatedHoursChange,
  onEstimatedHoursBlur,
  onClientChange,
}) => {
  const selectedClient = clients.find(c => c.id === clientId);

  return (
    <div className="space-y-1 py-2">
      {/* Status */}
      <CardPropertyRow icon={CircleDot} label="Status">
        <Select value={status} onValueChange={onStatusChange}>
          <SelectTrigger className="h-8 w-auto border-none bg-transparent hover:bg-muted/50 gap-2 px-2 -ml-2">
            <StatusBadge status={status} />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                <div className="flex items-center gap-2">
                  <StatusBadge status={opt.value} />
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardPropertyRow>

      {/* Assignees placeholder */}
      <CardPropertyRow icon={Users} label="Responsáveis">
        <div className="flex items-center gap-2">
          <Avatar className="h-6 w-6">
            <AvatarFallback className="text-xs bg-primary/20 text-primary">+</AvatarFallback>
          </Avatar>
          <Button variant="ghost" size="sm" className="h-6 px-2 text-xs text-muted-foreground">
            <Plus className="h-3 w-3 mr-1" />
            Adicionar
          </Button>
        </div>
      </CardPropertyRow>

      {/* Dates */}
      <CardPropertyRow icon={CalendarIcon} label="Datas">
        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "h-7 px-2 text-xs font-normal -ml-2",
                  !dueDate && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="h-3 w-3 mr-1.5" />
                Início
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                locale={ptBR}
                className="pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
          
          <ChevronRight className="h-3 w-3 text-muted-foreground" />
          
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "h-7 px-2 text-xs font-normal",
                  dueDate ? "text-destructive hover:text-destructive" : "text-muted-foreground"
                )}
              >
                <CalendarIcon className="h-3 w-3 mr-1.5" />
                {dueDate ? format(dueDate, 'dd/MM/yy', { locale: ptBR }) : 'Prazo'}
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
        </div>
      </CardPropertyRow>

      {/* Priority */}
      <CardPropertyRow icon={Flag} label="Prioridade">
        <Select value={urgency} onValueChange={onUrgencyChange}>
          <SelectTrigger className="h-8 w-auto border-none bg-transparent hover:bg-muted/50 gap-2 px-2 -ml-2">
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
      </CardPropertyRow>

      {/* Estimated time */}
      <CardPropertyRow icon={Clock} label="Tempo estimado">
        <div className="flex items-center gap-1">
          <Input
            type="number"
            value={estimatedHours}
            onChange={(e) => onEstimatedHoursChange(e.target.value)}
            onBlur={onEstimatedHoursBlur}
            placeholder="0"
            className="h-7 w-16 text-xs border-none bg-transparent hover:bg-muted/50 focus:bg-muted/50 px-2 -ml-2"
          />
          <span className="text-xs text-muted-foreground">horas</span>
        </div>
      </CardPropertyRow>

      {/* Tracked time */}
      <CardPropertyRow icon={Timer} label="Tempo rastreado">
        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-muted-foreground -ml-2">
          <Plus className="h-3 w-3 mr-1" />
          {actualHours > 0 ? `${actualHours.toFixed(1)}h registradas` : 'Adicionar hora'}
        </Button>
      </CardPropertyRow>

      {/* Client */}
      <CardPropertyRow icon={Building2} label="Cliente">
        <Select
          value={clientId || '__none__'}
          onValueChange={(v) => onClientChange(v === '__none__' ? null : v)}
        >
          <SelectTrigger className="h-8 w-auto border-none bg-transparent hover:bg-muted/50 gap-2 px-2 -ml-2">
            {selectedClient ? (
              <div className="flex items-center gap-2">
                {selectedClient.color && (
                  <div 
                    className="w-2 h-2 rounded-full" 
                    style={{ backgroundColor: selectedClient.color }}
                  />
                )}
                <span className="text-sm">{selectedClient.name}</span>
              </div>
            ) : (
              <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                <BanknoteIcon className="h-3 w-3" />
                Não faturável
              </span>
            )}
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">
              <div className="flex items-center gap-2 text-muted-foreground">
                <BanknoteIcon className="h-3 w-3" />
                Sem cliente (Não faturável)
              </div>
            </SelectItem>
            {clients.map((client) => (
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
      </CardPropertyRow>

      {/* Tags */}
      <CardPropertyRow icon={Tags} label="Etiquetas">
        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-muted-foreground -ml-2">
          <Plus className="h-3 w-3 mr-1" />
          Adicionar
        </Button>
      </CardPropertyRow>

      {/* Relationships */}
      <CardPropertyRow icon={Link2} label="Relacionamentos">
        <span className="text-sm text-muted-foreground">Vazio</span>
      </CardPropertyRow>
    </div>
  );
};
