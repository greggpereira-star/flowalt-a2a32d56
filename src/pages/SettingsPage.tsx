import React from 'react';
import { Helmet } from 'react-helmet';
import { AppLayout } from '@/components/layout/AppLayout';
import { ApiKeyManager } from '@/components/settings/ApiKeyManager';
import { WebhookManager } from '@/components/settings/WebhookManager';
import { WebhookDashboard } from '@/components/settings/WebhookDashboard';
import { ApiLogsPanel } from '@/components/settings/ApiLogsPanel';
import { OnboardingSettings } from '@/components/settings/OnboardingSettings';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Code, Key, Webhook, BarChart3, Sparkles, Activity } from 'lucide-react';
import { useWorkspace } from '@/contexts/WorkspaceContext';

export default function SettingsPage() {
  const { currentWorkspace } = useWorkspace();
  const apiBaseUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/public-api`;

  return (
    <AppLayout>
      <Helmet>
        <title>Configurações - API & Webhooks</title>
      </Helmet>
      
      <div className="container mx-auto p-6 max-w-5xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Configurações</h1>
          <p className="text-muted-foreground">
            Gerencie suas preferências, API e integrações
          </p>
        </div>

        <Tabs defaultValue="onboarding" className="space-y-6">
          <TabsList className="flex-wrap">
            <TabsTrigger value="onboarding" className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              Tour & Conquistas
            </TabsTrigger>
            <TabsTrigger value="api-keys" className="flex items-center gap-2">
              <Key className="h-4 w-4" />
              API Keys
            </TabsTrigger>
            <TabsTrigger value="webhooks" className="flex items-center gap-2">
              <Webhook className="h-4 w-4" />
              Webhooks
            </TabsTrigger>
            <TabsTrigger value="monitoring" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Webhooks Monitor
            </TabsTrigger>
            <TabsTrigger value="api-logs" className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              API Logs
            </TabsTrigger>
            <TabsTrigger value="docs" className="flex items-center gap-2">
              <Code className="h-4 w-4" />
              Documentação
            </TabsTrigger>
          </TabsList>

          <TabsContent value="onboarding">
            <OnboardingSettings />
          </TabsContent>

          <TabsContent value="api-keys">
            <ApiKeyManager />
          </TabsContent>

          <TabsContent value="webhooks">
            <WebhookManager />
          </TabsContent>

          <TabsContent value="monitoring">
            <WebhookDashboard />
          </TabsContent>

          <TabsContent value="api-logs">
            <ApiLogsPanel />
          </TabsContent>

          <TabsContent value="docs">
            <Card>
              <CardHeader>
                <CardTitle>Documentação da API</CardTitle>
                <CardDescription>
                  Referência rápida para integrar com a API REST
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h3 className="font-semibold mb-2">Base URL</h3>
                  <code className="block p-3 bg-muted rounded-lg text-sm">
                    {apiBaseUrl}
                  </code>
                </div>

                <div>
                  <h3 className="font-semibold mb-2">Autenticação</h3>
                  <p className="text-sm text-muted-foreground mb-2">
                    Inclua a API Key no header de todas as requisições:
                  </p>
                  <code className="block p-3 bg-muted rounded-lg text-sm">
                    X-API-Key: lv_sua_api_key_aqui
                  </code>
                </div>

                <div>
                  <h3 className="font-semibold mb-2">Health Check</h3>
                  <p className="text-sm text-muted-foreground mb-2">
                    Endpoint público para verificar status da API (sem autenticação):
                  </p>
                  <code className="block p-3 bg-muted rounded-lg text-sm">
                    GET /status
                  </code>
                  <p className="text-xs text-muted-foreground mt-2">
                    Retorna status dos serviços, latência do banco e endpoints disponíveis.
                  </p>
                </div>

                <div>
                  <h3 className="font-semibold mb-2">Endpoints Disponíveis</h3>
                  <div className="space-y-3">
                    <div className="p-3 border rounded-lg">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="px-2 py-0.5 bg-green-500/20 text-green-600 rounded text-xs font-mono">GET</span>
                        <code className="text-sm">/cards</code>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Lista cards com filtros: status, space_id, folder_id, assignee_id
                      </p>
                    </div>
                    
                    <div className="p-3 border rounded-lg">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="px-2 py-0.5 bg-blue-500/20 text-blue-600 rounded text-xs font-mono">POST</span>
                        <code className="text-sm">/cards</code>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Cria um novo card (requer permissão write)
                      </p>
                    </div>

                    <div className="p-3 border rounded-lg">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-600 rounded text-xs font-mono">PATCH</span>
                        <code className="text-sm">/cards/:id</code>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Atualiza um card existente
                      </p>
                    </div>

                    <div className="p-3 border rounded-lg">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="px-2 py-0.5 bg-green-500/20 text-green-600 rounded text-xs font-mono">GET</span>
                        <code className="text-sm">/comments?card_id=...</code>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Lista comentários de um card
                      </p>
                    </div>

                    <div className="p-3 border rounded-lg">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="px-2 py-0.5 bg-green-500/20 text-green-600 rounded text-xs font-mono">GET</span>
                        <code className="text-sm">/time-entries</code>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Lista entradas de tempo com filtros: card_id, user_id, start_date, end_date
                      </p>
                    </div>

                    <div className="p-3 border rounded-lg">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="px-2 py-0.5 bg-green-500/20 text-green-600 rounded text-xs font-mono">GET</span>
                        <code className="text-sm">/events</code>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Lista eventos da agenda com filtros: start_date, end_date, event_type
                      </p>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold mb-2">Rate Limiting</h3>
                  <p className="text-sm text-muted-foreground mb-2">
                    Limite de 100 requisições por minuto por API Key. Headers de resposta:
                  </p>
                  <div className="space-y-1 text-xs font-mono bg-muted p-3 rounded-lg">
                    <p><span className="text-muted-foreground">X-RateLimit-Limit:</span> 100</p>
                    <p><span className="text-muted-foreground">X-RateLimit-Remaining:</span> 95</p>
                    <p><span className="text-muted-foreground">X-RateLimit-Reset:</span> 1704067200000</p>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Ao exceder o limite, retorna HTTP 429 com header Retry-After.
                  </p>
                </div>

                <div>
                  <h3 className="font-semibold mb-2">Idempotency Key</h3>
                  <p className="text-sm text-muted-foreground mb-2">
                    Para requisições POST/PUT/PATCH, envie um header para evitar duplicações:
                  </p>
                  <code className="block p-3 bg-muted rounded-lg text-sm">
                    Idempotency-Key: seu-id-unico-123
                  </code>
                  <p className="text-xs text-muted-foreground mt-2">
                    Requisições com a mesma chave retornam a resposta cacheada por 24h.
                    O header X-Idempotent-Replayed: true indica resposta em cache.
                  </p>
                </div>

                <div>
                  <h3 className="font-semibold mb-2">Paginação</h3>
                  <p className="text-sm text-muted-foreground mb-2">
                    Use os parâmetros page e limit:
                  </p>
                  <code className="block p-3 bg-muted rounded-lg text-sm">
                    GET /cards?page=1&limit=50
                  </code>
                </div>

                <div>
                  <h3 className="font-semibold mb-2">Webhooks - Verificação de Assinatura</h3>
                  <p className="text-sm text-muted-foreground mb-2">
                    Verifique a assinatura HMAC SHA-256 do payload:
                  </p>
                  <pre className="block p-3 bg-muted rounded-lg text-xs overflow-x-auto">
{`const signature = req.headers['x-webhook-signature'];
const expectedSignature = 'sha256=' + 
  crypto.createHmac('sha256', webhookSecret)
    .update(rawBody)
    .digest('hex');
    
if (signature !== expectedSignature) {
  throw new Error('Invalid signature');
}`}
                  </pre>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
