import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useProfileComplete } from '@/hooks/useProfileComplete';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Camera, Calendar, Check, Sparkles } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const CompleteProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: profileStatus, isLoading } = useProfileComplete();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [birthday, setBirthday] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // If profile is already complete, redirect
  React.useEffect(() => {
    if (!isLoading && profileStatus?.isComplete) {
      navigate('/', { replace: true });
    }
  }, [isLoading, profileStatus, navigate]);

  // Pre-fill with existing data
  React.useEffect(() => {
    if (profileStatus?.profile) {
      if (profileStatus.profile.birthday) {
        setBirthday(profileStatus.profile.birthday);
      }
      if (profileStatus.profile.avatar_url) {
        setAvatarPreview(profileStatus.profile.avatar_url);
      }
    }
  }, [profileStatus]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Arquivo inválido',
        description: 'Por favor, selecione uma imagem.',
        variant: 'destructive',
      });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: 'Arquivo muito grande',
        description: 'A imagem deve ter no máximo 5MB.',
        variant: 'destructive',
      });
      return;
    }

    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;

    // Validation
    const needsBirthday = !profileStatus?.hasBirthday && !birthday;
    const needsAvatar = !profileStatus?.hasAvatar && !avatarFile && !avatarPreview;

    if (needsBirthday) {
      toast({
        title: 'Data de aniversário obrigatória',
        description: 'Por favor, informe sua data de aniversário.',
        variant: 'destructive',
      });
      return;
    }

    if (needsAvatar) {
      toast({
        title: 'Foto de perfil obrigatória',
        description: 'Por favor, adicione uma foto de perfil.',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);

    try {
      let avatarUrl = profileStatus?.profile?.avatar_url;

      // Upload avatar if new file selected
      if (avatarFile) {
        const fileExt = avatarFile.name.split('.').pop();
        const filePath = `${user.id}/avatar.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(filePath, avatarFile, { upsert: true });

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from('avatars')
          .getPublicUrl(filePath);

        avatarUrl = urlData.publicUrl;
      }

      // Update profile
      const updates: Record<string, any> = {};
      if (birthday && !profileStatus?.hasBirthday) {
        updates.birthday = birthday;
      }
      if (avatarUrl && avatarUrl !== profileStatus?.profile?.avatar_url) {
        updates.avatar_url = avatarUrl;
      }

      if (Object.keys(updates).length > 0) {
        updates.updated_at = new Date().toISOString();

        const { error: updateError } = await supabase
          .from('profiles')
          .update(updates)
          .eq('id', user.id);

        if (updateError) throw updateError;
      }

      // Invalidate cache and redirect
      await queryClient.invalidateQueries({ queryKey: ['profile-complete'] });
      
      toast({
        title: 'Perfil atualizado!',
        description: 'Bem-vindo ao sistema.',
      });

      navigate('/', { replace: true });
    } catch (error) {
      console.error('Error updating profile:', error);
      toast({
        title: 'Erro ao salvar',
        description: 'Ocorreu um erro ao atualizar o perfil. Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const userInitials = user?.user_metadata?.full_name
    ?.split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || user?.email?.[0].toUpperCase() || 'U';

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-xl border-border/50">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-primary">
            <Sparkles className="h-7 w-7 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl">Complete seu perfil</CardTitle>
          <CardDescription>
            Para continuar, precisamos de algumas informações
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Avatar Upload */}
            <div className="flex flex-col items-center gap-4">
              <Label className="text-sm font-medium flex items-center gap-2">
                <Camera className="h-4 w-4" />
                Foto de Perfil
                <span className="text-destructive">*</span>
              </Label>
              
              <div 
                className="relative cursor-pointer group"
                onClick={() => fileInputRef.current?.click()}
              >
                <Avatar className="h-24 w-24 ring-4 ring-primary/20 group-hover:ring-primary/40 transition-all">
                  <AvatarImage src={avatarPreview || undefined} />
                  <AvatarFallback className="bg-primary/10 text-primary text-xl">
                    {userInitials}
                  </AvatarFallback>
                </Avatar>
                <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Camera className="h-6 w-6 text-white" />
                </div>
                {profileStatus?.hasAvatar || avatarPreview ? (
                  <div className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-green-500 flex items-center justify-center ring-2 ring-background">
                    <Check className="h-3 w-3 text-white" />
                  </div>
                ) : null}
              </div>
              
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
              
              <p className="text-xs text-muted-foreground">
                Clique para selecionar uma foto (max 5MB)
              </p>
            </div>

            {/* Birthday Input */}
            <div className="space-y-2">
              <Label htmlFor="birthday" className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Data de Aniversário
                <span className="text-destructive">*</span>
              </Label>
              <Input
                id="birthday"
                type="date"
                value={birthday}
                onChange={(e) => setBirthday(e.target.value)}
                max={new Date().toISOString().split('T')[0]}
                className="h-11"
                disabled={profileStatus?.hasBirthday}
              />
              {profileStatus?.hasBirthday && profileStatus.profile?.birthday && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Check className="h-3 w-3 text-green-500" />
                  {format(new Date(profileStatus.profile.birthday), "dd 'de' MMMM", { locale: ptBR })}
                </p>
              )}
            </div>

            {/* Submit Button */}
            <Button 
              type="submit" 
              className="w-full h-11" 
              disabled={saving}
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                'Continuar'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default CompleteProfilePage;
