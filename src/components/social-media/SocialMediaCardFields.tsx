import React, { useEffect, useState } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useCustomFieldDefinitions,
  useCardCustomFields,
  useUpdateCardCustomFields,
} from '@/hooks/useSocialMediaTemplates';
import {
  Instagram,
  Facebook,
  Linkedin,
  Twitter,
  Youtube,
  Globe,
  Calendar,
  Link2,
  Sparkles,
} from 'lucide-react';

interface SocialMediaCardFieldsProps {
  cardId: string;
  spaceType?: string;
  readOnly?: boolean;
}

const PLATFORM_OPTIONS = [
  { value: 'instagram', label: 'Instagram', icon: Instagram },
  { value: 'facebook', label: 'Facebook', icon: Facebook },
  { value: 'linkedin', label: 'LinkedIn', icon: Linkedin },
  { value: 'twitter', label: 'Twitter/X', icon: Twitter },
  { value: 'youtube', label: 'YouTube', icon: Youtube },
  { value: 'tiktok', label: 'TikTok', icon: Sparkles },
  { value: 'other', label: 'Outro', icon: Globe },
];

const PIECE_TYPE_OPTIONS = [
  { value: 'post', label: 'Post Feed' },
  { value: 'story', label: 'Story' },
  { value: 'reels', label: 'Reels/Shorts' },
  { value: 'carousel', label: 'Carrossel' },
  { value: 'video', label: 'Vídeo' },
  { value: 'ad', label: 'Anúncio' },
  { value: 'other', label: 'Outro' },
];

const EDITORIAL_STATUS_OPTIONS = [
  { value: 'draft', label: 'Rascunho', color: 'bg-muted' },
  { value: 'pending_review', label: 'Aguardando Revisão', color: 'bg-yellow-500' },
  { value: 'pending_approval', label: 'Aguardando Aprovação', color: 'bg-orange-500' },
  { value: 'approved', label: 'Aprovado', color: 'bg-green-500' },
  { value: 'rejected', label: 'Rejeitado', color: 'bg-red-500' },
  { value: 'scheduled', label: 'Programado', color: 'bg-blue-500' },
  { value: 'published', label: 'Publicado', color: 'bg-primary' },
];

export const SocialMediaCardFields: React.FC<SocialMediaCardFieldsProps> = ({
  cardId,
  spaceType = 'social_media',
  readOnly = false,
}) => {
  const { data: definitions, isLoading: defsLoading } = useCustomFieldDefinitions(spaceType);
  const { data: cardFields, isLoading: fieldsLoading } = useCardCustomFields(cardId);
  const updateFields = useUpdateCardCustomFields();

  const [localValues, setLocalValues] = useState<Record<string, string>>({});
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    if (cardFields) {
      const values: Record<string, string> = {};
      cardFields.forEach((field) => {
        values[field.field_key] = field.field_value || '';
      });
      setLocalValues(values);
      setIsDirty(false);
    }
  }, [cardFields]);

  const handleFieldChange = (key: string, value: string) => {
    setLocalValues((prev) => ({ ...prev, [key]: value }));
    setIsDirty(true);
  };

  const handleBlur = async () => {
    if (!isDirty) return;
    try {
      await updateFields.mutateAsync({ cardId, fields: localValues });
      setIsDirty(false);
    } catch (error) {
      console.error('Failed to update custom fields:', error);
    }
  };

  if (defsLoading || fieldsLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  if (!definitions || definitions.length === 0) return null;

  const getValue = (key: string) => localValues[key] || '';

  const renderSelectField = (fieldKey: string) => {
    const value = getValue(fieldKey);

    if (fieldKey === 'platform') {
      return (
        <Select value={value} onValueChange={(v) => { handleFieldChange(fieldKey, v); setTimeout(handleBlur, 0); }} disabled={readOnly}>
          <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
          <SelectContent>
            {PLATFORM_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                <div className="flex items-center gap-2"><opt.icon className="h-4 w-4" />{opt.label}</div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }

    if (fieldKey === 'piece_type') {
      return (
        <Select value={value} onValueChange={(v) => { handleFieldChange(fieldKey, v); setTimeout(handleBlur, 0); }} disabled={readOnly}>
          <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
          <SelectContent>
            {PIECE_TYPE_OPTIONS.map((opt) => (<SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>))}
          </SelectContent>
        </Select>
      );
    }

    if (fieldKey === 'editorial_status') {
      return (
        <Select value={value} onValueChange={(v) => { handleFieldChange(fieldKey, v); setTimeout(handleBlur, 0); }} disabled={readOnly}>
          <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
          <SelectContent>
            {EDITORIAL_STATUS_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                <div className="flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${opt.color}`} />{opt.label}</div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }

    return <Input value={value} onChange={(e) => handleFieldChange(fieldKey, e.target.value)} onBlur={handleBlur} disabled={readOnly} />;
  };

  const renderField = (def: typeof definitions[0]) => {
    const { field_key, field_type } = def;
    const value = getValue(field_key);

    if (field_type === 'select') return renderSelectField(field_key);

    if (field_type === 'date') {
      return (
        <div className="relative">
          <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input type="date" value={value} onChange={(e) => handleFieldChange(field_key, e.target.value)} onBlur={handleBlur} disabled={readOnly} className="pl-10" />
        </div>
      );
    }

    if (field_type === 'url') {
      return (
        <div className="relative">
          <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input type="url" placeholder="https://..." value={value} onChange={(e) => handleFieldChange(field_key, e.target.value)} onBlur={handleBlur} disabled={readOnly} className="pl-10" />
        </div>
      );
    }

    return <Input value={value} onChange={(e) => handleFieldChange(field_key, e.target.value)} onBlur={handleBlur} disabled={readOnly} />;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <h4 className="text-sm font-medium">Campos Social Media</h4>
      </div>
      <p className="text-[11px] text-muted-foreground -mt-2">
        ⓘ <span className="font-medium text-foreground">Data de Postagem</span> é diferente do <span className="font-medium text-foreground">Prazo da Tarefa</span>: a primeira indica quando o conteúdo será publicado; o prazo é a entrega da execução interna.
      </p>
      <div className="grid grid-cols-2 gap-3">
        {definitions.map((def) => {
          const isPostDate = def.field_key === 'post_date';
          return (
            <div
              key={def.field_key}
              className={cn(
                'space-y-1.5',
                isPostDate && 'col-span-2 rounded-md border border-primary/20 bg-primary/5 p-2'
              )}
            >
              <Label className={cn('text-xs', isPostDate ? 'text-primary font-medium' : 'text-muted-foreground')}>
                {isPostDate ? '📅 Data de Postagem (quando vai ao ar)' : def.field_label}
              </Label>
              {renderField(def)}
            </div>
          );
        })}
      </div>
    </div>
  );
};
};
