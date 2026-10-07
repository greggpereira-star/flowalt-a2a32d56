import { describe, it, expect } from 'vitest';
import { FORMULARIO_VAZIO, conflitos, descreverRegra, montarRegra, validarFormulario, type RegraAutomatica } from './regras';

const regra = (over: Partial<RegraAutomatica>): RegraAutomatica => ({
  id: 'r1', workspace_id: 'w', name: 'n', description: null, trigger_event: 'approval_changes_requested', trigger_stage: null,
  space_id: null, action_type: 'move_to_stage', action_config: { stage: 'em_producao' }, is_active: true, created_at: '2026-10-07', ...over,
});

describe('descreverRegra', () => {
  it('frase de cada evento e ação', () => {
    expect(descreverRegra(regra({}))).toEqual({ quando: 'o cliente pedir ajustes', entao: 'mover o card para Em Produção', onde: 'em todos os espaços' });
    expect(descreverRegra(regra({ trigger_event: 'stage_entered', trigger_stage: 'aprovacao', action_type: 'notify', action_config: { to: 'admins', message: 'x' }, space_id: 's' }), 'Social Media'))
      .toEqual({ quando: 'um card entrar na etapa Aprovação', entao: 'avisar a coordenação e os administradores', onde: 'só no espaço Social Media' });
    expect(descreverRegra(regra({ action_type: 'set_priority', action_config: { priority: 'critical' } })).entao).toBe('mudar a prioridade para Urgente');
  });
});

describe('validarFormulario', () => {
  const base = { ...FORMULARIO_VAZIO, nome: 'Minha regra', evento: 'approval_approved' as const, acao: 'notify' as const, destinatario: 'members' as const, mensagem: 'Oi {{card}}' };
  it('aceita um formulário completo', () => expect(validarFormulario(base)).toBeNull());
  it('pede cada campo que falta', () => {
    expect(validarFormulario({ ...base, nome: ' ' })).toMatch(/nome/);
    expect(validarFormulario({ ...base, evento: '' })).toMatch(/quando/);
    expect(validarFormulario({ ...base, evento: 'stage_entered' })).toMatch(/etapa/);
    expect(validarFormulario({ ...base, mensagem: '' })).toMatch(/mensagem/);
    expect(validarFormulario({ ...base, acao: 'move_to_stage' })).toMatch(/mover/);
    expect(validarFormulario({ ...base, acao: 'set_priority' })).toMatch(/prioridade/);
  });
  it('bloqueia mover para a mesma etapa do gatilho', () => {
    expect(validarFormulario({ ...base, evento: 'stage_entered', etapa: 'revisao', acao: 'move_to_stage', etapaDestino: 'revisao' })).toMatch(/mesma etapa/);
  });
});

describe('montarRegra', () => {
  it('nasce desligada e só leva a etapa quando o gatilho é de etapa', () => {
    const r = montarRegra({ ...FORMULARIO_VAZIO, nome: ' A ', evento: 'stage_entered', etapa: 'aprovacao', acao: 'notify', destinatario: 'admins', mensagem: ' m ' });
    expect(r).toMatchObject({ name: 'A', trigger_stage: 'aprovacao', space_id: null, is_active: false, action_config: { to: 'admins', message: 'm' } });
    expect(montarRegra({ ...FORMULARIO_VAZIO, nome: 'B', evento: 'approval_approved', acao: 'set_priority', prioridade: 'high' }).trigger_stage).toBeNull();
  });
});

describe('conflitos', () => {
  it('avisa quando duas regras ligadas mandam o mesmo card para etapas diferentes', () => {
    const a = regra({ id: 'a' });
    const b = regra({ id: 'b', action_config: { stage: 'revisao' } });
    expect(conflitos([a, b])).toHaveLength(1);
  });
  it('não avisa se estão em espaços diferentes, se uma está desligada ou se vão para a mesma etapa', () => {
    expect(conflitos([regra({ id: 'a', space_id: 's1' }), regra({ id: 'b', space_id: 's2', action_config: { stage: 'revisao' } })])).toEqual([]);
    expect(conflitos([regra({ id: 'a' }), regra({ id: 'b', is_active: false, action_config: { stage: 'revisao' } })])).toEqual([]);
    expect(conflitos([regra({ id: 'a' }), regra({ id: 'b' })])).toEqual([]);
  });
});
