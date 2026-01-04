import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import {
  CheckCircle2,
  Copy,
  ExternalLink,
  AlertCircle,
  ChevronRight,
  Settings,
  Shield,
  Key,
  Globe,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface MetaSetupGuideProps {
  appId?: string;
  callbackUrl: string;
  onClose?: () => void;
}

interface SetupStep {
  id: string;
  title: string;
  description: string;
  helpUrl?: string;
  action?: 'copy' | 'link';
  actionValue?: string;
  actionLabel?: string;
}

const SETUP_STEPS: SetupStep[] = [
  {
    id: 'create_app',
    title: '1. Criar/Acessar o App Meta',
    description: 'Acesse o Meta for Developers e crie um novo app ou selecione um existente.',
    helpUrl: 'https://developers.facebook.com/apps',
    action: 'link',
    actionValue: 'https://developers.facebook.com/apps',
    actionLabel: 'Abrir Meta for Developers',
  },
  {
    id: 'add_facebook_login',
    title: '2. Adicionar produto "Facebook Login"',
    description: 'No painel do app, vá em "Adicionar Produto" e adicione "Facebook Login para Empresas" ou "Facebook Login".',
    helpUrl: 'https://developers.facebook.com/docs/facebook-login/guides/access-tokens',
  },
  {
    id: 'configure_redirect',
    title: '3. Configurar URI de Redirecionamento OAuth',
    description: 'Em Facebook Login → Configurações, adicione a URL abaixo em "Valid OAuth Redirect URIs".',
    action: 'copy',
    actionLabel: 'Copiar URL',
  },
  {
    id: 'add_permissions',
    title: '4. Adicionar permissões nos Casos de Uso',
    description: 'Vá em "Casos de uso" → "Personalizar" e adicione: pages_show_list, pages_read_engagement, pages_manage_posts.',
    helpUrl: 'https://developers.facebook.com/docs/permissions/reference',
  },
  {
    id: 'add_testers',
    title: '5. Adicionar usuários de teste (Modo Development)',
    description: 'Em "Funções" → "Funções do App", adicione seu usuário como Admin, Developer ou Tester.',
    helpUrl: 'https://developers.facebook.com/docs/development/build-and-test/test-users',
  },
  {
    id: 'verify_app_id',
    title: '6. Verificar App ID e App Secret',
    description: 'Confirme que o App ID e App Secret estão configurados corretamente nas variáveis de ambiente.',
  },
];

export function MetaSetupGuide({ appId, callbackUrl, onClose }: MetaSetupGuideProps) {
  const [completedSteps, setCompletedSteps] = useState<Record<string, boolean>>({});

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado!`);
  };

  const toggleStep = (stepId: string) => {
    setCompletedSteps(prev => ({ ...prev, [stepId]: !prev[stepId] }));
  };

  const completedCount = Object.values(completedSteps).filter(Boolean).length;
  const allCompleted = completedCount === SETUP_STEPS.length;

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="text-center py-4">
        <div className="mx-auto w-16 h-16 rounded-2xl bg-blue-100 flex items-center justify-center mb-4">
          <Settings className="h-8 w-8 text-blue-600" />
        </div>
        <h2 className="text-xl font-bold mb-2">
          Configuração do App Meta
        </h2>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Siga os passos abaixo para configurar corretamente a integração com Facebook e Instagram.
        </p>
      </div>

      {/* Progress */}
      <div className="flex items-center justify-center gap-2 text-sm">
        <Badge variant={allCompleted ? "default" : "outline"}>
          {completedCount}/{SETUP_STEPS.length} passos completos
        </Badge>
      </div>

      {/* Critical Info Card */}
      <Alert>
        <Key className="h-4 w-4" />
        <AlertTitle>Informações Importantes</AlertTitle>
        <AlertDescription className="mt-2 space-y-2">
          <div className="flex items-center justify-between p-2 bg-muted rounded">
            <span className="text-xs font-medium">App ID:</span>
            <div className="flex items-center gap-2">
              <code className="text-xs bg-background px-2 py-1 rounded">{appId || 'Não configurado'}</code>
              {appId && (
                <Button size="sm" variant="ghost" onClick={() => handleCopy(appId, 'App ID')}>
                  <Copy className="h-3 w-3" />
                </Button>
              )}
            </div>
          </div>
          <div className="flex items-center justify-between p-2 bg-muted rounded">
            <span className="text-xs font-medium">Callback URL:</span>
            <div className="flex items-center gap-2">
              <code className="text-xs bg-background px-2 py-1 rounded truncate max-w-[300px]">{callbackUrl}</code>
              <Button size="sm" variant="ghost" onClick={() => handleCopy(callbackUrl, 'Callback URL')}>
                <Copy className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </AlertDescription>
      </Alert>

      {/* Steps */}
      <div className="space-y-3">
        {SETUP_STEPS.map((step) => (
          <Card key={step.id} className={cn(
            "transition-colors",
            completedSteps[step.id] && "bg-green-50 border-green-200"
          )}>
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <Checkbox
                  id={step.id}
                  checked={completedSteps[step.id] || false}
                  onCheckedChange={() => toggleStep(step.id)}
                  className="mt-1"
                />
                <div className="flex-1 space-y-2">
                  <label 
                    htmlFor={step.id}
                    className={cn(
                      "font-medium cursor-pointer",
                      completedSteps[step.id] && "line-through text-muted-foreground"
                    )}
                  >
                    {step.title}
                  </label>
                  <p className="text-sm text-muted-foreground">{step.description}</p>
                  
                  {/* Action buttons */}
                  <div className="flex flex-wrap gap-2 pt-1">
                    {step.action === 'copy' && (
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => handleCopy(callbackUrl, 'URL de Callback')}
                      >
                        <Copy className="h-3 w-3 mr-2" />
                        {step.actionLabel}
                      </Button>
                    )}
                    {step.action === 'link' && step.actionValue && (
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => window.open(step.actionValue, '_blank')}
                      >
                        <ExternalLink className="h-3 w-3 mr-2" />
                        {step.actionLabel}
                      </Button>
                    )}
                    {step.helpUrl && (
                      <Button 
                        size="sm" 
                        variant="ghost"
                        onClick={() => window.open(step.helpUrl, '_blank')}
                      >
                        <Globe className="h-3 w-3 mr-2" />
                        Ver documentação
                      </Button>
                    )}
                  </div>
                </div>
                {completedSteps[step.id] && (
                  <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Scopes Reference */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Permissões (Scopes) Necessárias
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {[
              'public_profile',
              'pages_show_list', 
              'pages_read_engagement', 
              'pages_manage_posts',
              'instagram_basic',
              'instagram_content_publish'
            ].map(scope => (
              <Badge key={scope} variant="secondary" className="font-mono text-xs">
                {scope}
              </Badge>
            ))}
          </div>
          <Button 
            size="sm" 
            variant="outline" 
            className="mt-3 w-full"
            onClick={() => handleCopy(
              'public_profile,pages_show_list,pages_read_engagement,pages_manage_posts,instagram_basic,instagram_content_publish',
              'Scopes'
            )}
          >
            <Copy className="h-3 w-3 mr-2" />
            Copiar todos os scopes
          </Button>
        </CardContent>
      </Card>

      {/* Action Button */}
      {allCompleted && (
        <Alert className="bg-green-50 border-green-200">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertTitle className="text-green-800">Configuração Completa!</AlertTitle>
          <AlertDescription className="text-green-700">
            Todos os passos foram marcados como concluídos. Agora você pode tentar conectar novamente.
          </AlertDescription>
        </Alert>
      )}

      {onClose && (
        <Button className="w-full" onClick={onClose}>
          {allCompleted ? 'Tentar Conectar Novamente' : 'Fechar'}
        </Button>
      )}
    </div>
  );
}
