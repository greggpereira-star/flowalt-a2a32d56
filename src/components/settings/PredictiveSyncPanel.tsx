import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from 'recharts';
import {
  Brain,
  TrendingUp,
  Clock,
  Zap,
  RefreshCw,
  Settings2,
  Activity,
  Target,
  Sparkles,
} from 'lucide-react';

interface UsagePattern {
  hour: number;
  usage: number;
  syncs: number;
}

interface PredictiveSchedule {
  connector: string;
  nextSync: Date;
  frequency: string;
  confidence: number;
  reason: string;
}

export function PredictiveSyncPanel() {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [enabledPredictive, setEnabledPredictive] = useState(true);
  const [sensitivityLevel, setSensitivityLevel] = useState([50]);
  const [usagePatterns, setUsagePatterns] = useState<UsagePattern[]>([]);
  const [schedules, setSchedules] = useState<PredictiveSchedule[]>([]);

  useEffect(() => {
    // Generate mock usage patterns
    const patterns = Array.from({ length: 24 }, (_, hour) => {
      // Simulate business hours having more activity
      const baseUsage = hour >= 8 && hour <= 18 ? 60 + Math.random() * 40 : 10 + Math.random() * 20;
      const baseSyncs = hour >= 8 && hour <= 18 ? 5 + Math.floor(Math.random() * 10) : 1 + Math.floor(Math.random() * 3);
      return {
        hour,
        usage: Math.round(baseUsage),
        syncs: baseSyncs,
      };
    });
    setUsagePatterns(patterns);

    // Generate predictive schedules
    setSchedules([
      {
        connector: 'Google Calendar',
        nextSync: new Date(Date.now() + 15 * 60 * 1000),
        frequency: 'A cada 15 min (pico) / 1h (fora pico)',
        confidence: 92,
        reason: 'Reuniões frequentes detectadas às 10h e 14h',
      },
      {
        connector: 'Google Drive',
        nextSync: new Date(Date.now() + 45 * 60 * 1000),
        frequency: 'A cada 45 min + real-time em mudanças',
        confidence: 87,
        reason: 'Alta atividade de anexos em cards às terças e quintas',
      },
      {
        connector: 'Open Finance',
        nextSync: new Date(new Date().setHours(8, 0, 0, 0) + 24 * 60 * 60 * 1000),
        frequency: 'Diário às 8h',
        confidence: 95,
        reason: 'Transações são conferidas no início do expediente',
      },
    ]);
  }, []);

  const runAnalysis = async () => {
    setIsAnalyzing(true);
    await new Promise(resolve => setTimeout(resolve, 2000));
    setIsAnalyzing(false);
  };

  const formatHour = (hour: number) => `${hour.toString().padStart(2, '0')}:00`;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-purple-500" />
              Sincronização Preditiva
            </CardTitle>
            <CardDescription>
              ML analisa seus padrões de uso e otimiza automaticamente os horários de sync
            </CardDescription>
          </div>
          <Button onClick={runAnalysis} disabled={isAnalyzing}>
            {isAnalyzing ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Analisando...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Reanalisar
              </>
            )}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Master Toggle */}
        <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg border">
          <div className="flex items-center gap-3">
            <Zap className="h-5 w-5 text-yellow-500" />
            <div>
              <p className="font-medium">Modo Preditivo Ativo</p>
              <p className="text-sm text-muted-foreground">
                O sistema ajusta automaticamente a frequência de sincronização
              </p>
            </div>
          </div>
          <Switch
            checked={enabledPredictive}
            onCheckedChange={setEnabledPredictive}
          />
        </div>

        {/* Usage Pattern Chart */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-medium flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Padrão de Uso (Últimos 7 dias)
            </h4>
            <Badge variant="outline">Atualizado há 2h</Badge>
          </div>
          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={usagePatterns}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis 
                  dataKey="hour" 
                  tickFormatter={formatHour}
                  className="text-xs"
                />
                <YAxis className="text-xs" />
                <Tooltip 
                  labelFormatter={(value) => formatHour(value as number)}
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                />
                <Area 
                  type="monotone" 
                  dataKey="usage" 
                  stroke="hsl(var(--primary))" 
                  fill="hsl(var(--primary))"
                  fillOpacity={0.2}
                  name="Uso (%)"
                />
                <Area 
                  type="monotone" 
                  dataKey="syncs" 
                  stroke="hsl(var(--chart-2))" 
                  fill="hsl(var(--chart-2))"
                  fillOpacity={0.2}
                  name="Syncs"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Sensitivity Control */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-medium flex items-center gap-2">
              <Target className="h-4 w-4" />
              Sensibilidade do Algoritmo
            </h4>
            <span className="text-sm text-muted-foreground">{sensitivityLevel[0]}%</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs text-muted-foreground w-16">Conservador</span>
            <Slider
              value={sensitivityLevel}
              onValueChange={setSensitivityLevel}
              max={100}
              step={5}
              className="flex-1"
            />
            <span className="text-xs text-muted-foreground w-16 text-right">Agressivo</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Maior sensibilidade = mais syncs durante picos de uso, menor = syncs mais espaçados
          </p>
        </div>

        {/* Predictive Schedules */}
        <div className="space-y-3">
          <h4 className="font-medium flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Próximas Sincronizações Programadas
          </h4>
          <div className="space-y-2">
            {schedules.map((schedule, idx) => (
              <div 
                key={idx} 
                className="p-3 border rounded-lg bg-background hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">{schedule.connector}</span>
                  <div className="flex items-center gap-2">
                    <Badge 
                      variant={schedule.confidence >= 90 ? 'default' : 'secondary'}
                      className="text-xs"
                    >
                      {schedule.confidence}% confiança
                    </Badge>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Próximo sync:</span>
                    <p className="font-mono text-xs mt-1">
                      {schedule.nextSync.toLocaleTimeString('pt-BR', { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Frequência:</span>
                    <p className="text-xs mt-1">{schedule.frequency}</p>
                  </div>
                </div>
                <div className="mt-2 pt-2 border-t">
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <TrendingUp className="h-3 w-3" />
                    {schedule.reason}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Optimization Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="p-4 bg-green-500/10 rounded-lg border border-green-500/20">
            <div className="text-2xl font-bold text-green-600">42%</div>
            <div className="text-xs text-muted-foreground">Menos chamadas de API</div>
          </div>
          <div className="p-4 bg-blue-500/10 rounded-lg border border-blue-500/20">
            <div className="text-2xl font-bold text-blue-600">98.7%</div>
            <div className="text-xs text-muted-foreground">Dados atualizados</div>
          </div>
          <div className="p-4 bg-purple-500/10 rounded-lg border border-purple-500/20">
            <div className="text-2xl font-bold text-purple-600">~3min</div>
            <div className="text-xs text-muted-foreground">Latência média</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
