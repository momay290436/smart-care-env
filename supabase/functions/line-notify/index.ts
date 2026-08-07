import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const DEFAULT_LINE_GROUP_ID = "Cb126126f5369ab6272ba2775e35c0641";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const parseRecipientList = (recipients: unknown) => {
  if (Array.isArray(recipients)) return recipients.map((item) => String(item).trim()).filter(Boolean);
  if (typeof recipients === "string") return recipients.split(/[\n,]/).map((item) => item.trim()).filter(Boolean);
  return [];
};

export const resolveRecipients = (rows: any[], topic: string) => {
  const recipients = Array.from(new Set(
    (rows || [])
      .filter((r) => r.is_active !== false)
      .filter((r) => !topic || !Array.isArray(r.topics) || r.topics.length === 0 || r.topics.includes(topic))
      .map((r) => String(r.line_user_id || "").trim())
      .filter(Boolean),
  ));

  return recipients.includes(DEFAULT_LINE_GROUP_ID)
    ? recipients
    : [...recipients, DEFAULT_LINE_GROUP_ID];
};

export const pushLine = async (token: string, recipients: string[], text: string) => {
  const url = recipients.length > 0
    ? "https://api.line.me/v2/bot/message/multicast"
    : "https://api.line.me/v2/bot/message/broadcast";
  const body = recipients.length > 0
    ? { to: recipients.slice(0, 500), messages: [{ type: "text", text }] }
    : { messages: [{ type: "text", text }] };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const responseBody = await res.text();
  if (!res.ok) {
    console.error(`LINE push failed [${res.status}]: ${responseBody}`);
    throw new Error(`[${res.status}] ${responseBody}`);
  }
  return { status: res.status, body: responseBody };
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const message = body?.message;
    const topic = String(body?.topic || "");
    const explicit = parseRecipientList(body?.recipient_ids || body?.recipients);

    if (!message) {
      return new Response(JSON.stringify({ error: "ไม่มีข้อความ" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: settings } = await supabase.from("app_settings").select("key, value").eq("key", "line_channel_token");
    const channelToken = (settings || [])[0]?.value?.trim() || Deno.env.get("LINE_CHANNEL_ACCESS_TOKEN") || "";

    if (!channelToken) {
      return new Response(JSON.stringify({ sent: false, reason: "no_channel_token" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let recipients = explicit;
    if (recipients.length === 0) {
      const { data: rows } = await supabase
        .from("notification_recipients")
        .select("line_user_id, topics, is_active");
      recipients = resolveRecipients(rows || [], topic);
    }

    if (recipients.length === 0) {
      return new Response(JSON.stringify({ sent: false, reason: "no_recipients", topic }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await pushLine(channelToken, recipients, message);
    return new Response(JSON.stringify({ sent: true, recipients: recipients.length, result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("line-notify error:", error);
    return new Response(JSON.stringify({ sent: false, error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
