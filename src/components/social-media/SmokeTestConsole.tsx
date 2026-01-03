import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { 
  Play, 
  CheckCircle2, 
  XCircle, 
  Loader2, 
  AlertTriangle,
  RefreshCw,
  Clock,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useSocialPlatforms } from '@/hooks/useSocialPlatforms';
import { toast } from 'sonner';

interface SmokeTestStep {
  name: string;
  ok: boolean;
  detail: string;
  duration_ms?: number;
}

interface SmokeTestResult {
  ok: boolean;
  job_id: string;
  steps: SmokeTestStep[];
  next_action?: string;
  error_code?: string;
  error_message?: string;
}

export function SmokeTestConsole() {
  const { currentWorkspace, currentRole } = useWorkspace();
  const { data: platforms } = useSocialPlatforms();
  
  const [selectedPlatformId, setSelectedPlatformId] = useState<string>('');
  const [dryRun, setDryRun] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<SmokeTestResult | null>(null);

  // Only show for owner/admin
  if (!['owner', 'admin'].includes(currentRole || '')) {
    return null;
  }

  // Show all platforms, not just connected ones (to allow testing and diagnosis)
  const availablePlatforms = platforms?.filter(p => p.is_active || p.connection_status !== 'disconnected') || [];

  const handleRunSmokeTest = async () => {
    if (!currentWorkspace?.id || !selectedPlatformId) {
      toast.error('Selecione uma plataforma');
      return;
    }

    const platform = availablePlatforms.find(p => p.id === selectedPlatformId);
    if (!platform) return;

    setIsRunning(true);
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('social-smoke-test', {
        body: {
          workspace_id: currentWorkspace.id,
          platform_id: platform.platform,
          platform_connection_id: selectedPlatformId,
          dry_run: dryRun,
        },
      });

      if (error) throw error;

      setResult(data);

      if (data.ok) {
        toast.success('Smoke Test passou!');
      } else {
        toast.error(data.error_message || 'Smoke Test falhou');
      }
    } catch (error: any) {
      console.error('Smoke test error:', error);
      toast.error(error.message || 'Erro ao executar teste');
    } finally {
      setIsRunning(false);
    }
  };

  const getStepIcon = (step: SmokeTestStep) => {
    if (step.ok) {
      return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    }
    return <XCircle className="h-4 w-4 text-red-500" />;
  };

  const getNextActionMessage = (action?: string) => {
    switch (action) {
      case 'select_asset':
        return 'Selecione um ativo (Página/Canal/Conta) na configuração da plataforma.';
      case 'configure_secrets':
        return 'Configure as credenciais da plataforma no painel de administração.';
      case 'refresh_token':
        return 'O token expirou. Clique em "Renovar" na lista de plataformas.';
      case 'reconnect':
        return 'Reconecte a plataforma para obter novos tokens.';
      default:
        return null;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Play className="h-5 w-5" />
          Smoke Test
        </CardTitle>
        <CardDescription>
          Valide a conexão end-to-end com as plataformas sociais
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Configuration */}
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Plataforma</Label>
            <Select value={selectedPlatformId} onValueChange={setSelectedPlatformId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma plataforma conectada" />
              </SelectTrigger>
              <SelectContent>
                {availablePlatforms.map(platform => (
                  <SelectItem key={platform.id} value={platform.id}>
                    {platform.account_name || platform.platform} 
                    <span className="text-muted-foreground ml-2">({platform.platform})</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Modo Dry Run</Label>
              <p className="text-xs text-muted-foreground">
                Apenas valida conexão, não publica
              </p>
            </div>
            <Switch checked={dryRun} onCheckedChange={setDryRun} />
          </div>

          <Button 
            onClick={handleRunSmokeTest}
            disabled={isRunning || !selectedPlatformId}
            className="w-full"
          >
            {isRunning ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Executando...
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Executar Smoke Test
              </>
            )}
          </Button>
        </div>

        {/* Results */}
        {result && (
          <>
            <Separator />
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-medium">Resultado</h4>
                <Badge variant={result.ok ? 'default' : 'destructive'}>
                  {result.ok ? 'PASSOU' : 'FALHOU'}
                </Badge>
              </div>

              {/* Steps */}
              <div className="space-y-2">
                {result.steps.map((step, idx) => (
                  <div 
                    key={idx}
                    className={cn(
                      "flex items-start gap-3 p-3 rounded-lg border",
                      step.ok ? "bg-green-50/50 border-green-200" : "bg-red-50/50 border-red-200"
                    )}
                  >
                    {getStepIcon(step)}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm capitalize">
                        {step.name.replace(/_/g, ' ')}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {step.detail}
                      </p>
                    </div>
                    {step.duration_ms && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {step.duration_ms}ms
                      </span>
                    )}
                  </div>
                ))}
              </div>

              {/* Next Action */}
              {result.next_action && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Ação necessária:</strong> {getNextActionMessage(result.next_action)}
                  </AlertDescription>
                </Alert>
              )}

              {/* Job ID */}
              <p className="text-xs text-muted-foreground text-center">
                Job ID: {result.job_id}
              </p>
            </div>
          </>
        )}

        {availablePlatforms.length === 0 && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Nenhuma plataforma cadastrada. Conecte uma plataforma primeiro.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
