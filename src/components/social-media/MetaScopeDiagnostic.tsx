import React, { useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ExternalLink,
  Copy,
  RefreshCw,
  Settings,
  FileText,
  Shield,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface MetaScopeDiagnosticProps {
  isSuperAdmin: boolean;
  platform: 'facebook' | 'instagram';
  errorDescription?: string;
  onRetry: (strategy: 'full' | 'minimal' | 'pages_only') => void;
  onClose: () => void;
  isConnecting?: boolean;
}

interface ChecklistItem {
  id: string;
  title: string;
  description: string;
  helpUrl?: string;
  adminOnly?: boolean;
}

const DIAGNOSTIC_CHECKLIST: ChecklistItem[] = [
  {
    id: 'remove_legacy_scopes',
    title: 'Remover escopos legados (manage_pages)',
    description: 'O escopo "manage_pages" foi depreciado. Use pages_show_list, pages_read_engagement, pages_manage_posts.',
    helpUrl: 'https://developers.facebook.com/docs/pages/overview-1',
    adminOnly: true,
  },
  {
    id: 'facebook_login_configured',
    title: 'Facebook Login configurado no App',
    description: 'Vá em Meta for Developers → Seu App → Produtos → Facebook Login → Configurações.',
    helpUrl: 'https://developers.facebook.com/docs/facebook-login/guides/access-tokens',
    adminOnly: true,
  },
  {
    id: 'redirect_uri_correct',
    title: 'URI de redirecionamento OAuth válida',
    description: 'A URL de callback deve estar listada em "Valid OAuth Redirect URIs" nas configurações do Facebook Login.',
    adminOnly: true,
  },
  {
    id: 'use_cases_enabled',
    title: 'Casos de uso habilitados',
    description: 'Em "Casos de uso", adicione as permissões necessárias: pages_show_list, pages_read_engagement, pages_manage_posts.',
    helpUrl: 'https://developers.facebook.com/docs/development/create-an-app/app-dashboard/app-use-cases',
    adminOnly: true,
  },
  {
    id: 'app_review_complete',
    title: 'App Review aprovado (produção)',
    description: 'Para usuários externos, cada permissão precisa ser aprovada no App Review.',
    helpUrl: 'https://developers.facebook.com/docs/app-review',
    adminOnly: true,
  },
  {
    id: 'user_is_tester',
    title: 'Usuário é Admin/Dev/Tester do App (desenvolvimento)',
    description: 'Em modo Development, apenas admins, devs e testers do app podem fazer login.',
    helpUrl: 'https://developers.facebook.com/docs/development/build-and-test/test-users',
    adminOnly: true,
  },
  {
    id: 'graph_api_version',
    title: 'Versão da Graph API compatível',
    description: 'A versão configurada no App deve corresponder à usada no código (v24.0).',
    adminOnly: true,
  },
];

// Scopes required for each platform
const REQUIRED_SCOPES = {
  facebook: [
    { scope: 'public_profile', description: 'Perfil público do usuário', required: true },
    { scope: 'pages_show_list', description: 'Listar Páginas que o usuário administra', required: true },
    { scope: 'pages_read_engagement', description: 'Ler posts e métricas das Páginas', required: true },
    { scope: 'pages_manage_posts', description: 'Criar e editar posts nas Páginas', required: true },
  ],
  instagram: [
    { scope: 'public_profile', description: 'Perfil público do usuário', required: true },
    { scope: 'pages_show_list', description: 'Listar Páginas (necessário para IG Business)', required: true },
    { scope: 'pages_read_engagement', description: 'Ler dados das Páginas', required: true },
    { scope: 'instagram_basic', description: 'Informações básicas do Instagram Business', required: true },
    { scope: 'instagram_content_publish', description: 'Publicar conteúdo no Instagram', required: true },
    { scope: 'instagram_manage_insights', description: 'Acessar métricas do Instagram', required: false },
  ],
};

export function MetaScopeDiagnostic({
  isSuperAdmin,
  platform,
  errorDescription,
  onRetry,
  onClose,
  isConnecting,
}: MetaScopeDiagnosticProps) {
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});
  const [showScopes, setShowScopes] = useState(false);
  const [showChecklist, setShowChecklist] = useState(true);

  const scopes = REQUIRED_SCOPES[platform];
  const filteredChecklist = isSuperAdmin 
    ? DIAGNOSTIC_CHECKLIST 
    : DIAGNOSTIC_CHECKLIST.filter(item => !item.adminOnly);

  const completedCount = Object.values(checkedItems).filter(Boolean).length;
  const totalChecklistItems = filteredChecklist.length;

  const handleCopyScopes = () => {
    const scopeString = scopes.filter(s => s.required).map(s => s.scope).join(',');
    navigator.clipboard.writeText(scopeString);
    toast.success('Escopos copiados para a área de transferência');
  };

  const handleCheckItem = (id: string, checked: boolean) => {
    setCheckedItems(prev => ({ ...prev, [id]: checked }));
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="text-center py-4">
        <div className="mx-auto w-16 h-16 rounded-2xl bg-red-100 flex items-center justify-center mb-4">
          <AlertCircle className="h-8 w-8 text-red-600" />
        </div>
        <h3 className="text-lg font-semibold mb-2">
          Erro de Permissões OAuth
        </h3>
        <p className="text-sm text-muted-foreground max-w-sm mx-auto">
          O Meta rejeitou as permissões solicitadas. {isSuperAdmin ? 'Siga o checklist abaixo para corrigir.' : 'Contate o administrador.'}
        </p>
      </div>

      {/* Error details for admins */}
      {isSuperAdmin && errorDescription && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Detalhes do erro</AlertTitle>
          <AlertDescription className="text-xs font-mono mt-1">
            {errorDescription}
          </AlertDescription>
        </Alert>
      )}

      {/* Required Scopes */}
      <Collapsible open={showScopes} onOpenChange={setShowScopes}>
        <Card>
          <CardHeader className="py-3 cursor-pointer" onClick={() => setShowScopes(!showScopes)}>
            <CollapsibleTrigger asChild>
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Permissões Necessárias ({platform === 'instagram' ? 'Instagram' : 'Facebook'})
                </CardTitle>
                <ChevronDown className={cn("h-4 w-4 transition-transform", showScopes && "rotate-180")} />
              </div>
            </CollapsibleTrigger>
          </CardHeader>
          <CollapsibleContent>
            <CardContent className="pt-0 space-y-2">
              {scopes.map((scope) => (
                <div key={scope.scope} className="flex items-start gap-2 text-sm">
                  <Badge variant={scope.required ? "default" : "secondary"} className="text-xs">
                    {scope.scope}
                  </Badge>
                  <span className="text-muted-foreground text-xs">{scope.description}</span>
                </div>
              ))}
              <Button variant="outline" size="sm" className="w-full mt-2" onClick={handleCopyScopes}>
                <Copy className="h-3 w-3 mr-2" />
                Copiar escopos obrigatórios
              </Button>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Diagnostic Checklist - Admin Only */}
      {isSuperAdmin && (
        <Collapsible open={showChecklist} onOpenChange={setShowChecklist}>
          <Card>
            <CardHeader className="py-3 cursor-pointer" onClick={() => setShowChecklist(!showChecklist)}>
              <CollapsibleTrigger asChild>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Checklist de Diagnóstico
                    <Badge variant="outline" className="ml-2">
                      {completedCount}/{totalChecklistItems}
                    </Badge>
                  </CardTitle>
                  <ChevronDown className={cn("h-4 w-4 transition-transform", showChecklist && "rotate-180")} />
                </div>
              </CollapsibleTrigger>
            </CardHeader>
            <CollapsibleContent>
              <CardContent className="pt-0 space-y-3">
                {filteredChecklist.map((item) => (
                  <div key={item.id} className="flex items-start gap-3">
                    <Checkbox
                      id={item.id}
                      checked={checkedItems[item.id] || false}
                      onCheckedChange={(checked) => handleCheckItem(item.id, checked as boolean)}
                      className="mt-0.5"
                    />
                    <div className="flex-1 space-y-1">
                      <label
                        htmlFor={item.id}
                        className={cn(
                          "text-sm font-medium cursor-pointer",
                          checkedItems[item.id] && "line-through text-muted-foreground"
                        )}
                      >
                        {item.title}
                      </label>
                      <p className="text-xs text-muted-foreground">{item.description}</p>
                      {item.helpUrl && (
                        <Button
                          variant="link"
                          size="sm"
                          className="h-auto p-0 text-xs"
                          onClick={() => window.open(item.helpUrl, '_blank')}
                        >
                          <ExternalLink className="h-3 w-3 mr-1" />
                          Ver documentação
                        </Button>
                      )}
                    </div>
                    {checkedItems[item.id] && (
                      <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                    )}
                  </div>
                ))}
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}

      {/* Action Buttons */}
      <div className="space-y-2 pt-2">
        {isSuperAdmin && (
          <Button
            variant="outline"
            className="w-full"
            onClick={() => window.open('https://developers.facebook.com/apps', '_blank')}
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            Abrir Meta for Developers
          </Button>
        )}

        <Button
          className="w-full"
          onClick={() => onRetry('full')}
          disabled={isConnecting}
        >
          {isConnecting ? (
            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          Tentar novamente
        </Button>

        {/* Development fallback options for admins */}
        {isSuperAdmin && (
          <div className="pt-2 border-t">
            <p className="text-xs text-muted-foreground mb-2 text-center">
              Opções de fallback (modo desenvolvimento):
            </p>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                className="flex-1"
                onClick={() => onRetry('minimal')}
                disabled={isConnecting}
              >
                Mínimo (só perfil)
              </Button>
              <Button
                variant="secondary"
                size="sm"
                className="flex-1"
                onClick={() => onRetry('pages_only')}
                disabled={isConnecting}
              >
                Só Pages (sem IG)
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
