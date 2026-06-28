const RESEND_API_KEY = Deno.env.get("RESEND_FLOWALT") || Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const headers = { Authorization: `Bearer ${RESEND_API_KEY}` };

  // Get last 5 sent emails
  const { data: logs } = await supabase
    .from("email_notifications_log")
    .select("email, notification_type, resend_id, status, created_at")
    .eq("status", "sent")
    .not("resend_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(5);

  const results = [];
  for (const log of logs || []) {
    try {
      const r = await fetch(`https://api.resend.com/emails/${log.resend_id}`, { headers });
      const data = await r.json();
      results.push({
        recipient: log.email,
        type: log.notification_type,
        sent_at: log.created_at,
        resend_status: data.last_event || data.status || data,
        from: data.from,
        to: data.to,
      });
    } catch (e: any) {
      results.push({ recipient: log.email, error: e.message });
    }
  }

  return new Response(JSON.stringify({ results }, null, 2), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
