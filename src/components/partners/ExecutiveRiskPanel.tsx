import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  AlertTriangle,
  Shield,
  CreditCard,
  Package,
  Wrench,
  TrendingDown,
  ArrowUpFromLine,
  Clock,
} from "lucide-react";
import { useInventoryExecKPIs } from "@/hooks/useInventoryKPIs";

export function ExecutiveRiskPanel() {
  const { data: kpis, isLoading } = useInventoryExecKPIs();

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  if (isLoading || !kpis) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Riscos Operacionais</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-muted rounded w-3/4" />
            <div className="h-4 bg-muted rounded w-1/2" />
            <div className="h-4 bg-muted rounded w-2/3" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const risks = [];

  // Warranty risks
  if (kpis.warrantiesExpired > 0) {
    risks.push({
      type: 'critical',
      icon: Shield,
      title: `${kpis.warrantiesExpired} garantias vencidas`,
      description: 'Equipamentos sem cobertura',
    });
  }
  if (kpis.warrantiesExpiringSoon > 0) {
    risks.push({
      type: 'warning',
      icon: Shield,
      title: `${kpis.warrantiesExpiringSoon} garantias vencendo`,
      description: 'Próximos 30 dias',
    });
  }

  // Subscription risks
  if (kpis.subscriptionsExpiringSoon > 0) {
    risks.push({
      type: 'warning',
      icon: CreditCard,
      title: `${kpis.subscriptionsExpiringSoon} licenças renovando`,
      description: 'Próximos 30 dias',
    });
  }
  if (kpis.underutilizedLicenses > 0) {
    risks.push({
      type: 'info',
      icon: TrendingDown,
      title: `${kpis.underutilizedLicenses} licenças subutilizadas`,
      description: `Economia potencial: ${formatCurrency(kpis.potentialSavings)}/mês`,
    });
  }

  // Stock risks
  if (kpis.outOfStockItems > 0) {
    risks.push({
      type: 'critical',
      icon: Package,
      title: `${kpis.outOfStockItems} itens sem estoque`,
      description: 'Reposição urgente necessária',
    });
  }
  if (kpis.lowStockItems > 0) {
    risks.push({
      type: 'warning',
      icon: Package,
      title: `${kpis.lowStockItems} itens com estoque baixo`,
      description: 'Abaixo do mínimo configurado',
    });
  }

  // Maintenance risks
  if (kpis.pendingMaintenance > 0) {
    risks.push({
      type: 'warning',
      icon: Wrench,
      title: `${kpis.pendingMaintenance} manutenções pendentes`,
      description: `Custo MTD: ${formatCurrency(kpis.maintenanceCostMTD)}`,
    });
  }

  // Operations risks
  if (kpis.overdueReturns > 0) {
    risks.push({
      type: 'warning',
      icon: Clock,
      title: `${kpis.overdueReturns} devoluções atrasadas`,
      description: 'Itens de kit não devolvidos',
    });
  }

  const getRiskColor = (type: string) => {
    switch (type) {
      case 'critical': return 'border-l-destructive bg-destructive/5';
      case 'warning': return 'border-l-warning bg-warning/5';
      default: return 'border-l-primary bg-primary/5';
    }
  };

  const getIconColor = (type: string) => {
    switch (type) {
      case 'critical': return 'text-destructive';
      case 'warning': return 'text-warning';
      default: return 'text-primary';
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Riscos Operacionais
          </CardTitle>
          <Badge 
            variant={risks.length > 3 ? 'destructive' : risks.length > 0 ? 'secondary' : 'outline'}
          >
            {risks.length} alertas
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {risks.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <Shield className="h-8 w-8 mx-auto mb-2 text-success" />
            <p className="text-sm font-medium">Nenhum risco identificado</p>
          </div>
        ) : (
          <div className="space-y-2">
            {risks.slice(0, 5).map((risk, index) => (
              <div
                key={index}
                className={`flex items-start gap-3 p-3 rounded-lg border-l-4 ${getRiskColor(risk.type)}`}
              >
                <risk.icon className={`h-4 w-4 mt-0.5 ${getIconColor(risk.type)}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{risk.title}</p>
                  <p className="text-xs text-muted-foreground">{risk.description}</p>
                </div>
              </div>
            ))}
            {risks.length > 5 && (
              <p className="text-xs text-muted-foreground text-center pt-2">
                +{risks.length - 5} outros alertas
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
