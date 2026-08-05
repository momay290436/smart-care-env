import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type LineRoute = {
  id?: string;
  scopeType?: "department" | "role" | "all";
  scopeValue?: string;
  provider?: "line_notify_token" | "line_channel_token";
  token?: string;
  recipients?: string | string[];
};

const parseRecipientList = (recipients: unknown) => {
  if (Array.isArray(recipients)) return recipients.map((item) => String(item).trim()).filter(Boolean);
  if (typeof recipients === "string") {
    return recipients.split(/[\n,]/).map((item) => item.trim()).filter(Boolean);
  }
  return [];
};

const normalizeRoutes = (value: unknown): LineRoute[] => {
  if (!value || typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  } catch {
    return [];
  }
};

const getSetting = (settings: { key: string; value: string }[] | null, key: string) =>
  (settings || []).find((item) => item.key === key)?.value || "";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const message = body?.message;
    const departmentId = body?.department_id || "";
    const role = body?.role || "";
    const explicitRecipients = parseRecipientList(body?.recipient_ids || body?.recipients);

    if (!message) {
      return new Response(JSON.stringify({ error: "ไม่มีข้อความ" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: settings } = await supabase
      .from("app_settings")
      .select("key, value")
      .in("key", ["line_notify_token", "line_channel_token", "line_notification_routes"]);

    const notifyToken = getSetting(settings || [], "line_notify_token");
    const channelToken = getSetting(settings || [], "line_channel_token");
    const routeSettings = normalizeRoutes(getSetting(settings || [], "line_notification_routes"));

    const matchedRoutes = routeSettings.filter((route) => {
      const scopeType = route.scopeType || "all";
      const scopeValue = route.scopeValue || "";
      if (scopeType === "all") return true;
      if (scopeType === "department") return scopeValue === departmentId;
      if (scopeType === "role") return scopeValue === role;
      return false;
    });

    const sendNotify = async (token: string, text: string) => {
      const res = await fetch("https://notify-api.line.me/api/notify", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Bearer ${token}`,
        },
        body: `message=${encodeURIComponent("\n" + text)}`,
      });

      const result = await res.json();
      if (!res.ok) throw new Error(JSON.stringify(result));
      return result;
    };

    const sendChannelPush = async (token: string, recipients: string[], text: string) => {
      if (recipients.length === 0) {
        const res = await fetch("https://api.line.me/v2/bot/message/broadcast", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ messages: [{ type: "text", text }] }),
        });
        const result = await res.text();
        if (!res.ok) throw new Error(result);
        return { broadcast: true, result };
      }

      const res = await fetch("https://api.line.me/v2/bot/message/multicast", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ to: recipients.slice(0, 500), messages: [{ type: "text", text }] }),
      });

      const result = await res.text();
      if (!res.ok) throw new Error(result);
      return { multicast: true, result };
    };

    if (matchedRoutes.length > 0) {
      const results: Record<string, unknown>[] = [];

      for (const route of matchedRoutes) {
        const recipients = explicitRecipients.length > 0 ? explicitRecipients : parseRecipientList(route.recipients);
        const token = route.token?.trim();
        if (!token) continue;

        if (route.provider === "line_channel_token") {
          const result = await sendChannelPush(token, recipients, message);
          results.push({ route: route.id || route.scopeValue || "channel", result });
        } else {
          const result = await sendNotify(token, message);
          results.push({ route: route.id || route.scopeValue || "notify", result });
        }
      }

      return new Response(JSON.stringify({ sent: true, routes: results.length, message }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (channelToken) {
      try {
        const result = await sendChannelPush(channelToken, explicitRecipients, message);
        return new Response(JSON.stringify({ sent: true, provider: "line_channel_token", result }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (error) {
        console.error("channel send failed", error);
      }
    }

    if (notifyToken) {
      const result = await sendNotify(notifyToken, message);
      return new Response(JSON.stringify({ sent: true, provider: "line_notify_token", result }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "ยังไม่ได้ตั้งค่า Line Token" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
