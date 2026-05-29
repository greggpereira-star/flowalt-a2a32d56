import { IdeaReferenceType } from '@/hooks/useIdeaReferences';
import {
  Image as ImageIcon, Video, Link as LinkIcon, FileText, File,
  Type, MessageSquare, Megaphone, Layout, Layers, Eye,
  Sparkles, Calendar,
} from 'lucide-react';

export const REFERENCE_TYPES: {
  value: IdeaReferenceType; label: string; icon: any;
}[] = [
  { value: 'image', label: 'Imagem', icon: ImageIcon },
  { value: 'video', label: 'Vídeo', icon: Video },
  { value: 'link', label: 'Link', icon: LinkIcon },
  { value: 'file', label: 'Arquivo', icon: File },
  { value: 'document', label: 'Documento', icon: FileText },
  { value: 'text', label: 'Texto', icon: Type },
  { value: 'copy', label: 'Copy', icon: MessageSquare },
  { value: 'ad', label: 'Anúncio', icon: Megaphone },
  { value: 'layout', label: 'Layout', icon: Layout },
  { value: 'moodboard', label: 'Moodboard', icon: Layers },
  { value: 'competitor', label: 'Concorrente', icon: Eye },
  { value: 'inspiration', label: 'Inspiração', icon: Sparkles },
  { value: 'campaign', label: 'Campanha', icon: Calendar },
];

export const getTypeMeta = (t: IdeaReferenceType) =>
  REFERENCE_TYPES.find(r => r.value === t) || REFERENCE_TYPES[11];
