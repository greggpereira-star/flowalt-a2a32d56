import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Plus, Pencil, Trash2, Target, Calendar, Trophy, Settings2 } from 'lucide-react';
import { format, startOfWeek, addWeeks } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface WeeklyGoal {
  id: string;
  title: string;
  description: string | null;
  goal_type: string;
  target_value: number;
  reward_points: number;
  reward_badge: string | null;
  week_start: string;
  is_active: boolean;
  created_at: string;
}

const GOAL_TYPES = [
  { value: 'cards_created', label: 'Cards Criados', icon: '📝' },
  { value: 'cards_completed', label: 'Cards Completados', icon: '✅' },
  { value: 'hours_logged', label: 'Horas Registradas', icon: '⏱️' },
  { value: 'comments_made', label: 'Comentários', icon: '💬' },
  { value: 'checklists_completed', label: 'Checklists Completados', icon: '☑️' },
];

export function WeeklyGoalsAdmin() {
  const { currentWorkspace } = useWorkspace();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<WeeklyGoal | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    goal_type: 'cards_completed',
    target_value: 5,
    reward_points: 100,
    reward_badge: '',
    week_start: format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd'),
  });

  const { data: goals, isLoading } = useQuery({
    queryKey: ['admin-weekly-goals', currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace?.id) return [];
      const { data, error } = await supabase
        .from('weekly_goals')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .order('week_start', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as WeeklyGoal[];
    },
    enabled: !!currentWorkspace?.id,
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { error } = await supabase.from('weekly_goals').insert({
        ...data,
        workspace_id: currentWorkspace?.id,
        reward_badge: data.reward_badge || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-weekly-goals'] });
      queryClient.invalidateQueries({ queryKey: ['weekly-goals'] });
      toast({ title: 'Meta criada com sucesso!' });
      resetForm();
    },
    onError: () => {
      toast({ title: 'Erro ao criar meta', variant: 'destructive' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<WeeklyGoal> }) => {
      const { error } = await supabase.from('weekly_goals').update(data).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-weekly-goals'] });
      queryClient.invalidateQueries({ queryKey: ['weekly-goals'] });
      toast({ title: 'Meta atualizada!' });
      resetForm();
    },
    onError: () => {
      toast({ title: 'Erro ao atualizar meta', variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('weekly_goals').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-weekly-goals'] });
      queryClient.invalidateQueries({ queryKey: ['weekly-goals'] });
      toast({ title: 'Meta removida!' });
    },
    onError: () => {
      toast({ title: 'Erro ao remover meta', variant: 'destructive' });
    },
  });

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      goal_type: 'cards_completed',
      target_value: 5,
      reward_points: 100,
      reward_badge: '',
      week_start: format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd'),
    });
    setEditingGoal(null);
    setIsOpen(false);
  };

  const handleEdit = (goal: WeeklyGoal) => {
    setEditingGoal(goal);
    setFormData({
      title: goal.title,
      description: goal.description || '',
      goal_type: goal.goal_type,
      target_value: goal.target_value,
      reward_points: goal.reward_points || 100,
      reward_badge: goal.reward_badge || '',
      week_start: goal.week_start,
    });
    setIsOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingGoal) {
      updateMutation.mutate({ id: editingGoal.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleToggleActive = (goal: WeeklyGoal) => {
    updateMutation.mutate({ id: goal.id, data: { is_active: !goal.is_active } });
  };

  const getGoalTypeInfo = (type: string) => {
    return GOAL_TYPES.find(t => t.value === type) || { label: type, icon: '🎯' };
  };

  const weekOptions = Array.from({ length: 8 }, (_, i) => {
    const date = addWeeks(startOfWeek(new Date(), { weekStartsOn: 1 }), i - 2);
    return {
      value: format(date, 'yyyy-MM-dd'),
      label: format(date, "'Semana de' dd/MM", { locale: ptBR }),
    };
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Settings2 className="h-5 w-5" />
          Gerenciar Metas Semanais
        </CardTitle>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => { resetForm(); setIsOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Meta
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingGoal ? 'Editar Meta' : 'Criar Nova Meta'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Título</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Ex: Complete 10 cards esta semana"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Descrição (opcional)</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Detalhes adicionais sobre a meta..."
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="goal_type">Tipo de Meta</Label>
                  <Select
                    value={formData.goal_type}
                    onValueChange={(value) => setFormData({ ...formData, goal_type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {GOAL_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.icon} {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="target_value">Meta</Label>
                  <Input
                    id="target_value"
                    type="number"
                    min={1}
                    value={formData.target_value}
                    onChange={(e) => setFormData({ ...formData, target_value: parseInt(e.target.value) || 1 })}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="reward_points">Pontos de Recompensa</Label>
                  <Input
                    id="reward_points"
                    type="number"
                    min={0}
                    value={formData.reward_points}
                    onChange={(e) => setFormData({ ...formData, reward_points: parseInt(e.target.value) || 0 })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="reward_badge">Badge (opcional)</Label>
                  <Input
                    id="reward_badge"
                    value={formData.reward_badge}
                    onChange={(e) => setFormData({ ...formData, reward_badge: e.target.value })}
                    placeholder="goal_achiever"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="week_start">Semana</Label>
                <Select
                  value={formData.week_start}
                  onValueChange={(value) => setFormData({ ...formData, week_start: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {weekOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        <Calendar className="inline h-3 w-3 mr-2" />
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                  {editingGoal ? 'Salvar' : 'Criar Meta'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Carregando...</div>
        ) : goals && goals.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Meta</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Objetivo</TableHead>
                <TableHead>Semana</TableHead>
                <TableHead>Recompensa</TableHead>
                <TableHead>Ativa</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {goals.map((goal) => {
                const typeInfo = getGoalTypeInfo(goal.goal_type);
                return (
                  <TableRow key={goal.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{goal.title}</p>
                        {goal.description && (
                          <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                            {goal.description}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {typeInfo.icon} {typeInfo.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">{goal.target_value}</TableCell>
                    <TableCell>
                      {format(new Date(goal.week_start), 'dd/MM', { locale: ptBR })}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Trophy className="h-3 w-3 text-yellow-500" />
                        {goal.reward_points} pts
                      </div>
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={goal.is_active}
                        onCheckedChange={() => handleToggleActive(goal)}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(goal)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            if (confirm('Remover esta meta?')) {
                              deleteMutation.mutate(goal.id);
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        ) : (
          <div className="text-center py-8">
            <Target className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">Nenhuma meta criada ainda</p>
            <p className="text-sm text-muted-foreground">
              Crie metas semanais para motivar sua equipe!
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
