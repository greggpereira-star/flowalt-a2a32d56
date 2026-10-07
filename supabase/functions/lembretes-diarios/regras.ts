// Lembretes inteligentes (Onda 6): regras puras do resumo diário. Sem Deno, sem banco: recebe os dados já lidos
// e devolve o que deve ser avisado e o que deve ser registrado. Fica ao lado da função para ser copiada junto.
//
// Ideia central: UMA notificação por pessoa por dia (e só se houver o que dizer), em vez de uma por card. Cada card
// atrasado é lembrado em degraus (1, 2, 4 e 7 dias, depois a cada 7), nunca todo dia; a coordenação só é avisada
// quando o atraso passa de 7 dias ou o card não tem ninguém responsável.

export type TipoLembrete = 'atrasado' | 'vence_em_breve' | 'aprovacao_parada' | 'escala_equipe' | 'sem_responsavel';

export const DIA_MS = 86_400_000;
export const HORA_MS = 3_600_000;

/** Dias necessários para o 1º, 2º... lembrete; depois do último degrau, repete a cada `passo` dias. */
export const AGENDA: Record<Exclude<TipoLembrete, 'vence_em_breve'>, { limiares: number[]; passo: number }> = {
  atrasado: { limiares: [1, 2, 4, 7], passo: 7 },
  aprovacao_parada: { limiares: [3, 6, 10], passo: 7 },
  escala_equipe: { limiares: [7, 14], passo: 14 },
  sem_responsavel: { limiares: [1, 4, 7], passo: 7 },
};
/** "Vence em breve" = prazo nas próximas 36 horas, lembrado uma vez só por prazo. */
export const JANELA_VENCE_EM_BREVE_H = 36;
export const MAX_ITENS_NA_NOTIFICACAO = 8;

export interface CardAberto {
  id: string;
  title: string;
  due_date: string;
  space_id: string | null;
}
export interface Vinculo { card_id: string; user_id: string }
export interface AprovacaoPendente { card_id: string; title: string; requested_by: string; created_at: string }
export interface Enviado { card_id: string; user_id: string; tipo: TipoLembrete; enviado_em: string }

export interface Entrada {
  agora: Date;
  cards: CardAberto[];
  vinculos: Vinculo[];
  aprovacoes: AprovacaoPendente[];
  /** coordenação e administradores */
  admins: string[];
  /** membros ativos do workspace: só eles recebem */
  ativos: Set<string>;
  enviados: Enviado[];
  /** quem desligou as notificações de cards (user_notification_preferences.notify_cards = false) */
  semAvisoDeCards: Set<string>;
  /** chaves "usuario:escopo" que já receberam resumo hoje (garante um por dia, mesmo que a rotina rode duas vezes) */
  jaHoje: Set<string>;
}

export interface Item { card_id: string; titulo: string; tipo: TipoLembrete; dias: number }
export interface Resumo { user_id: string; escopo: 'pessoal' | 'equipe'; titulo: string; mensagem: string; itens: Item[] }
export interface Registro { user_id: string; card_id: string; tipo: TipoLembrete; dias: number }

export function proximoLimiar(tipo: keyof typeof AGENDA, jaEnviados: number): number {
  const { limiares, passo } = AGENDA[tipo];
  if (jaEnviados < limiares.length) return limiares[jaEnviados];
  return limiares[limiares.length - 1] + passo * (jaEnviados - limiares.length + 1);
}
export const estaDevido = (tipo: keyof typeof AGENDA, dias: number, jaEnviados: number) => dias >= proximoLimiar(tipo, jaEnviados);

export const diasEntre = (de: string | Date, ate: Date) => Math.floor((ate.getTime() - new Date(de).getTime()) / DIA_MS);

/** Quantos lembretes deste tipo já saíram para (card, pessoa) desde `desde`. Um novo prazo recomeça a contagem. */
function contar(enviados: Enviado[], cardId: string, userId: string, tipo: TipoLembrete, desde: Date): number {
  return enviados.filter(e => e.card_id === cardId && e.user_id === userId && e.tipo === tipo && new Date(e.enviado_em) >= desde).length;
}

const plural = (n: number, s: string, p: string) => `${n} ${n === 1 ? s : p}`;

function mensagem(itens: Item[]): string {
  const por = (t: TipoLembrete) => itens.filter(i => i.tipo === t);
  const maior = (xs: Item[]) => Math.max(...xs.map(i => i.dias));
  const partes: string[] = [];
  const a = por('atrasado');
  if (a.length) partes.push(`${plural(a.length, 'card atrasado', 'cards atrasados')} (o mais antigo há ${maior(a)} d)`);
  const v = por('vence_em_breve');
  if (v.length) partes.push(`${plural(v.length, 'card vence', 'cards vencem')} em breve`);
  const p = por('aprovacao_parada');
  if (p.length) partes.push(`${plural(p.length, 'aprovação aguardando', 'aprovações aguardando')} o cliente (há ${maior(p)} d)`);
  const e = por('escala_equipe');
  if (e.length) partes.push(`${plural(e.length, 'card da equipe atrasado', 'cards da equipe atrasados')} há 7 d ou mais`);
  const s = por('sem_responsavel');
  if (s.length) partes.push(`${plural(s.length, 'card atrasado', 'cards atrasados')} sem responsável`);
  return partes.join(' · ');
}

