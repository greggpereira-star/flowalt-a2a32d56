import React, { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useClientCard, useUpdateClientCard, useDeleteClientCard, useClientFinancials, useUpdateClientFinancials, ClientCard, ClientFinancials, ClientStatus } from '@/hooks/useClientCards';
import { useWorkspaceMembers } from '@/hooks/useWorkspaceMembers';
import { usePermissions } from '@/hooks/usePermissions';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  Building2, 
  Users, 
  Palette, 
  MessageSquare, 
  FileText, 
  DollarSign,
  Save,
  X,
  Link as LinkIcon,
  Plus,
  Trash2,
  Heart,
  Target,
  Briefcase,
  AlertTriangle,
  Lock,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Settings2,
  Calculator,
  LayoutList
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { ClientReportTab } from './ClientReportTab';
import { ClientPoliciesTab } from './ClientPoliciesTab';
import { ContractSimulatorTab } from './ContractSimulatorTab';
import { ClientTasksTab } from './ClientTasksTab';
import { ClientLogoUpload } from './ClientLogoUpload';

interface ClientCardSheetProps {
  clientId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const statusConfig: Record<ClientStatus, { label: string; color: string }> = {
  active: { label: 'Ativo', color: 'bg-green-100 text-green-700' },
  paused: { label: 'Pausado', color: 'bg-amber-100 text-amber-700' },
  closed: { label: 'Encerrado', color: 'bg-red-100 text-red-700' },
};

const financialStateConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  healthy: { label: 'Saudável', color: 'bg-green-100 text-green-700', icon: TrendingUp },
  attention: { label: 'Atenção', color: 'bg-amber-100 text-amber-700', icon: AlertTriangle },
  critical: { label: 'Crítico', color: 'bg-red-100 text-red-700', icon: TrendingDown },
  loss: { label: 'Prejuízo', color: 'bg-red-200 text-red-800', icon: TrendingDown },
};

