import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useWarrantyStatus, useWarrantyStats, WarrantyFilter, WarrantyStatusEntry } from "@/hooks/useWarrantyStatus";
import { Shield, ShieldAlert, ShieldCheck, ShieldX, AlertTriangle, Clock, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Skeleton } from "@/components/ui/skeleton";

const statusConfig: Record<string, { icon: React.ReactNode; label: string; variant: "default" | "destructive" | "outline" | "secondary" }> = {
  expired: { icon: <ShieldX className="h-4 w-4" />, label: "Vencida", variant: "destructive" },
  critical: { icon: <ShieldAlert className="h-4 w-4" />, label: "Crítico (≤7d)", variant: "destructive" },
  warning: { icon: <AlertTriangle className="h-4 w-4" />, label: "Atenção (≤15d)", variant: "secondary" },
  attention: { icon: <Clock className="h-4 w-4" />, label: "Alerta (≤30d)", variant: "outline" },
  ok: { icon: <ShieldCheck className="h-4 w-4" />, label: "OK", variant: "default" },
  no_warranty: { icon: <Shield className="h-4 w-4" />, label: "Sem Garantia", variant: "outline" },
};

export function WarrantyStatusPanel() {
  const [filter, setFilter] = useState<WarrantyFilter>('all');
  const { data: warranties, isLoading, refetch } = useWarrantyStatus(filter);
  const { data: stats } = useWarrantyStats();

  const renderStatusBadge = (status: string) => {
    const config = statusConfig[status] || statusConfig.no_warranty;
    return (
      <Badge variant={config.variant} className="gap-1">
        {config.icon}
        {config.label}
      </Badge>
    );
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return format(new Date(dateStr), 'dd/MM/yyyy', { locale: ptBR });
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{stats?.total || 0}</div>
            <p className="text-sm text-muted-foreground">Total</p>
          </CardContent>
        </Card>
        <Card className="border-destructive/50">
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-destructive">{stats?.expired || 0}</div>
            <p className="text-sm text-muted-foreground">Vencidas</p>
          </CardContent>
        </Card>
        <Card className="border-destructive/30">
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-destructive/80">{stats?.critical || 0}</div>
            <p className="text-sm text-muted-foreground">Crítico (≤7d)</p>
          </CardContent>
        </Card>
        <Card className="border-warning/50">
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-amber-600">{stats?.warning || 0}</div>
            <p className="text-sm text-muted-foreground">Atenção (≤15d)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-blue-600">{stats?.attention || 0}</div>
            <p className="text-sm text-muted-foreground">Alerta (≤30d)</p>
          </CardContent>
        </Card>
        <Card className="border-green-500/50">
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-green-600">{stats?.ok || 0}</div>
            <p className="text-sm text-muted-foreground">OK</p>
          </CardContent>
        </Card>
      </div>

      {/* Filter Tabs */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Status de Garantias
          </CardTitle>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
        </CardHeader>
        <CardContent>
          <Tabs value={filter} onValueChange={(v) => setFilter(v as WarrantyFilter)}>
            <TabsList className="mb-4">
              <TabsTrigger value="all">Todos</TabsTrigger>
              <TabsTrigger value="expired" className="text-destructive">Vencidas</TabsTrigger>
              <TabsTrigger value="critical">Crítico</TabsTrigger>
              <TabsTrigger value="warning">Atenção</TabsTrigger>
              <TabsTrigger value="attention">Alerta</TabsTrigger>
              <TabsTrigger value="ok">OK</TabsTrigger>
            </TabsList>

            <TabsContent value={filter} className="mt-0">
              {isLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : warranties?.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhuma garantia encontrada com este filtro.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead>Número de Série</TableHead>
                      <TableHead>Fornecedor</TableHead>
                      <TableHead>Início</TableHead>
                      <TableHead>Vencimento</TableHead>
                      <TableHead>Dias Restantes</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {warranties?.map((warranty: WarrantyStatusEntry) => (
                      <TableRow key={warranty.unit_id}>
                        <TableCell className="font-medium">{warranty.item_name}</TableCell>
                        <TableCell>{warranty.serial_number || '-'}</TableCell>
                        <TableCell>{warranty.warranty_provider || '-'}</TableCell>
                        <TableCell>{formatDate(warranty.warranty_start_date)}</TableCell>
                        <TableCell>{formatDate(warranty.warranty_end_date)}</TableCell>
                        <TableCell>
                          {warranty.days_until_expiry !== null ? (
                            <span className={warranty.days_until_expiry <= 0 ? 'text-destructive font-bold' : ''}>
                              {warranty.days_until_expiry <= 0 
                                ? `${Math.abs(warranty.days_until_expiry)} dias atrás`
                                : `${warranty.days_until_expiry} dias`
                              }
                            </span>
                          ) : '-'}
                        </TableCell>
                        <TableCell>{renderStatusBadge(warranty.warranty_status)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
