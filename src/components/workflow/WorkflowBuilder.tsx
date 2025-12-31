import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { 
  GitBranch, 
  Plus, 
  Settings2, 
  Zap, 
  Layers,
  Eye,
  RefreshCw,
  Loader2
} from 'lucide-react';
import {
  useWorkflows,
  useDefaultWorkflow,
  useWorkflowStages,
  useWorkflowTransitions,
  useCreateDefaultWorkflow,
} from '@/hooks/useWorkflow';
import { WorkflowStagesTab } from './WorkflowStagesTab';
import { WorkflowRulesTab } from './WorkflowRulesTab';
import { WorkflowAutomationsTab } from './WorkflowAutomationsTab';
import { WorkflowPreview } from './WorkflowPreview';
import { toast } from 'sonner';

export function WorkflowBuilder() {
  const [activeTab, setActiveTab] = useState('stages');
  const [showPreview, setShowPreview] = useState(false);

  const { data: workflows, isLoading: loadingWorkflows } = useWorkflows();
  const { data: defaultWorkflow, isLoading: loadingDefault } = useDefaultWorkflow();
  const { data: stages, isLoading: loadingStages } = useWorkflowStages(defaultWorkflow?.id);
  const { data: transitions, isLoading: loadingTransitions } = useWorkflowTransitions(defaultWorkflow?.id);
  const createDefaultWorkflow = useCreateDefaultWorkflow();

  const isLoading = loadingWorkflows || loadingDefault || loadingStages || loadingTransitions;

  const handleCreateDefaultWorkflow = async () => {
    try {
      await createDefaultWorkflow.mutateAsync();
      toast.success('Workflow padrão criado com sucesso');
    } catch (error) {
      toast.error('Erro ao criar workflow');
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-72" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!defaultWorkflow) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GitBranch className="h-5 w-5 text-primary" />
            Workflow Builder
          </CardTitle>
          <CardDescription>
            Configure as etapas, regras e automações do fluxo de trabalho
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EmptyState
            icon={<GitBranch className="h-12 w-12" />}
            title="Nenhum workflow configurado"
            description="Crie um workflow para definir as etapas e regras do seu fluxo de trabalho."
            action={
              <Button 
                onClick={handleCreateDefaultWorkflow}
                disabled={createDefaultWorkflow.isPending}
              >
                {createDefaultWorkflow.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Criando...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4 mr-2" />
                    Criar Workflow Padrão
                  </>
                )}
              </Button>
            }
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <GitBranch className="h-5 w-5 text-primary" />
                {defaultWorkflow.name}
                <Badge variant="outline" className="ml-2">
                  v{defaultWorkflow.version}
                </Badge>
                {defaultWorkflow.is_default && (
                  <Badge className="bg-green-500/10 text-green-500 border-green-500/20">
                    Padrão
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                {defaultWorkflow.description || 'Configure as etapas, regras e automações do fluxo de trabalho'}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowPreview(!showPreview)}
              >
                <Eye className="h-4 w-4 mr-2" />
                {showPreview ? 'Ocultar' : 'Preview'}
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Preview */}
      {showPreview && stages && (
        <WorkflowPreview 
          stages={stages} 
          transitions={transitions || []} 
        />
      )}

      {/* Tabs */}
      <Card>
        <CardContent className="pt-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="stages" className="flex items-center gap-2">
                <Layers className="h-4 w-4" />
                Etapas
                {stages && <Badge variant="secondary" className="ml-1">{stages.length}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="rules" className="flex items-center gap-2">
                <Settings2 className="h-4 w-4" />
                Regras
                {transitions && <Badge variant="secondary" className="ml-1">{transitions.length}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="automations" className="flex items-center gap-2">
                <Zap className="h-4 w-4" />
                Automações
              </TabsTrigger>
            </TabsList>

            <TabsContent value="stages" className="mt-6">
              <WorkflowStagesTab 
                workflowId={defaultWorkflow.id}
                stages={stages || []}
              />
            </TabsContent>

            <TabsContent value="rules" className="mt-6">
              <WorkflowRulesTab 
                workflowId={defaultWorkflow.id}
                stages={stages || []}
                transitions={transitions || []}
              />
            </TabsContent>

            <TabsContent value="automations" className="mt-6">
              <WorkflowAutomationsTab 
                workflowId={defaultWorkflow.id}
                stages={stages || []}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
