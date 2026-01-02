import React, { useState } from 'react';
import { useWorkspaceMembers, useRemoveWorkspaceMember } from '@/hooks/useWorkspaceMembers';
import { useChangeMemberRole, usePromoteToOwner } from '@/hooks/useWorkspaceInvites';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { MemberAccessDiagnosticSheet } from '@/components/governance/MemberAccessDiagnosticSheet';
import { ExternalCollaboratorFormModal } from '@/components/financial/ExternalCollaboratorFormModal';
import { 
  Users, 
  MoreVertical, 
  Crown, 
  Shield, 
  UserCog, 
  Wallet,
  User,
  UserMinus,
  ChevronUp,
  Search,
  UserPlus,
} from 'lucide-react';
import type { AppRole } from '@/lib/supabase';

const ROLE_CONFIG: Record<AppRole, { label: string; icon: typeof Crown; color: string }> = {
  super_admin: { label: 'Super Admin', icon: Shield, color: 'text-red-500' },
  owner: { label: 'Proprietário', icon: Crown, color: 'text-amber-500' },
  admin: { label: 'Administrador', icon: Shield, color: 'text-blue-500' },
  coordinator: { label: 'Coordenador', icon: UserCog, color: 'text-purple-500' },
  finance: { label: 'Financeiro', icon: Wallet, color: 'text-emerald-500' },
  member: { label: 'Colaborador', icon: User, color: 'text-muted-foreground' },
  viewer: { label: 'Visualizador', icon: User, color: 'text-muted-foreground' },
};

const ASSIGNABLE_ROLES: AppRole[] = ['admin', 'coordinator', 'finance', 'member', 'viewer'];

