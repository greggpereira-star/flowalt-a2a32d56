import React, { useState } from 'react';
import { useAltControlServices, useDeleteService, AltControlService } from '@/hooks/useAltControl';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Trash2, Package } from 'lucide-react';
import { ServiceFormModal } from './ServiceFormModal';
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const SERVICE_TYPE_LABELS: Record<string, string> = {
  strategy: 'Estratégia',
  recurring: 'Recorrência',
  project: 'Projeto',
};

const SERVICE_TYPE_COLORS: Record<string, 'default' | 'secondary' | 'outline'> = {
  strategy: 'default',
  recurring: 'secondary',
  project: 'outline',
};

export const ServicesSettings: React.FC = () => {
  const { data: services, isLoading } = useAltControlServices();
  const deleteService = useDeleteService();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<AltControlService | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [serviceToDelete, setServiceToDelete] = useState<AltControlService | null>(null);

  const handleEdit = (service: AltControlService) => {
    setEditingService(service);
    setModalOpen(true);
  };

  const handleDelete = (service: AltControlService) => {
    setServiceToDelete(service);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (serviceToDelete) {
      await deleteService.mutateAsync(serviceToDelete.id);
      setDeleteDialogOpen(false);
      setServiceToDelete(null);
    }
  };

  const handleNewService = () => {
    setEditingService(null);
    setModalOpen(true);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3, 4].map(i => (
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
            <CardTitle>Catálogo de Serviços</CardTitle>
            <CardDescription>
              Configure os serviços disponíveis no orçamentador
            </CardDescription>
          </div>
          <Button size="sm" onClick={handleNewService}>
            <Plus className="h-4 w-4 mr-2" /> Novo Serviço
          </Button>
        </CardHeader>
        <CardContent>
          {services && services.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Serviço</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Horas Sugeridas</TableHead>
                    <TableHead>Nível Mínimo</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[100px]">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {services.map(service => (
                    <TableRow key={service.id}>
                      <TableCell>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="font-medium cursor-help">
                                {service.name}
                              </span>
                            </TooltipTrigger>
                            {service.description && (
                              <TooltipContent>
                                <p className="max-w-xs">{service.description}</p>
                              </TooltipContent>
                            )}
                          </Tooltip>
                        </TooltipProvider>
                      </TableCell>
                      <TableCell>
                        <Badge variant={SERVICE_TYPE_COLORS[service.service_type] || 'secondary'}>
                          {SERVICE_TYPE_LABELS[service.service_type] || service.service_type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {service.suggested_min_hours || service.suggested_max_hours ? (
                          <span className="text-sm text-muted-foreground">
                            {service.suggested_min_hours || 0}h - {service.suggested_max_hours || '∞'}h
                          </span>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {service.requires_minimum_level && service.minimum_level ? (
                          <Badge variant="outline">
                            {(service.minimum_level as any).name}
                          </Badge>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={service.is_active ? 'default' : 'secondary'}>
                          {service.is_active ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(service)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(service)}
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
              <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground mb-4">Nenhum serviço configurado</p>
              <Button onClick={handleNewService}>
                <Plus className="h-4 w-4 mr-2" /> Criar primeiro serviço
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <ServiceFormModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        service={editingService}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Serviço</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o serviço "{serviceToDelete?.name}"? 
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
