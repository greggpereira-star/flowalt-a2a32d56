import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Package, AlertTriangle, Wrench, TrendingDown, CreditCard, Plus } from "lucide-react";
import { useInventoryItems, useLowStockItems, useExpiringWarranties } from "@/hooks/useInventory";
import { useMaintenanceRecords, useMaintenanceCostByItem } from "@/hooks/useMaintenance";
import { useDepreciationSummary } from "@/hooks/useDepreciation";
import { useSubscriptions, useExpiringSubscriptions, useUnderutilizedSubscriptions } from "@/hooks/useSubscriptions";
import { InventoryItemsList } from "./InventoryItemsList";
import { InventoryMovementsList } from "./InventoryMovementsList";
import { MaintenancePanel } from "./MaintenancePanel";
import { DepreciationPanel } from "./DepreciationPanel";
import { SubscriptionsPanel } from "./SubscriptionsPanel";
import { InventoryAlertsPanel } from "./InventoryAlertsPanel";
import { KitTemplatesManager } from "./KitTemplatesManager";

export function InventoryDashboard() {
  const [activeTab, setActiveTab] = useState("catalog");
  
  const { data: items = [] } = useInventoryItems();
  const { data: lowStockItems = [] } = useLowStockItems();
  const { data: expiringWarranties = [] } = useExpiringWarranties(30);
  const { data: maintenanceRecords = [] } = useMaintenanceRecords();
  const { data: depreciationSummary } = useDepreciationSummary();
  const { data: subscriptions = [] } = useSubscriptions();
  const { data: expiringSubscriptions = [] } = useExpiringSubscriptions(30);
  const { data: underutilized = [] } = useUnderutilizedSubscriptions();

  const pendingMaintenance = maintenanceRecords.filter(m => !m.is_resolved).length;
  const totalAlerts = lowStockItems.length + expiringWarranties.length + expiringSubscriptions.length + underutilized.length;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Itens no Catálogo</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{items.length}</div>
            <p className="text-xs text-muted-foreground">
              {items.filter(i => i.category === 'asset').length} patrimônios
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Estoque Baixo</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{lowStockItems.length}</div>
            <p className="text-xs text-muted-foreground">
              itens abaixo do mínimo
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Em Manutenção</CardTitle>
            <Wrench className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingMaintenance}</div>
            <p className="text-xs text-muted-foreground">
              pendentes de resolução
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Valor Contábil</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(depreciationSummary?.totalBookValue || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              {depreciationSummary?.totalAssets || 0} ativos depreciáveis
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Licenças Ativas</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{subscriptions.filter(s => s.status === 'active').length}</div>
            <p className="text-xs text-muted-foreground">
              {expiringSubscriptions.length} renovando em breve
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Alerts Summary */}
      {totalAlerts > 0 && (
        <Card className="border-warning/50 bg-warning/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-warning" />
              Alertas Pendentes
              <Badge variant="outline" className="ml-2">{totalAlerts}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {lowStockItems.length > 0 && (
                <Badge variant="destructive">{lowStockItems.length} estoque baixo</Badge>
              )}
              {expiringWarranties.length > 0 && (
                <Badge variant="secondary">{expiringWarranties.length} garantias vencendo</Badge>
              )}
              {expiringSubscriptions.length > 0 && (
                <Badge variant="outline">{expiringSubscriptions.length} licenças renovando</Badge>
              )}
              {underutilized.length > 0 && (
                <Badge variant="outline">{underutilized.length} licenças subutilizadas</Badge>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-7">
          <TabsTrigger value="catalog">Catálogo</TabsTrigger>
          <TabsTrigger value="movements">Movimentações</TabsTrigger>
          <TabsTrigger value="maintenance">Manutenção</TabsTrigger>
          <TabsTrigger value="depreciation">Depreciação</TabsTrigger>
          <TabsTrigger value="subscriptions">Licenças</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="alerts">Alertas</TabsTrigger>
        </TabsList>

        <TabsContent value="catalog" className="mt-6">
          <InventoryItemsList />
        </TabsContent>

        <TabsContent value="movements" className="mt-6">
          <InventoryMovementsList />
        </TabsContent>

        <TabsContent value="maintenance" className="mt-6">
          <MaintenancePanel />
        </TabsContent>

        <TabsContent value="depreciation" className="mt-6">
          <DepreciationPanel />
        </TabsContent>

        <TabsContent value="subscriptions" className="mt-6">
          <SubscriptionsPanel />
        </TabsContent>

        <TabsContent value="templates" className="mt-6">
          <KitTemplatesManager />
        </TabsContent>

        <TabsContent value="alerts" className="mt-6">
          <InventoryAlertsPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
