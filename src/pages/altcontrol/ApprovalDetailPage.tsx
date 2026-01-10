import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAltControlProposal, useApproveProposal, useRequestAdjustments, useAltControlLevels, AltControlProposalItem } from '@/hooks/useAltControl';
import { useAltControlNotifications } from '@/hooks/useAltControlNotifications';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ChevronLeft,
  CheckCircle,
  XCircle,
  FileText,
  DollarSign,
  Clock,
  TrendingUp,
  AlertTriangle,
  User,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export const ApprovalDetailPage: React.FC = () => {
  const { proposalId } = useParams<{ proposalId: string }>();
  const navigate = useNavigate();
  const { data: proposal, isLoading } = useAltControlProposal(proposalId || '');
  const { data: levels } = useAltControlLevels();
  const approveProposal = useApproveProposal();
  const requestAdjustments = useRequestAdjustments();
  const { notifyProposalApproved, notifyProposalNeedsAdjustment } = useAltControlNotifications();
  
  const [comment, setComment] = useState('');

  if (isLoading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  if (!proposal) {
    return (
      <div className="flex flex-col items-center justify-center p-12">
        <FileText className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-lg font-semibold">Proposta não encontrada</h2>
        <p className="text-muted-foreground mb-4">A proposta solicitada não existe ou foi removida.</p>
        <Button onClick={() => navigate('/altcontrol?tab=approvals')}>Voltar para Aprovações</Button>
      </div>
    );
  }

  if (proposal.status !== 'in_review') {
    return (
      <div className="flex flex-col items-center justify-center p-12">
        <CheckCircle className="h-12 w-12 text-green-500 mb-4" />
        <h2 className="text-lg font-semibold">Proposta já processada</h2>
        <p className="text-muted-foreground mb-4">Esta proposta já foi aprovada ou solicitou ajustes.</p>
        <Button onClick={() => navigate('/altcontrol')}>Voltar para AltControl</Button>
      </div>
    );
  }

  const level = proposal.calculated_level || levels?.find(l => l.id === proposal.calculated_level_id);
  const hoursPercentage = level ? Math.min(100, (proposal.total_hours / level.max_hours) * 100) : 0;
  const marginPercent = proposal.estimated_margin_percent || 0;
  const targetMargin = level?.target_margin_percent || 30;
  const isMarginLow = marginPercent < targetMargin;
  const isHoursNearLimit = level && proposal.total_hours >= level.max_hours * 0.85;
  const isHoursOverLimit = level && proposal.total_hours > level.max_hours;

  const handleApprove = async () => {
    if (!proposalId) return;
    try {
      await approveProposal.mutateAsync({ proposalId, comment });
      await notifyProposalApproved(proposalId, proposal.seller_id, proposal.client_name);
      toast.success('Proposta aprovada com sucesso!');
      navigate('/altcontrol?tab=approvals');
    } catch (error) {
      toast.error('Erro ao aprovar proposta');
    }
  };

  const handleRequestAdjustments = async () => {
    if (!proposalId || !comment.trim()) {
      toast.error('Comentário obrigatório para solicitar ajustes');
      return;
    }
    try {
      await requestAdjustments.mutateAsync({ proposalId, comment });
      await notifyProposalNeedsAdjustment(proposalId, proposal.seller_id, proposal.client_name, comment);
      toast.success('Ajustes solicitados');
      navigate('/altcontrol?tab=approvals');
    } catch (error) {
      toast.error('Erro ao solicitar ajustes');
    }
  };

  const getMarginColor = () => {
    if (marginPercent >= targetMargin) return 'text-green-600';
    if (marginPercent >= targetMargin * 0.8) return 'text-amber-600';
    return 'text-destructive';
  };

  const getMarginBgColor = () => {
    if (marginPercent >= targetMargin) return 'bg-green-500/10 border-green-500/50';
    if (marginPercent >= targetMargin * 0.8) return 'bg-amber-500/10 border-amber-500/50';
    return 'bg-destructive/10 border-destructive/50';
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/altcontrol?tab=approvals')}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-semibold">Análise de Proposta #{proposal.proposal_number}</h2>
            <Badge className="gap-1">
              <Clock className="h-3 w-3" />
              Aguardando Aprovação
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Enviada {formatDistanceToNow(new Date(proposal.submitted_at || proposal.created_at), { addSuffix: true, locale: ptBR })}
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left Column - Proposal Summary */}
        <div className="space-y-6">
          {/* Client & Level */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Resumo da Proposta
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Cliente</Label>
                  <p className="text-lg font-semibold">{proposal.client_name}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Nível Calculado</Label>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-lg font-semibold px-3 py-1">
                      {level?.name || 'N/A'}
                    </Badge>
                    {level?.requires_reinforced_approval && (
                      <Badge variant="secondary" className="text-xs">
                        Aprovação Reforçada
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Total de Horas</Label>
                  <p className="text-2xl font-bold">{proposal.total_hours}h/mês</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Faixa do Nível</Label>
                  <p className="text-lg font-medium">{level?.min_hours}h - {level?.max_hours}h</p>
                </div>
              </div>

              {level && (
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-muted-foreground">Ocupação do Teto</span>
                    <span className={cn(
                      'font-medium',
                      isHoursOverLimit ? 'text-destructive' : isHoursNearLimit ? 'text-amber-500' : ''
                    )}>
                      {hoursPercentage.toFixed(0)}%
                    </span>
                  </div>
                  <Progress 
                    value={Math.min(hoursPercentage, 100)} 
                    className={cn(
                      isHoursOverLimit ? '[&>div]:bg-destructive' :
                      isHoursNearLimit ? '[&>div]:bg-amber-500' : ''
                    )} 
                  />
                </div>
              )}

              <Separator />

              {/* Seller Info */}
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <div className="flex items-center justify-center h-10 w-10 rounded-full bg-primary/10">
                  <User className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Vendedor Responsável</Label>
                  <p className="font-medium">{proposal.seller_name || 'Não identificado'}</p>
                </div>
              </div>

              {/* Services */}
              <div>
                <Label className="text-xs text-muted-foreground mb-2 block">Escopo Contratado</Label>
                {proposal.items && proposal.items.length > 0 ? (
                  <div className="space-y-2">
                    {proposal.items.map((item: AltControlProposalItem) => (
                      <div key={item.id} className="flex items-center justify-between rounded-md border bg-card px-3 py-2">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-2 rounded-full bg-primary" />
                          <span className="text-sm font-medium">{item.service?.name || 'Serviço'}</span>
                        </div>
                        <Badge>{item.hours_per_month}h</Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground italic">Nenhum serviço especificado</p>
                )}
              </div>

              {proposal.notes && (
                <>
                  <Separator />
                  <div>
                    <Label className="text-xs text-muted-foreground">Observações do Vendedor</Label>
                    <p className="text-sm mt-1 p-3 rounded-lg bg-muted/50">{proposal.notes}</p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Risk Indicators & Decision */}
        <div className="space-y-6">
          {/* Risk Cards */}
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Margin Card */}
            <Card className={cn("border-2", getMarginBgColor())}>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-xs text-muted-foreground">Margem Prevista</Label>
                  {isMarginLow && <AlertTriangle className="h-4 w-4 text-destructive" />}
                </div>
                <p className={cn("text-3xl font-bold", getMarginColor())}>
                  {marginPercent.toFixed(1)}%
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Meta do nível: {targetMargin}%
                </p>
              </CardContent>
            </Card>

            {/* Price Card */}
            <Card className="border-2 border-primary/30 bg-primary/5">
              <CardContent className="pt-4">
                <Label className="text-xs text-muted-foreground">Valor Mensal</Label>
                <p className="text-2xl font-bold text-primary">
                  {proposal.final_price?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) || 
                   proposal.suggested_max_price?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) || 
                   '-'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Faixa: {proposal.suggested_min_price?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} - {proposal.suggested_max_price?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </p>
              </CardContent>
            </Card>

            {/* Cost Card */}
            <Card>
              <CardContent className="pt-4">
                <Label className="text-xs text-muted-foreground">Custo Estimado</Label>
                <p className="text-xl font-bold">
                  {proposal.estimated_cost?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) || '-'}
                </p>
              </CardContent>
            </Card>

            {/* Hours Card */}
            <Card className={cn(
              "border-2",
              isHoursOverLimit ? "border-destructive/50 bg-destructive/5" :
              isHoursNearLimit ? "border-amber-500/50 bg-amber-500/5" : ""
            )}>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-xs text-muted-foreground">Teto de Horas</Label>
                  {(isHoursNearLimit || isHoursOverLimit) && (
                    <AlertTriangle className={cn("h-4 w-4", isHoursOverLimit ? "text-destructive" : "text-amber-500")} />
                  )}
                </div>
                <p className={cn(
                  "text-xl font-bold",
                  isHoursOverLimit ? "text-destructive" : isHoursNearLimit ? "text-amber-600" : ""
                )}>
                  {proposal.total_hours}h / {level?.max_hours || '?'}h
                </p>
                {isHoursOverLimit && (
                  <p className="text-xs text-destructive mt-1">Acima do teto!</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Alerts */}
          {(isMarginLow || isHoursNearLimit || isHoursOverLimit) && (
            <Card className="border-amber-500/50 bg-amber-500/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2 text-amber-600">
                  <AlertTriangle className="h-5 w-5" />
                  Alertas de Risco
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {isMarginLow && (
                  <p className="text-sm flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-destructive" />
                    Margem ({marginPercent.toFixed(1)}%) abaixo da meta ({targetMargin}%)
                  </p>
                )}
                {isHoursOverLimit && (
                  <p className="text-sm flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-destructive" />
                    Horas acima do teto do nível
                  </p>
                )}
                {isHoursNearLimit && !isHoursOverLimit && (
                  <p className="text-sm flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                    Horas próximas do teto do nível
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Decision Card */}
          <Card className="border-2 border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                Decisão da Diretoria
              </CardTitle>
              <CardDescription>
                Analise os indicadores e tome sua decisão sobre esta proposta
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="comment">Comentário</Label>
                <Textarea
                  id="comment"
                  placeholder="Adicione um comentário (obrigatório para solicitar ajustes)"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={3}
                  className="mt-1.5"
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <Button
                  size="lg"
                  className="w-full gap-2 bg-green-600 hover:bg-green-700"
                  onClick={handleApprove}
                  disabled={approveProposal.isPending}
                >
                  <CheckCircle className="h-5 w-5" />
                  Aprovar Proposta
                </Button>
                <Button
                  size="lg"
                  variant="destructive"
                  className="w-full gap-2"
                  onClick={handleRequestAdjustments}
                  disabled={!comment.trim() || requestAdjustments.isPending}
                >
                  <XCircle className="h-5 w-5" />
                  Solicitar Ajustes
                </Button>
              </div>

              {!comment.trim() && (
                <p className="text-xs text-muted-foreground text-center">
                  * Para solicitar ajustes, é necessário adicionar um comentário
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
