import React from 'react';
import { Helmet } from 'react-helmet';
import { AppLayout } from '@/components/layout/AppLayout';
import { LeaderboardDashboard } from '@/components/gamification/LeaderboardDashboard';
import { BadgeProgress } from '@/components/onboarding/BadgeProgress';
import { WeeklyGoalsCard } from '@/components/gamification/WeeklyGoalsCard';
import { RankingChart } from '@/components/gamification/RankingChart';
import { Trophy } from 'lucide-react';

export default function GamificationPage() {
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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <WeeklyGoalsCard />
          <BadgeProgress />
        </div>

        <RankingChart />
        
        <LeaderboardDashboard />
      </div>
    </AppLayout>
  );
}
