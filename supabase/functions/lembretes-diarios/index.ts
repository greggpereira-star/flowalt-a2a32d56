// Resumo diário de lembretes (Onda 6): UMA notificação por pessoa por dia, só quando há o que dizer.
//
// Roda por agendador (pg_cron + pg_net), de segunda a sexta, às 9h de São Paulo. As regras (degraus de repetição,
// escalada para a coordenação, um aviso por dia) moram em ./regras.ts e têm testes. Aqui só se lê, se chama a regra
// e se grava: a notificação do app e o registro do que foi lembrado (lembretes_enviados).
//
// Só notificação dentro do app. Respeita user_notification_preferences.notify_cards = false.
// Proteção: exige a chave de serviço no cabeçalho Authorization. dry_run=1 só conta, não grava nada (force=1 junto
// ignora o horário, só para teste).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { montarResumos, type CardAberto, type Enviado, type Vinculo } from "./regras.ts";

const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ENCERRADOS = ["delivered", "approved", "archived"];
const PAPEIS_DE_COORDENACAO = ["super_admin", "owner", "admin", "coordinator"];
const JANELA_REGISTRO_DIAS = 120;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function agoraEmSP() {
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo", weekday: "short", hour: "numeric", hour12: false, year: "numeric", month: "numeric", day: "numeric",
  }).formatToParts(new Date());
  const get = (t: string) => partes.find((p) => p.type === t)?.value ?? "";
  const dia = get("weekday");
  const hora = Number(get("hour")) % 24;
  // Meia-noite de São Paulo em UTC (o Brasil não usa horário de verão desde 2019: UTC-3 fixo)
  const inicioDoDia = new Date(Date.UTC(Number(get("year")), Number(get("month")) - 1, Number(get("day")), 3, 0, 0));
  return { diaUtil: !["Sat", "Sun"].includes(dia), hora, inicioDoDia };
}

const em = <T>(xs: T[], n: number): T[][] => {
  const saida: T[][] = [];
  for (let i = 0; i < xs.length; i += n) saida.push(xs.slice(i, i + n));
  return saida;
};

Deno.serve(async (req) => {
  if ((req.headers.get("authorization") || "") !== `Bearer ${SERVICE_KEY}`) return json({ error: "Não autorizado." }, 401);

  const url = new URL(req.url);
  const dryRun = url.searchParams.get("dry_run") === "1";
  const forcar = url.searchParams.get("force") === "1" && dryRun;
  const sp = agoraEmSP();
  if (!forcar && (!sp.diaUtil || sp.hora < 9 || sp.hora >= 18)) return json({ skipped: "fora do dia útil ou do horário comercial" });

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, SERVICE_KEY);
  const agora = new Date();
  const resumo = { workspaces: 0, resumos_pessoais: 0, resumos_equipe: 0, itens: 0, erros: 0, dry_run: dryRun };
  const amostra: unknown[] = [];

  try {
    const { data: workspaces, error: wErr } = await supabase.from("workspaces").select("id");
    if (wErr) throw wErr;

    for (const ws of workspaces ?? []) {
      resumo.workspaces++;

      const { data: cardsRaw } = await supabase
        .from("cards").select("id, title, due_date, space_id, status")
        .eq("workspace_id", ws.id).not("due_date", "is", null).not("status", "in", `(${ENCERRADOS.join(",")})`).limit(3000);
      const cards: CardAberto[] = (cardsRaw ?? []).map((c: any) => ({ id: c.id, title: c.title, due_date: c.due_date, space_id: c.space_id }));

      const vinculos: Vinculo[] = [];
      for (const lote of em(cards.map((c) => c.id), 100)) {
        const { data } = await supabase.from("card_members").select("card_id, user_id").in("card_id", lote);
        (data ?? []).forEach((v: any) => vinculos.push({ card_id: v.card_id, user_id: v.user_id }));
      }

      const { data: membros } = await supabase.from("workspace_members").select("user_id").eq("workspace_id", ws.id).eq("is_active", true);
      const ativos = new Set<string>((membros ?? []).map((m: any) => m.user_id));

      const { data: papeis } = await supabase.from("user_roles").select("user_id, role").eq("workspace_id", ws.id).in("role", PAPEIS_DE_COORDENACAO);
      const admins = [...new Set<string>((papeis ?? []).map((p: any) => p.user_id))];

      const { data: pend } = await supabase
        .from("approval_requests").select("card_id, title, requested_by, created_at").eq("workspace_id", ws.id).eq("status", "pending");
      const aprovacoes = (pend ?? []) as any[];

      const desde = new Date(agora.getTime() - JANELA_REGISTRO_DIAS * 86_400_000).toISOString();
      const { data: env } = await supabase
        .from("lembretes_enviados").select("card_id, user_id, tipo, enviado_em").eq("workspace_id", ws.id).gte("enviado_em", desde).limit(20000);
      const enviados = (env ?? []) as Enviado[];

      const { data: prefs } = await supabase.from("user_notification_preferences").select("user_id").eq("notify_cards", false);
      const semAvisoDeCards = new Set<string>((prefs ?? []).map((p: any) => p.user_id));

      const { data: hoje } = await supabase
        .from("notifications").select("user_id, metadata").eq("workspace_id", ws.id).eq("type", "lembrete").gte("created_at", sp.inicioDoDia.toISOString());
      const jaHoje = new Set<string>((hoje ?? []).map((n: any) => `${n.user_id}:${n.metadata?.escopo ?? "pessoal"}`));

      const { resumos, registrar } = montarResumos({ agora, cards, vinculos, aprovacoes, admins, ativos, enviados, semAvisoDeCards, jaHoje });

      for (const r of resumos) {
        r.escopo === "pessoal" ? resumo.resumos_pessoais++ : resumo.resumos_equipe++;
        resumo.itens += r.itens.length;
        if (dryRun && amostra.length < 10) amostra.push({ workspace: ws.id, user_id: r.user_id, escopo: r.escopo, mensagem: r.mensagem });
      }
      if (dryRun || resumos.length === 0) continue;

      const linhas = resumos.map((r) => ({
        user_id: r.user_id,
        workspace_id: ws.id,
        type: "lembrete",
        title: r.titulo,
        message: r.mensagem,
        metadata: {
          escopo: r.escopo,
          itens: r.itens,
          // com um item só, o toque na notificação abre o card; com vários, abre a lista de tarefas
          ...(r.itens.length === 1 ? { card_id: r.itens[0].card_id } : {}),
        },
      }));
      const { error: nErr } = await supabase.from("notifications").insert(linhas);
      if (nErr) {
        console.error("notificacoes falharam", nErr.message);
        resumo.erros++;
        continue; // sem notificação não se registra: amanhã tenta de novo
      }
      const { error: lErr } = await supabase.from("lembretes_enviados").insert(registrar.map((x) => ({ ...x, workspace_id: ws.id })));
      if (lErr) { console.error("registro falhou", lErr.message); resumo.erros++; }
    }
  } catch (e) {
    console.error("lembretes-diarios falhou", e);
    return json({ error: String((e as Error)?.message ?? e), ...resumo }, 500);
  }

  return json({ ...resumo, ...(dryRun ? { amostra } : {}) });
});
