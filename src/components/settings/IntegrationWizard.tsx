import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Landmark,
  FileText,
  CreditCard,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  ExternalLink,
  Shield,
  Zap,
  Plus,
  KeyRound,
  Banknote,
  Receipt,
  Link2,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';

// Integration types
type IntegrationType = 'sicredi' | 'pluggy' | 'espiao_nfe';

interface IntegrationConfig {
  id: IntegrationType;
  name: string;
  description: string;
  icon: React.ReactNode;
  category: 'banking' | 'finance' | 'fiscal';
  fields: FieldConfig[];
  docsUrl: string;
  features: string[];
}

interface FieldConfig {
  name: string;
  label: string;
  type: 'text' | 'password' | 'select';
  placeholder?: string;
  description?: string;
  required: boolean;
  options?: { label: string; value: string }[];
}

const integrations: IntegrationConfig[] = [
  {
    id: 'sicredi',
    name: 'Sicredi API',
    description: 'Integração com a API do Sicredi para emissão e gestão de boletos, consulta de extratos e PIX.',
    icon: <Landmark className="h-6 w-6" />,
    category: 'banking',
    docsUrl: 'https://desenvolvedores.sicredi.com.br/',
    features: [
      'Emissão de boletos registrados',
      'Consulta de status de boletos',
      'Baixa automática de boletos pagos',
      'Extrato bancário em tempo real',
      'Pagamentos e transferências via PIX',
    ],
    fields: [
      {
        name: 'client_id',
        label: 'Client ID',
        type: 'text',
        placeholder: 'Seu Client ID do Portal do Desenvolvedor',
        description: 'Obtido no Portal do Desenvolvedor Sicredi',
        required: true,
      },
      {
        name: 'client_secret',
        label: 'Client Secret',
        type: 'password',
        placeholder: '••••••••••••••••',
        description: 'Chave secreta para autenticação',
        required: true,
      },
      {
        name: 'beneficiario_codigo',
        label: 'Código do Beneficiário',
        type: 'text',
        placeholder: 'Ex: 12345',
        description: 'Código do beneficiário na Sicredi',
        required: true,
      },
      {
        name: 'ambiente',
        label: 'Ambiente',
        type: 'select',
        description: 'Ambiente de execução da API',
        required: true,
        options: [
          { label: 'Sandbox (Testes)', value: 'sandbox' },
          { label: 'Produção', value: 'production' },
        ],
      },
    ],
  },
  {
    id: 'pluggy',
    name: 'Pluggy (Open Finance)',
    description: 'Conexão com Open Finance para busca automática de boletos em aberto (DDA) e importação de transações bancárias.',
    icon: <CreditCard className="h-6 w-6" />,
    category: 'finance',
    docsUrl: 'https://docs.pluggy.ai/',
    features: [
      'Busca de boletos em aberto (DDA)',
      'Importação de transações bancárias',
      'Conexão com múltiplos bancos',
      'Conciliação automática',
      'Saldos em tempo real',
    ],
    fields: [
      {
        name: 'client_id',
        label: 'Client ID',
        type: 'text',
        placeholder: 'Seu Client ID da Pluggy',
        description: 'Obtido no Dashboard da Pluggy',
        required: true,
      },
      {
        name: 'client_secret',
        label: 'Client Secret',
        type: 'password',
        placeholder: '••••••••••••••••',
        description: 'Chave secreta para autenticação',
        required: true,
      },
    ],
  },
  {
    id: 'espiao_nfe',
    name: 'Espião NFe',
    description: 'Consulta automática de Notas Fiscais emitidas contra o CNPJ da empresa.',
    icon: <FileText className="h-6 w-6" />,
    category: 'fiscal',
    docsUrl: 'https://www.espiaonfe.com.br/',
    features: [
      'Consulta de NFe por CNPJ',
      'Download automático de XML',
      'Manifestação de destinatário',
      'Alertas de novas NFe',
      'Histórico completo de notas',
    ],
    fields: [
      {
        name: 'api_token',
        label: 'Token da API',
        type: 'password',
        placeholder: '••••••••••••••••',
        description: 'Token de acesso obtido no painel do Espião NFe',
        required: true,
      },
      {
        name: 'cnpj',
        label: 'CNPJ da Empresa',
        type: 'text',
        placeholder: '00.000.000/0001-00',
        description: 'CNPJ para consulta de NFe',
        required: true,
      },
    ],
  },
];

