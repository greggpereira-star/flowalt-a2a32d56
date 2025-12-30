import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { Flag, Plus, Percent, Trash2 } from 'lucide-react';
import { FEATURE_FLAGS } from '@/hooks/useFeatureFlags';

interface FeatureFlag {
  id: string;
  flag_key: string;
  enabled: boolean;
  rollout_percentage: number;
  metadata: Record<string, any>;
  workspace_id: string | null;
}

const PREDEFINED_FLAGS = [
  { key: FEATURE_FLAGS.COMMAND_PALETTE, name: 'Paleta de Comandos', description: 'Acesso rápido via ⌘K' },
  { key: FEATURE_FLAGS.ANALYTICS_V2, name: 'Analytics V2', description: 'Nova versão do painel de analytics' },
  { key: FEATURE_FLAGS.EMAIL_NOTIFICATIONS, name: 'Notificações por Email', description: 'Envio de emails automáticos' },
  { key: FEATURE_FLAGS.ADVANCED_WEBHOOKS, name: 'Webhooks Avançados', description: 'Configuração avançada de webhooks' },
  { key: FEATURE_FLAGS.PEOPLE_ANALYTICS, name: 'People Analytics', description: 'Análise de produtividade da equipe' },
  { key: FEATURE_FLAGS.AUTOMATIONS, name: 'Automações', description: 'Automações de fluxo de trabalho' },
  { key: FEATURE_FLAGS.TEMPLATES, name: 'Templates de Processos', description: 'Templates reutilizáveis' },
  { key: FEATURE_FLAGS.AI_ESTIMATES, name: 'Estimativas com IA', description: 'Estimativa de tempo com IA' },
];

export function FeatureFlagsManager() {
  const { currentWorkspace } = useWorkspace();
  const queryClient = useQueryClient();
  const [newFlagKey, setNewFlagKey] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: flags, isLoading } = useQuery({
    queryKey: ['feature-flags-admin', currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace?.id) return [];

      const { data, error } = await supabase
        .from('feature_flags')
        .select('*')
        .or(`workspace_id.eq.${currentWorkspace.id},workspace_id.is.null`)
        .order('flag_key');

      if (error) throw error;
      return data as FeatureFlag[];
    },
    enabled: !!currentWorkspace?.id,
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ flagId, enabled }: { flagId: string; enabled: boolean }) => {
      const { error } = await supabase
        .from('feature_flags')
        .update({ enabled })
        .eq('id', flagId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feature-flags-admin'] });
      queryClient.invalidateQueries({ queryKey: ['feature-flags'] });
      toast.success('Feature flag atualizada');
    },
    onError: () => toast.error('Erro ao atualizar flag'),
  });

  const rolloutMutation = useMutation({
    mutationFn: async ({ flagId, percentage }: { flagId: string; percentage: number }) => {
      const { error } = await supabase
        .from('feature_flags')
        .update({ rollout_percentage: percentage })
        .eq('id', flagId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feature-flags-admin'] });
      queryClient.invalidateQueries({ queryKey: ['feature-flags'] });
    },
  });

  const createMutation = useMutation({
    mutationFn: async (flagKey: string) => {
      if (!currentWorkspace?.id) throw new Error('No workspace');
      
      const { error } = await supabase.from('feature_flags').insert({
        workspace_id: currentWorkspace.id,
        flag_key: flagKey,
        enabled: false,
        rollout_percentage: 100,
        metadata: {},
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feature-flags-admin'] });
      toast.success('Feature flag criada');
      setNewFlagKey('');
      setDialogOpen(false);
    },
    onError: () => toast.error('Erro ao criar flag'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (flagId: string) => {
      const { error } = await supabase
        .from('feature_flags')
        .delete()
        .eq('id', flagId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feature-flags-admin'] });
      toast.success('Feature flag removida');
    },
    onError: () => toast.error('Erro ao remover flag'),
  });

  const getFlag = (key: string) => flags?.find(f => f.flag_key === key);
  const customFlags = flags?.filter(f => 
    !PREDEFINED_FLAGS.some(pf => pf.key === f.flag_key)
  ) || [];

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Feature Flags</h3>
          <p className="text-sm text-muted-foreground">
            Controle quais funcionalidades estão habilitadas para este workspace
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Nova Flag
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Criar Feature Flag</DialogTitle>
              <DialogDescription>
                Adicione uma nova flag customizada para este workspace.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="flag-key">Chave da Flag</Label>
                <Input
                  id="flag-key"
                  placeholder="ex: nova_funcionalidade"
                  value={newFlagKey}
                  onChange={(e) => setNewFlagKey(e.target.value.toLowerCase().replace(/\s/g, '_'))}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button 
                onClick={() => createMutation.mutate(newFlagKey)}
                disabled={!newFlagKey || createMutation.isPending}
              >
                Criar Flag
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Predefined Flags */}
      <div className="grid gap-4">
        {PREDEFINED_FLAGS.map((predefined) => {
          const flag = getFlag(predefined.key);
          const isEnabled = flag?.enabled ?? false;
          const rollout = flag?.rollout_percentage ?? 100;

          return (
            <Card key={predefined.key}>
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-4">
                  <Flag className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{predefined.name}</span>
                      <Badge variant="outline" className="text-xs">
                        {predefined.key}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {predefined.description}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  {flag && (
                    <div className="flex items-center gap-2 w-32">
                      <Percent className="h-4 w-4 text-muted-foreground" />
                      <Slider
                        value={[rollout]}
                        min={0}
                        max={100}
                        step={5}
                        onValueCommit={([value]) => {
                          if (flag) {
                            rolloutMutation.mutate({ flagId: flag.id, percentage: value });
                          }
                        }}
                        disabled={!isEnabled}
                      />
                      <span className="text-sm text-muted-foreground w-10">
                        {rollout}%
                      </span>
                    </div>
                  )}
                  <Switch
                    checked={isEnabled}
                    onCheckedChange={(checked) => {
                      if (flag) {
                        toggleMutation.mutate({ flagId: flag.id, enabled: checked });
                      } else {
                        // Create the flag first
                        createMutation.mutate(predefined.key);
                      }
                    }}
                  />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Custom Flags */}
      {customFlags.length > 0 && (
        <>
          <h4 className="text-sm font-medium text-muted-foreground mt-6">
            Flags Customizadas
          </h4>
          <div className="grid gap-4">
            {customFlags.map((flag) => (
              <Card key={flag.id}>
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-4">
                    <Flag className="h-5 w-5 text-primary" />
                    <div>
                      <Badge variant="outline">{flag.flag_key}</Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 w-32">
                      <Percent className="h-4 w-4 text-muted-foreground" />
                      <Slider
                        value={[flag.rollout_percentage]}
                        min={0}
                        max={100}
                        step={5}
                        onValueCommit={([value]) => {
                          rolloutMutation.mutate({ flagId: flag.id, percentage: value });
                        }}
                        disabled={!flag.enabled}
                      />
                      <span className="text-sm text-muted-foreground w-10">
                        {flag.rollout_percentage}%
                      </span>
                    </div>
                    <Switch
                      checked={flag.enabled}
                      onCheckedChange={(checked) => {
                        toggleMutation.mutate({ flagId: flag.id, enabled: checked });
                      }}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteMutation.mutate(flag.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
