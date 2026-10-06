// Portal do cliente: funcao publica (sem login) que mostra ao cliente o que esta aguardando a resposta dele, o historico
// de decisoes, o calendario de publicacoes e um resumo do mes.
//
// Seguranca:
//  - o link tem 32 bytes aleatorios e so o SHA-256 dele existe no banco;
//  - link invalido ou revogado devolve sempre a mesma resposta;
//  - SO sai o que ja foi enviado ao cliente em um pedido de aprovacao (ou ja foi publicado): cards ainda em
//    planejamento interno, comentarios internos, anexos e notas da equipe nunca saem daqui;
//  - o titulo mostrado e o do pedido (escrito para o cliente), nao o titulo interno do card;
//  - nenhum id de card ou de usuario vai na resposta; os ids de pedido servem para abrir a aprovacao pelo proprio portal.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const NAO_DISPONIVEL = "Este link não está mais disponível. Peça um novo link a quem enviou.";
const TOKEN_RE = /^[A-Za-z0-9_-]{40,128}$/;
const DIA_MS = 86_400_000;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" } });
}
function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}
async function sha256Hex(text: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

const tentativas = new Map<string, { n: number; desde: number }>();
function estourouLimite(ip: string): boolean {
  const agora = Date.now();
  const t = tentativas.get(ip);
  if (!t || agora - t.desde > 10 * 60_000) { tentativas.set(ip, { n: 1, desde: agora }); return false; }
  t.n += 1;
  return t.n > 90;
}

const hojeSP = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
const somaDias = (data: string, dias: number) => new Date(Date.parse(data + "T00:00:00Z") + dias * DIA_MS).toISOString().slice(0, 10);
const dataDe = (v: string | null | undefined) => (/^\d{4}-\d{2}-\d{2}/.test((v ?? "").trim()) ? (v as string).trim().slice(0, 10) : null);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido." }, 405);
  if (estourouLimite(clientIp(req))) return json({ error: "Muitas tentativas. Aguarde alguns minutos." }, 429);

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    const body = await req.json().catch(() => ({}));
    const token = typeof body.token === "string" ? body.token : "";
    if (!TOKEN_RE.test(token)) return json({ error: NAO_DISPONIVEL }, 404);

    const { data: acesso } = await supabase
      .from("client_portal_access").select("*").eq("token_hash", await sha256Hex(token)).is("revoked_at", null).maybeSingle();
    if (!acesso) return json({ error: NAO_DISPONIVEL }, 404);

    // Visita contada no maximo uma vez a cada 10 minutos
    const ultima = acesso.last_seen_at ? new Date(acesso.last_seen_at).getTime() : 0;
    if (Date.now() - ultima > 10 * 60_000) {
      await supabase.from("client_portal_access").update({ last_seen_at: new Date().toISOString(), view_count: (acesso.view_count || 0) + 1 }).eq("id", acesso.id);
    }

    const [{ data: cliente }, { data: ws }, { data: cards }] = await Promise.all([
      supabase.from("client_cards").select("name, logo_url, color").eq("id", acesso.client_id).maybeSingle(),
      supabase.from("workspaces").select("name, logo_url, settings").eq("id", acesso.workspace_id).maybeSingle(),
      supabase.from("cards").select("id").eq("client_id", acesso.client_id).eq("workspace_id", acesso.workspace_id).limit(1000),
    ]);
    const cardIds = (cards ?? []).map((c: any) => c.id);

    let pedidos: any[] = [];
    let campos: any[] = [];
    if (cardIds.length) {
      const [r, c] = await Promise.all([
        supabase.from("approval_requests")
          .select("id, card_id, title, round, status, created_at, expires_at, decided_at, decided_by_name")
          .in("card_id", cardIds).in("status", ["pending", "approved", "changes_requested"]).order("created_at", { ascending: false }).limit(300),
        supabase.from("card_custom_fields").select("card_id, field_key, field_value").in("card_id", cardIds).in("field_key", ["post_date", "platform", "piece_type", "post_link"]),
      ]);
      pedidos = r.data ?? [];
      campos = c.data ?? [];
    }
    const porCard = new Map<string, Record<string, string>>();
    campos.forEach((c: any) => {
      const v = (c.field_value ?? "").trim();
      if (v) porCard.set(c.card_id, { ...(porCard.get(c.card_id) ?? {}), [c.field_key]: v });
    });

    const agora = Date.now();
    const pendentes = pedidos
      .filter((p) => p.status === "pending" && new Date(p.expires_at).getTime() > agora)
      .map((p) => ({ id: p.id, title: p.title, round: p.round, sent_at: p.created_at }));

    const historico = pedidos
      .filter((p) => p.status !== "pending")
      .sort((a, b) => (b.decided_at ?? "").localeCompare(a.decided_at ?? ""))
      .slice(0, 20)
      .map((p) => ({ id: p.id, title: p.title, round: p.round, status: p.status, decided_at: p.decided_at, decided_by_name: p.decided_by_name }));

    // Calendario: ultimo pedido de cada card (so o que ja foi enviado ao cliente), com a data de postagem do card
    const hoje = hojeSP();
    const de = somaDias(hoje, -30);
    const ate = somaDias(hoje, 90);
    const vistos = new Set<string>();
    const calendario: any[] = [];
    for (const p of pedidos) {
      if (vistos.has(p.card_id)) continue;
      vistos.add(p.card_id);
      const f = porCard.get(p.card_id) ?? {};
      const data = dataDe(f.post_date);
      if (!data || data < de || data > ate) continue;
      const publicado = !!(f.post_link && f.post_link.trim());
      const situacao = publicado ? "publicado"
        : p.status === "approved" ? "aprovado"
        : p.status === "changes_requested" ? "ajustes"
        : p.status === "pending" && new Date(p.expires_at).getTime() > agora ? "aguardando"
        : "aguardando";
      calendario.push({ title: p.title, date: data, type: f.piece_type ?? null, platform: f.platform ?? null, situation: situacao });
    }
    calendario.sort((a, b) => a.date.localeCompare(b.date));

    // Resumo do mes (em Sao Paulo)
    const mes = hoje.slice(0, 7);
    const resumo = {
      month: mes,
      approved: pedidos.filter((p) => p.status === "approved" && (p.decided_at ?? "").slice(0, 7) === mes).length,
      changes: pedidos.filter((p) => p.status === "changes_requested" && (p.decided_at ?? "").slice(0, 7) === mes).length,
      waiting: pendentes.length,
      published: calendario.filter((c) => c.situation === "publicado" && c.date.slice(0, 7) === mes).length,
    };

    return json({
      portal: {
        client: { name: cliente?.name ?? "Cliente", logo_url: cliente?.logo_url ?? null },
        agency: {
          name: ws?.name ?? null,
          logo_url: ws?.logo_url ?? null,
          brand_color: /^#[0-9a-fA-F]{6}$/.test(ws?.settings?.brand_color ?? "") ? ws.settings.brand_color : null,
        },
        pending: pendentes,
        history: historico,
        calendar: calendario,
        summary: resumo,
      },
    });
  } catch (e) {
    console.error("public-portal error", e);
    return json({ error: "Não foi possível carregar agora. Tente novamente em instantes." }, 500);
  }
});
