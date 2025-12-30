import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Bell, BellOff, AlertTriangle, Smartphone } from 'lucide-react';
import { usePushNotifications } from '@/hooks/usePushNotifications';

export function PushNotificationSettings() {
  const {
    isSupported,
    isEnabled,
    permission,
    subscribe,
    unsubscribe,
  } = usePushNotifications();

  const handleToggle = async () => {
    if (isEnabled) {
      await unsubscribe.mutateAsync();
    } else {
      await subscribe.mutateAsync();
    }
  };

  if (!isSupported) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BellOff className="h-5 w-5" />
            Notificações Push
          </CardTitle>
          <CardDescription>
            Receba alertas críticos diretamente no seu dispositivo
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            <div>
              <p className="font-medium text-yellow-600">Não suportado</p>
              <p className="text-sm text-muted-foreground">
                Seu navegador não suporta notificações push
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Notificações Push
        </CardTitle>
        <CardDescription>
          Receba alertas críticos diretamente no seu dispositivo
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between p-4 rounded-lg border">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Smartphone className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-medium">Notificações neste dispositivo</p>
              <p className="text-sm text-muted-foreground">
                {isEnabled ? 'Ativadas' : 'Desativadas'}
              </p>
            </div>
          </div>
          <Switch
            checked={isEnabled}
            onCheckedChange={handleToggle}
            disabled={subscribe.isPending || unsubscribe.isPending}
          />
        </div>

        {permission === 'denied' && (
          <div className="flex items-center gap-3 p-4 rounded-lg bg-red-500/10 border border-red-500/30">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            <div>
              <p className="font-medium text-red-600">Permissão negada</p>
              <p className="text-sm text-muted-foreground">
                Você bloqueou as notificações. Altere nas configurações do navegador.
              </p>
            </div>
          </div>
        )}

        <div className="space-y-2">
          <p className="text-sm font-medium">Você será notificado sobre:</p>
          <div className="space-y-2 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">🔴 Crítico</Badge>
              <span>Cards muito atrasados (mais de 3 dias)</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">🔴 Crítico</Badge>
              <span>Webhooks falhando repetidamente</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">🏆 Conquista</Badge>
              <span>Novos badges conquistados</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">🎯 Meta</Badge>
              <span>Metas semanais concluídas</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
