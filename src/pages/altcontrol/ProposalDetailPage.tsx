import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAltControlProposal } from '@/hooks/useAltControl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ChevronLeft } from 'lucide-react';

export const ProposalDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: proposal, isLoading } = useAltControlProposal(id || '');

  if (isLoading) {
    return <Skeleton className="h-96 w-full" />;
  }

  if (!proposal) {
    return <div>Proposta não encontrada</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/altcontrol/proposals')}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h2 className="text-xl font-semibold">Proposta #{proposal.proposal_number}</h2>
          <p className="text-sm text-muted-foreground">{proposal.client_name}</p>
        </div>
        <Badge>{proposal.status}</Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Detalhes da Proposta</CardTitle>
        </CardHeader>
        <CardContent>
          <p>Total de horas: {proposal.total_hours}h/mês</p>
          <p>Nível: {proposal.calculated_level?.name || '-'}</p>
        </CardContent>
      </Card>
    </div>
  );
};
