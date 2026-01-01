import { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ExternalLink, ShieldCheck } from "lucide-react";

export default function PluggyOAuthCallback() {
  const [didAttemptClose, setDidAttemptClose] = useState(false);

  const canonical = useMemo(() => {
    if (typeof window === "undefined") return "/pluggy/oauth/callback";
    return `${window.location.origin}/pluggy/oauth/callback`;
  }, []);

  useEffect(() => {
    // If the OAuth flow opened a popup/tab, Pluggy may close it automatically on desktop.
    // We still try to close it to improve UX.
    const t = window.setTimeout(() => {
      setDidAttemptClose(true);
      try {
        window.close();
      } catch {
        // ignore
      }
    }, 1200);

    return () => window.clearTimeout(t);
  }, []);

  return (
    <>
      <Helmet>
        <title>Conexão bancária concluída | FlowAgency</title>
        <meta
          name="description"
          content="Retorno de autorização bancária: finalize a conexão e volte para o FlowAgency." 
        />
        <link rel="canonical" href={canonical} />
      </Helmet>

      <main className="min-h-screen bg-background">
        <section className="mx-auto flex max-w-2xl flex-col gap-6 px-6 py-12">
          <header className="space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              Autorização concluída
            </h1>
            <p className="text-sm text-muted-foreground">
              Você já pode voltar para o app para finalizar a conexão da conta.
            </p>
          </header>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldCheck className="h-4 w-4 text-primary" />
                Pode fechar esta janela
              </CardTitle>
              <CardDescription>
                Se esta aba não fechar sozinha, volte manualmente para o app.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <Button asChild className="w-full">
                <a href="/financial">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Voltar para o Financeiro
                </a>
              </Button>

              {didAttemptClose && (
                <p className="text-xs text-muted-foreground">
                  Se você foi redirecionado aqui no celular, é normal a aba não fechar automaticamente.
                </p>
              )}
            </CardContent>
          </Card>
        </section>
      </main>
    </>
  );
}
