import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ArrowRight, Sparkles, CheckCircle2, Zap, Workflow } from 'lucide-react';
import { FlowaltLogo } from '@/components/brand/FlowaltLogo';
import { ForgotPasswordDialog } from '@/components/auth/ForgotPasswordDialog';
import { z } from 'zod';

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres'),
});

const signupSchema = z.object({
  fullName: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Senhas não conferem',
  path: ['confirmPassword'],
});

const Auth: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signIn, signUp } = useAuth();
  const { toast } = useToast();
  
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('login');
  const [forgotOpen, setForgotOpen] = useState(false);
  
  // Login form
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  
  // Signup form
  const [signupName, setSignupName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupConfirmPassword, setSignupConfirmPassword] = useState('');

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      const from = (location.state as any)?.from;
      const pendingToken = sessionStorage.getItem('pending_invite_token');
      let redirectTo = '/';
      if (pendingToken) {
        redirectTo = `/invite/${pendingToken}`;
      } else if (from?.pathname) {
        redirectTo = `${from.pathname}${from.search || ''}`;
      }
      navigate(redirectTo, { replace: true });
    }
  }, [user, navigate, location]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      loginSchema.parse({ email: loginEmail, password: loginPassword });
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({
          title: 'Erro de validação',
          description: error.errors[0].message,
          variant: 'destructive',
        });
        return;
      }
    }

    setIsLoading(true);
    const { error } = await signIn(loginEmail, loginPassword);
    setIsLoading(false);

    if (error) {
      let message = 'Erro ao fazer login';
      if (error.message.includes('Invalid login credentials')) {
        message = 'Email ou senha incorretos';
      } else if (error.message.includes('Email not confirmed')) {
        message = 'Confirme seu email antes de fazer login';
      }
      toast({
        title: 'Erro',
        description: message,
        variant: 'destructive',
      });
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      signupSchema.parse({
        fullName: signupName,
        email: signupEmail,
        password: signupPassword,
        confirmPassword: signupConfirmPassword,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({
          title: 'Erro de validação',
          description: error.errors[0].message,
          variant: 'destructive',
        });
        return;
      }
    }

    setIsLoading(true);
    
    // Se temos um convite pendente, passamos o token no redirect para que após a confirmação do email
    // o usuário seja levado de volta para aceitar o convite.
    const pendingToken = sessionStorage.getItem('pending_invite_token');
    const redirectTo = pendingToken 
      ? `${window.location.origin}/invite/${pendingToken}`
      : `${window.location.origin}/`;

    const { error } = await signUp(signupEmail, signupPassword, signupName, redirectTo);
    setIsLoading(false);

    if (error) {
      let message = 'Erro ao criar conta';
      const errorMsg = error.message?.toLowerCase() || '';
      
      if (errorMsg.includes('user already registered') || errorMsg.includes('already been registered')) {
        message = 'Este email já está cadastrado. Tente fazer login.';
      } else if (errorMsg.includes('password') && errorMsg.includes('weak')) {
        message = 'A senha é muito fraca. Use pelo menos 6 caracteres.';
      } else if (errorMsg.includes('invalid') && errorMsg.includes('email')) {
        message = 'O email informado é inválido.';
      } else if (errorMsg.includes('rate limit') || errorMsg.includes('too many')) {
        message = 'Muitas tentativas. Aguarde um momento e tente novamente.';
      } else if (error.message) {
        message = error.message;
      }
      
      toast({
        title: 'Erro ao criar conta',
        description: message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Conta criada!',
        description: 'Você será redirecionado em instantes.',
      });
    }
  };

  return (
    <div className="relative flex min-h-screen w-full overflow-hidden bg-background">
      {/* ============ LEFT — Brand panel ============ */}
      <aside className="relative hidden w-1/2 flex-col justify-between overflow-hidden p-12 text-white lg:flex">
        {/* Layered premium background */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,#0f1024_0%,#07070c_55%,#050509_100%)]" />
        <div
          className="absolute -left-24 top-16 h-[520px] w-[520px] rounded-full opacity-60 blur-[120px]"
          style={{ background: 'radial-gradient(circle, hsl(var(--brand-blue) / 0.55), transparent 70%)' }}
        />
        <div
          className="absolute -right-16 bottom-8 h-[420px] w-[420px] rounded-full opacity-50 blur-[120px]"
          style={{ background: 'radial-gradient(circle, hsl(var(--brand-magenta) / 0.5), transparent 70%)' }}
        />
        <div className="absolute inset-0 flowalt-grid opacity-[0.18]" />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,transparent_0%,rgba(0,0,0,0.35)_100%)]" />

        <div className="relative z-10 flex items-center justify-between">
          <FlowaltLogo size={38} wordmarkClassName="text-white text-xl tracking-tight" />
          <span className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] font-medium uppercase tracking-[0.14em] text-white/60 backdrop-blur-md xl:inline-flex">
            <Sparkles className="h-3 w-3" />
            Premium
          </span>
        </div>

        <div className="relative z-10 max-w-lg space-y-10">
          <div className="space-y-6">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-medium tracking-wide text-white/75 backdrop-blur-md">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-gradient shadow-[0_0_10px_hsl(var(--brand-blue))]" />
              Fluxo de trabalho inteligente
            </span>
            <h1 className="text-[2.75rem] font-semibold leading-[1.05] tracking-[-0.02em] sm:text-[3.25rem]">
              Clareza, ação e progresso{' '}
              <span className="text-brand-gradient">sem atrito.</span>
            </h1>
            <p className="max-w-md text-[15px] leading-relaxed text-white/60">
              O Flowalt não é uma ferramenta que controla pessoas — é um sistema
              que organiza o trabalho. Três lâminas, um só fluxo.
            </p>
          </div>

          <ul className="space-y-2.5">
            {[
              { icon: Workflow, label: 'Etapas, processo e continuidade' },
              { icon: CheckCircle2, label: 'Do briefing à entrega — sem retrabalho' },
              { icon: Zap, label: 'Tecnologia humana, execução premium' },
            ].map(({ icon: Icon, label }) => (
              <li
                key={label}
                className="group flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3.5 py-2.5 text-sm text-white/80 backdrop-blur-md transition-colors hover:border-white/15 hover:bg-white/[0.04]"
              >
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-white/[0.04] ring-1 ring-inset ring-white/10">
                  <Icon className="h-3.5 w-3.5 text-white/90" />
                </span>
                <span className="tracking-tight">{label}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative z-10 flex items-center justify-between text-[11px] tracking-wide text-white/40">
          <span>© {new Date().getFullYear()} Flowalt · Alt Agency Partners</span>
          <span className="hidden items-center gap-1.5 xl:inline-flex">
            <span className="h-1 w-1 rounded-full bg-emerald-400/80 shadow-[0_0_8px_theme(colors.emerald.400)]" />
            Todos os sistemas operacionais
          </span>
        </div>
      </aside>

      {/* ============ RIGHT — Auth panel ============ */}
      <main className="relative flex w-full flex-1 items-center justify-center p-6 sm:p-10">
        {/* Ambient background for mobile */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden lg:hidden">
          <div className="flowalt-aurora opacity-30" />
        </div>

        <div className="relative w-full max-w-md animate-fade-in">
          <div className="mb-8 flex flex-col items-center gap-3 lg:hidden">
            <FlowaltLogo size={48} />
          </div>


        <Card className="border-border/50 shadow-lg">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-2xl font-semibold tracking-tight">
              {activeTab === 'login' ? 'Bem-vindo de volta' : 'Crie sua conta'}
            </CardTitle>
            <CardDescription>
              {activeTab === 'login'
                ? 'Entre com suas credenciais para continuar'
                : 'Preencha os dados abaixo para começar'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="mb-6 grid w-full grid-cols-2">
                <TabsTrigger value="login">Entrar</TabsTrigger>
                <TabsTrigger value="signup">Criar conta</TabsTrigger>
              </TabsList>

              <TabsContent value="login" className="space-y-4">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-email">Email</Label>
                    <Input
                      id="login-email"
                      type="email"
                      placeholder="seu@email.com"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      required
                      autoComplete="email"
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="login-password">Senha</Label>
                      <button
                        type="button"
                        onClick={() => setForgotOpen(true)}
                        className="text-xs font-medium text-primary hover:underline"
                      >
                        Esqueceu a senha?
                      </button>
                    </div>
                    <Input
                      id="login-password"
                      type="password"
                      placeholder="••••••••"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      required
                      autoComplete="current-password"
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <ArrowRight className="mr-2 h-4 w-4" />
                    )}
                    Entrar
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup" className="space-y-4">
                <form onSubmit={handleSignup} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-name">Nome completo</Label>
                    <Input
                      id="signup-name"
                      type="text"
                      placeholder="Seu nome"
                      value={signupName}
                      onChange={(e) => setSignupName(e.target.value)}
                      required
                      autoComplete="name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Email</Label>
                    <Input
                      id="signup-email"
                      type="email"
                      placeholder="seu@email.com"
                      value={signupEmail}
                      onChange={(e) => setSignupEmail(e.target.value)}
                      required
                      autoComplete="email"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Senha</Label>
                    <Input
                      id="signup-password"
                      type="password"
                      placeholder="••••••••"
                      value={signupPassword}
                      onChange={(e) => setSignupPassword(e.target.value)}
                      required
                      autoComplete="new-password"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-confirm">Confirmar senha</Label>
                    <Input
                      id="signup-confirm"
                      type="password"
                      placeholder="••••••••"
                      value={signupConfirmPassword}
                      onChange={(e) => setSignupConfirmPassword(e.target.value)}
                      required
                      autoComplete="new-password"
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <ArrowRight className="mr-2 h-4 w-4" />
                    )}
                    Criar conta
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Ao continuar, você concorda com nossos Termos de Uso e Política de Privacidade.
        </p>
        </div>
      </main>

      <ForgotPasswordDialog
        open={forgotOpen}
        onOpenChange={setForgotOpen}
        defaultEmail={loginEmail}
      />
    </div>
  );
};

export default Auth;
