import React, { useState } from 'react';
import { useWorkspaceInvites, useCreateWorkspaceInvite, useRevokeWorkspaceInvite } from '@/hooks/useWorkspaceInvites';
import { usePermissions } from '@/hooks/usePermissions';
import { useEntitlementRegistry } from '@/hooks/useEntitlementRegistry';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { 
  Mail, 
  UserPlus, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  Loader2,
  Copy,
  Trash2,
  AlertTriangle,
  Lock,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import type { AppRole } from '@/lib/supabase';
import { useWorkspace } from '@/contexts/WorkspaceContext';

const INVITE_ROLES: { value: AppRole; label: string }[] = [
  { value: 'admin', label: 'Administrador' },
  { value: 'coordinator', label: 'Coordenador' },
  { value: 'finance', label: 'Financeiro' },
  { value: 'member', label: 'Colaborador' },
  { value: 'viewer', label: 'Visualizador' },
];

const STATUS_CONFIG = {
  pending: { label: 'Pendente', icon: Clock, variant: 'secondary' as const },
  accepted: { label: 'Aceito', icon: CheckCircle2, variant: 'default' as const },
  expired: { label: 'Expirado', icon: XCircle, variant: 'destructive' as const },
  revoked: { label: 'Revogado', icon: XCircle, variant: 'outline' as const },
};

export function WorkspaceInvitesPanel() {
  const { data: invites, isLoading } = useWorkspaceInvites();
  const createInvite = useCreateWorkspaceInvite();
  const revokeInvite = useRevokeWorkspaceInvite();
  const { canManageWorkspace } = usePermissions();
  const { currentRole } = useWorkspace();
  
  const { within, explain } = useEntitlementRegistry();
  const canInvite = within('members_limit');
  const explanation = explain('members_limit');
  const isAdmin = currentRole === 'owner' || currentRole === 'admin';

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<AppRole>('member');
  const [confirmRevoke, setConfirmRevoke] = useState<string | null>(null);

  const handleCreateInvite = async () => {
    if (!email.trim()) return;

    await createInvite.mutateAsync({ email: email.trim(), role });
    setEmail('');
    setRole('member');
    setIsDialogOpen(false);
  };

  const handleRevokeInvite = async (inviteId: string) => {
    await revokeInvite.mutateAsync(inviteId);
    setConfirmRevoke(null);
  };

  const copyInviteLink = (token: string) => {
    const link = `${window.location.origin}/invite/${token}`;
    navigator.clipboard.writeText(link);
    toast.success('Link copiado!');
  };

  const pendingInvites = invites?.filter(i => i.status === 'pending') || [];
  const pastInvites = invites?.filter(i => i.status !== 'pending') || [];

  if (!canManageWorkspace) {
    return null;
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-72" />
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  const inviteToRevoke = invites?.find(i => i.id === confirmRevoke);

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Mail className="h-5 w-5 text-primary" />
              <div>
                <CardTitle>Convites</CardTitle>
                <CardDescription>
                  Convide pessoas para participar do workspace
                </CardDescription>
              </div>
            </div>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" disabled={!canInvite}>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Convidar
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Convidar Membro</DialogTitle>
                  <DialogDescription>
                    Envie um convite por email para adicionar alguém ao workspace.
                  </DialogDescription>
                </DialogHeader>

                {/* Limit warning */}
                {!canInvite && explanation.reason_code !== 'OK' && (
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
                        {explanation.current}/{explanation.limit} Membros utilizados
                      </p>
                    )}
                  </div>
                )}

                {canInvite && (
                  <>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <Input
                          id="email"
                          type="email"
                          placeholder="nome@empresa.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="role">Função</Label>
                        <Select value={role} onValueChange={(v) => setRole(v as AppRole)}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {INVITE_ROLES.map((r) => (
                              <SelectItem key={r.value} value={r.value}>
                                {r.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                        Cancelar
                      </Button>
                      <Button 
                        onClick={handleCreateInvite} 
                        disabled={!email.trim() || createInvite.isPending}
                      >
                        {createInvite.isPending ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Enviando...
                          </>
                        ) : (
                          'Enviar Convite'
                        )}
                      </Button>
                    </DialogFooter>
                  </>
                )}
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Pending invites */}
          {pendingInvites.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-muted-foreground">
                Pendentes ({pendingInvites.length})
              </h4>
              {pendingInvites.map((invite) => {
                const status = STATUS_CONFIG[invite.status];
                const StatusIcon = status.icon;
                const roleLabel = INVITE_ROLES.find(r => r.value === invite.role)?.label || invite.role;
                const expiresIn = formatDistanceToNow(new Date(invite.expires_at), { 
                  addSuffix: true, 
                  locale: ptBR 
                });

                return (
                  <div
                    key={invite.id}
                    className="flex items-center gap-3 p-3 rounded-lg border bg-card"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{invite.email}</p>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span>{roleLabel}</span>
                        <span>•</span>
                        <span>Expira {expiresIn}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Badge variant={status.variant} className="gap-1">
                        <StatusIcon className="h-3 w-3" />
                        {status.label}
                      </Badge>

                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => copyInviteLink(invite.token)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>

                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => setConfirmRevoke(invite.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Past invites */}
          {pastInvites.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-muted-foreground">
                Histórico ({pastInvites.length})
              </h4>
              {pastInvites.slice(0, 5).map((invite) => {
                const status = STATUS_CONFIG[invite.status];
                const StatusIcon = status.icon;
                const createdAt = formatDistanceToNow(new Date(invite.created_at), { 
                  addSuffix: true, 
                  locale: ptBR 
                });

                return (
                  <div
                    key={invite.id}
                    className="flex items-center gap-3 p-2 rounded-lg opacity-60"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{invite.email}</p>
                      <p className="text-xs text-muted-foreground">{createdAt}</p>
                    </div>
                    <Badge variant={status.variant} className="gap-1 text-xs">
                      <StatusIcon className="h-3 w-3" />
                      {status.label}
                    </Badge>
                  </div>
                );
              })}
            </div>
          )}

          {invites?.length === 0 && (
            <div className="text-center py-6 text-muted-foreground">
              <Mail className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>Nenhum convite enviado ainda</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Revoke confirmation */}
      <AlertDialog open={!!confirmRevoke} onOpenChange={() => setConfirmRevoke(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revogar convite?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja revogar o convite para{' '}
              <strong>{inviteToRevoke?.email}</strong>? O link de convite será invalidado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmRevoke && handleRevokeInvite(confirmRevoke)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Revogar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
