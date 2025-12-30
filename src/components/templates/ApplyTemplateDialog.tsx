import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { Layers, FileStack } from 'lucide-react';

interface ApplyTemplateDialogProps {
  templateId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface Space {
  id: string;
  name: string;
}

interface Folder {
  id: string;
  name: string;
  space_id: string;
}

export function ApplyTemplateDialog({ templateId, open, onOpenChange }: ApplyTemplateDialogProps) {
  const { currentWorkspace } = useWorkspace();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [selectedSpace, setSelectedSpace] = useState<string>('');
  const [selectedFolder, setSelectedFolder] = useState<string>('');
  const [cardPrefix, setCardPrefix] = useState('');

  // Fetch template
  const { data: template, isLoading: templateLoading } = useQuery({
    queryKey: ['template', templateId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('process_templates')
        .select('*')
        .eq('id', templateId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!templateId,
  });

  // Fetch spaces
  const { data: spaces } = useQuery({
    queryKey: ['spaces-simple', currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace?.id) return [] as Space[];
      const result = await supabase
        .from('spaces')
        .select('id, name')
        .eq('workspace_id', currentWorkspace.id)
        .eq('is_active', true);
      return (result.data ?? []) as Space[];
    },
    enabled: !!currentWorkspace?.id,
  });

  // Fetch folders for selected space
  const { data: folders } = useQuery({
    queryKey: ['folders', selectedSpace],
    queryFn: async () => {
      if (!selectedSpace) return [];
      const { data, error } = await supabase
        .from('folders')
        .select('id, name, space_id')
        .eq('space_id', selectedSpace)
        .order('name');
      if (error) throw error;
      return data as Folder[];
    },
    enabled: !!selectedSpace,
  });

  // Apply template mutation
  const applyMutation = useMutation({
    mutationFn: async () => {
      if (!template || !selectedSpace || !user?.id || !currentWorkspace?.id) {
        throw new Error('Missing required data');
      }

      const stepsArray = Array.isArray(template.steps) ? template.steps : [];
      const steps = stepsArray as Array<{
        title: string;
        description: string;
        status: string;
        estimatedHours?: number;
      }>;

      // Create cards for each step
      const validStatuses = ['backlog', 'todo', 'in_progress', 'review', 'briefing', 'approved', 'delivered', 'archived'] as const;
      type CardStatus = typeof validStatuses[number];
      
      const cards = steps.map((step, index) => ({
        workspace_id: currentWorkspace.id,
        space_id: selectedSpace,
        folder_id: selectedFolder || null,
        title: cardPrefix ? `${cardPrefix} - ${step.title}` : step.title,
        description: step.description || null,
        status: (validStatuses.includes(step.status as CardStatus) ? step.status : 'todo') as CardStatus,
        position: index,
        created_by: user.id,
        estimated_hours: step.estimatedHours || null,
      }));

      const { error } = await supabase.from('cards').insert(cards);
      if (error) throw error;
      
      return steps.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['cards'] });
      toast.success(`${count} cards criados a partir do template!`);
      onOpenChange(false);
    },
    onError: (error) => {
      console.error('Error applying template:', error);
      toast.error('Erro ao aplicar template');
    },
  });

  if (templateLoading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-32 w-full" />
        </DialogContent>
      </Dialog>
    );
  }

  const stepCount = Array.isArray(template?.steps) ? template.steps.length : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileStack className="h-5 w-5" />
            Aplicar Template
          </DialogTitle>
          <DialogDescription>
            Crie cards automaticamente a partir do template "{template?.name}".
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Template Info */}
          <div className="rounded-lg border p-3 bg-muted/30">
            <div className="flex items-center justify-between">
              <span className="font-medium">{template?.name}</span>
              <Badge variant="secondary">
                <Layers className="h-3 w-3 mr-1" />
                {stepCount} etapas
              </Badge>
            </div>
            {template?.description && (
              <p className="text-sm text-muted-foreground mt-1">
                {template.description}
              </p>
            )}
          </div>

          {/* Space Selection */}
          <div className="grid gap-2">
            <Label>Espaço de Destino *</Label>
            <Select value={selectedSpace} onValueChange={setSelectedSpace}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o espaço" />
              </SelectTrigger>
              <SelectContent>
                {spaces?.map((space) => (
                  <SelectItem key={space.id} value={space.id}>
                    {space.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Folder Selection */}
          {selectedSpace && folders && folders.length > 0 && (
            <div className="grid gap-2">
              <Label>Pasta (opcional)</Label>
              <Select value={selectedFolder} onValueChange={setSelectedFolder}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma pasta" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Nenhuma pasta</SelectItem>
                  {folders.map((folder) => (
                    <SelectItem key={folder.id} value={folder.id}>
                      {folder.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Card Prefix */}
          <div className="grid gap-2">
            <Label htmlFor="prefix">Prefixo dos Cards (opcional)</Label>
            <Input
              id="prefix"
              placeholder="Ex: Processo 001"
              value={cardPrefix}
              onChange={(e) => setCardPrefix(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              O prefixo será adicionado ao título de cada card criado.
            </p>
          </div>

          {/* Preview */}
          {stepCount > 0 && (
            <div className="text-sm text-muted-foreground">
              <p>
                Serão criados <strong>{stepCount} cards</strong> no espaço selecionado.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => applyMutation.mutate()}
            disabled={!selectedSpace || applyMutation.isPending}
          >
            {applyMutation.isPending ? 'Aplicando...' : 'Aplicar Template'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
