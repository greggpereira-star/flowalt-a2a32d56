/**
 * Incorporação (embed) de vídeos de redes sociais no Banco de Ideias.
 *
 * Nada é baixado: o Flowalt guarda só o link, título, autor e uma miniatura, e mostra o vídeo
 * pelo player oficial de cada plataforma. Se o criador apagar o vídeo, o player deixa de
 * funcionar; a miniatura e os metadados continuam como registro.
 */
export type Plataforma = 'tiktok' | 'instagram' | 'youtube';

export const ROTULO_PLATAFORMA: Record<Plataforma, string> = {
  tiktok: 'TikTok',
  instagram: 'Instagram',
  youtube: 'YouTube',
};

export function detectarPlataforma(url: string): Plataforma | null {
  try {
    const h = new URL(url).hostname.replace(/^www\./, '').toLowerCase();
    if (h === 'tiktok.com' || h.endsWith('.tiktok.com')) return 'tiktok';
    if (h === 'instagram.com' || h.endsWith('.instagram.com') || h === 'instagr.am') return 'instagram';
    if (h === 'youtube.com' || h.endsWith('.youtube.com') || h === 'youtu.be') return 'youtube';
  } catch {
    /* url inválida */
  }
  return null;
}

interface RefIncorporavel {
  platform?: string | null;
  external_id?: string | null;
  source_url?: string | null;
}

/** Endereço do player oficial e o formato dele (vertical ou 16:9). Nulo se não der para montar. */
export function incorporacaoDe(ref: RefIncorporavel): { src: string; formato: 'vertical' | 'horizontal' } | null {
  const plataforma = ref.platform as Plataforma | null | undefined;
  if (!plataforma) return null;

  if (plataforma === 'tiktok') {
    const id = ref.external_id ?? ref.source_url?.match(/\/video\/(\d+)/)?.[1];
    // O player v1 é o oficial para iframe; o endereço /embed/v2 é barrado pelo TikTok fora do próprio site.
    return id ? { src: `https://www.tiktok.com/player/v1/${id}?music_info=1&description=1&rel=0`, formato: 'vertical' } : null;
  }

  if (plataforma === 'instagram') {
    const m = ref.source_url?.match(/instagram\.com\/(?:[\w.]+\/)?(p|reel|reels|tv)\/([\w-]+)/i);
    if (!m) return null;
    const tipo = m[1].toLowerCase() === 'p' ? 'p' : 'reel';
    return { src: `https://www.instagram.com/${tipo}/${m[2]}/embed`, formato: 'vertical' };
  }

  if (plataforma === 'youtube') {
    const id = ref.external_id;
    if (!id) return null;
    const ehShort = /\/shorts\//.test(ref.source_url ?? '');
    return { src: `https://www.youtube.com/embed/${id}`, formato: ehShort ? 'vertical' : 'horizontal' };
  }

  return null;
}
