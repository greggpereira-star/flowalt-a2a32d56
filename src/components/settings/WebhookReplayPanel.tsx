import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { 
  RefreshCw, 
  Play, 
  Calendar as CalendarIcon,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Loader2,
  RotateCcw,
  Filter,
  Trash2
} from 'lucide-react';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from '@/hooks/use-toast';

interface FailedDelivery {
  id: string;
  subscription_id: string;
  event_type: string;
  payload: Record<string, unknown>;
  response_status: number | null;
  response_body: string | null;
  retry_count: number;
  created_at: string;
  next_retry_at: string | null;
  subscription?: {
    id: string;
    name: string;
    url: string;
    secret: string;
    is_active: boolean;
  };
}

export function WebhookReplayPanel() {
  const { currentWorkspace } = useWorkspace();
  const queryClient = useQueryClient();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isReplaying, setIsReplaying] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<'replay' | 'clear' | null>(null);
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: subDays(new Date(), 7),
    to: new Date(),
  });
  const [statusFilter, setStatusFilter] = useState<string>('__all__');

  const { data: failedDeliveries, isLoading, refetch } = useQuery({
    queryKey: ['failed-deliveries', currentWorkspace?.id, dateRange],
    queryFn: async () => {
      if (!currentWorkspace?.id) return [];

      const { data: subscriptions } = await supabase
        .from('webhook_subscriptions')
        .select('id, name, url, secret, is_active')
        .eq('workspace_id', currentWorkspace.id);

      if (!subscriptions?.length) return [];

      const subscriptionIds = subscriptions.map(s => s.id);
      const subscriptionMap = new Map(subscriptions.map(s => [s.id, s]));

      let query = supabase
        .from('webhook_deliveries')
        .select('*')
        .in('subscription_id', subscriptionIds)
        .or('response_status.is.null,response_status.gte.400')
        .order('created_at', { ascending: false })
        .limit(500);

      if (dateRange.from) {
        query = query.gte('created_at', startOfDay(dateRange.from).toISOString());
      }
      if (dateRange.to) {
        query = query.lte('created_at', endOfDay(dateRange.to).toISOString());
      }

      const { data, error } = await query;

      if (error) throw error;

      return (data || []).map(d => ({
        ...d,
        subscription: subscriptionMap.get(d.subscription_id),
      })) as FailedDelivery[];
    },
    enabled: !!currentWorkspace?.id,
  });

  const filteredDeliveries = useMemo(() => {
    if (!failedDeliveries) return [];
    if (statusFilter === '__all__') return failedDeliveries;
    if (statusFilter === 'pending') return failedDeliveries.filter(d => d.response_status === null);
    if (statusFilter === 'failed') return failedDeliveries.filter(d => d.response_status !== null && d.response_status >= 400);
    return failedDeliveries;
  }, [failedDeliveries, statusFilter]);

  const toggleSelection = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredDeliveries.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredDeliveries.map(d => d.id)));
    }
  };

  const replayDeliveries = async (ids: string[]) => {
    setIsReplaying(true);
    let successCount = 0;
    let failCount = 0;

    for (const id of ids) {
      const delivery = failedDeliveries?.find(d => d.id === id);
      if (!delivery?.subscription) continue;

      try {
        // Generate HMAC signature
        const payloadString = JSON.stringify(delivery.payload);
        const encoder = new TextEncoder();
        const key = await crypto.subtle.importKey(
          'raw',
          encoder.encode(delivery.subscription.secret),
          { name: 'HMAC', hash: 'SHA-256' },
          false,
          ['sign']
        );
        const signature = await crypto.subtle.sign(
          'HMAC',
          key,
          encoder.encode(payloadString)
        );
        const signatureHex = Array.from(new Uint8Array(signature))
          .map(b => b.toString(16).padStart(2, '0'))
          .join('');

        // Send webhook
        const response = await fetch(delivery.subscription.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Webhook-Signature': `sha256=${signatureHex}`,
            'X-Webhook-Event': delivery.event_type,
            'X-Webhook-Replay': 'true',
          },
          body: payloadString,
        });

        const responseBody = await response.text().catch(() => '');

        // Update delivery record
        await supabase
          .from('webhook_deliveries')
          .update({
            response_status: response.status,
            response_body: responseBody.substring(0, 1000),
            retry_count: delivery.retry_count + 1,
            delivered_at: response.ok ? new Date().toISOString() : null,
          })
          .eq('id', id);

        if (response.ok) {
          successCount++;
        } else {
          failCount++;
        }
      } catch (error) {
        failCount++;
        console.error('Replay error:', error);
      }
    }

    setIsReplaying(false);
    setSelectedIds(new Set());
    refetch();

    toast({
      title: 'Replay concluído',
      description: `${successCount} sucesso, ${failCount} falha(s)`,
    });
  };

  const clearDLQ = async () => {
    const idsToDelete = Array.from(selectedIds);
    
    await supabase
      .from('webhook_deliveries')
      .delete()
      .in('id', idsToDelete);

    setSelectedIds(new Set());
    setConfirmDialog(null);
    refetch();

    toast({
      title: 'Entregas removidas',
      description: `${idsToDelete.length} entrega(s) removida(s) da fila`,
    });
  };

  const getStatusBadge = (status: number | null, retryCount: number) => {
    if (status === null) {
      return (
        <Badge variant="secondary" className="gap-1">
          <Loader2 className="h-3 w-3 animate-spin" />
          Pendente
        </Badge>
      );
    }
    return (
      <Badge variant="destructive" className="gap-1">
        <XCircle className="h-3 w-3" />
        {status} ({retryCount} tentativas)
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="animate-pulse h-20 bg-muted rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <RotateCcw className="h-5 w-5 text-primary" />
              <div>
                <CardTitle>Dead Letter Queue (DLQ)</CardTitle>
                <CardDescription>
                  Gerencie e reenvie webhooks que falharam
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-3">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todos</SelectItem>
                <SelectItem value="pending">Pendente</SelectItem>
                <SelectItem value="failed">Falhou</SelectItem>
              </SelectContent>
            </Select>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <CalendarIcon className="h-4 w-4" />
                  {dateRange.from && dateRange.to ? (
                    `${format(dateRange.from, 'dd/MM')} - ${format(dateRange.to, 'dd/MM')}`
                  ) : (
                    'Período'
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="range"
                  selected={{ from: dateRange.from, to: dateRange.to }}
                  onSelect={(range) => setDateRange({ from: range?.from, to: range?.to })}
                  numberOfMonths={2}
                  locale={ptBR}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Bulk Actions */}
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-3 p-3 bg-primary/5 rounded-lg">
              <span className="text-sm font-medium">
                {selectedIds.size} selecionado(s)
              </span>
              <div className="flex-1" />
              <Button
                size="sm"
                variant="outline"
                onClick={() => setConfirmDialog('replay')}
                disabled={isReplaying}
              >
                {isReplaying ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Play className="h-4 w-4 mr-2" />
                )}
                Reenviar
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => setConfirmDialog('clear')}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Remover
              </Button>
            </div>
          )}

          {/* Stats */}
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span>{filteredDeliveries.length} entregas na fila</span>
          </div>
        </CardContent>
      </Card>

      {/* DLQ List */}
      <Card>
        <CardContent className="p-0">
          {filteredDeliveries.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <CheckCircle2 className="h-12 w-12 mx-auto mb-3 text-green-500 opacity-50" />
              <p>Nenhuma entrega pendente ou com falha</p>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="flex items-center gap-3 p-4 border-b bg-muted/50">
                <Checkbox
                  checked={selectedIds.size === filteredDeliveries.length && filteredDeliveries.length > 0}
                  onCheckedChange={toggleSelectAll}
                />
                <span className="text-sm font-medium">Selecionar todos</span>
              </div>

              <ScrollArea className="h-[400px]">
                <div className="divide-y">
                  {filteredDeliveries.map((delivery) => (
                    <div
                      key={delivery.id}
                      className={`flex items-start gap-4 p-4 hover:bg-muted/50 transition-colors ${
                        selectedIds.has(delivery.id) ? 'bg-primary/5' : ''
                      }`}
                    >
                      <Checkbox
                        checked={selectedIds.has(delivery.id)}
                        onCheckedChange={() => toggleSelection(delivery.id)}
                        disabled={!delivery.subscription?.is_active}
                      />
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className="font-mono text-xs">
                            {delivery.event_type}
                          </Badge>
                          {getStatusBadge(delivery.response_status, delivery.retry_count)}
                          {!delivery.subscription?.is_active && (
                            <Badge variant="secondary">Webhook inativo</Badge>
                          )}
                        </div>
                        
                        <div className="mt-2 space-y-1">
                          <p className="text-sm">
                            <span className="text-muted-foreground">Destino:</span>{' '}
                            <span className="font-mono text-xs">{delivery.subscription?.name}</span>
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Criado em: {format(new Date(delivery.created_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                          </p>
                          {delivery.next_retry_at && (
                            <p className="text-xs text-muted-foreground">
                              Próxima tentativa: {format(new Date(delivery.next_retry_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                            </p>
                          )}
                        </div>

                        {delivery.response_body && (
                          <pre className="mt-2 text-xs bg-muted p-2 rounded overflow-x-auto max-h-20">
                            {delivery.response_body.substring(0, 200)}
                          </pre>
                        )}
                      </div>

                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => replayDeliveries([delivery.id])}
                        disabled={isReplaying || !delivery.subscription?.is_active}
                      >
                        <Play className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </>
          )}
        </CardContent>
      </Card>

      {/* Confirm Dialogs */}
      <AlertDialog open={confirmDialog === 'replay'} onOpenChange={() => setConfirmDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Reenvio</AlertDialogTitle>
            <AlertDialogDescription>
              Você está prestes a reenviar {selectedIds.size} webhook(s). 
              Isso irá tentar entregar novamente os payloads selecionados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              setConfirmDialog(null);
              replayDeliveries(Array.from(selectedIds));
            }}>
              Reenviar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmDialog === 'clear'} onOpenChange={() => setConfirmDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Remoção</AlertDialogTitle>
            <AlertDialogDescription>
              Você está prestes a remover {selectedIds.size} entrega(s) da fila. 
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={clearDLQ} className="bg-destructive text-destructive-foreground">
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
