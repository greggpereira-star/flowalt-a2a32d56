import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Shield, Users, Eye, Lock, FileText, DollarSign } from 'lucide-react';

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

export function GovernancePanel() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Shield className="h-6 w-6 text-primary" />
          Governança e Permissões
        </h2>
        <p className="text-muted-foreground mt-1">
          Visão geral dos papéis e níveis de acesso no sistema.
        </p>
      </div>

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
