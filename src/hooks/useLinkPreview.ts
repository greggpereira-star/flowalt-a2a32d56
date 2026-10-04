import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface LinkPreview {
  title?: string;
  description?: string;
  image?: string;
  domain?: string;
  url: string;
  platform?: 'tiktok' | 'instagram' | 'youtube';
  external_id?: string;
  author_name?: string;
  author_url?: string;
  /** Miniatura em base64 (redes sociais), para guardarmos uma cópia no nosso armazenamento. */
  image_base64?: string;
  image_type?: string;
}

export function useLinkPreview() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<LinkPreview | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function fetchPreview(url: string) {
    setLoading(true); setError(null); setData(null);
    try {
      const { data, error } = await supabase.functions.invoke('link-preview', { body: { url } });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setData(data as LinkPreview);
      return data as LinkPreview;
    } catch (e: any) {
      setError(e.message);
      return null;
    } finally {
      setLoading(false);
    }
  }

  return { fetchPreview, loading, data, error, reset: () => { setData(null); setError(null); } };
}