// Tab components for better organization
const IdentityTab: React.FC<{ 
  client: ClientCard; 
  formData: Partial<ClientCard>; 
  setFormData: React.Dispatch<React.SetStateAction<Partial<ClientCard>>>;
  members: any[];
}> = ({ client, formData, setFormData, members }) => {
  const addLink = () => {
    const links = [...(formData.important_links || []), { label: '', url: '' }];
    setFormData(prev => ({ ...prev, important_links: links }));
  };

  const updateLink = (index: number, field: 'label' | 'url', value: string) => {
    const links = [...(formData.important_links || [])];
    links[index] = { ...links[index], [field]: value };
    setFormData(prev => ({ ...prev, important_links: links }));
  };

  const removeLink = (index: number) => {
    const links = (formData.important_links || []).filter((_, i) => i !== index);
    setFormData(prev => ({ ...prev, important_links: links }));
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="name">Nome do Cliente</Label>
          <Input
            id="name"
            value={formData.name || ''}
            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            placeholder="Nome do cliente"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="segment">Segmento</Label>
          <Input
            id="segment"
            value={formData.segment || ''}
            onChange={(e) => setFormData(prev => ({ ...prev, segment: e.target.value }))}
            placeholder="Ex: Tecnologia, Varejo..."
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="status">Status</Label>
          <Select
            value={formData.status}
            onValueChange={(value: ClientStatus) => setFormData(prev => ({ ...prev, status: value }))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Ativo</SelectItem>
              <SelectItem value="paused">Pausado</SelectItem>
              <SelectItem value="closed">Encerrado</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="start_date">Data de Início</Label>
          <Input
            id="start_date"
            type="date"
            value={formData.start_date || ''}
            onChange={(e) => setFormData(prev => ({ ...prev, start_date: e.target.value }))}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="responsible">Responsável Interno</Label>
        <Select
          value={formData.responsible_user_id || ''}
          onValueChange={(value) => setFormData(prev => ({ ...prev, responsible_user_id: value }))}
        >
          <SelectTrigger>
            <SelectValue placeholder="Selecione o responsável" />
          </SelectTrigger>
          <SelectContent>
            {members?.map((member) => (
              <SelectItem key={member.user_id} value={member.user_id}>
                {member.profiles?.full_name || member.profiles?.email || 'Usuário'}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="color">Cor do Cliente</Label>
          <div className="flex gap-2">
            <Input
              id="color"
              type="color"
              value={formData.color || '#6366f1'}
              onChange={(e) => setFormData(prev => ({ ...prev, color: e.target.value }))}
              className="w-12 h-10 p-1 cursor-pointer"
            />
            <Input
              value={formData.color || '#6366f1'}
              onChange={(e) => setFormData(prev => ({ ...prev, color: e.target.value }))}
              placeholder="#6366f1"
              className="flex-1"
            />
          </div>
        </div>
        <ClientLogoUpload
          currentLogoUrl={formData.logo_url}
          clientColor={formData.color}
          clientName={formData.name || client.name}
          onUpload={(url) => setFormData(prev => ({ ...prev, logo_url: url }))}
          onRemove={() => setFormData(prev => ({ ...prev, logo_url: '' }))}
        />
      </div>

      {/* Links importantes */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Links Importantes</Label>
          <Button variant="outline" size="sm" onClick={addLink}>
            <Plus className="h-3 w-3 mr-1" />
            Adicionar
          </Button>
        </div>
        {(formData.important_links || []).map((link, index) => (
          <div key={index} className="flex gap-2 items-center">
            <Input
              value={link.label}
              onChange={(e) => updateLink(index, 'label', e.target.value)}
              placeholder="Nome do link"
              className="w-1/3"
            />
            <Input
              value={link.url}
              onChange={(e) => updateLink(index, 'url', e.target.value)}
              placeholder="https://..."
              className="flex-1"
            />
            <Button variant="ghost" size="icon" onClick={() => removeLink(index)}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
};

const OnboardingTab: React.FC<{ 
  formData: Partial<ClientCard>; 
  setFormData: React.Dispatch<React.SetStateAction<Partial<ClientCard>>>;
}> = ({ formData, setFormData }) => (
  <div className="space-y-4">
    <div className="space-y-2">
      <Label htmlFor="about_client">Quem é o cliente</Label>
      <Textarea
        id="about_client"
        value={formData.about_client || ''}
        onChange={(e) => setFormData(prev => ({ ...prev, about_client: e.target.value }))}
        placeholder="Descreva quem é esse cliente, sua história, contexto..."
        rows={3}
      />
    </div>
    <div className="space-y-2">
      <Label htmlFor="objectives">Objetivos</Label>
      <Textarea
        id="objectives"
        value={formData.objectives || ''}
        onChange={(e) => setFormData(prev => ({ ...prev, objectives: e.target.value }))}
        placeholder="Quais são os objetivos do cliente conosco?"
        rows={3}
      />
    </div>
    <div className="space-y-2">
      <Label htmlFor="target_audience">Público-alvo</Label>
      <Textarea
        id="target_audience"
        value={formData.target_audience || ''}
        onChange={(e) => setFormData(prev => ({ ...prev, target_audience: e.target.value }))}
        placeholder="Quem é o público-alvo do cliente?"
        rows={2}
      />
    </div>
    <div className="space-y-2">
      <Label htmlFor="challenges">Desafios</Label>
      <Textarea
        id="challenges"
        value={formData.challenges || ''}
        onChange={(e) => setFormData(prev => ({ ...prev, challenges: e.target.value }))}
        placeholder="Quais são os principais desafios?"
        rows={2}
      />
    </div>
    <div className="space-y-2">
      <Label htmlFor="competitors">Concorrentes</Label>
      <Textarea
        id="competitors"
        value={formData.competitors || ''}
        onChange={(e) => setFormData(prev => ({ ...prev, competitors: e.target.value }))}
        placeholder="Quem são os concorrentes?"
        rows={2}
      />
    </div>
    <div className="space-y-2">
      <Label htmlFor="relationship_tone">Tom de Relacionamento</Label>
      <Input
        id="relationship_tone"
        value={formData.relationship_tone || ''}
        onChange={(e) => setFormData(prev => ({ ...prev, relationship_tone: e.target.value }))}
        placeholder="Ex: Formal, Casual, Técnico..."
      />
    </div>
  </div>
);

const BrandingTab: React.FC<{ 
  formData: Partial<ClientCard>; 
  setFormData: React.Dispatch<React.SetStateAction<Partial<ClientCard>>>;
}> = ({ formData, setFormData }) => (
  <div className="space-y-4">
    <div className="space-y-2">
      <Label htmlFor="positioning">Posicionamento</Label>
      <Textarea
        id="positioning"
        value={formData.positioning || ''}
        onChange={(e) => setFormData(prev => ({ ...prev, positioning: e.target.value }))}
        placeholder="Como a marca se posiciona no mercado?"
        rows={3}
      />
    </div>
    <div className="space-y-2">
      <Label htmlFor="personality">Personalidade da Marca</Label>
      <Textarea
        id="personality"
        value={formData.personality || ''}
        onChange={(e) => setFormData(prev => ({ ...prev, personality: e.target.value }))}
        placeholder="Quais são os traços de personalidade da marca?"
        rows={3}
      />
    </div>
    <div className="space-y-2">
      <Label htmlFor="visual_guidelines">Diretrizes Visuais</Label>
      <Textarea
        id="visual_guidelines"
        value={formData.visual_guidelines || ''}
        onChange={(e) => setFormData(prev => ({ ...prev, visual_guidelines: e.target.value }))}
        placeholder="Cores, tipografia, elementos visuais..."
        rows={3}
      />
    </div>
    <Card className="border-dashed">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-muted-foreground">
          <FileText className="h-5 w-5" />
          <span className="text-sm">Upload de arquivos (brandbook, logos) - Em breve</span>
        </div>
      </CardContent>
    </Card>
  </div>
);

const VoiceTab: React.FC<{ 
  formData: Partial<ClientCard>; 
  setFormData: React.Dispatch<React.SetStateAction<Partial<ClientCard>>>;
}> = ({ formData, setFormData }) => {
  const [keywordInput, setKeywordInput] = useState('');

  const addKeyword = () => {
    if (keywordInput.trim()) {
      setFormData(prev => ({ 
        ...prev, 
        keywords: [...(prev.keywords || []), keywordInput.trim()] 
      }));
      setKeywordInput('');
    }
  };

  const removeKeyword = (index: number) => {
    setFormData(prev => ({
      ...prev,
      keywords: (prev.keywords || []).filter((_, i) => i !== index)
    }));
  };

  return (
    <div className="space-y-4">
      <Card className="bg-muted/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Heart className="h-4 w-4 text-pink-500" />
            É (Essência)
          </CardTitle>
          <CardDescription>Valores e essência da marca</CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={formData.brand_essence || ''}
            onChange={(e) => setFormData(prev => ({ ...prev, brand_essence: e.target.value }))}
            placeholder="O que a marca É em sua essência?"
            rows={2}
          />
        </CardContent>
      </Card>

      <Card className="bg-muted/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-blue-500" />
            Faz (Produtos/Serviços)
          </CardTitle>
          <CardDescription>O que a marca oferece</CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={formData.products_services || ''}
            onChange={(e) => setFormData(prev => ({ ...prev, products_services: e.target.value }))}
            placeholder="Quais produtos ou serviços oferece?"
            rows={2}
          />
        </CardContent>
      </Card>

      <Card className="bg-muted/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-green-500" />
            Fala (Linguagem)
          </CardTitle>
          <CardDescription>Como a marca se comunica</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <Label>Estilo de Linguagem</Label>
            <Input
              value={formData.language_style || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, language_style: e.target.value }))}
              placeholder="Ex: Informal e próximo, Técnico e preciso..."
            />
          </div>
          
          <div className="space-y-2">
            <Label>Palavras-chave</Label>
            <div className="flex gap-2">
              <Input
                value={keywordInput}
                onChange={(e) => setKeywordInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addKeyword())}
                placeholder="Digite e pressione Enter"
              />
              <Button variant="outline" size="sm" onClick={addKeyword}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-1 mt-2">
              {(formData.keywords || []).map((kw, i) => (
                <Badge key={i} variant="secondary" className="gap-1">
                  {kw}
                  <button onClick={() => removeKeyword(i)} className="ml-1 hover:text-destructive">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Restrições de Linguagem</Label>
            <Textarea
              value={formData.language_restrictions || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, language_restrictions: e.target.value }))}
              placeholder="Palavras ou expressões que não devem ser usadas..."
              rows={2}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

const ContractTab: React.FC<{ 
  formData: Partial<ClientCard>; 
  setFormData: React.Dispatch<React.SetStateAction<Partial<ClientCard>>>;
}> = ({ formData, setFormData }) => {
  const [serviceInput, setServiceInput] = useState('');

  const addService = () => {
    if (serviceInput.trim()) {
      setFormData(prev => ({ 
        ...prev, 
        contracted_services: [...(prev.contracted_services || []), serviceInput.trim()] 
      }));
      setServiceInput('');
    }
  };

  const removeService = (index: number) => {
    setFormData(prev => ({
      ...prev,
      contracted_services: (prev.contracted_services || []).filter((_, i) => i !== index)
    }));
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="contract_type">Tipo de Contrato</Label>
        <Select
          value={formData.contract_type || ''}
          onValueChange={(value) => setFormData(prev => ({ ...prev, contract_type: value }))}
        >
          <SelectTrigger>
            <SelectValue placeholder="Selecione o tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="fee_mensal">Fee Mensal</SelectItem>
            <SelectItem value="projeto">Por Projeto</SelectItem>
            <SelectItem value="hora">Por Hora</SelectItem>
            <SelectItem value="hibrido">Híbrido</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Serviços Contratados</Label>
        <div className="flex gap-2">
          <Input
            value={serviceInput}
            onChange={(e) => setServiceInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addService())}
            placeholder="Ex: Social Media, Design..."
          />
          <Button variant="outline" size="sm" onClick={addService}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex flex-wrap gap-1 mt-2">
          {(formData.contracted_services || []).map((service, i) => (
            <Badge key={i} variant="outline" className="gap-1">
              {service}
              <button onClick={() => removeService(i)} className="ml-1 hover:text-destructive">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="agreed_deliverables">Entregas Acordadas</Label>
        <Textarea
          id="agreed_deliverables"
          value={formData.agreed_deliverables || ''}
          onChange={(e) => setFormData(prev => ({ ...prev, agreed_deliverables: e.target.value }))}
          placeholder="Liste as entregas acordadas em contrato..."
          rows={3}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="scope_limits">Limites de Escopo</Label>
        <Textarea
          id="scope_limits"
          value={formData.scope_limits || ''}
          onChange={(e) => setFormData(prev => ({ ...prev, scope_limits: e.target.value }))}
          placeholder="O que NÃO está incluído no contrato..."
          rows={3}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="contract_notes">Observações Contratuais</Label>
        <Textarea
          id="contract_notes"
          value={formData.contract_notes || ''}
          onChange={(e) => setFormData(prev => ({ ...prev, contract_notes: e.target.value }))}
          placeholder="Outras observações importantes..."
          rows={3}
        />
      </div>
    </div>
  );
};

const FinancialTab: React.FC<{
  clientId: string;
  canViewFinancials: boolean;
}> = ({ clientId, canViewFinancials }) => {
  const { data: financials, isLoading } = useClientFinancials(clientId);
  const updateFinancials = useUpdateClientFinancials();
  const [formData, setFormData] = useState<Partial<ClientFinancials>>({});

  useEffect(() => {
    if (financials) {
      setFormData(financials);
    }
  }, [financials]);

  const handleSave = () => {
    if (formData.id) {
      updateFinancials.mutate({ id: formData.id, ...formData });
    }
  };

  if (!canViewFinancials) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Lock className="h-12 w-12 text-muted-foreground/50 mb-4" />
        <h3 className="font-medium text-muted-foreground mb-1">Acesso Restrito</h3>
        <p className="text-sm text-muted-foreground/80">
          Você não tem permissão para ver os dados financeiros deste cliente.
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="border-amber-200 bg-amber-50/50">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-amber-700">
            <Lock className="h-4 w-4" />
            <span className="text-sm font-medium">Dados restritos - Visível apenas para Coordenação/Sócios</span>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="contract_value">Valor do Contrato</Label>
          <Input
            id="contract_value"
            type="number"
            value={formData.contract_value || ''}
            onChange={(e) => setFormData(prev => ({ ...prev, contract_value: parseFloat(e.target.value) || 0 }))}
            placeholder="R$ 0,00"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="billing_type">Tipo de Cobrança</Label>
          <Select
            value={formData.billing_type || ''}
            onValueChange={(value) => setFormData(prev => ({ ...prev, billing_type: value }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="mensal">Mensal</SelectItem>
              <SelectItem value="projeto">Por Projeto</SelectItem>
              <SelectItem value="hora">Por Hora</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="expected_margin">Margem Esperada (%)</Label>
        <Input
          id="expected_margin"
          type="number"
          value={formData.expected_margin || ''}
          onChange={(e) => setFormData(prev => ({ ...prev, expected_margin: parseFloat(e.target.value) || 0 }))}
          placeholder="30"
        />
      </div>

      {/* Métricas Calculadas */}
      <Separator />
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-green-600">
              R$ {((financials?.total_revenue || 0) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-muted-foreground">Receita Total</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-red-600">
              R$ {((financials?.total_cost || 0) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-muted-foreground">Custo Total</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{financials?.total_hours || 0}h</p>
            <p className="text-xs text-muted-foreground">Horas Consumidas</p>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-2">
        <Label htmlFor="financial_notes">Observações Financeiras</Label>
        <Textarea
          id="financial_notes"
          value={formData.financial_notes || ''}
          onChange={(e) => setFormData(prev => ({ ...prev, financial_notes: e.target.value }))}
          placeholder="Notas sobre faturamento, ajustes, etc..."
          rows={3}
        />
      </div>

      <Button onClick={handleSave} disabled={updateFinancials.isPending} className="w-full">
        <Save className="h-4 w-4 mr-2" />
        {updateFinancials.isPending ? 'Salvando...' : 'Salvar Financeiro'}
      </Button>
    </div>
  );
};

export const ClientCardSheet: React.FC<ClientCardSheetProps> = ({
  clientId,
  open,
  onOpenChange,
}) => {
  const { data: client, isLoading } = useClientCard(clientId || undefined);
  const updateClient = useUpdateClientCard();
  const deleteClient = useDeleteClientCard();
  const { data: members } = useWorkspaceMembers();
  const { canViewClientFinancials, isCoordinator, isAdmin, isOwner } = usePermissions();
  
  const [formData, setFormData] = useState<Partial<ClientCard>>({});
  const [activeTab, setActiveTab] = useState('identity');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const canEditFinancials = canViewClientFinancials || isCoordinator || isAdmin || isOwner;
  const canDelete = isAdmin || isOwner;

  useEffect(() => {
    if (client) {
      setFormData(client);
    }
  }, [client]);

  const handleSave = () => {
    if (client?.id && formData) {
      updateClient.mutate({ id: client.id, ...formData });
    }
  };

  const handleDelete = () => {
    if (client?.id) {
      deleteClient.mutate(client.id, {
        onSuccess: () => {
          onOpenChange(false);
        }
      });
    }
  };

  const stateConfig = financialStateConfig[client?.financial_state || 'healthy'];
  const StateIcon = stateConfig?.icon || TrendingUp;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl flex flex-col p-0 gap-0">
        {isLoading ? (
          <div className="space-y-4 p-6">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : client ? (
          <>
            {/* Header fixo */}
            <SheetHeader className="p-6 border-b flex-shrink-0 space-y-0">
              {/* Top row - Avatar, Name, Status badges */}
              <div className="flex items-start gap-4">
                <div 
                  className="w-16 h-16 rounded-xl flex items-center justify-center text-white font-bold text-2xl shadow-lg flex-shrink-0"
                  style={{ backgroundColor: client.color || '#6366f1' }}
                >
                  {client.logo_url ? (
                    <img src={client.logo_url} alt={client.name} className="w-full h-full object-cover rounded-xl" />
                  ) : (
                    client.name.charAt(0).toUpperCase()
                  )}
                </div>
                
                <div className="flex-1 min-w-0 pt-1">
                  <SheetTitle className="text-xl font-semibold truncate mb-1">
                    {client.name}
                  </SheetTitle>
                  {client.segment && (
                    <span className="text-sm text-muted-foreground">{client.segment}</span>
                  )}
                </div>

                <div className="flex flex-col items-end gap-2 flex-shrink-0">
                  <Badge className={cn('text-xs px-3 py-1', statusConfig[client.status].color)}>
                    {statusConfig[client.status].label}
                  </Badge>
                  <Badge variant="outline" className={cn('text-xs gap-1.5 px-2.5 py-1', stateConfig?.color)}>
                    <StateIcon className="h-3 w-3" />
                    {stateConfig?.label}
                  </Badge>
                </div>
              </div>

              {/* Health Score Bar */}
              <div className="mt-5 pt-4 border-t border-border/50">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-muted-foreground">Health Score</span>
                  <span className={cn(
                    'text-sm font-bold',
                    client.health_score >= 80 ? 'text-green-600' :
                    client.health_score >= 60 ? 'text-amber-600' :
                    client.health_score >= 40 ? 'text-orange-600' : 'text-red-600'
                  )}>
                    {client.health_score}/100
                  </span>
                </div>
                <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                  <div 
                    className={cn(
                      'h-full rounded-full transition-all duration-500',
                      client.health_score >= 80 ? 'bg-green-500' :
                      client.health_score >= 60 ? 'bg-amber-500' :
                      client.health_score >= 40 ? 'bg-orange-500' : 'bg-red-500'
                    )}
                    style={{ width: `${client.health_score}%` }}
                  />
                </div>
              </div>

              {/* Actions row - separated for clarity */}
              {canDelete && (
                <div className="mt-4 pt-3 border-t border-border/50">
                  {!showDeleteConfirm ? (
                    <Button 
                      variant="ghost" 
                      size="sm"
                      className="h-8 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 gap-1.5"
                      onClick={() => setShowDeleteConfirm(true)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Excluir cliente
                    </Button>
                  ) : (
                    <div className="p-4 rounded-lg border border-destructive/30 bg-destructive/5">
                      <p className="text-sm text-destructive font-medium mb-1">
                        Excluir cliente "{client.name}"?
                      </p>
                      <p className="text-xs text-muted-foreground mb-4">
                        Esta ação não pode ser desfeita. Todos os dados do cliente serão removidos.
                      </p>
                      <div className="flex gap-2">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="h-8"
                          onClick={() => setShowDeleteConfirm(false)}
                        >
                          Cancelar
                        </Button>
                        <Button 
                          variant="destructive" 
                          size="sm"
                          className="h-8"
                          onClick={handleDelete}
                          disabled={deleteClient.isPending}
                        >
                          {deleteClient.isPending ? 'Excluindo...' : 'Confirmar Exclusão'}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </SheetHeader>

            {/* Tabs com scroll */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
              <div className="px-6 pt-4 flex-shrink-0">
                <TabsList className="w-full grid grid-cols-10 h-auto">
                  <TabsTrigger value="identity" className="flex flex-col gap-0.5 py-2 px-0.5">
                    <Building2 className="h-3.5 w-3.5" />
                    <span className="text-[9px]">Identidade</span>
                  </TabsTrigger>
                  <TabsTrigger value="onboarding" className="flex flex-col gap-0.5 py-2 px-0.5">
                    <Users className="h-3.5 w-3.5" />
                    <span className="text-[9px]">Onboard</span>
                  </TabsTrigger>
                  <TabsTrigger value="branding" className="flex flex-col gap-0.5 py-2 px-0.5">
                    <Palette className="h-3.5 w-3.5" />
                    <span className="text-[9px]">Branding</span>
                  </TabsTrigger>
                  <TabsTrigger value="voice" className="flex flex-col gap-0.5 py-2 px-0.5">
                    <MessageSquare className="h-3.5 w-3.5" />
                    <span className="text-[9px]">Voz</span>
                  </TabsTrigger>
                  <TabsTrigger value="contract" className="flex flex-col gap-0.5 py-2 px-0.5">
                    <FileText className="h-3.5 w-3.5" />
                    <span className="text-[9px]">Contrato</span>
                  </TabsTrigger>
                  <TabsTrigger value="tasks" className="flex flex-col gap-0.5 py-2 px-0.5">
                    <LayoutList className="h-3.5 w-3.5" />
                    <span className="text-[9px]">Tarefas</span>
                  </TabsTrigger>
                  <TabsTrigger value="report" className="flex flex-col gap-0.5 py-2 px-0.5">
                    <BarChart3 className="h-3.5 w-3.5" />
                    <span className="text-[9px]">Relatório</span>
                  </TabsTrigger>
                  <TabsTrigger value="policies" className="flex flex-col gap-0.5 py-2 px-0.5">
                    <Settings2 className="h-3.5 w-3.5" />
                    <span className="text-[9px]">Políticas</span>
                  </TabsTrigger>
                  <TabsTrigger value="simulator" className="flex flex-col gap-0.5 py-2 px-0.5">
                    <Calculator className="h-3.5 w-3.5" />
                    <span className="text-[9px]">Simulador</span>
                  </TabsTrigger>
                  <TabsTrigger value="financial" className="flex flex-col gap-0.5 py-2 px-0.5">
                    <DollarSign className="h-3.5 w-3.5" />
                    <span className="text-[9px]">Financeiro</span>
                  </TabsTrigger>
                </TabsList>
              </div>

              <ScrollArea className="flex-1 min-h-0">
                <div className="px-6 py-4">
                  <TabsContent value="identity" className="mt-0 focus-visible:outline-none">
                    <IdentityTab 
                      client={client}
                      formData={formData} 
                      setFormData={setFormData}
                      members={members || []}
                    />
                  </TabsContent>
                  <TabsContent value="onboarding" className="mt-0 focus-visible:outline-none">
                    <OnboardingTab formData={formData} setFormData={setFormData} />
                  </TabsContent>
                  <TabsContent value="branding" className="mt-0 focus-visible:outline-none">
                    <BrandingTab formData={formData} setFormData={setFormData} />
                  </TabsContent>
                  <TabsContent value="voice" className="mt-0 focus-visible:outline-none">
                    <VoiceTab formData={formData} setFormData={setFormData} />
                  </TabsContent>
                  <TabsContent value="contract" className="mt-0 focus-visible:outline-none">
                    <ContractTab formData={formData} setFormData={setFormData} />
                  </TabsContent>
                  <TabsContent value="tasks" className="mt-0 focus-visible:outline-none">
                    <ClientTasksTab clientId={client.id} />
                  </TabsContent>
                  <TabsContent value="report" className="mt-0 focus-visible:outline-none">
                    <ClientReportTab clientId={client.id} />
                  </TabsContent>
                  <TabsContent value="policies" className="mt-0 focus-visible:outline-none">
                    <ClientPoliciesTab clientId={client.id} />
                  </TabsContent>
                  <TabsContent value="simulator" className="mt-0 focus-visible:outline-none">
                    <ContractSimulatorTab clientId={client.id} />
                  </TabsContent>
                  <TabsContent value="financial" className="mt-0 focus-visible:outline-none">
                    <FinancialTab clientId={client.id} canViewFinancials={canEditFinancials} />
                  </TabsContent>
                </div>
              </ScrollArea>
            </Tabs>

            {/* Footer fixo - só aparece em abas editáveis (não financeiro) */}
            {activeTab !== 'financial' && activeTab !== 'report' && activeTab !== 'tasks' && activeTab !== 'policies' && activeTab !== 'simulator' && (
              <div className="p-4 border-t flex-shrink-0 bg-background">
                <Button 
                  onClick={handleSave} 
                  disabled={updateClient.isPending}
                  className="w-full"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {updateClient.isPending ? 'Salvando...' : 'Salvar Alterações'}
                </Button>
              </div>
            )}
          </>
        ) : (
          <div className="flex items-center justify-center h-full">
            <p className="text-muted-foreground">Cliente não encontrado</p>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};
