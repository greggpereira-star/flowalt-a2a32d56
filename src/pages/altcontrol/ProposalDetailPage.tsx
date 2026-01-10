import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAltControlProposal, useUpdateProposal, useSubmitForApproval, useAltControlLevels, useConvertToContract, AltControlProposalItem } from '@/hooks/useAltControl';
import { useAltControlNotifications } from '@/hooks/useAltControlNotifications';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ConvertToContractModal } from '@/components/altcontrol/ConvertToContractModal';
import {
  ChevronLeft,
  FileText,
  Clock,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  Send,
  Download,
  Edit,
  Copy,
  CheckCircle,
  XCircle,
  ArrowUp,
  FileCheck2,
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ReactNode }> = {
  draft: { label: 'Rascunho', variant: 'secondary', icon: <Edit className="h-3 w-3" /> },
  pending_approval: { label: 'Em Análise', variant: 'default', icon: <Clock className="h-3 w-3" /> },
  needs_adjustment: { label: 'Requer Ajustes', variant: 'destructive', icon: <AlertTriangle className="h-3 w-3" /> },
  approved: { label: 'Aprovada', variant: 'default', icon: <CheckCircle className="h-3 w-3" /> },
  sent: { label: 'Enviada', variant: 'outline', icon: <Send className="h-3 w-3" /> },
  won: { label: 'Ganhou', variant: 'default', icon: <TrendingUp className="h-3 w-3" /> },
  lost: { label: 'Perdeu', variant: 'destructive', icon: <XCircle className="h-3 w-3" /> },
};

