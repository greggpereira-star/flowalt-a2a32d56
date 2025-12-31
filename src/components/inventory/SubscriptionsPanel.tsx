import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { CreditCard, Plus, RefreshCw, XCircle, AlertTriangle } from "lucide-react";
import { useSubscriptions, useExpiringSubscriptions, useUnderutilizedSubscriptions, useSubscriptionCostSummary, useRenewSubscription, useCancelSubscription } from "@/hooks/useSubscriptions";
import { SubscriptionForm } from "./SubscriptionForm";
import { LicenseDowngradeSuggestions } from "./LicenseDowngradeSuggestions";
import { format, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreHorizontal } from "lucide-react";

export function SubscriptionsPanel() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  
  const { data: subscriptions = [], isLoading } = useSubscriptions();
  const { data: expiring = [] } = useExpiringSubscriptions(30);
  const { data: underutilized = [] } = useUnderutilizedSubscriptions();
  const { data: costSummary } = useSubscriptionCostSummary();
  const renewSubscription = useRenewSubscription();
  const cancelSubscription = useCancelSubscription();

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { label: string; className: string }> = {
      active: { label: "Ativo", className: "bg-green-500/10 text-green-600 border-green-500/20" },
      expiring: { label: "Renovando", className: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20" },
      expired: { label: "Expirado", className: "bg-red-500/10 text-red-600 border-red-500/20" },
      cancelled: { label: "Cancelado", className: "bg-gray-500/10 text-gray-600 border-gray-500/20" },
    };
    const config = variants[status] || { label: status, className: "" };
    return <Badge variant="outline" className={config.className}>{config.label}</Badge>;
  };

  const getBillingLabel = (cycle: string) => {
    const labels: Record<string, string> = {
      monthly: "Mensal",
      yearly: "Anual",
      custom: "Personalizado",
    };
    return labels[cycle] || cycle;
  };

  const handleRenew = async (id: string, renewalDate: string) => {
    const nextDate = new Date(renewalDate);
    nextDate.setMonth(nextDate.getMonth() + 1);
    await renewSubscription.mutateAsync({ id, newRenewalDate: format(nextDate, 'yyyy-MM-dd') });
  };

  const handleCancel = async (id: string) => {
    await cancelSubscription.mutateAsync(id);
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Licenças Ativas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{subscriptions.filter(s => s.status === 'active').length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Custo Mensal</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(costSummary?.monthly || 0)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Custo Anual</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(costSummary?.yearly || 0)}</div>
          </CardContent>
        </Card>

        <Card className={underutilized.length > 0 ? "border-warning/50" : ""}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              {underutilized.length > 0 && <AlertTriangle className="h-4 w-4 text-warning" />}
              Subutilizadas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning">{underutilized.length}</div>
            <p className="text-xs text-muted-foreground">considere downgrade</p>
          </CardContent>
        </Card>
      </div>

      {/* Expiring Alert */}
      {expiring.length > 0 && (
        <Card className="border-warning/50 bg-warning/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-warning" />
              Renovações Próximas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {expiring.map((sub) => (
                <Badge key={sub.id} variant="outline">
                  {sub.product_name} - {differenceInDays(new Date(sub.renewal_date), new Date())} dias
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Subscriptions Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Licenças e Assinaturas
          </CardTitle>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Nova Licença
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Nova Licença / Assinatura</DialogTitle>
              </DialogHeader>
              <SubscriptionForm onSuccess={() => setIsCreateOpen(false)} />
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Carregando...</div>
          ) : subscriptions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhuma licença cadastrada
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produto</TableHead>
                  <TableHead>Fornecedor</TableHead>
                  <TableHead>Ciclo</TableHead>
                  <TableHead className="text-right">Custo</TableHead>
                  <TableHead>Seats</TableHead>
                  <TableHead>Renovação</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {subscriptions.map((sub) => {
                  const seatsUsage = sub.seats_total ? (sub.seats_used / sub.seats_total) * 100 : 0;
                  const isUnderutilized = sub.seats_total && seatsUsage < 50;
                  
                  return (
                    <TableRow key={sub.id}>
                      <TableCell className="font-medium">{sub.product_name}</TableCell>
                      <TableCell className="text-muted-foreground">{sub.vendor}</TableCell>
                      <TableCell>{getBillingLabel(sub.billing_cycle)}</TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(sub.cost_per_cycle)}
                      </TableCell>
                      <TableCell>
                        {sub.seats_total ? (
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <Progress 
                                value={seatsUsage} 
                                className={`h-2 w-16 ${isUnderutilized ? 'bg-warning/20' : ''}`}
                              />
                              <span className={`text-xs ${isUnderutilized ? 'text-warning' : 'text-muted-foreground'}`}>
                                {sub.seats_used}/{sub.seats_total}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {format(new Date(sub.renewal_date), "dd/MM/yyyy", { locale: ptBR })}
                      </TableCell>
                      <TableCell>{getStatusBadge(sub.status)}</TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleRenew(sub.id, sub.renewal_date)}>
                              <RefreshCw className="h-4 w-4 mr-2" />
                              Renovar
                            </DropdownMenuItem>
                            {sub.status !== 'cancelled' && (
                              <DropdownMenuItem 
                                onClick={() => handleCancel(sub.id)}
                                className="text-destructive"
                              >
                                <XCircle className="h-4 w-4 mr-2" />
                                Cancelar
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Downgrade Suggestions */}
      <LicenseDowngradeSuggestions />
    </div>
  );
}
