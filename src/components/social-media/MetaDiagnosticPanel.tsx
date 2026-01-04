import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Separator } from '@/components/ui/separator';
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ChevronDown,
  Loader2,
  Copy,
  ExternalLink,
  RefreshCw,
  Shield,
  Key,
  Users,
  FileText,
  Instagram,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface DiagnosticResult {
  code: string;
  message: string;
  details: string;
  action: string[];
  technical?: Record<string, unknown>;
}

interface DiagnosticSummary {
  token_valid: boolean;
  scopes: string[];
  scopes_missing: string[];
  pages_count: number;
  pages_with_publish: number;
  instagram_accounts: number;
  overall_status: 'ready' | 'needs_reauth' | 'needs_pages' | 'needs_setup' | 'error';
}

interface MetaDiagnosticPanelProps {
  workspaceId: string;
  platformConnectionId?: string;
  platform: 'facebook' | 'instagram';
  isSuperAdmin?: boolean;
  onReauth?: (strategy: 'pages_list' | 'pages_publish' | 'full') => void;
  onClose?: () => void;
}

export function MetaDiagnosticPanel({
  workspaceId,
  platformConnectionId,
  platform,
  isSuperAdmin,
  onReauth,
  onClose,
}: MetaDiagnosticPanelProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [diagnostics, setDiagnostics] = useState<DiagnosticResult[]>([]);
  const [summary, setSummary] = useState<DiagnosticSummary | null>(null);
  const [rawData, setRawData] = useState<Record<string, unknown> | null>(null);
  const [showRaw, setShowRaw] = useState(false);

  const runDiagnostics = async () => {
    setIsRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke('social-meta-diagnostics', {
        body: {
          workspace_id: workspaceId,
          platform_connection_id: platformConnectionId,
          platform,
        },
      });

      if (error) throw error;

      if (data.success) {
        setDiagnostics(data.diagnostics || []);
        setSummary(data.summary || null);
        setRawData(data.raw || null);
      } else {
        toast.error(data.error_message || 'Erro ao executar diagnóstico');
        if (data.diagnostics) {
          setDiagnostics(data.diagnostics);
        }
      }
    } catch (error: any) {
      console.error('Diagnostics error:', error);
      toast.error('Erro ao executar diagnóstico');
    } finally {
      setIsRunning(false);
    }
  };

  const copyDiagnosticReport = () => {
    const report = {
      timestamp: new Date().toISOString(),
      platform,
      summary,
      diagnostics: diagnostics.map(d => ({
        code: d.code,
        message: d.message,
        details: d.details,
      })),
      // Don't include tokens in report
      config: {
        workspace_id: workspaceId,
        platform_connection_id: platformConnectionId,
      },
    };

    navigator.clipboard.writeText(JSON.stringify(report, null, 2));
    toast.success('Relatório copiado para a área de transferência');
  };

  const getStatusBadge = (status: DiagnosticSummary['overall_status']) => {
    switch (status) {
      case 'ready':
        return <Badge className="bg-green-100 text-green-800">Pronto</Badge>;
      case 'needs_reauth':
        return <Badge className="bg-amber-100 text-amber-800">Precisa Reconectar</Badge>;
      case 'needs_pages':
        return <Badge className="bg-blue-100 text-blue-800">Configurar Páginas</Badge>;
      case 'needs_setup':
        return <Badge className="bg-purple-100 text-purple-800">Configuração Necessária</Badge>;
      case 'error':
        return <Badge variant="destructive">Erro</Badge>;
    }
  };

  const getDiagnosticIcon = (code: string) => {
    switch (code) {
      case 'OK':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'TOKEN_INVALID':
      case 'TOKEN_EXPIRED':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'MISSING_SCOPES':
      case 'APP_LEVEL_CONFIG_PROBLEM':
        return <AlertTriangle className="h-4 w-4 text-amber-500" />;
      default:
        return <AlertTriangle className="h-4 w-4 text-muted-foreground" />;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">Diagnóstico Meta</h3>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={runDiagnostics}
            disabled={isRunning}
          >
            {isRunning ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Executar Diagnóstico
          </Button>
        </div>
      </div>

      {summary && (
        <>
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
            <span className="text-sm font-medium">Status Geral:</span>
            {getStatusBadge(summary.overall_status)}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/30">
              <Key className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs">
                Token: {summary.token_valid ? (
                  <span className="text-green-600">Válido</span>
                ) : (
                  <span className="text-red-600">Inválido</span>
                )}
              </span>
            </div>
            <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/30">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs">
                Escopos: {summary.scopes.length} concedidos
              </span>
            </div>
            <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/30">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs">
                Páginas: {summary.pages_count} ({summary.pages_with_publish} com publicação)
              </span>
            </div>
            {platform === 'instagram' && (
              <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/30">
                <Instagram className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs">
                  Instagram: {summary.instagram_accounts} conta(s)
                </span>
              </div>
            )}
          </div>

          {summary.scopes_missing.length > 0 && (
            <Alert className="bg-amber-50 border-amber-200">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertTitle className="text-amber-800 text-sm">Escopos Faltando</AlertTitle>
              <AlertDescription className="text-amber-700 text-xs">
                {summary.scopes_missing.join(', ')}
              </AlertDescription>
            </Alert>
          )}
        </>
      )}

      {diagnostics.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Resultados do Diagnóstico</h4>
          {diagnostics.map((diag, idx) => (
            <Collapsible key={idx}>
              <CollapsibleTrigger asChild>
                <div className={cn(
                  "flex items-start gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors",
                  diag.code === 'OK' ? "border-green-200 bg-green-50/50" :
                  diag.code.includes('INVALID') || diag.code.includes('EXPIRED') ? "border-red-200 bg-red-50/50" :
                  "border-amber-200 bg-amber-50/50"
                )}>
                  {getDiagnosticIcon(diag.code)}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{diag.message}</span>
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{diag.details}</p>
                  </div>
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="ml-7 mt-2 p-3 bg-muted/30 rounded-lg space-y-2">
                  <p className="text-xs font-medium">Ações recomendadas:</p>
                  <ul className="text-xs text-muted-foreground space-y-1">
                    {diag.action.map((action, actionIdx) => (
                      <li key={actionIdx} className="flex items-start gap-2">
                        <span className="text-primary">•</span>
                        {action}
                      </li>
                    ))}
                  </ul>
                  {diag.technical && isSuperAdmin && (
                    <div className="mt-2 pt-2 border-t">
                      <p className="text-xs font-mono text-muted-foreground">
                        {JSON.stringify(diag.technical, null, 2)}
                      </p>
                    </div>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>
          ))}
        </div>
      )}

      {summary?.overall_status === 'needs_reauth' && onReauth && (
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onReauth('pages_list')}
          >
            Adicionar Permissão de Páginas
          </Button>
          <Button
            size="sm"
            onClick={() => onReauth('full')}
          >
            Reconectar com Todas as Permissões
          </Button>
        </div>
      )}

      <Separator />

      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          onClick={copyDiagnosticReport}
          disabled={diagnostics.length === 0}
        >
          <Copy className="h-4 w-4 mr-2" />
          Copiar Relatório
        </Button>

        {isSuperAdmin && rawData && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowRaw(!showRaw)}
          >
            {showRaw ? 'Ocultar Dados Técnicos' : 'Ver Dados Técnicos'}
          </Button>
        )}

        <Button
          variant="link"
          size="sm"
          asChild
        >
          <a
            href="https://developers.facebook.com/docs/facebook-login/guides/permissions"
            target="_blank"
            rel="noopener noreferrer"
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            Documentação Meta
          </a>
        </Button>
      </div>

      {showRaw && rawData && (
        <div className="p-3 bg-muted rounded-lg">
          <pre className="text-xs overflow-auto max-h-48">
            {JSON.stringify(rawData, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
