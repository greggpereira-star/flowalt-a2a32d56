import React from 'react';
import { Helmet } from 'react-helmet';
import { AppLayout } from '@/components/layout/AppLayout';
import { LeaderboardDashboard } from '@/components/gamification/LeaderboardDashboard';
import { BadgeProgress } from '@/components/onboarding/BadgeProgress';
import { WeeklyGoalsCard } from '@/components/gamification/WeeklyGoalsCard';
import { RankingChart } from '@/components/gamification/RankingChart';
import { UserLevelCard } from '@/components/gamification/UserLevelCard';
import { LevelLeaderboard } from '@/components/gamification/LevelLeaderboard';
import { WeeklyGoalsAdmin } from '@/components/gamification/WeeklyGoalsAdmin';
import { Trophy } from 'lucide-react';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function GamificationPage() {
  const { currentRole } = useWorkspace();
  const isAdmin = currentRole === 'admin' || currentRole === 'owner';

  return (
    <AppLayout>
      <Helmet>
        <title>Gamificação - Ranking & Conquistas</title>
        <meta name="description" content="Veja o ranking dos usuários mais ativos e acompanhe suas conquistas" />
      </Helmet>
      
      <div className="container mx-auto p-6 max-w-5xl space-y-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-lg bg-gradient-to-br from-yellow-500/20 to-amber-500/20">
            <Trophy className="h-6 w-6 text-yellow-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Gamificação</h1>
            <p className="text-muted-foreground">
              Ranking, conquistas e estatísticas de produtividade
            </p>
          </div>
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList>
            <TabsTrigger value="overview">Visão Geral</TabsTrigger>
            <TabsTrigger value="levels">Níveis</TabsTrigger>
            {isAdmin && <TabsTrigger value="admin">Gerenciar Metas</TabsTrigger>}
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <WeeklyGoalsCard />
              <BadgeProgress />
            </div>

            <RankingChart />
            
            <LeaderboardDashboard />
          </TabsContent>

          <TabsContent value="levels" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <UserLevelCard />
              <LevelLeaderboard />
            </div>
          </TabsContent>

          {isAdmin && (
            <TabsContent value="admin">
              <WeeklyGoalsAdmin />
            </TabsContent>
          )}
        </Tabs>
      </div>
    </AppLayout>
  );
}
