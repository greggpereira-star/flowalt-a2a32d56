import { useEffect, useMemo, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useIdeaReferences, IdeaReferenceType } from '@/hooks/useIdeaReferences';
import { useLinkPreview } from '@/hooks/useLinkPreview';
import { REFERENCE_TYPES, getTypeMeta } from './types';
import { useToast } from '@/hooks/use-toast';
import {
  Loader2, Upload, Link as LinkIcon, Type as TypeIcon, X, File as FileIcon,
  Image as ImageIcon, Video, FileText, Layers,
} from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  boardId: string;
}

const inferType = (f: File): IdeaReferenceType => {
  if (f.type.startsWith('image/')) return 'image';
  if (f.type.startsWith('video/')) return 'video';
  if (f.type === 'application/pdf') return 'document';
  return 'file';
};

const FileIconFor = ({ f }: { f: File }) => {
  const t = inferType(f);
  if (t === 'image') return <ImageIcon className="h-4 w-4" aria-hidden="true" />;
  if (t === 'video') return <Video className="h-4 w-4" aria-hidden="true" />;
  if (t === 'document') return <FileText className="h-4 w-4" aria-hidden="true" />;
  return <FileIcon className="h-4 w-4" aria-hidden="true" />;
};

export const AddReferenceDialog: React.FC<Props> = ({ open, onOpenChange, boardId }) => {
  const { create, uploadFile } = useIdeaReferences(boardId);
  const { fetchPreview, loading: previewing, data: preview, reset } = useLinkPreview();
  const { toast } = useToast();

  const [tab, setTab] = useState<'upload' | 'link' | 'text'>('upload');
  const [type, setType] = useState<IdeaReferenceType>('image');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');

  // Multi-file
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<Record<string, string>>({});

  // Multi-link (textarea: one URL per line)
  const [url, setUrl] = useState('');

  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0, current: '' });
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      setTitle(''); setDescription(''); setTags(''); setUrl('');
      setFiles([]); setPreviews({}); reset(); setTab('upload'); setType('image');
      setProgress({ done: 0, total: 0, current: '' });
    }
  }, [open]);

  // revoke object URLs on unmount
  useEffect(() => () => {
    Object.values(previews).forEach(u => URL.revokeObjectURL(u));
  }, [previews]);

  const addFiles = (incoming: FileList | File[] | null) => {
    if (!incoming) return;
    const arr = Array.from(incoming);
    if (!arr.length) return;
    setFiles(prev => {
      const next = [...prev, ...arr];
      // seed previews for media
      const newPrev: Record<string, string> = {};
      arr.forEach(f => {
        if (f.type.startsWith('image/') || f.type.startsWith('video/')) {
          newPrev[`${f.name}-${f.size}-${f.lastModified}`] = URL.createObjectURL(f);
        }
      });
      setPreviews(p => ({ ...p, ...newPrev }));
      // auto-fill single-file title once
      if (prev.length === 0 && arr.length === 1) {
        setTitle(t => t || arr[0].name.replace(/\.[^/.]+$/, ''));
        setType(inferType(arr[0]));
      }
      return next;
    });
  };

  const removeFile = (idx: number) => {
    setFiles(prev => prev.filter((_, i) => i !== idx));
  };

  const urls = useMemo(
    () => url.split(/\s+/).map(s => s.trim()).filter(s => /^https?:\/\//i.test(s)),
    [url]
  );

  const onLinkBlur = async () => {
    if (urls.length !== 1) return;
    const p = await fetchPreview(urls[0]);
    if (p) {
      setTitle(prev => prev || p.title || p.domain || urls[0]);
      setDescription(prev => prev || p.description || '');
      setType('link');
    }
  };

  const isBulk = (tab === 'upload' && files.length > 1) || (tab === 'link' && urls.length > 1);

  // ---- Submit ----
  const submit = async () => {
    setUploading(true);
    try {
      // BULK FILE
      if (tab === 'upload' && files.length > 0) {
        setProgress({ done: 0, total: files.length, current: '' });
        let ok = 0;
        for (let i = 0; i < files.length; i++) {
          const f = files[i];
          setProgress({ done: i, total: files.length, current: f.name });
          try {
            const { signedUrl } = await uploadFile(f, boardId);
            const t = inferType(f);
            await create.mutateAsync({
              board_id: boardId,
              type: t,
              title: files.length === 1 && title.trim() ? title.trim() : f.name.replace(/\.[^/.]+$/, ''),
              description: files.length === 1 ? (description.trim() || null) : null,
              media_url: t === 'image' || t === 'video' ? signedUrl : null,
              thumbnail_url: t === 'image' ? signedUrl : null,
              file_url: t === 'image' || t === 'video' ? null : signedUrl,
              file_name: f.name,
              tags: tags.split(',').map(s => s.trim()).filter(Boolean),
            });
            ok++;
          } catch (e: any) {
            toast({ title: `Falha em "${f.name}"`, description: e.message, variant: 'destructive' });
          }
        }
        if (ok > 0) {
          toast({ title: ok === 1 ? 'Referência adicionada' : `${ok} referências adicionadas` });
        }
        onOpenChange(false);
        return;
      }

      // BULK LINK — fetch OG metadata for each so titles/thumbnails are auto-filled
      if (tab === 'link' && urls.length > 0) {
        setProgress({ done: 0, total: urls.length, current: '' });
        let ok = 0;
        for (let i = 0; i < urls.length; i++) {
          const u = urls[i];
          setProgress({ done: i, total: urls.length, current: u });
          try {
            // Reuse single-link preview if already fetched; else fetch fresh
            let p: { title?: string; description?: string; image?: string; domain?: string } | null = null;
            if (urls.length === 1 && preview) {
              p = preview;
            } else {
              p = await fetchPreview(u).catch(() => null);
            }
            await create.mutateAsync({
              board_id: boardId,
              type: 'link',
              title: urls.length === 1 && title.trim()
                ? title.trim()
                : (p?.title || p?.domain || u),
              description: urls.length === 1
                ? (description.trim() || p?.description || null)
                : (p?.description || null),
              source_url: u,
              thumbnail_url: p?.image || null,
              tags: tags.split(',').map(s => s.trim()).filter(Boolean),
            });
            ok++;
          } catch (e: any) {
            toast({ title: `Falha em "${u}"`, description: e.message, variant: 'destructive' });
          }
        }
        if (ok > 0) toast({ title: ok === 1 ? 'Link adicionado' : `${ok} links adicionados` });
        onOpenChange(false);
        return;
      }

      // TEXT note
      if (tab === 'text' && title.trim()) {
        await create.mutateAsync({
          board_id: boardId,
          type: 'text',
          title: title.trim(),
          description: description.trim() || null,
          tags: tags.split(',').map(s => s.trim()).filter(Boolean),
        });
        onOpenChange(false);
      }
    } finally {
      setUploading(false);
      setProgress({ done: 0, total: 0, current: '' });
    }
  };

  const canSubmit = !uploading && (
    (tab === 'upload' && files.length > 0) ||
    (tab === 'link' && urls.length > 0) ||
    (tab === 'text' && title.trim().length > 0)
  );

  const TypeIconCmp = getTypeMeta(type).icon;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Adicionar referências ao quadro</DialogTitle>
          <p className="text-xs text-muted-foreground">
            Solte várias imagens, vídeos, PDFs ou cole vários links de uma vez — todos vão para esta pasta.
            Dica: <kbd className="px-1 py-0.5 rounded border bg-muted font-mono text-[10px]">Ctrl+V</kbd> também funciona direto no quadro.
          </p>
        </DialogHeader>

        <Tabs value={tab} onValueChange={v => setTab(v as any)} className="w-full">
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="upload">
              <Upload className="h-4 w-4 mr-2" aria-hidden="true" />
              Arquivos {files.length > 0 && <Badge variant="secondary" className="ml-2 h-5 text-[10px]">{files.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="link">
              <LinkIcon className="h-4 w-4 mr-2" aria-hidden="true" />
              Links {urls.length > 0 && <Badge variant="secondary" className="ml-2 h-5 text-[10px]">{urls.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="text"><TypeIcon className="h-4 w-4 mr-2" aria-hidden="true" />Nota</TabsTrigger>
          </TabsList>

          {/* ---- UPLOAD (multi) ---- */}
          <TabsContent value="upload" className="space-y-3 pt-4">
            <div
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); addFiles(e.dataTransfer.files); }}
              onClick={() => fileRef.current?.click()}
              role="button"
              tabIndex={0}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileRef.current?.click(); } }}
              aria-label="Selecionar ou arrastar arquivos"
              className="border-2 border-dashed rounded-xl p-6 text-center cursor-pointer hover:bg-muted/30 transition-colors"
            >
              <Layers className="h-8 w-8 mx-auto mb-2 opacity-60" aria-hidden="true" />
              <p className="text-sm font-medium">Solte vários arquivos aqui ou clique para escolher</p>
              <p className="text-xs text-muted-foreground mt-1">
                Imagens, vídeos, PDFs e documentos · selecione vários de uma vez
              </p>
              <input
                ref={fileRef} type="file" className="hidden" multiple
                accept="image/*,video/*,application/pdf,application/*"
                onChange={e => { addFiles(e.target.files); e.target.value = ''; }}
              />
            </div>

            {files.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-medium text-muted-foreground">
                    {files.length} arquivo{files.length === 1 ? '' : 's'} pronto{files.length === 1 ? '' : 's'} para enviar
                  </p>
                  <Button variant="ghost" size="sm" onClick={() => setFiles([])} disabled={uploading}>
                    Limpar tudo
                  </Button>
                </div>
                <ul className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-60 overflow-y-auto">
                  {files.map((f, i) => {
                    const key = `${f.name}-${f.size}-${f.lastModified}`;
                    const prev = previews[key];
                    return (
                      <li key={`${key}-${i}`} className="relative group rounded-lg border bg-muted/20 overflow-hidden">
                        {prev && f.type.startsWith('image/') ? (
                          <img src={prev} alt={f.name} className="w-full h-20 object-cover" />
                        ) : prev && f.type.startsWith('video/') ? (
                          <video src={prev} className="w-full h-20 object-cover" muted />
                        ) : (
                          <div className="h-20 flex items-center justify-center text-muted-foreground">
                            <FileIconFor f={f} />
                          </div>
                        )}
                        <div className="px-1.5 py-1 text-[10px] truncate" title={f.name}>{f.name}</div>
                        {!uploading && (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); removeFile(i); }}
                            aria-label={`Remover ${f.name}`}
                            className="absolute top-1 right-1 h-5 w-5 rounded-full bg-background/90 border flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="h-3 w-3" aria-hidden="true" />
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </TabsContent>

          {/* ---- LINK (multi) ---- */}
          <TabsContent value="link" className="space-y-3 pt-4">
            <div>
              <label htmlFor="ib-urls" className="text-sm font-medium mb-1.5 block">URLs</label>
              <Textarea
                id="ib-urls"
                rows={4}
                placeholder={'https://...\nhttps://... (um por linha)'}
                value={url}
                onChange={e => setUrl(e.target.value)}
                onBlur={onLinkBlur}
              />
              <p className="text-xs text-muted-foreground mt-1.5">
                Cole um ou vários links — cada linha vira uma referência.
              </p>
              {previewing && (
                <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" /> Capturando preview…
                </p>
              )}
            </div>
            {preview && urls.length === 1 && (
              <div className="flex gap-3 p-3 border rounded-lg bg-muted/20">
                {preview.image && <img src={preview.image} alt="" className="w-20 h-20 object-cover rounded" />}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{preview.title}</p>
                  <p className="text-xs text-muted-foreground line-clamp-2">{preview.description}</p>
                  <p className="text-xs text-primary mt-1">{preview.domain}</p>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="text" className="pt-4">
            <p className="text-sm text-muted-foreground">Crie uma nota ou copy livre — preencha o título abaixo.</p>
          </TabsContent>
        </Tabs>

        {/* Metadata: only meaningful for single-item adds */}
        {!isBulk && (
          <div className="space-y-3 pt-2">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Título {tab === 'text' && '*'}</label>
              <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Como você quer chamar isso?" />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Descrição</label>
              <Textarea rows={2} value={description} onChange={e => setDescription(e.target.value)} placeholder="Por que essa referência importa?" />
            </div>
            {tab === 'text' && (
              <div>
                <label className="text-sm font-medium mb-1.5 block">Tipo</label>
                <div className="flex flex-wrap gap-1.5">
                  {REFERENCE_TYPES.map(t => {
                    const I = t.icon;
                    return (
                      <Badge
                        key={t.value}
                        variant={type === t.value ? 'default' : 'outline'}
                        className="cursor-pointer"
                        onClick={() => setType(t.value)}
                      >
                        <I className="h-3 w-3 mr-1" aria-hidden="true" />{t.label}
                      </Badge>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="pt-2">
          <label className="text-sm font-medium mb-1.5 block">Tags {isBulk && <span className="text-xs text-muted-foreground font-normal">· aplicadas a todas</span>}</label>
          <Input placeholder="separadas por vírgula (ex: verão, melinquera, campanha)" value={tags} onChange={e => setTags(e.target.value)} />
        </div>

        {uploading && progress.total > 0 && (
          <div className="space-y-1.5 pt-3">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span className="truncate mr-2">{progress.current || 'Enviando…'}</span>
              <span>{progress.done}/{progress.total}</span>
            </div>
            <Progress value={(progress.done / progress.total) * 100} className="h-1.5" />
          </div>
        )}

        <div className="flex justify-end gap-2 pt-3">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={uploading}>Cancelar</Button>
          <Button onClick={submit} disabled={!canSubmit}>
            {uploading && <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" />}
            {tab === 'upload' && files.length > 1 ? `Enviar ${files.length} arquivos` :
             tab === 'link' && urls.length > 1 ? `Adicionar ${urls.length} links` :
             'Adicionar'}
            {tab === 'upload' && files.length === 1 && <TypeIconCmp className="h-3.5 w-3.5 ml-2 opacity-70" aria-hidden="true" />}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
