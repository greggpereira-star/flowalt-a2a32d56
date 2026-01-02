import { useMemo, useEffect, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AlertTriangle,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Bell,
  X,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useCostCentersWithBudget, CostCenterWithActual } from "@/hooks/useCostCenters";
import { useExternalCollaborators } from "@/hooks/useExternalCollaborators";
import { toast } from "sonner";

interface BudgetAlert {
  id: string;
  centerId: string;
  centerName: string;
  centerColor: string;
  type: 'warning' | 'critical' | 'exceeded';
  percentage: number;
  budget: number;
  spent: number;
  remaining: number;
  message: string;
  createdAt: Date;
}

interface BudgetAlertsPanelProps {
  selectedMonth?: Date;
}

export function BudgetAlertsPanel({ selectedMonth = new Date() }: BudgetAlertsPanelProps) {
  const { data: centersWithBudget = [] } = useCostCentersWithBudget();
  const { data: externalCollaborators = [] } = useExternalCollaborators();
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set());
  const [previousAlertIds, setPreviousAlertIds] = useState<Set<string>>(new Set());

  // Calculate collaborator salaries by cost center
  const collaboratorSalaryByCenter = useMemo(() => {
    const salaries: Record<string, number> = {};
    
    externalCollaborators
      .filter(c => c.is_active && c.cost_center_id)
      .forEach(c => {
        const centerId = c.cost_center_id!;
        salaries[centerId] = (salaries[centerId] || 0) + (c.base_salary || 0);
      });
    
    return salaries;
  }, [externalCollaborators]);

  // Generate alerts based on budget usage
  const alerts = useMemo<BudgetAlert[]>(() => {
    const newAlerts: BudgetAlert[] = [];

    centersWithBudget.forEach(center => {
      if (!center.budget_monthly || center.budget_monthly <= 0) return;

      const salarySpent = collaboratorSalaryByCenter[center.id] || 0;
      const totalSpent = (center.actual_spent || 0) + salarySpent;
      const percentage = (totalSpent / center.budget_monthly) * 100;
      const remaining = center.budget_monthly - totalSpent;

      if (percentage >= 100) {
        newAlerts.push({
          id: `exceeded-${center.id}`,
          centerId: center.id,
          centerName: center.name,
          centerColor: center.color || '#EF4444',
          type: 'exceeded',
          percentage,
          budget: center.budget_monthly,
          spent: totalSpent,
          remaining,
          message: `Orçamento excedido em ${formatCurrency(Math.abs(remaining))}`,
          createdAt: new Date(),
        });
      } else if (percentage >= 90) {
        newAlerts.push({
          id: `critical-${center.id}`,
          centerId: center.id,
          centerName: center.name,
          centerColor: center.color || '#F97316',
          type: 'critical',
          percentage,
          budget: center.budget_monthly,
          spent: totalSpent,
          remaining,
          message: `Atingiu ${percentage.toFixed(0)}% do orçamento`,
          createdAt: new Date(),
        });
      } else if (percentage >= 80) {
        newAlerts.push({
          id: `warning-${center.id}`,
          centerId: center.id,
          centerName: center.name,
          centerColor: center.color || '#EAB308',
          type: 'warning',
          percentage,
          budget: center.budget_monthly,
          spent: totalSpent,
          remaining,
          message: `Atingiu ${percentage.toFixed(0)}% do orçamento`,
          createdAt: new Date(),
        });
      }
    });

    // Sort by severity (exceeded first, then critical, then warning)
    return newAlerts
      .filter(alert => !dismissedAlerts.has(alert.id))
      .sort((a, b) => {
        const order = { exceeded: 0, critical: 1, warning: 2 };
        return order[a.type] - order[b.type];
      });
  }, [centersWithBudget, collaboratorSalaryByCenter, dismissedAlerts]);

  // Show toast for new critical/exceeded alerts
  useEffect(() => {
    const currentAlertIds = new Set(alerts.map(a => a.id));
    
    alerts.forEach(alert => {
      if (!previousAlertIds.has(alert.id) && (alert.type === 'exceeded' || alert.type === 'critical')) {
        toast.error(`${alert.centerName}: ${alert.message}`, {
          description: `Orçamento: ${formatCurrency(alert.budget)}`,
          duration: 5000,
        });
      }
    });

    setPreviousAlertIds(currentAlertIds);
  }, [alerts, previousAlertIds]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const getAlertIcon = (type: BudgetAlert['type']) => {
    switch (type) {
      case 'exceeded':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      case 'critical':
        return <AlertTriangle className="w-4 h-4 text-orange-500" />;
      case 'warning':
        return <TrendingUp className="w-4 h-4 text-yellow-500" />;
    }
  };

  const getAlertBadge = (type: BudgetAlert['type']) => {
    switch (type) {
      case 'exceeded':
        return <Badge className="bg-red-500/20 text-red-500 border-red-500/30">Excedido</Badge>;
      case 'critical':
        return <Badge className="bg-orange-500/20 text-orange-500 border-orange-500/30">Crítico</Badge>;
      case 'warning':
        return <Badge className="bg-yellow-500/20 text-yellow-500 border-yellow-500/30">Atenção</Badge>;
    }
  };

  const handleDismiss = (alertId: string) => {
    setDismissedAlerts(prev => new Set([...prev, alertId]));
  };

  const exceededCount = alerts.filter(a => a.type === 'exceeded').length;
  const criticalCount = alerts.filter(a => a.type === 'critical').length;
  const warningCount = alerts.filter(a => a.type === 'warning').length;

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant={alerts.length > 0 ? "destructive" : "outline"}
          size="sm"
          className="relative"
        >
          <Bell className="w-4 h-4 mr-2" />
          Alertas
          {alerts.length > 0 && (
            <span className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-[10px] text-white font-medium">
              {alerts.length}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[400px] sm:w-[540px]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Bell className="w-5 h-5" />
            Alertas de Orçamento
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          {/* Summary */}
          <div className="grid grid-cols-3 gap-3">
            <Card className="border-red-500/30">
              <CardContent className="p-3 text-center">
                <p className="text-2xl font-bold text-red-500">{exceededCount}</p>
                <p className="text-xs text-muted-foreground">Excedidos</p>
              </CardContent>
            </Card>
            <Card className="border-orange-500/30">
              <CardContent className="p-3 text-center">
                <p className="text-2xl font-bold text-orange-500">{criticalCount}</p>
                <p className="text-xs text-muted-foreground">Críticos</p>
              </CardContent>
            </Card>
            <Card className="border-yellow-500/30">
              <CardContent className="p-3 text-center">
                <p className="text-2xl font-bold text-yellow-500">{warningCount}</p>
                <p className="text-xs text-muted-foreground">Atenção</p>
              </CardContent>
            </Card>
          </div>

          {/* Alert List */}
          <ScrollArea className="h-[calc(100vh-280px)]">
            <div className="space-y-3 pr-4">
              {alerts.length === 0 ? (
                <Card>
                  <CardContent className="p-6 text-center">
                    <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
                    <p className="font-medium">Nenhum alerta ativo</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Todos os centros de custo estão dentro do orçamento
                    </p>
                  </CardContent>
                </Card>
              ) : (
                alerts.map(alert => (
                  <Card 
                    key={alert.id} 
                    className={`border-l-4 ${
                      alert.type === 'exceeded' 
                        ? 'border-l-red-500' 
                        : alert.type === 'critical' 
                          ? 'border-l-orange-500' 
                          : 'border-l-yellow-500'
                    }`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: alert.centerColor }}
                          />
                          <span className="font-medium">{alert.centerName}</span>
                          {getAlertBadge(alert.type)}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => handleDismiss(alert.id)}
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                      
                      <p className="text-sm text-muted-foreground mt-2">
                        {alert.message}
                      </p>
                      
                      <div className="mt-3 space-y-2">
                        <div className="flex justify-between text-xs">
                          <span>Orçamento: {formatCurrency(alert.budget)}</span>
                          <span className={alert.type === 'exceeded' ? 'text-red-500' : ''}>
                            Gasto: {formatCurrency(alert.spent)}
                          </span>
                        </div>
                        <Progress 
                          value={Math.min(alert.percentage, 100)} 
                          className={`h-2 ${
                            alert.type === 'exceeded' 
                              ? '[&>div]:bg-red-500' 
                              : alert.type === 'critical' 
                                ? '[&>div]:bg-orange-500' 
                                : '[&>div]:bg-yellow-500'
                          }`}
                        />
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>{alert.percentage.toFixed(1)}% utilizado</span>
                          {alert.remaining >= 0 ? (
                            <span>Disponível: {formatCurrency(alert.remaining)}</span>
                          ) : (
                            <span className="text-red-500">
                              Excesso: {formatCurrency(Math.abs(alert.remaining))}
                            </span>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </ScrollArea>
        </div>
      </SheetContent>
    </Sheet>
  );
}
