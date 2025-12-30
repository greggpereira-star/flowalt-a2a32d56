import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Search,
  Webhook,
  Calendar,
  FileText,
  DollarSign,
  Users,
  Zap,
  ExternalLink,
  Check,
  Plus,
  Star,
  Clock,
  Shield,
  TrendingUp,
  MessageSquare,
  Mail,
  Github,
  Slack
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface Integration {
  id: string;
  name: string;
  description: string;
  category: 'productivity' | 'communication' | 'finance' | 'calendar' | 'development' | 'automation';
  icon: React.ElementType;
  status: 'available' | 'coming_soon' | 'connected';
  popular?: boolean;
  features: string[];
  webhookEvents?: string[];
  setupTime: string;
}

const INTEGRATIONS: Integration[] = [
  {
    id: 'google-calendar',
    name: 'Google Calendar',
    description: 'Sincronize eventos e deadlines automaticamente com o Google Calendar',
    category: 'calendar',
    icon: Calendar,
    status: 'available',
    popular: true,
    features: [
      'Sincronização bidirecional de eventos',
      'Criação automática de eventos para deadlines',
      'Visualização de disponibilidade da equipe',
    ],
    webhookEvents: ['event.created', 'event.updated', 'card.due_date_changed'],
    setupTime: '2 min',
  },
  {
    id: 'google-drive',
    name: 'Google Drive',
    description: 'Anexe arquivos do Drive diretamente aos cards',
    category: 'productivity',
    icon: FileText,
    status: 'available',
    features: [
      'Anexar arquivos do Drive',
      'Preview de documentos',
      'Sincronização automática',
    ],
    webhookEvents: ['attachment.uploaded', 'attachment.deleted'],
    setupTime: '3 min',
  },
  {
    id: 'slack',
    name: 'Slack',
    description: 'Receba notificações e crie cards diretamente do Slack',
    category: 'communication',
    icon: Slack,
    status: 'available',
    popular: true,
    features: [
      'Notificações de mudança de status',
      'Criar cards via slash command',
      'Atualizar cards sem sair do Slack',
    ],
    webhookEvents: ['card.created', 'card.status_changed', 'comment.created'],
    setupTime: '5 min',
  },
  {
    id: 'zapier',
    name: 'Zapier',
    description: 'Conecte com mais de 5000 apps via Zapier',
    category: 'automation',
    icon: Zap,
    status: 'available',
    popular: true,
    features: [
      'Triggers para todos os eventos',
      'Actions para criar/atualizar cards',
      'Suporte a filtros e condições',
    ],
    webhookEvents: ['*'],
    setupTime: '10 min',
  },
  {
    id: 'make',
    name: 'Make (Integromat)',
    description: 'Automações visuais avançadas com Make',
    category: 'automation',
    icon: TrendingUp,
    status: 'available',
    features: [
      'Cenários visuais complexos',
      'Suporte a webhooks bidirecionais',
      'Histórico de execuções',
    ],
    webhookEvents: ['*'],
    setupTime: '10 min',
  },
  {
    id: 'github',
    name: 'GitHub',
    description: 'Vincule commits e PRs aos cards',
    category: 'development',
    icon: Github,
    status: 'coming_soon',
    features: [
      'Vincular PRs a cards',
      'Status automático baseado em merge',
      'Visualizar commits no card',
    ],
    setupTime: '5 min',
  },
  {
    id: 'open-finance',
    name: 'Open Finance',
    description: 'Importe lançamentos bancários automaticamente',
    category: 'finance',
    icon: DollarSign,
    status: 'coming_soon',
    features: [
      'Importar lançamentos do banco',
      'Conciliação automática',
      'Categorização inteligente',
    ],
    setupTime: '10 min',
  },
  {
    id: 'email',
    name: 'Email para Card',
    description: 'Crie cards enviando emails para um endereço dedicado',
    category: 'productivity',
    icon: Mail,
    status: 'available',
    features: [
      'Endereço único por workspace',
      'Anexos convertidos automaticamente',
      'Parsing inteligente de assunto',
    ],
    webhookEvents: ['card.created'],
    setupTime: '1 min',
  },
  {
    id: 'crm',
    name: 'CRM Externo',
    description: 'Sincronize clientes e oportunidades',
    category: 'productivity',
    icon: Users,
    status: 'coming_soon',
    features: [
      'Sincronizar contatos',
      'Criar cards de oportunidades',
      'Rastrear valor de deals',
    ],
    setupTime: '15 min',
  },
];

const CATEGORIES = [
  { id: 'all', label: 'Todas' },
  { id: 'productivity', label: 'Produtividade' },
  { id: 'communication', label: 'Comunicação' },
  { id: 'automation', label: 'Automação' },
  { id: 'calendar', label: 'Calendário' },
  { id: 'finance', label: 'Financeiro' },
  { id: 'development', label: 'Desenvolvimento' },
];