const ordem: Record<TipoLembrete, number> = { atrasado: 0, escala_equipe: 1, sem_responsavel: 2, aprovacao_parada: 3, vence_em_breve: 4 };

export function montarResumos(e: Entrada): { resumos: Resumo[]; registrar: Registro[] } {
  const resumos: Resumo[] = [];
  const registrar: Registro[] = [];

  const donos = new Map<string, Set<string>>(); // card -> responsáveis ativos
  for (const v of e.vinculos) {
    if (!e.ativos.has(v.user_id)) continue;
    if (!donos.has(v.card_id)) donos.set(v.card_id, new Set());
    donos.get(v.card_id)!.add(v.user_id);
  }

  // ---- resumo pessoal
  const pessoas = new Set<string>();
  donos.forEach(set => set.forEach(u => pessoas.add(u)));
  e.aprovacoes.forEach(a => e.ativos.has(a.requested_by) && pessoas.add(a.requested_by));

  for (const user of pessoas) {
    if (e.semAvisoDeCards.has(user) || e.jaHoje.has(`${user}:pessoal`)) continue;
    const itens: Item[] = [];

    for (const c of e.cards) {
      if (!donos.get(c.id)?.has(user)) continue;
      const prazo = new Date(c.due_date);
      const dias = diasEntre(prazo, e.agora);
      if (dias >= 1) {
        if (estaDevido('atrasado', dias, contar(e.enviados, c.id, user, 'atrasado', prazo))) {
          itens.push({ card_id: c.id, titulo: c.title, tipo: 'atrasado', dias });
        }
      } else {
        const horas = (prazo.getTime() - e.agora.getTime()) / HORA_MS;
        const desde = new Date(prazo.getTime() - 3 * DIA_MS);
        if (horas > 0 && horas <= JANELA_VENCE_EM_BREVE_H && contar(e.enviados, c.id, user, 'vence_em_breve', desde) === 0) {
          itens.push({ card_id: c.id, titulo: c.title, tipo: 'vence_em_breve', dias: Math.ceil(horas / 24) });
        }
      }
    }
    for (const a of e.aprovacoes) {
      if (a.requested_by !== user) continue;
      const dias = diasEntre(a.created_at, e.agora);
      if (dias >= AGENDA.aprovacao_parada.limiares[0] && estaDevido('aprovacao_parada', dias, contar(e.enviados, a.card_id, user, 'aprovacao_parada', new Date(a.created_at)))) {
        itens.push({ card_id: a.card_id, titulo: a.title, tipo: 'aprovacao_parada', dias });
      }
    }
    if (itens.length === 0) continue;
    itens.sort((x, y) => ordem[x.tipo] - ordem[y.tipo] || y.dias - x.dias);
    resumos.push({ user_id: user, escopo: 'pessoal', titulo: 'Seu resumo do dia', mensagem: mensagem(itens), itens: itens.slice(0, MAX_ITENS_NA_NOTIFICACAO) });
    itens.forEach(i => registrar.push({ user_id: user, card_id: i.card_id, tipo: i.tipo, dias: i.dias }));
  }

  // ---- escalada para a coordenação
  for (const admin of new Set(e.admins)) {
    if (!e.ativos.has(admin) || e.semAvisoDeCards.has(admin) || e.jaHoje.has(`${admin}:equipe`)) continue;
    const itens: Item[] = [];
    for (const c of e.cards) {
      const prazo = new Date(c.due_date);
      const dias = diasEntre(prazo, e.agora);
      if (dias < 1) continue;
      const responsaveis = donos.get(c.id);
      if (!responsaveis || responsaveis.size === 0) {
        if (estaDevido('sem_responsavel', dias, contar(e.enviados, c.id, admin, 'sem_responsavel', prazo))) {
          itens.push({ card_id: c.id, titulo: c.title, tipo: 'sem_responsavel', dias });
        }
      } else if (dias >= AGENDA.escala_equipe.limiares[0] && !responsaveis.has(admin)) {
        if (estaDevido('escala_equipe', dias, contar(e.enviados, c.id, admin, 'escala_equipe', prazo))) {
          itens.push({ card_id: c.id, titulo: c.title, tipo: 'escala_equipe', dias });
        }
      }
    }
    if (itens.length === 0) continue;
    itens.sort((x, y) => ordem[x.tipo] - ordem[y.tipo] || y.dias - x.dias);
    resumos.push({ user_id: admin, escopo: 'equipe', titulo: 'Resumo da equipe', mensagem: mensagem(itens), itens: itens.slice(0, MAX_ITENS_NA_NOTIFICACAO) });
    itens.forEach(i => registrar.push({ user_id: admin, card_id: i.card_id, tipo: i.tipo, dias: i.dias }));
  }

  return { resumos, registrar };
}
