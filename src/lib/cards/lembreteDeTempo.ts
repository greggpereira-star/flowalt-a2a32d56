import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

// Entregar um card sem nenhum tempo registrado deixa o Dashboard sem horas e sem o tempo real da demanda.
// O lembrete aparece no máximo UMA vez por dia por navegador (e uma vez só mesmo que se entreguem vários em lote).
export const CHAVE_LEMBRETE_TEMPO = 'flowalt_lembrete_tempo';

export async function lembrarDeTempo(cardId: string): Promise<boolean> {
  const hoje = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
  try {
    if (localStorage.getItem(CHAVE_LEMBRETE_TEMPO) === hoje) return false;
    // marca antes de consultar: entregas em lote disparam várias chamadas ao mesmo tempo
    localStorage.setItem(CHAVE_LEMBRETE_TEMPO, hoje);
  } catch {
    /* sem armazenamento: o lembrete pode repetir, mas não quebra nada */
  }
  const { count, error } = await supabase
    .from('time_entries')
    .select('id', { count: 'exact', head: true })
    .eq('card_id', cardId);
  if (error || (count ?? 0) > 0) return false;
  toast.info('Card entregue sem tempo registrado', {
    description: 'Ligue o cronômetro dentro dos próximos cards: é com ele que o Dashboard mostra suas horas e o tempo real de cada demanda.',
    duration: 9000,
  });
  return true;
}
