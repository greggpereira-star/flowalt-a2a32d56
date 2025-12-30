import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useUserLevel, LEVEL_CONFIGS } from '@/hooks/useUserLevel';
import { Skeleton } from '@/components/ui/skeleton';
import { Crown, Users } from 'lucide-react';

export function LevelLeaderboard() {
  const { workspaceLevels, getLevelConfig, getProgressToNextLevel, isLoading } = useUserLevel();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  const getInitials = (name: string) => {
    return name
      ?.split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || '??';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Ranking por Nível
        </CardTitle>
      </CardHeader>
      <CardContent>
        {workspaceLevels && workspaceLevels.length > 0 ? (
          <div className="space-y-3">
            {workspaceLevels.map((userLevel: any, index: number) => {
              const config = getLevelConfig(userLevel.current_level);
              const profile = userLevel.profiles;
              const progress = getProgressToNextLevel(userLevel);

              return (
                <div
                  key={userLevel.id}
                  className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
                    index === 0 ? 'bg-gradient-to-r from-yellow-500/10 to-amber-500/10 border border-yellow-500/20' : 'bg-muted/30'
                  }`}
                >
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-background text-sm font-bold">
                    {index === 0 ? <Crown className="h-4 w-4 text-yellow-500" /> : index + 1}
                  </div>
                  
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={profile?.avatar_url} />
                    <AvatarFallback>{getInitials(profile?.full_name || profile?.email || '')}</AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium truncate">
                        {profile?.full_name || profile?.email?.split('@')[0] || 'Usuário'}
                      </p>
                      <Badge variant="outline" className={`text-xs ${config.color}`}>
                        {config.icon} Nv.{userLevel.current_level}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <Progress value={progress} className="h-1.5 flex-1" />
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {userLevel.total_score.toLocaleString()} pts
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>Nenhum usuário com pontuação ainda</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
