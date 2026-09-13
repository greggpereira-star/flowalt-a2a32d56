import { useNavigate } from 'react-router-dom';
import {
  Plus, Zap, FileText, CalendarPlus, Timer, Building2, Receipt, type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useGlobalModal } from '@/contexts/GlobalModalContext';
import { usePermissions } from '@/hooks/usePermissions';

interface Acao {
  id: string;
  label: string;
  descricao: string;
  icon: LucideIcon;
  executar: () => void;
}

/**
 * Menu de ação rápida do Dashboard.
 *
 * As ações levam às telas que já sabem criar cada coisa, em vez de duplicar
 * formulários aqui. Isso também resolve permissão sem lógica nova: cada tela
 * já aplica a própria regra, e um atalho que abrisse um formulário próprio
 * precisaria repetir essas checagens — e sair de sincronia com elas depois.
 *
 * A exceção é o lançamento financeiro, que tem modal global de verdade
 * (GlobalModalContext) e por isso abre sem sair da página.
 */
export function QuickActionMenu() {
  const navigate = useNavigate();
  const { openModal } = useGlobalModal();
  // Régua de permissão já existente no app; nenhuma regra nova aqui.
  const permissoes = usePermissions();

  const criar: Acao[] = ([
    {
      id: 'card-rapido',
      label: 'Card rápido',
      descricao: 'Sem briefing nem checklist',
      icon: Zap,
      executar: () => navigate('/tasks?new=quick'),
    },
    {
      id: 'demanda',
      label: 'Demanda com briefing',
      descricao: 'Com validações e etapas',
      icon: FileText,
      executar: () => navigate('/tasks?new=briefed'),
    },
    {
      id: 'evento',
      label: 'Agendar evento',
      descricao: 'Reunião, gravação ou prazo',
      icon: CalendarPlus,
      executar: () => navigate('/calendar?new=1'),
    },
  ] as (Acao & { permitido?: boolean })[])
    .map(a => ({ ...a, permitido: a.id === 'evento' ? true : permissoes.canCreateCards }))
    .filter(a => a.permitido);

  const operacao: Acao[] = ([
    {
      id: 'timer',
      label: 'Iniciar timer',
      descricao: 'Apontar tempo agora',
      icon: Timer,
      executar: () => navigate('/time'),
    },
    {
      id: 'cliente',
      label: 'Novo cliente',
      descricao: 'Cadastrar conta',
      icon: Building2,
      executar: () => navigate('/clients?new=1'),
    },
    {
      id: 'lancamento',
      label: 'Lançamento financeiro',
      descricao: 'Receita ou despesa',
      icon: Receipt,
      executar: () => openModal('transaction'),
    },
  ] as (Acao & { permitido?: boolean })[])
    .map(a => ({
      ...a,
      permitido:
        a.id === 'timer' ? permissoes.canTrackTime
        : a.id === 'lancamento' ? permissoes.canManageFinancial
        : permissoes.canCreateCards,
    }))
    .filter(a => a.permitido);

  const item = (a: Acao) => (
    <DropdownMenuItem key={a.id} onClick={a.executar} className="gap-2.5 py-2">
      <a.icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <span className="min-w-0">
        <span className="block text-sm">{a.label}</span>
        <span className="block text-[11px] text-muted-foreground">{a.descricao}</span>
      </span>
    </DropdownMenuItem>
  );

  if (criar.length === 0 && operacao.length === 0) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" className="gap-2">
          <Plus className="h-4 w-4" aria-hidden="true" />
          Nova ação rápida
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-60">
        {criar.length > 0 && (
          <>
            <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
              Criar
            </DropdownMenuLabel>
            {criar.map(item)}
          </>
        )}

        {criar.length > 0 && operacao.length > 0 && <DropdownMenuSeparator />}

        {operacao.length > 0 && (
          <>
            <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
              Operação
            </DropdownMenuLabel>
            {operacao.map(item)}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
