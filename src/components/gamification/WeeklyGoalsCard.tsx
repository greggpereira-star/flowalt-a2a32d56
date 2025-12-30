import React from 'react';
import { useWeeklyGoals } from '@/hooks/useWeeklyGoals';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Target, Trophy, CheckCircle2, Clock, MessageSquare, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

const goalIcons: Record<string, React.ReactNode> = {
  cards_created: <FileText className="h-5 w-5" />,
  cards_completed: <CheckCircle2 className="h-5 w-5" />,
  hours_logged: <Clock className="h-5 w-5" />,
  comments_made: <MessageSquare className="h-5 w-5" />,
};

export function WeeklyGoalsCard() {
  const { goals, isLoading, getGoalTypeLabel, getGoalTypeIcon } = useWeeklyGoals();

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-muted rounded w-1/3" />
            <div className="h-8 bg-muted rounded" />
            <div className="h-8 bg-muted rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (goals.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            Metas da Semana
          </CardTitle>
          <CardDescription>
            Nenhuma meta definida para esta semana
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            Administradores podem criar metas semanais para motivar a equipe
          </p>
        </CardContent>
      </Card>
    );
  }

  const completedGoals = goals.filter(g => g.progress?.completed).length;
  const totalProgress = goals.length > 0 
    ? Math.round((completedGoals / goals.length) * 100)
    : 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              Metas da Semana
            </CardTitle>
            <CardDescription>
              {completedGoals} de {goals.length} metas concluídas
            </CardDescription>
          </div>
          {completedGoals === goals.length && goals.length > 0 && (
            <Badge className="bg-gradient-to-r from-yellow-500 to-amber-500 text-white">
              <Trophy className="h-3 w-3 mr-1" />
              Completo!
            </Badge>
          )}
        </div>
        <Progress value={totalProgress} className="h-2 mt-2" />
      </CardHeader>
      <CardContent className="space-y-4">
        {goals.map((goal) => {
          const progress = goal.progress;
          const currentValue = progress?.current_value || 0;
          const percentage = Math.min(Math.round((currentValue / goal.target_value) * 100), 100);
          const isCompleted = progress?.completed;

          return (
            <div
              key={goal.id}
              className={cn(
                "p-4 rounded-lg border transition-all",
                isCompleted 
                  ? "bg-green-500/5 border-green-500/30" 
                  : "bg-muted/30"
              )}
            >
              <div className="flex items-start gap-3">
                <div className={cn(
                  "p-2 rounded-lg",
                  isCompleted 
                    ? "bg-green-500/20 text-green-600" 
                    : "bg-primary/10 text-primary"
                )}>
                  {goalIcons[goal.goal_type] || <Target className="h-5 w-5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <h4 className={cn(
                      "font-medium",
                      isCompleted && "line-through text-muted-foreground"
                    )}>
                      {goal.title}
                    </h4>
                    <span className="text-sm font-semibold">
                      {currentValue}/{goal.target_value}
                    </span>
                  </div>
                  {goal.description && (
                    <p className="text-sm text-muted-foreground mb-2">
                      {goal.description}
                    </p>
                  )}
                  <div className="flex items-center gap-3">
                    <Progress value={percentage} className="flex-1 h-2" />
                    <span className="text-xs text-muted-foreground w-10 text-right">
                      {percentage}%
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant="outline" className="text-xs">
                      {getGoalTypeIcon(goal.goal_type)} {getGoalTypeLabel(goal.goal_type)}
                    </Badge>
                    {goal.reward_points > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        +{goal.reward_points} pts
                      </Badge>
                    )}
                    {goal.reward_badge && (
                      <Badge variant="secondary" className="text-xs">
                        🏆 Badge
                      </Badge>
                    )}
                  </div>
                </div>
                {isCompleted && (
                  <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
                )}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
