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
import { useSkinNovo } from '@/components/ui/skin-novo';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { Building2 } from 'lucide-react';

export const ProfileSettings: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const novo = useSkinNovo();
  const { currentWorkspace } = useWorkspace();
  
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
      if (!user?.id) throw new Error('Usuário não encontrado. Faça login novamente.');
      
      // Use a unique filename with timestamp to avoid caching issues
      const timestamp = Date.now();
      const filePath = `${user.id}/avatar-${timestamp}.jpg`;
      
      console.log('Uploading avatar for user:', user.id, 'to path:', filePath);
      
      // Upload to storage
      const { error: uploadError, data: uploadData } = await supabase.storage
        .from('avatars')
        .upload(filePath, avatarBlob, {
          upsert: true,
          contentType: 'image/jpeg'
        });
      
      if (uploadError) {
        console.error('Upload error details:', uploadError);
        throw new Error(`Erro ao fazer upload: ${uploadError.message}`);
      }
      
      console.log('Upload successful:', uploadData);
      
      // Get public URL with cache buster
      const { data: urlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);
      
      const avatarUrl = `${urlData.publicUrl}?t=${timestamp}`;
      
      console.log('Updating profile with avatar URL:', avatarUrl);
      
      // Update profile
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: avatarUrl, updated_at: new Date().toISOString() })
        .eq('id', user.id);
      
      if (updateError) {
        console.error('Profile update error:', updateError);
        throw new Error(`Erro ao atualizar perfil: ${updateError.message}`);
      }
      
      return avatarUrl;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-profile'] });
      queryClient.invalidateQueries({ queryKey: ['profile-complete'] });
      toast.success('Foto de perfil atualizada!');
    },
    onError: (error: Error) => {
      console.error('Error updating avatar:', error);
      toast.error(error.message || 'Erro ao atualizar foto de perfil');
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

  const cropper = tempImageSrc ? (
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
  ) : null;

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

  if (novo) {
    return (
      <div className="space-y-5">
        {/* Cartão de identidade: foto, nome e e-mail juntos, sem repetir o que já está no título da tela */}
        <Card>
          <div className="flex flex-col items-center gap-5 p-6 text-center sm:flex-row sm:items-center sm:gap-7 sm:p-7 sm:text-left">
            <div className="relative shrink-0">
              <Avatar className="h-28 w-28 ring-4 ring-primary/10">
                <AvatarImage src={profile?.avatar_url || undefined} />
                <AvatarFallback className="bg-primary/10 text-2xl text-primary">{userInitials}</AvatarFallback>
              </Avatar>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                aria-label="Alterar foto de perfil"
                className="absolute bottom-0 right-0 flex h-9 w-9 items-center justify-center rounded-full border-2 border-card bg-primary text-primary-foreground shadow-md transition-transform hover:scale-105 disabled:opacity-60"
              >
                {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
            </div>

            <div className="min-w-0 flex-1">
              <h2 className="truncate text-[22px] font-extrabold leading-tight tracking-tight">{profile?.full_name || 'Nome não informado'}</h2>
              <p className="mt-0.5 truncate text-sm text-muted-foreground">{profile?.email || user?.email}</p>
              {currentWorkspace?.name && (
                <span className="mt-3 inline-flex max-w-full items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground">
                  <Building2 className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{currentWorkspace.name}</span>
                </span>
              )}
              <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-muted-foreground sm:justify-start">
                <Crop className="hidden h-3 w-3 shrink-0 sm:block" />
                Toque na câmera para trocar a foto (quadrada, 400×400 px). Você pode recortar antes de salvar.
              </p>
            </div>

          </div>
        </Card>

        <BirthdaySettings />

        {cropper}
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
      {cropper}
    </div>
  );
};
