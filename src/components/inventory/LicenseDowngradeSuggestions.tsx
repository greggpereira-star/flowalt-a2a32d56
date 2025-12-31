import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  TrendingDown, 
  AlertTriangle, 
  DollarSign, 
  Users,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";
import { useUnderutilizedSubscriptions, type SubscriptionLicense } from "@/hooks/useSubscriptions";
import { toast } from "sonner";

interface DowngradeSuggestion {
  subscription: SubscriptionLicense;
  utilization: number;
  potentialSavings: number;
  suggestedSeats: number;
}

export function LicenseDowngradeSuggestions() {
  const { data: underutilized = [], isLoading } = useUnderutilizedSubscriptions();

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  // Calculate suggestions
  const suggestions: DowngradeSuggestion[] = underutilized.map(sub => {
    const seatsUsed = sub.seats_used || 0;
    const seatsTotal = sub.seats_total || 1;
    const utilization = (seatsUsed / seatsTotal) * 100;
    
    // Suggest seats = used + 20% buffer, rounded up
    const suggestedSeats = Math.ceil(seatsUsed * 1.2);
    
    // Estimate savings (proportional reduction)
    const costPerSeat = sub.cost_per_cycle / seatsTotal;
    const seatsToReduce = seatsTotal - suggestedSeats;
    const potentialSavings = costPerSeat * seatsToReduce;

    return {
      subscription: sub,
      utilization,
      potentialSavings: potentialSavings > 0 ? potentialSavings : 0,
      suggestedSeats,
    };
  }).filter(s => s.potentialSavings > 0)
    .sort((a, b) => b.potentialSavings - a.potentialSavings);

  const totalPotentialSavings = suggestions.reduce((acc, s) => acc + s.potentialSavings, 0);

  const handleAcknowledge = (subscriptionId: string) => {
    toast.success("Sugestão registrada. Revise o contrato com o fornecedor.");
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sugestões de Downgrade</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            <div className="h-16 bg-muted rounded" />
            <div className="h-16 bg-muted rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (suggestions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingDown className="h-4 w-4" />
            Sugestões de Downgrade
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6 text-muted-foreground">
            <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-success" />
            <p className="text-sm font-medium">Todas as licenças bem dimensionadas</p>
            <p className="text-xs">Nenhuma oportunidade de economia identificada</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingDown className="h-4 w-4" />
            Sugestões de Downgrade
          </CardTitle>
          <Badge variant="secondary" className="gap-1">
            <DollarSign className="h-3 w-3" />
            Economia: {formatCurrency(totalPotentialSavings)}/mês
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {suggestions.map((suggestion) => {
          const sub = suggestion.subscription;
          return (
            <div
              key={sub.id}
              className="p-4 border rounded-lg bg-warning/5 border-warning/20"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="font-medium">{sub.product_name}</p>
                  <p className="text-xs text-muted-foreground">{sub.vendor}</p>
                </div>
                <Badge variant="outline" className="text-warning border-warning">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  Subutilizada
                </Badge>
              </div>

              <div className="space-y-2 mb-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    Utilização
                  </span>
                  <span>{sub.seats_used || 0} / {sub.seats_total} licenças ({suggestion.utilization.toFixed(0)}%)</span>
                </div>
                <Progress value={suggestion.utilization} className="h-2" />
              </div>

              <div className="bg-background/50 rounded-lg p-3 mb-3">
                <p className="text-xs font-medium text-muted-foreground mb-2">💡 Sugestão:</p>
                <div className="flex items-center gap-2 text-sm">
                  <Badge variant="outline">{sub.seats_total} licenças</Badge>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  <Badge variant="default" className="bg-success">
                    {suggestion.suggestedSeats} licenças
                  </Badge>
                </div>
                <p className="text-xs text-success mt-2 font-medium">
                  Economia estimada: {formatCurrency(suggestion.potentialSavings)}/mês
                </p>
              </div>

              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  onClick={() => handleAcknowledge(sub.id)}
                >
                  Revisar Contrato
                </Button>
              </div>
            </div>
          );
        })}

        <div className="pt-2 border-t">
          <p className="text-xs text-muted-foreground text-center">
            As estimativas são baseadas no uso atual + 20% de margem de segurança.
            Confirme com seus fornecedores antes de alterar planos.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
