import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAltControlProposal, useApproveProposal, useRequestAdjustments } from '@/hooks/useAltControl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ChevronLeft, CheckCircle, XCircle } from 'lucide-react';

export const ApprovalDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: proposal } = useAltControlProposal(id || '');
  const approveProposal = useApproveProposal();
  const requestAdjustments = useRequestAdjustments();
  const [comment, setComment] = React.useState('');

  const handleApprove = async () => {
    await approveProposal.mutateAsync({ proposalId: id!, comment });
    navigate('/altcontrol/approvals');
  };

  const handleReject = async () => {
    if (!comment.trim()) return;
    await requestAdjustments.mutateAsync({ proposalId: id!, comment });
    navigate('/altcontrol/approvals');
  };

  if (!proposal) return <div>Carregando...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/altcontrol/approvals')}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <h2 className="text-xl font-semibold">Análise de Proposta #{proposal.proposal_number}</h2>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Resumo</CardTitle></CardHeader>
          <CardContent>
            <p><strong>Cliente:</strong> {proposal.client_name}</p>
            <p><strong>Horas:</strong> {proposal.total_hours}h/mês</p>
            <p><strong>Nível:</strong> {proposal.calculated_level?.name}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Decisão</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <Textarea placeholder="Comentário (obrigatório para ajustes)" value={comment} onChange={(e) => setComment(e.target.value)} />
            <div className="flex gap-2">
              <Button onClick={handleApprove} className="flex-1 gap-2">
                <CheckCircle className="h-4 w-4" /> Aprovar
              </Button>
              <Button variant="destructive" onClick={handleReject} className="flex-1 gap-2" disabled={!comment.trim()}>
                <XCircle className="h-4 w-4" /> Solicitar Ajustes
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
