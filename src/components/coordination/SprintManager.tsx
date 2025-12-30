import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Calendar, Plus, MoreHorizontal, Play, CheckCircle, XCircle, AlertTriangle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSprints, useCreateSprint, useUpdateSprint, useDeleteSprint, useSprintCards, type Sprint } from '@/hooks/useSprints';
import { format, differenceInDays, isWithinInterval, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

const STATUS_CONFIG = {
  planning: { label: 'Planejamento', color: 'bg-muted text-muted-foreground', icon: Calendar },
  active: { label: 'Ativo', color: 'bg-green-500/20 text-green-600', icon: Play },
  completed: { label: 'Concluído', color: 'bg-blue-500/20 text-blue-600', icon: CheckCircle },
  cancelled: { label: 'Cancelado', color: 'bg-destructive/20 text-destructive', icon: XCircle },
};

interface SprintCardProps {
  sprint: Sprint;
  onEdit: (sprint: Sprint) => void;
  onStatusChange: (sprint: Sprint, status: Sprint['status']) => void;
  onDelete: (sprint: Sprint) => void;
}

const SprintCard: React.FC<SprintCardProps> = ({ sprint, onEdit, onStatusChange, onDelete }) => {
  const { data: sprintCards } = useSprintCards(sprint.id);
  const statusConfig = STATUS_CONFIG[sprint.status];
  const StatusIcon = statusConfig.icon;

  const now = new Date();
  const startDate = parseISO(sprint.start_date);
  const endDate = parseISO(sprint.end_date);
  const isActive = isWithinInterval(now, { start: startDate, end: endDate });
  const totalDays = differenceInDays(endDate, startDate);
  const daysElapsed = Math.max(0, differenceInDays(now, startDate));
  const timeProgress = Math.min(100, (daysElapsed / totalDays) * 100);

  const cardCount = sprintCards?.length || 0;
  const completedCards = sprintCards?.filter(sc => 
    (sc.card as { status: string })?.status === 'delivered'
  ).length || 0;
  const cardProgress = cardCount > 0 ? (completedCards / cardCount) * 100 : 0;

  const allocatedHours = sprintCards?.reduce((acc, sc) => {
    return acc + ((sc.card as { estimated_hours?: number })?.estimated_hours || 0);
  }, 0) || 0;

  const riskLevel = allocatedHours > sprint.capacity_hours ? 'high' : 
                    allocatedHours > sprint.capacity_hours * 0.8 ? 'medium' : 'low';

  return (
    <Card className={cn(
      'transition-all hover:shadow-md',
      sprint.status === 'active' && 'border-green-500/50',
      riskLevel === 'high' && 'border-destructive/50'
    )}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              {sprint.name}
              <Badge className={cn('text-xs', statusConfig.color)}>
                <StatusIcon className="h-3 w-3 mr-1" />
                {statusConfig.label}
              </Badge>
            </CardTitle>
            <CardDescription className="mt-1">
              {format(startDate, "dd MMM", { locale: ptBR })} - {format(endDate, "dd MMM yyyy", { locale: ptBR })}
            </CardDescription>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit(sprint)}>
                Editar
              </DropdownMenuItem>
              {sprint.status === 'planning' && (
                <DropdownMenuItem onClick={() => onStatusChange(sprint, 'active')}>
                  Iniciar Sprint
                </DropdownMenuItem>
              )}
              {sprint.status === 'active' && (
                <DropdownMenuItem onClick={() => onStatusChange(sprint, 'completed')}>
                  Concluir Sprint
                </DropdownMenuItem>
              )}
              <DropdownMenuItem 
                onClick={() => onDelete(sprint)}
                className="text-destructive"
              >
                Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {sprint.goal && (
          <p className="text-sm text-muted-foreground">{sprint.goal}</p>
        )}

        {/* Progress */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Progresso dos Cards</span>
            <span>{completedCards}/{cardCount} ({Math.round(cardProgress)}%)</span>
          </div>
          <Progress value={cardProgress} className="h-2" />
        </div>

        {sprint.status === 'active' && (
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Tempo</span>
              <span>{daysElapsed}/{totalDays} dias</span>
            </div>
            <Progress value={timeProgress} className="h-2" />
          </div>
        )}

        {/* Capacity & Risk */}
        <div className="flex items-center justify-between pt-2 border-t">
          <div className="text-xs">
            <span className="text-muted-foreground">Capacidade: </span>
            <span className={cn(
              'font-medium',
              riskLevel === 'high' && 'text-destructive',
              riskLevel === 'medium' && 'text-orange-500'
            )}>
              {allocatedHours}h / {sprint.capacity_hours}h
            </span>
          </div>
          {riskLevel !== 'low' && (
            <Badge variant="outline" className={cn(
              'text-xs',
              riskLevel === 'high' ? 'border-destructive text-destructive' : 'border-orange-500 text-orange-500'
            )}>
              <AlertTriangle className="h-3 w-3 mr-1" />
              {riskLevel === 'high' ? 'Sobrecarga' : 'Atenção'}
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export const SprintManager: React.FC = () => {
  const { data: sprints, isLoading } = useSprints();
  const createSprint = useCreateSprint();
  const updateSprint = useUpdateSprint();
  const deleteSprint = useDeleteSprint();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSprint, setEditingSprint] = useState<Sprint | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    start_date: '',
    end_date: '',
    goal: '',
    capacity_hours: 40,
  });

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      start_date: '',
      end_date: '',
      goal: '',
      capacity_hours: 40,
    });
    setEditingSprint(null);
  };

  const handleEdit = (sprint: Sprint) => {
    setEditingSprint(sprint);
    setFormData({
      name: sprint.name,
      description: sprint.description || '',
      start_date: sprint.start_date.split('T')[0],
      end_date: sprint.end_date.split('T')[0],
      goal: sprint.goal || '',
      capacity_hours: sprint.capacity_hours,
    });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.start_date || !formData.end_date) {
      toast.error('Preencha os campos obrigatórios');
      return;
    }

    try {
      if (editingSprint) {
        await updateSprint.mutateAsync({
          id: editingSprint.id,
          name: formData.name,
          description: formData.description || null,
          start_date: new Date(formData.start_date).toISOString(),
          end_date: new Date(formData.end_date).toISOString(),
          goal: formData.goal || null,
          capacity_hours: formData.capacity_hours,
        });
        toast.success('Sprint atualizado');
      } else {
        await createSprint.mutateAsync({
          name: formData.name,
          description: formData.description,
          start_date: new Date(formData.start_date).toISOString(),
          end_date: new Date(formData.end_date).toISOString(),
          goal: formData.goal,
          capacity_hours: formData.capacity_hours,
        });
        toast.success('Sprint criado');
      }
      setDialogOpen(false);
      resetForm();
    } catch {
      toast.error('Erro ao salvar sprint');
    }
  };

  const handleStatusChange = async (sprint: Sprint, status: Sprint['status']) => {
    try {
      await updateSprint.mutateAsync({ id: sprint.id, status });
      toast.success(`Sprint ${status === 'active' ? 'iniciado' : 'concluído'}`);
    } catch {
      toast.error('Erro ao atualizar sprint');
    }
  };

  const handleDelete = async (sprint: Sprint) => {
    try {
      await deleteSprint.mutateAsync(sprint.id);
      toast.success('Sprint excluído');
    } catch {
      toast.error('Erro ao excluir sprint');
    }
  };

  const activeSprints = sprints?.filter(s => s.status === 'active') || [];
  const planningSprints = sprints?.filter(s => s.status === 'planning') || [];
  const completedSprints = sprints?.filter(s => s.status === 'completed' || s.status === 'cancelled') || [];

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-12 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Sprints</h3>
          <p className="text-sm text-muted-foreground">Gerencie períodos de trabalho e cards alocados</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Novo Sprint
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingSprint ? 'Editar Sprint' : 'Novo Sprint'}</DialogTitle>
              <DialogDescription>
                Defina o período e a capacidade do sprint
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome *</Label>
                <Input
                  id="name"
                  placeholder="Sprint 1"
                  value={formData.name}
                  onChange={(e) => setFormData(f => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="start_date">Data Início *</Label>
                  <Input
                    id="start_date"
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => setFormData(f => ({ ...f, start_date: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="end_date">Data Fim *</Label>
                  <Input
                    id="end_date"
                    type="date"
                    value={formData.end_date}
                    onChange={(e) => setFormData(f => ({ ...f, end_date: e.target.value }))}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="capacity">Capacidade (horas)</Label>
                <Input
                  id="capacity"
                  type="number"
                  value={formData.capacity_hours}
                  onChange={(e) => setFormData(f => ({ ...f, capacity_hours: Number(e.target.value) }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="goal">Meta do Sprint</Label>
                <Input
                  id="goal"
                  placeholder="O que queremos alcançar..."
                  value={formData.goal}
                  onChange={(e) => setFormData(f => ({ ...f, goal: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Descrição</Label>
                <Textarea
                  id="description"
                  placeholder="Detalhes adicionais..."
                  value={formData.description}
                  onChange={(e) => setFormData(f => ({ ...f, description: e.target.value }))}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button 
                onClick={handleSubmit}
                disabled={createSprint.isPending || updateSprint.isPending}
              >
                {editingSprint ? 'Salvar' : 'Criar'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Active Sprints */}
      {activeSprints.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground">Ativos</h4>
          <div className="grid md:grid-cols-2 gap-4">
            {activeSprints.map(sprint => (
              <SprintCard
                key={sprint.id}
                sprint={sprint}
                onEdit={handleEdit}
                onStatusChange={handleStatusChange}
                onDelete={handleDelete}
              />
            ))}
          </div>
        </div>
      )}

      {/* Planning Sprints */}
      {planningSprints.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground">Em Planejamento</h4>
          <div className="grid md:grid-cols-2 gap-4">
            {planningSprints.map(sprint => (
              <SprintCard
                key={sprint.id}
                sprint={sprint}
                onEdit={handleEdit}
                onStatusChange={handleStatusChange}
                onDelete={handleDelete}
              />
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {sprints?.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-lg font-medium">Nenhum sprint criado</p>
            <p className="text-sm text-muted-foreground">
              Crie seu primeiro sprint para organizar o trabalho em períodos
            </p>
          </CardContent>
        </Card>
      )}

      {/* Completed Sprints */}
      {completedSprints.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground">Finalizados</h4>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {completedSprints.slice(0, 3).map(sprint => (
              <SprintCard
                key={sprint.id}
                sprint={sprint}
                onEdit={handleEdit}
                onStatusChange={handleStatusChange}
                onDelete={handleDelete}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
