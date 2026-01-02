import React, { useState } from 'react';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuSeparator,
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ChevronDown, Save, Star, Trash2, Edit2, Check } from 'lucide-react';
import type { SavedView } from '@/hooks/useSavedViews';
import type { FilterQuery, SortConfig } from '@/hooks/useCardFilters';

interface SavedViewsBarProps {
  views: SavedView[];
  currentQuery: FilterQuery;
  currentSort: SortConfig;
  onApplyView: (query: FilterQuery, sort: SortConfig) => void;
  onSaveView: (name: string, isDefault: boolean) => void;
  onDeleteView: (id: string) => void;
  onSetDefault: (id: string) => void;
  isLoading?: boolean;
  isDirty?: boolean;
}

export const SavedViewsBar: React.FC<SavedViewsBarProps> = ({
  views,
  currentQuery,
  currentSort,
  onApplyView,
  onSaveView,
  onDeleteView,
  onSetDefault,
  isLoading,
  isDirty,
}) => {
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [viewName, setViewName] = useState('');
  const [setAsDefault, setSetAsDefault] = useState(false);

  const handleSave = () => {
    if (!viewName.trim()) return;
    onSaveView(viewName.trim(), setAsDefault);
    setViewName('');
    setSetAsDefault(false);
    setSaveDialogOpen(false);
  };

  const defaultView = views.find(v => v.is_default);

  return (
    <>
      <div className="flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              {defaultView ? defaultView.name : 'Minhas Visões'}
              <ChevronDown className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            {views.length === 0 ? (
              <div className="px-2 py-4 text-sm text-muted-foreground text-center">
                Nenhuma visão salva
              </div>
            ) : (
              views.map(view => (
                <DropdownMenuItem
                  key={view.id}
                  className="flex items-center justify-between gap-2"
                  onClick={() => onApplyView(view.query, view.sort)}
                >
                  <span className="flex items-center gap-2 flex-1 truncate">
                    {view.is_default && <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />}
                    {view.name}
                  </span>
                  <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                    {!view.is_default && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => onSetDefault(view.id)}
                        title="Definir como padrão"
                      >
                        <Star className="h-3 w-3" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                      onClick={() => onDeleteView(view.id)}
                      title="Excluir"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </DropdownMenuItem>
              ))
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => setSaveDialogOpen(true)}
              disabled={!isDirty}
              className="gap-2"
            >
              <Save className="h-4 w-4" />
              Salvar visão atual
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Salvar Visão</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="view-name">Nome da visão</Label>
              <Input
                id="view-name"
                value={viewName}
                onChange={(e) => setViewName(e.target.value)}
                placeholder="Ex: Minhas tarefas urgentes"
                autoFocus
              />
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="set-default"
                checked={setAsDefault}
                onCheckedChange={(checked) => setSetAsDefault(checked as boolean)}
              />
              <Label htmlFor="set-default" className="text-sm cursor-pointer">
                Definir como visão padrão
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={!viewName.trim()}>
              <Check className="h-4 w-4 mr-2" />
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
