import { useFeatureFlags, FEATURE_FLAGS } from '@/hooks/useFeatureFlags';
import { useChatUnread } from '@/hooks/useChat';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  useSidebar,
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useSpaces } from '@/hooks/useSpaces';
import { useDeleteFolder, useFolders } from '@/hooks/useFolders';
import { useFolderViews } from '@/hooks/useSocialMediaTemplates';
import { useFolderPermissions, useIsAdmin } from '@/hooks/useFolderPermissions';
import { useToast } from '@/hooks/use-toast';
import { CreateViewDialog } from '@/components/social-media/CreateViewDialog';
import { EditFolderDialog } from '@/components/spaces/EditFolderDialog';
import { usePermissions } from '@/hooks/usePermissions';
import { useEntitlementRegistry } from '@/hooks/useEntitlementRegistry';
import { useMyRunningTimer } from '@/hooks/useTimeEntries';
import { useNewUiBeta } from '@/hooks/useNewUiBeta';
import { SpaceTreeNav } from '@/components/spaces/SpaceTreeNav';
import { FlowaltLogo } from '@/components/brand/FlowaltLogo';
import { cn } from '@/lib/utils';
import {
  BarChart3,
  Briefcase,
  Building2,
  Calculator,
  Calendar,
  CalendarPlus,
  CheckSquare,
  ChevronDown,
  Clock,
  DollarSign,
  FileText,
  Folder,
  LayoutDashboard,
  Lightbulb,
  Lock,
  LogOut,
  MessageCircle,
  MoreHorizontal,
  Pencil,
  Trash2,
  Palette,
  Plug,
  Plus,
  Search,
  Settings,
  Settings2,
  Share2,
  Target,
  Timer,
  TrendingUp,
  Trophy,
  UserCircle,
  Users,
  Video,
  Zap,
  type LucideIcon,
} from 'lucide-react';

/**
 * Menu lateral novo (visual novo, ligado por padrão para todos).
 *
 * Mesmas telas, permissões e dados do menu atual. A navegação diária dos espaços é desenhada
 * aqui (espaço, pasta, visão), e a administração (criar pasta, criar/editar/excluir visão,
 * salvar modelo) continua na árvore antiga, aberta pelo botão de engrenagem de cada espaço
 * para quem é administrador. "Conversas" e "Aprovações" entram quando essas telas existirem.
 */

const ENCERRADOS = '(delivered,approved,archived)';

const iconesDeEspaco: Record<string, LucideIcon> = {
  palette: Palette,
  video: Video,
  'share-2': Share2,
  target: Target,
  briefcase: Briefcase,
  folder: Folder,
};

interface Item {
  icon: LucideIcon;
  label: string;
  path: string;
  contagem?: number;
}

// ---------------------------------------------------------------------------
// estado recolhido/aberto lembrado no navegador
// ---------------------------------------------------------------------------
function lerFlag(chave: string, padrao: boolean) {
  try {
    const v = window.localStorage.getItem(`flowalt_menu_${chave}`);
    return v === null ? padrao : v === '1';
  } catch {
    return padrao;
  }
}

function useFlag(chave: string, padrao: boolean) {
  const [aberto, setAberto] = useState(() => lerFlag(chave, padrao));
  const definir = (valor: boolean) => {
    setAberto(valor);
    try {
      window.localStorage.setItem(`flowalt_menu_${chave}`, valor ? '1' : '0');
    } catch {
      /* ignora: só não lembra o estado */
    }
  };
  return [aberto, definir] as const;
}

// ---------------------------------------------------------------------------
// contadores
// ---------------------------------------------------------------------------
function useContagens() {
  const { user } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const wsId = currentWorkspace?.id;

  const porEspaco = useQuery({
    queryKey: ['menu-contagem-espacos', wsId],
    queryFn: async () => {
      const { data } = await supabase
        .from('card_spaces')
        .select('space_id, cards!inner(status, workspace_id)')
        .eq('cards.workspace_id', wsId!)
        .not('cards.status', 'in', ENCERRADOS);
      const mapa = new Map<string, number>();
      (data ?? []).forEach((l: any) => mapa.set(l.space_id, (mapa.get(l.space_id) ?? 0) + 1));
      return mapa;
    },
    enabled: !!wsId,
    staleTime: 60_000,
  });

  const meus = useQuery({
    queryKey: ['menu-contagem-meus', wsId, user?.id],
    queryFn: async () => {
      const { count } = await supabase
        .from('card_members')
        .select('card_id, cards!inner(status, workspace_id)', { count: 'exact', head: true })
        .eq('user_id', user!.id)
        .eq('cards.workspace_id', wsId!)
        .not('cards.status', 'in', ENCERRADOS);
      return count ?? 0;
    },
    enabled: !!wsId && !!user?.id,
    staleTime: 60_000,
  });

  return { porEspaco: porEspaco.data, meus: meus.data ?? 0 };
}

