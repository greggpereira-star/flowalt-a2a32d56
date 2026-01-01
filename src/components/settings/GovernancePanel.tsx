import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Lock,
  Folder,
  LayoutGrid,
  Mail,
  Shield,
  AlertTriangle,
  Eye,
  EyeOff,
  Users,
  Clock,
  TrendingDown,
  CheckCircle2,
  Info,
  DollarSign,
  FileText,
} from 'lucide-react';
import { useGovernanceMetrics, useVisibilityIssues, useRecentAccessDenials } from '@/hooks/useGovernanceMetrics';
import { usePermissions } from '@/hooks/usePermissions';
import { AccessDeniedState } from '@/components/governance';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// Role definitions with permissions
const ROLE_PERMISSIONS = {
  owner: {
    label: 'Owner (Proprietário)',
    description: 'Controle total do workspace',
    color: 'bg-amber-500',
    permissions: [
      'Acesso total a todas as funcionalidades',
      'Promover outros usuários a Owner',
      'Transferir propriedade do workspace',
      'Gerenciar membros e convites',
      'Ver/editar dados financeiros sensíveis',
      'Configurar integrações e API',
      'Excluir workspace',
    ],
  },
  admin: {
    label: 'Admin (Administrador)',
    description: 'Gerenciamento do workspace',
    color: 'bg-blue-500',
    permissions: [
      'Gerenciar membros e convites',
      'Criar/editar espaços e pastas',
      'Ver relatórios gerenciais',
      'Configurar automações',
      'NÃO pode promover a Owner',
      'NÃO acessa dados financeiros sensíveis',
    ],
  },
  coordinator: {
    label: 'Coordinator (Coordenador)',
    description: 'Gestão operacional',
    color: 'bg-purple-500',
    permissions: [
      'Convidar novos membros',
      'Gerenciar cards e tarefas',
      'Ver métricas de equipe',
      'Aprovar entregas',
      'NÃO altera estrutura de espaços',
      'NÃO acessa dados financeiros sensíveis',
    ],
  },
  finance: {
    label: 'Finance (Financeiro)',
    description: 'Acesso ao módulo financeiro',
    color: 'bg-emerald-500',
    permissions: [
      'Ver/editar dados financeiros sensíveis',
      'Gerenciar faturamento e custos',
      'Ver relatórios financeiros',
      'Acesso limitado a operações',
      'NÃO gerencia membros',
    ],
  },
  collaborator: {
    label: 'Collaborator (Colaborador)',
    description: 'Membro da equipe',
    color: 'bg-slate-500',
    permissions: [
      'Ver espaços operacionais',
      'Criar/editar cards atribuídos',
      'Registrar horas trabalhadas',
      'Ver própria pasta pessoal',
      'Excluir apenas itens criados por ele',
      'NÃO vê espaços restritos',
      'NÃO acessa dados financeiros',
    ],
  },
};

interface MetricCardProps {
  title: string;
  value: number;
  description: string;
  icon: React.ElementType;
  variant?: 'default' | 'warning' | 'danger' | 'success';
}

