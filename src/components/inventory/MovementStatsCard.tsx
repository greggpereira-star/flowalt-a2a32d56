import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowDownLeft,
  ArrowUpRight,
  RefreshCw,
  Package,
  TrendingUp,
  TrendingDown,
  Activity,
} from "lucide-react";
import { useMovementStats } from "@/hooks/useStockOperations";

interface Props {
  period?: 'day' | 'week' | 'month';
}

export function MovementStatsCard({ period = 'month' }: Props) {
  const { data: stats, isLoading } = useMovementStats(period);

  const periodLabels = {
    day: 'Hoje',
    week: 'Última Semana',
    month: 'Último Mês',
  };

  if (isLoading || !stats) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Movimentações
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-2">
            <div className="h-8 bg-muted rounded" />
            <div className="h-4 bg-muted rounded w-2/3" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Movimentações
          </CardTitle>
          <Badge variant="outline">{periodLabels[period]}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Main stats */}
        <div className="flex items-center justify-between">
          <div className="text-center">
            <p className="text-2xl font-bold">{stats.totalMovements}</p>
            <p className="text-xs text-muted-foreground">Total</p>
          </div>
          <div className="flex gap-4">
            <div className="text-center">
              <div className="flex items-center gap-1 justify-center">
                <TrendingUp className="h-4 w-4 text-green-600" />
                <span className="text-lg font-semibold text-green-600">+{stats.totalIn}</span>
              </div>
              <p className="text-xs text-muted-foreground">Entradas</p>
            </div>
            <div className="text-center">
              <div className="flex items-center gap-1 justify-center">
                <TrendingDown className="h-4 w-4 text-red-600" />
                <span className="text-lg font-semibold text-red-600">-{stats.totalOut}</span>
              </div>
              <p className="text-xs text-muted-foreground">Saídas</p>
            </div>
          </div>
        </div>

        {/* Breakdown */}
        <div className="grid grid-cols-5 gap-2 pt-2 border-t">
          <div className="text-center">
            <div className="flex items-center justify-center gap-1">
              <ArrowDownLeft className="h-3 w-3 text-green-600" />
              <span className="font-medium">{stats.entries}</span>
            </div>
            <p className="text-xs text-muted-foreground">Entradas</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1">
              <ArrowUpRight className="h-3 w-3 text-red-600" />
              <span className="font-medium">{stats.exits}</span>
            </div>
            <p className="text-xs text-muted-foreground">Saídas</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1">
              <RefreshCw className="h-3 w-3 text-blue-600" />
              <span className="font-medium">{stats.returns}</span>
            </div>
            <p className="text-xs text-muted-foreground">Devoluções</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1">
              <Package className="h-3 w-3 text-purple-600" />
              <span className="font-medium">{stats.transfers}</span>
            </div>
            <p className="text-xs text-muted-foreground">Transf.</p>
          </div>
          <div className="text-center">
            <span className="font-medium">{stats.adjustments}</span>
            <p className="text-xs text-muted-foreground">Ajustes</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
