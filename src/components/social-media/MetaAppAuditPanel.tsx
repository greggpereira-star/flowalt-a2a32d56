import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  Settings,
  Lock,
  Globe,
  Info,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface AuditResult {
  code: string;
  severity: 'error' | 'warning' | 'info';
  category: 'credentials' | 'products' | 'roles' | 'scopes' | 'redirect_uri' | 'app_review';
  message: string;
  details: string;
  action: string[];
  technical?: Record<string, unknown>;
}

interface AuditSummary {
  errors: number;
  warnings: number;
  passed: number;
  overall_status: 'ready' | 'needs_configuration' | 'needs_app_review' | 'has_errors';
  can_oauth: boolean;
  can_publish: boolean;
}

interface ScopeValidation {
  valid: string[];
  invalid: string[];
  require_app_review: string[];
  require_products: Record<string, string[]>;
}

interface AppInfo {
  id: string;
  name?: string;
  category?: string;
  company?: string;
  contact_email?: string;
}

interface MetaAppAuditPanelProps {
  workspaceId: string;
  platformConnectionId?: string;
  redirectUri?: string;
  onClose?: () => void;
}

export function MetaAppAuditPanel({
  workspaceId,
  platformConnectionId,
  redirectUri,
  onClose,
}: MetaAppAuditPanelProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [auditResults, setAuditResults] = useState<AuditResult[]>([]);
  const [summary, setSummary] = useState<AuditSummary | null>(null);
  const [scopeValidation, setScopeValidation] = useState<ScopeValidation | null>(null);
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null);
  const [graphVersion, setGraphVersion] = useState<string>('');
  const [scopeStrategy, setScopeStrategy] = useState<'minimum' | 'full' | 'instagram_publish'>('full');

  const runAudit = async () => {
    setIsRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke('social-meta-app-audit', {
        body: {
          workspace_id: workspaceId,
          platform_connection_id: platformConnectionId,
          scope_strategy: scopeStrategy,
          redirect_uri: redirectUri,
        },
      });

      if (error) throw error;

      if (data.success) {
        setAuditResults(data.audit_results || []);
        setSummary(data.summary || null);
        setScopeValidation(data.scope_validation || null);
        setAppInfo(data.app_info || null);
        setGraphVersion(data.graph_version || '');
        toast.success('Auditoria concluída');
      } else {
        toast.error(data.error_message || 'Erro ao executar auditoria');
      }
    } catch (error: unknown) {
      console.error('Audit error:', error);
      toast.error('Erro ao executar auditoria do App');
    } finally {
      setIsRunning(false);
    }
  };

  const copyAuditReport = () => {
    const report = {
      timestamp: new Date().toISOString(),
      graph_version: graphVersion,
      scope_strategy: scopeStrategy,
      app_info: appInfo,
      summary,
      scope_validation: scopeValidation,
      audit_results: auditResults.map(r => ({
        code: r.code,
        severity: r.severity,
        category: r.category,
        message: r.message,
        details: r.details,
      })),
    };

    navigator.clipboard.writeText(JSON.stringify(report, null, 2));
    toast.success('Relatório copiado para a área de transferência');
  };

  const getStatusBadge = (status: AuditSummary['overall_status']) => {
    switch (status) {
      case 'ready':
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">Pronto</Badge>;
      case 'needs_configuration':
        return <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">Configuração Necessária</Badge>;
      case 'needs_app_review':
        return <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400">App Review Necessário</Badge>;
      case 'has_errors':
        return <Badge variant="destructive">Erros Encontrados</Badge>;
    }
  };

  const getSeverityIcon = (severity: AuditResult['severity']) => {
    switch (severity) {
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-amber-500" />;
      case 'info':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    }
  };

  const getCategoryIcon = (category: AuditResult['category']) => {
    switch (category) {
      case 'credentials':
        return <Key className="h-4 w-4" />;
      case 'products':
        return <Settings className="h-4 w-4" />;
      case 'roles':
        return <Users className="h-4 w-4" />;
      case 'scopes':
        return <Lock className="h-4 w-4" />;
      case 'redirect_uri':
        return <Globe className="h-4 w-4" />;
      case 'app_review':
        return <FileText className="h-4 w-4" />;
    }
  };

  const groupedResults = auditResults.reduce((acc, result) => {
    if (!acc[result.category]) {
      acc[result.category] = [];
    }
    acc[result.category].push(result);
    return acc;
  }, {} as Record<string, AuditResult[]>);

  const categoryLabels: Record<string, string> = {
    credentials: 'Credenciais',
    products: 'Produtos',
    roles: 'Roles do App',
    scopes: 'Escopos',
    redirect_uri: 'Redirect URI',
    app_review: 'App Review',
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">Auditoria do App Meta</h3>
          {graphVersion && (
            <Badge variant="outline" className="text-xs">
              Graph API v{graphVersion}
            </Badge>
          )}
        </div>
      </div>

      <Alert className="bg-muted/50">
        <Info className="h-4 w-4" />
        <AlertTitle className="text-sm">Diagnóstico de "Invalid Scopes"</AlertTitle>
        <AlertDescription className="text-xs">
          Esta auditoria verifica se o erro é do App (configuração, produtos, roles) 
          e NÃO do usuário ou da Página. Use para diagnosticar problemas de OAuth.
        </AlertDescription>
      </Alert>

      <div className="flex items-center gap-2">
        <select
          value={scopeStrategy}
          onChange={(e) => setScopeStrategy(e.target.value as 'minimum' | 'full' | 'instagram_publish')}
          className="text-sm border rounded-md px-2 py-1 bg-background"
        >
          <option value="minimum">Mínimo (pages_show_list)</option>
          <option value="full">Completo (publicação FB + IG basic)</option>
          <option value="instagram_publish">Instagram Publish (todos)</option>
        </select>
        <Button
          onClick={runAudit}
          disabled={isRunning}
          size="sm"
        >
          {isRunning ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          Executar Auditoria
        </Button>
      </div>

      {summary && (
        <>
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Resumo da Auditoria</CardTitle>
                {getStatusBadge(summary.overall_status)}
              </div>
              {appInfo && (
                <CardDescription>
                  App: {appInfo.name || appInfo.id}
                </CardDescription>
              )}
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className={cn(
                  "p-2 rounded-lg",
                  summary.errors > 0 ? "bg-red-100 dark:bg-red-900/30" : "bg-muted/50"
                )}>
                  <div className="text-lg font-bold text-red-600 dark:text-red-400">{summary.errors}</div>
                  <div className="text-xs text-muted-foreground">Erros</div>
                </div>
                <div className={cn(
                  "p-2 rounded-lg",
                  summary.warnings > 0 ? "bg-amber-100 dark:bg-amber-900/30" : "bg-muted/50"
                )}>
                  <div className="text-lg font-bold text-amber-600 dark:text-amber-400">{summary.warnings}</div>
                  <div className="text-xs text-muted-foreground">Avisos</div>
                </div>
                <div className={cn(
                  "p-2 rounded-lg",
                  summary.passed > 0 ? "bg-green-100 dark:bg-green-900/30" : "bg-muted/50"
                )}>
                  <div className="text-lg font-bold text-green-600 dark:text-green-400">{summary.passed}</div>
                  <div className="text-xs text-muted-foreground">OK</div>
                </div>
              </div>

              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-2">
                  {summary.can_oauth ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-500" />
                  )}
                  <span>OAuth</span>
                </div>
                <div className="flex items-center gap-2">
                  {summary.can_publish ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-500" />
                  )}
                  <span>Publicação</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {scopeValidation && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Validação de Escopos</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {scopeValidation.valid.length > 0 && (
                  <div>
                    <div className="text-xs font-medium mb-1 flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3 text-green-500" />
                      Escopos válidos ({scopeValidation.valid.length})
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {scopeValidation.valid.map((scope) => (
                        <Badge key={scope} variant="outline" className="text-xs bg-green-50 dark:bg-green-900/20">
                          {scope}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {scopeValidation.invalid.length > 0 && (
                  <div>
                    <div className="text-xs font-medium mb-1 flex items-center gap-1">
                      <XCircle className="h-3 w-3 text-red-500" />
                      Escopos inválidos para v{graphVersion} ({scopeValidation.invalid.length})
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {scopeValidation.invalid.map((scope) => (
                        <Badge key={scope} variant="destructive" className="text-xs">
                          {scope}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {scopeValidation.require_app_review.length > 0 && (
                  <div>
                    <div className="text-xs font-medium mb-1 flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3 text-amber-500" />
                      Requerem App Review ({scopeValidation.require_app_review.length})
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {scopeValidation.require_app_review.map((scope) => (
                        <Badge key={scope} variant="outline" className="text-xs bg-amber-50 dark:bg-amber-900/20">
                          {scope}
                        </Badge>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Em modo Development, apenas Admin/Developer/Tester do App podem usar esses escopos.
                    </p>
                  </div>
                )}

                {Object.keys(scopeValidation.require_products).length > 0 && (
                  <div>
                    <div className="text-xs font-medium mb-1 flex items-center gap-1">
                      <Settings className="h-3 w-3 text-purple-500" />
                      Produtos necessários
                    </div>
                    <ul className="text-xs space-y-1">
                      {Object.entries(scopeValidation.require_products).map(([product, scopes]) => (
                        <li key={product} className="flex items-start gap-1">
                          <span className="font-medium text-purple-600 dark:text-purple-400">
                            {product === 'facebook_login' ? 'Facebook Login for Business' : 
                             product === 'instagram_graph_api' ? 'Instagram Graph API' : 
                             product}:
                          </span>
                          <span className="text-muted-foreground">{scopes.join(', ')}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <Tabs defaultValue="all" className="w-full">
            <TabsList className="w-full grid grid-cols-4">
              <TabsTrigger value="all" className="text-xs">Todos</TabsTrigger>
              <TabsTrigger value="errors" className="text-xs">
                Erros ({auditResults.filter(r => r.severity === 'error').length})
              </TabsTrigger>
              <TabsTrigger value="warnings" className="text-xs">
                Avisos ({auditResults.filter(r => r.severity === 'warning').length})
              </TabsTrigger>
              <TabsTrigger value="passed" className="text-xs">
                OK ({auditResults.filter(r => r.severity === 'info').length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="space-y-3 mt-3">
              {Object.entries(groupedResults).map(([category, results]) => (
                <div key={category} className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    {getCategoryIcon(category as AuditResult['category'])}
                    {categoryLabels[category] || category}
                  </div>
                  {results.map((result, idx) => (
                    <AuditResultCard key={idx} result={result} />
                  ))}
                </div>
              ))}
            </TabsContent>

            <TabsContent value="errors" className="space-y-2 mt-3">
              {auditResults.filter(r => r.severity === 'error').map((result, idx) => (
                <AuditResultCard key={idx} result={result} />
              ))}
            </TabsContent>

            <TabsContent value="warnings" className="space-y-2 mt-3">
              {auditResults.filter(r => r.severity === 'warning').map((result, idx) => (
                <AuditResultCard key={idx} result={result} />
              ))}
            </TabsContent>

            <TabsContent value="passed" className="space-y-2 mt-3">
              {auditResults.filter(r => r.severity === 'info').map((result, idx) => (
                <AuditResultCard key={idx} result={result} />
              ))}
            </TabsContent>
          </Tabs>
        </>
      )}

      <Separator />

      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          onClick={copyAuditReport}
          disabled={auditResults.length === 0}
        >
          <Copy className="h-4 w-4 mr-2" />
          Copiar Relatório
        </Button>

        <Button
          variant="link"
          size="sm"
          asChild
        >
          <a
            href="https://developers.facebook.com/apps"
            target="_blank"
            rel="noopener noreferrer"
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            Meta for Developers
          </a>
        </Button>
      </div>
    </div>
  );
}

function AuditResultCard({ result }: { result: AuditResult }) {
  const getSeverityIcon = (severity: AuditResult['severity']) => {
    switch (severity) {
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-amber-500" />;
      case 'info':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    }
  };

  return (
    <Collapsible>
      <CollapsibleTrigger asChild>
        <div className={cn(
          "flex items-start gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors",
          result.severity === 'error' ? "border-red-200 bg-red-50/50 dark:border-red-900 dark:bg-red-900/20" :
          result.severity === 'warning' ? "border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-900/20" :
          "border-green-200 bg-green-50/50 dark:border-green-900 dark:bg-green-900/20"
        )}>
          {getSeverityIcon(result.severity)}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{result.message}</span>
              <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            </div>
            <p className="text-xs text-muted-foreground mt-1">{result.details}</p>
          </div>
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="ml-7 mt-2 p-3 bg-muted/30 rounded-lg space-y-2">
          {result.action.length > 0 && (
            <>
              <p className="text-xs font-medium">Ações recomendadas:</p>
              <ul className="text-xs text-muted-foreground space-y-1">
                {result.action.map((action, actionIdx) => (
                  <li key={actionIdx} className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    {action}
                  </li>
                ))}
              </ul>
            </>
          )}
          {result.technical && (
            <div className="mt-2 pt-2 border-t">
              <p className="text-xs font-medium mb-1">Dados técnicos:</p>
              <pre className="text-xs font-mono text-muted-foreground overflow-auto max-h-32 bg-muted/50 p-2 rounded">
                {JSON.stringify(result.technical, null, 2)}
              </pre>
            </div>
          )}
          <Badge variant="outline" className="text-xs">
            {result.code}
          </Badge>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
