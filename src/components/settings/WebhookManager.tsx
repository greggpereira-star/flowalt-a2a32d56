import React, { useState } from 'react';
import { useWebhooks, useCreateWebhook, useUpdateWebhook, useDeleteWebhook, useWebhookDeliveries, useResendWebhook, WEBHOOK_EVENTS } from '@/hooks/useWebhooks';
import { useEntitlementRegistry } from '@/hooks/useEntitlementRegistry';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Webhook, Plus, Trash2, RefreshCw, Eye, Copy, CheckCircle2, XCircle, Clock, AlertTriangle, Lock } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { useWorkspace } from '@/contexts/WorkspaceContext';

export function WebhookManager() {
  const { data: webhooks, isLoading } = useWebhooks();
  const createWebhook = useCreateWebhook();
  const updateWebhook = useUpdateWebhook();
  const deleteWebhook = useDeleteWebhook();
  const resendWebhook = useResendWebhook();
  const { toast } = useToast();
  const { currentRole } = useWorkspace();
  
  const { within, explain, has } = useEntitlementRegistry();
  const canCreateWebhook = within('webhooks_limit') && has('integrations_access');
  const explanation = explain('webhooks_limit');
  const isAdmin = currentRole === 'owner' || currentRole === 'admin';

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newWebhookName, setNewWebhookName] = useState('');
  const [newWebhookUrl, setNewWebhookUrl] = useState('');
  const [newWebhookEvents, setNewWebhookEvents] = useState<string[]>(['card.created']);
  
  const [selectedWebhookId, setSelectedWebhookId] = useState<string | null>(null);
  const [showSecret, setShowSecret] = useState<string | null>(null);

  const { data: deliveries, isLoading: isLoadingDeliveries } = useWebhookDeliveries(selectedWebhookId);

  const handleCreate = async () => {
    await createWebhook.mutateAsync({
      name: newWebhookName,
      url: newWebhookUrl,
      events: newWebhookEvents,
    });
    setNewWebhookName('');
    setNewWebhookUrl('');
    setNewWebhookEvents(['card.created']);
    setIsCreateOpen(false);
  };

  const toggleEvent = (event: string) => {
    setNewWebhookEvents(prev =>
      prev.includes(event)
        ? prev.filter(e => e !== event)
        : [...prev, event]
    );
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Copiado para a área de transferência' });
  };

  const getStatusIcon = (status: number | null) => {
    if (status === null) return <Clock className="h-4 w-4 text-muted-foreground" />;
    if (status >= 200 && status < 300) return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    return <XCircle className="h-4 w-4 text-destructive" />;
  };

  const selectedWebhook = webhooks?.find(w => w.id === selectedWebhookId);

  if (isLoading) {
    return <div className="animate-pulse h-40 bg-muted rounded-lg" />;
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Webhook className="h-5 w-5" />
                Webhooks
              </CardTitle>
              <CardDescription>
                Configure endpoints para receber eventos em tempo real
              </CardDescription>
            </div>
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger asChild>
                <Button size="sm" disabled={!canCreateWebhook}>
                  <Plus className="h-4 w-4 mr-2" />
                  Novo Webhook
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Criar Webhook</DialogTitle>
                </DialogHeader>

                {/* Limit warning */}
                {!canCreateWebhook && explanation.reason_code !== 'OK' && (
                  <div className="p-4 rounded-lg border border-warning bg-warning/10">
                    <div className="flex items-center gap-2 text-warning-foreground">
                      {explanation.reason_code === 'DISABLED' ? (
                        <Lock className="h-4 w-4" />
                      ) : (
                        <AlertTriangle className="h-4 w-4" />
                      )}
                      <span className="font-medium">{explanation.message}</span>
                    </div>
                    {explanation.cta && isAdmin && (
                      <p className="text-sm text-muted-foreground mt-1">{explanation.cta}</p>
                    )}
                    {explanation.limit && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {explanation.current}/{explanation.limit} Webhooks utilizados
                      </p>
                    )}
                  </div>
                )}
                {canCreateWebhook && (
                  <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="webhook-name">Nome</Label>
                    <Input
                      id="webhook-name"
                      placeholder="Ex: Notificações Slack"
                      value={newWebhookName}
                      onChange={(e) => setNewWebhookName(e.target.value)}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="webhook-url">URL do Endpoint</Label>
                    <Input
                      id="webhook-url"
                      placeholder="https://exemplo.com/webhook"
                      value={newWebhookUrl}
                      onChange={(e) => setNewWebhookUrl(e.target.value)}
                    />
                  </div>
                  
                  <div className="space-y-3">
                    <Label>Eventos</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {WEBHOOK_EVENTS.map((event) => (
                        <div key={event.value} className="flex items-center space-x-2">
                          <Checkbox
                            id={`event-${event.value}`}
                            checked={newWebhookEvents.includes(event.value)}
                            onCheckedChange={() => toggleEvent(event.value)}
                          />
                          <Label htmlFor={`event-${event.value}`} className="text-sm">
                            {event.label}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>

                  <Button
                    onClick={handleCreate}
                    disabled={!newWebhookName || !newWebhookUrl || newWebhookEvents.length === 0 || createWebhook.isPending}
                    className="w-full"
                  >
                    {createWebhook.isPending ? 'Criando...' : 'Criar Webhook'}
                  </Button>
                  </div>
                )}
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {webhooks?.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Nenhum webhook configurado ainda
            </p>
          ) : (
            <div className="space-y-3">
              {webhooks?.map((webhook) => (
                <div
                  key={webhook.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="space-y-1 flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{webhook.name}</span>
                      {!webhook.is_active && (
                        <Badge variant="secondary">Inativo</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {webhook.url}
                    </p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {webhook.events.map((event) => (
                        <Badge key={event} variant="outline" className="text-xs">
                          {WEBHOOK_EVENTS.find(e => e.value === event)?.label || event}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 ml-4">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        if (showSecret === webhook.id) {
                          setShowSecret(null);
                        } else {
                          setShowSecret(webhook.id);
                          copyToClipboard(webhook.secret);
                        }
                      }}
                      title="Copiar secret"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setSelectedWebhookId(webhook.id)}
                      title="Ver entregas"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    
                    <Switch
                      checked={webhook.is_active}
                      onCheckedChange={(checked) =>
                        updateWebhook.mutate({ id: webhook.id, is_active: checked })
                      }
                    />
                    
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Excluir Webhook</AlertDialogTitle>
                          <AlertDialogDescription>
                            Tem certeza que deseja excluir o webhook "{webhook.name}"? 
                            O endpoint deixará de receber eventos.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteWebhook.mutate(webhook.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Excluir
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Sheet open={!!selectedWebhookId} onOpenChange={(open) => !open && setSelectedWebhookId(null)}>
        <SheetContent className="w-full sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>Entregas - {selectedWebhook?.name}</SheetTitle>
          </SheetHeader>
          
          <div className="mt-4">
            {isLoadingDeliveries ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="animate-pulse h-16 bg-muted rounded-lg" />
                ))}
              </div>
            ) : deliveries?.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Nenhuma entrega registrada ainda
              </p>
            ) : (
              <ScrollArea className="h-[calc(100vh-10rem)]">
                <div className="space-y-2 pr-4">
                  {deliveries?.map((delivery) => (
                    <div
                      key={delivery.id}
                      className="p-3 border rounded-lg space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(delivery.response_status)}
                          <Badge variant="outline" className="text-xs">
                            {delivery.event_type}
                          </Badge>
                          {delivery.response_status !== null && (
                            <span className="text-xs text-muted-foreground">
                              HTTP {delivery.response_status}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(delivery.created_at), "dd/MM HH:mm:ss", { locale: ptBR })}
                          </span>
                          {(delivery.response_status === null || delivery.response_status >= 400) && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => resendWebhook.mutate(delivery.id)}
                              disabled={resendWebhook.isPending}
                            >
                              <RefreshCw className={`h-3 w-3 ${resendWebhook.isPending ? 'animate-spin' : ''}`} />
                            </Button>
                          )}
                        </div>
                      </div>
                      {delivery.retry_count > 0 && (
                        <p className="text-xs text-muted-foreground">
                          Tentativas: {delivery.retry_count}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
