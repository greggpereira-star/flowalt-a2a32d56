import { AlertTriangle, Settings2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useTaxSettings } from "@/hooks/useTaxSettings";

interface TaxRegimeBannerProps {
  onConfigureClick?: () => void;
}

export function TaxRegimeBanner({ onConfigureClick }: TaxRegimeBannerProps) {
  const { data: taxSettings, isLoading } = useTaxSettings();

  // Don't show if loading or if settings are configured
  if (isLoading || taxSettings) return null;

  return (
    <Alert variant="default" className="border-amber-500/50 bg-amber-500/5">
      <AlertTriangle className="h-4 w-4 text-amber-500" />
      <AlertTitle className="text-amber-600">Regime Fiscal não configurado</AlertTitle>
      <AlertDescription className="flex items-center justify-between">
        <span className="text-muted-foreground">
          Configure o regime tributário para cálculos precisos de impostos (DRE, retenções, estimativas).
        </span>
        {onConfigureClick && (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={onConfigureClick}
            className="ml-4 shrink-0"
          >
            <Settings2 className="h-4 w-4 mr-2" />
            Configurar Agora
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}
