import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAcceptWorkspaceInvite } from '@/hooks/useWorkspaceInvites';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { ROLE_LABELS } from '@/hooks/useEmailNotifications';
import {
  salvarConvitePendente,
  limparConvitePendente,
} from '@/lib/invites/pendingInvite';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle2, XCircle, Mail, LogIn, UserPlus, AlertTriangle } from 'lucide-react';

type InviteStatus =
  | 'loading'
  | 'valid'
  | 'expired'
  | 'revoked'
  | 'already_accepted'
  | 'not_found'
  | 'error';

interface InviteInfo {
  email: string;
  workspaceName: string;
  role: string;
  expiresAt: string;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function Aviso({
  icone,
  titulo,
  texto,
  botao,
  aoClicar,
}: {
  icone: React.ReactNode;
  titulo: string;
  texto: string;
  botao: string;
  aoClicar: () => void;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardContent className="py-12 text-center">
          {icone}
          <h2 className="mt-4 text-lg font-semibold">{titulo}</h2>
          <p className="mt-2 text-muted-foreground">{texto}</p>
          <Button className="mt-6" onClick={aoClicar}>
            {botao}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export default function AcceptInvitePage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading, signOut } = useAuth();
  const acceptInvite = useAcceptWorkspaceInvite();

  const [status, setStatus] = useState<InviteStatus>('loading');
  const [inviteInfo, setInviteInfo] = useState<InviteInfo | null>(null);
  const [isAccepting, setIsAccepting] = useState(false);
  const [acceptError, setAcceptError] = useState<string | null>(null);
  const autoTentado = useRef(false);

  useEffect(() => {
    if (!token || !UUID_REGEX.test(token)) {
      setStatus('not_found');
      return;
    }
    void checkInvite(token);
  }, [token]);

  const checkInvite = async (tk: string) => {
    try {
      // RPC SECURITY DEFINER: a tabela não fica exposta a quem ainda não tem conta.
      const { data: rows, error } = await (supabase as any).rpc('get_invite_by_token', { _token: tk });

      if (error) {
        console.error('Error fetching invite:', error);
        setStatus('error');
        return;
      }

      const invite = Array.isArray(rows) ? rows[0] : rows;
      if (!invite) {
        limparConvitePendente();
        setStatus('not_found');
        return;
      }

      // Convite que não serve mais não pode ficar guardado: senão, no próximo login,
      // a pessoa seria levada de volta a uma tela sem saída.
      if (invite.status === 'accepted') {
        limparConvitePendente();
        setStatus('already_accepted');
        return;
      }
      if (invite.status === 'revoked' || invite.revoked_at) {
        limparConvitePendente();
        setStatus('revoked');
        return;
      }
      if (new Date(invite.expires_at) < new Date() || invite.status === 'expired') {
        limparConvitePendente();
        setStatus('expired');
        return;
      }

      setInviteInfo({
        email: String(invite.email || '').toLowerCase(),
        workspaceName: invite.workspace_name || 'Workspace',
        role: invite.role,
        expiresAt: invite.expires_at,
      });
      setStatus('valid');
    } catch (err) {
      console.error('Error checking invite:', err);
      setStatus('error');
    }
  };

  const emailConfere =
    !!user?.email && !!inviteInfo && user.email.toLowerCase() === inviteInfo.email;

  const handleAcceptInvite = async () => {
    if (!token) return;
    setIsAccepting(true);
    setAcceptError(null);
    try {
      await acceptInvite.mutateAsync(token);
      limparConvitePendente();
      navigate('/', { replace: true });
    } catch (err) {
      // Fica na própria tela com o motivo, em vez de trocá-la por um erro genérico
      // que só oferecia "tentar de novo" e repetia a mesma falha.
      setAcceptError(err instanceof Error ? err.message : 'Não foi possível aceitar o convite.');
    } finally {
      setIsAccepting(false);
    }
  };

  // Aceita sozinho só quando a conta logada é a do convite. Antes aceitava também por
  // ter o token guardado, mesmo com e-mail diferente, e o resultado era uma tela de erro.
  useEffect(() => {
    if (user && !authLoading && status === 'valid' && emailConfere && !autoTentado.current) {
      autoTentado.current = true;
      void handleAcceptInvite();
    }
  }, [user, authLoading, status, emailConfere]);

  const irParaAuth = (aba: 'login' | 'signup') => {
    if (!token || !inviteInfo) return;
    salvarConvitePendente(token, inviteInfo.email);
    navigate('/auth', {
      state: {
        from: { pathname: `/invite/${token}`, search: '' },
        tab: aba,
        inviteEmail: inviteInfo.email,
        inviteWorkspace: inviteInfo.workspaceName,
      },
    });
  };

  const trocarDeConta = async () => {
    await signOut();
    irParaAuth('login');
  };

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
      <Aviso
        icone={<XCircle className="h-12 w-12 mx-auto text-destructive" />}
        titulo="Convite não encontrado"
        texto="Este link de convite não existe. Confira se o link foi copiado inteiro ou peça um novo convite."
        botao="Ir para o início"
        aoClicar={() => navigate('/')}
      />
    );
  }

  if (status === 'revoked') {
    return (
      <Aviso
        icone={<XCircle className="h-12 w-12 mx-auto text-destructive" />}
        titulo="Convite cancelado"
        texto="Este convite foi cancelado por quem o enviou, normalmente porque um novo convite foi criado no lugar. Procure o e-mail ou a mensagem mais recente, ou peça um novo convite."
        botao="Ir para o início"
        aoClicar={() => navigate('/')}
      />
    );
  }

  if (status === 'expired') {
    return (
      <Aviso
        icone={<XCircle className="h-12 w-12 mx-auto text-destructive" />}
        titulo="Convite expirado"
        texto="Este convite passou da validade de 7 dias. Peça para quem te convidou enviar um novo."
        botao="Ir para o início"
        aoClicar={() => navigate('/')}
      />
    );
  }

  if (status === 'already_accepted') {
    return (
      <Aviso
        icone={<CheckCircle2 className="h-12 w-12 mx-auto text-primary" />}
        titulo="Convite já aceito"
        texto="Este convite já foi aceito. É só entrar com seu e-mail e senha."
        botao="Acessar workspace"
        aoClicar={() => navigate('/')}
      />
    );
  }

  if (status === 'error') {
    return (
      <Aviso
        icone={<XCircle className="h-12 w-12 mx-auto text-destructive" />}
        titulo="Não foi possível verificar o convite"
        texto="Houve uma falha de conexão ao consultar o convite. Verifique sua internet e tente de novo."
        botao="Tentar novamente"
        aoClicar={() => window.location.reload()}
      />
    );
  }

  const funcao = ROLE_LABELS[inviteInfo?.role || ''] || inviteInfo?.role;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <Mail className="h-6 w-6 text-primary" />
          </div>
          <CardTitle>Você foi convidado!</CardTitle>
          <CardDescription>Você foi convidado para participar do workspace</CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="p-4 rounded-lg bg-muted/50 space-y-2">
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Workspace:</span>
              <span className="font-medium text-right">{inviteInfo?.workspaceName}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Função:</span>
              <span className="font-medium text-right">{funcao}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">E-mail:</span>
              <span className="font-medium text-right break-all">{inviteInfo?.email}</span>
            </div>
          </div>

          {!user && (
            <div className="space-y-3">
              <p className="text-sm text-center text-muted-foreground">
                Use exatamente o e-mail acima. O convite só funciona para ele.
              </p>
              <Button className="w-full" size="lg" onClick={() => irParaAuth('signup')}>
                <UserPlus className="h-4 w-4 mr-2" />
                Criar minha conta
              </Button>
              <Button className="w-full" variant="outline" size="lg" onClick={() => irParaAuth('login')}>
                <LogIn className="h-4 w-4 mr-2" />
                Já tenho conta, entrar
              </Button>
            </div>
          )}

          {user && emailConfere && (
            <div className="space-y-3">
              <Button className="w-full" size="lg" onClick={handleAcceptInvite} disabled={isAccepting}>
                {isAccepting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Aceitando...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Aceitar convite
                  </>
                )}
              </Button>
              {acceptError && (
                <p role="alert" className="text-sm text-center text-destructive">
                  {acceptError}
                </p>
              )}
            </div>
          )}

          {user && !emailConfere && (
            <div className="space-y-3">
              <div
                role="alert"
                className="flex gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200"
              >
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                <p>
                  Você está conectado como <strong className="break-all">{user.email}</strong>, mas este convite é
                  para <strong className="break-all">{inviteInfo?.email}</strong>.
                </p>
              </div>
              <Button className="w-full" size="lg" onClick={trocarDeConta}>
                <LogIn className="h-4 w-4 mr-2" />
                Sair e entrar com o e-mail do convite
              </Button>
              <Button
                className="w-full"
                variant="ghost"
                onClick={() => {
                  limparConvitePendente();
                  navigate('/');
                }}
              >
                Continuar com minha conta atual
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
