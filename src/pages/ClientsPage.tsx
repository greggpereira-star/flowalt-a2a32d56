import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { useClientsSpace, useClientsSpaceFolders } from '@/hooks/useClientsSpace';
import { useClientCardsByStatus, type ClientStatus, type ClientCard } from '@/hooks/useClientCards';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Building2, 
  Plus, 
  Search, 
  CheckCircle, 
  PauseCircle, 
  XCircle,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Users,
  DollarSign,
  Activity
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { CreateClientDialog } from '@/components/clients/CreateClientDialog';
import { ClientCardSheet } from '@/components/clients/ClientCardSheet';

const statusConfig: Record<ClientStatus, { label: string; icon: React.ElementType; color: string }> = {
  active: { label: 'Clientes Ativos', icon: CheckCircle, color: 'text-green-500' },
  paused: { label: 'Clientes Pausados', icon: PauseCircle, color: 'text-amber-500' },
  closed: { label: 'Clientes Encerrados', icon: XCircle, color: 'text-red-500' },
};

const financialStateConfig: Record<string, { label: string; color: string; bgColor: string }> = {
  healthy: { label: 'Saudável', color: 'text-green-600', bgColor: 'bg-green-100' },
  attention: { label: 'Atenção', color: 'text-amber-600', bgColor: 'bg-amber-100' },
  critical: { label: 'Crítico', color: 'text-red-600', bgColor: 'bg-red-100' },
  loss: { label: 'Prejuízo', color: 'text-red-800', bgColor: 'bg-red-200' },
};

const ClientCardItem: React.FC<{ client: ClientCard; onClick: () => void }> = ({ client, onClick }) => {
  const stateConfig = financialStateConfig[client.financial_state] || financialStateConfig.healthy;
  
  return (
    <Card 
      className="cursor-pointer hover:shadow-md transition-all hover:border-primary/30 group"
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {/* Avatar/Logo */}
          <div 
            className="w-12 h-12 rounded-lg flex items-center justify-center text-white font-bold text-lg shrink-0"
            style={{ backgroundColor: client.color || '#6366f1' }}
          >
            {client.logo_url ? (
              <img src={client.logo_url} alt={client.name} className="w-full h-full object-cover rounded-lg" />
            ) : (
              client.name.charAt(0).toUpperCase()
            )}
          </div>
          
          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                {client.name}
              </h3>
              <Badge variant="outline" className={cn('text-xs', stateConfig.color, stateConfig.bgColor)}>
                {stateConfig.label}
              </Badge>
            </div>
            
            {client.segment && (
              <p className="text-sm text-muted-foreground truncate">{client.segment}</p>
            )}
            
            {/* Health Score */}
            <div className="flex items-center gap-2 mt-2">
              <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                <div 
                  className={cn(
                    'h-full rounded-full transition-all',
                    client.health_score >= 80 ? 'bg-green-500' :
                    client.health_score >= 60 ? 'bg-amber-500' :
                    client.health_score >= 40 ? 'bg-orange-500' : 'bg-red-500'
                  )}
                  style={{ width: `${client.health_score}%` }}
                />
              </div>
              <span className="text-xs text-muted-foreground font-medium">{client.health_score}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const ClientsGrid: React.FC<{ 
  status: ClientStatus; 
  searchQuery: string;
  onClientClick: (id: string) => void;
}> = ({ status, searchQuery, onClientClick }) => {
  const { data: clients, isLoading } = useClientCardsByStatus(status);
  
  const filteredClients = clients?.filter(client => 
    client.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    client.segment?.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
    );
  }

  if (filteredClients.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Building2 className="h-12 w-12 text-muted-foreground/50 mb-4" />
        <h3 className="font-medium text-muted-foreground mb-1">
          Nenhum cliente encontrado
        </h3>
        <p className="text-sm text-muted-foreground/80">
          {searchQuery ? 'Tente uma busca diferente' : 'Adicione seu primeiro cliente'}
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {filteredClients.map((client) => (
        <ClientCardItem 
          key={client.id} 
          client={client} 
          onClick={() => onClientClick(client.id)}
        />
      ))}
    </div>
  );
};

export const ClientsPage: React.FC = () => {
  const navigate = useNavigate();
  const { clientId } = useParams<{ clientId?: string }>();
  const [activeTab, setActiveTab] = useState<ClientStatus>('active');
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(clientId || null);

  const { data: activeClients } = useClientCardsByStatus('active');
  const { data: pausedClients } = useClientCardsByStatus('paused');
  const { data: closedClients } = useClientCardsByStatus('closed');

  const stats = {
    active: activeClients?.length || 0,
    paused: pausedClients?.length || 0,
    closed: closedClients?.length || 0,
    total: (activeClients?.length || 0) + (pausedClients?.length || 0) + (closedClients?.length || 0),
  };

  const handleClientClick = (id: string) => {
    setSelectedClientId(id);
    navigate(`/clients/${id}`, { replace: true });
  };

  const handleCloseSheet = () => {
    setSelectedClientId(null);
    navigate('/clients', { replace: true });
  };

  return (
    <>
      <div className="flex-1 overflow-auto">
        <div className="p-6 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                <Building2 className="h-7 w-7 text-primary" />
                Clientes
              </h1>
              <p className="text-muted-foreground mt-1">
                Centro de resultado com P&L por cliente
              </p>
            </div>
            <Button onClick={() => setIsCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Cliente
            </Button>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Users className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats.total}</p>
                    <p className="text-sm text-muted-foreground">Total</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-green-100">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats.active}</p>
                    <p className="text-sm text-muted-foreground">Ativos</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-amber-100">
                    <PauseCircle className="h-5 w-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats.paused}</p>
                    <p className="text-sm text-muted-foreground">Pausados</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-red-100">
                    <XCircle className="h-5 w-5 text-red-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats.closed}</p>
                    <p className="text-sm text-muted-foreground">Encerrados</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Search and Tabs */}
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar clientes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {/* Tabs Content */}
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ClientStatus)}>
            <TabsList>
              {Object.entries(statusConfig).map(([key, config]) => {
                const Icon = config.icon;
                const count = key === 'active' ? stats.active : key === 'paused' ? stats.paused : stats.closed;
                return (
                  <TabsTrigger key={key} value={key} className="gap-2">
                    <Icon className={cn('h-4 w-4', config.color)} />
                    {config.label}
                    <Badge variant="secondary" className="ml-1">{count}</Badge>
                  </TabsTrigger>
                );
              })}
            </TabsList>
            
            <div className="mt-6">
              <TabsContent value="active" className="mt-0">
                <ClientsGrid status="active" searchQuery={searchQuery} onClientClick={handleClientClick} />
              </TabsContent>
              <TabsContent value="paused" className="mt-0">
                <ClientsGrid status="paused" searchQuery={searchQuery} onClientClick={handleClientClick} />
              </TabsContent>
              <TabsContent value="closed" className="mt-0">
                <ClientsGrid status="closed" searchQuery={searchQuery} onClientClick={handleClientClick} />
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </div>

      {/* Create Dialog */}
      <CreateClientDialog 
        open={isCreateOpen} 
        onOpenChange={setIsCreateOpen}
        onSuccess={(id) => {
          setIsCreateOpen(false);
          handleClientClick(id);
        }}
      />

      {/* Client Detail Sheet */}
      <ClientCardSheet
        clientId={selectedClientId}
        open={!!selectedClientId}
        onOpenChange={(open) => !open && handleCloseSheet()}
      />
    </>
  );
};

export default ClientsPage;
