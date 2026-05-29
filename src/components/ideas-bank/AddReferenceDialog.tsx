import { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useIdeaReferences, IdeaReferenceType } from '@/hooks/useIdeaReferences';
import { useLinkPreview } from '@/hooks/useLinkPreview';
import { REFERENCE_TYPES, getTypeMeta } from './types';
import { Loader2, Upload, Link as LinkIcon, Type as TypeIcon, X } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  boardId: string;
}

export const AddReferenceDialog: React.FC<Props> = ({ open, onOpenChange, boardId }) => {
  const { create, uploadFile } = useIdeaReferences(boardId);
  const { fetchPreview, loading: previewing, data: preview, reset } = useLinkPreview();
  const [tab, setTab] = useState<'upload' | 'link' | 'text'>('upload');
  const [type, setType] = useState<IdeaReferenceType>('image');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [url, setUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      setTitle(''); setDescription(''); setTags(''); setUrl(''); setFile(null);
      setFilePreview(null); reset(); setTab('upload'); setType('image');
    }
  }, [open]);

  const onFileChange = (f: File | null) => {
    setFile(f);
    if (f) {
      setTitle(prev => prev || f.name.replace(/\.[^/.]+$/, ''));
      if (f.type.startsWith('image/')) {
        setType('image');
        const url = URL.createObjectURL(f);
        setFilePreview(url);
      } else if (f.type.startsWith('video/')) {
        setType('video');
        setFilePreview(URL.createObjectURL(f));
      } else if (f.type === 'application/pdf') {
        setType('document');
        setFilePreview(null);
      } else {
        setType('file');
        setFilePreview(null);
      }
    }
  };

  const onLinkBlur = async () => {
    if (!url.trim()) return;
    const p = await fetchPreview(url.trim());
    if (p) {
      setTitle(prev => prev || p.title || p.domain || url);
      setDescription(prev => prev || p.description || '');
      setType('link');
    }
  };

  const submit = async () => {
    if (!title.trim()) return;
    setUploading(true);
    try {
      let media_url: string | null = null;
      let file_url: string | null = null;
      let thumbnail_url: string | null = null;
      let file_name: string | null = null;

      if (tab === 'upload' && file) {
        const { signedUrl } = await uploadFile(file, boardId);
        if (file.type.startsWith('image/')) { media_url = signedUrl; thumbnail_url = signedUrl; }
        else if (file.type.startsWith('video/')) media_url = signedUrl;
        else file_url = signedUrl;
        file_name = file.name;
      }

      if (tab === 'link') {
        thumbnail_url = preview?.image || null;
      }

      await create.mutateAsync({
        board_id: boardId,
        type: tab === 'text' ? 'text' : type,
        title: title.trim(),
        description: description.trim() || null,
        source_url: tab === 'link' ? url.trim() : null,
        media_url,
        file_url,
        file_name,
        thumbnail_url,
        tags: tags.split(',').map(s => s.trim()).filter(Boolean),
      });
      onOpenChange(false);
    } finally {
      setUploading(false);
    }
  };

  const TypeIconCmp = getTypeMeta(type).icon;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Adicionar referência</DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={v => setTab(v as any)} className="w-full">
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="upload"><Upload className="h-4 w-4 mr-2" />Upload</TabsTrigger>
            <TabsTrigger value="link"><LinkIcon className="h-4 w-4 mr-2" />Link</TabsTrigger>
            <TabsTrigger value="text"><TypeIcon className="h-4 w-4 mr-2" />Texto</TabsTrigger>
          </TabsList>

          <TabsContent value="upload" className="space-y-3 pt-4">
            <div
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); onFileChange(e.dataTransfer.files?.[0] || null); }}
              onClick={() => fileRef.current?.click()}
              className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:bg-muted/30 transition-colors"
            >
              {filePreview && file?.type.startsWith('image/') ? (
                <img src={filePreview} alt="" className="max-h-48 mx-auto rounded" />
              ) : filePreview && file?.type.startsWith('video/') ? (
                <video src={filePreview} className="max-h-48 mx-auto rounded" controls />
              ) : file ? (
                <div className="flex items-center justify-center gap-2 text-sm">
                  <TypeIconCmp className="h-5 w-5" />
                  <span>{file.name}</span>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">
                  <Upload className="h-8 w-8 mx-auto mb-2 opacity-60" />
                  Clique ou arraste imagem, vídeo, PDF ou arquivo
                </div>
              )}
              <input
                ref={fileRef} type="file" className="hidden"
                accept="image/*,video/*,application/pdf,application/*"
                onChange={e => onFileChange(e.target.files?.[0] || null)}
              />
            </div>
          </TabsContent>

          <TabsContent value="link" className="space-y-3 pt-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">URL *</label>
              <Input
                placeholder="https://..."
                value={url}
                onChange={e => setUrl(e.target.value)}
                onBlur={onLinkBlur}
              />
              {previewing && <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Capturando preview…</p>}
            </div>
            {preview && (
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
            <p className="text-sm text-muted-foreground">Crie uma nota ou copy livre.</p>
          </TabsContent>
        </Tabs>

        <div className="space-y-3 pt-2">
          <div>
            <label className="text-sm font-medium mb-1.5 block">Título *</label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Como você quer chamar isso?" />
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Descrição</label>
            <Textarea rows={3} value={description} onChange={e => setDescription(e.target.value)} placeholder="Por que essa referência importa?" />
          </div>
          <div className="grid grid-cols-2 gap-3">
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
                      <I className="h-3 w-3 mr-1" />{t.label}
                    </Badge>
                  );
                })}
              </div>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Tags</label>
            <Input placeholder="separadas por vírgula" value={tags} onChange={e => setTags(e.target.value)} />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            onClick={submit}
            disabled={!title.trim() || uploading || create.isPending || (tab === 'upload' && !file) || (tab === 'link' && !url.trim())}
          >
            {(uploading || create.isPending) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Adicionar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
