import { describe, expect, it } from 'vitest';
import { atividadeParada, descricaoDaAtividade, diasSemAtividade, rotuloAtividade, tempoCurto } from './atividade';

const agora = new Date('2026-10-08T15:00:00');
const atras = (ms: number) => new Date(agora.getTime() - ms).toISOString();
const MIN = 60_000, H = 60 * MIN, D = 24 * H;

describe('tempoCurto', () => {
  it('menos de 1 minuto é agora', () => expect(tempoCurto(atras(30_000), agora)).toBe('agora'));
  it('minutos', () => expect(tempoCurto(atras(5 * MIN), agora)).toBe('5 min'));
  it('horas', () => expect(tempoCurto(atras(2 * H + 10 * MIN), agora)).toBe('2 h'));
  it('dias', () => expect(tempoCurto(atras(3 * D), agora)).toBe('3 d'));
  it('semanas', () => expect(tempoCurto(atras(15 * D), agora)).toBe('2 sem'));
  it('meses', () => expect(tempoCurto(atras(95 * D), agora)).toBe('3 mês'));
  it('anos', () => expect(tempoCurto(atras(400 * D), agora)).toBe('1 a'));
  it('data no futuro (relógio adiantado) vira agora, nunca negativo', () => expect(tempoCurto(atras(-5 * MIN), agora)).toBe('agora'));
});

describe('rotuloAtividade e descrição', () => {
  it('agora não leva "há"', () => expect(rotuloAtividade(atras(1000), agora)).toBe('agora'));
  it('com prefixo', () => expect(rotuloAtividade(atras(2 * H), agora)).toBe('há 2 h'));
  it('descrição completa com autor', () => {
    expect(descricaoDaAtividade(new Date('2026-10-08T13:04:00').toISOString(), 'Brendon', agora)).toBe('Atualizado há 1 h por Brendon · 08/10 às 13:04');
  });
  it('sem autor, só o tempo', () => {
    expect(descricaoDaAtividade(new Date('2026-10-08T13:04:00').toISOString(), null, agora)).toBe('Atualizado há 1 h · 08/10 às 13:04');
  });
});

describe('atividadeParada', () => {
  it('card aberto há 7 dias ou mais está parado', () => expect(atividadeParada({ status: 'in_progress', last_activity_at: atras(7 * D) }, agora)).toBe(true));
  it('6 dias ainda não', () => expect(atividadeParada({ status: 'in_progress', last_activity_at: atras(6 * D) }, agora)).toBe(false));
  it('entregue nunca fica parado', () => expect(atividadeParada({ status: 'delivered', last_activity_at: atras(90 * D) }, agora)).toBe(false));
  it('sem data não acusa nada', () => expect(atividadeParada({ status: 'todo', last_activity_at: null }, agora)).toBe(false));
  it('dias sem atividade', () => expect(diasSemAtividade(atras(9 * D + H), agora)).toBe(9));
});
