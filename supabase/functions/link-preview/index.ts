import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

/**
 * Pré-visualização de links do Banco de Ideias.
 *
 * Links comuns: lê as tags og:/twitter:/title do HTML, como sempre foi.
 * TikTok, Instagram e YouTube: usam a oEmbed oficial de cada plataforma. A página deles não
 * serve para isso (o TikTok devolve um título genérico e nenhuma imagem). Nada é baixado: só
 * título, autor e miniatura, e o vídeo é exibido depois por incorporação (iframe oficial).
 */

interface Preview {
  title?: string;
  description?: string;
  image?: string;
  domain?: string;
  url: string;
  platform?: 'tiktok' | 'instagram' | 'youtube';
  external_id?: string;
  author_name?: string;
  author_url?: string;
  /** Miniatura em base64, para o cliente guardar no nosso armazenamento (o endereço da rede expira). */
  image_base64?: string;
  image_type?: string;
}

const UA = 'Mozilla/5.0 (compatible; FlowAlt-LinkPreview/1.0)';
const LIMITE_IMAGEM = 2_000_000;

function meta(html: string, regex: RegExp): string | undefined {
  const m = html.match(regex);
  return m?.[1]?.trim();
}

function plataformaDe(host: string): Preview['platform'] | undefined {
  const h = host.replace(/^www\./, '').toLowerCase();
  if (h === 'tiktok.com' || h.endsWith('.tiktok.com')) return 'tiktok';
  if (h === 'instagram.com' || h.endsWith('.instagram.com') || h === 'instagr.am') return 'instagram';
  if (h === 'youtube.com' || h.endsWith('.youtube.com') || h === 'youtu.be') return 'youtube';
  return undefined;
}

async function imagemEmBase64(url: string): Promise<{ b64: string; type: string } | null> {
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(8000) });
    if (!r.ok) return null;
    const type = r.headers.get('content-type') || 'image/jpeg';
    if (!type.startsWith('image/')) return null;
    const buf = new Uint8Array(await r.arrayBuffer());
    if (buf.length === 0 || buf.length > LIMITE_IMAGEM) return null;
    let bin = '';
    for (let i = 0; i < buf.length; i += 0x8000) {
      bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    }
    return { b64: btoa(bin), type };
  } catch {
    return null;
  }
}

async function oembed(plataforma: NonNullable<Preview['platform']>, url: string): Promise<Record<string, any> | null> {
  const endpoint =
    plataforma === 'tiktok'
      ? `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`
      : plataforma === 'instagram'
        ? `https://graph.facebook.com/v21.0/instagram_oembed?url=${encodeURIComponent(url)}`
        : `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}`;
  // A oEmbed do TikTok falha de forma intermitente (503 ou conexão caída, cerca de metade das
  // chamadas em teste), então tenta de novo antes de desistir. Erros definitivos (404/400) não repetem.
  for (let tentativa = 0; tentativa < 4; tentativa++) {
    try {
      const r = await fetch(endpoint, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(8000) });
      if (r.ok) return await r.json();
      if (r.status === 400 || r.status === 404) return null;
    } catch {
      /* tenta de novo */
    }
    await new Promise((res) => setTimeout(res, 700 * (tentativa + 1)));
  }
  return null;
}

function idDoYoutube(u: URL): string | undefined {
  if (u.hostname.includes('youtu.be')) return u.pathname.split('/').filter(Boolean)[0];
  const v = u.searchParams.get('v');
  if (v) return v;
  const m = u.pathname.match(/\/(?:shorts|embed|live)\/([\w-]{6,})/);
  return m?.[1];
}

async function previewDeRede(plataforma: NonNullable<Preview['platform']>, entrada: string): Promise<Preview> {
  let url = entrada;

  // Links curtos do TikTok (vm./vt./tiktok.com/t/) precisam ser resolvidos para achar o vídeo.
  if (plataforma === 'tiktok' && /^(vm|vt)\.tiktok\.com$|\/t\//i.test(new URL(url).hostname + new URL(url).pathname)) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow', signal: AbortSignal.timeout(8000) });
      if (r.url) url = r.url.split('?')[0];
    } catch { /* segue com o link original */ }
  }

  const parsed = new URL(url);
  const out: Preview = { url, domain: parsed.hostname.replace(/^www\./, ''), platform: plataforma };

  const data = await oembed(plataforma, url);
  if (data) {
    out.title = (data.title as string | undefined)?.trim() || undefined;
    out.author_name = (data.author_name as string | undefined)?.trim() || undefined;
    out.author_url = (data.author_url as string | undefined) || undefined;
    out.image = (data.thumbnail_url as string | undefined) || undefined;
    if (plataforma === 'tiktok') {
      out.external_id = (data.html as string | undefined)?.match(/data-video-id="(\d+)"/)?.[1]
        ?? url.match(/\/video\/(\d+)/)?.[1];
    }
  } else if (plataforma === 'tiktok') {
    out.external_id = url.match(/\/video\/(\d+)/)?.[1];
  }

  if (plataforma === 'youtube') out.external_id = idDoYoutube(parsed);
  if (plataforma === 'instagram') out.external_id = parsed.pathname.match(/\/(?:p|reel|reels|tv)\/([\w-]+)/)?.[1];

  // YouTube tem miniatura estável pelo id, mesmo que a oEmbed falhe.
  if (!out.image && plataforma === 'youtube' && out.external_id) {
    out.image = `https://i.ytimg.com/vi/${out.external_id}/hqdefault.jpg`;
  }

  if (out.image) {
    const img = await imagemEmBase64(out.image);
    if (img) {
      out.image_base64 = img.b64;
      out.image_type = img.type;
    }
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { url } = await req.json();
    if (!url || typeof url !== 'string') {
      return new Response(JSON.stringify({ error: 'url required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const parsed = new URL(url);
    const rede = plataformaDe(parsed.hostname);
    if (rede) {
      const preview = await previewDeRede(rede, url);
      return new Response(JSON.stringify(preview), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const res = await fetch(url, {
      headers: {
        'User-Agent': UA,
        Accept: 'text/html,application/xhtml+xml',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(8000),
    });
    const html = (await res.text()).slice(0, 200_000);

    const preview: Preview = {
      url,
      domain: parsed.hostname.replace(/^www\./, ''),
      title:
        meta(html, /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) ||
        meta(html, /<meta[^>]+name=["']twitter:title["'][^>]+content=["']([^"']+)["']/i) ||
        meta(html, /<title>([^<]+)<\/title>/i),
      description:
        meta(html, /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i) ||
        meta(html, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i),
      image:
        meta(html, /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
        meta(html, /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i),
    };

    if (preview.image && preview.image.startsWith('/')) {
      preview.image = `${parsed.origin}${preview.image}`;
    }

    return new Response(JSON.stringify(preview), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
