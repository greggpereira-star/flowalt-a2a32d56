import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Crown, Building2, Sparkles, Settings, Loader2, Search,
  Edit, Check, X
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { PlanTier } from '@/hooks/useWorkspacePlan';

interface WorkspaceWithPlan {
  id: string;
  name: string;
  plan_tier: PlanTier;
  status: string;
  seats_limit: number;
  spaces_limit: number;
}

interface PlanManagementPanelProps {
  workspaces: WorkspaceWithPlan[];
  isLoading: boolean;
  onRefresh: () => void;
}

const tierIcons: Record<PlanTier, React.ElementType> = {
  free: Sparkles,
  pro: Crown,
  enterprise: Building2,
};

const tierColors: Record<PlanTier, string> = {
  free: 'bg-muted text-muted-foreground',
  pro: 'bg-primary text-primary-foreground',
  enterprise: 'bg-gradient-to-r from-amber-500 to-orange-500 text-white',
};

export const PlanManagementPanel: React.FC<PlanManagementPanelProps> = ({
  workspaces,
  isLoading,
  onRefresh,
}) => {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [editingWorkspace, setEditingWorkspace] = useState<WorkspaceWithPlan | null>(null);
  const [newTier, setNewTier] = useState<PlanTier>('free');
  const [dialogOpen, setDialogOpen] = useState(false);

  const filteredWorkspaces = workspaces?.filter(ws => 
    ws.name.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  const upgradeMutation = useMutation({
    mutationFn: async ({ workspaceId, tier }: { workspaceId: string; tier: PlanTier }) => {
      const { error } = await supabase.rpc('upgrade_workspace_plan', {
        p_workspace_id: workspaceId,
        p_new_tier: tier,
        p_provider: 'manual',
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Plano atualizado com sucesso');
      setDialogOpen(false);
      setEditingWorkspace(null);
      onRefresh();
      queryClient.invalidateQueries({ queryKey: ['all-workspaces'] });
    },
    onError: (error: Error) => {
      toast.error(`Erro ao atualizar plano: ${error.message}`);
    },
  });

  const handleEditClick = (workspace: WorkspaceWithPlan) => {
    setEditingWorkspace(workspace);
    setNewTier(workspace.plan_tier);
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!editingWorkspace) return;
    upgradeMutation.mutate({ 
      workspaceId: editingWorkspace.id, 
      tier: newTier 
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Crown className="h-5 w-5" />
          Gerenciamento de Planos
        </CardTitle>
        <CardDescription>
          Visualize e altere os planos dos workspaces (Super Admin)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar workspace..."
            className="pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Table */}
        <ScrollArea className="h-[400px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Workspace</TableHead>
                <TableHead>Plano</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Limites</TableHead>
                <TableHead className="w-[80px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                  </TableCell>
                </TableRow>
              ) : filteredWorkspaces.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Nenhum workspace encontrado
                  </TableCell>
                </TableRow>
              ) : (
                filteredWorkspaces.map((ws) => {
                  const TierIcon = tierIcons[ws.plan_tier];
                  return (
                    <TableRow key={ws.id}>
                      <TableCell className="font-medium">{ws.name}</TableCell>
                      <TableCell>
                        <Badge className={`gap-1 ${tierColors[ws.plan_tier]}`}>
                          <TierIcon className="h-3 w-3" />
                          {ws.plan_tier.toUpperCase()}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={ws.status === 'active' ? 'default' : 'secondary'}>
                          {ws.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {ws.seats_limit} membros / {ws.spaces_limit} espaços
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEditClick(ws)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </ScrollArea>

        {/* Edit Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Alterar Plano</DialogTitle>
              <DialogDescription>
                Altere o plano do workspace "{editingWorkspace?.name}"
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Plano Atual</Label>
                <div className="flex items-center gap-2">
                  <Badge className={tierColors[editingWorkspace?.plan_tier || 'free']}>
                    {editingWorkspace?.plan_tier?.toUpperCase()}
                  </Badge>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Novo Plano</Label>
                <Select value={newTier} onValueChange={(v: PlanTier) => setNewTier(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="free">
                      <div className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4" />
                        Free
                      </div>
                    </SelectItem>
                    <SelectItem value="pro">
                      <div className="flex items-center gap-2">
                        <Crown className="h-4 w-4" />
                        Pro
                      </div>
                    </SelectItem>
                    <SelectItem value="enterprise">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4" />
                        Enterprise
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {newTier !== editingWorkspace?.plan_tier && (
                <div className="p-3 bg-muted rounded-lg text-sm">
                  <p className="font-medium mb-1">Mudanças aplicadas:</p>
                  <ul className="text-muted-foreground space-y-1">
                    {newTier === 'pro' && (
                      <>
                        <li>• Limite de membros: 15</li>
                        <li>• Limite de espaços: 30</li>
                        <li>• Integrações habilitadas</li>
                        <li>• Templates habilitados</li>
                      </>
                    )}
                    {newTier === 'enterprise' && (
                      <>
                        <li>• Membros ilimitados</li>
                        <li>• Espaços ilimitados</li>
                        <li>• Todas as features habilitadas</li>
                        <li>• Suporte prioritário</li>
                      </>
                    )}
                    {newTier === 'free' && (
                      <>
                        <li>• Limite de membros: 3</li>
                        <li>• Limite de espaços: 3</li>
                        <li>• Integrações desabilitadas</li>
                      </>
                    )}
                  </ul>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button 
                onClick={handleSave}
                disabled={upgradeMutation.isPending || newTier === editingWorkspace?.plan_tier}
              >
                {upgradeMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Salvar Alterações
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};

export default PlanManagementPanel;
