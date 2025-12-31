import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Package,
  Plus,
  ArrowDownToLine,
  ArrowUpFromLine,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Clock,
  Box,
  Hash,
  History,
  User,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useCardKit, useAddItemToCardKit, useCheckoutCardKit, useReturnCardKit, useRemoveFromCardKit, type CardKit } from '@/hooks/useCardKit';
import { useCardKitTimeline } from '@/hooks/useCardKitTimeline';
import { useInventoryItems, useInventoryUnits } from '@/hooks/useInventory';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface CardKitTabProps {
  cardId: string;
}

const getStatusBadge = (status?: string) => {
  switch (status) {
    case 'pending':
      return <Badge variant="outline" className="text-muted-foreground"><Clock className="w-3 h-3 mr-1" />Pendente</Badge>;
    case 'checked_out':
      return <Badge variant="default" className="bg-warning text-warning-foreground"><ArrowUpFromLine className="w-3 h-3 mr-1" />Retirado</Badge>;
    case 'returned':
      return <Badge variant="default" className="bg-success text-success-foreground"><CheckCircle2 className="w-3 h-3 mr-1" />Devolvido</Badge>;
    case 'partial':
      return <Badge variant="outline" className="text-warning border-warning"><AlertCircle className="w-3 h-3 mr-1" />Parcial</Badge>;
    default:
      return <Badge variant="outline">-</Badge>;
  }
};

