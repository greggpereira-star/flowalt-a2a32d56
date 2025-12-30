import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface MemberCapacity {
  id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  weekly_hours: number;
  allocated_hours: number;
  active_cards: number;
  available_hours: number;
}

interface CapacityChartProps {
  members: MemberCapacity[];
  maxHours?: number;
}

export const CapacityChart: React.FC<CapacityChartProps> = ({
  members,
  maxHours = 40,
}) => {
  const getCapacityStatus = (allocated: number) => {
    const percentage = (allocated / maxHours) * 100;
    if (percentage >= 100) return { label: 'Sobrecarregado', color: 'text-destructive' };
    if (percentage >= 80) return { label: 'Alta Ocupação', color: 'text-orange-500' };
    if (percentage >= 50) return { label: 'Normal', color: 'text-yellow-500' };
    return { label: 'Disponível', color: 'text-green-500' };
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Capacidade da Equipe</CardTitle>
        <CardDescription>
          Horas alocadas vs disponíveis por membro ({maxHours}h/semana)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {members.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhum membro encontrado
          </p>
        ) : (
          members.map((member) => {
            const status = getCapacityStatus(member.allocated_hours);
            const allocatedPercent = Math.min((member.allocated_hours / maxHours) * 100, 100);
            const workedPercent = Math.min((member.weekly_hours / maxHours) * 100, 100);

            return (
              <div key={member.id} className="space-y-2">
                <div className="flex items-center gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={member.avatar_url || undefined} />
                    <AvatarFallback>
                      {member.name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium truncate">{member.name}</p>
                      <Badge variant="outline" className={cn('text-xs', status.color)}>
                        {status.label}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{member.active_cards} cards</span>
                      <span>•</span>
                      <span>{member.allocated_hours}h alocadas</span>
                      <span>•</span>
                      <span>{member.weekly_hours}h trabalhadas</span>
                    </div>
                  </div>
                </div>
                <div className="relative h-3 bg-muted rounded-full overflow-hidden">
                  {/* Background bar showing allocated */}
                  <div
                    className={cn(
                      'absolute inset-y-0 left-0 rounded-full transition-all',
                      allocatedPercent >= 100 ? 'bg-destructive/30' : 'bg-primary/30'
                    )}
                    style={{ width: `${allocatedPercent}%` }}
                  />
                  {/* Foreground bar showing worked hours */}
                  <div
                    className="absolute inset-y-0 left-0 bg-primary rounded-full transition-all"
                    style={{ width: `${workedPercent}%` }}
                  />
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
};
