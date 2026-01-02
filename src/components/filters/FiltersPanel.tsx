import React, { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronUp, Sparkles, X } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { FiltersButton } from './FiltersButton';
import { SearchInput } from './SearchInput';
import type { FilterQuery } from '@/hooks/useCardFilters';

interface FiltersPanelProps {
  query: FilterQuery;
  onSetFilter: <K extends keyof FilterQuery>(category: K, value: FilterQuery[K]) => void;
  onSetSearch: (search: string) => void;
  onClearFilters: () => void;
  onApplyMyTasks: () => void;
  activeFiltersCount: number;
}

const STATUS_OPTIONS = [
  { value: 'todo', label: 'A Fazer' },
  { value: 'doing', label: 'Em Progresso' },
  { value: 'review', label: 'Em Revisão' },
  { value: 'done', label: 'Concluído' },
  { value: 'delivered', label: 'Entregue' },
  { value: 'blocked', label: 'Bloqueado' },
];

const URGENCY_OPTIONS = [
  { value: 'low', label: 'Baixa' },
  { value: 'medium', label: 'Média' },
  { value: 'high', label: 'Alta' },
  { value: 'critical', label: 'Crítica' },
];

const DUE_OPTIONS = [
  { value: 'today', label: 'Hoje' },
  { value: 'week', label: 'Esta Semana' },
  { value: 'overdue', label: 'Atrasados' },
  { value: 'none', label: 'Sem Data' },
];

export const FiltersPanel: React.FC<FiltersPanelProps> = ({
  query,
  onSetFilter,
  onSetSearch,
  onClearFilters,
  onApplyMyTasks,
  activeFiltersCount,
}) => {
  const [open, setOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    status: true,
    priority: true,
    time: false,
    quality: false,
  });

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const handleStatusToggle = (status: string) => {
    const current = query.status?.card_status || [];
    const updated = current.includes(status)
      ? current.filter(s => s !== status)
      : [...current, status];
    onSetFilter('status', { ...query.status, card_status: updated.length ? updated : undefined });
  };

  const handleUrgencyToggle = (urgency: string) => {
    const current = query.priority?.urgency || [];
    const updated = current.includes(urgency as any)
      ? current.filter(u => u !== urgency)
      : [...current, urgency as 'low' | 'medium' | 'high' | 'critical'];
    onSetFilter('priority', { urgency: updated.length ? updated : undefined });
  };

  const handleDueChange = (value: string) => {
    onSetFilter('time', { 
      ...query.time, 
      due: value === 'any' ? undefined : value as any 
    });
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <FiltersButton activeCount={activeFiltersCount} onClick={() => setOpen(true)} />
      </SheetTrigger>
      <SheetContent side="right" className="w-[340px] sm:w-[400px]">
        <SheetHeader className="pb-4">
          <SheetTitle className="flex items-center justify-between">
            Filtros
            {activeFiltersCount > 0 && (
              <Button variant="ghost" size="sm" onClick={onClearFilters}>
                Limpar todos
              </Button>
            )}
          </SheetTitle>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-120px)] pr-4">
          {/* Search */}
          <div className="mb-4">
            <Label className="text-sm font-medium mb-2 block">Busca</Label>
            <SearchInput
              value={query.search || ''}
              onChange={onSetSearch}
              placeholder="Buscar por título, descrição..."
            />
          </div>

          {/* Quick Action */}
          <Button
            variant="outline"
            size="sm"
            className="w-full mb-4 gap-2"
            onClick={() => {
              onApplyMyTasks();
              setOpen(false);
            }}
          >
            <Sparkles className="h-4 w-4" />
            Mostra só o que é meu, agora
          </Button>

          <Separator className="my-4" />

          {/* Status Section */}
          <Collapsible open={expandedSections.status} onOpenChange={() => toggleSection('status')}>
            <CollapsibleTrigger className="flex items-center justify-between w-full py-2">
              <Label className="text-sm font-medium cursor-pointer">Status</Label>
              {expandedSections.status ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-2 pb-4">
              {STATUS_OPTIONS.map(option => (
                <div key={option.value} className="flex items-center space-x-2">
                  <Checkbox
                    id={`status-${option.value}`}
                    checked={query.status?.card_status?.includes(option.value) || false}
                    onCheckedChange={() => handleStatusToggle(option.value)}
                  />
                  <Label htmlFor={`status-${option.value}`} className="text-sm cursor-pointer">
                    {option.label}
                  </Label>
                </div>
              ))}
              <div className="flex items-center space-x-2 pt-2">
                <Checkbox
                  id="blocked-only"
                  checked={query.status?.blocked_only || false}
                  onCheckedChange={(checked) => 
                    onSetFilter('status', { ...query.status, blocked_only: checked as boolean })
                  }
                />
                <Label htmlFor="blocked-only" className="text-sm cursor-pointer">
                  Apenas bloqueados
                </Label>
              </div>
            </CollapsibleContent>
          </Collapsible>

          <Separator className="my-2" />

          {/* Priority Section */}
          <Collapsible open={expandedSections.priority} onOpenChange={() => toggleSection('priority')}>
            <CollapsibleTrigger className="flex items-center justify-between w-full py-2">
              <Label className="text-sm font-medium cursor-pointer">Prioridade</Label>
              {expandedSections.priority ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-2 pb-4">
              {URGENCY_OPTIONS.map(option => (
                <div key={option.value} className="flex items-center space-x-2">
                  <Checkbox
                    id={`urgency-${option.value}`}
                    checked={query.priority?.urgency?.includes(option.value as any) || false}
                    onCheckedChange={() => handleUrgencyToggle(option.value)}
                  />
                  <Label htmlFor={`urgency-${option.value}`} className="text-sm cursor-pointer">
                    {option.label}
                  </Label>
                </div>
              ))}
            </CollapsibleContent>
          </Collapsible>

          <Separator className="my-2" />

          {/* Time Section */}
          <Collapsible open={expandedSections.time} onOpenChange={() => toggleSection('time')}>
            <CollapsibleTrigger className="flex items-center justify-between w-full py-2">
              <Label className="text-sm font-medium cursor-pointer">Prazo</Label>
              {expandedSections.time ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-2 pb-4">
              <Select value={query.time?.due || 'any'} onValueChange={handleDueChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Qualquer</SelectItem>
                  {DUE_OPTIONS.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CollapsibleContent>
          </Collapsible>

          <Separator className="my-2" />

          {/* Quality Section */}
          <Collapsible open={expandedSections.quality} onOpenChange={() => toggleSection('quality')}>
            <CollapsibleTrigger className="flex items-center justify-between w-full py-2">
              <Label className="text-sm font-medium cursor-pointer">Qualidade</Label>
              {expandedSections.quality ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-2 pb-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="briefing-pending"
                  checked={query.quality?.briefing_pending || false}
                  onCheckedChange={(checked) => 
                    onSetFilter('quality', { ...query.quality, briefing_pending: checked as boolean })
                  }
                />
                <Label htmlFor="briefing-pending" className="text-sm cursor-pointer">
                  Briefing pendente
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="no-checklist"
                  checked={query.quality?.no_checklist || false}
                  onCheckedChange={(checked) => 
                    onSetFilter('quality', { ...query.quality, no_checklist: checked as boolean })
                  }
                />
                <Label htmlFor="no-checklist" className="text-sm cursor-pointer">
                  Sem checklist
                </Label>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
};
