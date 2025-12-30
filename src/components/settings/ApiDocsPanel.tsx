import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  Code, 
  ChevronDown, 
  Copy, 
  Check, 
  Webhook, 
  Key,
  Clock,
  Shield,
  Zap
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface EndpointDoc {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  description: string;
  permission: string;
  parameters?: { name: string; type: string; required: boolean; description: string }[];
  requestBody?: { field: string; type: string; required: boolean; description: string }[];
  response?: string;
}

interface WebhookEvent {
  event: string;
  description: string;
  payload: string;
}

const endpoints: EndpointDoc[] = [
  {
    method: 'GET',
    path: '/status',
    description: 'Health check - verifica status da API (público)',
    permission: 'none',
    response: `{
  "status": "healthy",
  "timestamp": "2024-01-01T12:00:00Z",
  "services": { "database": "ok", "auth": "ok" },
  "latency_ms": 5
}`
  },
  {
    method: 'GET',
    path: '/openapi',
    description: 'Retorna especificação OpenAPI/Swagger JSON',
    permission: 'none',
    response: `{
  "openapi": "3.0.0",
  "info": { "title": "Flowalt API", "version": "1.0.0" },
  "paths": { ... }
}`
  },
  {
    method: 'GET',
    path: '/cards',
    description: 'Lista todos os cards do workspace',
    permission: 'read',
    parameters: [
      { name: 'status', type: 'string', required: false, description: 'Filtrar por status (backlog, todo, in_progress, review, delivered, archived)' },
      { name: 'space_id', type: 'uuid', required: false, description: 'Filtrar por space' },
      { name: 'folder_id', type: 'uuid', required: false, description: 'Filtrar por folder' },
      { name: 'assignee_id', type: 'uuid', required: false, description: 'Filtrar por responsável' },
      { name: 'page', type: 'number', required: false, description: 'Página (default: 1)' },
      { name: 'limit', type: 'number', required: false, description: 'Itens por página (default: 50, max: 100)' }
    ],
    response: `{
  "data": [{
    "id": "uuid",
    "title": "Task title",
    "status": "in_progress",
    "urgency": "normal",
    "due_date": "2024-01-15",
    "estimated_hours": 8,
    "owner_id": "uuid",
    "space_id": "uuid"
  }],
  "pagination": { "page": 1, "limit": 50, "total": 120 }
}`
  },
  {
    method: 'POST',
    path: '/cards',
    description: 'Cria um novo card',
    permission: 'write',
    requestBody: [
      { field: 'title', type: 'string', required: true, description: 'Título do card' },
      { field: 'space_id', type: 'uuid', required: true, description: 'ID do space' },
      { field: 'description', type: 'string', required: false, description: 'Descrição' },
      { field: 'status', type: 'string', required: false, description: 'Status inicial (default: backlog)' },
      { field: 'urgency', type: 'string', required: false, description: 'Urgência (low, normal, high, critical)' },
      { field: 'due_date', type: 'date', required: false, description: 'Data de vencimento (YYYY-MM-DD)' },
      { field: 'estimated_hours', type: 'number', required: false, description: 'Horas estimadas' },
      { field: 'owner_id', type: 'uuid', required: false, description: 'ID do responsável' },
      { field: 'client_id', type: 'uuid', required: false, description: 'ID do cliente' }
    ],
    response: `{
  "data": { "id": "uuid", "title": "New card", ... },
  "message": "Card created successfully"
}`
  },
  {
    method: 'PATCH',
    path: '/cards/:id',
    description: 'Atualiza um card existente',
    permission: 'write',
    parameters: [
      { name: 'id', type: 'uuid', required: true, description: 'ID do card' }
    ],
    requestBody: [
      { field: 'title', type: 'string', required: false, description: 'Título' },
      { field: 'status', type: 'string', required: false, description: 'Status' },
      { field: 'urgency', type: 'string', required: false, description: 'Urgência' },
      { field: 'due_date', type: 'date', required: false, description: 'Data de vencimento' },
      { field: 'estimated_hours', type: 'number', required: false, description: 'Horas estimadas' }
    ]
  },
  {
    method: 'GET',
    path: '/comments',
    description: 'Lista comentários de um card',
    permission: 'read',
    parameters: [
      { name: 'card_id', type: 'uuid', required: true, description: 'ID do card' }
    ]
  },
  {
    method: 'POST',
    path: '/comments',
    description: 'Adiciona comentário a um card',
    permission: 'write',
    requestBody: [
      { field: 'card_id', type: 'uuid', required: true, description: 'ID do card' },
      { field: 'content', type: 'string', required: true, description: 'Conteúdo do comentário' }
    ]
  },
  {
    method: 'GET',
    path: '/time-entries',
    description: 'Lista entradas de tempo',
    permission: 'read',
    parameters: [
      { name: 'card_id', type: 'uuid', required: false, description: 'Filtrar por card' },
      { name: 'user_id', type: 'uuid', required: false, description: 'Filtrar por usuário' },
      { name: 'start_date', type: 'date', required: false, description: 'Data inicial' },
      { name: 'end_date', type: 'date', required: false, description: 'Data final' }
    ]
  },
  // Financial Endpoints
  {
    method: 'GET',
    path: '/transactions',
    description: 'Lista transações financeiras (requer finance:read)',
    permission: 'finance:read',
    parameters: [
      { name: 'type', type: 'string', required: false, description: 'income ou expense' },
      { name: 'status', type: 'string', required: false, description: 'pending, paid, overdue, cancelled' },
      { name: 'start_date', type: 'date', required: false, description: 'Data inicial' },
      { name: 'end_date', type: 'date', required: false, description: 'Data final' },
      { name: 'client_id', type: 'uuid', required: false, description: 'Filtrar por cliente' }
    ],
    response: `{
  "data": [{
    "id": "uuid",
    "description": "Pagamento cliente",
    "amount": 5000.00,
    "type": "income",
    "status": "paid",
    "due_date": "2024-01-15",
    "paid_date": "2024-01-14",
    "client_id": "uuid"
  }],
  "pagination": { "page": 1, "limit": 50, "total": 45 }
}`
  },
  {
    method: 'POST',
    path: '/transactions',
    description: 'Cria uma nova transação (requer finance:write)',
    permission: 'finance:write',
    requestBody: [
      { field: 'description', type: 'string', required: true, description: 'Descrição da transação' },
      { field: 'amount', type: 'number', required: true, description: 'Valor em reais' },
      { field: 'type', type: 'string', required: true, description: 'income ou expense' },
      { field: 'due_date', type: 'date', required: true, description: 'Data de vencimento' },
      { field: 'client_id', type: 'uuid', required: false, description: 'ID do cliente' },
      { field: 'card_id', type: 'uuid', required: false, description: 'Vincular a um card' },
      { field: 'category_id', type: 'uuid', required: false, description: 'Categoria financeira' }
    ],
    response: `{
  "data": { "id": "uuid", "description": "Nova transação", ... },
  "message": "Transaction created successfully"
}`
  },
  {
    method: 'PATCH',
    path: '/transactions/:id',
    description: 'Atualiza uma transação (requer finance:write)',
    permission: 'finance:write',
    parameters: [
      { name: 'id', type: 'uuid', required: true, description: 'ID da transação' }
    ],
    requestBody: [
      { field: 'status', type: 'string', required: false, description: 'Novo status (paid, cancelled)' },
      { field: 'paid_date', type: 'date', required: false, description: 'Data do pagamento' },
      { field: 'amount', type: 'number', required: false, description: 'Valor atualizado' }
    ]
  },
  {
    method: 'GET',
    path: '/clients',
    description: 'Lista clientes do workspace (requer clients:read)',
    permission: 'clients:read',
    parameters: [
      { name: 'is_active', type: 'boolean', required: false, description: 'Filtrar por ativos' }
    ],
    response: `{
  "data": [{
    "id": "uuid",
    "name": "Cliente ABC",
    "color": "#3B82F6",
    "is_active": true
  }]
}`
  },
  {
    method: 'POST',
    path: '/clients',
    description: 'Cria um novo cliente (requer clients:write)',
    permission: 'clients:write',
    requestBody: [
      { field: 'name', type: 'string', required: true, description: 'Nome do cliente' },
      { field: 'color', type: 'string', required: false, description: 'Cor hex (ex: #3B82F6)' },
      { field: 'description', type: 'string', required: false, description: 'Descrição' }
    ]
  },
  {
    method: 'GET',
    path: '/events',
    description: 'Lista eventos da agenda',
    permission: 'read',
    parameters: [
      { name: 'start_date', type: 'date', required: false, description: 'Data inicial' },
      { name: 'end_date', type: 'date', required: false, description: 'Data final' },
      { name: 'event_type', type: 'string', required: false, description: 'Tipo de evento' }
    ]
  },
  {
    method: 'POST',
    path: '/events',
    description: 'Cria um novo evento',
    permission: 'write',
    requestBody: [
      { field: 'title', type: 'string', required: true, description: 'Título do evento' },
      { field: 'start_time', type: 'datetime', required: true, description: 'Início (ISO 8601)' },
      { field: 'end_time', type: 'datetime', required: true, description: 'Fim (ISO 8601)' },
      { field: 'event_type', type: 'string', required: false, description: 'Tipo de evento' },
      { field: 'description', type: 'string', required: false, description: 'Descrição' },
      { field: 'location', type: 'string', required: false, description: 'Local' }
    ]
  }
];

