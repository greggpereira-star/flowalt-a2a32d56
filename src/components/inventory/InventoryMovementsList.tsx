import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ArrowDownLeft, ArrowUpRight, RefreshCw, ArrowLeftRight, Settings2, Plus } from "lucide-react";
import { useInventoryMovements, MovementType } from "@/hooks/useInventory";
import { MovementForm } from "./MovementForm";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export function InventoryMovementsList() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<MovementType | null>(null);
  
  const { data: movements = [], isLoading } = useInventoryMovements();

  const getMovementIcon = (type: MovementType) => {
    const icons: Record<MovementType, React.ReactNode> = {
      IN: <ArrowDownLeft className="h-4 w-4 text-green-600" />,
      OUT: <ArrowUpRight className="h-4 w-4 text-red-600" />,
      RETURN: <RefreshCw className="h-4 w-4 text-blue-600" />,
      TRANSFER: <ArrowLeftRight className="h-4 w-4 text-purple-600" />,
      ADJUST: <Settings2 className="h-4 w-4 text-muted-foreground" />,
    };
    return icons[type];
  };

  const getMovementBadge = (type: MovementType) => {
    const variants: Record<MovementType, { label: string; className: string }> = {
      IN: { label: "Entrada", className: "bg-green-500/10 text-green-600 border-green-500/20" },
      OUT: { label: "Saída", className: "bg-red-500/10 text-red-600 border-red-500/20" },
      RETURN: { label: "Devolução", className: "bg-blue-500/10 text-blue-600 border-blue-500/20" },
      TRANSFER: { label: "Transferência", className: "bg-purple-500/10 text-purple-600 border-purple-500/20" },
      ADJUST: { label: "Ajuste", className: "bg-gray-500/10 text-gray-600 border-gray-500/20" },
    };
    const config = variants[type];
    return (
      <Badge variant="outline" className={config.className}>
        <span className="flex items-center gap-1">
          {getMovementIcon(type)}
          {config.label}
        </span>
      </Badge>
    );
  };

  const openCreateDialog = (type: MovementType) => {
    setSelectedType(type);
    setIsCreateOpen(true);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Movimentações</CardTitle>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => openCreateDialog('IN')}>
            <ArrowDownLeft className="h-4 w-4 mr-1" />
            Entrada
          </Button>
          <Button variant="outline" size="sm" onClick={() => openCreateDialog('OUT')}>
            <ArrowUpRight className="h-4 w-4 mr-1" />
            Saída
          </Button>
          <Button variant="outline" size="sm" onClick={() => openCreateDialog('RETURN')}>
            <RefreshCw className="h-4 w-4 mr-1" />
            Devolução
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Carregando...</div>
        ) : movements.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Nenhuma movimentação registrada
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Item</TableHead>
                <TableHead className="text-right">Quantidade</TableHead>
                <TableHead>Observações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {movements.map((movement) => (
                <TableRow key={movement.id}>
                  <TableCell className="whitespace-nowrap">
                    {format(new Date(movement.occurred_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                  </TableCell>
                  <TableCell>{getMovementBadge(movement.movement_type)}</TableCell>
                  <TableCell className="font-medium">
                    {movement.item?.name || 'Item removido'}
                    {movement.unit?.serial_number && (
                      <span className="text-xs text-muted-foreground ml-2">
                        ({movement.unit.serial_number})
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {movement.movement_type === 'OUT' ? '-' : '+'}{movement.quantity}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm max-w-[200px] truncate">
                    {movement.notes || '-'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {selectedType === 'IN' && 'Registrar Entrada'}
                {selectedType === 'OUT' && 'Registrar Saída'}
                {selectedType === 'RETURN' && 'Registrar Devolução'}
                {selectedType === 'TRANSFER' && 'Registrar Transferência'}
                {selectedType === 'ADJUST' && 'Registrar Ajuste'}
              </DialogTitle>
            </DialogHeader>
            {selectedType && (
              <MovementForm 
                type={selectedType} 
                onSuccess={() => setIsCreateOpen(false)} 
              />
            )}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
