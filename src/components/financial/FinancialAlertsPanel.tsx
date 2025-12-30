import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AlertTriangle,
  Bell,
  CheckCircle,
  Info,
  XCircle,
  Clock,
  TrendingDown,
  CreditCard,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useFinancialAlerts, useAcknowledgeAlert } from "@/hooks/useFinancialReports";

const alertIcons: Record<string, React.ElementType> = {
  overdue: Clock,
  budget_exceeded: TrendingDown,
  payment_due: CreditCard,
  invoice_pending: FileText,
  anomaly: AlertTriangle,
};

const severityColors: Record<string, string> = {
  critical: "bg-red-500/20 text-red-500 border-red-500/30",
  high: "bg-orange-500/20 text-orange-500 border-orange-500/30",
  medium: "bg-yellow-500/20 text-yellow-500 border-yellow-500/30",
  low: "bg-blue-500/20 text-blue-500 border-blue-500/30",
};

const severityLabels: Record<string, string> = {
  critical: "Crítico",
  high: "Alto",
  medium: "Médio",
  low: "Baixo",
};

export function FinancialAlertsPanel() {
  const { data: alerts = [], isLoading } = useFinancialAlerts();
  const acknowledgeAlert = useAcknowledgeAlert();

  const activeAlerts = alerts.filter((a) => a.status === "active");
  const acknowledgedAlerts = alerts.filter((a) => a.status === "acknowledged");

  const handleAcknowledge = (id: string) => {
    acknowledgeAlert.mutate(id);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Bell className="w-5 h-5" />
            Alertas Financeiros
          </h3>
          <p className="text-sm text-muted-foreground">
            Monitoramento inteligente de eventos financeiros
          </p>
        </div>
        <Badge variant="outline" className="gap-1">
          <AlertTriangle className="w-3 h-3" />
          {activeAlerts.length} ativos
        </Badge>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <XCircle className="w-5 h-5 text-red-500" />
              <div>
                <div className="text-2xl font-bold">
                  {alerts.filter((a) => a.severity === "critical" && a.status === "active").length}
                </div>
                <div className="text-xs text-muted-foreground">Críticos</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-orange-500" />
              <div>
                <div className="text-2xl font-bold">
                  {alerts.filter((a) => a.severity === "high" && a.status === "active").length}
                </div>
                <div className="text-xs text-muted-foreground">Altos</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Info className="w-5 h-5 text-yellow-500" />
              <div>
                <div className="text-2xl font-bold">
                  {alerts.filter((a) => a.severity === "medium" && a.status === "active").length}
                </div>
                <div className="text-xs text-muted-foreground">Médios</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-500" />
              <div>
                <div className="text-2xl font-bold">{acknowledgedAlerts.length}</div>
                <div className="text-xs text-muted-foreground">Resolvidos</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Active Alerts */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-orange-500" />
            Alertas Ativos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px]">
            {activeAlerts.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                <CheckCircle className="w-12 h-12 mx-auto mb-2 text-green-500" />
                <p>Nenhum alerta ativo</p>
                <p className="text-sm">Tudo está em ordem!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {activeAlerts.map((alert) => {
                  const Icon = alertIcons[alert.alert_type] || AlertTriangle;
                  return (
                    <div
                      key={alert.id}
                      className="flex items-start gap-4 p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                    >
                      <div className={`p-2 rounded-full ${severityColors[alert.severity]}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium">{alert.title}</span>
                          <Badge className={severityColors[alert.severity]}>
                            {severityLabels[alert.severity]}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{alert.message}</p>
                        <div className="text-xs text-muted-foreground mt-2">
                          {format(new Date(alert.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </div>
                        {alert.suggested_actions && (
                          <div className="mt-2 text-sm">
                            <span className="font-medium">Ações sugeridas:</span>
                            <ul className="list-disc list-inside text-muted-foreground">
                              {(alert.suggested_actions as string[]).map((action, i) => (
                                <li key={i}>{action}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleAcknowledge(alert.id)}
                        disabled={acknowledgeAlert.isPending}
                      >
                        <CheckCircle className="w-4 h-4 mr-1" />
                        Resolver
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Acknowledged Alerts */}
      {acknowledgedAlerts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-500" />
              Alertas Resolvidos Recentemente
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {acknowledgedAlerts.slice(0, 5).map((alert) => (
                <div
                  key={alert.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <span className="text-sm">{alert.title}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {alert.acknowledged_at &&
                      format(new Date(alert.acknowledged_at), "dd/MM 'às' HH:mm", { locale: ptBR })}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
