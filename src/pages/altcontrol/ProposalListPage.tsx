import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAltControlProposals, type ProposalStatus } from '@/hooks/useAltControl';
import { useAuth } from '@/contexts/AuthContext';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Search,
  MoreVertical,
  Eye,
  Copy,
  FileDown,
  FileText,
  Clock,
  AlertCircle,
  CheckCircle,
  Send,
  Trophy,
  XCircle,
} from 'lucide-react';

const statusConfig: Record<ProposalStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ReactNode }> = {
  draft: { label: 'Rascunho', variant: 'secondary', icon: <FileText className="h-3 w-3" /> },
  in_review: { label: 'Em Análise', variant: 'default', icon: <Clock className="h-3 w-3" /> },
  needs_adjustment: { label: 'Requer Ajustes', variant: 'destructive', icon: <AlertCircle className="h-3 w-3" /> },
  approved: { label: 'Aprovada', variant: 'default', icon: <CheckCircle className="h-3 w-3" /> },
  sent: { label: 'Enviada', variant: 'outline', icon: <Send className="h-3 w-3" /> },
  won: { label: 'Ganhou', variant: 'default', icon: <Trophy className="h-3 w-3" /> },
  lost: { label: 'Perdeu', variant: 'destructive', icon: <XCircle className="h-3 w-3" /> },
};

export const ProposalListPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ProposalStatus | 'all'>('all');
  
  const { data: proposals, isLoading } = useAltControlProposals(
    statusFilter !== 'all' ? { status: statusFilter } : undefined
  );

  const filteredProposals = proposals?.filter(p => 
    p.client_name.toLowerCase().includes(search.toLowerCase()) ||
    p.proposal_number.toString().includes(search)
  );

  const formatCurrency = (value: number | null | undefined) => {
    if (!value) return '-';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map(i => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Lista de Propostas</CardTitle>
        <CardDescription>
          Gerencie todas as propostas comerciais do workspace
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por cliente ou número..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as ProposalStatus | 'all')}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="Filtrar por status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              <SelectItem value="draft">Rascunho</SelectItem>
              <SelectItem value="in_review">Em Análise</SelectItem>
              <SelectItem value="needs_adjustment">Requer Ajustes</SelectItem>
              <SelectItem value="approved">Aprovada</SelectItem>
              <SelectItem value="sent">Enviada</SelectItem>
              <SelectItem value="won">Ganhou</SelectItem>
              <SelectItem value="lost">Perdeu</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        {filteredProposals && filteredProposals.length > 0 ? (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-20">#</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead className="hidden md:table-cell">Data</TableHead>
                  <TableHead className="hidden sm:table-cell">Valor</TableHead>
                  <TableHead className="hidden lg:table-cell">Nível</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-16"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProposals.map((proposal) => {
                  const status = statusConfig[proposal.status];
                  return (
                    <TableRow
                      key={proposal.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => navigate(`/altcontrol/proposals/${proposal.id}`)}
                    >
                      <TableCell className="font-mono text-sm">
                        #{proposal.proposal_number}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{proposal.client_name}</p>
                          <p className="text-xs text-muted-foreground hidden sm:block">
                            {proposal.total_hours}h/mês
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground">
                        {format(new Date(proposal.created_at), "dd/MM/yy", { locale: ptBR })}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <div className="text-sm">
                          <p className="font-medium">
                            {formatCurrency(proposal.final_price || proposal.suggested_max_price)}
                          </p>
                          {proposal.estimated_margin_percent && (
                            <p className={`text-xs ${proposal.estimated_margin_percent >= 30 ? 'text-green-600' : proposal.estimated_margin_percent >= 20 ? 'text-yellow-600' : 'text-red-600'}`}>
                              {proposal.estimated_margin_percent.toFixed(1)}% margem
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        {proposal.calculated_level ? (
                          <Badge variant="outline">{proposal.calculated_level.name}</Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={status.variant} className="gap-1">
                          {status.icon}
                          <span className="hidden sm:inline">{status.label}</span>
                        </Badge>
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => navigate(`/altcontrol/proposals/${proposal.id}`)}>
                              <Eye className="mr-2 h-4 w-4" />
                              Ver detalhes
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Copy className="mr-2 h-4 w-4" />
                              Duplicar
                            </DropdownMenuItem>
                            {proposal.status === 'approved' && (
                              <DropdownMenuItem>
                                <FileDown className="mr-2 h-4 w-4" />
                                Gerar PDF
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Nenhuma proposta encontrada</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {search || statusFilter !== 'all' 
                ? 'Tente ajustar os filtros de busca'
                : 'Crie sua primeira proposta para começar'}
            </p>
            <Button onClick={() => navigate('/altcontrol/proposals/new')}>
              Criar Proposta
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
