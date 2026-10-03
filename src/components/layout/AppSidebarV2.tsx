import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useSpaces } from '@/hooks/useSpaces';
import { usePermissions } from '@/hooks/usePermissions';
import { useEntitlementRegistry } from '@/hooks/useEntitlementRegistry';
import { useMyRunningTimer } from '@/hooks/useTimeEntries';
import { useNewUiBeta } from '@/hooks/useNewUiBeta';
import { SpaceTreeNav } from '@/components/spaces/SpaceTreeNav';
import { FlowaltLogo } from '@/components/brand/FlowaltLogo';
import { cn } from '@/lib/utils';
import {
  Building2,
  Calculator,
  Calendar,
  CalendarPlus,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  Clock,
  DollarSign,
  FileText,
  LayoutDashboard,
  Lightbulb,
  LogOut,
  MoreHorizontal,
  PieChart,
  Plug,
  Plus,
  Search,
  Settings,
  Share2,
  Timer,
  TrendingUp,
  Trophy,
  UserCircle,
  Users,
  Zap,
  BarChart3,
  type LucideIcon,
} from 'lucide-react';

/**
 * Menu lateral novo (beta, só para quem está em EMAILS_BETA).
 *
 * Mantém as mesmas telas, permissões e árvore de espaços do menu atual (reaproveita
 * SpaceTreeNav); muda a organização: o que se usa todo dia no topo, espaços logo abaixo e
 * as áreas de gestão agrupadas e recolhidas. "Conversas" e "Aprovações" entram quando
 * essas telas existirem; não há itens que levem a páginas ainda inexistentes.
 */

interface Item {
  icon: LucideIcon;
  label: string;
  path: string;
}

const classeItem =
  'h-9 rounded-lg px-3 text-[13.5px] font-medium text-sidebar-foreground/80 ' +
  'data-[active=true]:bg-primary/10 data-[active=true]:text-primary data-[active=true]:font-semibold';

const classeRotulo = 'px-3 text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground/80';

function lerGrupo(chave: string, padrao: boolean) {
  try {
    const bruto = window.localStorage.getItem(`flowalt_menu_${chave}`);
    return bruto === null ? padrao : bruto === '1';
  } catch {
    return padrao;
  }
}

function useGrupoRecolhivel(chave: string, abertoPorPadrao: boolean, forcarAberto: boolean) {
  const [aberto, setAberto] = useState(() => lerGrupo(chave, abertoPorPadrao));
  const efetivo = aberto || forcarAberto;
  const alternar = (valor: boolean) => {
    setAberto(valor);
    try {
      window.localStorage.setItem(`flowalt_menu_${chave}`, valor ? '1' : '0');
    } catch {
      /* ignora: o grupo só não lembra o estado */
    }
  };
  return { aberto: efetivo, alternar };
}

function formatarTempo(segundos: number) {
  const dois = (n: number) => n.toString().padStart(2, '0');
  return `${dois(Math.floor(segundos / 3600))}:${dois(Math.floor((segundos % 3600) / 60))}:${dois(segundos % 60)}`;
}

