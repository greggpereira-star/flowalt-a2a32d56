import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

/**
 * Medição automática da edição de um vídeo do Banco de Ideias (sem IA, sem custo por uso).
 *
 * Roda com a identidade de quem pediu (RLS). O arquivo de vídeo que a equipe subiu é enviado, por
 * link assinado, ao serviço da VPS (ffmpeg): duração, formato, cortes secos, ritmo, atividade
 * visual por segundo, silêncios e quadros-chave (guardados temporariamente na VPS).
 * Responde na hora (202); o resultado é gravado em idea_references.edit_metrics.
 */

const SERVICO = Deno.env.get('WHISPER_URL') ?? 'http://flowalt-whisper:8000';

const json = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const auth = req.headers.get('Authorization');
    if (!auth) return json({ error: 'Não autenticado' }, 401);

    const supa = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: auth } },
    });
    const { data: u } = await supa.auth.getUser();
    if (!u?.user) return json({ error: 'Sessão inválida' }, 401);

    const { reference_id } = await req.json();
    if (!reference_id) return json({ error: 'reference_id obrigatório' }, 400);

    const { data: ref } = await supa
      .from('idea_references')
      .select('id, type, media_url, file_url, file_name')
      .eq('id', reference_id)
      .maybeSingle();
    if (!ref) return json({ error: 'Referência não encontrada' }, 404);

    const url = ref.media_url || ref.file_url;
    const ehVideo = ref.type === 'video' || /\.(mp4|mov|m4v|webm|mkv|avi)$/i.test(ref.file_name ?? '');
    if (!url || !ehVideo) {
      return json({ error: 'Só dá para medir a edição de um vídeo enviado como arquivo. Links incorporados não têm o arquivo.' }, 400);
    }

    await supa.from('idea_references').update({ edit_metrics_status: 'processando', edit_metrics_error: null }).eq('id', ref.id);

    const trabalho = (async () => {
      try {
        const r = await fetch(`${SERVICO}/video/medir`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url, ref_id: ref.id }),
          signal: AbortSignal.timeout(20 * 60_000),
        });
        if (!r.ok) throw new Error(`Serviço de medição respondeu ${r.status}: ${(await r.text()).slice(0, 200)}`);
        const metricas = await r.json();
        await supa
          .from('idea_references')
          .update({ edit_metrics: metricas, edit_metrics_status: 'pronta', edit_metrics_error: null, edit_metrics_at: new Date().toISOString() })
          .eq('id', ref.id);
      } catch (e) {
        await supa
          .from('idea_references')
          .update({ edit_metrics_status: 'erro', edit_metrics_error: (e as Error).message.slice(0, 300) })
          .eq('id', ref.id);
      }
    })();

    // @ts-ignore EdgeRuntime existe no ambiente de funções do Supabase
    if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime.waitUntil) EdgeRuntime.waitUntil(trabalho);
    else await trabalho;

    return json({ status: 'processando' }, 202);
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