const webhookEvents: WebhookEvent[] = [
  {
    event: 'card.created',
    description: 'Disparado quando um card é criado',
    payload: `{
  "event": "card.created",
  "timestamp": "2024-01-01T12:00:00Z",
  "data": {
    "id": "uuid",
    "title": "New Task",
    "status": "backlog",
    "created_by": "uuid"
  }
}`
  },
  {
    event: 'card.updated',
    description: 'Disparado quando um card é atualizado',
    payload: `{
  "event": "card.updated",
  "timestamp": "2024-01-01T12:00:00Z",
  "data": {
    "id": "uuid",
    "changes": {
      "status": { "from": "todo", "to": "in_progress" }
    }
  }
}`
  },
  {
    event: 'card.status_changed',
    description: 'Disparado quando o status de um card muda',
    payload: `{
  "event": "card.status_changed",
  "timestamp": "2024-01-01T12:00:00Z",
  "data": {
    "id": "uuid",
    "previous_status": "todo",
    "new_status": "in_progress"
  }
}`
  },
  {
    event: 'card.deleted',
    description: 'Disparado quando um card é excluído',
    payload: `{
  "event": "card.deleted",
  "timestamp": "2024-01-01T12:00:00Z",
  "data": { "id": "uuid" }
}`
  },
  {
    event: 'comment.created',
    description: 'Disparado quando um comentário é adicionado',
    payload: `{
  "event": "comment.created",
  "timestamp": "2024-01-01T12:00:00Z",
  "data": {
    "id": "uuid",
    "card_id": "uuid",
    "user_id": "uuid",
    "content": "Comment text"
  }
}`
  },
  {
    event: 'attachment.uploaded',
    description: 'Disparado quando um anexo é enviado',
    payload: `{
  "event": "attachment.uploaded",
  "timestamp": "2024-01-01T12:00:00Z",
  "data": {
    "id": "uuid",
    "card_id": "uuid",
    "file_name": "document.pdf",
    "file_size": 102400
  }
}`
  },
  {
    event: 'time_entry.created',
    description: 'Disparado quando tempo é registrado',
    payload: `{
  "event": "time_entry.created",
  "timestamp": "2024-01-01T12:00:00Z",
  "data": {
    "id": "uuid",
    "card_id": "uuid",
    "user_id": "uuid",
    "duration_seconds": 3600
  }
}`
  }
];

