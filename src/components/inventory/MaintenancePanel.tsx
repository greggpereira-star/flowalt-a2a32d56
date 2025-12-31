import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Wrench, Plus, CheckCircle2 } from "lucide-react";
import { useMaintenanceRecords, useMaintenanceCostByItem, useUpdateMaintenanceRecord } from "@/hooks/useMaintenance";
import { MaintenanceForm } from "./MaintenanceForm";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export function MaintenancePanel() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  
  const { data: records = [], isLoading } = useMaintenanceRecords();
  const { data: costByItem = [] } = useMaintenanceCostByItem();
  const updateRecord = useUpdateMaintenanceRecord();

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const handleResolve = async (id: string) => {
    await updateRecord.mutateAsync({ id, is_resolved: true });
  };

  return (
    <div className="space-y-6">
      {/* Cost Summary */}
      {costByItem.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Custo Acumulado por Item</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {costByItem.slice(0, 4).map((item) => (
                <div key={item.itemId} className="p-3 rounded-lg bg-muted/50">
                  <p className="text-sm font-medium truncate">{item.itemName}</p>
                  <p className="text-lg font-bold">{formatCurrency(item.totalCost)}</p>
                  <p className="text-xs text-muted-foreground">{item.count} manutenções</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Wrench className="h-5 w-5" />
            Histórico de Manutenções
          </CardTitle>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Registrar Manutenção
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Nova Manutenção</DialogTitle>
              </DialogHeader>
              <MaintenanceForm onSuccess={() => setIsCreateOpen(false)} />
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Carregando...</div>
          ) : records.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhuma manutenção registrada
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead>Problema</TableHead>
                  <TableHead className="text-right">Custo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[100px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell className="whitespace-nowrap">
                      {format(new Date(record.service_date), "dd/MM/yyyy", { locale: ptBR })}
                    </TableCell>
                    <TableCell className="font-medium">
                      {record.item?.name || 'Item removido'}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {record.problem_description}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(record.cost)}
                    </TableCell>
                    <TableCell>
                      {record.is_resolved ? (
                        <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20">
                          Resolvido
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">
                          Pendente
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {!record.is_resolved && (
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => handleResolve(record.id)}
                          disabled={updateRecord.isPending}
                        >
                          <CheckCircle2 className="h-4 w-4 mr-1" />
                          Resolver
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
