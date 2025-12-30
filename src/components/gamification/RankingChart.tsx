import React, { useState } from 'react';
import { useRankingHistory } from '@/hooks/useRankingHistory';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, AreaChart, Area } from 'recharts';
import { TrendingUp, TrendingDown, Minus, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface RankingChartProps {
  userId?: string;
  userName?: string;
}

export function RankingChart({ userId, userName }: RankingChartProps) {
  const { history, isLoading } = useRankingHistory(userId);
  const [metric, setMetric] = useState<'score' | 'rank' | 'cards_created' | 'hours_logged'>('score');

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse h-64 bg-muted rounded" />
        </CardContent>
      </Card>
    );
  }

  if (history.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Evolução do Ranking
          </CardTitle>
          <CardDescription>
            {userName ? `Histórico de ${userName}` : 'Seu histórico de performance'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
            <Calendar className="h-12 w-12 mb-2 opacity-50" />
            <p>Nenhum dado de ranking disponível ainda</p>
            <p className="text-sm">O histórico será gerado automaticamente</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const chartData = history.map(h => ({
    date: format(new Date(h.recorded_at), 'dd/MM', { locale: ptBR }),
    score: h.score,
    rank: h.rank,
    cards_created: h.cards_created,
    hours_logged: Number(h.hours_logged),
    badges_count: h.badges_count,
  }));

  const metricLabels: Record<string, string> = {
    score: 'Pontuação',
    rank: 'Posição no Ranking',
    cards_created: 'Cards Criados',
    hours_logged: 'Horas Registradas',
  };

  const metricColors: Record<string, string> = {
    score: '#8b5cf6',
    rank: '#f59e0b',
    cards_created: '#10b981',
    hours_logged: '#3b82f6',
  };

  // Calculate trend
  const firstValue = chartData[0]?.[metric] || 0;
  const lastValue = chartData[chartData.length - 1]?.[metric] || 0;
  const trend = lastValue - firstValue;
  const trendPercentage = firstValue > 0 ? Math.round((trend / firstValue) * 100) : 0;

  // For rank, lower is better, so invert the trend display
  const isPositiveTrend = metric === 'rank' ? trend < 0 : trend > 0;
  const displayTrend = metric === 'rank' ? -trend : trend;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Evolução do Ranking
            </CardTitle>
            <CardDescription>
              {userName ? `Histórico de ${userName}` : 'Seu histórico de performance'} - últimos 30 dias
            </CardDescription>
          </div>
          <Select value={metric} onValueChange={(v) => setMetric(v as typeof metric)}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="score">Pontuação</SelectItem>
              <SelectItem value="rank">Posição no Ranking</SelectItem>
              <SelectItem value="cards_created">Cards Criados</SelectItem>
              <SelectItem value="hours_logged">Horas Registradas</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {/* Trend indicator */}
        <div className="flex items-center gap-4 mb-4 p-3 rounded-lg bg-muted/50">
          <div className="flex items-center gap-2">
            {isPositiveTrend ? (
              <TrendingUp className="h-5 w-5 text-green-500" />
            ) : trend === 0 ? (
              <Minus className="h-5 w-5 text-muted-foreground" />
            ) : (
              <TrendingDown className="h-5 w-5 text-red-500" />
            )}
            <span className={
              isPositiveTrend ? 'text-green-500 font-semibold' :
              trend === 0 ? 'text-muted-foreground' :
              'text-red-500 font-semibold'
            }>
              {displayTrend > 0 ? '+' : ''}{displayTrend.toFixed(metric === 'hours_logged' ? 1 : 0)}
              {' '}({trendPercentage > 0 ? '+' : ''}{trendPercentage}%)
            </span>
          </div>
          <span className="text-sm text-muted-foreground">
            nos últimos 30 dias
          </span>
        </div>

        {/* Chart */}
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id={`gradient-${metric}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={metricColors[metric]} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={metricColors[metric]} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis 
                dataKey="date" 
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
              />
              <YAxis 
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                reversed={metric === 'rank'}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                }}
                labelStyle={{ color: 'hsl(var(--foreground))' }}
              />
              <Area
                type="monotone"
                dataKey={metric}
                stroke={metricColors[metric]}
                strokeWidth={2}
                fill={`url(#gradient-${metric})`}
                name={metricLabels[metric]}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
