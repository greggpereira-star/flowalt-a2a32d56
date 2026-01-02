import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Bell, Lock, Mail } from 'lucide-react';
import { 
  useNotificationPreferences, 
  useUpdateNotificationPreferences,
  NOTIFICATION_CATEGORIES,
  type NotificationCategoryKey 
} from '@/hooks/useNotificationPreferences';

export function NotificationPreferencesPanel() {
  const { data: preferences, isLoading } = useNotificationPreferences();
  const updatePreferences = useUpdateNotificationPreferences();

  const handleToggle = async (category: NotificationCategoryKey, enabled: boolean) => {
    await updatePreferences.mutateAsync({ [category]: enabled });
  };

  const getValue = (key: NotificationCategoryKey): boolean => {
    if (!preferences) return true; // Default: ativado
    return preferences[key] ?? true;
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-72 mt-2" />
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-primary" />
          <CardTitle>Preferências de Notificação por Email</CardTitle>
        </div>
        <CardDescription>
          Configure quais tipos de email você deseja receber. Emails críticos de segurança não podem ser desativados.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {NOTIFICATION_CATEGORIES.map((category) => (
          <div
            key={category.key}
            className="flex items-start justify-between p-4 rounded-lg border bg-card hover:bg-accent/5 transition-colors"
          >
            <div className="flex gap-3">
              <span className="text-2xl">{category.icon}</span>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{category.label}</span>
                  {category.critical && (
                    <Badge variant="secondary" className="text-xs gap-1">
                      <Lock className="h-3 w-3" />
                      Obrigatório
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  {category.description}
                </p>
              </div>
            </div>
            <Switch
              checked={category.critical ? true : getValue(category.key)}
              onCheckedChange={(checked) => handleToggle(category.key, checked)}
              disabled={category.critical || updatePreferences.isPending}
              aria-label={`Ativar notificações de ${category.label}`}
            />
          </div>
        ))}

        <div className="mt-6 p-4 rounded-lg bg-muted/50 border border-dashed">
          <div className="flex items-start gap-3">
            <Mail className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-medium">Sobre as notificações</p>
              <p className="text-xs text-muted-foreground">
                Os emails são enviados apenas para eventos importantes relacionados ao seu trabalho. 
                Nunca enviamos spam ou comunicações de marketing por este canal.
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
