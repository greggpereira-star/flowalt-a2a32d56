import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Plus,
  FileStack,
  Trash2,
  Package,
  Video,
  Camera,
  Megaphone,
  Settings,
  Users,
  FolderKanban,
} from 'lucide-react';
import { useKitTemplates, useCreateKitTemplate, useDeleteKitTemplate, type KitTemplate } from '@/hooks/useKitTemplates';
import { useInventoryItems } from '@/hooks/useInventory';
import { toast } from 'sonner';

const SPACE_TYPES = [
  { value: 'audiovisual', label: 'Audiovisual', icon: Video },
  { value: 'designer', label: 'Design', icon: Camera },
  { value: 'social_media', label: 'Social Media', icon: Megaphone },
  { value: 'traffic', label: 'Tráfego', icon: Settings },
  { value: 'administrative', label: 'Administrativo', icon: Users },
  { value: 'coordination', label: 'Coordenação', icon: FolderKanban },
];

export function KitTemplatesManager() {
  const { data: templates = [], isLoading } = useKitTemplates();
  const { data: inventoryItems = [] } = useInventoryItems();
  const createTemplate = useCreateKitTemplate();
  const deleteTemplate = useDeleteKitTemplate();

  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [spaceType, setSpaceType] = useState('');
  const [selectedItems, setSelectedItems] = useState<{ item_id: string; quantity: number; is_required: boolean }[]>([]);

  const handleAddItem = (itemId: string) => {
    if (selectedItems.find(i => i.item_id === itemId)) {
      toast.error('Item já adicionado');
      return;
    }
    setSelectedItems([...selectedItems, { item_id: itemId, quantity: 1, is_required: true }]);
  };

  const handleRemoveItem = (itemId: string) => {
    setSelectedItems(selectedItems.filter(i => i.item_id !== itemId));
  };

  const handleUpdateItem = (itemId: string, updates: Partial<{ quantity: number; is_required: boolean }>) => {
    setSelectedItems(selectedItems.map(i => 
      i.item_id === itemId ? { ...i, ...updates } : i
    ));
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error('Nome é obrigatório');
      return;
    }
    if (selectedItems.length === 0) {
      toast.error('Adicione pelo menos um item');
      return;
    }

    try {
      await createTemplate.mutateAsync({
        name,
        description,
        space_type: spaceType || undefined,
        items: selectedItems,
      });
      setCreateOpen(false);
      resetForm();
    } catch {
      // Error handled by mutation
    }
  };

  const resetForm = () => {
    setName('');
    setDescription('');
    setSpaceType('');
    setSelectedItems([]);
  };

  const getSpaceIcon = (type?: string) => {
    const found = SPACE_TYPES.find(s => s.value === type);
    return found ? found.icon : Package;
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <FileStack className="h-4 w-4" />
            Templates de Kit
          </CardTitle>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1">
                <Plus className="h-4 w-4" />
                Novo Template
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Criar Template de Kit</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Nome *</Label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ex: Kit Gravação Externa"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Descrição</Label>
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Descrição do template..."
                  />
                </div>

                <div className="space-y-2">
                  <Label>Tipo de Espaço</Label>
                  <Select value={spaceType} onValueChange={setSpaceType}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecionar tipo..." />
                    </SelectTrigger>
                    <SelectContent>
                      {SPACE_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          <div className="flex items-center gap-2">
                            <type.icon className="h-4 w-4" />
                            {type.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Adicionar Itens</Label>
                  <Select onValueChange={handleAddItem}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecionar item..." />
                    </SelectTrigger>
                    <SelectContent>
                      {inventoryItems
                        .filter(i => !selectedItems.find(s => s.item_id === i.id))
                        .map((item) => (
                          <SelectItem key={item.id} value={item.id}>
                            {item.code} - {item.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedItems.length > 0 && (
                  <ScrollArea className="h-[200px] border rounded-md p-2">
                    <div className="space-y-2">
                      {selectedItems.map((selected) => {
                        const item = inventoryItems.find(i => i.id === selected.item_id);
                        return (
                          <div
                            key={selected.item_id}
                            className="flex items-center gap-3 p-2 bg-muted rounded-lg"
                          >
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{item?.name}</p>
                              <p className="text-xs text-muted-foreground">{item?.code}</p>
                            </div>
                            <Input
                              type="number"
                              min={1}
                              value={selected.quantity}
                              onChange={(e) => handleUpdateItem(selected.item_id, { quantity: parseInt(e.target.value) || 1 })}
                              className="w-16 h-8 text-center"
                            />
                            <div className="flex items-center gap-1">
                              <Checkbox
                                checked={selected.is_required}
                                onCheckedChange={(checked) => handleUpdateItem(selected.item_id, { is_required: !!checked })}
                              />
                              <span className="text-xs text-muted-foreground">Obrigatório</span>
                            </div>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-destructive"
                              onClick={() => handleRemoveItem(selected.item_id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                )}

                <Button
                  onClick={handleCreate}
                  className="w-full"
                  disabled={createTemplate.isPending}
                >
                  Criar Template
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            <div className="h-12 bg-muted rounded animate-pulse" />
            <div className="h-12 bg-muted rounded animate-pulse" />
          </div>
        ) : templates.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <FileStack className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Nenhum template criado</p>
            <p className="text-xs">Crie templates para aplicar rapidamente em cards</p>
          </div>
        ) : (
          <div className="space-y-2">
            {templates.map((template) => {
              const Icon = getSpaceIcon(template.space_type || undefined);
              return (
                <div
                  key={template.id}
                  className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Icon className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{template.name}</p>
                    {template.description && (
                      <p className="text-xs text-muted-foreground truncate">{template.description}</p>
                    )}
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {template.items?.length || 0} itens
                  </Badge>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-destructive"
                    onClick={() => deleteTemplate.mutate(template.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