function CronometroAtivo() {
  const { data: timer } = useMyRunningTimer();
  const [decorrido, setDecorrido] = useState(0);

  useEffect(() => {
    if (!timer) return;
    const inicio = new Date(timer.started_at).getTime();
    const tick = () => setDecorrido(Math.max(0, Math.floor((Date.now() - inicio) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [timer]);

  if (!timer) return null;
  return (
    <Link
      to="/time"
      title="Cronômetro em andamento"
      className="mb-2 flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-xs font-semibold text-primary"
    >
      <Timer className="h-3.5 w-3.5 shrink-0" />
      <span className="min-w-0 flex-1 truncate">{timer.cards?.title || 'Card'}</span>
      <span className="font-mono tabular-nums">{formatarTempo(decorrido)}</span>
    </Link>
  );
}

export const AppSidebarV2: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signOut } = useAuth();
  const { workspaces, currentWorkspace, setCurrentWorkspace } = useWorkspace();
  const { data: spaces, isLoading: spacesLoading } = useSpaces();
  const { isAdmin, isCoordinator } = usePermissions();
  const { has } = useEntitlementRegistry();
  const beta = useNewUiBeta();

  const temAcessoIntegracoes = isAdmin || isCoordinator;
  const temSocial = has('social_publish');

  const principais: Item[] = [
    { icon: LayoutDashboard, label: 'Início', path: '/' },
    { icon: BarChart3, label: 'Dashboard', path: '/dashboard' },
    { icon: CheckSquare, label: 'Meu trabalho', path: '/tasks' },
    { icon: Calendar, label: 'Agenda', path: '/calendar' },
    { icon: Building2, label: 'Clientes', path: '/clients' },
  ];

  // Mesmos itens e mesmas regras de exibição do menu atual.
  const gestao: Item[] = [
    { icon: Users, label: 'Coordenação', path: '/coordination' },
    { icon: Calculator, label: 'AltControl', path: '/altcontrol' },
    { icon: UserCircle, label: 'People Analytics', path: '/people-analytics' },
    { icon: DollarSign, label: 'Financeiro', path: '/financial' },
    { icon: PieChart, label: 'Painel dos Sócios', path: '/partners' },
    { icon: Trophy, label: 'Ranking', path: '/gamification' },
    { icon: TrendingUp, label: 'Analytics', path: '/analytics' },
  ];

  const mais: Item[] = [
    { icon: Lightbulb, label: 'Banco de Ideias', path: '/ideas' },
    { icon: Clock, label: 'Tempo', path: '/time' },
    ...(temSocial ? [{ icon: Share2, label: 'Marketing', path: '/marketing' }] : []),
    ...(temAcessoIntegracoes ? [{ icon: Plug, label: 'API & Integrações', path: '/integrations' }] : []),
  ];

  const noCaminho = (itens: Item[]) =>
    itens.some(i => location.pathname === i.path || location.pathname.startsWith(i.path + '/'));
  const grupoGestao = useGrupoRecolhivel('gestao', false, noCaminho(gestao));
  const grupoMais = useGrupoRecolhivel('mais', false, noCaminho(mais));

  const espacosVisiveis = spaces?.slice(0, 10) ?? [];
  const espacosOcultos = Math.max((spaces?.length ?? 0) - espacosVisiveis.length, 0);

  const iniciais =
    user?.user_metadata?.full_name?.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) ||
    user?.email?.[0].toUpperCase() ||
    'U';

  const sair = async () => {
    await signOut();
    navigate('/auth', { replace: true });
  };

  const abrirBusca = () => window.dispatchEvent(new Event('flowalt:abrir-busca'));

  const renderItem = (item: Item) => (
    <SidebarMenuItem key={item.path}>
      <SidebarMenuButton asChild isActive={location.pathname === item.path} className={classeItem}>
        <Link to={item.path}>
          <item.icon className="h-4 w-4" />
          <span>{item.label}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );

  const renderGrupo = (
    titulo: string,
    icone: LucideIcon,
    itens: Item[],
    estado: { aberto: boolean; alternar: (v: boolean) => void }
  ) => {
    const Icone = icone;
    return (
      <SidebarGroup className="py-1">
        <Collapsible open={estado.aberto} onOpenChange={estado.alternar}>
          <CollapsibleTrigger asChild>
            <button
              className={cn(classeItem, 'flex w-full items-center gap-2 hover:bg-sidebar-accent/60')}
              aria-label={`${estado.aberto ? 'Recolher' : 'Expandir'} ${titulo}`}
            >
              <Icone className="h-4 w-4" />
              <span className="flex-1 text-left">{titulo}</span>
              {estado.aberto ? (
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
              )}
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <SidebarMenu className="mt-1 gap-0.5 pl-3">{itens.map(renderItem)}</SidebarMenu>
          </CollapsibleContent>
        </Collapsible>
      </SidebarGroup>
    );
  };

  return (
    <Sidebar className="border-r border-sidebar-border" data-tour="sidebar">
      <SidebarHeader className="gap-3 p-4 pb-2">
        <div className="flex items-center">
          <FlowaltLogo size={30} wordmarkClassName="text-[1.05rem]" />
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="h-10 w-full justify-between px-3" data-tour="workspace-selector">
              <div className="flex min-w-0 items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10">
                  <Building2 className="h-3.5 w-3.5 text-primary" />
                </div>
                <span className="truncate text-sm font-semibold">{currentWorkspace?.name || 'Selecionar Workspace'}</span>
              </div>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            {workspaces.map(workspace => (
              <DropdownMenuItem
                key={workspace.id}
                onClick={() => setCurrentWorkspace(workspace)}
                className={cn(currentWorkspace?.id === workspace.id && 'bg-accent')}
              >
                <Building2 className="mr-2 h-4 w-4" />
                {workspace.name}
              </DropdownMenuItem>
            ))}
            {workspaces.length > 0 && <DropdownMenuSeparator />}
            <DropdownMenuItem
              onClick={e => {
                e.preventDefault();
                navigate('/workspace/new');
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              Criar Workspace
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <button
          onClick={abrirBusca}
          className="flex h-9 w-full items-center gap-2 rounded-lg bg-muted/60 px-3 text-[13px] text-muted-foreground transition-colors hover:bg-muted"
          aria-label="Abrir busca (Command K)"
        >
          <Search className="h-3.5 w-3.5" />
          <span className="flex-1 text-left">Buscar…</span>
          <kbd className="rounded border bg-background px-1.5 py-0.5 text-[10px] font-bold">⌘K</kbd>
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button className="h-9 w-full gap-1.5 font-semibold" aria-label="Criar novo">
              <Plus className="h-4 w-4" /> Novo
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-60">
            <DropdownMenuLabel className="text-xs text-muted-foreground">Criar</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => navigate('/tasks?new=quick')}>
              <Zap className="mr-2 h-4 w-4" />
              <div>
                <p className="text-sm">Card rápido</p>
                <p className="text-xs text-muted-foreground">Sem briefing nem checklist</p>
              </div>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate('/tasks?new=briefed')}>
              <FileText className="mr-2 h-4 w-4" />
              <div>
                <p className="text-sm">Demanda com briefing</p>
                <p className="text-xs text-muted-foreground">Com validações e etapas</p>
              </div>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate('/calendar?new=1')}>
              <CalendarPlus className="mr-2 h-4 w-4" />
              <div>
                <p className="text-sm">Agendar evento</p>
                <p className="text-xs text-muted-foreground">Reunião, gravação ou prazo</p>
              </div>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarHeader>

      <SidebarContent className="gap-1 px-2">
        <SidebarGroup className="py-1">
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">{principais.map(renderItem)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="py-1" data-tour="spaces-menu">
          <SidebarGroupLabel className={classeRotulo}>Espaços</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              {spacesLoading ? (
                <>
                  <Skeleton className="mb-1 h-9 w-full" />
                  <Skeleton className="mb-1 h-9 w-full" />
                  <Skeleton className="h-9 w-full" />
                </>
              ) : espacosVisiveis.length > 0 ? (
                <>
                  {espacosVisiveis.map(space => (
                    <SidebarMenuItem key={space.id}>
                      <SpaceTreeNav
                        spaceId={space.id}
                        spaceName={space.name}
                        spaceColor={space.color}
                        spaceIcon={space.icon}
                        spaceType={space.type}
                      />
                    </SidebarMenuItem>
                  ))}
                  {espacosOcultos > 0 && (
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild className={classeItem}>
                        <Link to="/settings?tab=spaces">
                          <Plus className="h-4 w-4" />
                          <span>Ver mais {espacosOcultos}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )}
                </>
              ) : (
                <p className="px-3 py-1 text-xs text-muted-foreground">Nenhum espaço</p>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <div data-tour="management-menu">{renderGrupo('Gestão', BarChart3, gestao, grupoGestao)}</div>
        {renderGrupo('Mais', MoreHorizontal, mais, grupoMais)}
      </SidebarContent>

      <SidebarFooter className="p-3" data-tour="user-menu">
        <CronometroAtivo />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-auto w-full justify-start gap-2 px-2 py-2">
              <Avatar className="h-8 w-8 flex-shrink-0">
                <AvatarImage src={user?.user_metadata?.avatar_url} />
                <AvatarFallback className="bg-primary text-xs text-primary-foreground">{iniciais}</AvatarFallback>
              </Avatar>
              <div className="flex min-w-0 flex-1 flex-col items-start text-left">
                <span className="max-w-[130px] truncate text-sm font-semibold">
                  {user?.user_metadata?.full_name?.split(' ')[0] || 'Usuário'}
                </span>
                <span className="max-w-[130px] truncate text-xs text-muted-foreground">{user?.email}</span>
              </div>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuItem asChild>
              <Link to="/settings" className="flex items-center">
                <Settings className="mr-2 h-4 w-4" />
                Configurações
              </Link>
            </DropdownMenuItem>
            {beta.podeUsar && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-xs text-muted-foreground">Visual em teste (só para você)</DropdownMenuLabel>
                <DropdownMenuCheckboxItem checked={beta.menu} onCheckedChange={v => beta.definir({ menu: !!v })}>
                  Menu novo
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem checked={beta.respiro} onCheckedChange={v => beta.definir({ respiro: !!v })}>
                  Mais respiro no Kanban
                </DropdownMenuCheckboxItem>
              </>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={sair} className="text-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>
    </Sidebar>
  );
};
