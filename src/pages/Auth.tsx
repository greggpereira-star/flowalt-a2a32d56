import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ArrowRight, Sparkles } from 'lucide-react';
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
      const redirectTo = from ? `${from.pathname}${from.search || ''}` : '/';
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
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      {/* Background decoration */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-1/4 -top-1/4 h-1/2 w-1/2 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute -bottom-1/4 -right-1/4 h-1/2 w-1/2 rounded-full bg-primary/5 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md animate-fade-in">
        {/* Logo */}
        <div className="mb-8 text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-2xl bg-primary/10 px-4 py-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <span className="text-lg font-semibold text-primary">Flowalt</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Organize o trabalho, não controle pessoas.
          </p>
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
                    <Label htmlFor="login-password">Senha</Label>
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
    </div>
  );
};

export default Auth;
