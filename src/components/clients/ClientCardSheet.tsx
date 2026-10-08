import React, { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useClientCard, useUpdateClientCard, useDeleteClientCard, useClientFinancials, useUpdateClientFinancials, ClientCard, ClientFinancials, ClientStatus } from '@/hooks/useClientCards';
import { useClientFinancialReport } from '@/hooks/useClientFinancialReport';
import { useClientsHealth } from '@/hooks/useClientsHealth';
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
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import { ContractAttachments } from './ContractAttachments';
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
  LayoutList,
  Globe,
  MoreHorizontal,
  ScanSearch,
  UserRound,
  Swords,
  Layers,
} from 'lucide-react';
import { SecaoBrandCore } from '@/components/clients/brand-core/SecaoBrandCore';
import { SECOES as SECOES_BC } from '@/lib/brandCore/campos';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { ClientReportTab } from './ClientReportTab';
import { PortalDoClienteTab } from '@/components/portal/PortalDoClienteTab';
import { RelatorioMensalTab } from '@/components/clients/RelatorioMensalTab';
import { useFeatureFlags, FEATURE_FLAGS } from '@/hooks/useFeatureFlags';
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
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
      <RichTextEditor
        value={formData.about_client || ''}
        onChange={(v) => setFormData(prev => ({ ...prev, about_client: v }))}
        placeholder="Descreva quem é esse cliente, sua história, contexto..."
        minHeight="80px"
        maxHeight="200px"
      />
    </div>
    <div className="space-y-2">
      <Label htmlFor="objectives">Objetivos</Label>
      <RichTextEditor
        value={formData.objectives || ''}
        onChange={(v) => setFormData(prev => ({ ...prev, objectives: v }))}
        placeholder="Quais são os objetivos do cliente conosco?"
        minHeight="80px"
        maxHeight="200px"
      />
    </div>
    <div className="space-y-2">
      <Label htmlFor="target_audience">Público-alvo</Label>
      <RichTextEditor
        value={formData.target_audience || ''}
        onChange={(v) => setFormData(prev => ({ ...prev, target_audience: v }))}
        placeholder="Quem é o público-alvo do cliente?"
        minHeight="60px"
        maxHeight="150px"
      />
    </div>
    <div className="space-y-2">
      <Label htmlFor="challenges">Desafios</Label>
      <RichTextEditor
        value={formData.challenges || ''}
        onChange={(v) => setFormData(prev => ({ ...prev, challenges: v }))}
        placeholder="Quais são os principais desafios?"
        minHeight="60px"
        maxHeight="150px"
      />
    </div>
    <div className="space-y-2">
      <Label htmlFor="competitors">Concorrentes</Label>
      <RichTextEditor
        value={formData.competitors || ''}
        onChange={(v) => setFormData(prev => ({ ...prev, competitors: v }))}
        placeholder="Quem são os concorrentes?"
        minHeight="60px"
        maxHeight="150px"
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
      <RichTextEditor
        value={formData.positioning || ''}
        onChange={(v) => setFormData(prev => ({ ...prev, positioning: v }))}
        placeholder="Como a marca se posiciona no mercado?"
        minHeight="80px"
        maxHeight="200px"
      />
    </div>
    <div className="space-y-2">
      <Label htmlFor="personality">Personalidade da Marca</Label>
      <RichTextEditor
        value={formData.personality || ''}
        onChange={(v) => setFormData(prev => ({ ...prev, personality: v }))}
        placeholder="Quais são os traços de personalidade da marca?"
        minHeight="80px"
        maxHeight="200px"
      />
    </div>
    <div className="space-y-2">
      <Label htmlFor="visual_guidelines">Diretrizes Visuais</Label>
      <RichTextEditor
        value={formData.visual_guidelines || ''}
        onChange={(v) => setFormData(prev => ({ ...prev, visual_guidelines: v }))}
        placeholder="Cores, tipografia, elementos visuais..."
        minHeight="80px"
        maxHeight="200px"
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
          <RichTextEditor
            value={formData.brand_essence || ''}
            onChange={(v) => setFormData(prev => ({ ...prev, brand_essence: v }))}
            placeholder="O que a marca É em sua essência?"
            minHeight="60px"
            maxHeight="150px"
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
          <RichTextEditor
            value={formData.products_services || ''}
            onChange={(v) => setFormData(prev => ({ ...prev, products_services: v }))}
            placeholder="Quais produtos ou serviços oferece?"
            minHeight="60px"
            maxHeight="150px"
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
            <RichTextEditor
              value={formData.language_restrictions || ''}
              onChange={(v) => setFormData(prev => ({ ...prev, language_restrictions: v }))}
              placeholder="Palavras ou expressões que não devem ser usadas..."
              minHeight="60px"
              maxHeight="150px"
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
  clientId?: string;
}> = ({ formData, setFormData, clientId }) => {
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="contract_start_date">Início do Contrato</Label>
          <Input
            id="contract_start_date"
            type="date"
            value={formData.contract_start_date || ''}
            onChange={(e) => setFormData(prev => ({ ...prev, contract_start_date: e.target.value || null }))}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="contract_end_date">Fim do Contrato</Label>
          <Input
            id="contract_end_date"
            type="date"
            value={formData.contract_end_date || ''}
            onChange={(e) => setFormData(prev => ({ ...prev, contract_end_date: e.target.value || null }))}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="payment_day">Dia de Pagamento</Label>
          <Input
            id="payment_day"
            type="number"
            min={1}
            max={31}
            placeholder="Ex: 10"
            value={formData.payment_day || ''}
            onChange={(e) => setFormData(prev => ({ ...prev, payment_day: e.target.value ? parseInt(e.target.value) : null }))}
          />
        </div>
      </div>
      <div className="space-y-2 md:max-w-xs">
        <Label htmlFor="revision_rounds_limit">Rodadas de ajuste por peça</Label>
        <Input
          id="revision_rounds_limit"
          type="number"
          min={0}
          placeholder="Não definido"
          value={formData.revision_rounds_limit ?? ''}
          onChange={(e) => setFormData(prev => ({ ...prev, revision_rounds_limit: e.target.value === '' ? null : Math.max(0, parseInt(e.target.value, 10) || 0) }))}
        />
        <p className="text-xs text-muted-foreground">Quantas vezes uma peça pode voltar para ajuste dentro do contrato. Em branco, o radar não alerta.</p>
      </div>

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
        <RichTextEditor
          value={formData.agreed_deliverables || ''}
          onChange={(v) => setFormData(prev => ({ ...prev, agreed_deliverables: v }))}
          placeholder="Liste as entregas acordadas em contrato..."
          minHeight="80px"
          maxHeight="200px"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="scope_limits">Limites de Escopo</Label>
        <RichTextEditor
          value={formData.scope_limits || ''}
          onChange={(v) => setFormData(prev => ({ ...prev, scope_limits: v }))}
          placeholder="O que NÃO está incluído no contrato..."
          minHeight="80px"
          maxHeight="200px"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="contract_notes">Observações Contratuais</Label>
        <RichTextEditor
          value={formData.contract_notes || ''}
          onChange={(v) => setFormData(prev => ({ ...prev, contract_notes: v }))}
          placeholder="Outras observações importantes..."
          minHeight="80px"
          maxHeight="200px"
        />
      </div>

      <Separator className="my-4" />

      <ContractAttachments clientId={clientId} />
    </div>
  );
};

