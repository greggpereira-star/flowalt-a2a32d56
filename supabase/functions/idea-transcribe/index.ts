import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

/**
 * Transcrição de uma referência do Banco de Ideias.
 *
 * Roda com a identidade de quem pediu (RLS): só transcreve referências que a pessoa já enxerga.
 * O arquivo (vídeo ou áudio que a própria equipe subiu) é enviado, por link assinado, ao serviço
 * de transcrição da VPS (faster-whisper, rede interna do Docker). Nada é baixado de redes sociais.
 * A resposta é imediata (202); o trabalho continua em segundo plano e o resultado é gravado na
 * própria referência (transcript_status: processando → pronta | erro). A tela consulta até terminar.
 */

const WHISPER = Deno.env.get('WHISPER_URL') ?? 'http://flowalt-whisper:8000';

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

    const { data: ref, error } = await supa
      .from('idea_references')
      .select('id, type, media_url, file_url, file_name')
      .eq('id', reference_id)
      .maybeSingle();
    if (error || !ref) return json({ error: 'Referência não encontrada' }, 404);

    const url = ref.media_url || ref.file_url;
    const ehMidia = ref.type === 'video' || /\.(mp4|mov|m4a|mp3|wav|webm|ogg|aac|mkv)$/i.test(ref.file_name ?? '');
    if (!url || !ehMidia) {
      return json({ error: 'Esta referência não tem um arquivo de vídeo ou áudio para transcrever. Cole a transcrição à mão ou envie o arquivo.' }, 400);
    }

    await supa.from('idea_references').update({ transcript_status: 'processando', transcript_error: null }).eq('id', ref.id);

    const trabalho = (async () => {
      try {
        const r = await fetch(`${WHISPER}/transcribe`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url, language: 'pt' }),
          signal: AbortSignal.timeout(25 * 60_000),
        });
        if (!r.ok) throw new Error(`Serviço de transcrição respondeu ${r.status}: ${(await r.text()).slice(0, 200)}`);
        const d = await r.json();
        const texto = (d.text ?? '').trim();
        if (!texto) throw new Error('Não encontrei fala no áudio.');
        await supa
          .from('idea_references')
          .update({ transcript: texto, transcript_status: 'pronta', transcript_source: 'arquivo', transcript_error: null })
          .eq('id', ref.id);
      } catch (e) {
        await supa
          .from('idea_references')
          .update({ transcript_status: 'erro', transcript_error: (e as Error).message.slice(0, 300) })
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
