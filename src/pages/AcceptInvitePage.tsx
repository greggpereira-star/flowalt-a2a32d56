import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAcceptWorkspaceInvite } from '@/hooks/useWorkspaceInvites';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle2, XCircle, Mail, LogIn } from 'lucide-react';

type InviteStatus = 'loading' | 'valid' | 'expired' | 'already_accepted' | 'not_found' | 'error';

interface InviteInfo {
  email: string;
  workspaceName: string;
  role: string;
  expiresAt: string;
}

export default function AcceptInvitePage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const acceptInvite = useAcceptWorkspaceInvite();

  const [status, setStatus] = useState<InviteStatus>('loading');
  const [inviteInfo, setInviteInfo] = useState<InviteInfo | null>(null);
  const [isAccepting, setIsAccepting] = useState(false);

  useEffect(() => {
    if (!token) {
      setStatus('not_found');
      return;
    }

    checkInvite();
  }, [token]);

  const checkInvite = async () => {
    try {
      // Fetch invite info
      const { data: invite, error } = await supabase
        .from('workspace_invites')
        .select(`
          *,
          workspaces:workspace_id (name)
        `)
        .eq('token', token)
        .maybeSingle();

      if (error || !invite) {
        setStatus('not_found');
        return;
      }

      // Check if already accepted
      if (invite.status === 'accepted') {
        setStatus('already_accepted');
        return;
      }

      // Check if expired
      if (new Date(invite.expires_at) < new Date() || invite.status === 'expired') {
        setStatus('expired');
        return;
      }

      // Check if revoked
      if (invite.status === 'revoked') {
        setStatus('not_found');
        return;
      }

      setInviteInfo({
        email: invite.email,
        workspaceName: (invite.workspaces as { name: string })?.name || 'Workspace',
        role: invite.role,
        expiresAt: invite.expires_at,
      });
      setStatus('valid');
    } catch (err) {
      console.error('Error checking invite:', err);
      setStatus('error');
    }
  };

  const handleAcceptInvite = async () => {
    if (!token) return;

    setIsAccepting(true);
    try {
      await acceptInvite.mutateAsync(token);
      navigate('/');
    } catch (err) {
      console.error('Error accepting invite:', err);
      setStatus('error');
    } finally {
      setIsAccepting(false);
    }
  };

  const handleGoToLogin = () => {
    // Store invite token in sessionStorage for after login
    if (token) {
      sessionStorage.setItem('pending_invite_token', token);
    }
    navigate('/auth');
  };

  // Auto-accept after login if we have a pending invite
  useEffect(() => {
    if (user && !authLoading && status === 'valid') {
      const pendingToken = sessionStorage.getItem('pending_invite_token');
      if (pendingToken === token) {
        sessionStorage.removeItem('pending_invite_token');
        handleAcceptInvite();
      }
    }
  }, [user, authLoading, status]);

  if (authLoading || status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardContent className="py-12 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
            <p className="mt-4 text-muted-foreground">Verificando convite...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === 'not_found') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardContent className="py-12 text-center">
            <XCircle className="h-12 w-12 mx-auto text-destructive" />
            <h2 className="mt-4 text-lg font-semibold">Convite não encontrado</h2>
            <p className="mt-2 text-muted-foreground">
              Este link de convite não existe ou foi revogado.
            </p>
            <Button className="mt-6" onClick={() => navigate('/')}>
              Ir para o início
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === 'expired') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardContent className="py-12 text-center">
            <XCircle className="h-12 w-12 mx-auto text-amber-500" />
            <h2 className="mt-4 text-lg font-semibold">Convite expirado</h2>
            <p className="mt-2 text-muted-foreground">
              Este convite já expirou. Solicite um novo convite ao administrador do workspace.
            </p>
            <Button className="mt-6" onClick={() => navigate('/')}>
              Ir para o início
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === 'already_accepted') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardContent className="py-12 text-center">
            <CheckCircle2 className="h-12 w-12 mx-auto text-primary" />
            <h2 className="mt-4 text-lg font-semibold">Convite já aceito</h2>
            <p className="mt-2 text-muted-foreground">
              Este convite já foi aceito anteriormente.
            </p>
            <Button className="mt-6" onClick={() => navigate('/')}>
              Acessar workspace
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardContent className="py-12 text-center">
            <XCircle className="h-12 w-12 mx-auto text-destructive" />
            <h2 className="mt-4 text-lg font-semibold">Erro ao processar convite</h2>
            <p className="mt-2 text-muted-foreground">
              Ocorreu um erro ao processar o convite. Tente novamente.
            </p>
            <Button className="mt-6" onClick={() => window.location.reload()}>
              Tentar novamente
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Valid invite
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <Mail className="h-6 w-6 text-primary" />
          </div>
          <CardTitle>Você foi convidado!</CardTitle>
          <CardDescription>
            Você foi convidado para participar do workspace
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="p-4 rounded-lg bg-muted/50 space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Workspace:</span>
              <span className="font-medium">{inviteInfo?.workspaceName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Função:</span>
              <span className="font-medium capitalize">{inviteInfo?.role}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Email:</span>
              <span className="font-medium">{inviteInfo?.email}</span>
            </div>
          </div>

          {user ? (
            <Button 
              className="w-full" 
              size="lg" 
              onClick={handleAcceptInvite}
              disabled={isAccepting}
            >
              {isAccepting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Aceitando...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Aceitar Convite
                </>
              )}
            </Button>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-center text-muted-foreground">
                Faça login ou crie uma conta para aceitar o convite
              </p>
              <Button className="w-full" size="lg" onClick={handleGoToLogin}>
                <LogIn className="h-4 w-4 mr-2" />
                Fazer Login / Criar Conta
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
