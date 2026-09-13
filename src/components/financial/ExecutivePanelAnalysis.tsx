import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Sparkles, Compass, Scissors, AlertTriangle, Target } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AnalysisType, FinancialAnalysisResult } from "@/hooks/useFinancialAnalysis";

const BUTTONS: { type: AnalysisType; label: string; icon: React.ElementType }[] = [
  { type: "panorama", label: "Panorama", icon: Compass },
  { type: "onde_cortar", label: "Onde cortar", icon: Scissors },
  { type: "riscos_caixa", label: "Riscos do caixa", icon: AlertTriangle },
  { type: "bater_meta", label: "Bater a meta", icon: Target },
];

interface ExecutivePanelAnalysisProps {
  result: FinancialAnalysisResult | null;
  pendingType: AnalysisType | null;
  onRequest: (type: AnalysisType) => void;
}

export function ExecutivePanelAnalysis({ result, pendingType, onRequest }: ExecutivePanelAnalysisProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-base font-semibold">Análise por IA</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {BUTTONS.map(({ type, label, icon: Icon }) => (
            <Button
              key={type}
              variant={result?.analysis_type === type ? "secondary" : "outline"}
              size="sm"
              className="gap-1.5"
              disabled={pendingType !== null}
              onClick={() => onRequest(type)}
            >
              {pendingType === type ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Icon className="h-3.5 w-3.5" />}
              {label}
            </Button>
          ))}
        </div>

        {!result && pendingType === null && (
          <p className="text-sm text-muted-foreground py-4 text-center">
            Escolha um tipo de análise acima para gerar um resumo com IA a partir dos dados deste painel.
          </p>
        )}

        {result && (
          <div className="space-y-3">
            <div className={cn("rounded-lg bg-muted/30 p-4 text-sm leading-relaxed whitespace-pre-wrap")}>
              {result.analysis}
            </div>
            <p className="text-xs text-muted-foreground">
              {result.analysis_label} · gerado em {new Date(result.generated_at).toLocaleString("pt-BR")} · filtros: {result.filters_summary}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