const methodColors: Record<string, string> = {
  GET: 'bg-green-500/20 text-green-600',
  POST: 'bg-blue-500/20 text-blue-600',
  PUT: 'bg-yellow-500/20 text-yellow-600',
  PATCH: 'bg-orange-500/20 text-orange-600',
  DELETE: 'bg-red-500/20 text-red-600'
};

export const ApiDocsPanel = () => {
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const apiBaseUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/public-api`;

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(id);
    setTimeout(() => setCopiedCode(null), 2000);
    toast({ title: 'Copiado!', description: 'Código copiado para a área de transferência' });
  };

  const CodeBlock = ({ code, id }: { code: string; id: string }) => (
    <div className="relative">
      <pre className="p-4 bg-muted rounded-lg text-xs overflow-x-auto font-mono">
        {code}
      </pre>
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-2 right-2 h-6 w-6"
        onClick={() => copyToClipboard(code, id)}
      >
        {copiedCode === id ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      </Button>
    </div>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Code className="h-5 w-5" />
          Documentação da API
        </CardTitle>
        <CardDescription>
          Referência completa para integração com a API REST e Webhooks
        </CardDescription>
      </CardHeader>

      <CardContent>
        <Tabs defaultValue="quickstart" className="w-full">
          <TabsList className="w-full justify-start">
            <TabsTrigger value="quickstart">Quick Start</TabsTrigger>
            <TabsTrigger value="endpoints">Endpoints</TabsTrigger>
            <TabsTrigger value="webhooks">Webhooks</TabsTrigger>
            <TabsTrigger value="errors">Erros</TabsTrigger>
          </TabsList>

          {/* Quick Start Tab */}
          <TabsContent value="quickstart" className="mt-4 space-y-6">
            <div>
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Key className="h-4 w-4" />
                Autenticação
              </h3>
              <p className="text-sm text-muted-foreground mb-3">
                Todas as requisições devem incluir sua API Key no header:
              </p>
              <CodeBlock 
                code={`curl -X GET "${apiBaseUrl}/cards" \\
  -H "X-API-Key: lv_sua_api_key_aqui" \\
  -H "Content-Type: application/json"`}
                id="auth"
              />
            </div>

            <div>
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Zap className="h-4 w-4" />
                Exemplo Rápido
              </h3>
              <CodeBlock 
                code={`// Criar um card
const response = await fetch('${apiBaseUrl}/cards', {
  method: 'POST',
  headers: {
    'X-API-Key': 'lv_sua_api_key',
    'Content-Type': 'application/json',
    'Idempotency-Key': 'unique-request-id'
  },
  body: JSON.stringify({
    title: 'Nova tarefa',
    space_id: 'uuid-do-space',
    status: 'todo',
    urgency: 'normal'
  })
});

const { data } = await response.json();
console.log('Card criado:', data.id);`}
                id="quickstart"
              />
            </div>

            <div>
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Rate Limiting
              </h3>
              <p className="text-sm text-muted-foreground mb-2">
                Limite de <strong>100 requisições/minuto</strong> por API Key.
              </p>
              <div className="p-3 bg-muted rounded-lg text-sm">
                <p className="font-mono text-xs">X-RateLimit-Limit: 100</p>
                <p className="font-mono text-xs">X-RateLimit-Remaining: 95</p>
                <p className="font-mono text-xs">X-RateLimit-Reset: 1704067200000</p>
              </div>
            </div>

            <div>
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Idempotência
              </h3>
              <p className="text-sm text-muted-foreground mb-2">
                Para evitar duplicações, envie um header <code>Idempotency-Key</code> único em requisições POST/PUT/PATCH.
                Respostas são cacheadas por 24h.
              </p>
            </div>
          </TabsContent>

          {/* Endpoints Tab */}
          <TabsContent value="endpoints" className="mt-4">
            <ScrollArea className="h-[500px] pr-4">
              <div className="space-y-3">
                {endpoints.map((endpoint, idx) => (
                  <Collapsible key={idx}>
                    <CollapsibleTrigger className="w-full">
                      <div className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                        <div className="flex items-center gap-3">
                          <Badge className={methodColors[endpoint.method]}>
                            {endpoint.method}
                          </Badge>
                          <code className="text-sm font-mono">{endpoint.path}</code>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {endpoint.permission}
                          </Badge>
                          <ChevronDown className="h-4 w-4" />
                        </div>
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="p-4 border border-t-0 rounded-b-lg bg-muted/30 space-y-4">
                        <p className="text-sm">{endpoint.description}</p>
                        
                        {endpoint.parameters && endpoint.parameters.length > 0 && (
                          <div>
                            <h4 className="text-xs font-semibold mb-2 uppercase text-muted-foreground">Parâmetros</h4>
                            <div className="space-y-1">
                              {endpoint.parameters.map((param, pidx) => (
                                <div key={pidx} className="flex items-start gap-2 text-sm">
                                  <code className="px-1.5 py-0.5 bg-muted rounded text-xs">{param.name}</code>
                                  <span className="text-muted-foreground text-xs">{param.type}</span>
                                  {param.required && <Badge variant="destructive" className="text-[10px] h-4">required</Badge>}
                                  <span className="text-xs text-muted-foreground">- {param.description}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {endpoint.requestBody && endpoint.requestBody.length > 0 && (
                          <div>
                            <h4 className="text-xs font-semibold mb-2 uppercase text-muted-foreground">Body</h4>
                            <div className="space-y-1">
                              {endpoint.requestBody.map((field, fidx) => (
                                <div key={fidx} className="flex items-start gap-2 text-sm">
                                  <code className="px-1.5 py-0.5 bg-muted rounded text-xs">{field.field}</code>
                                  <span className="text-muted-foreground text-xs">{field.type}</span>
                                  {field.required && <Badge variant="destructive" className="text-[10px] h-4">required</Badge>}
                                  <span className="text-xs text-muted-foreground">- {field.description}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {endpoint.response && (
                          <div>
                            <h4 className="text-xs font-semibold mb-2 uppercase text-muted-foreground">Response</h4>
                            <CodeBlock code={endpoint.response} id={`endpoint-${idx}`} />
                          </div>
                        )}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>

          {/* Webhooks Tab */}
          <TabsContent value="webhooks" className="mt-4 space-y-6">
            <div>
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Webhook className="h-4 w-4" />
                Configuração de Webhooks
              </h3>
              <p className="text-sm text-muted-foreground mb-3">
                Configure endpoints para receber notificações em tempo real sobre eventos no workspace.
              </p>
            </div>

            <div>
              <h4 className="text-sm font-semibold mb-2">Verificação de Assinatura</h4>
              <CodeBlock 
                code={`const crypto = require('crypto');

function verifyWebhookSignature(payload, signature, secret) {
  const expectedSignature = 'sha256=' + 
    crypto.createHmac('sha256', secret)
      .update(payload)
      .digest('hex');
      
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

// No seu endpoint:
app.post('/webhook', (req, res) => {
  const signature = req.headers['x-webhook-signature'];
  const isValid = verifyWebhookSignature(
    JSON.stringify(req.body),
    signature,
    process.env.WEBHOOK_SECRET
  );
  
  if (!isValid) {
    return res.status(401).send('Invalid signature');
  }
  
  // Processar evento...
  res.status(200).send('OK');
});`}
                id="webhook-verify"
              />
            </div>

            <div>
              <h4 className="text-sm font-semibold mb-3">Eventos Disponíveis</h4>
              <ScrollArea className="h-[300px]">
                <div className="space-y-3">
                  {webhookEvents.map((event, idx) => (
                    <Collapsible key={idx}>
                      <CollapsibleTrigger className="w-full">
                        <div className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">{event.event}</Badge>
                            <span className="text-sm text-muted-foreground">{event.description}</span>
                          </div>
                          <ChevronDown className="h-4 w-4" />
                        </div>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="p-3 border border-t-0 rounded-b-lg">
                          <CodeBlock code={event.payload} id={`webhook-${idx}`} />
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </TabsContent>

          {/* Errors Tab */}
          <TabsContent value="errors" className="mt-4 space-y-4">
            <p className="text-sm text-muted-foreground">
              A API usa códigos HTTP padrão para indicar sucesso ou falha.
            </p>
            
            <div className="space-y-3">
              {[
                { code: 200, status: 'OK', description: 'Requisição bem-sucedida' },
                { code: 201, status: 'Created', description: 'Recurso criado com sucesso' },
                { code: 400, status: 'Bad Request', description: 'Parâmetros inválidos ou faltando' },
                { code: 401, status: 'Unauthorized', description: 'API Key inválida ou ausente' },
                { code: 403, status: 'Forbidden', description: 'Sem permissão para acessar o recurso' },
                { code: 404, status: 'Not Found', description: 'Recurso não encontrado' },
                { code: 429, status: 'Too Many Requests', description: 'Rate limit excedido' },
                { code: 500, status: 'Internal Error', description: 'Erro interno do servidor' }
              ].map((error, idx) => (
                <div key={idx} className="flex items-center gap-4 p-3 border rounded-lg">
                  <Badge 
                    variant={error.code >= 400 ? 'destructive' : 'default'}
                    className="font-mono"
                  >
                    {error.code}
                  </Badge>
                  <div>
                    <p className="font-medium text-sm">{error.status}</p>
                    <p className="text-xs text-muted-foreground">{error.description}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6">
              <h4 className="text-sm font-semibold mb-2">Formato de Erro</h4>
              <CodeBlock 
                code={`{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Campo 'title' é obrigatório",
    "details": {
      "field": "title",
      "constraint": "required"
    }
  },
  "request_id": "req_abc123"
}`}
                id="error-format"
              />
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};