export const CardKitTab: React.FC<CardKitTabProps> = ({ cardId }) => {
  const { user } = useAuth();
  const { data: kitItems, isLoading } = useCardKit(cardId);
  const { data: timeline = [], isLoading: timelineLoading } = useCardKitTimeline(cardId);
  const { data: inventoryItems = [] } = useInventoryItems();
  const addToKit = useAddItemToCardKit();
  const checkout = useCheckoutCardKit();
  const returnItem = useReturnCardKit();
  const removeFromKit = useRemoveFromCardKit();

  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState('');
  const [selectedUnitId, setSelectedUnitId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [expectedReturnDate, setExpectedReturnDate] = useState('');
  const [notes, setNotes] = useState('');

  const selectedItem = inventoryItems.find(i => i.id === selectedItemId);
  const { data: units = [] } = useInventoryUnits(selectedItemId);

  const handleAddToKit = async () => {
    if (!selectedItemId) {
      toast.error('Selecione um item');
      return;
    }

    try {
      await addToKit.mutateAsync({
        card_id: cardId,
        item_id: selectedItemId,
        unit_id: selectedUnitId || undefined,
        quantity_required: selectedItem?.is_serialized ? 1 : quantity,
        expected_return_date: expectedReturnDate || undefined,
        notes: notes || undefined,
      });
      setAddDialogOpen(false);
      resetForm();
    } catch (error) {
      // Error handled by mutation
    }
  };

  const handleCheckout = async (kit: CardKit) => {
    if (!user?.id) return;
    try {
      await checkout.mutateAsync({ kitId: kit.id, responsibleUserId: user.id });
    } catch (error) {
      // Error handled by mutation
    }
  };

  const handleReturn = async (kit: CardKit) => {
    try {
      await returnItem.mutateAsync({ kitId: kit.id });
    } catch (error) {
      // Error handled by mutation
    }
  };

  const handleRemove = async (kit: CardKit) => {
    if (kit.status === 'checked_out') {
      toast.error('Devolva o item antes de remover');
      return;
    }
    try {
      await removeFromKit.mutateAsync(kit.id);
    } catch (error) {
      // Error handled by mutation
    }
  };

  const resetForm = () => {
    setSelectedItemId('');
    setSelectedUnitId('');
    setQuantity(1);
    setExpectedReturnDate('');
    setNotes('');
  };

  // Calculate summary
  const totalItems = kitItems?.length || 0;
  const pendingItems = kitItems?.filter(k => k.status === 'pending').length || 0;
  const checkedOutItems = kitItems?.filter(k => k.status === 'checked_out').length || 0;
  const returnedItems = kitItems?.filter(k => k.status === 'returned').length || 0;

  if (isLoading) {
    return (
      <div className="p-5 space-y-4">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <Tabs defaultValue="kit" className="p-5">
      <TabsList className="grid w-full grid-cols-2 mb-4">
        <TabsTrigger value="kit" className="gap-2">
          <Package className="h-4 w-4" />
          Kit
        </TabsTrigger>
        <TabsTrigger value="timeline" className="gap-2">
          <History className="h-4 w-4" />
          Timeline
        </TabsTrigger>
      </TabsList>

      <TabsContent value="kit" className="space-y-6 mt-0">
      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-3">
        <Card className="p-3">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Total</p>
              <p className="text-lg font-bold">{totalItems}</p>
            </div>
          </div>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Pendentes</p>
              <p className="text-lg font-bold">{pendingItems}</p>
            </div>
          </div>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-2">
            <ArrowUpFromLine className="h-4 w-4 text-warning" />
            <div>
              <p className="text-xs text-muted-foreground">Retirados</p>
              <p className="text-lg font-bold">{checkedOutItems}</p>
            </div>
          </div>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-success" />
            <div>
              <p className="text-xs text-muted-foreground">Devolvidos</p>
              <p className="text-lg font-bold">{returnedItems}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Add Item Button */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogTrigger asChild>
          <Button className="w-full gap-2">
            <Plus className="h-4 w-4" />
            Adicionar Item ao Kit
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Item ao Kit</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Item do Inventário *</Label>
              <Select value={selectedItemId} onValueChange={setSelectedItemId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar item..." />
                </SelectTrigger>
                <SelectContent>
                  {inventoryItems.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      <div className="flex items-center gap-2">
                        <Box className="h-4 w-4 text-muted-foreground" />
                        {item.code} - {item.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedItem?.is_serialized && units.length > 0 && (
              <div className="space-y-2">
                <Label>Unidade Específica</Label>
                <Select value={selectedUnitId} onValueChange={setSelectedUnitId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecionar unidade..." />
                  </SelectTrigger>
                  <SelectContent>
                    {units.map((unit) => (
                      <SelectItem key={unit.id} value={unit.id}>
                        <div className="flex items-center gap-2">
                          <Hash className="h-4 w-4 text-muted-foreground" />
                          {unit.serial_number || unit.tag_qr_code || unit.id.slice(0, 8)}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {!selectedItem?.is_serialized && (
              <div className="space-y-2">
                <Label>Quantidade</Label>
                <Input
                  type="number"
                  min={1}
                  value={quantity}
                  onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label>Data Prevista de Devolução</Label>
              <Input
                type="date"
                value={expectedReturnDate}
                onChange={(e) => setExpectedReturnDate(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Notas sobre o uso..."
              />
            </div>

            <Button 
              onClick={handleAddToKit} 
              className="w-full"
              disabled={addToKit.isPending || !selectedItemId}
            >
              Adicionar ao Kit
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Kit Items List */}
      {(!kitItems || kitItems.length === 0) ? (
        <div className="text-center py-12 text-muted-foreground">
          <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p className="font-medium">Nenhum item no kit</p>
          <p className="text-sm">Adicione materiais e equipamentos necessários para este job.</p>
        </div>
      ) : (
        <ScrollArea className="h-[400px]">
          <div className="space-y-3">
            {kitItems.map((kit) => (
              <Card key={kit.id} className="overflow-hidden border">
                <CardHeader className="p-4 pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-muted rounded-lg">
                        <Package className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div>
                        <CardTitle className="text-sm font-medium">
                          {kit.item?.name || 'Item'}
                        </CardTitle>
                        <p className="text-xs text-muted-foreground">
                          {kit.item?.code}
                          {kit.unit?.serial_number && ` • SN: ${kit.unit.serial_number}`}
                        </p>
                      </div>
                    </div>
                    {getStatusBadge(kit.status)}
                  </div>
                </CardHeader>
                <CardContent className="p-4 pt-2">
                  <div className="grid grid-cols-2 gap-4 text-xs mb-3">
                    <div>
                      <span className="text-muted-foreground">Qtd Necessária:</span>
                      <span className="ml-1 font-medium">{kit.quantity_required || 1}</span>
                    </div>
                    {kit.quantity_checked_out && (
                      <div>
                        <span className="text-muted-foreground">Qtd Retirada:</span>
                        <span className="ml-1 font-medium">{kit.quantity_checked_out}</span>
                      </div>
                    )}
                    {kit.checkout_date && (
                      <div>
                        <span className="text-muted-foreground">Retirado em:</span>
                        <span className="ml-1">{format(new Date(kit.checkout_date), 'dd/MM/yy', { locale: ptBR })}</span>
                      </div>
                    )}
                    {kit.expected_return_date && (
                      <div>
                        <span className="text-muted-foreground">Devolução prev.:</span>
                        <span className="ml-1">{format(new Date(kit.expected_return_date), 'dd/MM/yy', { locale: ptBR })}</span>
                      </div>
                    )}
                    {kit.actual_return_date && (
                      <div className="col-span-2">
                        <span className="text-muted-foreground">Devolvido em:</span>
                        <span className="ml-1">{format(new Date(kit.actual_return_date), 'dd/MM/yy', { locale: ptBR })}</span>
                      </div>
                    )}
                  </div>
                  
                  {kit.notes && (
                    <p className="text-xs text-muted-foreground mb-3 italic">"{kit.notes}"</p>
                  )}

                  <div className="flex gap-2">
                    {kit.status === 'pending' && (
                      <Button
                        size="sm"
                        variant="default"
                        className="flex-1 gap-1"
                        onClick={() => handleCheckout(kit)}
                        disabled={checkout.isPending}
                      >
                        <ArrowUpFromLine className="h-3 w-3" />
                        Retirar
                      </Button>
                    )}
                    {kit.status === 'checked_out' && (
                      <Button
                        size="sm"
                        variant="default"
                        className="flex-1 gap-1 bg-success hover:bg-success/90"
                        onClick={() => handleReturn(kit)}
                        disabled={returnItem.isPending}
                      >
                        <ArrowDownToLine className="h-3 w-3" />
                        Devolver
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      onClick={() => handleRemove(kit)}
                      disabled={removeFromKit.isPending || kit.status === 'checked_out'}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </ScrollArea>
      )}
      </TabsContent>

      <TabsContent value="timeline" className="mt-0">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <History className="h-4 w-4" />
              Histórico de Movimentações
            </CardTitle>
          </CardHeader>
          <CardContent>
            {timelineLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : timeline.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <History className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Nenhuma movimentação registrada</p>
              </div>
            ) : (
              <div className="space-y-3">
                {timeline.map((entry) => (
                  <div key={entry.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                    <div className={cn(
                      "p-1.5 rounded-full",
                      entry.type === 'checkout' && "bg-warning/20 text-warning",
                      entry.type === 'return' && "bg-success/20 text-success",
                      entry.type === 'kit_added' && "bg-primary/20 text-primary"
                    )}>
                      {entry.type === 'checkout' && <ArrowUpFromLine className="h-3 w-3" />}
                      {entry.type === 'return' && <ArrowDownToLine className="h-3 w-3" />}
                      {entry.type === 'kit_added' && <Plus className="h-3 w-3" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">
                        {entry.type === 'checkout' && 'Retirada'}
                        {entry.type === 'return' && 'Devolução'}
                        {entry.type === 'kit_added' && 'Adicionado'}
                        : {entry.itemName}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                        <span>{format(new Date(entry.timestamp), "dd/MM/yy HH:mm", { locale: ptBR })}</span>
                        {entry.userName && (
                          <>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {entry.userName}
                            </span>
                          </>
                        )}
                        {entry.quantity && entry.quantity > 1 && (
                          <>
                            <span>•</span>
                            <span>Qtd: {entry.quantity}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
};
