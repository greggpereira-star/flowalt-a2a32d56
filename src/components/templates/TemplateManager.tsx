import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { 
  Plus, 
  MoreVertical, 
  Copy, 
  Trash2, 
  Clock, 
  Layers,
  FileStack,
  Play,
} from 'lucide-react';
import { TemplateWizard } from './TemplateWizard';
import { ApplyTemplateDialog } from './ApplyTemplateDialog';

interface ProcessTemplate {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  steps: any[];
  estimated_duration_hours: number | null;
  is_active: boolean;
  created_at: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  juridico: 'Jurídico',
  administrativo: 'Administrativo',
  financeiro: 'Financeiro',
  contencioso: 'Contencioso',
  consultivo: 'Consultivo',
  trabalhista: 'Trabalhista',
  tributario: 'Tributário',
  outro: 'Outro',
};

export function TemplateManager() {
  const { currentWorkspace } = useWorkspace();
  const queryClient = useQueryClient();
  const [wizardOpen, setWizardOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [applyTemplateId, setApplyTemplateId] = useState<string | null>(null);

  const { data: templates, isLoading } = useQuery({
    queryKey: ['process-templates', currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace?.id) return [];

      const { data, error } = await supabase
        .from('process_templates')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as ProcessTemplate[];
    },
    enabled: !!currentWorkspace?.id,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('process_templates')
        .update({ is_active: false })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['process-templates'] });
      toast.success('Template removido');
      setDeleteId(null);
    },
    onError: () => toast.error('Erro ao remover template'),
  });

  const duplicateMutation = useMutation({
    mutationFn: async (template: ProcessTemplate) => {
      const { error } = await supabase.from('process_templates').insert({
        workspace_id: currentWorkspace?.id,
        name: `${template.name} (cópia)`,
        description: template.description,
        category: template.category,
        steps: template.steps,
        estimated_duration_hours: template.estimated_duration_hours,
        created_by: (await supabase.auth.getUser()).data.user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['process-templates'] });
      toast.success('Template duplicado');
    },
    onError: () => toast.error('Erro ao duplicar template'),
  });

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map(i => (
          <Skeleton key={i} className="h-48" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Templates de Processos</h3>
          <p className="text-sm text-muted-foreground">
            Crie templates reutilizáveis para padronizar seus processos
          </p>
        </div>
        <Button onClick={() => setWizardOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Template
        </Button>
      </div>

      {templates?.length === 0 ? (
        <EmptyState
          icon={<FileStack className="h-12 w-12" />}
          title="Nenhum template criado"
          description="Crie seu primeiro template para padronizar processos recorrentes."
          action={
            <Button onClick={() => setWizardOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Criar Template
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {templates?.map((template) => (
            <Card key={template.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-base">{template.name}</CardTitle>
                    {template.category && (
                      <Badge variant="secondary" className="text-xs">
                        {CATEGORY_LABELS[template.category] || template.category}
                      </Badge>
                    )}
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setApplyTemplateId(template.id)}>
                        <Play className="h-4 w-4 mr-2" />
                        Aplicar Template
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => duplicateMutation.mutate(template)}>
                        <Copy className="h-4 w-4 mr-2" />
                        Duplicar
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => setDeleteId(template.id)}
                        className="text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Remover
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent>
                {template.description && (
                  <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                    {template.description}
                  </p>
                )}
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Layers className="h-4 w-4" />
                    <span>{template.steps?.length || 0} etapas</span>
                  </div>
                  {template.estimated_duration_hours && (
                    <div className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      <span>{template.estimated_duration_hours}h</span>
                    </div>
                  )}
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full mt-4"
                  onClick={() => setApplyTemplateId(template.id)}
                >
                  <Play className="h-4 w-4 mr-2" />
                  Aplicar Template
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Wizard Dialog */}
      <TemplateWizard 
        open={wizardOpen} 
        onOpenChange={setWizardOpen} 
      />

      {/* Apply Template Dialog */}
      {applyTemplateId && (
        <ApplyTemplateDialog
          templateId={applyTemplateId}
          open={!!applyTemplateId}
          onOpenChange={(open) => !open && setApplyTemplateId(null)}
        />
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover template?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O template será removido permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
