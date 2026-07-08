import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Mail } from 'lucide-react';
import { z } from 'zod';

const emailSchema = z.string().email('Email inválido');

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultEmail?: string;
}

export const ForgotPasswordDialog: React.FC<Props> = ({ open, onOpenChange, defaultEmail }) => {
  const { toast } = useToast();
  const [email, setEmail] = useState(defaultEmail || '');
  const [isLoading, setIsLoading] = useState(false);

  React.useEffect(() => {
    if (open && defaultEmail) setEmail(defaultEmail);
  }, [open, defaultEmail]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      emailSchema.parse(email);
    } catch (err) {
      if (err instanceof z.ZodError) {
        toast({ title: 'Erro', description: err.errors[0].message, variant: 'destructive' });
        return;
      }
    }

    setIsLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setIsLoading(false);

    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
      return;
    }

    toast({
      title: 'Email enviado',
      description: 'Se este email estiver cadastrado, você receberá um link para redefinir sua senha.',
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden border-white/10 bg-transparent p-0 text-white sm:max-w-md">
        {/* Layered premium dark background — matches Auth left panel */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,#0f1024_0%,#07070c_55%,#050509_100%)]" />
        <div
          className="absolute -left-20 -top-16 h-64 w-64 rounded-full opacity-60 blur-[90px]"
          style={{ background: 'radial-gradient(circle, hsl(var(--brand-blue) / 0.55), transparent 70%)' }}
        />
        <div
          className="absolute -right-16 -bottom-20 h-64 w-64 rounded-full opacity-50 blur-[90px]"
          style={{ background: 'radial-gradient(circle, hsl(var(--brand-magenta) / 0.5), transparent 70%)' }}
        />
        <div className="absolute inset-0 flowalt-grid opacity-[0.12]" />

        <div className="relative">
          <div className="px-6 pt-6 pb-5">
            <div className="flex items-start gap-4">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-gradient shadow-brand ring-1 ring-inset ring-white/20">
                <Mail className="h-5 w-5 text-white" />
              </div>
              <DialogHeader className="space-y-1 text-left">
                <DialogTitle className="text-lg font-semibold tracking-tight text-white">
                  Esqueceu sua senha?
                </DialogTitle>
                <DialogDescription className="text-sm text-white/60">
                  Informe seu email e enviaremos um link seguro para redefinir sua senha.
                </DialogDescription>
              </DialogHeader>
            </div>
          </div>

          <form
            onSubmit={handleSubmit}
            className="space-y-5 border-t border-white/10 bg-white/[0.02] px-6 py-5 backdrop-blur-md"
          >
            <div className="space-y-2">
              <Label
                htmlFor="forgot-email"
                className="text-[11px] font-medium uppercase tracking-[0.14em] text-white/50"
              >
                Email
              </Label>
              <Input
                id="forgot-email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                autoFocus
                className="h-11 border-white/10 bg-white/[0.04] text-white placeholder:text-white/30 focus-visible:border-white/20 focus-visible:ring-0"
              />
            </div>
            <Button
              type="submit"
              className="h-11 w-full bg-brand-gradient text-white shadow-brand hover:opacity-95"
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Mail className="mr-2 h-4 w-4" />
              )}
              Enviar link de recuperação
            </Button>
            <p className="text-center text-[11px] leading-relaxed text-white/40">
              Por segurança, o link expira em 60 minutos.
            </p>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
};
