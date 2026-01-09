import React from 'react';
import { useAltControlLevels } from '@/hooks/useAltControl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

export const LevelsSettings: React.FC = () => {
  const { data: levels, isLoading } = useAltControlLevels();

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Níveis de Precificação</CardTitle>
        <Button size="sm"><Plus className="h-4 w-4 mr-2" /> Novo Nível</Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p>Carregando...</p>
        ) : levels && levels.length > 0 ? (
          <div className="space-y-2">
            {levels.map(level => (
              <div key={level.id} className="p-4 border rounded-lg flex justify-between items-center">
                <div>
                  <p className="font-medium">{level.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {level.min_hours}h - {level.max_hours}h • Meta: {level.target_margin_percent}%
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground text-center py-8">Nenhum nível configurado</p>
        )}
      </CardContent>
    </Card>
  );
};