const categoryLabels = {
  banking: { label: 'Bancário', icon: <Landmark className="h-4 w-4" /> },
  finance: { label: 'Financeiro', icon: <Banknote className="h-4 w-4" /> },
  fiscal: { label: 'Fiscal', icon: <Receipt className="h-4 w-4" /> },
};

interface IntegrationStatus {
  is_active: boolean;
  configured_at: string;
  updated_at: string;
  last_sync_at?: string;
  sync_status?: string;
}

interface IntegrationWizardProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  initialIntegration?: IntegrationType;
}

export function IntegrationWizard({ open, onOpenChange, initialIntegration }: IntegrationWizardProps) {
  const { currentWorkspace } = useWorkspace();
  const [isOpen, setIsOpen] = useState(open ?? false);
  const [step, setStep] = useState<'select' | 'configure' | 'complete'>('select');
  const [selectedIntegration, setSelectedIntegration] = useState<IntegrationConfig | null>(
    initialIntegration ? integrations.find(i => i.id === initialIntegration) || null : null
  );
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);
  const [integrationStatuses, setIntegrationStatuses] = useState<Record<string, IntegrationStatus>>({});

  // Fetch integration statuses on mount
  useEffect(() => {
    if (currentWorkspace && isOpen) {
      fetchIntegrationStatuses();
    }
  }, [currentWorkspace, isOpen]);

  const fetchIntegrationStatuses = async () => {
    if (!currentWorkspace) return;

    try {
      const { data, error } = await supabase
        .from('integration_credentials')
        .select('integration_type, is_active, configured_at, updated_at, last_sync_at, sync_status')
        .eq('workspace_id', currentWorkspace.id);

      if (error) throw error;

      const statusMap: Record<string, IntegrationStatus> = {};
      for (const item of data || []) {
        statusMap[item.integration_type] = {
          is_active: item.is_active || false,
          configured_at: item.configured_at,
          updated_at: item.updated_at,
          last_sync_at: item.last_sync_at || undefined,
          sync_status: item.sync_status || undefined,
        };
      }
      setIntegrationStatuses(statusMap);
    } catch (error) {
      console.error('Error fetching integration statuses:', error);
    }
  };

  const handleOpenChange = (value: boolean) => {
    setIsOpen(value);
    onOpenChange?.(value);
    if (!value) {
      resetWizard();
    }
  };

  const resetWizard = () => {
    setStep('select');
    setSelectedIntegration(null);
    setFormData({});
    setShowSecrets({});
    setTestResult(null);
  };

  const handleSelectIntegration = (integration: IntegrationConfig) => {
    setSelectedIntegration(integration);
    
    // If already configured, pre-fill with empty values (we don't show actual secrets)
    if (integrationStatuses[integration.id]) {
      toast.info('Esta integração já está configurada. Preencha novamente para atualizar as credenciais.');
    }
    
    setStep('configure');
  };

  const handleFieldChange = (fieldName: string, value: string) => {
    setFormData(prev => ({ ...prev, [fieldName]: value }));
    setTestResult(null); // Reset test when data changes
  };

  const toggleSecretVisibility = (fieldName: string) => {
    setShowSecrets(prev => ({ ...prev, [fieldName]: !prev[fieldName] }));
  };

  const validateForm = (): boolean => {
    if (!selectedIntegration) return false;
    
    for (const field of selectedIntegration.fields) {
      if (field.required && !formData[field.name]?.trim()) {
        toast.error(`O campo "${field.label}" é obrigatório`);
        return false;
      }
    }
    return true;
  };

  const handleTestConnection = async () => {
    if (!validateForm() || !currentWorkspace || !selectedIntegration) return;
    
    setIsTesting(true);
    setTestResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('integration-manager/test', {
        body: { 
          integration_type: selectedIntegration.id,
          workspace_id: currentWorkspace.id
        }
      });

      if (error) throw error;

      if (data?.success) {
        setTestResult('success');
        toast.success('Teste de conexão realizado com sucesso!');
      } else {
        setTestResult('error');
        toast.error(data?.message || 'Falha no teste de conexão');
      }
    } catch (error: unknown) {
      setTestResult('error');
      const errMsg = error instanceof Error ? error.message : 'Erro ao testar conexão';
      toast.error(errMsg);
    } finally {
      setIsTesting(false);
    }
  };

  const handleSaveIntegration = async () => {
    if (!validateForm() || !currentWorkspace || !selectedIntegration) return;

    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('integration-manager/save', {
        body: {
          integration_type: selectedIntegration.id,
          workspace_id: currentWorkspace.id,
          credentials: formData
        }
      });

      if (error) throw error;

      if (data?.success) {
        setStep('complete');
        toast.success('Integração configurada com sucesso!');
        fetchIntegrationStatuses(); // Refresh statuses
      } else {
        throw new Error(data?.error || 'Falha ao salvar credenciais');
      }
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : 'Erro ao salvar integração';
      toast.error(errMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const renderSelectStep = () => (
    <div className="space-y-6">
      <div className="grid gap-4">
        {Object.entries(categoryLabels).map(([category, { label, icon }]) => (
          <div key={category}>
            <div className="flex items-center gap-2 mb-3">
              {icon}
              <h3 className="font-medium">{label}</h3>
            </div>
            <div className="grid gap-3">
              {integrations
                .filter(i => i.category === category)
                .map(integration => {
                  const isConfigured = !!integrationStatuses[integration.id];
                  
                  return (
                    <Card
                      key={integration.id}
                      className={`cursor-pointer transition-all hover:border-primary hover:shadow-md ${
                        isConfigured ? 'border-green-500/50 bg-green-500/5' : ''
                      }`}
                      onClick={() => handleSelectIntegration(integration)}
                    >
                      <CardContent className="flex items-center gap-4 p-4">
                        <div className={`p-3 rounded-lg ${
                          isConfigured ? 'bg-green-500/10 text-green-600' : 'bg-primary/10 text-primary'
                        }`}>
                          {integration.icon}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium">{integration.name}</h4>
                            {isConfigured && (
                              <Badge variant="outline" className="border-green-500 text-green-600 text-xs">
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                Configurado
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground line-clamp-1">
                            {integration.description}
                          </p>
                        </div>
                        <ArrowRight className="h-5 w-5 text-muted-foreground" />
                      </CardContent>
                    </Card>
                  );
                })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderConfigureStep = () => {
    if (!selectedIntegration) return null;
    const isReconfiguring = !!integrationStatuses[selectedIntegration.id];

    return (
      <div className="space-y-6">
        {/* Integration Header */}
        <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg">
          <div className="p-3 rounded-lg bg-primary/10 text-primary">
            {selectedIntegration.icon}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-medium">{selectedIntegration.name}</h3>
              {isReconfiguring && (
                <Badge variant="outline" className="border-amber-500 text-amber-600">
                  <RefreshCw className="h-3 w-3 mr-1" />
                  Reconfigurando
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {selectedIntegration.description}
            </p>
          </div>
          <Button variant="outline" size="sm" asChild>
            <a href={selectedIntegration.docsUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4 mr-2" />
              Docs
            </a>
          </Button>
        </div>

        {/* Features */}
        <div className="p-4 border rounded-lg">
          <h4 className="font-medium mb-3 flex items-center gap-2">
            <Zap className="h-4 w-4" />
            Funcionalidades
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {selectedIntegration.features.map((feature, idx) => (
              <div key={idx} className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                {feature}
              </div>
            ))}
          </div>
        </div>

        <Separator />

        {/* Credentials Form */}
        <div className="space-y-4">
          <h4 className="font-medium flex items-center gap-2">
            <KeyRound className="h-4 w-4" />
            Credenciais
          </h4>

          {selectedIntegration.fields.map(field => (
            <div key={field.name} className="space-y-2">
              <Label htmlFor={field.name}>
                {field.label}
                {field.required && <span className="text-destructive ml-1">*</span>}
              </Label>
              
              {field.type === 'select' ? (
                <Select
                  value={formData[field.name] || ''}
                  onValueChange={(value) => handleFieldChange(field.name, value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {field.options?.map(option => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="relative">
                  <Input
                    id={field.name}
                    type={field.type === 'password' && !showSecrets[field.name] ? 'password' : 'text'}
                    placeholder={field.placeholder}
                    value={formData[field.name] || ''}
                    onChange={(e) => handleFieldChange(field.name, e.target.value)}
                    className="pr-10"
                  />
                  {field.type === 'password' && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full px-3"
                      onClick={() => toggleSecretVisibility(field.name)}
                    >
                      {showSecrets[field.name] ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  )}
                </div>
              )}
              
              {field.description && (
                <p className="text-xs text-muted-foreground">{field.description}</p>
              )}
            </div>
          ))}
        </div>

        {/* Security Notice */}
        <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
          <div className="flex items-start gap-3">
            <Shield className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
            <div>
              <h5 className="font-medium text-amber-800 dark:text-amber-200">
                Segurança
              </h5>
              <p className="text-sm text-amber-700 dark:text-amber-300">
                Suas credenciais são criptografadas e armazenadas de forma segura no banco de dados. 
                Apenas membros com acesso financeiro podem visualizar e gerenciar integrações.
              </p>
            </div>
          </div>
        </div>

        {/* Test Result */}
        {testResult && (
          <div className={`p-4 rounded-lg flex items-center gap-3 ${
            testResult === 'success' 
              ? 'bg-green-500/10 border border-green-500/20' 
              : 'bg-red-500/10 border border-red-500/20'
          }`}>
            {testResult === 'success' ? (
              <>
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <span className="text-green-700 dark:text-green-300">
                  Conexão validada com sucesso!
                </span>
              </>
            ) : (
              <>
                <AlertCircle className="h-5 w-5 text-red-600" />
                <span className="text-red-700 dark:text-red-300">
                  Verifique suas credenciais e tente novamente.
                </span>
              </>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderCompleteStep = () => (
    <div className="text-center py-8 space-y-6">
      <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto">
        <CheckCircle2 className="h-8 w-8 text-green-600" />
      </div>
      
      <div>
        <h3 className="text-xl font-semibold">Integração Configurada!</h3>
        <p className="text-muted-foreground mt-2">
          A integração com {selectedIntegration?.name} foi salva com sucesso.
        </p>
      </div>

      <div className="p-4 bg-muted/50 rounded-lg text-left">
        <h4 className="font-medium mb-2">Próximos passos:</h4>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            Credenciais salvas e criptografadas
          </li>
          <li className="flex items-center gap-2">
            <ArrowRight className="h-4 w-4" />
            Acesse o módulo Financeiro para usar as funcionalidades
          </li>
          <li className="flex items-center gap-2">
            <ArrowRight className="h-4 w-4" />
            Configure automações para sincronização periódica
          </li>
        </ul>
      </div>
    </div>
  );

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Configurar Integração
        </Button>
      </DialogTrigger>
      
      <DialogContent className="sm:max-w-[600px] max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            {step === 'select' && 'Selecionar Integração'}
            {step === 'configure' && `Configurar ${selectedIntegration?.name}`}
            {step === 'complete' && 'Integração Completa'}
          </DialogTitle>
          <DialogDescription>
            {step === 'select' && 'Escolha uma integração para configurar as credenciais da API'}
            {step === 'configure' && 'Preencha as credenciais para conectar com o serviço'}
            {step === 'complete' && 'Sua integração está pronta para uso'}
          </DialogDescription>
        </DialogHeader>

        {/* Progress Steps */}
        <div className="flex items-center justify-center gap-2 py-4">
          {['select', 'configure', 'complete'].map((s, idx) => {
            const stepIndex = ['select', 'configure', 'complete'].indexOf(step);
            const thisIndex = idx;
            const isComplete = stepIndex > thisIndex;
            const isCurrent = step === s;
            
            return (
              <div key={s} className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  isCurrent
                    ? 'bg-primary text-primary-foreground' 
                    : isComplete
                      ? 'bg-green-500 text-white'
                      : 'bg-muted text-muted-foreground'
                }`}>
                  {isComplete ? <CheckCircle2 className="h-4 w-4" /> : idx + 1}
                </div>
                {idx < 2 && (
                  <div className={`w-12 h-0.5 ${isComplete ? 'bg-green-500' : 'bg-muted'}`} />
                )}
              </div>
            );
          })}
        </div>

        <ScrollArea className="max-h-[50vh] pr-4">
          {step === 'select' && renderSelectStep()}
          {step === 'configure' && renderConfigureStep()}
          {step === 'complete' && renderCompleteStep()}
        </ScrollArea>

        {/* Actions */}
        <div className="flex justify-between pt-4 border-t">
          {step === 'select' && (
            <>
              <div />
              <Button variant="outline" onClick={() => handleOpenChange(false)}>
                Fechar
              </Button>
            </>
          )}
          
          {step === 'configure' && (
            <>
              <Button variant="outline" onClick={() => setStep('select')}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar
              </Button>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  onClick={handleTestConnection}
                  disabled={isTesting || isLoading}
                >
                  {isTesting ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Zap className="h-4 w-4 mr-2" />
                  )}
                  Testar
                </Button>
                <Button 
                  onClick={handleSaveIntegration}
                  disabled={isLoading || isTesting}
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                  )}
                  Salvar Credenciais
                </Button>
              </div>
            </>
          )}
          
          {step === 'complete' && (
            <>
              <Button variant="outline" onClick={() => {
                resetWizard();
                setStep('select');
              }}>
                Configurar outra
              </Button>
              <Button onClick={() => handleOpenChange(false)}>
                Concluir
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
