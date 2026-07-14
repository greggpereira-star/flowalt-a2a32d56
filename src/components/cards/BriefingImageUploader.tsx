import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Upload, ImageIcon, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface BriefingImageUploaderProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

interface TipTapDoc {
  type: string;
  content?: any[];
  [k: string]: any;
}

const IMG_EXT_REGEX = /\.(png|jpe?g|gif|webp|avif|svg|bmp)(\?.*)?$/i;

function parseDoc(value: string): TipTapDoc {
  if (!value) return { type: 'doc', content: [] };
  try {
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed === 'object' && parsed.type === 'doc') return parsed;
    return { type: 'doc', content: [] };
  } catch {
    return {
      type: 'doc',
      content: value
        ? [{ type: 'paragraph', content: [{ type: 'text', text: value }] }]
        : [],
    };
  }
}

function extractImageUrls(doc: TipTapDoc): string[] {
  const urls: string[] = [];
  const walk = (node: any) => {
    if (!node) return;
    if (node.type === 'text' && Array.isArray(node.marks)) {
      for (const m of node.marks) {
        const href = m?.attrs?.href;
        if (m.type === 'link' && typeof href === 'string' && IMG_EXT_REGEX.test(href)) {
          urls.push(href);
        }
      }
    }
    if (Array.isArray(node.content)) node.content.forEach(walk);
  };
  walk(doc);
  return Array.from(new Set(urls));
}

function appendImageLink(doc: TipTapDoc, url: string, name: string): TipTapDoc {
  const paragraph = {
    type: 'paragraph',
    content: [
      {
        type: 'text',
        text: name,
        marks: [
          {
            type: 'link',
            attrs: {
              href: url,
              target: '_blank',
              rel: 'noopener noreferrer nofollow',
            },
          },
        ],
      },
    ],
  };
  return { ...doc, content: [...(doc.content || []), paragraph] };
}

function removeImageLink(doc: TipTapDoc, url: string): TipTapDoc {
  const filter = (nodes: any[]): any[] =>
    nodes
      .map((n) => {
        if (Array.isArray(n.content)) {
          const filtered = filter(n.content);
          return { ...n, content: filtered };
        }
        return n;
      })
      .filter((n) => {
        if (n.type !== 'paragraph' || !Array.isArray(n.content)) return true;
        const onlyImageLink =
          n.content.length === 1 &&
          n.content[0].type === 'text' &&
          n.content[0].marks?.some(
            (m: any) => m.type === 'link' && m.attrs?.href === url
          );
        return !onlyImageLink;
      });
  return { ...doc, content: filter(doc.content || []) };
}

export const BriefingImageUploader: React.FC<BriefingImageUploaderProps> = ({
  value,
  onChange,
  disabled,
}) => {
  const { user } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);

  const doc = useMemo(() => parseDoc(value), [value]);
  const images = useMemo(() => extractImageUrls(doc), [doc]);

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      if (!user?.id) {
        toast.error('Faça login para enviar imagens');
        return;
      }
      const arr = Array.from(files).filter((f) => f.type.startsWith('image/'));
      if (!arr.length) {
        toast.error('Selecione apenas imagens');
        return;
      }
      setUploading(true);
      let currentDoc = parseDoc(value);
      try {
        for (const file of arr) {
          if (file.size > 10 * 1024 * 1024) {
            toast.error(`${file.name} ultrapassa 10MB`);
            continue;
          }
          const sanitized = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
          const path = `briefing-references/${user.id}/${Date.now()}-${sanitized}`;
          const { error: upErr } = await supabase.storage
            .from('attachments')
            .upload(path, file, { cacheControl: '3600', upsert: false });
          if (upErr) {
            console.error('upload error', upErr);
            toast.error(`Falha ao enviar ${file.name}`);
            continue;
          }
          const { data } = supabase.storage.from('attachments').getPublicUrl(path);
          currentDoc = appendImageLink(currentDoc, data.publicUrl, file.name);
        }
        onChange(JSON.stringify(currentDoc));
        toast.success('Imagens anexadas ao briefing');
      } finally {
        setUploading(false);
      }
    },
    [user?.id, value, onChange]
  );

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (disabled) return;
    if (e.dataTransfer.files?.length) handleFiles(e.dataTransfer.files);
  };

  const handleRemove = (url: string) => {
    const next = removeImageLink(parseDoc(value), url);
    onChange(JSON.stringify(next));
  };

  return (
    <div className="space-y-2">
      <div
        onClick={() => !disabled && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        role="button"
        tabIndex={0}
        className={cn(
          'flex items-center gap-3 rounded-lg border border-dashed px-3 py-2.5 cursor-pointer transition-colors',
          'text-xs text-muted-foreground hover:border-primary/40 hover:bg-muted/40',
          isDragging && 'border-primary bg-primary/5 text-primary',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
      >
        {uploading ? (
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
        ) : (
          <Upload className="h-4 w-4" />
        )}
        <span className="flex-1">
          {uploading
            ? 'Enviando imagens...'
            : 'Anexar imagens (arraste ou clique para selecionar do computador)'}
        </span>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          disabled={disabled || uploading}
          onChange={(e) => {
            if (e.target.files?.length) handleFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </div>

      {images.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {images.map((url) => (
            <div
              key={url}
              className="group relative aspect-square rounded-md overflow-hidden border bg-muted"
            >
              <a href={url} target="_blank" rel="noreferrer">
                <img
                  src={url}
                  alt="Referência"
                  className="w-full h-full object-cover"
                  loading="lazy"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = 'none';
                    const fb = e.currentTarget.nextElementSibling as HTMLElement | null;
                    if (fb) fb.style.display = 'flex';
                  }}
                />
                <div
                  className="hidden absolute inset-0 items-center justify-center text-muted-foreground"
                >
                  <ImageIcon className="h-5 w-5" />
                </div>
              </a>
              {!disabled && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleRemove(url);
                  }}
                  className="absolute top-1 right-1 h-5 w-5 rounded-full bg-background/90 border flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Remover"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default BriefingImageUploader;
