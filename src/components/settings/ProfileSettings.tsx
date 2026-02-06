import React, { useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ImageCropper } from '@/components/ui/image-cropper';
import { Camera, Loader2, User, Crop, Check } from 'lucide-react';
import { toast } from 'sonner';
import { BirthdaySettings } from '@/components/notices/BirthdaySettings';

export const ProfileSettings: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [cropperOpen, setCropperOpen] = useState(false);
  const [tempImageSrc, setTempImageSrc] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Fetch current profile
  const { data: profile, isLoading } = useQuery({
    queryKey: ['user-profile', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, email')
        .eq('id', user.id)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const updateAvatarMutation = useMutation({
    mutationFn: async (avatarBlob: Blob) => {
      if (!user?.id) throw new Error('User not found');
      
      const filePath = `${user.id}/avatar.jpg`;
      
      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, avatarBlob, {
          upsert: true,
          contentType: 'image/jpeg'
        });
      
      if (uploadError) throw uploadError;
      
      // Get public URL with cache buster
      const { data: urlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);
      
      const avatarUrl = `${urlData.publicUrl}?t=${Date.now()}`;
      
      // Update profile
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: avatarUrl, updated_at: new Date().toISOString() })
        .eq('id', user.id);
      
      if (updateError) throw updateError;
      
      return avatarUrl;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-profile'] });
      queryClient.invalidateQueries({ queryKey: ['profile-complete'] });
      toast.success('Foto de perfil atualizada!');
    },
    onError: (error) => {
      console.error('Error updating avatar:', error);
      toast.error('Erro ao atualizar foto de perfil');
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Por favor, selecione uma imagem válida.');
      return;
    }

    // Validate file size (max 10MB for raw, will be compressed)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('A imagem deve ter no máximo 10MB.');
      return;
    }

    // Open cropper
    setTempImageSrc(URL.createObjectURL(file));
    setCropperOpen(true);
    
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleCropComplete = async (croppedBlob: Blob) => {
    setIsUploading(true);
    try {
      await updateAvatarMutation.mutateAsync(croppedBlob);
    } finally {
      setIsUploading(false);
      
      // Cleanup temp image
      if (tempImageSrc) {
        URL.revokeObjectURL(tempImageSrc);
        setTempImageSrc(null);
      }
    }
  };

  const userInitials = profile?.full_name
    ?.split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || user?.email?.[0].toUpperCase() || 'U';

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="p-6">
            <div className="h-48 animate-pulse bg-muted rounded-lg" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Profile Photo Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5 text-primary" />
            Foto de Perfil
          </CardTitle>
          <CardDescription>
            Sua foto será exibida em comentários, atribuições e no cabeçalho do sistema.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-start gap-6">
            {/* Current Avatar */}
            <div className="relative group">
              <Avatar className="h-24 w-24 ring-4 ring-primary/10">
                <AvatarImage src={profile?.avatar_url || undefined} />
                <AvatarFallback className="bg-primary/10 text-primary text-xl">
                  {userInitials}
                </AvatarFallback>
              </Avatar>
              
              {/* Overlay for click */}
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer disabled:cursor-not-allowed"
              >
                {isUploading ? (
                  <Loader2 className="h-6 w-6 text-white animate-spin" />
                ) : (
                  <Camera className="h-6 w-6 text-white" />
                )}
              </button>
            </div>

            {/* Upload controls */}
            <div className="flex-1 space-y-3">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
              
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="gap-2"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Camera className="h-4 w-4" />
                    Alterar Foto
                  </>
                )}
              </Button>
              
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">
                  Tamanho recomendado: <strong>400×400px</strong> (quadrado)
                </p>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Crop className="h-3 w-3" />
                  Você poderá recortar e ajustar a imagem
                </p>
              </div>
            </div>
          </div>

          {/* User info */}
          <div className="mt-6 pt-6 border-t space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <Label className="text-muted-foreground w-20">Nome:</Label>
              <span className="font-medium">{profile?.full_name || 'Não informado'}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Label className="text-muted-foreground w-20">E-mail:</Label>
              <span className="font-medium">{profile?.email || user?.email}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Birthday Settings */}
      <BirthdaySettings />

      {/* Image Cropper Dialog */}
      {tempImageSrc && (
        <ImageCropper
          open={cropperOpen}
          onOpenChange={(open) => {
            setCropperOpen(open);
            if (!open && tempImageSrc) {
              URL.revokeObjectURL(tempImageSrc);
              setTempImageSrc(null);
            }
          }}
          imageSrc={tempImageSrc}
          onCropComplete={handleCropComplete}
          aspectRatio={1}
          suggestedSize={{ width: 400, height: 400 }}
        />
      )}
    </div>
  );
};
