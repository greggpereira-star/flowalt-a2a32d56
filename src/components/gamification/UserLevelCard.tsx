import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { useUserLevel, LEVEL_CONFIGS } from '@/hooks/useUserLevel';
import { Skeleton } from '@/components/ui/skeleton';
import { Star, TrendingUp } from 'lucide-react';

export function UserLevelCard() {
  const { userLevel, isLoading, getLevelConfig, getProgressToNextLevel } = useUserLevel();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-4 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!userLevel) return null;

  const config = getLevelConfig(userLevel.current_level);
  const progress = getProgressToNextLevel(userLevel);
  const nextConfig = LEVEL_CONFIGS.find(c => c.level === userLevel.current_level + 1);

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Star className="h-5 w-5 text-yellow-500" />
          Seu Nível
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <div className="text-5xl">{config.icon}</div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className={`text-2xl font-bold ${config.color}`}>
                Nível {userLevel.current_level}
              </span>
              <Badge variant="secondary" className="text-xs">
                {config.name}
              </Badge>
            </div>
            <p className="text-muted-foreground text-sm">
              {userLevel.total_score.toLocaleString()} pontos totais
            </p>
          </div>
        </div>

        {nextConfig && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Progresso para {nextConfig.name}</span>
              <span className="font-medium">{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-2" />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{userLevel.total_score} pts</span>
              <span>{userLevel.next_level_score} pts</span>
            </div>
          </div>
        )}

        {!nextConfig && (
          <div className="text-center py-2">
            <Badge className="bg-gradient-to-r from-amber-500 to-yellow-500 text-white">
              🏆 Nível Máximo Alcançado!
            </Badge>
          </div>
        )}

        <div className="pt-2 border-t">
          <h4 className="text-sm font-medium mb-2 flex items-center gap-1">
            <TrendingUp className="h-4 w-4" />
            Como ganhar pontos
          </h4>
          <ul className="text-xs text-muted-foreground space-y-1">
            <li>• Completar metas semanais: +100 pts (ou valor da meta)</li>
            <li>• Ganhar badges: +50 pts cada</li>
            <li>• Completar cards: pontos automáticos do ranking</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