export const ProposalDetailPage: React.FC = () => {
  const { proposalId } = useParams<{ proposalId: string }>();
  const navigate = useNavigate();
  const { data: proposal, isLoading } = useAltControlProposal(proposalId || '');
  const { data: levels } = useAltControlLevels();
  const updateProposal = useUpdateProposal();
  const submitForApproval = useSubmitForApproval();
  const convertToContract = useConvertToContract();
  const { notifyApprovers } = useAltControlNotifications();

  const [isEditing, setIsEditing] = useState(false);
  const [finalPrice, setFinalPrice] = useState<number | undefined>(undefined);
  const [showConvertModal, setShowConvertModal] = useState(false);

  React.useEffect(() => {
    if (proposal?.final_price) {
      setFinalPrice(proposal.final_price);
    }
  }, [proposal]);

  if (isLoading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
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
        <Button onClick={() => navigate('/altcontrol')}>Voltar para AltControl</Button>
      </div>
    );
  }

  const status = statusConfig[proposal.status] || statusConfig.draft;
  const level = proposal.calculated_level || levels?.find(l => l.id === proposal.calculated_level_id);
  const hoursPercentage = level ? Math.min(100, (proposal.total_hours / level.max_hours) * 100) : 0;
  const marginPercent = proposal.estimated_margin_percent || 0;
  const targetMargin = level?.target_margin_percent || 30;
  const isMarginLow = marginPercent < targetMargin;
  const isHoursNearLimit = level && proposal.total_hours >= level.max_hours * 0.85;

  const canEdit = proposal.status === 'draft' || proposal.status === 'needs_adjustment';
  const canSubmitForApproval = canEdit && proposal.total_hours > 0;
  const canGeneratePdf = proposal.status === 'approved' || proposal.status === 'sent' || proposal.status === 'won';
  const canConvertToContract = proposal.status === 'approved' || proposal.status === 'sent';

  const handleSubmitForApproval = async () => {
    if (!proposalId) return;
    await submitForApproval.mutateAsync(proposalId);
    await notifyApprovers(proposalId, proposal.client_name, proposal.total_hours);
    toast.success('Proposta enviada para aprovação');
  };

  const handleSaveFinalPrice = async () => {
    if (!proposalId || !finalPrice) return;
    await updateProposal.mutateAsync({ id: proposalId, final_price: finalPrice });
    setIsEditing(false);
    toast.success('Preço final atualizado');
  };

  const handleGeneratePdf = () => {
    toast.info('Funcionalidade de geração de PDF em desenvolvimento');
  };

  const handleDuplicate = () => {
    toast.info('Funcionalidade de duplicar proposta em desenvolvimento');
  };

  const handleConvertToContract = async (data: { startDate: string; createSpace: boolean; createClientCard: boolean }) => {
    if (!proposalId) return;
    const result = await convertToContract.mutateAsync({
      proposalId,
      startDate: data.startDate,
      createSpace: data.createSpace,
      createClientCard: data.createClientCard,
    });
    setShowConvertModal(false);
    navigate(`/altcontrol/contracts/${result.contract.id}`);
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/altcontrol')}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-semibold">Proposta #{proposal.proposal_number}</h2>
              <Badge variant={status.variant} className="gap-1">
                {status.icon}
                {status.label}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">{proposal.client_name}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {canEdit && (
            <Button variant="outline" size="sm" onClick={() => navigate(`/altcontrol/proposals/new?edit=${proposalId}`)}>
              <Edit className="mr-2 h-4 w-4" />
              Editar
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={handleDuplicate}>
            <Copy className="mr-2 h-4 w-4" />
            Duplicar
          </Button>
          {canGeneratePdf && (
            <Button variant="outline" size="sm" onClick={handleGeneratePdf}>
              <Download className="mr-2 h-4 w-4" />
              Gerar PDF
            </Button>
          )}
          {canConvertToContract && (
            <Button size="sm" onClick={() => setShowConvertModal(true)} className="bg-green-600 hover:bg-green-700">
              <FileCheck2 className="mr-2 h-4 w-4" />
              Converter em Contrato
            </Button>
          )}
          {canSubmitForApproval && (
            <Button size="sm" onClick={handleSubmitForApproval} disabled={submitForApproval.isPending}>
              <Send className="mr-2 h-4 w-4" />
              Enviar para Aprovação
            </Button>
          )}
        </div>
      </div>

      {/* Adjustment Comment */}
      {proposal.status === 'needs_adjustment' && proposal.approval_comment && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="flex items-start gap-3 pt-4">
            <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-destructive">Ajustes solicitados</p>
              <p className="text-sm text-muted-foreground">{proposal.approval_comment}</p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left Column - Details */}
        <div className="space-y-6">
          {/* Summary Card */}
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
                  <p className="font-medium">{proposal.client_name}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Nível Sugerido</Label>
                  <p className="font-medium">{level?.name || '-'}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Total de Horas</Label>
                  <p className="font-medium">{proposal.total_hours}h/mês</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Criado em</Label>
                  <p className="font-medium">{format(new Date(proposal.created_at), "dd/MM/yyyy", { locale: ptBR })}</p>
                </div>
              </div>

              {level && (
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-muted-foreground">Uso do Teto ({level.max_hours}h)</span>
                    <span className={cn(isHoursNearLimit && 'text-amber-500 font-medium')}>
                      {hoursPercentage.toFixed(0)}%
                    </span>
                  </div>
                  <Progress value={hoursPercentage} className={cn(isHoursNearLimit && '[&>div]:bg-amber-500')} />
                </div>
              )}

              <Separator />

              {/* Services */}
              <div>
                <Label className="text-xs text-muted-foreground mb-2 block">Serviços Inclusos</Label>
                {proposal.items && proposal.items.length > 0 ? (
                  <div className="space-y-2">
                    {proposal.items.map((item: AltControlProposalItem) => (
                      <div key={item.id} className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2">
                        <span className="text-sm">{item.service?.name || 'Serviço'}</span>
                        <Badge variant="outline">{item.hours_per_month}h</Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Nenhum serviço cadastrado.</p>
                )}
              </div>

              {proposal.notes && (
                <>
                  <Separator />
                  <div>
                    <Label className="text-xs text-muted-foreground">Observações</Label>
                    <p className="text-sm mt-1">{proposal.notes}</p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Timeline */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Histórico
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="mt-1 h-2 w-2 rounded-full bg-primary" />
                  <div>
                    <p className="text-sm font-medium">Proposta criada</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(proposal.created_at), { addSuffix: true, locale: ptBR })}
                    </p>
                  </div>
                </div>
                {proposal.submitted_at && (
                  <div className="flex items-start gap-3">
                    <div className="mt-1 h-2 w-2 rounded-full bg-blue-500" />
                    <div>
                      <p className="text-sm font-medium">Enviada para aprovação</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(proposal.submitted_at), { addSuffix: true, locale: ptBR })}
                      </p>
                    </div>
                  </div>
                )}
                {proposal.approved_at && (
                  <div className="flex items-start gap-3">
                    <div className="mt-1 h-2 w-2 rounded-full bg-green-500" />
                    <div>
                      <p className="text-sm font-medium">Aprovada</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(proposal.approved_at), { addSuffix: true, locale: ptBR })}
                      </p>
                    </div>
                  </div>
                )}
                {proposal.sent_at && (
                  <div className="flex items-start gap-3">
                    <div className="mt-1 h-2 w-2 rounded-full bg-purple-500" />
                    <div>
                      <p className="text-sm font-medium">Enviada ao cliente</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(proposal.sent_at), { addSuffix: true, locale: ptBR })}
                      </p>
                    </div>
                  </div>
                )}
                {proposal.won_at && (
                  <div className="flex items-start gap-3">
                    <div className="mt-1 h-2 w-2 rounded-full bg-green-600" />
                    <div>
                      <p className="text-sm font-medium">Proposta ganha!</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(proposal.won_at), { addSuffix: true, locale: ptBR })}
                      </p>
                    </div>
                  </div>
                )}
                {proposal.lost_at && (
                  <div className="flex items-start gap-3">
                    <div className="mt-1 h-2 w-2 rounded-full bg-destructive" />
                    <div>
                      <p className="text-sm font-medium">Proposta perdida</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(proposal.lost_at), { addSuffix: true, locale: ptBR })}
                        {proposal.lost_reason && ` - ${proposal.lost_reason}`}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Indicators */}
        <div className="space-y-6">
          {/* Pricing Card */}
          <Card className="border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-primary" />
                Precificação
              </CardTitle>
              <CardDescription>Valores sugeridos pelo sistema com base no nível</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-lg bg-muted/50 p-4">
                  <Label className="text-xs text-muted-foreground">Preço Mínimo</Label>
                  <p className="text-xl font-bold text-primary">
                    {proposal.suggested_min_price?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) || '-'}
                  </p>
                </div>
                <div className="rounded-lg bg-muted/50 p-4">
                  <Label className="text-xs text-muted-foreground">Preço Máximo</Label>
                  <p className="text-xl font-bold text-primary">
                    {proposal.suggested_max_price?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) || '-'}
                  </p>
                </div>
              </div>

              <Separator />

              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Preço Final</Label>
                  {canEdit && !isEditing && (
                    <Button variant="ghost" size="sm" onClick={() => setIsEditing(true)}>
                      <Edit className="h-3 w-3 mr-1" />
                      Editar
                    </Button>
                  )}
                </div>
                {isEditing ? (
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      value={finalPrice || ''}
                      onChange={(e) => setFinalPrice(Number(e.target.value))}
                      placeholder="R$ 0,00"
                    />
                    <Button onClick={handleSaveFinalPrice} disabled={updateProposal.isPending}>
                      Salvar
                    </Button>
                    <Button variant="outline" onClick={() => setIsEditing(false)}>
                      Cancelar
                    </Button>
                  </div>
                ) : (
                  <p className="text-2xl font-bold">
                    {proposal.final_price?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) || 'Não definido'}
                  </p>
                )}
              </div>

              <Separator />

              <div className="rounded-lg bg-muted/50 p-4">
                <Label className="text-xs text-muted-foreground">Custo Estimado</Label>
                <p className="text-lg font-semibold">
                  {proposal.estimated_cost?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) || '-'}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Risk Indicators */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Indicadores de Risco
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Margin */}
              <div className={cn(
                "rounded-lg p-4 border-2",
                isMarginLow ? "border-destructive/50 bg-destructive/5" : "border-green-500/50 bg-green-500/5"
              )}>
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-xs text-muted-foreground">Margem Estimada</Label>
                    <p className={cn(
                      "text-2xl font-bold",
                      isMarginLow ? "text-destructive" : "text-green-600"
                    )}>
                      {marginPercent.toFixed(1)}%
                    </p>
                  </div>
                  <div className="text-right">
                    <Label className="text-xs text-muted-foreground">Meta do Nível</Label>
                    <p className="text-lg font-semibold">{targetMargin}%</p>
                  </div>
                </div>
                {isMarginLow && (
                  <div className="flex items-center gap-2 mt-2 text-destructive text-sm">
                    <AlertTriangle className="h-4 w-4" />
                    <span>Margem abaixo da meta</span>
                  </div>
                )}
              </div>

              {/* Hours */}
              <div className={cn(
                "rounded-lg p-4 border-2",
                isHoursNearLimit ? "border-amber-500/50 bg-amber-500/5" : "border-muted"
              )}>
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-xs text-muted-foreground">Horas vs Teto</Label>
                    <p className="text-2xl font-bold">
                      {proposal.total_hours}h / {level?.max_hours || '?'}h
                    </p>
                  </div>
                  <div className={cn(
                    "flex items-center justify-center h-12 w-12 rounded-full",
                    isHoursNearLimit ? "bg-amber-500/20" : "bg-muted"
                  )}>
                    <ArrowUp className={cn("h-6 w-6", isHoursNearLimit && "text-amber-600")} />
                  </div>
                </div>
                {isHoursNearLimit && (
                  <div className="flex items-center gap-2 mt-2 text-amber-600 text-sm">
                    <AlertTriangle className="h-4 w-4" />
                    <span>Próximo do teto do nível</span>
                  </div>
                )}
              </div>

              {level?.requires_reinforced_approval && (
                <div className="rounded-lg p-4 border-2 border-primary/50 bg-primary/5">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-primary" />
                    <div>
                      <p className="font-medium">Aprovação Reforçada</p>
                      <p className="text-xs text-muted-foreground">Este nível exige aprovação de sócio sênior</p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Convert to Contract Modal */}
      <ConvertToContractModal
        open={showConvertModal}
        onOpenChange={setShowConvertModal}
        proposal={proposal}
        onConfirm={handleConvertToContract}
        isLoading={convertToContract.isPending}
      />
    </div>
  );
};
