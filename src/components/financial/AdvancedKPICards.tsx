import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Percent, 
  ArrowUpRight, 
  ArrowDownRight,
  Activity,
  Target,
  Clock,
  AlertCircle,
  Receipt,
  Users
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { FinancialKPIs } from "@/hooks/useFinancialKPIs";
import { Skeleton } from "@/components/ui/skeleton";

interface AdvancedKPICardsProps {
  kpis: FinancialKPIs | null | undefined;
  isLoading: boolean;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    notation: value >= 1000000 ? "compact" : "standard",
  }).format(value);
};

const formatPercent = (value: number) => {
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
};

interface KPICardProps {
  title: string;
  value: string;
  subtitle?: string;
  trend?: number;
  icon: React.ReactNode;
  variant?: "default" | "success" | "warning" | "danger" | "info";
  size?: "sm" | "md" | "lg";
}

function KPICard({ title, value, subtitle, trend, icon, variant = "default", size = "md" }: KPICardProps) {
  const variantStyles = {
    default: "bg-card border-border/50",
    success: "bg-emerald-500/5 border-emerald-500/20",
    warning: "bg-amber-500/5 border-amber-500/20",
    danger: "bg-rose-500/5 border-rose-500/20",
    info: "bg-blue-500/5 border-blue-500/20",
  };

  const iconStyles = {
    default: "bg-muted text-muted-foreground",
    success: "bg-emerald-500/10 text-emerald-500",
    warning: "bg-amber-500/10 text-amber-500",
    danger: "bg-rose-500/10 text-rose-500",
    info: "bg-blue-500/10 text-blue-500",
  };

  const sizeStyles = {
    sm: "p-4",
    md: "p-5",
    lg: "p-6",
  };

  return (
    <Card className={cn(
      "border transition-all duration-200 hover:shadow-md",
      variantStyles[variant]
    )}>
      <CardContent className={cn("space-y-3", sizeStyles[size])}>
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {title}
          </span>
          <div className={cn(
            "p-2 rounded-lg",
            iconStyles[variant]
          )}>
            {icon}
          </div>
        </div>
        
        <div>
          <p className={cn(
            "font-bold tracking-tight",
            size === "lg" ? "text-3xl" : size === "md" ? "text-2xl" : "text-xl"
          )}>
            {value}
          </p>
          
          {(subtitle || trend !== undefined) && (
            <div className="flex items-center gap-2 mt-1">
              {trend !== undefined && (
                <span className={cn(
                  "inline-flex items-center text-xs font-medium",
                  trend >= 0 ? "text-emerald-500" : "text-rose-500"
                )}>
                  {trend >= 0 ? (
                    <ArrowUpRight className="w-3 h-3 mr-0.5" />
                  ) : (
                    <ArrowDownRight className="w-3 h-3 mr-0.5" />
                  )}
                  {formatPercent(trend)}
                </span>
              )}
              {subtitle && (
                <span className="text-xs text-muted-foreground">{subtitle}</span>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function AdvancedKPICards({ kpis, isLoading }: AdvancedKPICardsProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Card key={i} className="border border-border/50">
            <CardContent className="p-5 space-y-3">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-8 w-28" />
              <Skeleton className="h-3 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!kpis) {
    return (
      <div className="text-center text-muted-foreground py-8">
        Nenhum dado disponível
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Primary KPIs Row */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <KPICard
          title="Receita Bruta"
          value={formatCurrency(kpis.revenue)}
          trend={kpis.revenueGrowth}
          subtitle="vs mês anterior"
          icon={<TrendingUp className="w-4 h-4" />}
          variant="success"
          size="md"
        />
        
        <KPICard
          title="Despesas"
          value={formatCurrency(kpis.expenses)}
          trend={kpis.expenseGrowth}
          subtitle="vs mês anterior"
          icon={<TrendingDown className="w-4 h-4" />}
          variant={kpis.expenseGrowth > 10 ? "danger" : "warning"}
          size="md"
        />
        
        <KPICard
          title="Impostos"
          value={formatCurrency(kpis.taxes.total)}
          subtitle={`${kpis.taxes.effectiveRate.toFixed(1)}% s/ receita`}
          icon={<Receipt className="w-4 h-4" />}
          variant="warning"
          size="md"
        />
        
        <KPICard
          title="Lucro Líquido"
          value={formatCurrency(kpis.netProfitAfterTaxes)}
          trend={kpis.profitGrowth}
          subtitle={`Margem: ${kpis.revenue > 0 ? ((kpis.netProfitAfterTaxes / kpis.revenue) * 100).toFixed(1) : 0}%`}
          icon={<DollarSign className="w-4 h-4" />}
          variant={kpis.netProfitAfterTaxes >= 0 ? "success" : "danger"}
          size="md"
        />
        
        <KPICard
          title="EBITDA"
          value={formatCurrency(kpis.ebitda)}
          subtitle={`Margem: ${kpis.ebitdaMargin.toFixed(1)}%`}
          icon={<Activity className="w-4 h-4" />}
          variant="info"
          size="md"
        />
      </div>

      {/* Secondary KPIs Row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <KPICard
          title="Ticket Médio"
          value={formatCurrency(kpis.avgTicket)}
          icon={<Target className="w-4 h-4" />}
          variant="default"
          size="sm"
        />
        
        <KPICard
          title="Folha de Pagamento"
          value={formatCurrency(kpis.payrollTotal)}
          subtitle={`${kpis.payrollCount} colaboradores`}
          icon={<Users className="w-4 h-4" />}
          variant="info"
          size="sm"
        />
        
        <KPICard
          title="Orçamento"
          value={`${Math.abs(kpis.budgetVariance).toFixed(0)}%`}
          subtitle={kpis.budgetVariance >= 0 ? "abaixo do orçado" : "acima do orçado"}
          icon={<Percent className="w-4 h-4" />}
          variant={kpis.budgetVariance >= 0 ? "success" : "warning"}
          size="sm"
        />
        
        <KPICard
          title="PMR / PMP"
          value={`${Math.abs(kpis.avgReceivableTime).toFixed(0)} / ${Math.abs(kpis.avgPaymentTime).toFixed(0)}`}
          subtitle="dias receb / pgto"
          icon={<Clock className="w-4 h-4" />}
          variant="default"
          size="sm"
        />
        
        <KPICard
          title="Vencidos"
          value={kpis.overdueCount.toString()}
          subtitle={`${kpis.pendingCount} pendentes`}
          icon={<AlertCircle className="w-4 h-4" />}
          variant={kpis.overdueCount > 0 ? "danger" : "success"}
          size="sm"
        />
      </div>
    </div>
  );
}
