import { describe, it, expect } from 'vitest';
import { AGENDA, estaDevido, montarResumos, proximoLimiar, type Entrada } from '../../../supabase/functions/lembretes-diarios/regras';

const agora = new Date('2026-10-20T12:00:00Z');
const dia = (n: number) => new Date(agora.getTime() - n * 86_400_000).toISOString();
const horas = (h: number) => new Date(agora.getTime() + h * 3_600_000).toISOString();

const base = (over: Partial<Entrada> = {}): Entrada => ({
  agora, cards: [], vinculos: [], aprovacoes: [], admins: [], ativos: new Set(['ana', 'bia', 'chefe']), enviados: [], semAvisoDeCards: new Set(), jaHoje: new Set(), ...over,
});
const card = (id: string, due_date: string) => ({ id, title: `Card ${id}`, due_date, space_id: null });

describe('degraus da agenda', () => {
  it('atrasado: 1, 2, 4, 7 e depois a cada 7 dias', () => {
    expect([0, 1, 2, 3, 4, 5].map(n => proximoLimiar('atrasado', n))).toEqual([1, 2, 4, 7, 14, 21]);
    expect(AGENDA.aprovacao_parada.limiares).toEqual([3, 6, 10]);
  });
  it('perder um dia não perde o lembrete: devido assim que passa do degrau', () => {
    expect(estaDevido('atrasado', 3, 2)).toBe(false); // próximo é 4
    expect(estaDevido('atrasado', 5, 2)).toBe(true); // a rotina não rodou no dia 4 (fim de semana)
  });
});

describe('resumo pessoal', () => {
  const cards = [card('a', dia(1)), card('b', dia(5)), card('c', horas(20))];
  const vinculos = ['a', 'b', 'c'].map(c => ({ card_id: c, user_id: 'ana' }));

  it('junta tudo numa notificação só, com a razão em números', () => {
    const { resumos, registrar } = montarResumos(base({ cards, vinculos }));
    expect(resumos).toHaveLength(1);
    expect(resumos[0]).toMatchObject({ user_id: 'ana', escopo: 'pessoal', titulo: 'Seu resumo do dia' });
    expect(resumos[0].mensagem).toBe('2 cards atrasados (o mais antigo há 5 d) · 1 card vence em breve');
    expect(registrar).toHaveLength(3);
  });
  it('não repete o card enquanto não chega o próximo degrau', () => {
    const enviados = [{ card_id: 'b', user_id: 'ana', tipo: 'atrasado' as const, enviado_em: dia(1) }, { card_id: 'b', user_id: 'ana', tipo: 'atrasado' as const, enviado_em: dia(3) }];
    // b tem 5 dias, já recebeu 2 lembretes -> próximo degrau é 4 -> devido; com 3 enviados o próximo é 7 -> não
    expect(montarResumos(base({ cards: [card('b', dia(5))], vinculos, enviados })).resumos).toHaveLength(1);
    const tres = [...enviados, { card_id: 'b', user_id: 'ana', tipo: 'atrasado' as const, enviado_em: dia(0) }];
    expect(montarResumos(base({ cards: [card('b', dia(5))], vinculos, enviados: tres })).resumos).toHaveLength(0);
  });
  it('vence em breve só uma vez por prazo', () => {
    const c = [card('c', horas(20))];
    const v = [{ card_id: 'c', user_id: 'ana' }];
    expect(montarResumos(base({ cards: c, vinculos: v })).resumos).toHaveLength(1);
    const enviados = [{ card_id: 'c', user_id: 'ana', tipo: 'vence_em_breve' as const, enviado_em: dia(0) }];
    expect(montarResumos(base({ cards: c, vinculos: v, enviados })).resumos).toHaveLength(0);
  });
  it('prazo remarcado recomeça a contagem', () => {
    // lembretes antigos, de antes do prazo atual, não contam
    const enviados = [1, 2, 3, 4].map(() => ({ card_id: 'a', user_id: 'ana', tipo: 'atrasado' as const, enviado_em: dia(30) }));
    expect(montarResumos(base({ cards: [card('a', dia(1))], vinculos, enviados })).resumos).toHaveLength(1);
  });
  it('card sem prazo vencendo longe e nada a dizer não gera notificação', () => {
    expect(montarResumos(base({ cards: [card('x', horas(100))], vinculos: [{ card_id: 'x', user_id: 'ana' }] })).resumos).toEqual([]);
  });
  it('um resumo por dia: quem já recebeu hoje não recebe de novo', () => {
    expect(montarResumos(base({ cards, vinculos, jaHoje: new Set(['ana:pessoal']) })).resumos).toEqual([]);
  });
  it('respeita quem desligou avisos de cards e ignora membros inativos', () => {
    expect(montarResumos(base({ cards, vinculos, semAvisoDeCards: new Set(['ana']) })).resumos).toEqual([]);
    expect(montarResumos(base({ cards, vinculos, ativos: new Set(['chefe']) })).resumos).toEqual([]);
  });
  it('aprovação parada chega a quem enviou, em degraus a partir de 3 dias', () => {
    const aprov = (d: number) => [{ card_id: 'p', title: 'Peça', requested_by: 'bia', created_at: dia(d) }];
    expect(montarResumos(base({ aprovacoes: aprov(2) })).resumos).toEqual([]);
    const r = montarResumos(base({ aprovacoes: aprov(4) })).resumos;
    expect(r[0]).toMatchObject({ user_id: 'bia' });
    expect(r[0].mensagem).toBe('1 aprovação aguardando o cliente (há 4 d)');
  });
});

describe('escalada para a coordenação', () => {
  it('avisa atraso de 7 dias ou mais e card atrasado sem responsável, mas não o que é do próprio admin', () => {
    const cards = [card('velho', dia(8)), card('orfao', dia(2)), card('do-chefe', dia(9)), card('novo', dia(2))];
    const vinculos = [
      { card_id: 'velho', user_id: 'ana' }, { card_id: 'do-chefe', user_id: 'chefe' }, { card_id: 'novo', user_id: 'ana' },
    ];
    const { resumos } = montarResumos(base({ cards, vinculos, admins: ['chefe'] }));
    const equipe = resumos.find(r => r.escopo === 'equipe')!;
    expect(equipe.user_id).toBe('chefe');
    expect(equipe.itens.map(i => [i.card_id, i.tipo])).toEqual([['velho', 'escala_equipe'], ['orfao', 'sem_responsavel']]);
    expect(equipe.mensagem).toBe('1 card da equipe atrasado há 7 d ou mais · 1 card atrasado sem responsável');
  });
  it('responsável que saiu da equipe conta como card sem responsável', () => {
    const { resumos } = montarResumos(base({ cards: [card('o', dia(3))], vinculos: [{ card_id: 'o', user_id: 'ex' }], admins: ['chefe'] }));
    expect(resumos.find(r => r.escopo === 'equipe')?.itens[0].tipo).toBe('sem_responsavel');
  });
  it('sem nada grave, a coordenação não recebe nada', () => {
    expect(montarResumos(base({ cards: [card('a', dia(2))], vinculos: [{ card_id: 'a', user_id: 'ana' }], admins: ['chefe'] })).resumos.some(r => r.escopo === 'equipe')).toBe(false);
  });
});
