import React from 'react';
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
  SidebarSeparator,
} from '@/components/ui/sidebar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useSpaces } from '@/hooks/useSpaces';
import { usePermissions } from '@/hooks/usePermissions';
import { useEntitlementRegistry } from '@/hooks/useEntitlementRegistry';
import { SpaceTreeNav } from '@/components/spaces/SpaceTreeNav';
import {
  LayoutDashboard,
  Clock,
  Calendar,
  Users,
  BarChart3,
  Settings,
  LogOut,
  ChevronDown,
  Plus,
  Sparkles,
  Building2,
  Share2,
  DollarSign,
  PieChart,
  Trophy,
  TrendingUp,
  UserCircle,
  Plug,
  Calculator,
} from 'lucide-react';
import { Lightbulb } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FlowaltLogo } from '@/components/brand/FlowaltLogo';

const mainNavItems = [
  { icon: LayoutDashboard, label: 'Início', path: '/' },
  { icon: BarChart3, label: 'Dashboard', path: '/dashboard' },
  { icon: Building2, label: 'Clientes', path: '/clients' },
  { icon: Lightbulb, label: 'Banco de Ideias', path: '/ideas' },
  { icon: Clock, label: 'Tempo', path: '/time' },
  { icon: Calendar, label: 'Agenda', path: '/calendar' },
];

// Management items - will be filtered based on permissions
const getManagementItems = (hasIntegrationAccess: boolean, hasSocialPublish: boolean) => {
  const items = [
    { icon: Users, label: 'Coordenação', path: '/coordination' },
    { icon: Calculator, label: 'AltControl', path: '/altcontrol' },
    { icon: UserCircle, label: 'People Analytics', path: '/people-analytics' },
    { icon: DollarSign, label: 'Financeiro', path: '/financial' },
    { icon: PieChart, label: 'Painel dos Sócios', path: '/partners' },
    { icon: Trophy, label: 'Ranking', path: '/gamification' },
    { icon: TrendingUp, label: 'Analytics', path: '/analytics' },
  ];

  // Show marketing if user has social_publish entitlement
  if (hasSocialPublish) {
    items.splice(2, 0, { icon: Share2, label: 'Marketing', path: '/marketing' });
  }
  
  // Only show integrations link if user has access
  if (hasIntegrationAccess) {
    items.push({ icon: Plug, label: 'API & Integrações', path: '/integrations' });
  }
  
  return items;
};

export const AppSidebar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signOut } = useAuth();
  const { workspaces, currentWorkspace, setCurrentWorkspace } = useWorkspace();
  const { data: spaces, isLoading: spacesLoading } = useSpaces();
  const { isAdmin, isCoordinator } = usePermissions();
  const { has } = useEntitlementRegistry();
  
  // Permission check: Owner, Admin, or Coordinator can access integrations
  const hasIntegrationAccess = isAdmin || isCoordinator;
  const hasSocialPublish = has('social_publish');
  const managementItems = getManagementItems(hasIntegrationAccess, hasSocialPublish);
  const visibleSpaces = spaces?.slice(0, 6) || [];
  const hiddenSpacesCount = Math.max((spaces?.length || 0) - visibleSpaces.length, 0);

  const userInitials = user?.user_metadata?.full_name
    ?.split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || user?.email?.[0].toUpperCase() || 'U';

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth', { replace: true });
  };

  return (
    <Sidebar className="border-r border-sidebar-border" data-tour="sidebar">
      <SidebarHeader className="p-4">
        <div className="mb-4 flex items-center">
          <FlowaltLogo size={30} wordmarkClassName="text-[1.05rem]" />
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="w-full justify-between px-3 py-2 h-auto" data-tour="workspace-selector">
              <div className="flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded bg-primary/10">
                  <Building2 className="h-3.5 w-3.5 text-primary" />
                </div>
                <span className="truncate text-sm font-medium">
                  {currentWorkspace?.name || 'Selecionar Workspace'}
                </span>
              </div>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            {workspaces.map((workspace) => (
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
            <DropdownMenuItem onClick={(e) => {
              e.preventDefault();
              navigate('/workspace/new');
            }}>
              <Plus className="mr-2 h-4 w-4" />
              Criar Workspace
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNavItems.map((item) => (
                <SidebarMenuItem key={item.path}>
                  <SidebarMenuButton
                    asChild
                    isActive={location.pathname === item.path}
                  >
                    <Link to={item.path}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator />

        <SidebarGroup data-tour="spaces-menu">
          <SidebarGroupLabel>Espaços</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {spacesLoading ? (
                <>
                  <Skeleton className="h-8 w-full mb-1" />
                  <Skeleton className="h-8 w-full mb-1" />
                  <Skeleton className="h-8 w-full" />
                </>
              ) : visibleSpaces.length > 0 ? (
                <>
                  {visibleSpaces.map((space) => (
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
                  {hiddenSpacesCount > 0 && (
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild>
                        <Link to="/settings?tab=spaces">
                          <Plus className="h-4 w-4" />
                          <span>Ver mais {hiddenSpacesCount}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )}
                </>
              ) : (
                <p className="px-2 py-1 text-xs text-muted-foreground">
                  Nenhum espaço
                </p>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator />

        <SidebarGroup data-tour="management-menu">
          <SidebarGroupLabel>Gestão</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {managementItems.map((item) => (
                <SidebarMenuItem key={item.path}>
                  <SidebarMenuButton
                    asChild
                    isActive={location.pathname === item.path || location.pathname.startsWith(item.path + '?')}
                  >
                    <Link to={item.path}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4" data-tour="user-menu">
        <SidebarSeparator className="mb-4" />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="w-full justify-start gap-2 px-2">
              <Avatar className="h-7 w-7 flex-shrink-0">
                <AvatarImage src={user?.user_metadata?.avatar_url} />
                <AvatarFallback className="bg-primary text-xs text-primary-foreground">
                  {userInitials}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-1 flex-col items-start text-left min-w-0">
                <span className="text-sm font-medium truncate max-w-[130px]">
                  {user?.user_metadata?.full_name?.split(' ')[0] || 'Usuário'}
                </span>
                <span className="text-xs text-muted-foreground truncate max-w-[130px]">
                  {user?.email}
                </span>
              </div>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem asChild>
              <Link to="/settings" className="flex items-center">
                <Settings className="mr-2 h-4 w-4" />
                Configurações
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>
    </Sidebar>
  );
};
