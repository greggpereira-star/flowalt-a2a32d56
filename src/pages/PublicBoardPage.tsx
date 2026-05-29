import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Sparkles, ExternalLink, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PublicRef {
  id: string;
  type: string;
  title: string;
  description: string | null;
  source_url: string | null;
  thumbnail_url: string | null;
  media_url: string | null;
  tags: string[];
}

interface Payload {
  board: {
    id: string;
    name: string;
    description: string | null;
    cover_url: string | null;
    category: string | null;
    tags: string[];
  };
  references: PublicRef[];
}

export default function PublicBoardPage() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    (async () => {
      setLoading(true);
      const { data: res, error: err } = await (supabase as any).rpc('get_public_idea_board', { _token: token });
      if (err || !res) {
        setError('Link inválido, expirado ou desativado.');
      } else {
        setData(res as Payload);
      }
      setLoading(false);
    })();
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <Skeleton className="h-10 w-64 mb-6" />
        <div className="columns-2 md:columns-3 lg:columns-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className={cn('mb-4 rounded-xl w-full', i % 2 ? 'h-56' : 'h-40')} />
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center p-6">
        <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
          <Lock className="h-7 w-7 text-muted-foreground" />
        </div>
        <h1 className="text-xl font-semibold">Moodboard indisponível</h1>
        <p className="text-sm text-muted-foreground mt-1">{error || 'Conteúdo não encontrado.'}</p>
      </div>
    );
  }

  const { board, references } = data;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b sticky top-0 bg-background/95 backdrop-blur z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5 text-primary" /> Moodboard público
            </div>
            <h1 className="font-semibold text-xl truncate">{board.name}</h1>
            {board.description && (
              <p className="text-sm text-muted-foreground line-clamp-2 max-w-2xl">{board.description}</p>
            )}
            {board.tags?.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {board.tags.map(t => <Badge key={t} variant="outline" className="text-[10px]">{t}</Badge>)}
              </div>
            )}
          </div>
          <a href="/" className="text-xs text-muted-foreground hover:text-foreground">FlowAlt</a>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6">
        {references.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">Esta pasta ainda não tem referências.</div>
        ) : (
          <div className="columns-2 md:columns-3 lg:columns-4 xl:columns-5 gap-4">
            {references.map(r => {
              const img = r.thumbnail_url || r.media_url;
              return (
                <div key={r.id} className="break-inside-avoid mb-4 rounded-xl overflow-hidden border bg-card group">
                  {img ? (
                    r.type === 'video' ? (
                      <video src={img} className="w-full" controls />
                    ) : (
                      <img src={img} alt={r.title} loading="lazy" className="w-full block" />
                    )
                  ) : (
                    <div className="aspect-video bg-muted/40" />
                  )}
                  <div className="p-3">
                    <p className="text-sm font-medium line-clamp-2">{r.title}</p>
                    {r.description && <p className="text-xs text-muted-foreground line-clamp-3 mt-1">{r.description}</p>}
                    {r.tags?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {r.tags.slice(0, 4).map(t => (
                          <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-muted">{t}</span>
                        ))}
                      </div>
                    )}
                    {r.source_url && (
                      <a href={r.source_url} target="_blank" rel="noreferrer"
                        className="text-[11px] text-primary inline-flex items-center gap-1 mt-2 hover:underline">
                        <ExternalLink className="h-3 w-3" /> Abrir fonte
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
