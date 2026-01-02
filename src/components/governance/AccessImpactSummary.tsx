import React, { useState } from 'react';
import { useAccessImpact, type AccessImpactMember } from '@/hooks/useAccessImpact';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  AlertTriangle, 
  ChevronDown, 
  ChevronRight, 
  Eye, 
  EyeOff, 
  UserPlus, 
  Users,
  Info,
  Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface AccessImpactSummaryProps {
  entityType: 'card' | 'folder' | 'space';
  entityId?: string;
  targetFolderId?: string | null;
  targetVisibility?: string | null;
  targetAllowedRoles?: string[] | null;
  targetOwnerId?: string | null;
  className?: string;
  showDetails?: boolean;
}

export const AccessImpactSummary: React.FC<AccessImpactSummaryProps> = ({
  entityType,
  entityId,
  targetFolderId,
  targetVisibility,
  targetAllowedRoles,
  targetOwnerId,
  className,
  showDetails = true,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const {
    willKeepAccess,
    willLoseAccess,
    willGainAccess,
    isLoading,
    hasImpact,
    impactSummary,
  } = useAccessImpact({
    entityType,
    entityId,
    targetFolderId,
    targetVisibility,
    targetAllowedRoles,
    targetOwnerId,
    enabled: true,
  });

  if (isLoading) {
    return (
      <div className={cn('space-y-2', className)}>
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-3 w-32" />
      </div>
    );
  }

  // No impact - don't show anything
  if (!hasImpact && willKeepAccess.length === 0) {
    return null;
  }

  // Has impact - show warning
  if (hasImpact) {
    return (
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded} className={className}>
        <Alert variant="destructive" className="border-warning/50 bg-warning/10">
          <AlertTriangle className="h-4 w-4 text-warning" />
          <AlertTitle className="text-warning flex items-center justify-between">
            <span>Impacto de Visibilidade</span>
            {showDetails && (
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="h-6 px-2 text-warning hover:text-warning">
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                  <span className="ml-1 text-xs">Ver detalhes</span>
                </Button>
              </CollapsibleTrigger>
            )}
          </AlertTitle>
          <AlertDescription className="text-warning/90">
            <span>{impactSummary}</span>
            <p className="text-xs mt-1 text-muted-foreground">
              Isso pode alterar notificações e visibilidade no search.
            </p>
          </AlertDescription>
        </Alert>

        {showDetails && (
          <CollapsibleContent className="mt-2 space-y-2">
            {/* Will lose access */}
            {willLoseAccess.length > 0 && (
              <AccessList
                title="Perderão acesso"
                members={willLoseAccess}
                icon={<EyeOff className="h-4 w-4" />}
                variant="destructive"
              />
            )}

            {/* Will gain access */}
            {willGainAccess.length > 0 && (
              <AccessList
                title="Ganharão acesso"
                members={willGainAccess}
                icon={<UserPlus className="h-4 w-4" />}
                variant="success"
              />
            )}

            {/* Will keep access */}
            {willKeepAccess.length > 0 && (
              <AccessList
                title="Manterão acesso"
                members={willKeepAccess}
                icon={<Eye className="h-4 w-4" />}
                variant="muted"
                collapsed
              />
            )}
          </CollapsibleContent>
        )}
      </Collapsible>
    );
  }

  // No impact but show current access
  return (
    <div className={cn('flex items-center gap-2 text-xs text-muted-foreground', className)}>
      <Users className="h-3.5 w-3.5" />
      <span>{willKeepAccess.length} membros terão acesso</span>
    </div>
  );
};

interface AccessListProps {
  title: string;
  members: AccessImpactMember[];
  icon: React.ReactNode;
  variant: 'destructive' | 'success' | 'muted';
  collapsed?: boolean;
}

const AccessList: React.FC<AccessListProps> = ({
  title,
  members,
  icon,
  variant,
  collapsed = false,
}) => {
  const [isOpen, setIsOpen] = useState(!collapsed);

  const variantStyles = {
    destructive: 'border-destructive/30 bg-destructive/5',
    success: 'border-green-500/30 bg-green-500/5',
    muted: 'border-border bg-muted/30',
  };

  const textStyles = {
    destructive: 'text-destructive',
    success: 'text-green-600 dark:text-green-400',
    muted: 'text-muted-foreground',
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className={cn('rounded-lg border p-2', variantStyles[variant])}>
        <CollapsibleTrigger className="flex items-center gap-2 w-full text-left">
          <span className={textStyles[variant]}>{icon}</span>
          <span className={cn('text-sm font-medium', textStyles[variant])}>{title}</span>
          <Badge variant="secondary" className="ml-auto text-xs">
            {members.length}
          </Badge>
          {isOpen ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
        </CollapsibleTrigger>

        <CollapsibleContent>
          <ScrollArea className="max-h-32 mt-2">
            <div className="space-y-1">
              {members.slice(0, 10).map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between text-xs py-1 px-2 rounded bg-background/50"
                >
                  <span className="truncate">{member.name}</span>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px] h-4">
                      {member.role}
                    </Badge>
                    {member.reason && (
                      <span className="text-muted-foreground text-[10px] truncate max-w-24">
                        {member.reason}
                      </span>
                    )}
                  </div>
                </div>
              ))}
              {members.length > 10 && (
                <div className="text-xs text-muted-foreground text-center py-1">
                  +{members.length - 10} mais
                </div>
              )}
            </div>
          </ScrollArea>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
};

export default AccessImpactSummary;
