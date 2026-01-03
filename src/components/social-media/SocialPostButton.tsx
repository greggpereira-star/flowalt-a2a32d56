import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Share2, Sparkles, Lock } from 'lucide-react';
import { useEntitlementRegistry } from '@/hooks/useEntitlementRegistry';
import { useSocialPostsByCard, type SocialPost } from '@/hooks/useSocialPosts';
import { CreateSocialPostDialog } from './CreateSocialPostDialog';
import { cn } from '@/lib/utils';

interface SocialPostButtonProps {
  cardId: string;
  clientId?: string | null;
  className?: string;
  variant?: 'default' | 'compact' | 'icon';
}

export const SocialPostButton: React.FC<SocialPostButtonProps> = ({
  cardId,
  clientId,
  className,
  variant = 'default',
}) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { has, explain } = useEntitlementRegistry();
  const { data: existingPosts } = useSocialPostsByCard(cardId);

  const hasSocialPublish = has('social_publish');
  const explanation = explain('social_publish');
  const postsCount = existingPosts?.length || 0;

  if (!hasSocialPublish) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size={variant === 'icon' ? 'icon' : 'sm'}
              className={cn("opacity-50 cursor-not-allowed", className)}
              disabled
            >
              {variant === 'icon' ? (
                <Lock className="h-4 w-4" />
              ) : (
                <>
                  <Lock className="h-4 w-4 mr-2" />
                  {variant === 'compact' ? 'Social' : 'Gerar Postagem'}
                </>
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-sm">{explanation.cta || 'Recurso não disponível no seu plano'}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size={variant === 'icon' ? 'icon' : 'sm'}
              onClick={() => setDialogOpen(true)}
              className={cn(
                "relative",
                postsCount > 0 && "border-primary/50",
                className
              )}
            >
              {variant === 'icon' ? (
                <Share2 className="h-4 w-4" />
              ) : (
                <>
                  <Share2 className="h-4 w-4 mr-2" />
                  {variant === 'compact' ? 'Social' : 'Gerar Postagem'}
                </>
              )}
              {postsCount > 0 && (
                <Badge
                  variant="secondary"
                  className="absolute -top-2 -right-2 h-5 min-w-5 text-[10px] px-1.5"
                >
                  {postsCount}
                </Badge>
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-sm">
              {postsCount > 0
                ? `${postsCount} postagem(ns) criada(s)`
                : 'Criar postagem para redes sociais'}
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <CreateSocialPostDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        cardId={cardId}
        clientId={clientId || undefined}
        onSuccess={() => setDialogOpen(false)}
      />
    </>
  );
};
