import React, { useState } from 'react';
import { useApiKeys, useCreateApiKey, useUpdateApiKey, useDeleteApiKey } from '@/hooks/useApiKeys';
import { useEntitlementRegistry } from '@/hooks/useEntitlementRegistry';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Key, Plus, Copy, Trash2, Eye, EyeOff, AlertTriangle, Lock } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { useWorkspace } from '@/contexts/WorkspaceContext';

const PERMISSIONS = [
  { value: 'read', label: 'Leitura', description: 'Ler cards, comentários, eventos' },
  { value: 'write', label: 'Escrita', description: 'Criar e atualizar recursos' },
  { value: 'admin', label: 'Admin', description: 'Gerenciar webhooks e configurações' },
];

export function ApiKeyManager() {
  const { data: apiKeys, isLoading } = useApiKeys();
  const createApiKey = useCreateApiKey();
  const updateApiKey = useUpdateApiKey();
  const deleteApiKey = useDeleteApiKey();
  const { toast } = useToast();
  const { currentRole } = useWorkspace();
  
  const { within, explain, has } = useEntitlementRegistry();
  const canCreateKey = within('api_keys_limit') && has('integrations_access');
  const explanation = explain('api_keys_limit');
  const isAdmin = currentRole === 'owner' || currentRole === 'admin';

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyPermissions, setNewKeyPermissions] = useState<string[]>(['read']);
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(false);

  const handleCreate = async () => {
    const result = await createApiKey.mutateAsync({
      name: newKeyName,
      permissions: newKeyPermissions,
    });
    setCreatedKey(result.full_key);
    setNewKeyName('');
    setNewKeyPermissions(['read']);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Copiado para a área de transferência' });
  };

  const togglePermission = (permission: string) => {
    setNewKeyPermissions(prev =>
      prev.includes(permission)
        ? prev.filter(p => p !== permission)
        : [...prev, permission]
    );
  };

  if (isLoading) {
    return <div className="animate-pulse h-40 bg-muted rounded-lg" />;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              API Keys
            </CardTitle>
            <CardDescription>
              Gerencie chaves de API para acesso externo ao workspace
            </CardDescription>
          </div>
          <Dialog open={isCreateOpen} onOpenChange={(open) => {
            setIsCreateOpen(open);
            if (!open) {
              setCreatedKey(null);
              setShowKey(false);
            }
          }}>
            <DialogTrigger asChild>
              <Button size="sm" disabled={!canCreateKey}>
                <Plus className="h-4 w-4 mr-2" />
                Nova API Key
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {createdKey ? 'API Key Criada' : 'Criar API Key'}
                </DialogTitle>
              </DialogHeader>

              {/* Limit warning */}
              {!createdKey && !canCreateKey && explanation.reason_code !== 'OK' && (
                <div className="p-4 rounded-lg border border-warning bg-warning/10">
                  <div className="flex items-center gap-2 text-warning-foreground">
                    {explanation.reason_code === 'DISABLED' ? (
                      <Lock className="h-4 w-4" />
                    ) : (
                      <AlertTriangle className="h-4 w-4" />
                    )}
                    <span className="font-medium">{explanation.message}</span>
                  </div>
                  {explanation.cta && isAdmin && (
                    <p className="text-sm text-muted-foreground mt-1">{explanation.cta}</p>
                  )}
                  {explanation.limit && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {explanation.current}/{explanation.limit} API Keys utilizadas
                    </p>
                  )}
                </div>
              )}
              
              {createdKey ? (
                <div className="space-y-4">
                  <div className="p-4 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground mb-2">
                      Copie sua API Key agora. Ela não será exibida novamente.
                    </p>
                    <div className="flex items-center gap-2">
                      <Input
                        value={showKey ? createdKey : '•'.repeat(40)}
                        readOnly
                        className="font-mono text-sm"
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setShowKey(!showKey)}
                      >
                        {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => copyToClipboard(createdKey)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <Button onClick={() => setIsCreateOpen(false)} className="w-full">
                    Fechar
                  </Button>
                </div>
              ) : canCreateKey ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="key-name">Nome</Label>
                    <Input
                      id="key-name"
                      placeholder="Ex: Integração Zapier"
                      value={newKeyName}
                      onChange={(e) => setNewKeyName(e.target.value)}
                    />
                  </div>
                  
                  <div className="space-y-3">
                    <Label>Permissões</Label>
                    {PERMISSIONS.map((perm) => (
                      <div key={perm.value} className="flex items-start space-x-3">
                        <Checkbox
                          id={`perm-${perm.value}`}
                          checked={newKeyPermissions.includes(perm.value)}
                          onCheckedChange={() => togglePermission(perm.value)}
                        />
                        <div className="space-y-1">
                          <Label htmlFor={`perm-${perm.value}`} className="font-medium">
                            {perm.label}
                          </Label>
                          <p className="text-xs text-muted-foreground">
                            {perm.description}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>

                  <Button
                    onClick={handleCreate}
                    disabled={!newKeyName || newKeyPermissions.length === 0 || createApiKey.isPending}
                    className="w-full"
                  >
                    {createApiKey.isPending ? 'Criando...' : 'Criar API Key'}
                  </Button>
                </div>
              ) : null}
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {apiKeys?.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Nenhuma API Key criada ainda
          </p>
        ) : (
          <div className="space-y-3">
            {apiKeys?.map((key) => (
              <div
                key={key.id}
                className="flex items-center justify-between p-4 border rounded-lg"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{key.name}</span>
                    <code className="text-xs bg-muted px-2 py-0.5 rounded">
                      {key.key_prefix}...
                    </code>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>
                      Criada em {format(new Date(key.created_at), "dd/MM/yyyy", { locale: ptBR })}
                    </span>
                    {key.last_used_at && (
                      <>
                        <span>•</span>
                        <span>
                          Último uso: {format(new Date(key.last_used_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                        </span>
                      </>
                    )}
                  </div>
                  <div className="flex gap-1 mt-1">
                    {key.permissions.map((perm) => (
                      <Badge key={perm} variant="secondary" className="text-xs">
                        {perm}
                      </Badge>
                    ))}
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Ativa</span>
                    <Switch
                      checked={key.is_active}
                      onCheckedChange={(checked) =>
                        updateApiKey.mutate({ id: key.id, is_active: checked })
                      }
                    />
                  </div>
                  
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Excluir API Key</AlertDialogTitle>
                        <AlertDialogDescription>
                          Tem certeza que deseja excluir a API Key "{key.name}"? 
                          Integrações que usam esta chave deixarão de funcionar.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => deleteApiKey.mutate(key.id)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Excluir
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
