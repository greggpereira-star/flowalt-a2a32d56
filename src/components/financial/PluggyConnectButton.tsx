import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Loader2, Unlink, Building2, RefreshCw, Plus, CheckCircle2, AlertCircle, ExternalLink } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { toast } from 'sonner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface PluggyItem {
  id: string;
  pluggy_item_id: string;
  connector_name: string;
  status: string;
  connected_at: string;
}


export function PluggyConnectButton() {
  const { currentWorkspace } = useWorkspace();
  const queryClient = useQueryClient();
  const [isConnecting, setIsConnecting] = useState(false);
  const [isEmbedded, setIsEmbedded] = useState(false);

  useEffect(() => {
    try {
      setIsEmbedded(window.self !== window.top);
    } catch {
      setIsEmbedded(true);
    }
  }, []);

  const openAppInNewTab = useCallback(() => {
    window.open(window.location.href, '_blank', 'noopener,noreferrer');
  }, []);


  // Fetch connected items
  const { data: connectedItems, isLoading: isLoadingItems, refetch: refetchItems } = useQuery({
    queryKey: ['pluggy-items', currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace?.id) return [];

      const { data, error } = await supabase.functions.invoke('integration-manager', {
        body: {
          action: 'pluggy_list_items',
          workspace_id: currentWorkspace.id,
        },
      });

      if (error) throw error;
      return (data?.items || []) as PluggyItem[];
    },
    enabled: !!currentWorkspace?.id,
  });

  // Delete item mutation
  const deleteItemMutation = useMutation({
    mutationFn: async (itemId: string) => {
      if (!currentWorkspace?.id) throw new Error('Workspace não selecionado');

      const { data, error } = await supabase.functions.invoke('integration-manager', {
        body: {
          action: 'pluggy_delete_item',
          workspace_id: currentWorkspace.id,
          item_id: itemId,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pluggy-items'] });
      queryClient.invalidateQueries({ queryKey: ['dda-sync-status'] });
      toast.success('Conexão bancária removida');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao remover conexão');
    },
  });

  // Open Pluggy Connect widget
  const openPluggyConnect = useCallback(async () => {
    if (!currentWorkspace?.id) {
      toast.error('Workspace não selecionado');
      return;
    }

    // O widget costuma falhar dentro de previews embutidos (iframes)
    if (isEmbedded) {
      toast.error('Abra o app em uma nova aba para conectar sua conta.');
      openAppInNewTab();
      return;
    }

    setIsConnecting(true);

    try {
      // Get connect token from backend
      const { data, error } = await supabase.functions.invoke('integration-manager', {
        body: {
          action: 'pluggy_connect_token',
          workspace_id: currentWorkspace.id,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const connectToken = data.accessToken as string | undefined;
      if (!connectToken) throw new Error('Token de conexão não recebido');

      const { PluggyConnect } = await import('pluggy-connect-sdk');

      const pluggyConnect = new PluggyConnect({
        connectToken,
        includeSandbox: false,
        language: 'pt',
        theme: 'light',
        countries: ['BR'],
        onSuccess: async (itemData: { item: { id: string; connector?: { name?: string } } }) => {
          try {
            const { error: saveError } = await supabase.functions.invoke('integration-manager', {
              body: {
                action: 'pluggy_save_item',
                workspace_id: currentWorkspace.id,
                item_id: itemData.item.id,
                connector_name: itemData.item.connector?.name,
              },
            });

            if (saveError) throw saveError;

            queryClient.invalidateQueries({ queryKey: ['pluggy-items'] });
            queryClient.invalidateQueries({ queryKey: ['dda-sync-status'] });
            toast.success('Conta bancária conectada com sucesso!');
          } catch (err) {
            console.error('Error saving Pluggy item:', err);
            toast.error('Erro ao salvar conexão bancária');
          } finally {
            setIsConnecting(false);
          }
        },
        onError: (error: { message?: string }) => {
          console.error('Pluggy Connect error:', error);
          toast.error(error.message || 'Erro ao conectar conta bancária');
          setIsConnecting(false);
        },
        onClose: () => {
          setIsConnecting(false);
          refetchItems();
        },
      });

      pluggyConnect.init();
    } catch (err) {
      console.error('Error opening Pluggy Connect:', err);
      toast.error(err instanceof Error ? err.message : 'Erro ao abrir conexão bancária');
      setIsConnecting(false);
    }
  }, [currentWorkspace?.id, isEmbedded, openAppInNewTab, queryClient, refetchItems]);

  const hasConnectedAccounts = (connectedItems?.length || 0) > 0;

  return (
    <Card className="border-dashed">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-base">Contas Bancárias</CardTitle>
          </div>
          <Badge variant={hasConnectedAccounts ? 'default' : 'secondary'}>
            {hasConnectedAccounts ? `${connectedItems?.length} conectada(s)` : 'Nenhuma'}
          </Badge>
        </div>
        <CardDescription>
          Conecte suas contas bancárias para sincronizar boletos DDA automaticamente
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {isEmbedded && (
          <div className="rounded-lg border bg-muted/40 p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <p className="text-sm font-medium">Conexão bancária bloqueada no preview</p>
                <p className="text-xs text-muted-foreground">
                  Abra o app em uma nova aba (fora do iframe) para conectar. Domínio atual:{' '}
                  <span className="font-mono">{window.location.origin}</span>
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={openAppInNewTab}>
                <ExternalLink className="mr-2 h-4 w-4" />
                Abrir
              </Button>
            </div>
          </div>
        )}

        {isLoadingItems ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* Connected accounts list */}
            {connectedItems && connectedItems.length > 0 && (
              <div className="space-y-2">
                {connectedItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between rounded-lg border bg-card p-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                        <Building2 className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{item.connector_name}</p>
                        <p className="text-xs text-muted-foreground">
                          Conectado em {new Date(item.connected_at).toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        <CheckCircle2 className="mr-1 h-3 w-3 text-green-500" />
                        Ativo
                      </Badge>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <Unlink className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Desconectar conta bancária?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Ao desconectar, você não receberá mais boletos desta conta. 
                              Os boletos já sincronizados serão mantidos.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteItemMutation.mutate(item.pluggy_item_id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Desconectar
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Empty state */}
            {(!connectedItems || connectedItems.length === 0) && (
              <div className="flex flex-col items-center justify-center py-6 text-center">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                  <AlertCircle className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground">
                  Nenhuma conta bancária conectada
                </p>
                <p className="text-xs text-muted-foreground">
                  Conecte uma conta para sincronizar boletos DDA
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <Button
                onClick={openPluggyConnect}
                disabled={isConnecting}
                className="flex-1"
              >
                {isConnecting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Conectando...
                  </>
                ) : (
                  <>
                    <Plus className="mr-2 h-4 w-4" />
                    Conectar Conta
                  </>
                )}
              </Button>
              {hasConnectedAccounts && (
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => refetchItems()}
                  disabled={isLoadingItems}
                >
                  <RefreshCw className={`h-4 w-4 ${isLoadingItems ? 'animate-spin' : ''}`} />
                </Button>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}