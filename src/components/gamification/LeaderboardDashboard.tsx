import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Trophy, Clock, CheckCircle2, MessageSquare, Award, TrendingUp, Flame, Target } from 'lucide-react';
import { cn } from '@/lib/utils';

interface UserStats {
  user_id: string;
  full_name: string;
  email: string;
  avatar_url: string | null;
  cards_created: number;
  cards_completed: number;
  total_hours: number;
  comments_count: number;
  badges_count: number;
  score: number;
}

export function LeaderboardDashboard() {
  const { currentWorkspace } = useWorkspace();

  const { data: leaderboard = [], isLoading } = useQuery({
    queryKey: ['leaderboard', currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace?.id) return [];

      // Get all workspace members with profiles
      const { data: members, error: membersError } = await supabase
        .from('workspace_members')
        .select('user_id')
        .eq('workspace_id', currentWorkspace.id)
        .eq('is_active', true);

      if (membersError) throw membersError;

      // Get stats for each member
      const stats: UserStats[] = [];

      for (const member of members || []) {
        // Get profile for this user
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, email, avatar_url')
          .eq('id', member.user_id)
          .single();
        
        // Cards created
        const { count: cardsCreated } = await supabase
          .from('cards')
          .select('*', { count: 'exact', head: true })
          .eq('workspace_id', currentWorkspace.id)
          .eq('created_by', member.user_id);

        // Cards completed (delivered)
        const { count: cardsCompleted } = await supabase
          .from('cards')
          .select('*', { count: 'exact', head: true })
          .eq('workspace_id', currentWorkspace.id)
          .eq('owner_id', member.user_id)
          .eq('status', 'delivered');

        // Time entries
        const { data: timeEntries } = await supabase
          .from('time_entries')
          .select('duration_seconds')
          .eq('workspace_id', currentWorkspace.id)
          .eq('user_id', member.user_id);

        const totalHours = (timeEntries || []).reduce(
          (acc, te) => acc + (te.duration_seconds || 0),
          0
        ) / 3600;

        // Comments
        const { count: commentsCount } = await supabase
          .from('comments')
          .select('*, cards!inner(workspace_id)', { count: 'exact', head: true })
          .eq('user_id', member.user_id)
          .eq('cards.workspace_id', currentWorkspace.id);

        // Badges
        const { count: badgesCount } = await supabase
          .from('user_badges')
          .select('*', { count: 'exact', head: true })
          .eq('workspace_id', currentWorkspace.id)
          .eq('user_id', member.user_id);

        // Calculate score
        const score = 
          (cardsCreated || 0) * 10 +
          (cardsCompleted || 0) * 25 +
          Math.floor(totalHours) * 5 +
          (commentsCount || 0) * 2 +
          (badgesCount || 0) * 50;

        stats.push({
          user_id: member.user_id,
          full_name: profile?.full_name || profile?.email || 'Usuário',
          email: profile?.email || '',
          avatar_url: profile?.avatar_url || null,
          cards_created: cardsCreated || 0,
          cards_completed: cardsCompleted || 0,
          total_hours: Math.round(totalHours * 10) / 10,
          comments_count: commentsCount || 0,
          badges_count: badgesCount || 0,
          score,
        });
      }

      // Sort by score
      return stats.sort((a, b) => b.score - a.score);
    },
    enabled: !!currentWorkspace?.id,
  });

  const { data: workspaceStats } = useQuery({
    queryKey: ['workspace-stats', currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace?.id) return null;

      const { count: totalCards } = await supabase
        .from('cards')
        .select('*', { count: 'exact', head: true })
        .eq('workspace_id', currentWorkspace.id)
        .neq('status', 'archived');

      const { count: completedCards } = await supabase
        .from('cards')
        .select('*', { count: 'exact', head: true })
        .eq('workspace_id', currentWorkspace.id)
        .eq('status', 'delivered');

      const { data: timeEntries } = await supabase
        .from('time_entries')
        .select('duration_seconds')
        .eq('workspace_id', currentWorkspace.id);

      const totalHours = (timeEntries || []).reduce(
        (acc, te) => acc + (te.duration_seconds || 0),
        0
      ) / 3600;

      const { count: totalBadges } = await supabase
        .from('user_badges')
        .select('*', { count: 'exact', head: true })
        .eq('workspace_id', currentWorkspace.id);

      return {
        totalCards: totalCards || 0,
        completedCards: completedCards || 0,
        totalHours: Math.round(totalHours),
        totalBadges: totalBadges || 0,
        completionRate: totalCards ? Math.round((completedCards || 0) / totalCards * 100) : 0,
      };
    },
    enabled: !!currentWorkspace?.id,
  });

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getRankIcon = (index: number) => {
    if (index === 0) return <Trophy className="h-5 w-5 text-yellow-500" />;
    if (index === 1) return <Trophy className="h-5 w-5 text-gray-400" />;
    if (index === 2) return <Trophy className="h-5 w-5 text-amber-600" />;
    return <span className="w-5 text-center text-muted-foreground font-medium">{index + 1}</span>;
  };

  const getRankStyle = (index: number) => {
    if (index === 0) return 'bg-gradient-to-r from-yellow-500/10 to-amber-500/10 border-yellow-500/30';
    if (index === 1) return 'bg-gradient-to-r from-gray-400/10 to-slate-400/10 border-gray-400/30';
    if (index === 2) return 'bg-gradient-to-r from-amber-600/10 to-orange-600/10 border-amber-600/30';
    return '';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Workspace Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Target className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{workspaceStats?.totalCards || 0}</p>
                <p className="text-xs text-muted-foreground">Cards totais</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{workspaceStats?.completionRate || 0}%</p>
                <p className="text-xs text-muted-foreground">Taxa de conclusão</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-500/10">
                <Clock className="h-5 w-5 text-orange-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{workspaceStats?.totalHours || 0}h</p>
                <p className="text-xs text-muted-foreground">Horas registradas</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/10">
                <Award className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{workspaceStats?.totalBadges || 0}</p>
                <p className="text-xs text-muted-foreground">Badges conquistados</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Leaderboard */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Flame className="h-5 w-5 text-orange-500" />
            Ranking do Workspace
          </CardTitle>
          <CardDescription>
            Usuários mais ativos baseado em cards, tempo e contribuições
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="overall" className="space-y-4">
            <TabsList>
              <TabsTrigger value="overall">Geral</TabsTrigger>
              <TabsTrigger value="cards">Cards</TabsTrigger>
              <TabsTrigger value="time">Tempo</TabsTrigger>
              <TabsTrigger value="badges">Badges</TabsTrigger>
            </TabsList>

            <TabsContent value="overall" className="space-y-3">
              {leaderboard.map((user, index) => (
                <div
                  key={user.user_id}
                  className={cn(
                    "flex items-center gap-4 p-3 rounded-lg border transition-colors hover:bg-muted/50",
                    getRankStyle(index)
                  )}
                >
                  <div className="flex items-center justify-center w-8">
                    {getRankIcon(index)}
                  </div>
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={user.avatar_url || undefined} />
                    <AvatarFallback>{getInitials(user.full_name)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{user.full_name}</p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Target className="h-3 w-3" /> {user.cards_created} cards
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" /> {user.total_hours}h
                      </span>
                      <span className="flex items-center gap-1">
                        <Award className="h-3 w-3" /> {user.badges_count} badges
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-lg">{user.score}</p>
                    <p className="text-xs text-muted-foreground">pontos</p>
                  </div>
                </div>
              ))}
              {leaderboard.length === 0 && (
                <p className="text-center text-muted-foreground py-8">
                  Nenhum usuário encontrado
                </p>
              )}
            </TabsContent>

            <TabsContent value="cards" className="space-y-3">
              {[...leaderboard]
                .sort((a, b) => b.cards_created - a.cards_created)
                .map((user, index) => (
                  <div
                    key={user.user_id}
                    className={cn(
                      "flex items-center gap-4 p-3 rounded-lg border",
                      index < 3 && getRankStyle(index)
                    )}
                  >
                    <div className="flex items-center justify-center w-8">
                      {getRankIcon(index)}
                    </div>
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={user.avatar_url || undefined} />
                      <AvatarFallback>{getInitials(user.full_name)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <p className="font-medium">{user.full_name}</p>
                      <Progress 
                        value={(user.cards_created / Math.max(...leaderboard.map(u => u.cards_created), 1)) * 100} 
                        className="h-2 mt-1" 
                      />
                    </div>
                    <Badge variant="secondary" className="text-lg px-3 py-1">
                      {user.cards_created}
                    </Badge>
                  </div>
                ))}
            </TabsContent>

            <TabsContent value="time" className="space-y-3">
              {[...leaderboard]
                .sort((a, b) => b.total_hours - a.total_hours)
                .map((user, index) => (
                  <div
                    key={user.user_id}
                    className={cn(
                      "flex items-center gap-4 p-3 rounded-lg border",
                      index < 3 && getRankStyle(index)
                    )}
                  >
                    <div className="flex items-center justify-center w-8">
                      {getRankIcon(index)}
                    </div>
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={user.avatar_url || undefined} />
                      <AvatarFallback>{getInitials(user.full_name)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <p className="font-medium">{user.full_name}</p>
                      <Progress 
                        value={(user.total_hours / Math.max(...leaderboard.map(u => u.total_hours), 1)) * 100} 
                        className="h-2 mt-1" 
                      />
                    </div>
                    <Badge variant="secondary" className="text-lg px-3 py-1">
                      {user.total_hours}h
                    </Badge>
                  </div>
                ))}
            </TabsContent>

            <TabsContent value="badges" className="space-y-3">
              {[...leaderboard]
                .sort((a, b) => b.badges_count - a.badges_count)
                .map((user, index) => (
                  <div
                    key={user.user_id}
                    className={cn(
                      "flex items-center gap-4 p-3 rounded-lg border",
                      index < 3 && getRankStyle(index)
                    )}
                  >
                    <div className="flex items-center justify-center w-8">
                      {getRankIcon(index)}
                    </div>
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={user.avatar_url || undefined} />
                      <AvatarFallback>{getInitials(user.full_name)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <p className="font-medium">{user.full_name}</p>
                      <Progress 
                        value={(user.badges_count / Math.max(...leaderboard.map(u => u.badges_count), 1)) * 100} 
                        className="h-2 mt-1" 
                      />
                    </div>
                    <Badge variant="secondary" className="text-lg px-3 py-1">
                      {user.badges_count} 🏆
                    </Badge>
                  </div>
                ))}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
