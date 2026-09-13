import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Building2, 
  AlertTriangle, 
  TrendingUp, 
  TrendingDown,
  ChevronRight,
  Activity
} from 'lucide-react';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { useClientsHealth } from '@/hooks/useClientsHealth';
import { usePermissions } from '@/hooks/usePermissions';
import type { Database } from '@/integrations/supabase/types';

type ClientFinancialState = Database['public']['Enums']['client_financial_state'];

interface ClientSummary {
  id: string;
  name: string;
  color: string | null;
  logo_url: string | null;
  health_score: number;
  financial_state: ClientFinancialState;
  status: string;
}

const financialStateConfig: Record<ClientFinancialState, { label: string; color: string; bgColor: string }> = {
  healthy: { label: 'Saudável', color: 'text-green-600', bgColor: 'bg-green-100 dark:bg-green-900/30' },
  attention: { label: 'Atenção', color: 'text-amber-600', bgColor: 'bg-amber-100 dark:bg-amber-900/30' },
  critical: { label: 'Crítico', color: 'text-red-600', bgColor: 'bg-red-100 dark:bg-red-900/30' },
  loss: { label: 'Prejuízo', color: 'text-red-800', bgColor: 'bg-red-200 dark:bg-red-900/50' },
};

export const ClientHealthWidget: React.FC = () => {
  const navigate = useNavigate();
  const { currentWorkspace } = useWorkspace();

  const { canViewClientFinancials } = usePermissions();
  const { data: health, isLoading: isLoadingHealth } = useClientsHealth();

  const { data: rawClients, isLoading: isLoadingClients } = useQuery({
    queryKey: ['dashboard-client-health', currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace?.id) return [];

      // Sem `order`/`limit` no banco: ordenar por health_score no Postgres
      // ordenava pela coluna cacheada, que ficava em 100 (o DEFAULT) para todo
      // cliente cujo relatório ninguém abriu — o dashboard destacava como mais
      // saudável justamente quem nunca foi medido. A ordenação agora é feita
      // sobre o score calculado, depois de recebê-lo.
      const { data, error } = await supabase
        .from('client_cards')
        .select('id, name, color, logo_url, status')
        .eq('workspace_id', currentWorkspace.id)
        .eq('status', 'active');

      if (error) throw error;
      return data;
    },
    enabled: !!currentWorkspace?.id,
  });

  const isLoading = isLoadingClients || isLoadingHealth;

  const clients: ClientSummary[] | undefined = useMemo(() => {
    if (!rawClients) return undefined;
    return rawClients
      .map(c => {
        const h = health?.get(c.id);
        return {
          ...c,
          health_score: h?.healthScore ?? 0,
          financial_state: (h?.financialState ?? 'critical') as ClientFinancialState,
        };
      })
      .sort((a, b) => a.health_score - b.health_score)
      .slice(0, 10);
  }, [rawClients, health]);

  // Depois dos hooks, nunca antes: o widget inteiro é leitura financeira —
  // score e semáforo saem de receita, custo e margem. Quem não pode ver
  // `transactions` não tem o que ver aqui. Antes exibíamos a coluna cacheada,
  // que era um número financeiro mostrado a quem não tem acesso a finanças,
  // além de desatualizado.
  if (!canViewClientFinancials) return null;

  if (isLoading) {
    return (
      <Card className="min-w-0">
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-14" />
          ))}
        </CardContent>
      </Card>
    );
  }

  const criticalClients = clients?.filter(c => 
    c.financial_state === 'critical' || c.financial_state === 'loss'
  ) || [];
  
  const attentionClients = clients?.filter(c => 
    c.financial_state === 'attention'
  ) || [];
  
  const healthyClients = clients?.filter(c => 
    c.financial_state === 'healthy'
  ) || [];

  const avgHealthScore = clients?.length 
    ? Math.round(clients.reduce((acc, c) => acc + (c.health_score || 0), 0) / clients.length)
    : 0;

  return (
    <Card className="min-w-0">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="min-w-0 text-base font-medium flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            Saúde dos Clientes
          </CardTitle>
          <Button 
            variant="ghost" 
            size="sm" 
            className="shrink-0 text-xs"
            onClick={() => navigate('/clients')}
          >
            Ver todos
            <ChevronRight className="h-3 w-3 ml-1" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-2">
          <div className="text-center p-2 rounded-lg bg-green-50 dark:bg-green-900/20">
            <p className="text-lg font-bold text-green-600">{healthyClients.length}</p>
            <p className="text-[10px] text-muted-foreground">Saudáveis</p>
          </div>
          <div className="text-center p-2 rounded-lg bg-amber-50 dark:bg-amber-900/20">
            <p className="text-lg font-bold text-amber-600">{attentionClients.length}</p>
            <p className="text-[10px] text-muted-foreground">Atenção</p>
          </div>
          <div className="text-center p-2 rounded-lg bg-red-50 dark:bg-red-900/20">
            <p className="text-lg font-bold text-red-600">{criticalClients.length}</p>
            <p className="text-[10px] text-muted-foreground">Críticos</p>
          </div>
        </div>

        {/* Average Health Score */}
        <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
          <div className={cn(
            'w-12 h-12 rounded-full flex items-center justify-center text-white font-bold',
            avgHealthScore >= 80 ? 'bg-green-500' :
            avgHealthScore >= 60 ? 'bg-amber-500' :
            avgHealthScore >= 40 ? 'bg-orange-500' : 'bg-red-500'
          )}>
            {avgHealthScore}
          </div>
          <div>
            <p className="text-sm font-medium">Score Médio</p>
            <p className="text-xs text-muted-foreground">
              {clients?.length || 0} clientes ativos
            </p>
          </div>
        </div>

        {/* Critical Clients Alert */}
        {criticalClients.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-destructive">
              <AlertTriangle className="h-4 w-4" />
              Atenção Imediata
            </div>
            <div className="space-y-2">
              {criticalClients.slice(0, 3).map((client) => {
                const stateConfig = financialStateConfig[client.financial_state];
                return (
                  <div 
                    key={client.id}
                    className="flex items-center gap-3 p-2 rounded-lg border bg-card hover:bg-accent cursor-pointer transition-colors"
                    onClick={() => navigate(`/clients/${client.id}`)}
                  >
                    <div 
                      className="w-8 h-8 rounded-md flex items-center justify-center text-white font-bold text-sm shrink-0"
                      style={{ backgroundColor: client.color || '#6366f1' }}
                    >
                      {client.logo_url ? (
                        <img src={client.logo_url} alt={client.name} className="w-full h-full object-cover rounded-md" />
                      ) : (
                        client.name.charAt(0).toUpperCase()
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{client.name}</p>
                      {/* Selo e score exigiam largura fixa numa linha sem
                          quebra: o conteudo esticava o card inteiro ate 584px
                          numa tela de 375px. Agora eles quebram para a linha
                          de baixo em vez de empurrar o card. */}
                      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
                        <Badge variant="outline" className={cn('shrink-0 text-[10px] px-1', stateConfig.color, stateConfig.bgColor)}>
                          {stateConfig.label}
                        </Badge>
                        <span className="shrink-0 text-[10px] text-muted-foreground">
                          Score: {client.health_score}
                        </span>
                      </div>
                    </div>
                    <TrendingDown className="h-4 w-4 text-destructive shrink-0" />
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* No clients message */}
        {(!clients || clients.length === 0) && (
          <div className="text-center py-6">
            <Building2 className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Nenhum cliente ativo</p>
            <Button 
              variant="outline" 
              size="sm" 
              className="mt-2"
              onClick={() => navigate('/clients')}
            >
              Adicionar Cliente
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
