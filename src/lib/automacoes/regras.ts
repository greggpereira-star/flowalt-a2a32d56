// Regras automáticas (Onda 6): rótulos, descrição em português e validação, em funções puras.
// O que roda de fato mora no banco (run_automation_rules); aqui só se descreve, valida e detecta conflito.

export type EventoRegra = 'stage_entered' | 'approval_approved' | 'approval_changes_requested';
export type AcaoRegra = 'notify' | 'move_to_stage' | 'set_priority';
export type Destinatario = 'members' | 'creator' | 'admins';

export const EVENTOS: { valor: EventoRegra; rotulo: string }[] = [
  { valor: 'stage_entered', rotulo: 'Um card entrar numa etapa' },
  { valor: 'approval_approved', rotulo: 'O cliente aprovar uma peça' },
  { valor: 'approval_changes_requested', rotulo: 'O cliente pedir ajustes' },
];

// Mesmos rótulos do fluxo padrão do workspace (workflow_stages).
export const ETAPAS: { slug: string; rotulo: string }[] = [
  { slug: 'backlog', rotulo: 'Backlog' },
  { slug: 'planejamento', rotulo: 'A Fazer' },
  { slug: 'em_producao', rotulo: 'Em Produção' },
  { slug: 'revisao', rotulo: 'Revisão' },
  { slug: 'aprovacao', rotulo: 'Aprovação' },
  { slug: 'concluido', rotulo: 'Concluído' },
];
export const rotuloEtapa = (slug: string | null | undefined) => ETAPAS.find(e => e.slug === slug)?.rotulo ?? slug ?? '';

export const PRIORIDADES: { valor: string; rotulo: string }[] = [
  { valor: 'low', rotulo: 'Baixa' },
  { valor: 'medium', rotulo: 'Média' },
  { valor: 'high', rotulo: 'Alta' },
  { valor: 'critical', rotulo: 'Urgente' },
];

export const DESTINATARIOS: { valor: Destinatario; rotulo: string }[] = [
  { valor: 'members', rotulo: 'quem trabalha no card' },
  { valor: 'creator', rotulo: 'quem criou o card' },
  { valor: 'admins', rotulo: 'a coordenação e os administradores' },
];

export interface RegraAutomatica {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  trigger_event: EventoRegra;
  trigger_stage: string | null;
  space_id: string | null;
  action_type: AcaoRegra;
  action_config: Record<string, string>;
  is_active: boolean;
  created_at: string;
}

export function descreverRegra(r: Pick<RegraAutomatica, 'trigger_event' | 'trigger_stage' | 'action_type' | 'action_config' | 'space_id'>, nomeDoEspaco?: string | null) {
  const quando =
    r.trigger_event === 'stage_entered'
      ? `um card entrar na etapa ${rotuloEtapa(r.trigger_stage)}`
      : r.trigger_event === 'approval_approved'
        ? 'o cliente aprovar uma peça'
        : 'o cliente pedir ajustes';

  const cfg = r.action_config ?? {};
  const entao =
    r.action_type === 'notify'
      ? `avisar ${DESTINATARIOS.find(d => d.valor === cfg.to)?.rotulo ?? 'as pessoas escolhidas'}`
      : r.action_type === 'move_to_stage'
        ? `mover o card para ${rotuloEtapa(cfg.stage)}`
        : `mudar a prioridade para ${PRIORIDADES.find(p => p.valor === cfg.priority)?.rotulo ?? cfg.priority}`;

  const onde = r.space_id ? `só no espaço ${nomeDoEspaco ?? 'escolhido'}` : 'em todos os espaços';
  return { quando, entao, onde };
}

export interface FormularioRegra {
  evento: EventoRegra | '';
  etapa: string;
  spaceId: string;
  acao: AcaoRegra | '';
  destinatario: Destinatario | '';
  mensagem: string;
  etapaDestino: string;
  prioridade: string;
  nome: string;
}

export const FORMULARIO_VAZIO: FormularioRegra = {
  evento: '', etapa: '', spaceId: '', acao: '', destinatario: '', mensagem: '', etapaDestino: '', prioridade: '', nome: '',
};

export function validarFormulario(f: FormularioRegra): string | null {
  if (!f.nome.trim()) return 'Dê um nome à regra.';
  if (!f.evento) return 'Escolha quando a regra vale.';
  if (f.evento === 'stage_entered' && !f.etapa) return 'Escolha a etapa.';
  if (!f.acao) return 'Escolha o que fazer.';
  if (f.acao === 'notify') {
    if (!f.destinatario) return 'Escolha quem será avisado.';
    if (!f.mensagem.trim()) return 'Escreva a mensagem do aviso.';
  }
  if (f.acao === 'move_to_stage' && !f.etapaDestino) return 'Escolha para qual etapa mover.';
  if (f.acao === 'set_priority' && !f.prioridade) return 'Escolha a prioridade.';
  if (f.acao === 'move_to_stage' && f.evento === 'stage_entered' && f.etapaDestino === f.etapa) {
    return 'A regra moveria o card para a mesma etapa em que ele já entrou.';
  }
  return null;
}

/** Linha pronta para inserir em automation_rules (nasce desligada; quem liga é o admin). */
export function montarRegra(f: FormularioRegra) {
  const action_config: Record<string, string> =
    f.acao === 'notify' ? { to: f.destinatario, message: f.mensagem.trim() }
    : f.acao === 'move_to_stage' ? { stage: f.etapaDestino }
    : { priority: f.prioridade };
  return {
    name: f.nome.trim(),
    trigger_event: f.evento as EventoRegra,
    trigger_stage: f.evento === 'stage_entered' ? f.etapa : null,
    space_id: f.spaceId || null,
    action_type: f.acao as AcaoRegra,
    action_config,
    is_active: false,
  };
}

/**
 * Regras ligadas que mexem no mesmo card pelo mesmo motivo e levam para etapas diferentes: quem ganha é a
 * última a rodar, e isso surpreende. Devolve pares de ids para avisar na tela.
 */
export function conflitos(regras: RegraAutomatica[]): { a: string; b: string; motivo: string }[] {
  const ativas = regras.filter(r => r.is_active && r.action_type === 'move_to_stage');
  const saida: { a: string; b: string; motivo: string }[] = [];
  for (let i = 0; i < ativas.length; i++) {
    for (let j = i + 1; j < ativas.length; j++) {
      const x = ativas[i];
      const y = ativas[j];
      const mesmoGatilho = x.trigger_event === y.trigger_event && (x.trigger_stage ?? '') === (y.trigger_stage ?? '');
      const sobrepoe = !x.space_id || !y.space_id || x.space_id === y.space_id;
      if (mesmoGatilho && sobrepoe && x.action_config.stage !== y.action_config.stage) {
        saida.push({
          a: x.id,
          b: y.id,
          motivo: `mandam o mesmo card para etapas diferentes (${rotuloEtapa(x.action_config.stage)} e ${rotuloEtapa(y.action_config.stage)})`,
        });
      }
    }
  }
  return saida;
}

export const rotuloEvento = (e: string) => EVENTOS.find(x => x.valor === e)?.rotulo ?? e;
