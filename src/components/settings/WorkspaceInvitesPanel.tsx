import React, { useState, useMemo } from 'react';
import { useWorkspaceInvites, useCreateWorkspaceInvite, useRevokeWorkspaceInvite, useResendWorkspaceInvite, checkResendLimit } from '@/hooks/useWorkspaceInvites';
import { usePermissions } from '@/hooks/usePermissions';
import { useEntitlementRegistry } from '@/hooks/useEntitlementRegistry';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
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
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
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
  ChevronDown,
  History,
  Crown,
  Search,
  User,
  Send,

} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import type { AppRole } from '@/lib/supabase';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';

// Include 'owner' role for workspace owners to invite as proprietário
const INVITE_ROLES: { value: AppRole; label: string; icon?: React.ReactNode }[] = [
  { value: 'owner', label: 'Proprietário', icon: <Crown className="h-4 w-4 text-amber-500" /> },
  { value: 'admin', label: 'Administrador' },
  { value: 'coordinator', label: 'Coordenador' },
  { value: 'finance', label: 'Financeiro' },
  { value: 'member', label: 'Colaborador' },
  { value: 'viewer', label: 'Visualizador' },
];

interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
}

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
  const resendInvite = useResendWorkspaceInvite();
  const { canManageWorkspace, canPromoteToOwner } = usePermissions();
  const { currentRole, currentWorkspace } = useWorkspace();
  
  const { within, explain } = useEntitlementRegistry();
  const canInvite = within('members_limit');
  const explanation = explain('members_limit');
  const isAdmin = currentRole === 'owner' || currentRole === 'admin';

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<AppRole>('member');
  const [confirmRevoke, setConfirmRevoke] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);

  // Fetch existing users for autocomplete
  const { data: existingUsers = [] } = useQuery({
    queryKey: ['all-users-search', currentWorkspace?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, full_name, avatar_url')
        .order('full_name', { ascending: true });

      if (error) throw error;
      return data as UserProfile[];
    },
    enabled: isDialogOpen,
  });

  // Filter users based on search query
  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return existingUsers.slice(0, 10);
    
    const query = searchQuery.toLowerCase();
    return existingUsers.filter(user => 
      user.email.toLowerCase().includes(query) ||
      (user.full_name?.toLowerCase().includes(query))
    ).slice(0, 10);
  }, [existingUsers, searchQuery]);

  // Filter roles based on permission
  const availableRoles = useMemo(() => {
    if (canPromoteToOwner) return INVITE_ROLES;
    return INVITE_ROLES.filter(r => r.value !== 'owner');
  }, [canPromoteToOwner]);

  const handleCreateInvite = async () => {
    const inviteEmail = selectedUser?.email || email.trim();
    if (!inviteEmail) return;

    await createInvite.mutateAsync({ email: inviteEmail, role });
    setEmail('');
    setRole('member');
    setSelectedUser(null);
    setSearchQuery('');
    setIsDialogOpen(false);
  };

  const handleRevokeInvite = async (inviteId: string) => {
    await revokeInvite.mutateAsync(inviteId);
    setConfirmRevoke(null);
  };

  const handleSelectUser = (user: UserProfile) => {
    setSelectedUser(user);
    setEmail(user.email);
    setSearchQuery(user.full_name || user.email);
    setIsSearchOpen(false);
  };

  const handleClearSelection = () => {
    setSelectedUser(null);
    setEmail('');
    setSearchQuery('');
  };

  const copyInviteLink = (token: string) => {
    const link = `${window.location.origin}/invite/${token}`;
    navigator.clipboard.writeText(link);
    toast.success('Link copiado!');
  };

  const getInitials = (name: string | null, email: string) => {
    if (name) {
      return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }
    return email.slice(0, 2).toUpperCase();
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
  const selectedRoleData = availableRoles.find(r => r.value === role);

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

            <Dialog open={isDialogOpen} onOpenChange={(open) => {
              setIsDialogOpen(open);
              if (!open) {
                handleClearSelection();
              }
            }}>
              <DialogTrigger asChild>
                <Button size="sm" disabled={!canInvite}>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Convidar
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Convidar Membro</DialogTitle>
                  <DialogDescription>
                    Busque um usuário existente ou digite um email para enviar o convite.
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
                      {/* User search with autocomplete */}
                      <div className="space-y-2">
                        <Label>Usuário ou Email</Label>
                        
                        {selectedUser ? (
                          <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/50">
                            <Avatar className="h-9 w-9">
                              <AvatarImage src={selectedUser.avatar_url || undefined} />
                              <AvatarFallback className="text-xs bg-primary/10 text-primary">
                                {getInitials(selectedUser.full_name, selectedUser.email)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate text-sm">
                                {selectedUser.full_name || selectedUser.email}
                              </p>
                              <p className="text-xs text-muted-foreground truncate">
                                {selectedUser.email}
                              </p>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={handleClearSelection}
                            >
                              <XCircle className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <Popover open={isSearchOpen} onOpenChange={setIsSearchOpen}>
                            <PopoverTrigger asChild>
                              <div className="relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                  placeholder="Buscar usuário ou digite email..."
                                  value={searchQuery || email}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setSearchQuery(val);
                                    setEmail(val);
                                    if (val.length > 0) {
                                      setIsSearchOpen(true);
                                    }
                                  }}
                                  onFocus={() => setIsSearchOpen(true)}
                                  className="pl-10"
                                />
                              </div>
                            </PopoverTrigger>
                            <PopoverContent 
                              className="w-[--radix-popover-trigger-width] p-0" 
                              align="start"
                              onOpenAutoFocus={(e) => e.preventDefault()}
                            >
                              <Command shouldFilter={false}>
                                <CommandList>
                                  {filteredUsers.length === 0 ? (
                                    <CommandEmpty className="py-4 text-center text-sm">
                                      {email.includes('@') ? (
                                        <div className="space-y-2">
                                          <User className="h-8 w-8 mx-auto text-muted-foreground" />
                                          <p>Novo usuário</p>
                                          <p className="text-muted-foreground text-xs">
                                            Convite será enviado para {email}
                                          </p>
                                        </div>
                                      ) : (
                                        <p className="text-muted-foreground">
                                          Nenhum usuário encontrado
                                        </p>
                                      )}
                                    </CommandEmpty>
                                  ) : (
                                    <CommandGroup heading="Usuários cadastrados">
                                      {filteredUsers.map((user) => (
                                        <CommandItem
                                          key={user.id}
                                          value={user.email}
                                          onSelect={() => handleSelectUser(user)}
                                          className="flex items-center gap-3 cursor-pointer"
                                        >
                                          <Avatar className="h-8 w-8">
                                            <AvatarImage src={user.avatar_url || undefined} />
                                            <AvatarFallback className="text-xs bg-primary/10 text-primary">
                                              {getInitials(user.full_name, user.email)}
                                            </AvatarFallback>
                                          </Avatar>
                                          <div className="flex-1 min-w-0">
                                            <p className="font-medium truncate text-sm">
                                              {user.full_name || user.email}
                                            </p>
                                            <p className="text-xs text-muted-foreground truncate">
                                              {user.email}
                                            </p>
                                          </div>
                                        </CommandItem>
                                      ))}
                                    </CommandGroup>
                                  )}
                                </CommandList>
                              </Command>
                            </PopoverContent>
                          </Popover>
                        )}
                      </div>

                      {/* Role selection */}
                      <div className="space-y-2">
                        <Label htmlFor="role">Função</Label>
                        <Select value={role} onValueChange={(v) => setRole(v as AppRole)}>
                          <SelectTrigger>
                            <SelectValue>
                              <div className="flex items-center gap-2">
                                {selectedRoleData?.icon}
                                <span>{selectedRoleData?.label}</span>
                              </div>
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {availableRoles.map((r) => (
                              <SelectItem key={r.value} value={r.value}>
                                <div className="flex items-center gap-2">
                                  {r.icon}
                                  <span>{r.label}</span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {role === 'owner' && (
                          <p className="text-xs text-amber-600 flex items-center gap-1">
                            <Crown className="h-3 w-3" />
                            Este usuário terá controle total do workspace
                          </p>
                        )}
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
                const roleData = INVITE_ROLES.find(r => r.value === invite.role);
                const roleLabel = roleData?.label || invite.role;
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
                        <span className="flex items-center gap-1">
                          {roleData?.icon}
                          {roleLabel}
                        </span>
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

          {/* Past invites - Collapsible */}
          {pastInvites.length > 0 && (
            <Collapsible>
              <CollapsibleTrigger asChild>
                <Button 
                  variant="ghost" 
                  className="w-full justify-between text-muted-foreground hover:text-foreground"
                >
                  <div className="flex items-center gap-2">
                    <History className="h-4 w-4" />
                    <span>Histórico de convites ({pastInvites.length})</span>
                  </div>
                  <ChevronDown className="h-4 w-4 transition-transform duration-200 [[data-state=open]>&]:rotate-180" />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-2 pt-2">
                {pastInvites.map((invite) => {
                  const status = STATUS_CONFIG[invite.status];
                  const StatusIcon = status.icon;
                  const createdAt = formatDistanceToNow(new Date(invite.created_at), { 
                    addSuffix: true, 
                    locale: ptBR 
                  });

                  return (
                    <div
                      key={invite.id}
                      className="flex items-center gap-3 p-2 rounded-lg opacity-60 hover:opacity-80 transition-opacity"
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
              </CollapsibleContent>
            </Collapsible>
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
