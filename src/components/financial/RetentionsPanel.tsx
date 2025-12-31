import { useState, useMemo } from "react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  Receipt, 
  ChevronLeft, 
  ChevronRight, 
  Download,
  Filter,
  ArrowDownRight,
  ArrowUpRight,
  FileText,
  Building2
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { useTransactions } from "@/hooks/useFinancial";
import { useInvoices } from "@/hooks/useInvoices";
import { useTaxSettings, useLocalTaxCalculation } from "@/hooks/useTaxSettings";
import { generatePDFReport, downloadPDF, type ReportData } from "@/lib/pdfGenerator";
import { toast } from "sonner";

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
};

interface RetentionSummary {
  irrf: number;
  pis: number;
  cofins: number;
  csll: number;
  inss: number;
  iss: number;
  total: number;
}

export function RetentionsPanel() {
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [viewType, setViewType] = useState<"suffered" | "made">("suffered");
  const { data: taxSettings, isLoading: settingsLoading } = useTaxSettings();
  const { calculateRetentions } = useLocalTaxCalculation();

  const periodStart = startOfMonth(selectedMonth);
  const periodEnd = endOfMonth(selectedMonth);

  const { data: transactions = [], isLoading: transactionsLoading } = useTransactions({
    startDate: periodStart.toISOString().split("T")[0],
    endDate: periodEnd.toISOString().split("T")[0],
  });

  const { data: invoices = [], isLoading: invoicesLoading } = useInvoices({
    startDate: periodStart.toISOString().split("T")[0],
    endDate: periodEnd.toISOString().split("T")[0],
  });

  const isLoading = settingsLoading || transactionsLoading || invoicesLoading;

  const navigateMonth = (direction: number) => {
    setSelectedMonth(prev => {
      const newDate = new Date(prev);
      newDate.setMonth(newDate.getMonth() + direction);
      return newDate;
    });
  };

  // Calculate retentions suffered (on income - services provided)
  const retentionsSuffered = useMemo(() => {
    const incomeTransactions = transactions.filter(t => t.type === "income" && t.status === "paid");
    
    // Simulate retentions based on settings
    const summary: RetentionSummary = {
      irrf: 0,
      pis: 0,
      cofins: 0,
      csll: 0,
      inss: 0,
      iss: 0,
      total: 0,
    };

    // For invoices with retention info (using any to handle dynamic fields)
    invoices.forEach((inv: any) => {
      if (inv.irrf_retido) summary.irrf += Number(inv.irrf_retido);
      if (inv.pis_retido) summary.pis += Number(inv.pis_retido);
      if (inv.cofins_retido) summary.cofins += Number(inv.cofins_retido);
      if (inv.csll_retido) summary.csll += Number(inv.csll_retido);
      if (inv.inss_retido) summary.inss += Number(inv.inss_retido);
      if (inv.iss_valor && taxSettings?.iss_retido_na_fonte) {
        summary.iss += Number(inv.iss_valor);
      }
    });

    summary.total = summary.irrf + summary.pis + summary.cofins + summary.csll + summary.inss + summary.iss;
    
    return { summary, items: [] };
  }, [invoices, taxSettings]);

  // Calculate retentions made (on expenses - services taken)
  const retentionsMade = useMemo(() => {
    const expenseTransactions = transactions.filter(t => t.type === "expense" && t.status === "paid");
    
    const summary: RetentionSummary = {
      irrf: 0,
      pis: 0,
      cofins: 0,
      csll: 0,
      inss: 0,
      iss: 0,
      total: 0,
    };

    // Transactions with retention fields (using any to handle dynamic fields)
    expenseTransactions.forEach((t: any) => {
      if (t.tax_retention_irrf) summary.irrf += Number(t.tax_retention_irrf);
      if (t.tax_retention_pis) summary.pis += Number(t.tax_retention_pis);
      if (t.tax_retention_cofins) summary.cofins += Number(t.tax_retention_cofins);
      if (t.tax_retention_csll) summary.csll += Number(t.tax_retention_csll);
      if (t.tax_retention_inss) summary.inss += Number(t.tax_retention_inss);
      if (t.tax_retention_iss) summary.iss += Number(t.tax_retention_iss);
    });

    summary.total = summary.irrf + summary.pis + summary.cofins + summary.csll + summary.inss + summary.iss;
    
    return { summary, items: [] };
  }, [transactions]);

  const currentRetentions = viewType === "suffered" ? retentionsSuffered : retentionsMade;

  const handleExportReport = async () => {
    const reportData: ReportData = {
      title: viewType === "suffered" ? "Retenções Sofridas" : "Retenções Efetuadas",
      subtitle: `Competência: ${format(selectedMonth, "MMMM/yyyy", { locale: ptBR })}`,
      generatedAt: new Date(),
      sections: [
        {
          title: "Resumo das Retenções",
          type: "summary",
          summary: [
            { label: "IRRF", value: formatCurrency(currentRetentions.summary.irrf) },
            { label: "PIS", value: formatCurrency(currentRetentions.summary.pis) },
            { label: "COFINS", value: formatCurrency(currentRetentions.summary.cofins) },
            { label: "CSLL", value: formatCurrency(currentRetentions.summary.csll) },
            { label: "INSS", value: formatCurrency(currentRetentions.summary.inss) },
            { label: "ISS", value: formatCurrency(currentRetentions.summary.iss) },
            { label: "Total", value: formatCurrency(currentRetentions.summary.total) },
          ],
        },
      ],
    };

    try {
      const doc = generatePDFReport(reportData);
      downloadPDF(doc, `retencoes_${viewType}_${format(selectedMonth, "yyyy-MM")}`);
      toast.success("Relatório exportado com sucesso!");
    } catch (error) {
      toast.error("Erro ao exportar relatório");
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
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
                <Receipt className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">Retenções na Fonte</CardTitle>
                <CardDescription>
                  Controle de impostos retidos em notas fiscais
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

      {/* View Type Tabs */}
      <Tabs value={viewType} onValueChange={(v) => setViewType(v as "suffered" | "made")}>
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="suffered" className="gap-2">
              <ArrowDownRight className="w-4 h-4" />
              Retenções Sofridas
            </TabsTrigger>
            <TabsTrigger value="made" className="gap-2">
              <ArrowUpRight className="w-4 h-4" />
              Retenções Efetuadas
            </TabsTrigger>
          </TabsList>
          <Button onClick={handleExportReport} size="sm" className="gap-2">
            <Download className="w-4 h-4" />
            Exportar PDF
          </Button>
        </div>

        <TabsContent value="suffered" className="mt-4">
          <RetentionContent 
            summary={retentionsSuffered.summary} 
            description="Impostos retidos pelos seus clientes ao pagar suas notas fiscais"
          />
        </TabsContent>

        <TabsContent value="made" className="mt-4">
          <RetentionContent 
            summary={retentionsMade.summary} 
            description="Impostos que você reteve ao pagar notas fiscais de fornecedores"
          />
        </TabsContent>
      </Tabs>

      {/* Aliquotas Configured */}
      {taxSettings && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Alíquotas Configuradas</CardTitle>
            <CardDescription>
              Percentuais aplicados para cálculo de retenções
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
              <div className="text-center p-3 bg-muted/50 rounded-lg">
                <div className="text-xs text-muted-foreground">IRRF</div>
                <div className="font-semibold">{taxSettings.retencao_irrf_aliquota}%</div>
              </div>
              <div className="text-center p-3 bg-muted/50 rounded-lg">
                <div className="text-xs text-muted-foreground">PIS</div>
                <div className="font-semibold">{taxSettings.retencao_pis_aliquota}%</div>
              </div>
              <div className="text-center p-3 bg-muted/50 rounded-lg">
                <div className="text-xs text-muted-foreground">COFINS</div>
                <div className="font-semibold">{taxSettings.retencao_cofins_aliquota}%</div>
              </div>
              <div className="text-center p-3 bg-muted/50 rounded-lg">
                <div className="text-xs text-muted-foreground">CSLL</div>
                <div className="font-semibold">{taxSettings.retencao_csll_aliquota}%</div>
              </div>
              <div className="text-center p-3 bg-muted/50 rounded-lg">
                <div className="text-xs text-muted-foreground">INSS</div>
                <div className="font-semibold">{taxSettings.retencao_inss_aliquota}%</div>
              </div>
              <div className="text-center p-3 bg-muted/50 rounded-lg">
                <div className="text-xs text-muted-foreground">ISS</div>
                <div className="font-semibold">{taxSettings.iss_aliquota}%</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

interface RetentionContentProps {
  summary: RetentionSummary;
  description: string;
}

function RetentionContent({ summary, description }: RetentionContentProps) {
  const hasRetentions = summary.total > 0;

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">IRRF (1,5%)</div>
            <div className="text-xl font-semibold mt-1">{formatCurrency(summary.irrf)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">PIS/COFINS/CSLL (4,65%)</div>
            <div className="text-xl font-semibold mt-1">
              {formatCurrency(summary.pis + summary.cofins + summary.csll)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">INSS (11%)</div>
            <div className="text-xl font-semibold mt-1">{formatCurrency(summary.inss)}</div>
          </CardContent>
        </Card>
        <Card className="border-primary">
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Total Retido</div>
            <div className="text-xl font-semibold mt-1 text-primary">
              {formatCurrency(summary.total)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Description */}
      <div className="bg-muted/50 p-4 rounded-lg">
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>

      {/* Detailed Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Detalhamento por Imposto</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Imposto</TableHead>
                <TableHead>Código DARF</TableHead>
                <TableHead className="text-right">Base de Cálculo</TableHead>
                <TableHead className="text-right">Alíquota</TableHead>
                <TableHead className="text-right">Valor Retido</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="font-medium">IRRF</TableCell>
                <TableCell><Badge variant="outline">0588</Badge></TableCell>
                <TableCell className="text-right">-</TableCell>
                <TableCell className="text-right">1,50%</TableCell>
                <TableCell className="text-right font-medium">{formatCurrency(summary.irrf)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">PIS</TableCell>
                <TableCell><Badge variant="outline">5979</Badge></TableCell>
                <TableCell className="text-right">-</TableCell>
                <TableCell className="text-right">0,65%</TableCell>
                <TableCell className="text-right font-medium">{formatCurrency(summary.pis)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">COFINS</TableCell>
                <TableCell><Badge variant="outline">5960</Badge></TableCell>
                <TableCell className="text-right">-</TableCell>
                <TableCell className="text-right">3,00%</TableCell>
                <TableCell className="text-right font-medium">{formatCurrency(summary.cofins)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">CSLL</TableCell>
                <TableCell><Badge variant="outline">5987</Badge></TableCell>
                <TableCell className="text-right">-</TableCell>
                <TableCell className="text-right">1,00%</TableCell>
                <TableCell className="text-right font-medium">{formatCurrency(summary.csll)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">INSS</TableCell>
                <TableCell><Badge variant="outline">GPS</Badge></TableCell>
                <TableCell className="text-right">-</TableCell>
                <TableCell className="text-right">11,00%</TableCell>
                <TableCell className="text-right font-medium">{formatCurrency(summary.inss)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">ISS</TableCell>
                <TableCell><Badge variant="outline">Municipal</Badge></TableCell>
                <TableCell className="text-right">-</TableCell>
                <TableCell className="text-right">2-5%</TableCell>
                <TableCell className="text-right font-medium">{formatCurrency(summary.iss)}</TableCell>
              </TableRow>
              <TableRow className="bg-muted/50 font-bold">
                <TableCell colSpan={4}>TOTAL</TableCell>
                <TableCell className="text-right">{formatCurrency(summary.total)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {!hasRetentions && (
        <div className="text-center py-8">
          <Building2 className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-50" />
          <p className="text-muted-foreground">Nenhuma retenção registrada no período</p>
          <p className="text-sm text-muted-foreground">
            As retenções são registradas automaticamente ao importar notas fiscais
          </p>
        </div>
      )}
    </div>
  );
}
