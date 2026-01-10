import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calculator, FileText, Clock, AlertTriangle, ArrowRight, CheckCircle2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface AltControlPendingWidgetProps {
  variant?: 'approver' | 'seller' | 'combined';
}

export const AltControlPendingWidget: React.FC<AltControlPendingWidgetProps> = ({ 
  variant = 'combined' 
}) => {
  const navigate = useNavigate();
  const { currentWorkspace } = useWorkspace();
  const { user } = useAuth();

  // Buscar propostas pendentes de aprovação (para aprovadores)
  const { data: pendingApprovals } = useQuery({
    queryKey: ['altcontrol-pending-approvals', currentWorkspace?.id, user?.id],
    queryFn: async () => {
      if (!currentWorkspace?.id || !user?.id) return [];

      // Verificar se usuário é aprovador
      const { data: approverData } = await supabase
        .from('altcontrol_approvers')
        .select('id')
        .eq('workspace_id', currentWorkspace.id)
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle();

      if (!approverData) return [];

      // Buscar propostas em análise
      const { data } = await supabase
        .from('altcontrol_proposals')
        .select(`
          id,
          client_name,
          total_hours,
          final_price,
          submitted_at,
          calculated_level:altcontrol_levels(name)
        `)
        .eq('workspace_id', currentWorkspace.id)
        .eq('status', 'pending_approval')
        .order('submitted_at', { ascending: true })
        .limit(5);

      return data || [];
    },
    enabled: !!currentWorkspace?.id && !!user?.id && (variant === 'approver' || variant === 'combined'),
  });

  // Buscar propostas do vendedor que precisam de atenção
  const { data: sellerProposals } = useQuery({
    queryKey: ['altcontrol-seller-proposals', currentWorkspace?.id, user?.id],
    queryFn: async () => {
      if (!currentWorkspace?.id || !user?.id) return { needsAdjustment: [], inAnalysis: [] };

      // Propostas que requerem ajustes
      const { data: needsAdjustment } = await supabase
        .from('altcontrol_proposals')
        .select(`
          id,
          client_name,
          total_hours,
          approval_comment,
          updated_at
        `)
        .eq('workspace_id', currentWorkspace.id)
        .eq('seller_id', user.id)
        .eq('status', 'needs_adjustment')
        .order('updated_at', { ascending: false })
        .limit(3);

      // Propostas em análise
      const { data: inAnalysis } = await supabase
        .from('altcontrol_proposals')
        .select(`
          id,
          client_name,
          submitted_at
        `)
        .eq('workspace_id', currentWorkspace.id)
        .eq('seller_id', user.id)
        .eq('status', 'pending_approval')
        .order('submitted_at', { ascending: false })
        .limit(3);

      return {
        needsAdjustment: needsAdjustment || [],
        inAnalysis: inAnalysis || [],
      };
    },
    enabled: !!currentWorkspace?.id && !!user?.id && (variant === 'seller' || variant === 'combined'),
  });

  const hasApprovalsPending = (pendingApprovals?.length || 0) > 0;
  const hasNeedsAdjustment = (sellerProposals?.needsAdjustment?.length || 0) > 0;
  const hasInAnalysis = (sellerProposals?.inAnalysis?.length || 0) > 0;
  const hasPendingItems = hasApprovalsPending || hasNeedsAdjustment || hasInAnalysis;

  if (!hasPendingItems) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            AltControl
          </CardTitle>
          <CardDescription>Propostas e aprovações comerciais</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <div className="mb-3 rounded-full bg-muted p-3">
              <CheckCircle2 className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="mb-1 text-sm font-medium">Tudo em dia!</p>
            <p className="mb-3 text-xs text-muted-foreground">Nenhuma pendência no momento.</p>
            <Button variant="outline" size="sm" onClick={() => navigate('/altcontrol')}>
              Ver Propostas
              <ArrowRight className="ml-2 h-3 w-3" />
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5 text-primary" />
            AltControl
          </CardTitle>
          {hasPendingItems && (
            <Badge variant="destructive" className="animate-pulse">
              {(pendingApprovals?.length || 0) + (sellerProposals?.needsAdjustment?.length || 0)} pendência(s)
            </Badge>
          )}
        </div>
        <CardDescription>Propostas e aprovações comerciais</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Aprovações pendentes (para aprovadores) */}
        {hasApprovalsPending && (
          <div>
            <div className="mb-2 flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-500" />
              <span className="text-sm font-medium">Aguardando sua aprovação</span>
            </div>
            <div className="space-y-2">
              {pendingApprovals?.slice(0, 3).map((proposal: any) => (
                <div
                  key={proposal.id}
                  className="flex cursor-pointer items-center justify-between rounded-lg border bg-card p-2 transition-colors hover:bg-accent"
                  onClick={() => navigate(`/altcontrol/approvals/${proposal.id}`)}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{proposal.client_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {proposal.calculated_level?.name || 'N/A'} • {proposal.total_hours}h
                    </p>
                  </div>
                  <div className="ml-2 text-right">
                    <p className="text-sm font-semibold text-primary">
                      {proposal.final_price?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) || '-'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {proposal.submitted_at && formatDistanceToNow(new Date(proposal.submitted_at), { 
                        addSuffix: true, 
                        locale: ptBR 
                      })}
                    </p>
                  </div>
                </div>
              ))}
              {(pendingApprovals?.length || 0) > 3 && (
                <Button variant="ghost" size="sm" className="w-full" onClick={() => navigate('/altcontrol?tab=approvals')}>
                  Ver todas ({pendingApprovals?.length})
                  <ArrowRight className="ml-2 h-3 w-3" />
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Propostas que requerem ajustes (para vendedores) */}
        {hasNeedsAdjustment && (
          <div>
            <div className="mb-2 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              <span className="text-sm font-medium">Requerem ajustes</span>
            </div>
            <div className="space-y-2">
              {sellerProposals?.needsAdjustment?.map((proposal: any) => (
                <div
                  key={proposal.id}
                  className="flex cursor-pointer items-center justify-between rounded-lg border border-destructive/30 bg-destructive/5 p-2 transition-colors hover:bg-destructive/10"
                  onClick={() => navigate(`/altcontrol/proposals/${proposal.id}`)}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{proposal.client_name}</p>
                    {proposal.approval_comment && (
                      <p className="truncate text-xs text-muted-foreground">
                        "{proposal.approval_comment}"
                      </p>
                    )}
                  </div>
                  <FileText className="ml-2 h-4 w-4 text-destructive" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Propostas em análise (para vendedores) */}
        {hasInAnalysis && !hasApprovalsPending && (
          <div>
            <div className="mb-2 flex items-center gap-2">
              <Clock className="h-4 w-4 text-blue-500" />
              <span className="text-sm font-medium">Em análise</span>
            </div>
            <div className="space-y-2">
              {sellerProposals?.inAnalysis?.map((proposal: any) => (
                <div
                  key={proposal.id}
                  className="flex cursor-pointer items-center justify-between rounded-lg border bg-card p-2 transition-colors hover:bg-accent"
                  onClick={() => navigate(`/altcontrol/proposals/${proposal.id}`)}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{proposal.client_name}</p>
                    <p className="text-xs text-muted-foreground">
                      Enviado {proposal.submitted_at && formatDistanceToNow(new Date(proposal.submitted_at), { 
                        addSuffix: true, 
                        locale: ptBR 
                      })}
                    </p>
                  </div>
                  <Badge variant="secondary" className="ml-2">
                    Aguardando
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        <Button variant="outline" size="sm" className="w-full" onClick={() => navigate('/altcontrol')}>
          Ir para AltControl
          <ArrowRight className="ml-2 h-3 w-3" />
        </Button>
      </CardContent>
    </Card>
  );
};
