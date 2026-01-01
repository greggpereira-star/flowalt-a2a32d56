import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useSpaces, useUpdateSpace } from '@/hooks/useSpaces';
import { usePermissions } from '@/hooks/usePermissions';
import { Loader2, Lock, Unlock, Save } from 'lucide-react';
import { toast } from 'sonner';

const AVAILABLE_ROLES = [
  { value: 'owner', label: 'Owner' },
  { value: 'admin', label: 'Admin' },
  { value: 'coordinator', label: 'Coordinator' },
  { value: 'finance', label: 'Finance' },
  { value: 'collaborator', label: 'Collaborator' },
];

export function SpaceAccessControl() {
  const { data: spaces, isLoading } = useSpaces();
  const updateSpace = useUpdateSpace();
  const { canManageWorkspace } = usePermissions();
  const [editingSpace, setEditingSpace] = useState<string | null>(null);
  const [accessLevel, setAccessLevel] = useState<'operational' | 'restricted'>('operational');
  const [allowedRoles, setAllowedRoles] = useState<string[]>([]);

  const handleEdit = (space: any) => {
    setEditingSpace(space.id);
    setAccessLevel(space.access_level || 'operational');
    setAllowedRoles(space.allowed_roles || []);
  };

  const handleSave = async (spaceId: string) => {
    try {
      await updateSpace.mutateAsync({
        id: spaceId,
        access_level: accessLevel,
        allowed_roles: accessLevel === 'restricted' ? allowedRoles : [],
      });
      toast.success('Configurações de acesso atualizadas');
      setEditingSpace(null);
    } catch (error: any) {
      toast.error(error.message || 'Erro ao atualizar');
    }
  };

  const toggleRole = (role: string) => {
    setAllowedRoles(prev => 
      prev.includes(role) 
        ? prev.filter(r => r !== role)
        : [...prev, role]
    );
  };

  if (!canManageWorkspace) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Você não tem permissão para gerenciar acessos de espaços.
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">Controle de Acesso por Espaço</h3>
        <p className="text-sm text-muted-foreground">
          Defina quais papéis podem acessar cada espaço.
        </p>
      </div>

      {spaces?.map((space) => (
        <Card key={space.id}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div 
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: space.color || '#6366f1' }}
                >
                  {(space as any).access_level === 'restricted' ? (
                    <Lock className="h-4 w-4 text-white" />
                  ) : (
                    <Unlock className="h-4 w-4 text-white" />
                  )}
                </div>
                <div>
                  <CardTitle className="text-base">{space.name}</CardTitle>
                  <CardDescription className="text-xs">
                    {space.is_system && <Badge variant="outline" className="mr-2">Sistema</Badge>}
                    {(space as any).access_level === 'restricted' ? 'Restrito' : 'Operacional'}
                  </CardDescription>
                </div>
              </div>
              
              {editingSpace !== space.id ? (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => handleEdit(space)}
                  disabled={space.is_system}
                >
                  Editar
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => setEditingSpace(null)}
                  >
                    Cancelar
                  </Button>
                  <Button 
                    size="sm"
                    onClick={() => handleSave(space.id)}
                    disabled={updateSpace.isPending}
                  >
                    {updateSpace.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>

          {editingSpace === space.id && (
            <CardContent className="space-y-4 border-t pt-4">
              {/* Access Level Toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <Label>Nível de Acesso</Label>
                  <p className="text-sm text-muted-foreground">
                    {accessLevel === 'restricted' 
                      ? 'Apenas papéis selecionados podem ver este espaço'
                      : 'Todos os membros do workspace podem ver este espaço'
                    }
                  </p>
                </div>
                <Switch
                  checked={accessLevel === 'restricted'}
                  onCheckedChange={(checked) => 
                    setAccessLevel(checked ? 'restricted' : 'operational')
                  }
                />
              </div>

              {/* Role Selection */}
              {accessLevel === 'restricted' && (
                <div className="space-y-3 p-4 bg-muted/50 rounded-lg">
                  <Label>Papéis com Acesso</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {AVAILABLE_ROLES.map((role) => (
                      <div key={role.value} className="flex items-center space-x-2">
                        <Checkbox
                          id={`role-${role.value}`}
                          checked={allowedRoles.includes(role.value)}
                          onCheckedChange={() => toggleRole(role.value)}
                        />
                        <Label 
                          htmlFor={`role-${role.value}`}
                          className="text-sm font-normal cursor-pointer"
                        >
                          {role.label}
                        </Label>
                      </div>
                    ))}
                  </div>
                  {allowedRoles.length === 0 && (
                    <p className="text-sm text-amber-600">
                      ⚠️ Selecione pelo menos um papel para ter acesso
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          )}
        </Card>
      ))}
    </div>
  );
}
