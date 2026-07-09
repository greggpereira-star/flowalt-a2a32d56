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
import { Loader2, Mail, ShieldCheck } from 'lucide-react';
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
      <DialogContent className="overflow-hidden border border-border/60 bg-background p-0 sm:max-w-md">
        {/* Top accent bar */}
        <div className="relative h-1 w-full bg-brand-gradient" />

        {/* Header */}
        <div className="relative px-7 pt-7 pb-6">
          {/* subtle brand glow behind icon */}
          <div
            className="pointer-events-none absolute -left-10 -top-10 h-40 w-40 rounded-full opacity-40 blur-3xl"
            style={{ background: 'radial-gradient(circle, hsl(var(--brand-blue) / 0.35), transparent 70%)' }}
          />
          <div className="relative flex items-start gap-3.5">
            <div className="relative grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-gradient shadow-brand">
              <Mail className="h-4 w-4 text-white" />
            </div>
            <DialogHeader className="space-y-1 text-left">
              <DialogTitle className="text-base font-semibold tracking-tight">
                Esqueceu sua senha?
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                Informe seu email e enviaremos um link seguro para redefinir sua senha.
              </DialogDescription>
            </DialogHeader>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 border-t border-border/60 bg-muted/20 px-7 py-6">
          <div className="space-y-1.5">
            <Label htmlFor="forgot-email" className="text-xs font-medium text-muted-foreground">
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
              className="h-10"
            />
          </div>
          <Button type="submit" className="h-10 w-full" disabled={isLoading}>
            {isLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Mail className="mr-2 h-4 w-4" />
            )}
            Enviar link de recuperação
          </Button>
          <p className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground/80">
            <ShieldCheck className="h-3 w-3" />
            Link seguro · expira em 60 minutos
          </p>
        </form>
      </DialogContent>
    </Dialog>
  );
};