const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  description,
  icon: Icon,
  variant = 'default',
}) => {
  const variantStyles = {
    default: 'bg-card border-border',
    warning: 'bg-warning/5 border-warning/20',
    danger: 'bg-destructive/5 border-destructive/20',
    success: 'bg-success/5 border-success/20',
  };

  const iconStyles = {
    default: 'text-muted-foreground bg-muted',
    warning: 'text-warning bg-warning/10',
    danger: 'text-destructive bg-destructive/10',
    success: 'text-success bg-success/10',
  };

  return (
    <Card className={cn('transition-colors', variantStyles[variant])}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold">{value}</p>
            <p className="text-xs text-muted-foreground">{description}</p>
          </div>
          <div className={cn('p-2 rounded-lg', iconStyles[variant])}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const IssueTypeIcon: Record<string, React.ElementType> = {
  card: LayoutGrid,
  folder: Folder,
  space: LayoutGrid,
  invite: Mail,
};

function VisibilityAuditTab() {
  const { data: metrics, isLoading: metricsLoading } = useGovernanceMetrics();
  const { data: issues, isLoading: issuesLoading } = useVisibilityIssues();
  const { data: denials, isLoading: denialsLoading } = useRecentAccessDenials();

  if (metricsLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-[120px]" />
          ))}
        </div>
        <Skeleton className="h-[300px]" />
      </div>
    );
  }

  const hasIssues = (issues?.length || 0) > 0;
  const hasDenials = (denials?.length || 0) > 0;

  return (
    <div className="space-y-6">
      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Cards Restritos"
          value={metrics?.restrictedCards || 0}
          description="Cards visíveis apenas para membros específicos"
          icon={Lock}
          variant={metrics?.restrictedCards ? 'warning' : 'default'}
        />
        <MetricCard
          title="Pastas Privadas"
          value={metrics?.privateFolders || 0}
          description="Pastas pessoais de usuários"
          icon={Folder}
          variant="default"
        />
        <MetricCard
          title="Espaços Ocultos"
          value={metrics?.hiddenSpaces || 0}
          description="Espaços com acesso restrito"
          icon={EyeOff}
          variant={metrics?.hiddenSpaces ? 'warning' : 'default'}
        />
        <MetricCard
          title="Convites Pendentes"
          value={metrics?.pendingInvites || 0}
          description="Aguardando aceite do usuário"
          icon={Mail}
          variant={metrics?.pendingInvites ? 'danger' : 'success'}
        />
      </div>

      {/* Secondary Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <MetricCard
          title="Negações de Acesso"
          value={metrics?.recentAccessDenials || 0}
          description="Últimos 7 dias"
          icon={AlertTriangle}
          variant={metrics?.recentAccessDenials ? 'danger' : 'success'}
        />
        <MetricCard
          title="Itens Financeiros"
          value={metrics?.financialOnlyItems || 0}
          description="Visíveis apenas para Financeiro/Owner"
          icon={Shield}
          variant="default"
        />
      </div>

      <Separator />

      {/* Why Users Don't See Things */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Info className="h-4 w-4 text-info" />
            Por que usuários não veem coisas
          </CardTitle>
          <CardDescription>
            Lista resumida de itens com visibilidade restrita
          </CardDescription>
        </CardHeader>
        <CardContent>
          {issuesLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : hasIssues ? (
            <ScrollArea className="h-[250px] pr-4">
              <div className="space-y-2">
                {issues?.map((issue) => {
                  const Icon = IssueTypeIcon[issue.type] || LayoutGrid;
                  return (
                    <div
                      key={`${issue.type}-${issue.id}`}
                      className="flex items-start gap-3 p-3 rounded-lg border border-border/50 bg-muted/20 hover:bg-muted/40 transition-colors"
                    >
                      <div className="p-1.5 rounded bg-muted">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium truncate">{issue.name}</p>
                          <Badge variant="outline" className="text-[10px] h-4 shrink-0">
                            {issue.type}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {issue.reason}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="h-12 w-12 rounded-full bg-success/10 flex items-center justify-center mb-3">
                <CheckCircle2 className="h-6 w-6 text-success" />
              </div>
              <p className="text-sm font-medium">Tudo visível</p>
              <p className="text-xs text-muted-foreground mt-1">
                Não há itens com visibilidade restrita no momento
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Access Denials */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingDown className="h-4 w-4 text-destructive" />
            Negações de Acesso Recentes
          </CardTitle>
          <CardDescription>
            Tentativas de acesso bloqueadas pelo sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          {denialsLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : hasDenials ? (
            <ScrollArea className="h-[200px] pr-4">
              <div className="space-y-2">
                {denials?.map((denial) => {
                  const metadata = denial.metadata as Record<string, unknown> | null;
                  return (
                    <div
                      key={denial.id}
                      className="flex items-start gap-3 p-3 rounded-lg border border-destructive/20 bg-destructive/5"
                    >
                      <div className="p-1.5 rounded bg-destructive/10">
                        <AlertTriangle className="h-4 w-4 text-destructive" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium">
                            {metadata?.denied_action as string || 'Acesso negado'}
                          </p>
                          <Badge variant="outline" className="text-[10px] h-4 border-destructive/30 text-destructive">
                            {metadata?.entity_type as string || 'unknown'}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          <p className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(denial.created_at), {
                              addSuffix: true,
                              locale: ptBR,
                            })}
                          </p>
                          {metadata?.reason && (
                            <span className="text-xs text-muted-foreground">
                              • {metadata.reason as string}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="h-12 w-12 rounded-full bg-success/10 flex items-center justify-center mb-3">
                <CheckCircle2 className="h-6 w-6 text-success" />
              </div>
              <p className="text-sm font-medium">Nenhuma negação recente</p>
              <p className="text-xs text-muted-foreground mt-1">
                Sem tentativas de acesso bloqueadas nos últimos 7 dias
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Help Text */}
      <Card className="bg-info/5 border-info/20">
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-info shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-info">Como usar este painel</p>
              <p className="text-xs text-muted-foreground">
                Este painel mostra uma visão geral de como a visibilidade está configurada no seu workspace.
                Use para identificar potenciais problemas de acesso e reduzir conflitos internos.
                As métricas são atualizadas a cada 5 minutos.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function RolesAndPermissionsTab() {
  return (
    <div className="space-y-6">
      {/* Principles */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Princípios de Segurança</CardTitle>
          <CardDescription>
            Regras fundamentais que governam o acesso ao sistema
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-start gap-3">
            <Lock className="h-5 w-5 text-primary mt-0.5" />
            <div>
              <p className="font-medium">Acesso por Convite</p>
              <p className="text-sm text-muted-foreground">
                Usuários só entram em workspaces através de convites. Não existe acesso automático.
              </p>
            </div>
          </div>
          <Separator />
          <div className="flex items-start gap-3">
            <Users className="h-5 w-5 text-primary mt-0.5" />
            <div>
              <p className="font-medium">Múltiplos Owners</p>
              <p className="text-sm text-muted-foreground">
                Workspaces podem ter vários proprietários para redundância de gestão.
              </p>
            </div>
          </div>
          <Separator />
          <div className="flex items-start gap-3">
            <Eye className="h-5 w-5 text-primary mt-0.5" />
            <div>
              <p className="font-medium">Espaços Operacionais vs Restritos</p>
              <p className="text-sm text-muted-foreground">
                Espaços podem ser visíveis para todos ou apenas para papéis específicos.
              </p>
            </div>
          </div>
          <Separator />
          <div className="flex items-start gap-3">
            <DollarSign className="h-5 w-5 text-primary mt-0.5" />
            <div>
              <p className="font-medium">Financeiro Sensível</p>
              <p className="text-sm text-muted-foreground">
                Dados como salários e valores contratuais só são visíveis para Owner e Finance.
              </p>
            </div>
          </div>
          <Separator />
          <div className="flex items-start gap-3">
            <FileText className="h-5 w-5 text-primary mt-0.5" />
            <div>
              <p className="font-medium">Auditoria Completa</p>
              <p className="text-sm text-muted-foreground">
                Todas as ações importantes são registradas para compliance e LGPD.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Role Cards */}
      <div className="grid gap-4 md:grid-cols-2">
        {Object.entries(ROLE_PERMISSIONS).map(([key, role]) => (
          <Card key={key}>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${role.color}`} />
                <CardTitle className="text-base">{role.label}</CardTitle>
              </div>
              <CardDescription>{role.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1.5">
                {role.permissions.map((perm, idx) => (
                  <li key={idx} className="text-sm flex items-start gap-2">
                    {perm.startsWith('NÃO') ? (
                      <>
                        <span className="text-destructive">✕</span>
                        <span className="text-muted-foreground">{perm}</span>
                      </>
                    ) : (
                      <>
                        <span className="text-primary">✓</span>
                        <span>{perm}</span>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Access Levels */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Níveis de Visibilidade</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="border rounded-lg p-4">
              <Badge variant="secondary" className="mb-2">Espaço</Badge>
              <p className="font-medium">Operacional / Restrito</p>
              <p className="text-sm text-muted-foreground">
                Define quais papéis podem ver o espaço inteiro.
              </p>
            </div>
            <div className="border rounded-lg p-4">
              <Badge variant="secondary" className="mb-2">Pasta</Badge>
              <p className="font-medium">Pública / Restrita</p>
              <p className="text-sm text-muted-foreground">
                Pastas podem ser limitadas a membros específicos.
              </p>
            </div>
            <div className="border rounded-lg p-4">
              <Badge variant="secondary" className="mb-2">Card</Badge>
              <p className="font-medium">Herdado / Restrito</p>
              <p className="text-sm text-muted-foreground">
                Cards podem herdar acesso da pasta ou ter membros próprios.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function GovernancePanel() {
  const { isOwner, isAdmin } = usePermissions();
  const canViewAudit = isOwner || isAdmin;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            Governança e Permissões
          </h2>
          <p className="text-muted-foreground mt-1">
            Visão geral dos papéis, níveis de acesso e visibilidade no sistema.
          </p>
        </div>
        {canViewAudit && (
          <Badge variant="outline" className="gap-1.5">
            <Eye className="h-3.5 w-3.5" />
            Modo Auditoria
          </Badge>
        )}
      </div>

      <Tabs defaultValue={canViewAudit ? "visibility" : "roles"} className="space-y-6">
        <TabsList>
          {canViewAudit && (
            <TabsTrigger value="visibility" className="gap-2">
              <EyeOff className="h-4 w-4" />
              Visibilidade & Acessos
            </TabsTrigger>
          )}
          <TabsTrigger value="roles" className="gap-2">
            <Users className="h-4 w-4" />
            Papéis & Permissões
          </TabsTrigger>
        </TabsList>

        {canViewAudit && (
          <TabsContent value="visibility">
            <VisibilityAuditTab />
          </TabsContent>
        )}

        <TabsContent value="roles">
          <RolesAndPermissionsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
