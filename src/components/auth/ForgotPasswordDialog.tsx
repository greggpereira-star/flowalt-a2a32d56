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
      <DialogContent className="overflow-hidden border-border/60 p-0 sm:max-w-md">
        {/* Premium accent header */}
        <div className="relative overflow-hidden px-6 pt-6 pb-5">
          <div
            className="absolute inset-x-0 -top-16 h-40 opacity-70 blur-3xl"
            style={{ background: 'var(--gradient-brand)' }}
          />
          <div className="absolute inset-0 flowalt-grid opacity-[0.08]" />
          <div className="relative flex items-start gap-4">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-gradient shadow-brand ring-1 ring-inset ring-white/20">
              <Mail className="h-5 w-5 text-white" />
            </div>
            <DialogHeader className="space-y-1 text-left">
              <DialogTitle className="text-lg font-semibold tracking-tight">
                Esqueceu sua senha?
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                Informe seu email e enviaremos um link seguro para redefinir sua senha.
              </DialogDescription>
            </DialogHeader>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 border-t border-border/50 bg-muted/30 px-6 py-5">
          <div className="space-y-2">
            <Label htmlFor="forgot-email" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
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
              className="h-11 bg-background"
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
          <p className="text-center text-[11px] leading-relaxed text-muted-foreground">
            Por segurança, o link expira em 60 minutos.
          </p>
        </form>
      </DialogContent>
    </Dialog>
  );
};
