import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

interface Preview {
  title?: string;
  description?: string;
  image?: string;
  domain?: string;
  url: string;
}

function meta(html: string, regex: RegExp): string | undefined {
  const m = html.match(regex);
  return m?.[1]?.trim();
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
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; FlowAlt-LinkPreview/1.0)',
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