const FinancialTab: React.FC<{
  clientId: string;
  canViewFinancials: boolean;
}> = ({ clientId, canViewFinancials }) => {
  const { data: financials, isLoading } = useClientFinancials(clientId);
  // As métricas realizadas (receita/custo/horas) vêm do relatório calculado a
  // partir de transactions + time_entries, não das colunas client_financials.
  // Aquelas colunas nascem zeradas e só mudam por edição manual — nenhum
  // trigger as alimenta —, então mostravam R$ 0,00 para clientes com mais de
  // R$ 100 mil faturados. `financials` continua sendo a fonte do que é de fato
  // acordado à mão: contrato, margem esperada e observações.
  const { data: report } = useClientFinancialReport(clientId);
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

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-green-600">
              R$ {(report?.totalRevenue ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-muted-foreground">Receita Total</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-red-600">
              R$ {((report?.totalExpenses ?? 0) + (report?.laborCost ?? 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-muted-foreground">Custo Total</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{(report?.totalHours ?? 0).toFixed(1)}h</p>
            <p className="text-xs text-muted-foreground">Horas Consumidas</p>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-2">
        <Label htmlFor="financial_notes">Observações Financeiras</Label>
        <RichTextEditor
          value={formData.financial_notes || ''}
          onChange={(v) => setFormData(prev => ({ ...prev, financial_notes: v }))}
          placeholder="Notas sobre faturamento, ajustes, etc..."
          minHeight="80px"
          maxHeight="200px"
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
  const { data: health } = useClientsHealth();
  const updateClient = useUpdateClientCard();
  const deleteClient = useDeleteClientCard();
  const { data: members } = useWorkspaceMembers();
  const { canViewClientFinancials, isAdmin, isOwner } = usePermissions();
  const { isEnabled: flagLigada } = useFeatureFlags();
  const portalLigado = flagLigada(FEATURE_FLAGS.CLIENT_PORTAL);
  const mensalLigado = flagLigada(FEATURE_FLAGS.MONTHLY_REPORT);
  
  const [formData, setFormData] = useState<Partial<ClientCard>>({});
  const [activeTab, setActiveTab] = useState('identity');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Per blueprint: only Owner + Finance can view/edit client financials (NOT coordinator)
  const canEditFinancials = canViewClientFinancials;
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

  // Saúde vem do cálculo ao vivo, não de client_cards.health_score/financial_state.
  // Aquelas colunas têm DEFAULT 100/'healthy' e só eram reescritas quando alguém
  // abria o relatório — mostravam "saudável" para cliente nunca medido.
  const clientHealth = health?.get(client?.id || '');
  const stateConfig = clientHealth ? financialStateConfig[clientHealth.financialState] : null;
  const StateIcon = stateConfig?.icon || TrendingUp;
  const healthScore = clientHealth?.healthScore;

  // Seções da ficha, agrupadas por assunto. Cada uma abre num painel à direita da lista (em tela estreita, vira uma faixa rolável).
  const secoes: { grupo: string; itens: { valor: string; rotulo: string; ajuda: string; Icone: React.ElementType; mostrar?: boolean }[] }[] = [
    {
      grupo: 'Cadastro',
      itens: [
        { valor: 'identity', rotulo: 'Identidade', ajuda: 'Nome, status, responsável e logo', Icone: Building2 },
      ],
    },
    {
      grupo: 'Brand Core',
      itens: [
        { valor: 'onboarding', rotulo: 'Contexto', ajuda: 'Quem é o cliente, objetivos e público', Icone: Users },
        { valor: 'bc_diagnosis', rotulo: 'Diagnóstico do perfil', ajuda: SECOES_BC.diagnosis.ajuda, Icone: ScanSearch },
        { valor: 'bc_persona', rotulo: 'Personas', ajuda: SECOES_BC.persona.ajuda, Icone: UserRound },
        { valor: 'bc_competitor', rotulo: 'Concorrência', ajuda: SECOES_BC.competitor.ajuda, Icone: Swords },
        { valor: 'branding', rotulo: 'Branding', ajuda: 'Posicionamento e identidade visual', Icone: Palette },
        { valor: 'voice', rotulo: 'Voz da marca', ajuda: 'Como a marca fala e o que evita', Icone: MessageSquare },
        { valor: 'bc_offer', rotulo: 'Esteira de ofertas', ajuda: SECOES_BC.offer.ajuda, Icone: Layers },
      ],
    },
    {
      grupo: 'Operação',
      itens: [
        { valor: 'tasks', rotulo: 'Tarefas', ajuda: 'Cards em andamento deste cliente', Icone: LayoutList },
        { valor: 'report', rotulo: 'Relatório', ajuda: 'Resultado financeiro do cliente', Icone: BarChart3 },
        { valor: 'mensal', rotulo: 'Relatório mensal', ajuda: 'Rascunho do mês para revisar e enviar', Icone: FileText, mostrar: mensalLigado },
        { valor: 'portal', rotulo: 'Portal', ajuda: 'Link de acompanhamento do cliente', Icone: Globe, mostrar: portalLigado },
      ],
    },
    {
      grupo: 'Comercial',
      itens: [
        { valor: 'contract', rotulo: 'Contrato', ajuda: 'Vigência, serviços e limites combinados', Icone: FileText },
        { valor: 'policies', rotulo: 'Políticas', ajuda: 'Regras de atendimento e cobrança', Icone: Settings2 },
        { valor: 'simulator', rotulo: 'Simulador', ajuda: 'Simule cenários do contrato', Icone: Calculator },
        { valor: 'financial', rotulo: 'Financeiro', ajuda: 'Valores, margem e custos', Icone: DollarSign },
      ],
    },
  ];
  const secaoAtual = secoes.flatMap(g => g.itens).find(i => i.valor === activeTab);
  // Abas que gravam pelo botão do rodapé; as outras têm o próprio botão ou gravam na hora.
  const abaDeFormulario = ['identity', 'onboarding', 'branding', 'voice', 'contract'].includes(activeTab);
  const alterado = !!client && JSON.stringify(formData) !== JSON.stringify(client);

  const fechar = (aberto: boolean) => {
    if (!aberto && alterado && !window.confirm('Há alterações não salvas neste cliente. Fechar e descartar?')) return;
    onOpenChange(aberto);
  };

  const corDaSaude = (n: number) => (n >= 80 ? 'bg-green-500' : n >= 60 ? 'bg-amber-500' : n >= 40 ? 'bg-orange-500' : 'bg-red-500');
  const textoDaSaude = (n: number) => (n >= 80 ? 'text-green-600' : n >= 60 ? 'text-amber-600' : n >= 40 ? 'text-orange-600' : 'text-red-600');

  return (
    <Sheet open={open} onOpenChange={fechar}>
      <SheetContent size="xl" className="flex flex-col gap-0 p-0 sm:h-[min(90dvh,50rem)] sm:p-0">
        {isLoading ? (
          <div className="space-y-4 p-8">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : client ? (
          <>
            {/* Cabeçalho: quem é o cliente e como está, num relance */}
            <SheetHeader className="flex-shrink-0 space-y-0 border-b bg-muted/20 px-6 py-5 pr-20 sm:px-8">
              <div className="flex flex-wrap items-center gap-4">
                <div
                  className="flex h-14 w-14 flex-shrink-0 items-center justify-center overflow-hidden rounded-2xl text-xl font-bold text-white shadow-sm ring-1 ring-black/5"
                  style={{ backgroundColor: client.color || '#6366f1' }}
                >
                  {client.logo_url ? (
                    <img src={client.logo_url} alt={client.name} className="h-full w-full object-cover" />
                  ) : (
                    client.name.charAt(0).toUpperCase()
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <SheetTitle className="truncate text-xl font-semibold tracking-tight">{client.name}</SheetTitle>
                  <p className="mt-0.5 truncate text-sm text-muted-foreground">{client.segment || 'Sem segmento definido'}</p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Badge className={cn('px-3 py-1 text-xs', statusConfig[client.status].color)}>{statusConfig[client.status].label}</Badge>
                  {stateConfig && (
                    <Badge variant="outline" className={cn('gap-1.5 px-2.5 py-1 text-xs', stateConfig.color)}>
                      <StateIcon className="h-3 w-3" />
                      {stateConfig.label}
                    </Badge>
                  )}
                  {/* O score deriva de receita, custo e margem: só aparece para quem enxerga finanças. */}
                  {healthScore !== undefined && (
                    <div className="flex items-center gap-2 rounded-full border bg-background px-3 py-1" title="Saúde financeira do cliente">
                      <span className={cn('h-2 w-2 rounded-full', corDaSaude(healthScore))} />
                      <span className="text-xs text-muted-foreground">Saúde</span>
                      <span className={cn('text-sm font-bold tabular-nums', textoDaSaude(healthScore))}>{healthScore}</span>
                    </div>
                  )}
                  {canDelete && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full" aria-label="Mais ações do cliente">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem className="gap-2 text-destructive focus:text-destructive" onClick={() => setShowDeleteConfirm(true)}>
                          <Trash2 className="h-4 w-4" />
                          Excluir cliente
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </div>

              {showDeleteConfirm && (
                <div className="mt-4 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
                  <p className="text-sm font-medium text-destructive">Excluir o cliente "{client.name}"?</p>
                  <p className="mt-1 text-xs text-muted-foreground">Esta ação não pode ser desfeita. Todos os dados do cliente serão removidos.</p>
                  <div className="mt-3 flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setShowDeleteConfirm(false)}>Cancelar</Button>
                    <Button variant="destructive" size="sm" onClick={handleDelete} disabled={deleteClient.isPending}>
                      {deleteClient.isPending ? 'Excluindo...' : 'Confirmar exclusão'}
                    </Button>
                  </div>
                </div>
              )}
            </SheetHeader>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex min-h-0 flex-1 flex-col md:flex-row">
              {/* Lista de seções */}
              <nav
                aria-label="Seções do cliente"
                className="flex flex-shrink-0 gap-1 overflow-x-auto border-b bg-muted/20 p-2 md:w-60 md:flex-col md:gap-0.5 md:overflow-y-auto md:overflow-x-visible md:border-b-0 md:border-r md:p-4"
              >
                {secoes.map(g => {
                  const itens = g.itens.filter(i => i.mostrar !== false);
                  return (
                    <div key={g.grupo} className="flex gap-1 md:mb-4 md:flex-col md:gap-0.5">
                      <p className="hidden px-3 pb-1 pt-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70 md:block">{g.grupo}</p>
                      {itens.map(({ valor, rotulo, Icone }) => (
                        <button
                          key={valor}
                          type="button"
                          onClick={() => setActiveTab(valor)}
                          aria-current={activeTab === valor ? 'page' : undefined}
                          className={cn(
                            'flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors md:w-full',
                            activeTab === valor ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                          )}
                        >
                          <Icone className="h-4 w-4 shrink-0" />
                          <span className="whitespace-nowrap">{rotulo}</span>
                        </button>
                      ))}
                    </div>
                  );
                })}
              </nav>

              {/* Conteúdo da seção */}
              <ScrollArea className="min-h-0 flex-1">
                <div className="mx-auto max-w-3xl px-6 py-6 sm:px-10 sm:py-8">
                  {secaoAtual && (
                    <div className="mb-6">
                      <h2 className="text-lg font-semibold tracking-tight">{secaoAtual.rotulo}</h2>
                      <p className="mt-0.5 text-sm text-muted-foreground">{secaoAtual.ajuda}</p>
                    </div>
                  )}
                  <TabsContent value="identity" className="mt-0 focus-visible:outline-none">
                    <IdentityTab client={client} formData={formData} setFormData={setFormData} members={members || []} />
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
                  {(['diagnosis', 'persona', 'competitor', 'offer'] as const).map(t => (
                    <TabsContent key={t} value={`bc_${t}`} className="mt-0 focus-visible:outline-none">
                      <SecaoBrandCore tipo={t} clientId={client.id} />
                    </TabsContent>
                  ))}
                  <TabsContent value="contract" className="mt-0 focus-visible:outline-none">
                    <ContractTab formData={formData} setFormData={setFormData} clientId={client?.id} />
                  </TabsContent>
                  <TabsContent value="tasks" className="mt-0 focus-visible:outline-none">
                    <ClientTasksTab clientId={client.id} />
                  </TabsContent>
                  <TabsContent value="report" className="mt-0 focus-visible:outline-none">
                    <ClientReportTab clientId={client.id} />
                  </TabsContent>
                  {mensalLigado && (
                    <TabsContent value="mensal" className="mt-0 focus-visible:outline-none">
                      <RelatorioMensalTab clientId={client.id} clientName={client.name} />
                    </TabsContent>
                  )}
                  {portalLigado && (
                    <TabsContent value="portal" className="mt-0 focus-visible:outline-none">
                      <PortalDoClienteTab clientId={client.id} clientName={client.name} />
                    </TabsContent>
                  )}
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

            {/* Rodapé: só nas seções que gravam por aqui. Mostra se há algo por salvar. */}
            {abaDeFormulario && (
              <div className="flex flex-shrink-0 items-center justify-between gap-3 border-t bg-background px-6 py-4 sm:px-8">
                <p className={cn('flex items-center gap-2 text-sm', alterado ? 'font-medium text-amber-700 dark:text-amber-400' : 'text-muted-foreground')} role="status" aria-live="polite">
                  <span className={cn('h-2 w-2 rounded-full', alterado ? 'bg-amber-500' : 'bg-green-500')} />
                  {alterado ? 'Alterações não salvas' : 'Tudo salvo'}
                </p>
                <div className="flex gap-2">
                  <Button variant="ghost" onClick={() => fechar(false)}>Fechar</Button>
                  <Button onClick={handleSave} disabled={updateClient.isPending || !alterado}>
                    <Save className="mr-2 h-4 w-4" />
                    {updateClient.isPending ? 'Salvando...' : 'Salvar alterações'}
                  </Button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="flex h-full items-center justify-center p-12">
            <p className="text-muted-foreground">Cliente não encontrado</p>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};
