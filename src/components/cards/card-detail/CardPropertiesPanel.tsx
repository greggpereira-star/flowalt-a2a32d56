import React from 'react';
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

      {/* Due Date */}
      <PropertyItem label="Prazo">
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
              <CalendarIcon className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
              {dueDate ? format(dueDate, 'dd MMM yyyy', { locale: ptBR }) : 'Definir prazo'}
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
      <PropertyItem label="Responsáveis">
        <Button
          variant="outline"
          size="sm"
          className="h-9 w-full justify-start border-border/50 bg-muted/30 hover:bg-muted/50 text-muted-foreground"
        >
          <div className="flex items-center gap-2">
            <div className="flex -space-x-1">
              <Avatar className="h-5 w-5 border-2 border-background">
                <AvatarFallback className="text-[10px] bg-primary/20 text-primary">+</AvatarFallback>
              </Avatar>
            </div>
            <span className="text-sm">Adicionar</span>
          </div>
        </Button>
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