export function WorkspaceMembersPanel() {
  const { user } = useAuth();
  const { data: members, isLoading } = useWorkspaceMembers();
  const { canManageWorkspace, isOwner, isAdmin } = usePermissions();
  const changeMemberRole = useChangeMemberRole();
  const promoteToOwner = usePromoteToOwner();
  const removeMember = useRemoveWorkspaceMember();

  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const [confirmPromote, setConfirmPromote] = useState<string | null>(null);
  const [diagnosticMember, setDiagnosticMember] = useState<{
    id: string;
    name: string;
    email: string;
    role: AppRole;
    avatarUrl?: string | null;
  } | null>(null);
  const [showExternalCollaboratorModal, setShowExternalCollaboratorModal] = useState(false);

  const handleRoleChange = async (userId: string, newRole: AppRole) => {
    await changeMemberRole.mutateAsync({ userId, newRole });
  };

  const handlePromoteToOwner = async (userId: string) => {
    await promoteToOwner.mutateAsync(userId);
    setConfirmPromote(null);
  };

  const handleRemoveMember = async (userId: string) => {
    await removeMember.mutateAsync(userId);
    setConfirmRemove(null);
  };

  const getInitials = (name: string | null | undefined, email: string) => {
    if (name) {
      return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }
    return email.slice(0, 2).toUpperCase();
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-72" />
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="flex-1">
                <Skeleton className="h-4 w-32 mb-1" />
                <Skeleton className="h-3 w-48" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  const memberToRemove = members?.find(m => m.user_id === confirmRemove);
  const memberToPromote = members?.find(m => m.user_id === confirmPromote);

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Users className="h-5 w-5 text-primary" />
              <div>
                <CardTitle>Membros do Workspace</CardTitle>
                <CardDescription>
                  {members?.length || 0} membro{members?.length !== 1 ? 's' : ''} ativo{members?.length !== 1 ? 's' : ''}
                </CardDescription>
              </div>
            </div>
            {canManageWorkspace && (
              <Button 
                onClick={() => setShowExternalCollaboratorModal(true)}
                size="sm"
                className="gap-2"
              >
                <UserPlus className="h-4 w-4" />
                Novo Colaborador Externo
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {members?.map((member) => {
              const roleConfig = ROLE_CONFIG[member.role || 'member'];
              const RoleIcon = roleConfig.icon;
              const isCurrentUser = member.user_id === user?.id;
              const isMemberOwner = member.role === 'owner';
              const canEditMember = canManageWorkspace && !isCurrentUser && !isMemberOwner;
              const canPromote = isOwner && !isCurrentUser && !isMemberOwner;

              return (
                <div
                  key={member.id}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={member.profile?.avatar_url || undefined} />
                    <AvatarFallback>
                      {getInitials(member.profile?.full_name, member.profile?.email || '')}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">
                        {member.profile?.full_name || member.profile?.email}
                      </span>
                      {isCurrentUser && (
                        <Badge variant="outline" className="text-xs">Você</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground truncate">
                      {member.profile?.email}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="gap-1">
                      <RoleIcon className={`h-3 w-3 ${roleConfig.color}`} />
                      {roleConfig.label}
                    </Badge>

                    {(canEditMember || canPromote || isAdmin || isOwner) && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {/* Diagnose access - Admin/Owner only */}
                          {(isAdmin || isOwner) && (
                            <>
                              <DropdownMenuItem
                                onClick={() => setDiagnosticMember({
                                  id: member.user_id,
                                  name: member.profile?.full_name || member.profile?.email || '',
                                  email: member.profile?.email || '',
                                  role: member.role || 'member',
                                  avatarUrl: member.profile?.avatar_url,
                                })}
                              >
                                <Search className="h-4 w-4 mr-2" />
                                Diagnosticar acesso
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                            </>
                          )}

                          {canEditMember && (
                            <>
                              {ASSIGNABLE_ROLES.map((role) => {
                                const config = ROLE_CONFIG[role];
                                const Icon = config.icon;
                                return (
                                  <DropdownMenuItem
                                    key={role}
                                    onClick={() => handleRoleChange(member.user_id, role)}
                                    disabled={member.role === role}
                                  >
                                    <Icon className={`h-4 w-4 mr-2 ${config.color}`} />
                                    Definir como {config.label}
                                  </DropdownMenuItem>
                                );
                              })}
                              <DropdownMenuSeparator />
                            </>
                          )}

                          {canPromote && (
                            <DropdownMenuItem
                              onClick={() => setConfirmPromote(member.user_id)}
                              className="text-amber-600"
                            >
                              <ChevronUp className="h-4 w-4 mr-2" />
                              Promover a Proprietário
                            </DropdownMenuItem>
                          )}

                          {canEditMember && (
                            <DropdownMenuItem
                              onClick={() => setConfirmRemove(member.user_id)}
                              className="text-destructive"
                            >
                              <UserMinus className="h-4 w-4 mr-2" />
                              Remover do Workspace
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Remove confirmation */}
      <AlertDialog open={!!confirmRemove} onOpenChange={() => setConfirmRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover membro?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover{' '}
              <strong>{memberToRemove?.profile?.full_name || memberToRemove?.profile?.email}</strong>{' '}
              do workspace? Esta ação pode ser desfeita com um novo convite.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmRemove && handleRemoveMember(confirmRemove)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Promote confirmation */}
      <AlertDialog open={!!confirmPromote} onOpenChange={() => setConfirmPromote(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Promover a Proprietário?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja promover{' '}
              <strong>{memberToPromote?.profile?.full_name || memberToPromote?.profile?.email}</strong>{' '}
              a Proprietário? Proprietários têm controle total sobre o workspace.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmPromote && handlePromoteToOwner(confirmPromote)}
            >
              Promover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Access Diagnostic Sheet */}
      <MemberAccessDiagnosticSheet
        open={!!diagnosticMember}
        onOpenChange={(open) => !open && setDiagnosticMember(null)}
        member={diagnosticMember}
      />

      {/* External Collaborator Modal */}
      <ExternalCollaboratorFormModal
        open={showExternalCollaboratorModal}
        onOpenChange={setShowExternalCollaboratorModal}
      />
    </>
  );
}
