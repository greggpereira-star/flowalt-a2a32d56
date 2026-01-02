import React, { useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Upload, X, ImageIcon, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface ClientLogoUploadProps {
  currentLogoUrl?: string;
  clientColor?: string;
  clientName?: string;
  onUpload: (url: string) => void;
  onRemove: () => void;
}

export const ClientLogoUpload: React.FC<ClientLogoUploadProps> = ({
  currentLogoUrl,
  clientColor = '#6366f1',
  clientName = '',
  onUpload,
  onRemove
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Por favor, selecione uma imagem válida.');
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error('A imagem deve ter no máximo 2MB.');
      return;
    }

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreviewUrl(reader.result as string);
    };
    reader.readAsDataURL(file);

    // Upload to Supabase
    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${crypto.randomUUID()}.${fileExt}`;
      const filePath = `logos/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('client-logos')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('client-logos')
        .getPublicUrl(filePath);

      onUpload(publicUrl);
      toast.success('Logo enviado com sucesso!');
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error('Erro ao enviar logo: ' + error.message);
      setPreviewUrl(null);
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemove = () => {
    setPreviewUrl(null);
    onRemove();
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const displayUrl = previewUrl || currentLogoUrl;

  return (
    <div className="space-y-3">
      <Label>Logo do Cliente</Label>
      
      <div className="flex items-start gap-4">
        {/* Preview area */}
        <div 
          className={cn(
            "w-20 h-20 rounded-xl flex items-center justify-center overflow-hidden border-2 border-dashed transition-colors",
            displayUrl 
              ? "border-transparent shadow-md" 
              : "border-muted-foreground/25 bg-muted/50"
          )}
          style={{ backgroundColor: displayUrl ? 'transparent' : clientColor }}
        >
          {displayUrl ? (
            <img 
              src={displayUrl} 
              alt="Logo preview" 
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="text-white font-bold text-2xl">
              {clientName.charAt(0).toUpperCase() || '?'}
            </span>
          )}
        </div>

        {/* Upload controls */}
        <div className="flex-1 space-y-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
          />
          
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="gap-1.5"
            >
              {isUploading ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Upload className="h-3.5 w-3.5" />
                  Enviar Logo
                </>
              )}
            </Button>
            
            {displayUrl && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleRemove}
                className="gap-1.5 text-muted-foreground hover:text-destructive"
              >
                <X className="h-3.5 w-3.5" />
                Remover
              </Button>
            )}
          </div>

          {/* Guidance */}
          <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
            <ImageIcon className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
            <span>
              Tamanho ideal: <strong>200×200px</strong> ou maior (quadrado). 
              Formatos: PNG, JPG ou SVG. Máximo 2MB.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
