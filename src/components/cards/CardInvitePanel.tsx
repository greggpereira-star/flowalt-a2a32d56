import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  UserPlus,
  Mail,
  Clock,
  Check,
  X,
  Trash2,
  Eye,
  MessageSquare,
  Edit3,
  Send,
  Loader2,
} from 'lucide-react';
import { useCardInvites, useCreateCardInvite, useRevokeInvite } from '@/hooks/useCardInvites';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface CardInvitePanelProps {
  cardId: string;
}

const PERMISSION_ICONS = {
  view: Eye,
  comment: MessageSquare,
  edit: Edit3,
};

const PERMISSION_LABELS = {
  view: 'Visualizar',
  comment: 'Comentar',
  edit: 'Editar',
};

const STATUS_CONFIG = {
  pending: { label: 'Pendente', variant: 'secondary' as const, icon: Clock },
  accepted: { label: 'Aceito', variant: 'default' as const, icon: Check },
  declined: { label: 'Recusado', variant: 'destructive' as const, icon: X },
  expired: { label: 'Expirado', variant: 'outline' as const, icon: Clock },
};

export const CardInvitePanel: React.FC<CardInvitePanelProps> = ({ cardId }) => {
  const [email, setEmail] = useState('');
  const [permission, setPermission] = useState<'view' | 'comment' | 'edit'>('view');
  
  const { data: invites = [], isLoading } = useCardInvites(cardId);
  const createInvite = useCreateCardInvite();
  const revokeInvite = useRevokeInvite();

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    await createInvite.mutateAsync({
      cardId,
      email: email.trim(),
      permission,
    });

    setEmail('');
    setPermission('view');
  };

  const getInitials = (email: string) => {
    return email.substring(0, 2).toUpperCase();
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <UserPlus className="h-4 w-4" />
          Convidar Colaboradores
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Invite Form */}
        <form onSubmit={handleInvite} className="space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="email"
                placeholder="email@exemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={permission} onValueChange={(v) => setPermission(v as typeof permission)}>
              <SelectTrigger className="w-[130px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="view">
                  <span className="flex items-center gap-2">
                    <Eye className="h-3.5 w-3.5" />
                    Visualizar
                  </span>
                </SelectItem>
                <SelectItem value="comment">
                  <span className="flex items-center gap-2">
                    <MessageSquare className="h-3.5 w-3.5" />
                    Comentar
                  </span>
                </SelectItem>
                <SelectItem value="edit">
                  <span className="flex items-center gap-2">
                    <Edit3 className="h-3.5 w-3.5" />
                    Editar
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            type="submit"
            className="w-full gap-2"
            disabled={!email.trim() || createInvite.isPending}
          >
            {createInvite.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Enviar Convite
          </Button>
        </form>

        {/* Invites List */}
        {isLoading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : invites.length > 0 ? (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">
              Convites ({invites.length})
            </p>
            <div className="space-y-2">
              {invites.map((invite) => {
                const StatusIcon = STATUS_CONFIG[invite.status].icon;
                const PermIcon = PERMISSION_ICONS[invite.permission];
                
                return (
                  <div
                    key={invite.id}
                    className="flex items-center justify-between gap-2 p-2 rounded-lg bg-muted/50"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="text-xs">
                          {getInitials(invite.email)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{invite.email}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="flex items-center gap-1">
                                  <PermIcon className="h-3 w-3" />
                                  {PERMISSION_LABELS[invite.permission]}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>
                                Permissão: {PERMISSION_LABELS[invite.permission]}
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          <span>•</span>
                          <span>
                            {formatDistanceToNow(new Date(invite.created_at), {
                              addSuffix: true,
                              locale: ptBR,
                            })}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={STATUS_CONFIG[invite.status].variant} className="gap-1">
                        <StatusIcon className="h-3 w-3" />
                        {STATUS_CONFIG[invite.status].label}
                      </Badge>
                      {invite.status === 'pending' && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-destructive hover:text-destructive"
                                onClick={() => revokeInvite.mutate(invite.id)}
                                disabled={revokeInvite.isPending}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Revogar convite</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="text-center py-4 text-sm text-muted-foreground">
            Nenhum convite enviado ainda
          </div>
        )}
      </CardContent>
    </Card>
  );
};
