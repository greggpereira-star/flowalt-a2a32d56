import { describe, expect, it } from 'vitest';
import { COLUNAS_DO_MONITOR, proximaAcao, diaDeSaoPaulo, entraNoPainel, montarPainelDoDia, prazoDe, responsaveisDoCard, type CardDoMonitor } from './demandasDoDia';

// 22/10/2026, 15:00 em Sao Paulo (18:00 UTC)
const AGORA = new Date('2026-10-22T18:00:00Z');

const card = (parcial: Partial<CardDoMonitor> & { id: string }): CardDoMonitor => ({
  status: 'todo',
  urgency: 'medium',
  due_date: null,
  completed_at: null,
  owner_id: null,
  title: parcial.id,
  ...parcial,
});

describe('diaDeSaoPaulo', () => {
  it('usa o dia de Sao Paulo, nao o de UTC', () => {
    // 01:30 UTC de 23/10 ainda e noite de 22/10 em Sao Paulo
    expect(diaDeSaoPaulo('2026-10-23T01:30:00Z')).toBe('2026-10-22');
    expect(diaDeSaoPaulo('2026-10-23T03:30:00Z')).toBe('2026-10-23');
  });
});

describe('prazoDe', () => {
  it('classifica atrasada, hoje, futuro e sem prazo', () => {
    expect(prazoDe({ due_date: '2026-10-22T14:00:00Z' }, AGORA)).toBe('atrasada'); // 11h de hoje, ja passou
    expect(prazoDe({ due_date: '2026-10-22T22:00:00Z' }, AGORA)).toBe('hoje'); // 19h de hoje
    expect(prazoDe({ due_date: '2026-10-25T12:00:00Z' }, AGORA)).toBe('futuro');
    expect(prazoDe({ due_date: null }, AGORA)).toBe('sem_prazo');
  });
});

describe('entraNoPainel', () => {
  it('entra: prazo hoje, atrasada e em andamento mesmo sem prazo', () => {
    expect(entraNoPainel(card({ id: 'a', due_date: '2026-10-22T22:00:00Z' }), AGORA)).toBe(true);
    expect(entraNoPainel(card({ id: 'b', due_date: '2026-10-20T12:00:00Z' }), AGORA)).toBe(true);
    expect(entraNoPainel(card({ id: 'c', status: 'in_progress' }), AGORA)).toBe(true);
    expect(entraNoPainel(card({ id: 'd', status: 'in_progress', due_date: '2026-11-30T12:00:00Z' }), AGORA)).toBe(true);
  });

  it('nao entra: prazo futuro ou sem prazo (fora de andamento), entregue, arquivada', () => {
    expect(entraNoPainel(card({ id: 'a', due_date: '2026-10-30T12:00:00Z' }), AGORA)).toBe(false);
    expect(entraNoPainel(card({ id: 'b' }), AGORA)).toBe(false);
    expect(entraNoPainel(card({ id: 'c', status: 'delivered', due_date: '2026-10-20T12:00:00Z' }), AGORA)).toBe(false);
    expect(entraNoPainel(card({ id: 'd', status: 'archived', due_date: '2026-10-20T12:00:00Z' }), AGORA)).toBe(false);
  });
});

