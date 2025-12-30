import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
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
import { useSpaces } from '@/hooks/useSpaces';
import { useAllCards } from '@/hooks/useCards';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import {
  LayoutDashboard,
  Calendar,
  Users,
  DollarSign,
  Settings,
  Trophy,
  TrendingUp,
  Search,
  FileText,
  Folder,
  Plus,
  Clock,
  CheckCircle2,
  BarChart3,
  Sparkles,
  Zap,
} from 'lucide-react';

interface CommandAction {
  id: string;
  label: string;
  description?: string;
  icon: React.ReactNode;
  shortcut?: string;
  action: () => void;
  group: 'navigation' | 'actions' | 'spaces' | 'cards' | 'settings';
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const navigate = useNavigate();
  const location = useLocation();
  const { currentWorkspace } = useWorkspace();
  const { data: spaces } = useSpaces();
  const { data: cards } = useAllCards();

  // Toggle command palette with keyboard shortcut
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || e.key === 'F1') {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  const handleSelect = useCallback((action: () => void) => {
    setOpen(false);
    setSearch('');
    action();
  }, []);

  // Navigation actions
  const navigationActions: CommandAction[] = useMemo(() => [
    {
      id: 'nav-home',
      label: 'Início',
      description: 'Ir para página inicial',
      icon: <LayoutDashboard className="h-4 w-4" />,
      shortcut: 'G H',
      action: () => navigate('/'),
      group: 'navigation',
    },
    {
      id: 'nav-dashboard',
      label: 'Dashboard',
      description: 'Ver visão geral do workspace',
      icon: <BarChart3 className="h-4 w-4" />,
      shortcut: 'G D',
      action: () => navigate('/dashboard'),
      group: 'navigation',
    },
    {
      id: 'nav-calendar',
      label: 'Agenda',
      description: 'Ver calendário de eventos',
      icon: <Calendar className="h-4 w-4" />,
      shortcut: 'G C',
      action: () => navigate('/calendar'),
      group: 'navigation',
    },
    {
      id: 'nav-coordination',
      label: 'Coordenação',
      description: 'Gestão de sprints e capacidade',
      icon: <Users className="h-4 w-4" />,
      action: () => navigate('/coordination'),
      group: 'navigation',
    },
    {
      id: 'nav-financial',
      label: 'Financeiro',
      description: 'Gestão financeira e transações',
      icon: <DollarSign className="h-4 w-4" />,
      action: () => navigate('/financial'),
      group: 'navigation',
    },
    {
      id: 'nav-analytics',
      label: 'Analytics',
      description: 'Métricas de produtividade',
      icon: <TrendingUp className="h-4 w-4" />,
      action: () => navigate('/analytics'),
      group: 'navigation',
    },
    {
      id: 'nav-gamification',
      label: 'Ranking & Conquistas',
      description: 'Ver gamificação e níveis',
      icon: <Trophy className="h-4 w-4" />,
      action: () => navigate('/gamification'),
      group: 'navigation',
    },
    {
      id: 'nav-settings',
      label: 'Configurações',
      description: 'API, webhooks e integrações',
      icon: <Settings className="h-4 w-4" />,
      shortcut: 'G S',
      action: () => navigate('/settings'),
      group: 'navigation',
    },
  ], [navigate]);

  // Quick actions
  const quickActions: CommandAction[] = useMemo(() => [
    {
      id: 'action-new-card',
      label: 'Criar novo card',
      description: 'Adicionar uma nova tarefa',
      icon: <Plus className="h-4 w-4 text-green-500" />,
      shortcut: 'N',
      action: () => {
        // Will be handled by the space page
        const firstSpace = spaces?.[0];
        if (firstSpace) {
          navigate(`/space/${firstSpace.id}?action=new-card`);
        }
      },
      group: 'actions',
    },
    {
      id: 'action-start-timer',
      label: 'Iniciar cronômetro',
      description: 'Começar a registrar tempo',
      icon: <Clock className="h-4 w-4 text-blue-500" />,
      shortcut: 'T',
      action: () => navigate('/dashboard?action=start-timer'),
      group: 'actions',
    },
  ], [navigate, spaces]);

  // Spaces
  const spaceActions: CommandAction[] = useMemo(() => {
    if (!spaces) return [];
    return spaces.map((space) => ({
      id: `space-${space.id}`,
      label: space.name,
      description: space.description || 'Abrir espaço',
      icon: <Folder className="h-4 w-4" style={{ color: space.color }} />,
      action: () => navigate(`/space/${space.id}`),
      group: 'spaces' as const,
    }));
  }, [spaces, navigate]);

  // Recent cards
  const cardActions: CommandAction[] = useMemo(() => {
    if (!cards) return [];
    return cards.slice(0, 10).map((card) => ({
      id: `card-${card.id}`,
      label: card.title,
      description: card.status === 'delivered' ? 'Concluído' : 'Em andamento',
      icon: card.status === 'delivered' 
        ? <CheckCircle2 className="h-4 w-4 text-green-500" /> 
        : <FileText className="h-4 w-4" />,
      action: () => {
        // Navigate to the card's space with the card selected
        navigate(`/space/${card.space_id}?card=${card.id}`);
      },
      group: 'cards' as const,
    }));
  }, [cards, navigate]);

  // Filter actions based on search
  const filteredActions = useMemo(() => {
    const allActions = [...navigationActions, ...quickActions, ...spaceActions, ...cardActions];
    
    if (!search) return allActions;
    
    const lowerSearch = search.toLowerCase();
    return allActions.filter(
      (action) =>
        action.label.toLowerCase().includes(lowerSearch) ||
        action.description?.toLowerCase().includes(lowerSearch)
    );
  }, [navigationActions, quickActions, spaceActions, cardActions, search]);

  const groupedActions = useMemo(() => {
    const groups: Record<string, CommandAction[]> = {
      navigation: [],
      actions: [],
      spaces: [],
      cards: [],
    };

    filteredActions.forEach((action) => {
      groups[action.group].push(action);
    });

    return groups;
  }, [filteredActions]);

  if (!currentWorkspace) return null;

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput 
        placeholder="Digite um comando ou pesquise..." 
        value={search}
        onValueChange={setSearch}
      />
      <CommandList>
        <CommandEmpty>
          <div className="flex flex-col items-center gap-2 py-6">
            <Search className="h-10 w-10 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">Nenhum resultado encontrado</p>
          </div>
        </CommandEmpty>

        {groupedActions.actions.length > 0 && (
          <CommandGroup heading="Ações Rápidas">
            {groupedActions.actions.map((action) => (
              <CommandItem
                key={action.id}
                onSelect={() => handleSelect(action.action)}
                className="flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  {action.icon}
                  <div>
                    <p>{action.label}</p>
                    {action.description && (
                      <p className="text-xs text-muted-foreground">{action.description}</p>
                    )}
                  </div>
                </div>
                {action.shortcut && (
                  <Badge variant="outline" className="ml-auto text-xs">
                    {action.shortcut}
                  </Badge>
                )}
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {groupedActions.navigation.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Navegação">
              {groupedActions.navigation.map((action) => (
                <CommandItem
                  key={action.id}
                  onSelect={() => handleSelect(action.action)}
                  className="flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    {action.icon}
                    <div>
                      <p>{action.label}</p>
                      {action.description && (
                        <p className="text-xs text-muted-foreground">{action.description}</p>
                      )}
                    </div>
                  </div>
                  {action.shortcut && (
                    <Badge variant="outline" className="ml-auto text-xs">
                      {action.shortcut}
                    </Badge>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {groupedActions.spaces.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Espaços">
              {groupedActions.spaces.map((action) => (
                <CommandItem
                  key={action.id}
                  onSelect={() => handleSelect(action.action)}
                >
                  <div className="flex items-center gap-3">
                    {action.icon}
                    <span>{action.label}</span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {groupedActions.cards.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Cards Recentes">
              {groupedActions.cards.slice(0, 5).map((action) => (
                <CommandItem
                  key={action.id}
                  onSelect={() => handleSelect(action.action)}
                >
                  <div className="flex items-center gap-3">
                    {action.icon}
                    <div>
                      <p className="truncate max-w-[300px]">{action.label}</p>
                      <p className="text-xs text-muted-foreground">{action.description}</p>
                    </div>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>

      <div className="border-t p-2 flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1">
            <Zap className="h-3 w-3" />
            Flowalt Command
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">↵</Badge>
          <span>selecionar</span>
          <Badge variant="outline" className="text-xs">ESC</Badge>
          <span>fechar</span>
        </div>
      </div>
    </CommandDialog>
  );
}
