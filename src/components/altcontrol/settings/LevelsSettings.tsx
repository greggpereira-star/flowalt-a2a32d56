import React, { useState } from 'react';
import { useAltControlLevels, useDeleteLevel, AltControlLevel } from '@/hooks/useAltControl';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Trash2, AlertTriangle, Layers } from 'lucide-react';
import { LevelFormModal } from './LevelFormModal';
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
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export const LevelsSettings: React.FC = () => {
  const { data: levels, isLoading } = useAltControlLevels();
  const deleteLevel = useDeleteLevel();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingLevel, setEditingLevel] = useState<AltControlLevel | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [levelToDelete, setLevelToDelete] = useState<AltControlLevel | null>(null);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  const handleEdit = (level: AltControlLevel) => {
    setEditingLevel(level);
    setModalOpen(true);
  };

  const handleDelete = (level: AltControlLevel) => {
    setLevelToDelete(level);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (levelToDelete) {
      await deleteLevel.mutateAsync(levelToDelete.id);
      setDeleteDialogOpen(false);
      setLevelToDelete(null);
    }
  };

  const handleNewLevel = () => {
    setEditingLevel(null);
    setModalOpen(true);
  };

  // Check for gaps in hour ranges
  const hasGaps = React.useMemo(() => {
    if (!levels || levels.length < 2) return false;
    const sorted = [...levels].filter(l => l.is_active).sort((a, b) => a.min_hours - b.min_hours);
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].min_hours > sorted[i - 1].max_hours + 1) {
        return true;
      }
    }
    return false;
  }, [levels]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Níveis de Precificação</CardTitle>
            <CardDescription>
              Configure faixas de horas, preços e regras de aprovação
            </CardDescription>
          </div>
          <Button size="sm" onClick={handleNewLevel}>
            <Plus className="h-4 w-4 mr-2" /> Novo Nível
          </Button>
        </CardHeader>
        <CardContent>
          {hasGaps && (
            <div className="mb-4 p-3 bg-warning/10 border border-warning/30 rounded-lg flex items-center gap-2 text-warning">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-sm">
                Existem lacunas nas faixas de horas. Isso pode causar inconsistências no orçamentador.
              </span>
            </div>
          )}

          {levels && levels.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nível</TableHead>
                    <TableHead>Faixa de Horas</TableHead>
                    <TableHead>Preço Mensal</TableHead>
                    <TableHead>Meta Margem</TableHead>
                    <TableHead>Aprovação</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[100px]">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {levels.map(level => (
                    <TableRow key={level.id}>
                      <TableCell className="font-medium">{level.name}</TableCell>
                      <TableCell>
                        {level.min_hours}h - {level.max_hours}h
                      </TableCell>
                      <TableCell>
                        {formatCurrency(level.min_monthly_price)} - {formatCurrency(level.max_monthly_price)}
                      </TableCell>
                      <TableCell>{level.target_margin_percent}%</TableCell>
                      <TableCell>
                        {level.requires_reinforced_approval ? (
                          <Badge variant="secondary">Reforçada</Badge>
                        ) : (
                          <Badge variant="outline">Normal</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={level.is_active ? 'default' : 'secondary'}>
                          {level.is_active ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(level)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(level)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="py-12 text-center">
              <Layers className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground mb-4">Nenhum nível configurado</p>
              <Button onClick={handleNewLevel}>
                <Plus className="h-4 w-4 mr-2" /> Criar primeiro nível
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <LevelFormModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        level={editingLevel}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Nível</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o nível "{levelToDelete?.name}"? 
              Esta ação não pode ser desfeita e pode afetar propostas existentes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
