import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Alert = { level: "warn" | "bad"; text: string };

const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const today = new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10); // Asia/Bangkok
    const alerts: Alert[] = [];

    // 1) Daily wastewater inspection
    const { data: insp } = await supabase
      .from("wastewater_inspection_logs")
      .select("check_date, chlorine_residual, ph_value, do_value, water_appearance, treatment_odor")
      .eq("check_date", today);

    for (const r of insp || []) {
      const cl = num(r.chlorine_residual);
      if (cl !== null && (cl < 0.2 || cl > 0.5)) {
        alerts.push({ level: cl < 0.1 || cl > 1 ? "bad" : "warn", text: `บำบัดน้ำเสีย: คลอรีน ${cl} mg/L (เกณฑ์ 0.2–0.5)` });
      }
      const ph = num(r.ph_value);
      if (ph !== null && (ph < 6.5 || ph > 8.5)) {
        alerts.push({ level: ph < 6 || ph > 9 ? "bad" : "warn", text: `บำบัดน้ำเสีย: pH ${ph} (เกณฑ์ 6.5–8.5)` });
      }
      const dov = num(r.do_value);
      if (dov !== null && dov < 2) {
        alerts.push({ level: dov < 1 ? "bad" : "warn", text: `บำบัดน้ำเสีย: DO ${dov} mg/L (ต่ำกว่า 2)` });
      }
      if (r.treatment_odor) alerts.push({ level: "warn", text: "บำบัดน้ำเสีย: พบกลิ่นผิดปกติ" });
    }

    // 2) Pathogen tests
    const { data: patho } = await supabase
      .from("water_pathogen_logs")
      .select("sample_point, check_date, status, total_coliform, e_coli, chlorine_value")
      .eq("check_date", today);

    for (const r of patho || []) {
      const found = r.total_coliform === "found" || r.e_coli === "found";
      if (found) {
        alerts.push({ level: "bad", text: `ตรวจเชื้อ ${r.sample_point}: พบ${r.e_coli === "found" ? " E.coli" : ""}${r.total_coliform === "found" ? " Coliform" : ""}` });
      } else if (r.status !== "pass") {
        const cl = num(r.chlorine_value);
        alerts.push({ level: "warn", text: `ตรวจเชื้อ ${r.sample_point}: ไม่ผ่านเกณฑ์${cl !== null ? ` (คลอรีน ${cl})` : ""}` });
      }
    }

    // 3) Water quality checkpoints
    const { data: wq } = await supabase
      .from("water_quality_logs")
      .select("check_point, check_date, status, ph_value, chlorine_value")
      .eq("check_date", today);

    for (const r of wq || []) {
      if (r.status && r.status !== "pass" && r.status !== "normal") {
        alerts.push({ level: r.status === "fail" ? "bad" : "warn", text: `คุณภาพน้ำ ${r.check_point}: ${r.status === "fail" ? "ผิดปกติ" : "ควรเฝ้าระวัง"}` });
      }
    }

    if (alerts.length === 0) {
      return new Response(JSON.stringify({ sent: false, reason: "no_anomaly", date: today }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const bad = alerts.filter((a) => a.level === "bad");
    const warn = alerts.filter((a) => a.level === "warn");
    const dateTh = new Date(today).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" });

    const lines: string[] = [`🚱 แจ้งเตือนคุณภาพน้ำ ${dateTh}`];
    if (bad.length) {
      lines.push(`🔴 ผิดปกติ (${bad.length})`);
      lines.push(...bad.slice(0, 8).map((a) => `• ${a.text}`));
    }
    if (warn.length) {
      lines.push(`🟡 เฝ้าระวัง (${warn.length})`);
      lines.push(...warn.slice(0, 8).map((a) => `• ${a.text}`));
    }
    lines.push("โปรดตรวจสอบและบันทึกการแก้ไขในระบบ");
    const message = lines.join("\n");

    // Send via LINE Messaging API (broadcast) if configured, else LINE Notify
    const { data: settings } = await supabase
      .from("app_settings")
      .select("key, value")
      .in("key", ["line_channel_token", "line_notify_token"]);

    const get = (k: string) => (settings || []).find((s: any) => s.key === k)?.value;
    const channelToken = get("line_channel_token");
    const notifyToken = get("line_notify_token");

    let providerStatus = 0;
    let providerBody = "";

    if (channelToken) {
      const res = await fetch("https://api.line.me/v2/bot/message/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${channelToken}` },
        body: JSON.stringify({ messages: [{ type: "text", text: message }] }),
      });
      providerStatus = res.status;
      providerBody = await res.text();
    } else if (notifyToken) {
      const res = await fetch("https://notify-api.line.me/api/notify", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", Authorization: `Bearer ${notifyToken}` },
        body: `message=${encodeURIComponent("\n" + message)}`,
      });
      providerStatus = res.status;
      providerBody = await res.text();
    } else {
      return new Response(JSON.stringify({ sent: false, reason: "no_line_token", message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (providerStatus >= 400) {
      console.error(`LINE send failed [${providerStatus}]: ${providerBody}`);
      return new Response(JSON.stringify({ sent: false, status: providerStatus, details: providerBody }), {
        status: providerStatus,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ sent: true, count: alerts.length, message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("water-alert-daily error:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});