import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Building2,
  TrendingDown,
  CreditCard,
  Package,
} from "lucide-react";
import { useInventoryExecKPIs } from "@/hooks/useInventoryKPIs";

export function ExecutiveAssetsPanel() {
  const { data: kpis, isLoading } = useInventoryExecKPIs();

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  if (isLoading || !kpis) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ativos & Custos Recorrentes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-16 bg-muted rounded" />
            <div className="h-16 bg-muted rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const depreciationPercentage = kpis.totalAssetValue > 0
    ? ((kpis.totalAssetValue - kpis.totalBookValue) / kpis.totalAssetValue) * 100
    : 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Building2 className="h-4 w-4" />
          Ativos & Custos Recorrentes
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Asset Overview */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Patrimônio ({kpis.assetsCount} ativos)</span>
            <span className="font-medium">{formatCurrency(kpis.totalAssetValue)}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground flex items-center gap-1">
              <TrendingDown className="h-3 w-3" />
              Valor Contábil
            </span>
            <span className="font-medium">{formatCurrency(kpis.totalBookValue)}</span>
          </div>
          <Progress value={100 - depreciationPercentage} className="h-2" />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Depreciação acumulada: {depreciationPercentage.toFixed(0)}%</span>
            <span>{formatCurrency(kpis.monthlyDepreciation)}/mês</span>
          </div>
        </div>

        <div className="border-t pt-4 space-y-3">
          {/* Subscriptions Cost */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              <CreditCard className="h-4 w-4 text-muted-foreground" />
              <span>Licenças/SaaS</span>
            </div>
            <div className="text-right">
              <p className="font-medium text-sm">{formatCurrency(kpis.monthlySubscriptionCost)}/mês</p>
              <p className="text-xs text-muted-foreground">{formatCurrency(kpis.yearlySubscriptionCost)}/ano</p>
            </div>
          </div>

          {/* Maintenance Cost */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              <Package className="h-4 w-4 text-muted-foreground" />
              <span>Manutenção MTD</span>
            </div>
            <p className="font-medium text-sm">{formatCurrency(kpis.maintenanceCostMTD)}</p>
          </div>

          {/* Items Checked Out */}
          {kpis.itemsCheckedOut > 0 && (
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>Itens em uso (jobs)</span>
              <Badge variant="outline">{kpis.itemsCheckedOut}</Badge>
            </div>
          )}
        </div>

        {/* Potential Savings */}
        {kpis.potentialSavings > 0 && (
          <div className="bg-success/10 border border-success/20 rounded-lg p-3 mt-4">
            <p className="text-xs text-success font-medium">
              💡 Economia potencial: {formatCurrency(kpis.potentialSavings)}/mês
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {kpis.underutilizedLicenses} licenças com menos de 50% de uso
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
