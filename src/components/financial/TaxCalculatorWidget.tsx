import { useState, useMemo } from "react";
import { Calculator, TrendingDown, TrendingUp, Info, FileText } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useLocalTaxCalculation, useTaxSettings } from "@/hooks/useTaxSettings";
import { CurrencyInput, formatCurrencyFromNumber, parseCurrencyToNumber } from "@/components/ui/currency-input";

const regimeLabels: Record<string, string> = {
  simples_nacional: "Simples Nacional",
  lucro_presumido: "Lucro Presumido",
  lucro_real: "Lucro Real",
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export function TaxCalculatorWidget() {
  const [grossRevenue, setGrossRevenue] = useState(0);
  const { data: settings } = useTaxSettings();
  const { calculateTaxes } = useLocalTaxCalculation();

  const taxes = useMemo(() => calculateTaxes(grossRevenue), [grossRevenue, calculateTaxes]);

  const taxBreakdown = useMemo(() => {
    const items = [];
    
    if (taxes.das > 0) {
      items.push({ label: "DAS (Simples)", value: taxes.das, color: "bg-green-500" });
    }
    if (taxes.irpj > 0) {
      items.push({ label: "IRPJ", value: taxes.irpj, color: "bg-blue-500" });
    }
    if (taxes.csll > 0) {
      items.push({ label: "CSLL", value: taxes.csll, color: "bg-purple-500" });
    }
    if (taxes.pis > 0) {
      items.push({ label: "PIS", value: taxes.pis, color: "bg-orange-500" });
    }
    if (taxes.cofins > 0) {
      items.push({ label: "COFINS", value: taxes.cofins, color: "bg-red-500" });
    }
    if (taxes.iss > 0) {
      items.push({ label: "ISS", value: taxes.iss, color: "bg-yellow-500" });
    }

    return items;
  }, [taxes]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Calculator className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Simulador de Impostos</CardTitle>
              <CardDescription>
                Calcule os impostos com base no regime atual
              </CardDescription>
            </div>
          </div>
          {settings && (
            <Badge variant="outline">
              {regimeLabels[settings.tax_regime]}
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Input de Faturamento */}
        <div className="space-y-2">
          <Label>Faturamento Bruto</Label>
          <CurrencyInput
            value={formatCurrencyFromNumber(grossRevenue)}
            onChange={(value) => setGrossRevenue(parseCurrencyToNumber(value))}
            placeholder="R$ 0,00"
            className="text-lg"
          />
        </div>

        {grossRevenue > 0 && (
          <>
            <Separator />

            {/* Resumo */}
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Impostos Totais</p>
                <p className="text-lg font-semibold text-destructive">
                  {formatCurrency(taxes.total_taxes)}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Valor Líquido</p>
                <p className="text-lg font-semibold text-green-600">
                  {formatCurrency(taxes.net_revenue)}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Carga Tributária</p>
                <p className="text-lg font-semibold">
                  {taxes.effective_rate.toFixed(2)}%
                </p>
              </div>
            </div>

            {/* Barra de Progresso */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Proporção Impostos/Faturamento</span>
                <span className="font-medium">{taxes.effective_rate.toFixed(1)}%</span>
              </div>
              <Progress value={taxes.effective_rate} className="h-2" />
            </div>

            {/* Breakdown dos Impostos */}
            {taxBreakdown.length > 0 && (
              <div className="space-y-3">
                <p className="text-sm font-medium">Detalhamento</p>
                <div className="space-y-2">
                  {taxBreakdown.map((item, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${item.color}`} />
                        <span className="text-sm">{item.label}</span>
                      </div>
                      <span className="text-sm font-medium">{formatCurrency(item.value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Guias a Pagar */}
            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm font-medium">Guias a Gerar</p>
              </div>
              <div className="space-y-2 text-sm">
                {taxes.regime === 'simples_nacional' ? (
                  <div className="flex items-center justify-between p-2 bg-background rounded">
                    <span>DAS - Documento de Arrecadação do Simples</span>
                    <span className="font-medium">{formatCurrency(taxes.das)}</span>
                  </div>
                ) : (
                  <>
                    {taxes.irpj + taxes.csll > 0 && (
                      <div className="flex items-center justify-between p-2 bg-background rounded">
                        <span>DARF - IRPJ/CSLL</span>
                        <span className="font-medium">{formatCurrency(taxes.irpj + taxes.csll)}</span>
                      </div>
                    )}
                    {taxes.pis + taxes.cofins > 0 && (
                      <div className="flex items-center justify-between p-2 bg-background rounded">
                        <span>DARF - PIS/COFINS</span>
                        <span className="font-medium">{formatCurrency(taxes.pis + taxes.cofins)}</span>
                      </div>
                    )}
                    {taxes.iss > 0 && (
                      <div className="flex items-center justify-between p-2 bg-background rounded">
                        <span>Guia ISS Municipal</span>
                        <span className="font-medium">{formatCurrency(taxes.iss)}</span>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Comparativo */}
            <TooltipProvider>
              <div className="bg-muted/30 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <TrendingDown className="h-4 w-4 text-muted-foreground" />
                  <p className="text-sm font-medium">Comparativo Simplificado</p>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="h-3 w-3 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Valores aproximados para comparação. Consulte seu contador.</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className={`p-2 rounded text-center ${taxes.regime === 'simples_nacional' ? 'bg-primary/10 border border-primary/20' : 'bg-background'}`}>
                    <p className="text-muted-foreground">Simples</p>
                    <p className="font-medium">{formatCurrency(grossRevenue * 0.06)}</p>
                    <p className="text-muted-foreground">~6%</p>
                  </div>
                  <div className={`p-2 rounded text-center ${taxes.regime === 'lucro_presumido' ? 'bg-primary/10 border border-primary/20' : 'bg-background'}`}>
                    <p className="text-muted-foreground">Presumido</p>
                    <p className="font-medium">{formatCurrency(grossRevenue * 0.1365)}</p>
                    <p className="text-muted-foreground">~13.65%</p>
                  </div>
                  <div className={`p-2 rounded text-center ${taxes.regime === 'lucro_real' ? 'bg-primary/10 border border-primary/20' : 'bg-background'}`}>
                    <p className="text-muted-foreground">Real</p>
                    <p className="font-medium">{formatCurrency(grossRevenue * 0.34)}</p>
                    <p className="text-muted-foreground">~34%</p>
                  </div>
                </div>
              </div>
            </TooltipProvider>
          </>
        )}
      </CardContent>
    </Card>
  );
}
