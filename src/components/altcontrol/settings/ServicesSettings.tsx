import React from 'react';
import { useAltControlServices } from '@/hooks/useAltControl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus } from 'lucide-react';

export const ServicesSettings: React.FC = () => {
  const { data: services, isLoading } = useAltControlServices();

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Catálogo de Serviços</CardTitle>
        <Button size="sm"><Plus className="h-4 w-4 mr-2" /> Novo Serviço</Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p>Carregando...</p>
        ) : services && services.length > 0 ? (
          <div className="space-y-2">
            {services.map(service => (
              <div key={service.id} className="p-4 border rounded-lg flex justify-between items-center">
                <div>
                  <p className="font-medium">{service.name}</p>
                  <p className="text-sm text-muted-foreground">{service.description}</p>
                </div>
                <Badge variant={service.is_active ? 'default' : 'secondary'}>
                  {service.is_active ? 'Ativo' : 'Inativo'}
                </Badge>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground text-center py-8">Nenhum serviço configurado</p>
        )}
      </CardContent>
    </Card>
  );
};