// ---------------------------------------------------------------------------
// peças visuais
// ---------------------------------------------------------------------------
const classeLinha =
  'group/linha flex h-10 w-full items-center gap-3 rounded-xl px-3 text-[13.5px] font-semibold group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0 ' +
  'text-foreground/70 transition-colors hover:bg-foreground/[0.04] hover:text-foreground';
const classeAtiva = 'bg-primary/10 text-primary hover:bg-primary/10 hover:text-primary';

// Nomes cadastrados em CAIXA ALTA (ex.: TAREFAS) aparecem como "Tarefas"; siglas curtas (CRM) ficam como estão.
function rotuloPasta(nome: string) {
  const letras = nome.replace(/[^A-Za-zÀ-ÿ]/g, '');
  if (letras.length > 4 && nome === nome.toUpperCase()) {
    const minusculo = nome.toLowerCase();
    return minusculo.charAt(0).toUpperCase() + minusculo.slice(1);
  }
  return nome;
}

function Contador({ valor, destaque }: { valor?: number; destaque?: boolean }) {
  if (!valor) return null;
  return (
    <span
      className={cn(
        'ml-auto min-w-[1.25rem] rounded-full px-1.5 text-center text-[11px] font-bold tabular-nums leading-5 group-data-[collapsible=icon]:hidden',
        destaque ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
      )}
    >
      {valor}
    </span>
  );
}

function LinhaItem({ item, ativo }: { item: Item; ativo: boolean }) {
  return (
    <Link to={item.path} title={item.label} className={cn(classeLinha, ativo && classeAtiva)} aria-current={ativo ? 'page' : undefined}>
      <item.icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.9} />
      <span className="truncate group-data-[collapsible=icon]:hidden">{item.label}</span>
      <Contador valor={item.contagem} />
    </Link>
  );
}

