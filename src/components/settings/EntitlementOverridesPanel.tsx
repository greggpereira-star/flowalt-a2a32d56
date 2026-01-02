import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Settings2, Plus, Trash2, Calendar, Loader2, Search, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { format, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface EntitlementOverridesPanelProps {
  workspaces: Array<{
    id: string;
    name: string;
    plan_tier: string;
  }>;
}

export function EntitlementOverridesPanel({ workspaces }: EntitlementOverridesPanelProps) {
  const queryClient = useQueryClient();
  const [selectedWorkspace, setSelectedWorkspace] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newOverride, setNewOverride] = useState({
    entitlement_key: '',
    enabled_override: true,
    limit_override: '',
    reason: '',
    expires_days: '30',
  });

  // Fetch entitlement registry
  const { data: registry } = useQuery({
    queryKey: ['entitlement-registry'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('entitlement_registry')
        .select('*')
        .order('category', { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  // Fetch effective entitlements for selected workspace
  const { data: effectiveEntitlements, isLoading: loadingEffective } = useQuery({
    queryKey: ['effective-entitlements', selectedWorkspace],
    queryFn: async () => {
      if (!selectedWorkspace) return [];
      const { data, error } = await supabase
        .from('workspace_entitlements_effective')
        .select('*')
        .eq('workspace_id', selectedWorkspace);
      if (error) throw error;
      return data;
    },
    enabled: !!selectedWorkspace,
  });

  // Fetch existing overrides for selected workspace
  const { data: overrides } = useQuery({
    queryKey: ['entitlement-overrides', selectedWorkspace],
    queryFn: async () => {
      if (!selectedWorkspace) return [];
      const { data, error } = await supabase
        .from('workspace_entitlement_overrides')
        .select('*')
        .eq('workspace_id', selectedWorkspace);
      if (error) throw error;
      return data;
    },
    enabled: !!selectedWorkspace,
  });

  // Create override mutation
  const createOverrideMutation = useMutation({
    mutationFn: async () => {
      if (!selectedWorkspace || !newOverride.entitlement_key || !newOverride.reason) {
        throw new Error('Preencha todos os campos obrigatórios');
      }

      const expiresAt = newOverride.expires_days 
        ? addDays(new Date(), parseInt(newOverride.expires_days)).toISOString()
        : null;

      const { error } = await supabase
        .from('workspace_entitlement_overrides')
        .upsert({
          workspace_id: selectedWorkspace,
          entitlement_key: newOverride.entitlement_key,
          enabled_override: newOverride.enabled_override,
          limit_override: newOverride.limit_override ? parseFloat(newOverride.limit_override) : null,
          reason: newOverride.reason,
          expires_at: expiresAt,
        }, {
          onConflict: 'workspace_id,entitlement_key',
        });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Override criado com sucesso');
      setDialogOpen(false);
      setNewOverride({
        entitlement_key: '',
        enabled_override: true,
        limit_override: '',
        reason: '',
        expires_days: '30',
      });
      queryClient.invalidateQueries({ queryKey: ['entitlement-overrides', selectedWorkspace] });
      queryClient.invalidateQueries({ queryKey: ['effective-entitlements', selectedWorkspace] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Delete override mutation
  const deleteOverrideMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('workspace_entitlement_overrides')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Override removido');
      queryClient.invalidateQueries({ queryKey: ['entitlement-overrides', selectedWorkspace] });
      queryClient.invalidateQueries({ queryKey: ['effective-entitlements', selectedWorkspace] });
    },
  });

  const filteredWorkspaces = workspaces.filter(ws => 
    ws.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedWorkspaceName = workspaces.find(ws => ws.id === selectedWorkspace)?.name;

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      core: 'bg-blue-100 text-blue-800',
      integrations: 'bg-purple-100 text-purple-800',
      governance: 'bg-amber-100 text-amber-800',
      security: 'bg-red-100 text-red-800',
      automation: 'bg-green-100 text-green-800',
    };
    return colors[category] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="space-y-6">
      {/* Workspace Selector */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            Gerenciar Entitlements
          </CardTitle>
          <CardDescription>
            Configure overrides de entitlements para workspaces específicos
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar workspace..."
                className="pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Select value={selectedWorkspace} onValueChange={setSelectedWorkspace}>
              <SelectTrigger className="w-[300px]">
                <SelectValue placeholder="Selecione um workspace" />
              </SelectTrigger>
              <SelectContent>
                {filteredWorkspaces.map((ws) => (
                  <SelectItem key={ws.id} value={ws.id}>
                    {ws.name} ({ws.plan_tier})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {selectedWorkspace && (
        <>
          {/* Effective Entitlements */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Entitlements Efetivos</CardTitle>
                <CardDescription>
                  Workspace: {selectedWorkspaceName}
                </CardDescription>
              </div>
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="gap-2">
                    <Plus className="h-4 w-4" />
                    Novo Override
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Criar Override</DialogTitle>
                    <DialogDescription>
                      Configure um override para {selectedWorkspaceName}
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>Entitlement</Label>
                      <Select 
                        value={newOverride.entitlement_key} 
                        onValueChange={(v) => setNewOverride(prev => ({ ...prev, entitlement_key: v }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o entitlement" />
                        </SelectTrigger>
                        <SelectContent>
                          {registry?.map((e) => (
                            <SelectItem key={e.key} value={e.key}>
                              {e.name} ({e.type})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex items-center justify-between">
                      <Label>Habilitar</Label>
                      <Switch
                        checked={newOverride.enabled_override}
                        onCheckedChange={(v) => setNewOverride(prev => ({ ...prev, enabled_override: v }))}
                      />
                    </div>

                    {registry?.find(e => e.key === newOverride.entitlement_key)?.type === 'limit' && (
                      <div className="space-y-2">
                        <Label>Limite (opcional)</Label>
                        <Input
                          type="number"
                          placeholder="Deixe vazio para usar o padrão do plano"
                          value={newOverride.limit_override}
                          onChange={(e) => setNewOverride(prev => ({ ...prev, limit_override: e.target.value }))}
                        />
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label>Expiração</Label>
                      <Select 
                        value={newOverride.expires_days} 
                        onValueChange={(v) => setNewOverride(prev => ({ ...prev, expires_days: v }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="7">7 dias</SelectItem>
                          <SelectItem value="30">30 dias</SelectItem>
                          <SelectItem value="90">90 dias</SelectItem>
                          <SelectItem value="365">1 ano</SelectItem>
                          <SelectItem value="">Sem expiração</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Motivo (obrigatório)</Label>
                      <Textarea
                        placeholder="Descreva o motivo do override..."
                        value={newOverride.reason}
                        onChange={(e) => setNewOverride(prev => ({ ...prev, reason: e.target.value }))}
                      />
                    </div>
                  </div>

                  <DialogFooter>
                    <Button variant="outline" onClick={() => setDialogOpen(false)}>
                      Cancelar
                    </Button>
                    <Button 
                      onClick={() => createOverrideMutation.mutate()}
                      disabled={createOverrideMutation.isPending || !newOverride.reason}
                    >
                      {createOverrideMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                      Criar Override
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {loadingEffective ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : (
                <ScrollArea className="h-[400px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Entitlement</TableHead>
                        <TableHead>Categoria</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Limite</TableHead>
                        <TableHead>Fonte</TableHead>
                        <TableHead>Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {effectiveEntitlements?.map((ent: any) => {
                        const override = overrides?.find((o: any) => o.entitlement_key === ent.entitlement_key);
                        return (
                          <TableRow key={ent.entitlement_key}>
                            <TableCell>
                              <div>
                                <div className="font-medium">{ent.name}</div>
                                <div className="text-xs text-muted-foreground">{ent.entitlement_key}</div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge className={getCategoryColor(ent.category)}>{ent.category}</Badge>
                            </TableCell>
                            <TableCell>
                              {ent.enabled ? (
                                <Badge variant="default" className="bg-green-500">Ativo</Badge>
                              ) : (
                                <Badge variant="secondary">Inativo</Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              {ent.limit_value !== null ? ent.limit_value : '-'}
                            </TableCell>
                            <TableCell>
                              <Badge variant={ent.source === 'override' ? 'default' : 'outline'}>
                                {ent.source}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {override && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-destructive"
                                  onClick={() => deleteOverrideMutation.mutate(override.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </CardContent>
          </Card>

          {/* Active Overrides */}
          {overrides && overrides.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5" />
                  Overrides Ativos ({overrides.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Entitlement</TableHead>
                      <TableHead>Habilitado</TableHead>
                      <TableHead>Limite</TableHead>
                      <TableHead>Motivo</TableHead>
                      <TableHead>Expira</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {overrides.map((override: any) => (
                      <TableRow key={override.id}>
                        <TableCell className="font-mono text-sm">{override.entitlement_key}</TableCell>
                        <TableCell>
                          {override.enabled_override ? (
                            <Badge variant="default" className="bg-green-500">Sim</Badge>
                          ) : (
                            <Badge variant="destructive">Não</Badge>
                          )}
                        </TableCell>
                        <TableCell>{override.limit_override ?? '-'}</TableCell>
                        <TableCell className="max-w-[200px] truncate">{override.reason}</TableCell>
                        <TableCell>
                          {override.expires_at ? (
                            <div className="flex items-center gap-1 text-sm">
                              <Calendar className="h-3 w-3" />
                              {format(new Date(override.expires_at), 'dd/MM/yyyy', { locale: ptBR })}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">Nunca</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive"
                            onClick={() => deleteOverrideMutation.mutate(override.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
