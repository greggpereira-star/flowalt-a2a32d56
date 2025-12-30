import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Calendar,
  HardDrive,
  Landmark,
  MessageSquare,
  Zap,
  FileText,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  TrendingUp,
  Settings2,
  Link2,
  Unlink,
  ArrowRight,
  Sparkles,
  KeyRound,
} from 'lucide-react';
import { useConnectors, Connector } from '@/hooks/useConnectors';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { IntegrationWizard, type IntegrationType } from './IntegrationWizard';

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Calendar,
  HardDrive,
  Landmark,
  MessageSquare,
  Zap,
  FileText,
};

const statusConfig = {
  connected: { color: 'bg-green-500', label: 'Conectado', icon: CheckCircle2 },
  disconnected: { color: 'bg-gray-400', label: 'Desconectado', icon: XCircle },
  error: { color: 'bg-red-500', label: 'Erro', icon: AlertTriangle },
  syncing: { color: 'bg-blue-500 animate-pulse', label: 'Sincronizando', icon: RefreshCw },
};

export function ConnectorsPanel() {
  const {
    connectors,
    isLoading,
    syncPatterns,
    connect,
    disconnect,
    syncNow,
    analyzeSyncPatterns,
    importCalendarEvents,
    importBankTransactions,
  } = useConnectors();

  const [selectedConnector, setSelectedConnector] = useState<Connector | null>(null);
  const [showConfigDialog, setShowConfigDialog] = useState(false);
  const [autoSyncEnabled, setAutoSyncEnabled] = useState<Record<string, boolean>>({});
  
  // State for integration wizard (Open Finance / NF Emissor)
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardIntegration, setWizardIntegration] = useState<IntegrationType | undefined>(undefined);

  // Map connector types to wizard integration types
  const connectorToWizardType: Record<string, IntegrationType> = {
    open_finance: 'pluggy',
    nf_emissor: 'espiao_nfe',
  };

  const handleConnect = async (connector: Connector) => {
    // If it's Open Finance or NF Emissor, open the wizard instead
    const wizardType = connectorToWizardType[connector.type];
    if (wizardType) {
      setWizardIntegration(wizardType);
      setWizardOpen(true);
      return;
    }
    await connect(connector.id);
  };

  const handleDisconnect = async (connector: Connector) => {
    await disconnect(connector.id);
  };

  const handleSync = async (connector: Connector) => {
    await syncNow(connector.id);
  };

  const handleAnalyzePatterns = async () => {
    await analyzeSyncPatterns();
  };

  const getConnectorDescription = (type: string) => {
    const descriptions: Record<string, string> = {
      google_calendar: 'Sincronize eventos do Google Calendar com a Agenda do Flowalt',
      google_drive: 'Importe arquivos do Drive como anexos de cards automaticamente',
      open_finance: 'Importe transações bancárias e concilie com o módulo financeiro',
      slack: 'Receba notificações e crie cards diretamente do Slack',
      zapier: 'Conecte com +5000 apps através de automações Zapier',
      nf_emissor: 'Importe notas fiscais emitidas e vincule a transações',
    };
    return descriptions[type] || '';
  };

  const ConnectorCard = ({ connector }: { connector: Connector }) => {
    const IconComponent = iconMap[connector.icon] || FileText;
    const status = statusConfig[connector.status];
    const StatusIcon = status.icon;

    return (
      <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
        <div className="flex items-center gap-4">
          <div className={`p-3 rounded-lg ${connector.status === 'connected' ? 'bg-primary/10' : 'bg-muted'}`}>
            <IconComponent className={`h-6 w-6 ${connector.status === 'connected' ? 'text-primary' : 'text-muted-foreground'}`} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="font-medium">{connector.name}</h4>
              <Badge 
                variant="outline" 
                className={`text-xs ${connector.status === 'connected' ? 'border-green-500 text-green-600' : ''}`}
              >
                <StatusIcon className="h-3 w-3 mr-1" />
                {status.label}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {getConnectorDescription(connector.type)}
            </p>
            {connector.lastSync && (
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Última sync: {formatDistanceToNow(new Date(connector.lastSync), { addSuffix: true, locale: ptBR })}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {(connector.status === 'connected' || connector.status === 'syncing') && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleSync(connector)}
                disabled={isLoading || connector.status === 'syncing'}
              >
                <RefreshCw className={`h-4 w-4 mr-1 ${connector.status === 'syncing' ? 'animate-spin' : ''}`} />
                Sync
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedConnector(connector);
                  setShowConfigDialog(true);
                }}
              >
                <Settings2 className="h-4 w-4" />
              </Button>
            </>
          )}
          
          <Button
            variant={connector.status === 'connected' ? 'destructive' : 'default'}
            size="sm"
            onClick={() => connector.status === 'connected' ? handleDisconnect(connector) : handleConnect(connector)}
            disabled={isLoading}
          >
            {connector.status === 'connected' ? (
              <>
                <Unlink className="h-4 w-4 mr-1" />
                Desconectar
              </>
            ) : (
              <>
                <Link2 className="h-4 w-4 mr-1" />
                Conectar
              </>
            )}
          </Button>
        </div>
      </div>
    );
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Link2 className="h-5 w-5" />
              Conectores & Integrações
            </CardTitle>
            <CardDescription>
              Integre o Flowalt com serviços externos para automatizar importação de dados
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <IntegrationWizard />
            <Button variant="outline" onClick={handleAnalyzePatterns}>
              <Sparkles className="h-4 w-4 mr-2" />
              Analisar Padrões
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <Tabs defaultValue="all" className="w-full">
          <TabsList>
            <TabsTrigger value="all">Todos</TabsTrigger>
            <TabsTrigger value="connected">Conectados</TabsTrigger>
            <TabsTrigger value="productivity">Produtividade</TabsTrigger>
            <TabsTrigger value="finance">Financeiro</TabsTrigger>
            <TabsTrigger value="predictive">Sync Preditivo</TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="mt-4 space-y-3">
            {connectors.map(connector => (
              <ConnectorCard key={connector.id} connector={connector} />
            ))}
          </TabsContent>

          <TabsContent value="connected" className="mt-4 space-y-3">
            {connectors.filter(c => c.status === 'connected').length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Link2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhum conector ativo</p>
                <p className="text-sm">Conecte serviços para começar a sincronizar dados</p>
              </div>
            ) : (
              connectors.filter(c => c.status === 'connected').map(connector => (
                <ConnectorCard key={connector.id} connector={connector} />
              ))
            )}
          </TabsContent>

          <TabsContent value="productivity" className="mt-4 space-y-3">
            {connectors
              .filter(c => ['google_calendar', 'google_drive', 'slack', 'zapier'].includes(c.type))
              .map(connector => (
                <ConnectorCard key={connector.id} connector={connector} />
              ))}
          </TabsContent>

          <TabsContent value="finance" className="mt-4 space-y-3">
            {connectors
              .filter(c => ['open_finance', 'nf_emissor'].includes(c.type))
              .map(connector => (
                <ConnectorCard key={connector.id} connector={connector} />
              ))}
          </TabsContent>

          <TabsContent value="predictive" className="mt-4">
            <div className="space-y-4">
              <div className="p-4 bg-muted/50 rounded-lg border">
                <div className="flex items-center gap-2 mb-3">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  <h4 className="font-medium">Sincronização Preditiva</h4>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  Com base nos seus padrões de uso, o Flowalt sugere horários ideais para sincronização automática.
                </p>

                {syncPatterns.length === 0 ? (
                  <div className="text-center py-4">
                    <p className="text-sm text-muted-foreground">
                      Clique em "Analisar Padrões" para gerar sugestões
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {syncPatterns.map((pattern, idx) => (
                      <div key={idx} className="p-3 bg-background rounded-lg border">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium capitalize">
                            {pattern.connectorType.replace('_', ' ')}
                          </span>
                          <Badge variant="outline">
                            {Math.round(pattern.confidence * 100)}% confiança
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">
                          {pattern.suggestedSchedule}
                        </p>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">
                            Horários de pico:
                          </span>
                          <div className="flex gap-1">
                            {pattern.peakUsageHours.map(hour => (
                              <Badge key={hour} variant="secondary" className="text-xs">
                                {hour}h
                              </Badge>
                            ))}
                          </div>
                        </div>
                        <div className="mt-3 flex items-center justify-between">
                          <span className="text-sm">Ativar sync automático</span>
                          <Switch
                            checked={autoSyncEnabled[pattern.connectorType] || false}
                            onCheckedChange={(checked) => 
                              setAutoSyncEnabled(prev => ({
                                ...prev,
                                [pattern.connectorType]: checked
                              }))
                            }
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>

      {/* Connector Config Dialog */}
      <Dialog open={showConfigDialog} onOpenChange={setShowConfigDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              Configurar {selectedConnector?.name}
            </DialogTitle>
            <DialogDescription>
              Configure opções avançadas de sincronização
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {selectedConnector?.type === 'google_calendar' && (
              <>
                <div className="space-y-2">
                  <h4 className="font-medium">Importar Eventos</h4>
                  <p className="text-sm text-muted-foreground">
                    Importe eventos do Google Calendar para a Agenda do Flowalt
                  </p>
                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={() => {
                      const start = new Date();
                      const end = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
                      importCalendarEvents(start, end);
                    }}
                  >
                    <Calendar className="h-4 w-4 mr-2" />
                    Importar próximos 30 dias
                  </Button>
                </div>
                <Separator />
                <div className="space-y-2">
                  <h4 className="font-medium">Sincronização Bidirecional</h4>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Criar eventos no Calendar ao criar no Flowalt</span>
                    <Switch />
                  </div>
                </div>
              </>
            )}

            {selectedConnector?.type === 'open_finance' && (
              <>
                <div className="space-y-2">
                  <h4 className="font-medium">Importar Transações</h4>
                  <p className="text-sm text-muted-foreground">
                    Importe transações bancárias para conciliação
                  </p>
                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={() => {
                      const start = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
                      const end = new Date();
                      importBankTransactions('account-1', start, end);
                    }}
                  >
                    <Landmark className="h-4 w-4 mr-2" />
                    Importar últimos 30 dias
                  </Button>
                </div>
                <Separator />
                <div className="space-y-2">
                  <h4 className="font-medium">Conciliação Automática</h4>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Sugerir vínculos automaticamente</span>
                    <Switch defaultChecked />
                  </div>
                </div>
              </>
            )}

            {!['google_calendar', 'open_finance'].includes(selectedConnector?.type || '') && (
              <div className="text-center py-8 text-muted-foreground">
                <Settings2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Configurações avançadas em breve</p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfigDialog(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Integration Wizard for Open Finance & NF Emissor */}
      <IntegrationWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        initialIntegration={wizardIntegration}
        hideTrigger
      />
    </Card>
  );
}
