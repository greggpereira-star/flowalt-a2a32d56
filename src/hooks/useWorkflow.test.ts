import { describe, expect, it, vi } from 'vitest';

// useWorkflow importa o cliente do Supabase (que exige variaveis de ambiente); a regra testada aqui e pura.
vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));

import { validateTransition } from './useWorkflow';

const etapa = (id: string, slug: string, extra: Record<string, unknown> = {}) => ({
  id, slug, name: slug, requires_briefing: false, requires_checklist: false, min_checklist_progress: 0, requires_no_dependencies: false, ...extra,
});
const transicao = (de: string, para: string, extra: Record<string, unknown> = {}) => ({
  from_stage_id: de, to_stage_id: para, is_allowed: true, allowed_roles: [], is_backward: false, requires_reason: false, ...extra,
});

const stages: any[] = [etapa('a', 'planejamento'), etapa('b', 'em_producao', { requires_briefing: true }), etapa('c', 'revisao', { requires_briefing: true, requires_checklist: true, min_checklist_progress: 100 })];
const transitions: any[] = [transicao('a', 'b'), transicao('b', 'c'), transicao('a', 'c', { is_allowed: false })];
const base = { cardId: 'x', workflowId: 'w', stages, transitions, briefingCompleted: false, checklistProgress: 100, hasActiveDependencies: false, userRole: 'member' };

describe('validateTransition: gate de briefing virou aviso', () => {
  it('membro move para etapa que exige briefing mesmo sem briefing: permitido, com aviso', async () => {
    const r = await validateTransition({ ...base, fromStage: 'planejamento', toStage: 'em_producao' } as any);
    expect(r.allowed).toBe(true);
    expect(r.failedGates).toEqual([]);
    expect(r.warnings?.map(w => w.gate)).toEqual(['briefing_completed']);
    // o briefing ausente NAO entra nos gates "passados" (vai para gates_failed no historico)
    expect(r.gates.map(g => g.gate)).not.toContain('briefing_completed');
  });

  it('com briefing completo: permitido, sem aviso, e o gate consta como passado', async () => {
    const r = await validateTransition({ ...base, briefingCompleted: true, fromStage: 'planejamento', toStage: 'em_producao' } as any);
    expect(r.allowed).toBe(true);
    expect(r.warnings).toEqual([]);
    expect(r.gates.map(g => g.gate)).toContain('briefing_completed');
  });

  it('cargos que antes eram dispensados tambem recebem o aviso (o card fica marcado para todos)', async () => {
    for (const userRole of ['owner', 'admin', 'coordinator']) {
      const r = await validateTransition({ ...base, userRole, fromStage: 'planejamento', toStage: 'em_producao' } as any);
      expect(r.allowed).toBe(true);
      expect(r.warnings?.map(w => w.gate)).toEqual(['briefing_completed']);
    }
  });

  it('etapa que nao exige briefing nao gera aviso', async () => {
    const r = await validateTransition({ ...base, fromStage: 'planejamento', toStage: 'planejamento' } as any);
    expect(r.warnings).toEqual([]);
  });

  it('as OUTRAS regras continuam bloqueando: checklist incompleto', async () => {
    const r = await validateTransition({ ...base, checklistProgress: 40, fromStage: 'em_producao', toStage: 'revisao' } as any);
    expect(r.allowed).toBe(false);
    expect(r.failedGates.map(g => g.gate)).toEqual(['checklist_progress']);
    expect(r.warnings?.map(w => w.gate)).toEqual(['briefing_completed']);
  });

  it('transicao nao permitida pelo fluxo continua bloqueada', async () => {
    const r = await validateTransition({ ...base, fromStage: 'planejamento', toStage: 'revisao' } as any);
    expect(r.allowed).toBe(false);
    expect(r.failedGates.map(g => g.gate)).toContain('transition_allowed');
  });

  it('dependencias ativas continuam bloqueando', async () => {
    const comDep: any[] = [etapa('a', 'planejamento'), etapa('b', 'em_producao', { requires_briefing: true, requires_no_dependencies: true })];
    const r = await validateTransition({ ...base, stages: comDep, transitions: [transicao('a', 'b')], hasActiveDependencies: true, fromStage: 'planejamento', toStage: 'em_producao' } as any);
    expect(r.allowed).toBe(false);
    expect(r.failedGates.map(g => g.gate)).toEqual(['no_dependencies']);
  });
});