describe('montarPainelDoDia', () => {
  const cards: CardDoMonitor[] = [
    card({ id: 'hoje-tarde', due_date: '2026-10-22T22:00:00Z', urgency: 'low' }),
    card({ id: 'atrasada-velha', due_date: '2026-10-19T12:00:00Z' }),
    card({ id: 'atrasada-recente', due_date: '2026-10-22T13:00:00Z' }),
    card({ id: 'andamento-sem-prazo', status: 'in_progress' }),
    card({ id: 'hoje-cedo-critica', due_date: '2026-10-22T19:00:00Z', urgency: 'critical' }),
    card({ id: 'revisao-hoje', status: 'review', due_date: '2026-10-22T21:00:00Z' }),
    card({ id: 'aprovacao-atrasada', status: 'approved', due_date: '2026-10-21T12:00:00Z' }),
    card({ id: 'futura', due_date: '2026-11-02T12:00:00Z' }),
    card({ id: 'feita-hoje', status: 'delivered', completed_at: '2026-10-22T16:00:00Z' }),
    card({ id: 'feita-ontem', status: 'delivered', completed_at: '2026-10-21T16:00:00Z' }),
    card({ id: 'arquivada', status: 'archived', due_date: '2026-10-20T12:00:00Z' }),
  ];

  it('distribui nas colunas e ordena: atrasadas, depois hoje pela hora, depois sem prazo', () => {
    const painel = montarPainelDoDia(cards, AGORA);
    const ids = (chave: string) => painel.colunas.find(c => c.chave === chave)!.itens.map(i => i.id);
    expect(ids('a_fazer')).toEqual(['atrasada-velha', 'atrasada-recente', 'hoje-cedo-critica', 'hoje-tarde']);
    expect(ids('em_producao')).toEqual(['andamento-sem-prazo']);
    expect(ids('revisao')).toEqual(['revisao-hoje']);
    expect(ids('aprovacao')).toEqual(['aprovacao-atrasada']);
    expect(painel.colunas.map(c => c.chave)).toEqual(COLUNAS_DO_MONITOR.map(c => c.chave));
  });

  it('conta pendentes, atrasadas e feitas hoje', () => {
    const { contagem } = montarPainelDoDia(cards, AGORA);
    expect(contagem).toEqual({
      pendentes: 7,
      atrasadas: 3,
      paraFazer: 6, // a fazer (4) + em producao (1) + revisao (1)
      atrasadasParaFazer: 2,
      emAprovacao: 1,
      atrasadasEmAprovacao: 1,
      feitasHoje: 1,
    });
  });

  it('filtra pelo responsavel: vinculado em card_members ou, sem vinculo, o owner_id; inclui as feitas hoje', () => {
    const lista = [
      card({ id: 'vinculada', status: 'in_progress' }),
      card({ id: 'por-owner', status: 'in_progress', owner_id: 'u1' }),
      card({ id: 'de-outro', status: 'in_progress', owner_id: 'u2' }),
      card({ id: 'vinculada-a-outro-mas-owner-meu', status: 'in_progress', owner_id: 'u1' }),
      card({ id: 'minha-feita', status: 'delivered', completed_at: '2026-10-22T16:00:00Z' }),
      card({ id: 'outro-feita', status: 'delivered', owner_id: 'u2', completed_at: '2026-10-22T16:00:00Z' }),
    ];
    const vinculos = new Map<string, string[]>([
      ['vinculada', ['u1', 'u3']],
      ['vinculada-a-outro-mas-owner-meu', ['u2']], // com vinculo, vale o vinculo e nao o owner_id
      ['minha-feita', ['u1']],
    ]);
    const painel = montarPainelDoDia(lista, AGORA, { usuario: 'u1', vinculos });
    expect(painel.colunas.flatMap(c => c.itens).map(i => i.id).sort()).toEqual(['por-owner', 'vinculada']);
    expect(painel.contagem.feitasHoje).toBe(1);
  });

  it('responsaveisDoCard: vinculo vence o owner_id e sem nenhum dos dois devolve vazio', () => {
    const vinculos = new Map([['a', ['u9']]]);
    expect(responsaveisDoCard({ id: 'a', owner_id: 'u1' }, vinculos)).toEqual(['u9']);
    expect(responsaveisDoCard({ id: 'b', owner_id: 'u1' }, vinculos)).toEqual(['u1']);
    expect(responsaveisDoCard({ id: 'c', owner_id: null }, vinculos)).toEqual([]);
  });

  it('sem nada para fazer, devolve colunas vazias e zeros', () => {
    const painel = montarPainelDoDia([], AGORA);
    expect(painel.colunas.every(c => c.itens.length === 0)).toBe(true);
    expect(painel.contagem).toEqual({ pendentes: 0, atrasadas: 0, paraFazer: 0, atrasadasParaFazer: 0, emAprovacao: 0, atrasadasEmAprovacao: 0, feitasHoje: 0 });
  });
});

describe('proximaAcao', () => {
  it('segue o fluxo uma etapa por vez e termina em entregar', () => {
    expect(proximaAcao('todo')).toEqual({ para: 'in_progress', rotulo: 'Iniciar' });
    expect(proximaAcao('in_progress')?.para).toBe('review');
    expect(proximaAcao('review')?.para).toBe('approved');
    expect(proximaAcao('approved')).toEqual({ para: 'delivered', rotulo: 'Entregar' });
    expect(proximaAcao('backlog')?.para).toBe('todo');
  });

  it('nunca propoe pular etapa para entregue, e nao ha acao para entregue ou arquivada', () => {
    ['backlog', 'briefing', 'todo', 'in_progress', 'review'].forEach(st => expect(proximaAcao(st)?.para).not.toBe('delivered'));
    expect(proximaAcao('delivered')).toBeNull();
    expect(proximaAcao('archived')).toBeNull();
  });
});

describe('contagem separada: o atraso na aprovacao nao infla o alarme de producao', () => {
  it('atrasadas na aprovacao ficam fora de "atrasadasParaFazer"', () => {
    const cards = [
      card({ id: 'p1', status: 'in_progress', due_date: '2026-10-21T12:00:00Z' }),
      card({ id: 'a1', status: 'approved', due_date: '2026-10-19T12:00:00Z' }),
      card({ id: 'a2', status: 'approved', due_date: '2026-10-20T12:00:00Z' }),
      card({ id: 'a3', status: 'approved', due_date: '2026-10-20T15:00:00Z' }),
    ];
    const { contagem } = montarPainelDoDia(cards, AGORA);
    expect(contagem.atrasadas).toBe(4); // total, como antes
    expect(contagem.atrasadasParaFazer).toBe(1);
    expect(contagem.atrasadasEmAprovacao).toBe(3);
    expect(contagem.paraFazer + contagem.emAprovacao).toBe(contagem.pendentes);
  });
});
