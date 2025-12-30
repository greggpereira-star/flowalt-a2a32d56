import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import { Badge } from '@/components/ui/badge';
import {
  Key,
  Webhook,
  Activity,
  RefreshCw,
  Plus,
  Settings,
  TestTube,
  Eye,
  RotateCcw,
  Heart,
  Zap,
  FileText,
  Search,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface IntegrationCommand {
  id: string;
  label: string;
  description: string;
  icon: React.ElementType;
  shortcut?: string;
  action: () => void;
  group: 'api' | 'webhooks' | 'monitoring' | 'navigation';
}

interface IntegrationsCommandPaletteProps {
  onCreateApiKey?: () => void;
  onRotateApiKey?: () => void;
  onTestWebhook?: () => void;
  onViewLogs?: () => void;
}

export function IntegrationsCommandPalette({
  onCreateApiKey,
  onRotateApiKey,
  onTestWebhook,
  onViewLogs,
}: IntegrationsCommandPaletteProps) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  // Listen for custom event to open the palette
  useEffect(() => {
    const handleOpenPalette = () => setOpen(true);
    window.addEventListener('open-integrations-palette', handleOpenPalette);
    return () => window.removeEventListener('open-integrations-palette', handleOpenPalette);
  }, []);

  // Keyboard shortcut: Ctrl/Cmd + I
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'i' && (e.metaKey || e.ctrlKey) && e.shiftKey) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  const handleSelect = useCallback((action: () => void) => {
    setOpen(false);
    action();
  }, []);

  const commands: IntegrationCommand[] = [
    // API Commands
    {
      id: 'create-api-key',
      label: 'Criar nova API Key',
      description: 'Gerar uma nova chave de API para integrações',
      icon: Plus,
      shortcut: 'A',
      action: () => {
        if (onCreateApiKey) {
          onCreateApiKey();
        } else {
          navigate('/settings?tab=api-keys');
          toast({ title: 'Navegando...', description: 'Acesse a aba API Keys para criar uma nova chave' });
        }
      },
      group: 'api',
    },
    {
      id: 'rotate-api-key',
      label: 'Girar API Key',
      description: 'Regenerar uma chave de API existente',
      icon: RefreshCw,
      action: () => {
        if (onRotateApiKey) {
          onRotateApiKey();
        } else {
          navigate('/settings?tab=api-keys');
          toast({ title: 'Navegando...', description: 'Acesse a aba API Keys para girar uma chave' });
        }
      },
      group: 'api',
    },
    {
      id: 'view-api-docs',
      label: 'Ver documentação da API',
      description: 'Abrir documentação com exemplos de uso',
      icon: FileText,
      shortcut: 'D',
      action: () => navigate('/settings?tab=docs'),
      group: 'api',
    },

    // Webhook Commands
    {
      id: 'create-webhook',
      label: 'Criar novo Webhook',
      description: 'Configurar um novo endpoint de webhook',
      icon: Webhook,
      shortcut: 'W',
      action: () => navigate('/settings?tab=webhooks'),
      group: 'webhooks',
    },
    {
      id: 'test-webhook',
      label: 'Testar Webhook',
      description: 'Enviar um payload de teste para um webhook',
      icon: TestTube,
      action: () => {
        if (onTestWebhook) {
          onTestWebhook();
        } else {
          navigate('/settings?tab=webhooks');
          toast({ title: 'Navegando...', description: 'Acesse a aba Webhooks para testar' });
        }
      },
      group: 'webhooks',
    },
    {
      id: 'replay-webhooks',
      label: 'Replay de Webhooks',
      description: 'Reenviar webhooks que falharam (DLQ)',
      icon: RotateCcw,
      action: () => navigate('/settings?tab=dlq'),
      group: 'webhooks',
    },
    {
      id: 'webhook-health',
      label: 'Ver saúde dos Webhooks',
      description: 'Verificar status e métricas de entrega',
      icon: Heart,
      action: () => navigate('/settings?tab=webhook-health'),
      group: 'webhooks',
    },

    // Monitoring Commands
    {
      id: 'view-api-logs',
      label: 'Ver logs da API',
      description: 'Visualizar requisições recentes',
      icon: Activity,
      shortcut: 'L',
      action: () => {
        if (onViewLogs) {
          onViewLogs();
        } else {
          navigate('/settings?tab=api-logs');
        }
      },
      group: 'monitoring',
    },
    {
      id: 'event-explorer',
      label: 'Explorar eventos',
      description: 'Pesquisar e analisar eventos históricos',
      icon: Search,
      action: () => navigate('/settings?tab=events'),
      group: 'monitoring',
    },
    {
      id: 'webhook-dashboard',
      label: 'Dashboard de Webhooks',
      description: 'Ver métricas e estatísticas de entrega',
      icon: Activity,
      action: () => navigate('/settings?tab=monitoring'),
      group: 'monitoring',
    },

    // Navigation Commands
    {
      id: 'marketplace',
      label: 'Marketplace de Integrações',
      description: 'Descobrir e conectar novas integrações',
      icon: Zap,
      shortcut: 'M',
      action: () => navigate('/settings?tab=marketplace'),
      group: 'navigation',
    },
    {
      id: 'settings',
      label: 'Configurações gerais',
      description: 'Acessar todas as configurações',
      icon: Settings,
      action: () => navigate('/settings'),
      group: 'navigation',
    },
  ];

  const groupLabels = {
    api: 'API',
    webhooks: 'Webhooks',
    monitoring: 'Monitoramento',
    navigation: 'Navegação',
  };

  const groupedCommands = {
    api: commands.filter(c => c.group === 'api'),
    webhooks: commands.filter(c => c.group === 'webhooks'),
    monitoring: commands.filter(c => c.group === 'monitoring'),
    navigation: commands.filter(c => c.group === 'navigation'),
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Buscar ações de integração..." />
      <CommandList>
        <CommandEmpty>Nenhuma ação encontrada.</CommandEmpty>
        
        {Object.entries(groupedCommands).map(([group, items], index) => (
          <React.Fragment key={group}>
            {index > 0 && <CommandSeparator />}
            <CommandGroup heading={groupLabels[group as keyof typeof groupLabels]}>
              {items.map((command) => (
                <CommandItem
                  key={command.id}
                  onSelect={() => handleSelect(command.action)}
                  className="flex items-center gap-3"
                >
                  <command.icon className="h-4 w-4 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span>{command.label}</span>
                      {command.shortcut && (
                        <Badge variant="secondary" className="text-[10px] h-5 px-1.5">
                          {command.shortcut}
                        </Badge>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {command.description}
                    </span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </React.Fragment>
        ))}
      </CommandList>

      <div className="border-t p-2 text-xs text-muted-foreground text-center">
        <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px]">⌘</kbd>
        <span className="mx-1">+</span>
        <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px]">⇧</kbd>
        <span className="mx-1">+</span>
        <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px]">I</kbd>
        <span className="ml-2">para abrir</span>
      </div>
    </CommandDialog>
  );
}

// Hook to trigger the palette from anywhere
export function useIntegrationsCommandPalette() {
  const open = useCallback(() => {
    window.dispatchEvent(new CustomEvent('open-integrations-palette'));
  }, []);

  return { open };
}
