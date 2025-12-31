import { useState, useMemo } from "react";
import { format, startOfMonth, endOfMonth, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  FileText, 
  Download, 
  Calendar, 
  ChevronLeft, 
  ChevronRight, 
  Printer,
  Building2,
  AlertTriangle,
  CheckCircle2,
  Clock
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useTransactions } from "@/hooks/useFinancial";
import { useTaxSettings, useLocalTaxCalculation } from "@/hooks/useTaxSettings";
import { generatePDFReport, downloadPDF, type ReportData } from "@/lib/pdfGenerator";
import { toast } from "sonner";

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
};

interface TaxGuide {
  id: string;
  name: string;
  description: string;
  dueDay: number;
  value: number;
  status: "pending" | "due_soon" | "overdue" | "paid";
  code?: string;
}

const regimeLabels: Record<string, string> = {
  simples_nacional: "Simples Nacional",
  lucro_presumido: "Lucro Presumido",
  lucro_real: "Lucro Real",
};

export function TaxGuidesPanel() {
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const { data: taxSettings, isLoading: settingsLoading } = useTaxSettings();
  const { calculateTaxes } = useLocalTaxCalculation();

  const periodStart = startOfMonth(selectedMonth);
  const periodEnd = endOfMonth(selectedMonth);

  const { data: transactions = [], isLoading: transactionsLoading } = useTransactions({
    startDate: periodStart.toISOString().split("T")[0],
    endDate: periodEnd.toISOString().split("T")[0],
  });

  const isLoading = settingsLoading || transactionsLoading;

  const navigateMonth = (direction: number) => {
    setSelectedMonth(prev => {
      const newDate = new Date(prev);
      newDate.setMonth(newDate.getMonth() + direction);
      return newDate;
    });
  };

  // Calculate revenue for the period
  const revenue = useMemo(() => {
    return transactions
      .filter(t => t.type === "income" && t.status === "paid")
      .reduce((acc, t) => acc + Number(t.amount), 0);
  }, [transactions]);

  // Calculate taxes
  const taxes = useMemo(() => calculateTaxes(revenue), [revenue, calculateTaxes]);

  // Generate tax guides based on regime
  const guides = useMemo((): TaxGuide[] => {
    const today = new Date();
    const nextMonth = new Date(selectedMonth);
    nextMonth.setMonth(nextMonth.getMonth() + 1);

    const getStatus = (dueDay: number): TaxGuide["status"] => {
      const dueDate = new Date(nextMonth.getFullYear(), nextMonth.getMonth(), dueDay);
      const daysUntilDue = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysUntilDue < 0) return "overdue";
      if (daysUntilDue <= 5) return "due_soon";
      return "pending";
    };

    const regime = taxes.regime || 'simples_nacional';

    if (regime === 'simples_nacional') {
      return [
        {
          id: "das",
          name: "DAS - Documento de Arrecadação do Simples",
          description: "Guia unificada de impostos federais e ISS",
          dueDay: 20,
          value: taxes.das,
          status: getStatus(20),
          code: "DAS",
        },
      ];
    }

    // Lucro Presumido ou Real
    const guides: TaxGuide[] = [];

    if (taxes.irpj > 0 || taxes.csll > 0) {
      guides.push({
        id: "darf-irpj-csll",
        name: "DARF - IRPJ/CSLL",
        description: "Imposto de Renda e Contribuição Social",
        dueDay: regime === 'lucro_presumido' ? 31 : 25,
        value: taxes.irpj + taxes.csll,
        status: getStatus(regime === 'lucro_presumido' ? 31 : 25),
        code: regime === 'lucro_presumido' ? "2089/2372" : "0220/6012",
      });
    }

    if (taxes.pis > 0) {
      guides.push({
        id: "darf-pis",
        name: "DARF - PIS",
        description: "Programa de Integração Social",
        dueDay: 25,
        value: taxes.pis,
        status: getStatus(25),
        code: regime === 'lucro_presumido' ? "8109" : "6912",
      });
    }

    if (taxes.cofins > 0) {
      guides.push({
        id: "darf-cofins",
        name: "DARF - COFINS",
        description: "Contribuição para Financiamento da Seguridade Social",
        dueDay: 25,
        value: taxes.cofins,
        status: getStatus(25),
        code: regime === 'lucro_presumido' ? "2172" : "5856",
      });
    }

    if (taxes.iss > 0) {
      guides.push({
        id: "iss",
        name: "Guia ISS Municipal",
        description: "Imposto Sobre Serviços",
        dueDay: 10,
        value: taxes.iss,
        status: getStatus(10),
      });
    }

    return guides;
  }, [taxes, selectedMonth]);

  const totalTaxes = guides.reduce((acc, g) => acc + g.value, 0);
  const overdueCount = guides.filter(g => g.status === "overdue").length;
  const dueSoonCount = guides.filter(g => g.status === "due_soon").length;

  const handleExportGuide = async (guide: TaxGuide) => {
    const nextMonth = new Date(selectedMonth);
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    const dueDate = new Date(nextMonth.getFullYear(), nextMonth.getMonth(), guide.dueDay);

    const reportData: ReportData = {
      title: guide.name,
      subtitle: `Competência: ${format(selectedMonth, "MMMM/yyyy", { locale: ptBR })}`,
      generatedAt: new Date(),
      sections: [
        {
          title: "Informações da Guia",
          type: "summary",
          summary: [
            { label: "Guia", value: guide.name },
            { label: "Código", value: guide.code || "-" },
            { label: "Competência", value: format(selectedMonth, "MM/yyyy") },
            { label: "Vencimento", value: format(dueDate, "dd/MM/yyyy") },
            { label: "Valor", value: formatCurrency(guide.value) },
          ],
        },
        {
          title: "Base de Cálculo",
          type: "summary",
          summary: [
            { label: "Receita Bruta", value: formatCurrency(revenue) },
            { label: "Regime Tributário", value: regimeLabels[taxes.regime] || taxes.regime },
            { label: "Alíquota Efetiva", value: `${taxes.effective_rate.toFixed(2)}%` },
          ],
        },
      ],
    };

    try {
      const doc = generatePDFReport(reportData);
      downloadPDF(doc, `${guide.id}_${format(selectedMonth, "yyyy-MM")}`);
      toast.success("Guia exportada com sucesso!");
    } catch (error) {
      toast.error("Erro ao exportar guia");
    }
  };

  const handleExportAll = async () => {
    const nextMonth = new Date(selectedMonth);
    nextMonth.setMonth(nextMonth.getMonth() + 1);

    const reportData: ReportData = {
      title: "Resumo de Guias Fiscais",
      subtitle: `Competência: ${format(selectedMonth, "MMMM/yyyy", { locale: ptBR })}`,
      generatedAt: new Date(),
      sections: [
        {
          title: "Resumo Geral",
          type: "summary",
          summary: [
            { label: "Regime Tributário", value: regimeLabels[taxes.regime] || taxes.regime },
            { label: "Receita Bruta", value: formatCurrency(revenue) },
            { label: "Total de Impostos", value: formatCurrency(totalTaxes) },
            { label: "Carga Tributária", value: `${taxes.effective_rate.toFixed(2)}%` },
          ],
        },
        {
          title: "Guias a Pagar",
          type: "table",
          data: {
            headers: ["Guia", "Código", "Vencimento", "Valor"],
            rows: guides.map(g => {
              const dueDate = new Date(nextMonth.getFullYear(), nextMonth.getMonth(), g.dueDay);
              return [
                g.name,
                g.code || "-",
                format(dueDate, "dd/MM/yyyy"),
                formatCurrency(g.value),
              ];
            }),
          },
        },
      ],
    };

    try {
      const doc = generatePDFReport(reportData);
      downloadPDF(doc, `guias_fiscais_${format(selectedMonth, "yyyy-MM")}`);
      toast.success("Relatório exportado com sucesso!");
    } catch (error) {
      toast.error("Erro ao exportar relatório");
    }
  };

  const getStatusBadge = (status: TaxGuide["status"]) => {
    switch (status) {
      case "overdue":
        return (
          <Badge variant="destructive" className="gap-1">
            <AlertTriangle className="w-3 h-3" />
            Vencida
          </Badge>
        );
      case "due_soon":
        return (
          <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-200 gap-1">
            <Clock className="w-3 h-3" />
            Vence em breve
          </Badge>
        );
      case "paid":
        return (
          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-200 gap-1">
            <CheckCircle2 className="w-3 h-3" />
            Paga
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary" className="gap-1">
            <Calendar className="w-3 h-3" />
            Pendente
          </Badge>
        );
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">Guias Fiscais</CardTitle>
                <CardDescription>
                  Geração e acompanhamento de guias de impostos
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={() => navigateMonth(-1)}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="min-w-[140px] text-center font-medium capitalize">
                {format(selectedMonth, "MMMM yyyy", { locale: ptBR })}
              </span>
              <Button variant="outline" size="icon" onClick={() => navigateMonth(1)}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Regime Tributário</div>
            <div className="text-lg font-semibold mt-1">
              {regimeLabels[taxes.regime] || "Simples Nacional"}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Receita do Mês</div>
            <div className="text-lg font-semibold mt-1 text-emerald-600">
              {formatCurrency(revenue)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Total de Impostos</div>
            <div className="text-lg font-semibold mt-1 text-amber-600">
              {formatCurrency(totalTaxes)}
            </div>
          </CardContent>
        </Card>
        <Card className={overdueCount > 0 ? "border-destructive" : ""}>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Alertas</div>
            <div className="flex items-center gap-2 mt-1">
              {overdueCount > 0 && (
                <Badge variant="destructive">{overdueCount} vencida(s)</Badge>
              )}
              {dueSoonCount > 0 && (
                <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-200">
                  {dueSoonCount} próxima(s)
                </Badge>
              )}
              {overdueCount === 0 && dueSoonCount === 0 && (
                <span className="text-emerald-600 font-medium">Tudo em dia</span>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tax Guides List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Guias do Período</CardTitle>
            <Button onClick={handleExportAll} size="sm" className="gap-2">
              <Download className="w-4 h-4" />
              Exportar Todas
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {guides.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Building2 className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Nenhuma guia para o período</p>
              <p className="text-sm">Configure o regime tributário ou registre receitas</p>
            </div>
          ) : (
            <div className="space-y-3">
              {guides.map((guide) => {
                const nextMonth = new Date(selectedMonth);
                nextMonth.setMonth(nextMonth.getMonth() + 1);
                const dueDate = new Date(nextMonth.getFullYear(), nextMonth.getMonth(), guide.dueDay);

                return (
                  <div
                    key={guide.id}
                    className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <span className="font-medium">{guide.name}</span>
                        {getStatusBadge(guide.status)}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span>{guide.description}</span>
                        {guide.code && (
                          <span className="font-mono bg-muted px-2 py-0.5 rounded text-xs">
                            Código: {guide.code}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="font-semibold">{formatCurrency(guide.value)}</div>
                        <div className="text-xs text-muted-foreground">
                          Venc: {format(dueDate, "dd/MM/yyyy")}
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleExportGuide(guide)}
                        className="gap-1"
                      >
                        <Printer className="w-4 h-4" />
                        PDF
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tax Breakdown */}
      {revenue > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Composição dos Impostos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {taxes.das > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>DAS (Simples Nacional)</span>
                    <span className="font-medium">{formatCurrency(taxes.das)}</span>
                  </div>
                  <Progress value={(taxes.das / totalTaxes) * 100} className="h-2" />
                </div>
              )}
              {taxes.irpj > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>IRPJ</span>
                    <span className="font-medium">{formatCurrency(taxes.irpj)}</span>
                  </div>
                  <Progress value={(taxes.irpj / totalTaxes) * 100} className="h-2" />
                </div>
              )}
              {taxes.csll > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>CSLL</span>
                    <span className="font-medium">{formatCurrency(taxes.csll)}</span>
                  </div>
                  <Progress value={(taxes.csll / totalTaxes) * 100} className="h-2" />
                </div>
              )}
              {taxes.pis > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>PIS</span>
                    <span className="font-medium">{formatCurrency(taxes.pis)}</span>
                  </div>
                  <Progress value={(taxes.pis / totalTaxes) * 100} className="h-2" />
                </div>
              )}
              {taxes.cofins > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>COFINS</span>
                    <span className="font-medium">{formatCurrency(taxes.cofins)}</span>
                  </div>
                  <Progress value={(taxes.cofins / totalTaxes) * 100} className="h-2" />
                </div>
              )}
              {taxes.iss > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>ISS</span>
                    <span className="font-medium">{formatCurrency(taxes.iss)}</span>
                  </div>
                  <Progress value={(taxes.iss / totalTaxes) * 100} className="h-2" />
                </div>
              )}
              <Separator />
              <div className="flex items-center justify-between font-medium">
                <span>Total</span>
                <span>{formatCurrency(totalTaxes)}</span>
              </div>
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>Carga Tributária Efetiva</span>
                <span>{taxes.effective_rate.toFixed(2)}%</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