export function IntegrationMarketplace() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedIntegration, setSelectedIntegration] = useState<Integration | null>(null);

  const filteredIntegrations = INTEGRATIONS.filter(integration => {
    const matchesSearch = integration.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         integration.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || integration.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const popularIntegrations = INTEGRATIONS.filter(i => i.popular);

  const handleConnect = (integration: Integration) => {
    if (integration.status === 'coming_soon') {
      toast({
        title: 'Em breve!',
        description: `A integração com ${integration.name} estará disponível em breve.`,
      });
      return;
    }

    toast({
      title: 'Configurar Integração',
      description: `Abrindo configuração para ${integration.name}...`,
    });
    // Here you would open the specific integration setup flow
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'productivity': return FileText;
      case 'communication': return MessageSquare;
      case 'automation': return Zap;
      case 'calendar': return Calendar;
      case 'finance': return DollarSign;
      case 'development': return Github;
      default: return Webhook;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Marketplace de Integrações</h2>
          <p className="text-muted-foreground">
            Conecte suas ferramentas favoritas em poucos cliques
          </p>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Pesquisar integrações..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2 sm:pb-0">
          {CATEGORIES.map(category => (
            <Button
              key={category.id}
              variant={selectedCategory === category.id ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedCategory(category.id)}
              className="whitespace-nowrap"
            >
              {category.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Popular Section */}
      {selectedCategory === 'all' && !searchQuery && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Star className="h-5 w-5 text-yellow-500" />
            Mais Populares
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {popularIntegrations.map(integration => (
              <Card 
                key={integration.id} 
                className="hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => setSelectedIntegration(integration)}
              >
                <CardContent className="pt-6">
                  <div className="flex items-start gap-4">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <integration.icon className="h-6 w-6 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold truncate">{integration.name}</h4>
                        <Badge className="bg-yellow-500/20 text-yellow-600 text-[10px]">
                          Popular
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                        {integration.description}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* All Integrations */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">
          {selectedCategory === 'all' ? 'Todas as Integrações' : `Integrações de ${CATEGORIES.find(c => c.id === selectedCategory)?.label}`}
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredIntegrations.map(integration => (
            <Card 
              key={integration.id} 
              className={`hover:shadow-md transition-shadow cursor-pointer ${
                integration.status === 'coming_soon' ? 'opacity-75' : ''
              }`}
              onClick={() => setSelectedIntegration(integration)}
            >
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <div className={`p-2 rounded-lg ${
                    integration.status === 'connected' 
                      ? 'bg-green-500/10' 
                      : 'bg-primary/10'
                  }`}>
                    <integration.icon className={`h-6 w-6 ${
                      integration.status === 'connected'
                        ? 'text-green-500'
                        : 'text-primary'
                    }`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold truncate">{integration.name}</h4>
                      {integration.status === 'coming_soon' && (
                        <Badge variant="secondary" className="text-[10px]">
                          Em breve
                        </Badge>
                      )}
                      {integration.status === 'connected' && (
                        <Badge className="bg-green-500/20 text-green-600 text-[10px]">
                          <Check className="h-3 w-3 mr-1" />
                          Conectado
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                      {integration.description}
                    </p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {integration.setupTime}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {filteredIntegrations.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <Search className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>Nenhuma integração encontrada</p>
          </div>
        )}
      </div>

      {/* Integration Detail Dialog */}
      <Dialog open={!!selectedIntegration} onOpenChange={() => setSelectedIntegration(null)}>
        <DialogContent className="max-w-lg">
          {selectedIntegration && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-primary/10 rounded-lg">
                    <selectedIntegration.icon className="h-8 w-8 text-primary" />
                  </div>
                  <div>
                    <DialogTitle className="flex items-center gap-2">
                      {selectedIntegration.name}
                      {selectedIntegration.status === 'coming_soon' && (
                        <Badge variant="secondary">Em breve</Badge>
                      )}
                    </DialogTitle>
                    <DialogDescription>
                      {selectedIntegration.description}
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              <div className="space-y-6 mt-4">
                {/* Features */}
                <div>
                  <h4 className="font-medium mb-3">Funcionalidades</h4>
                  <ul className="space-y-2">
                    {selectedIntegration.features.map((feature, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm">
                        <Check className="h-4 w-4 text-green-500 mt-0.5" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Webhook Events */}
                {selectedIntegration.webhookEvents && (
                  <div>
                    <h4 className="font-medium mb-3">Eventos Suportados</h4>
                    <div className="flex flex-wrap gap-2">
                      {selectedIntegration.webhookEvents.map((event, idx) => (
                        <Badge key={idx} variant="outline" className="font-mono text-xs">
                          {event}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Setup Info */}
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span>Tempo de configuração:</span>
                    <strong>{selectedIntegration.setupTime}</strong>
                  </div>
                  <Badge variant="outline" className="gap-1">
                    <Shield className="h-3 w-3" />
                    Seguro
                  </Badge>
                </div>

                {/* Action Button */}
                <Button 
                  className="w-full"
                  disabled={selectedIntegration.status === 'coming_soon'}
                  onClick={() => handleConnect(selectedIntegration)}
                >
                  {selectedIntegration.status === 'connected' ? (
                    <>
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Gerenciar Conexão
                    </>
                  ) : selectedIntegration.status === 'coming_soon' ? (
                    'Em Breve'
                  ) : (
                    <>
                      <Plus className="h-4 w-4 mr-2" />
                      Conectar
                    </>
                  )}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
