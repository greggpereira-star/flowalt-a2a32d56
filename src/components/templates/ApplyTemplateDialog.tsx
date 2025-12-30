import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
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
}

interface Template {
  id: string;
  name: string;
  description: string | null;
  steps: unknown;
}

export function ApplyTemplateDialog({ templateId, open, onOpenChange }: ApplyTemplateDialogProps) {
  const { currentWorkspace } = useWorkspace();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [selectedSpace, setSelectedSpace] = useState<string>('');
  const [selectedFolder, setSelectedFolder] = useState<string>('');
  const [cardPrefix, setCardPrefix] = useState('');
  const [template, setTemplate] = useState<Template | null>(null);
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(true);

  // Load template
  useEffect(() => {
    async function loadTemplate() {
      if (!templateId) return;
      setLoading(true);
      const { data } = await supabase
        .from('process_templates')
        .select('id, name, description, steps')
        .eq('id', templateId)
        .single();
      setTemplate(data as Template | null);
      setLoading(false);
    }
    loadTemplate();
  }, [templateId]);

  // Load spaces
  useEffect(() => {
    async function loadSpaces() {
      if (!currentWorkspace?.id) return;
      try {
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/spaces?workspace_id=eq.${currentWorkspace.id}&is_active=eq.true&select=id,name`,
          {
            headers: {
              'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
              'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
            },
          }
        );
        const data = await response.json();
        setSpaces(data ?? []);
      } catch (e) {
        console.error('Error loading spaces:', e);
      }
    }
    loadSpaces();
  }, [currentWorkspace?.id]);

  // Load folders
  useEffect(() => {
    async function loadFolders() {
      if (!selectedSpace) {
        setFolders([]);
        return;
      }
      try {
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/folders?space_id=eq.${selectedSpace}&select=id,name`,
          {
            headers: {
              'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
              'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
            },
          }
        );
        const data = await response.json();
        setFolders(data ?? []);
      } catch (e) {
        console.error('Error loading folders:', e);
      }
    }
    loadFolders();
  }, [selectedSpace]);

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

      const validStatuses = ['backlog', 'todo', 'in_progress', 'review', 'briefing', 'approved', 'delivered', 'archived'] as const;
      type CardStatus = typeof validStatuses[number];

      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        const status = validStatuses.includes(step.status as CardStatus) 
          ? step.status as CardStatus 
          : 'todo';
        
        await supabase.from('cards').insert({
          workspace_id: currentWorkspace.id,
          space_id: selectedSpace,
          folder_id: selectedFolder || null,
          title: cardPrefix ? `${cardPrefix} - ${step.title}` : step.title,
          description: step.description || null,
          status,
          position: i,
          created_by: user.id,
          estimated_hours: step.estimatedHours || null,
        });
      }

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

  if (loading) {
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

          <div className="grid gap-2">
            <Label>Espaço de Destino *</Label>
            <Select value={selectedSpace} onValueChange={setSelectedSpace}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o espaço" />
              </SelectTrigger>
              <SelectContent>
                {spaces.map((space) => (
                  <SelectItem key={space.id} value={space.id}>
                    {space.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedSpace && folders.length > 0 && (
            <div className="grid gap-2">
              <Label>Pasta (opcional)</Label>
              <Select
                value={selectedFolder}
                onValueChange={(v) => setSelectedFolder(v === '__none__' ? '' : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma pasta" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Nenhuma pasta</SelectItem>
                  {folders.map((folder) => (
                    <SelectItem key={folder.id} value={folder.id}>
                      {folder.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

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