function Rotulo({ children, acao }: { children: React.ReactNode; acao?: React.ReactNode }) {
  return (
    <div className="mb-1 mt-5 flex items-center px-3 group-data-[collapsible=icon]:mx-2 group-data-[collapsible=icon]:mb-2 group-data-[collapsible=icon]:mt-3 group-data-[collapsible=icon]:border-t group-data-[collapsible=icon]:px-0">
      <span className="text-[10.5px] font-bold uppercase tracking-[0.09em] text-muted-foreground/80 group-data-[collapsible=icon]:hidden">{children}</span>
      <span className="ml-auto group-data-[collapsible=icon]:hidden">{acao}</span>
    </div>
  );
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
      className="mb-3 flex items-center gap-2 rounded-xl border border-primary/25 bg-primary/10 px-3 py-2.5 text-xs font-semibold text-primary group-data-[collapsible=icon]:hidden"
    >
      <span className="relative flex h-2 w-2 shrink-0">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
      </span>
      <span className="min-w-0 flex-1 truncate">{timer.cards?.title || 'Card'}</span>
      <span className="font-mono tabular-nums">{formatarTempo(decorrido)}</span>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// espaços: espaço > pasta > visão (uma pasta com uma só visão abre direto)
// ---------------------------------------------------------------------------
function PastaItem({
  pasta,
  espacoId,
  visaoAtual,
  noEspacoAtivo,
  usuarioId,
  ehAdmin,
  tipoEspaco,
}: {
  pasta: { id: string; name: string; color: string | null; owner_id: string | null; is_personal?: boolean };
  espacoId: string;
  visaoAtual: string | null;
  noEspacoAtivo: boolean;
  usuarioId?: string;
  ehAdmin: boolean;
  tipoEspaco?: string;
}) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const excluirPasta = useDeleteFolder();
  // Quem administra o workspace pode tudo; os demais dependem da permissão da pasta (consulta só para eles).
  const permissoes = useFolderPermissions(ehAdmin ? undefined : pasta.id, pasta.owner_id);
  const [dialogo, definirDialogo] = useState<null | 'view' | 'editar' | 'excluir'>(null);
  const { data: visoes, isLoading } = useFolderViews(pasta.id);
  const restrita = !!pasta.is_personal && !!pasta.owner_id && pasta.owner_id !== usuarioId;
  const contemAtiva = noEspacoAtivo && !!visoes?.some(v => v.id === visaoAtual);
  const [aberta, definirAberta] = useFlag(`pasta_${pasta.id}`, false);
  // Abre sozinha quando a pessoa entra numa visão desta pasta; depois o clique recolhe normalmente.
  useEffect(() => {
    if (contemAtiva) definirAberta(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contemAtiva]);

  const classeSub =
    'flex h-9 w-full items-center gap-2 rounded-lg px-3 text-[13px] font-medium text-foreground/65 max-md:h-10 ' +
    'transition-colors hover:bg-foreground/[0.04] hover:text-foreground';

  const podeGerenciar = !restrita && (ehAdmin || permissoes.canManageViews);
  const podeExcluir = ehAdmin || permissoes.canDelete;

  // Menu "⋯" da pasta: discreto, aparece ao passar o mouse (no celular fica sempre visível).
  const menuDaPasta = (posicao: string) =>
    podeGerenciar ? (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={`Ações da pasta ${pasta.name}`}
            onClick={e => e.stopPropagation()}
            className={cn(
              'absolute top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-opacity',
              'hover:bg-foreground/[0.07] hover:text-foreground focus-visible:opacity-100',
              'data-[state=open]:bg-foreground/[0.07] data-[state=open]:text-foreground data-[state=open]:opacity-100',
              'md:opacity-0 md:group-hover/pasta:opacity-100',
              posicao
            )}
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="right" align="start" sideOffset={10} className="w-48 rounded-xl border-border/60 p-1.5 shadow-lg">
          <DropdownMenuItem onClick={() => definirDialogo('view')} className="h-9 gap-2.5 rounded-lg px-2.5 text-[13px] font-medium">
            <Plus className="h-4 w-4 text-muted-foreground" />
            Nova view
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => definirDialogo('editar')} className="h-9 gap-2.5 rounded-lg px-2.5 text-[13px] font-medium">
            <Pencil className="h-4 w-4 text-muted-foreground" />
            Editar pasta
          </DropdownMenuItem>
          {podeExcluir && (
            <>
              <DropdownMenuSeparator className="my-1.5" />
              <DropdownMenuItem
                onClick={() => definirDialogo('excluir')}
                className="h-9 gap-2.5 rounded-lg px-2.5 text-[13px] font-medium text-destructive focus:bg-destructive/10 focus:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
                Excluir pasta
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    ) : null;

  const dialogos = (
    <>
      {dialogo === 'view' && (
        <CreateViewDialog
          open
          onOpenChange={aberto => !aberto && definirDialogo(null)}
          folderId={pasta.id}
          spaceType={tipoEspaco ?? ''}
          onSuccess={viewId => navigate(`/space/${espacoId}?view=${viewId}`)}
        />
      )}
      {dialogo === 'editar' && (
        <EditFolderDialog open onOpenChange={aberto => !aberto && definirDialogo(null)} folder={{ id: pasta.id, name: pasta.name }} />
      )}
      {dialogo === 'excluir' && (
        <AlertDialog open onOpenChange={aberto => !aberto && definirDialogo(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir pasta "{pasta.name}"?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta ação não pode ser desfeita. Todos os cards e views dentro desta pasta serão arquivados e o histórico de alterações será registrado para auditoria.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={async () => {
                  try {
                    await excluirPasta.mutateAsync({ id: pasta.id, spaceId: espacoId });
                    toast({ title: 'Pasta excluída', description: 'A pasta foi excluída com sucesso.' });
                  } catch {
                    toast({ title: 'Erro ao excluir pasta', description: 'Você não tem permissão para excluir esta pasta.', variant: 'destructive' });
                  }
                  definirDialogo(null);
                }}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Excluir permanentemente
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  );

  if (restrita) {
    return (
      <div className={cn(classeSub, 'cursor-not-allowed opacity-60')} title="Pasta pessoal de outro usuário">
        <Lock className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">{rotuloPasta(pasta.name)}</span>
      </div>
    );
  }

  if (isLoading) return <Skeleton className="h-9 w-full rounded-lg" />;

  const lista = visoes ?? [];

  // Pasta com uma única visão: um clique vai direto para ela.
  if (lista.length === 1) {
    const visao = lista[0];
    const ativa = noEspacoAtivo && visaoAtual === visao.id;
    return (
      <div className="group/pasta relative">
        <Link
          to={`/space/${espacoId}?view=${visao.id}`}
          className={cn(classeSub, podeGerenciar && 'pr-9', ativa && 'bg-primary/10 font-semibold text-primary hover:bg-primary/10 hover:text-primary')}
          title={`${pasta.name} · ${visao.name}`}
        >
          <span className="truncate">{rotuloPasta(pasta.name)}</span>
        </Link>
        {menuDaPasta('right-1.5')}
        {dialogos}
      </div>
    );
  }

  const aberto = aberta;
  return (
    <div>
      <div className="group/pasta relative">
        <button
          onClick={() => definirAberta(!aberto)}
          className={cn(classeSub, podeGerenciar && 'pr-14', contemAtiva && 'text-primary')}
          aria-expanded={aberto}
          title={pasta.name}
        >
          <span className="truncate">{rotuloPasta(pasta.name)}</span>
          <ChevronDown className={cn('ml-auto h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform', aberto && 'rotate-180')} />
        </button>
        {menuDaPasta('right-8')}
        {dialogos}
      </div>
      {aberto && (
        <div className="mt-0.5 space-y-0.5 pl-2">
          {lista.map(v => {
            const ativa = noEspacoAtivo && visaoAtual === v.id;
            return (
              <Link
                key={v.id}
                to={`/space/${espacoId}?view=${v.id}`}
                className={cn(
                  'flex h-8 items-center rounded-lg px-3 text-[12.5px] font-medium text-foreground/60 transition-colors max-md:h-10 hover:bg-foreground/[0.04] hover:text-foreground',
                  'before:mr-2.5 before:h-1 before:w-1 before:shrink-0 before:rounded-full before:bg-current before:opacity-35 before:content-[\'\']',
                  ativa && 'bg-primary/10 font-semibold text-primary before:opacity-100 hover:bg-primary/10 hover:text-primary'
                )}
              >
                <span className="truncate">{v.name}</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function EspacoItem({
  espaco,
  contagem,
  ehAdmin,
  aoGerenciar,
}: {
  espaco: { id: string; name: string; color?: string; icon?: string; type?: string };
  contagem?: number;
  ehAdmin: boolean;
  aoGerenciar: () => void;
}) {
  const location = useLocation();
  const { user } = useAuth();
  const { state: estadoMenu, setOpen: abrirMenu, isMobile } = useSidebar();
  const visaoAtual = new URLSearchParams(location.search).get('view');
  const noEspacoAtivo = location.pathname === `/space/${espaco.id}`;
  const [aberto, definirAberto] = useFlag(`espaco_${espaco.id}`, false);
  // Abre sozinho quando a pessoa entra neste espaço; depois o clique recolhe normalmente.
  useEffect(() => {
    if (noEspacoAtivo) definirAberto(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noEspacoAtivo]);
  const mostrar = aberto;
  const { data: pastas, isLoading } = useFolders(mostrar ? espaco.id : undefined);
  const Icone = iconesDeEspaco[espaco.icon ?? 'folder'] ?? Folder;
  const cor = espaco.color || 'hsl(var(--primary))';

  return (
    <div>
      <div className={cn(classeLinha, 'pr-2 group-data-[collapsible=icon]:pr-0', noEspacoAtivo && 'text-foreground')}>
        <button
          onClick={() => {
            // Com o menu em ícones, tocar num espaço reabre o menu já com ele aberto.
            if (!isMobile && estadoMenu === 'collapsed') {
              abrirMenu(true);
              definirAberto(true);
            } else {
              definirAberto(!mostrar);
            }
          }}
          className="flex min-w-0 flex-1 items-center gap-3 text-left group-data-[collapsible=icon]:justify-center"
          aria-expanded={mostrar}
          aria-label={`${mostrar ? 'Recolher' : 'Expandir'} ${espaco.name}`}
          title={espaco.name}
        >
          <span
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg"
            style={{ backgroundColor: `${cor}22`, color: cor }}
          >
            <Icone className="h-3.5 w-3.5" strokeWidth={2.1} />
          </span>
          <span className="truncate group-data-[collapsible=icon]:hidden">{espaco.name}</span>
        </button>
        {ehAdmin && (
          <button
            onClick={aoGerenciar}
            className="hidden h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground group-hover/linha:flex group-data-[collapsible=icon]:!hidden"
            title="Gerenciar pastas e visões"
            aria-label={`Gerenciar ${espaco.name}`}
          >
            <Settings2 className="h-3.5 w-3.5" />
          </button>
        )}
        <Contador valor={contagem} />
        <button onClick={() => definirAberto(!mostrar)} tabIndex={-1} aria-hidden="true" className="flex h-6 w-5 items-center justify-center group-data-[collapsible=icon]:hidden">
          <ChevronDown className={cn('h-3.5 w-3.5 text-muted-foreground transition-transform', mostrar && 'rotate-180')} />
        </button>
      </div>

      {mostrar && (
        <div className="ml-[1.1rem] mt-0.5 space-y-0.5 border-l border-border/70 pl-2.5 group-data-[collapsible=icon]:hidden">
          {isLoading ? (
            <>
              <Skeleton className="h-9 w-full rounded-lg" />
              <Skeleton className="h-9 w-full rounded-lg" />
            </>
          ) : pastas && pastas.length > 0 ? (
            pastas.map(p => (
              <PastaItem
                key={p.id}
                pasta={p}
                espacoId={espaco.id}
                visaoAtual={visaoAtual}
                noEspacoAtivo={noEspacoAtivo}
                usuarioId={user?.id}
                ehAdmin={ehAdmin}
                tipoEspaco={espaco.type}
              />
            ))
          ) : (
            <p className="px-3 py-1.5 text-xs text-muted-foreground">Nenhuma pasta ainda</p>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
export const AppSidebarV2: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isMobile, setOpenMobile, state: estadoMenu, setOpen: abrirMenu } = useSidebar();
  // No celular o menu é uma gaveta: depois de escolher um destino ela precisa fechar
  useEffect(() => {
    if (isMobile) setOpenMobile(false);
  }, [location.pathname, location.search, isMobile, setOpenMobile]);
  const { user, signOut } = useAuth();
  const { workspaces, currentWorkspace, setCurrentWorkspace } = useWorkspace();
  const { data: spaces, isLoading: carregandoEspacos } = useSpaces();
  const { isAdmin, isCoordinator } = usePermissions();
  const ehAdminDePastas = useIsAdmin();
  const { has } = useEntitlementRegistry();
  const beta = useNewUiBeta();
  const { porEspaco, meus } = useContagens();
  // Sombras discretas no topo/base da lista quando há mais conteúdo rolando por baixo
  const rolagemRef = useRef<HTMLDivElement>(null);
  const [sombra, definirSombra] = useState({ topo: false, base: false });
  const medirRolagem = useCallback(() => {
    const el = rolagemRef.current;
    if (!el) return;
    const topo = el.scrollTop > 4;
    const base = el.scrollTop + el.clientHeight < el.scrollHeight - 4;
    definirSombra(atual => (atual.topo === topo && atual.base === base ? atual : { topo, base }));
  }, []);
  useEffect(() => {
    const el = rolagemRef.current;
    if (!el) return;
    medirRolagem();
    const redimensionou = new ResizeObserver(medirRolagem);
    redimensionou.observe(el);
    const mudou = new MutationObserver(medirRolagem);
    mudou.observe(el, { childList: true, subtree: true });
    return () => {
      redimensionou.disconnect();
      mudou.disconnect();
    };
  }, [medirRolagem]);

  const [gerenciando, setGerenciando] = useState<{ id: string; name: string; color?: string; icon?: string; type?: string } | null>(null);

  const temAcessoIntegracoes = isAdmin || isCoordinator;
  const temSocial = has('social_publish');

  const { isEnabled: flagLigada } = useFeatureFlags();
  const conversasLigada = flagLigada(FEATURE_FLAGS.TEAM_CHAT);
  const { total: conversasNaoLidas } = useChatUnread(conversasLigada);

  const principais: Item[] = [
    { icon: LayoutDashboard, label: 'Início', path: '/' },
    { icon: BarChart3, label: 'Dashboard', path: '/dashboard' },
    { icon: CheckSquare, label: 'Meu trabalho', path: '/tasks', contagem: meus },
    { icon: Calendar, label: 'Agenda', path: '/calendar' },
    ...(conversasLigada ? [{ icon: MessageCircle, label: 'Conversas', path: '/conversas', contagem: conversasNaoLidas }] : []),
    { icon: Building2, label: 'Clientes', path: '/clients' },
  ];

  // Mesmos itens e mesmas regras de exibição do menu atual.
  const gestao: Item[] = [
    { icon: Users, label: 'Coordenação', path: '/coordination' },
    { icon: Calculator, label: 'AltControl', path: '/altcontrol' },
    { icon: UserCircle, label: 'People Analytics', path: '/people-analytics' },
    { icon: DollarSign, label: 'Financeiro', path: '/financial' },
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
  const [gestaoAberta, definirGestao] = useFlag('gestao', false);
  const [maisAberto, definirMais] = useFlag('mais', false);
  const emGestao = noCaminho(gestao);
  const emMais = noCaminho(mais);
  // Abrem sozinhos ao entrar numa das telas do grupo; depois o clique recolhe normalmente.
  useEffect(() => {
    if (emGestao) definirGestao(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emGestao]);
  useEffect(() => {
    if (emMais) definirMais(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emMais]);

  const espacos = spaces?.slice(0, 12) ?? [];
  const espacosOcultos = Math.max((spaces?.length ?? 0) - espacos.length, 0);

  const iniciais = useMemo(
    () =>
      user?.user_metadata?.full_name?.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) ||
      user?.email?.[0].toUpperCase() ||
      'U',
    [user]
  );

  const sair = async () => {
    await signOut();
    navigate('/auth', { replace: true });
  };

  const renderGrupo = (
    titulo: string,
    Icone: LucideIcon,
    itens: Item[],
    aberto: boolean,
    definir: (v: boolean) => void,
    tom: 'primario' | 'neutro'
  ) => {
    const visivel = aberto;
    return (
      <div>
        <button
          onClick={() => {
            if (!isMobile && estadoMenu === 'collapsed') {
              abrirMenu(true);
              definir(true);
            } else {
              definir(!visivel);
            }
          }}
          className={cn(classeLinha, noCaminho(itens) && 'text-primary')}
          aria-expanded={visivel}
          aria-label={`${visivel ? 'Recolher' : 'Expandir'} ${titulo}`}
          title={titulo}
        >
          <span
            className={cn(
              'flex h-6 w-6 shrink-0 items-center justify-center rounded-lg',
              tom === 'primario' ? 'bg-primary/10 text-primary' : 'bg-foreground/[0.07] text-foreground/60'
            )}
          >
            <Icone className="h-3.5 w-3.5" strokeWidth={2.1} />
          </span>
          <span className="flex-1 text-left group-data-[collapsible=icon]:hidden">{titulo}</span>
          <ChevronDown className={cn('h-3.5 w-3.5 text-muted-foreground transition-transform group-data-[collapsible=icon]:hidden', visivel && 'rotate-180')} />
        </button>
        {visivel && (
          <div className="ml-[1.1rem] mt-0.5 space-y-0.5 border-l border-border/70 pl-2.5 group-data-[collapsible=icon]:hidden">
            {itens.map(item => {
              const ativo = location.pathname === item.path || location.pathname.startsWith(item.path + '/');
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    'flex h-9 items-center rounded-lg px-3 text-[13px] font-medium text-foreground/65 transition-colors max-md:h-10 hover:bg-foreground/[0.04] hover:text-foreground',
                    ativo && 'bg-primary/10 font-semibold text-primary hover:bg-primary/10 hover:text-primary'
                  )}
                >
                  <span className="truncate">{item.label}</span>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const algumAberto = gestaoAberta || maisAberto;
  const grupos = (
    <>
      <div data-tour="management-menu">{renderGrupo('Gestão', BarChart3, gestao, gestaoAberta, definirGestao, 'primario')}</div>
      {renderGrupo('Mais', MoreHorizontal, mais, maisAberto, definirMais, 'neutro')}
    </>
  );

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border" data-tour="sidebar">
      <SidebarHeader className="gap-3 px-4 pb-3 pt-5 group-data-[collapsible=icon]:px-2">
        <div className="flex items-center px-1 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
          <FlowaltLogo size={30} wordmarkClassName="text-[1.05rem] group-data-[collapsible=icon]:hidden" />
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              className="h-11 w-full justify-between rounded-xl bg-card px-3 shadow-sm group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
              data-tour="workspace-selector"
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
                  <Building2 className="h-4 w-4 text-primary" />
                </div>
                <span className="truncate text-sm font-semibold group-data-[collapsible=icon]:hidden">{currentWorkspace?.name || 'Selecionar Workspace'}</span>
              </div>
              <ChevronDown className="h-4 w-4 text-muted-foreground group-data-[collapsible=icon]:hidden" />
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

        <div className="contents max-md:flex max-md:gap-2">
        <button
          onClick={() => window.dispatchEvent(new Event('flowalt:abrir-busca'))}
          className="flex h-10 w-full items-center gap-2.5 rounded-xl bg-muted/70 px-3.5 text-[13px] text-muted-foreground transition-colors hover:bg-muted max-md:order-2 max-md:w-11 max-md:flex-none max-md:justify-center max-md:px-0 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
          aria-label="Abrir busca (Command K)"
        >
          <Search className="h-4 w-4" />
          <span className="flex-1 text-left max-md:hidden group-data-[collapsible=icon]:hidden">Buscar…</span>
          <kbd className="rounded-md border bg-background px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground max-md:hidden group-data-[collapsible=icon]:hidden">⌘K</kbd>
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button className="h-10 w-full gap-1.5 rounded-xl text-[13.5px] font-bold shadow-sm max-md:order-1 max-md:flex-1 group-data-[collapsible=icon]:px-0" aria-label="Criar novo" title="Novo">
              <Plus className="h-4 w-4" strokeWidth={2.5} /> <span className="group-data-[collapsible=icon]:hidden">Novo</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64 rounded-xl p-1.5">
            <DropdownMenuLabel className="text-xs text-muted-foreground">Criar</DropdownMenuLabel>
            <DropdownMenuItem className="rounded-lg py-2" onClick={() => navigate('/tasks?new=quick')}>
              <Zap className="mr-3 h-4 w-4" />
              <div>
                <p className="text-sm font-medium">Card rápido</p>
                <p className="text-xs text-muted-foreground">Sem briefing nem checklist</p>
              </div>
            </DropdownMenuItem>
            <DropdownMenuItem className="rounded-lg py-2" onClick={() => navigate('/tasks?new=briefed')}>
              <FileText className="mr-3 h-4 w-4" />
              <div>
                <p className="text-sm font-medium">Demanda com briefing</p>
                <p className="text-xs text-muted-foreground">Com validações e etapas</p>
              </div>
            </DropdownMenuItem>
            <DropdownMenuItem className="rounded-lg py-2" onClick={() => navigate('/calendar?new=1')}>
              <CalendarPlus className="mr-3 h-4 w-4" />
              <div>
                <p className="text-sm font-medium">Agendar evento</p>
                <p className="text-xs text-muted-foreground">Reunião, gravação ou prazo</p>
              </div>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        </div>
      </SidebarHeader>

      <SidebarContent className="gap-0 overflow-hidden px-3 pb-2 group-data-[collapsible=icon]:px-2">
        {/* A área com nav e espaços rola; Gestão e Mais ficam fixos logo acima do rodapé. */}
        <div className="relative flex min-h-0 flex-1 flex-col">
        <div
          ref={rolagemRef}
          onScroll={medirRolagem}
          className="min-h-0 flex-1 overflow-y-auto pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
        <nav className="space-y-0.5" aria-label="Principal">
          {principais.map(item => (
            <LinhaItem key={item.path} item={item} ativo={location.pathname === item.path} />
          ))}
        </nav>

        <div data-tour="spaces-menu">
          <Rotulo
            acao={
              ehAdminDePastas && (
                <Link
                  to="/settings?tab=spaces"
                  className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground"
                  title="Gerenciar espaços"
                  aria-label="Gerenciar espaços"
                >
                  <Plus className="h-3.5 w-3.5" />
                </Link>
              )
            }
          >
            Espaços
          </Rotulo>
          <div className="space-y-0.5">
            {carregandoEspacos ? (
              <>
                <Skeleton className="h-10 w-full rounded-xl" />
                <Skeleton className="h-10 w-full rounded-xl" />
                <Skeleton className="h-10 w-full rounded-xl" />
              </>
            ) : espacos.length > 0 ? (
              <>
                {espacos.map(espaco => (
                  <EspacoItem
                    key={espaco.id}
                    espaco={espaco}
                    contagem={porEspaco?.get(espaco.id)}
                    ehAdmin={ehAdminDePastas}
                    aoGerenciar={() => setGerenciando(espaco)}
                  />
                ))}
                {espacosOcultos > 0 && (
                  <Link to="/settings?tab=spaces" className={classeLinha}>
                    <Plus className="h-[18px] w-[18px]" />
                    <span>Ver mais {espacosOcultos}</span>
                  </Link>
                )}
              </>
            ) : (
              <p className="px-3 py-1 text-xs text-muted-foreground">Nenhum espaço</p>
            )}
          </div>
        </div>


          {/* Gestão e Mais abertos rolam junto com o menu, sem ficar presos por cima da lista. */}
          {algumAberto && <div className="mt-4 space-y-0.5 pb-2">{grupos}</div>}
        </div>
        <div aria-hidden="true" className={cn('pointer-events-none absolute inset-x-0 top-0 h-5 bg-gradient-to-b from-sidebar to-transparent transition-opacity', sombra.topo ? 'opacity-100' : 'opacity-0')} />
        <div aria-hidden="true" className={cn('pointer-events-none absolute inset-x-0 bottom-0 h-7 bg-gradient-to-t from-sidebar to-transparent transition-opacity', sombra.base ? 'opacity-100' : 'opacity-0')} />
        </div>

        {/* Recolhidos, ficam fixos no rodapé do menu, com respiro em relação à lista. */}
        {!algumAberto && <div className="mt-3 shrink-0 space-y-0.5 pb-1">{grupos}</div>}
      </SidebarContent>

      <SidebarFooter className="px-3 pb-4 pt-2 group-data-[collapsible=icon]:px-2" data-tour="user-menu">
        <CronometroAtivo />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-auto w-full justify-start gap-2.5 rounded-xl px-2 py-2 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
              <Avatar className="h-9 w-9 flex-shrink-0">
                <AvatarImage src={user?.user_metadata?.avatar_url} />
                <AvatarFallback className="bg-primary text-xs text-primary-foreground">{iniciais}</AvatarFallback>
              </Avatar>
              <div className="flex min-w-0 flex-1 flex-col items-start text-left group-data-[collapsible=icon]:hidden">
                <span className="max-w-[130px] truncate text-sm font-semibold">
                  {user?.user_metadata?.full_name?.split(' ')[0] || 'Usuário'}
                </span>
                <span className="max-w-[130px] truncate text-xs text-muted-foreground">{user?.email}</span>
              </div>
              <ChevronDown className="h-4 w-4 text-muted-foreground group-data-[collapsible=icon]:hidden" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64 rounded-xl">
            <DropdownMenuItem asChild>
              <Link to="/settings" className="flex items-center">
                <Settings className="mr-2 h-4 w-4" />
                Configurações
              </Link>
            </DropdownMenuItem>
            {beta.podeUsar && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-xs text-muted-foreground">Aparência (preferência só sua)</DropdownMenuLabel>
                <DropdownMenuCheckboxItem checked={beta.menu} onCheckedChange={v => beta.definir({ menu: !!v })}>
                  Menu novo
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem checked={beta.respiro} onCheckedChange={v => beta.definir({ respiro: !!v })}>
                  Kanban com visual novo
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem checked={beta.inicio} onCheckedChange={v => beta.definir({ inicio: !!v })}>
                  Início com visual novo
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem checked={beta.meutrabalho} onCheckedChange={v => beta.definir({ meutrabalho: !!v })}>
                  Meu trabalho com visual novo
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem checked={beta.agenda} onCheckedChange={v => beta.definir({ agenda: !!v })}>
                  Agenda com visual novo
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem checked={beta.clientes} onCheckedChange={v => beta.definir({ clientes: !!v })}>
                  Clientes com visual novo
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem checked={beta.dashboard} onCheckedChange={v => beta.definir({ dashboard: !!v })}>
                  Dashboard com visual novo
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem checked={beta.gestao} onCheckedChange={v => beta.definir({ gestao: !!v })}>
                  Gestão com visual novo
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem checked={beta.tempo} onCheckedChange={v => beta.definir({ tempo: !!v })}>
                  Tempo com visual novo
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem checked={beta.ideias} onCheckedChange={v => beta.definir({ ideias: !!v })}>
                  Banco de Ideias com visual novo
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem checked={beta.config} onCheckedChange={v => beta.definir({ config: !!v })}>
                  Configurações com visual novo
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem checked={beta.alertas} onCheckedChange={v => beta.definir({ alertas: !!v })}>
                  Notificações com visual novo
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

      {/* Administração do espaço: a árvore completa de antes (criar pasta/visão, editar, excluir, modelo). */}
      <Dialog open={!!gerenciando} onOpenChange={aberto => !aberto && setGerenciando(null)}>
        <DialogContent className="max-h-[85vh] max-w-md overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Gerenciar {gerenciando?.name}</DialogTitle>
          </DialogHeader>
          {gerenciando && (
            <SpaceTreeNav
              spaceId={gerenciando.id}
              spaceName={gerenciando.name}
              spaceColor={gerenciando.color}
              spaceIcon={gerenciando.icon}
              spaceType={gerenciando.type}
            />
          )}
        </DialogContent>
      </Dialog>
    </Sidebar>
  );
};
