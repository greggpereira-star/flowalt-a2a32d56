import React from 'react';
import { extractPlainText } from '@/components/ui/rich-text-viewer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Mail, 
  Check, 
  X, 
  Clock,
  ExternalLink,
  Loader2
} from 'lucide-react';
import { useMyPendingInvites, useRespondToInvite } from '@/hooks/useCardInvites';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const URGENCY_COLORS = {
  low: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  medium: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
  high: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
  critical: 'bg-red-500/10 text-red-500 border-red-500/20',
};

export const PendingInvitesNotification: React.FC = () => {
  const { data: invites = [], isLoading } = useMyPendingInvites();
  const respondToInvite = useRespondToInvite();

  if (isLoading) {
    return null;
  }

  if (invites.length === 0) {
    return null;
  }

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Mail className="h-4 w-4 text-primary" />
          Convites Pendentes
          <Badge variant="secondary" className="ml-auto">
            {invites.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {invites.map((invite) => {
          const card = invite.cards as {
            id: string;
            title: string;
            description: string | null;
            status: string;
            urgency: string;
          } | null;

          return (
            <div
              key={invite.id}
              className="p-3 rounded-lg bg-background border space-y-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <h4 className="font-medium text-sm truncate">
                    {card?.title || 'Card'}
                  </h4>
                  {card?.description && (
                    <p className="text-xs text-muted-foreground line-clamp-1">
                      {extractPlainText(card.description)}
                    </p>
                  )}
                </div>
                {card?.urgency && (
                  <Badge 
                    variant="outline" 
                    className={URGENCY_COLORS[card.urgency as keyof typeof URGENCY_COLORS]}
                  >
                    {card.urgency}
                  </Badge>
                )}
              </div>

              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                <span>
                  Expira {formatDistanceToNow(new Date(invite.expires_at), {
                    addSuffix: true,
                    locale: ptBR,
                  })}
                </span>
              </div>

              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="default"
                  className="flex-1 gap-1"
                  onClick={() => respondToInvite.mutate({
                    inviteId: invite.id,
                    response: 'accepted',
                  })}
                  disabled={respondToInvite.isPending}
                >
                  {respondToInvite.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Check className="h-3.5 w-3.5" />
                  )}
                  Aceitar
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 gap-1"
                  onClick={() => respondToInvite.mutate({
                    inviteId: invite.id,
                    response: 'declined',
                  })}
                  disabled={respondToInvite.isPending}
                >
                  <X className="h-3.5 w-3.5" />
                  Recusar
                </Button>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};
