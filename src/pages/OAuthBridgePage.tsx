import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type MetaAuthType = "rerequest" | "reauthenticate";

const OAuthBridgePage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  const params = useMemo(() => {
    const platform = searchParams.get("platform") || "";
    const workspaceId = searchParams.get("workspace_id") || "";
    const returnPath = searchParams.get("return_path") || "/marketing";
    const scopeStrategy = searchParams.get("scope_strategy") || "connect";
    const metaAuthType = (searchParams.get("meta_auth_type") || "rerequest") as MetaAuthType;

    return { platform, workspaceId, returnPath, scopeStrategy, metaAuthType };
  }, [searchParams]);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        if (!params.platform || !params.workspaceId) {
          throw new Error("Parâmetros inválidos para autenticação.");
        }

        const resolvedReturnUrl = new URL(params.returnPath, window.location.origin).toString();

        const { data, error } = await supabase.functions.invoke("social-oauth-start", {
          body: {
            platform: params.platform,
            workspace_id: params.workspaceId,
            return_url: resolvedReturnUrl,
            scope_strategy: params.scopeStrategy,
            meta_auth_type: params.metaAuthType,
          },
        });

        if (cancelled) return;

        if (error) {
          throw new Error(error.message);
        }

        if (data?.auth_url) {
          // Top-level navigation (this page is opened in a new tab, not inside the editor iframe)
          window.location.href = data.auth_url;
          return;
        }

        throw new Error(data?.error_message || data?.message || "Não foi possível iniciar a autenticação.");
      } catch (e: any) {
        if (cancelled) return;
        setError(e?.message || "Falha ao iniciar autenticação");
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [params]);

  return (
    <main className="min-h-[70vh] flex items-center justify-center p-6">
      <Helmet>
        <title>Conectando conta…</title>
        <meta
          name="description"
          content="Aguarde enquanto abrimos a autenticação da plataforma em uma nova guia."
        />
        <link rel="canonical" href={`${window.location.origin}/oauth/bridge`} />
      </Helmet>

      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Conectando conta…</CardTitle>
          <CardDescription>
            Estamos abrindo a tela de login/autorização em seguida. Se nada acontecer, verifique bloqueadores de popup.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error ? (
            <div className="space-y-3">
              <p className="text-sm text-destructive">{error}</p>
              <div className="flex flex-col sm:flex-row gap-2">
                <Button variant="outline" onClick={() => navigate(params.returnPath)}>
                  Voltar
                </Button>
                <Button onClick={() => window.location.reload()}>Tentar novamente</Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Carregando…</p>
              <Button variant="outline" onClick={() => navigate(params.returnPath)}>
                Cancelar
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
};

export default OAuthBridgePage;
