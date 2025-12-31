import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Package, Shield, CreditCard, TrendingDown, CheckCircle2 } from "lucide-react";
import { useLowStockItems, useExpiringWarranties } from "@/hooks/useInventory";
import { useExpiringSubscriptions, useUnderutilizedSubscriptions } from "@/hooks/useSubscriptions";
import { differenceInDays, format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface AlertItem {
  id: string;
  type: 'low_stock' | 'warranty_expiring' | 'subscription_expiring' | 'underutilized';
  severity: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  dueDate?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function InventoryAlertsPanel() {
  const { data: lowStockItems = [] } = useLowStockItems();
  const { data: expiringWarranties = [] } = useExpiringWarranties(30);
  const { data: expiringSubscriptions = [] } = useExpiringSubscriptions(30);
  const { data: underutilized = [] } = useUnderutilizedSubscriptions();

  // Build alerts list
  const alerts: AlertItem[] = [
    // Low stock alerts
    ...lowStockItems.map((item) => ({
      id: `stock-${item.id}`,
      type: 'low_stock' as const,
      severity: item.current_stock === 0 ? 'high' as const : 'medium' as const,
      title: item.name,
      description: `Estoque: ${item.current_stock} / Mínimo: ${item.min_stock}`,
    })),
    // Warranty alerts
    ...expiringWarranties.map((unit) => {
      const daysLeft = differenceInDays(new Date(unit.warranty_end_date!), new Date());
      return {
        id: `warranty-${unit.id}`,
        type: 'warranty_expiring' as const,
        severity: daysLeft <= 7 ? 'high' as const : daysLeft <= 15 ? 'medium' as const : 'low' as const,
        title: unit.item?.name || 'Item',
        description: `Garantia expira em ${daysLeft} dias (${format(new Date(unit.warranty_end_date!), "dd/MM/yyyy", { locale: ptBR })})`,
        dueDate: unit.warranty_end_date,
      };
    }),
    // Subscription expiring alerts
    ...expiringSubscriptions.map((sub) => {
      const daysLeft = differenceInDays(new Date(sub.renewal_date), new Date());
      return {
        id: `sub-exp-${sub.id}`,
        type: 'subscription_expiring' as const,
        severity: daysLeft <= 7 ? 'high' as const : daysLeft <= 15 ? 'medium' as const : 'low' as const,
        title: sub.product_name,
        description: `Renovação em ${daysLeft} dias (${format(new Date(sub.renewal_date), "dd/MM/yyyy", { locale: ptBR })})`,
        dueDate: sub.renewal_date,
      };
    }),
    // Underutilized subscriptions
    ...underutilized.map((sub) => ({
      id: `sub-under-${sub.id}`,
      type: 'underutilized' as const,
      severity: 'low' as const,
      title: sub.product_name,
      description: `Apenas ${sub.seats_used}/${sub.seats_total} licenças em uso. Considere downgrade.`,
    })),
  ];

  // Sort by severity
  const sortedAlerts = alerts.sort((a, b) => {
    const severityOrder = { high: 0, medium: 1, low: 2 };
    return severityOrder[a.severity] - severityOrder[b.severity];
  });

  const getAlertIcon = (type: string) => {
    const icons: Record<string, React.ReactNode> = {
      low_stock: <Package className="h-4 w-4" />,
      warranty_expiring: <Shield className="h-4 w-4" />,
      subscription_expiring: <CreditCard className="h-4 w-4" />,
      underutilized: <TrendingDown className="h-4 w-4" />,
    };
    return icons[type];
  };

  const getSeverityColor = (severity: string) => {
    const colors: Record<string, string> = {
      high: "bg-destructive/10 border-destructive/20 text-destructive",
      medium: "bg-warning/10 border-warning/20 text-warning",
      low: "bg-muted border-muted-foreground/20 text-muted-foreground",
    };
    return colors[severity];
  };

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      low_stock: "Estoque Baixo",
      warranty_expiring: "Garantia",
      subscription_expiring: "Renovação",
      underutilized: "Subutilização",
    };
    return labels[type];
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" />
          Central de Alertas
          {sortedAlerts.length > 0 && (
            <Badge variant="outline" className="ml-2">{sortedAlerts.length}</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {sortedAlerts.length === 0 ? (
          <div className="text-center py-12">
            <CheckCircle2 className="h-12 w-12 mx-auto text-green-500 mb-4" />
            <p className="text-lg font-medium">Tudo em ordem!</p>
            <p className="text-muted-foreground">Nenhum alerta pendente no momento.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sortedAlerts.map((alert) => (
              <div
                key={alert.id}
                className={`flex items-start gap-3 p-4 rounded-lg border ${getSeverityColor(alert.severity)}`}
              >
                <div className="mt-0.5">{getAlertIcon(alert.type)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline" className="text-xs">
                      {getTypeLabel(alert.type)}
                    </Badge>
                    {alert.severity === 'high' && (
                      <Badge variant="destructive" className="text-xs">Urgente</Badge>
                    )}
                  </div>
                  <p className="font-medium">{alert.title}</p>
                  <p className="text-sm opacity-80">{alert.description}</p>
                </div>
                {alert.actionLabel && (
                  <Button size="sm" variant="outline" onClick={alert.onAction}>
                    {alert.actionLabel}
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
