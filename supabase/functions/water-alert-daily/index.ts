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

const pushLine = async (token: string, recipients: string[], text: string) => {
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
    let body: any = {};
    if (req.method !== "GET") {
      try { body = await req.json(); } catch { body = {}; }
    }
    const dryRun = body?.dryRun === true;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const today = new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);
    const alerts: Alert[] = [];

    // 1) สารเคมีกำจัดเชื้อโรค / คุณภาพน้ำประปา
    const { data: wq } = await supabase
      .from("water_quality_logs")
      .select("check_point, check_date, status, ph_value, chlorine_value, turbidity_value")
      .eq("check_date", today);

    for (const r of wq || []) {
      const point = r.check_point === "สารเคมีกำจัดเชื้อโรค" ? "สารเคมีกำจัดเชื้อโรค (ประปา)" : `คุณภาพน้ำ ${r.check_point}`;
      const cl = num(r.chlorine_value);
      if (cl !== null && (cl < 0.2 || cl > 0.5)) {
        alerts.push({ level: cl < 0.1 || cl > 1 ? "bad" : "warn", text: `${point} พบค่าคลอรีนผิดปกติ (${cl} mg/L | เกณฑ์ 0.2–0.5)` });
      }
      const ph = num(r.ph_value);
      if (ph !== null && (ph < 6.5 || ph > 8.5)) {
        alerts.push({ level: ph < 6 || ph > 9 ? "bad" : "warn", text: `${point} พบค่า pH ผิดปกติ (${ph} | เกณฑ์ 6.5–8.5)` });
      }
      const tb = num(r.turbidity_value);
      if (tb !== null && tb > 5) {
        alerts.push({ level: tb > 10 ? "bad" : "warn", text: `${point} พบค่าความขุ่นผิดปกติ (${tb} NTU | เกณฑ์ ≤ 5)` });
      }
    }

    // 2) ระบบบำบัดน้ำเสีย
    const { data: insp } = await supabase
      .from("wastewater_inspection_logs")
      .select("check_date, chlorine_residual, ph_value, do_value, sediment_volume, treatment_odor, aerator_status, sludge_pump_status")
      .eq("check_date", today);

    for (const r of insp || []) {
      const cl = num(r.chlorine_residual);
      if (cl !== null && (cl < 0.2 || cl > 0.5)) {
        alerts.push({ level: cl < 0.1 || cl > 1 ? "bad" : "warn", text: `ระบบบำบัดน้ำเสีย พบค่าคลอรีนผิดปกติ (${cl} mg/L | เกณฑ์ 0.2–0.5)` });
      }
      const ph = num(r.ph_value);
      if (ph !== null && (ph < 6.5 || ph > 8.5)) {
        alerts.push({ level: ph < 6 || ph > 9 ? "bad" : "warn", text: `ระบบบำบัดน้ำเสีย พบค่า pH ผิดปกติ (${ph} | เกณฑ์ 6.5–8.5)` });
      }
      const dov = num(r.do_value);
      if (dov !== null && dov < 2) {
        alerts.push({ level: dov < 1 ? "bad" : "warn", text: `ระบบบำบัดน้ำเสีย พบค่า DO ต่ำผิดปกติ (${dov} mg/L | เกณฑ์ ≥ 2)` });
      }
      const sed = num(r.sediment_volume);
      if (sed !== null && sed > 500) {
        alerts.push({ level: sed > 700 ? "bad" : "warn", text: `ระบบบำบัดน้ำเสีย พบค่าตะกอนผิดปกติ (${sed} ml/L | เกณฑ์ ≤ 500)` });
      }
      if (r.treatment_odor) {
        alerts.push({ level: "warn", text: "ระบบบำบัดน้ำเสีย พบกลิ่นผิดปกติ" });
      }
    }

    // 3) ผลตรวจเชื้อจุลินทรีย์
    const { data: patho } = await supabase
      .from("water_pathogen_logs")
      .select("sample_point, check_date, status, total_coliform, e_coli, chlorine_value")
      .eq("check_date", today);

    for (const r of patho || []) {
      if (r.total_coliform === "found" || r.e_coli === "found") {
        const found = [r.e_coli === "found" ? "E.coli" : null, r.total_coliform === "found" ? "Coliform" : null].filter(Boolean).join(" / ");
        alerts.push({ level: "bad", text: `ตรวจเชื้อ ${r.sample_point} พบเชื้อ ${found}` });
      } else if (r.status && r.status !== "pass") {
        const cl = num(r.chlorine_value);
        alerts.push({ level: "warn", text: `ตรวจเชื้อ ${r.sample_point} ไม่ผ่านเกณฑ์${cl !== null ? ` (คลอรีน ${cl} mg/L)` : ""}` });
      }
    }

    const deduped = alerts.filter((a, i, all) => all.findIndex((x) => x.level === a.level && x.text === a.text) === i);

    if (deduped.length === 0) {
      return new Response(JSON.stringify({ sent: false, reason: "no_anomaly", date: today, message: "" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const bad = deduped.filter((a) => a.level === "bad");
    const warn = deduped.filter((a) => a.level === "warn");
    const dateTh = new Date(today).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" });

    const lines: string[] = [`🚱 แจ้งเตือนคุณภาพน้ำ ${dateTh}`];
    if (bad.length) {
      lines.push("", `🔴 ผิดปกติ (${bad.length})`);
      lines.push(...bad.slice(0, 10).map((a) => `• ${a.text}`));
    }
    if (warn.length) {
      lines.push("", `🟡 เฝ้าระวัง (${warn.length})`);
      lines.push(...warn.slice(0, 10).map((a) => `• ${a.text}`));
    }
    lines.push("", "โปรดตรวจสอบและบันทึกการแก้ไขในระบบ");
    const message = lines.join("\n");

    if (dryRun) {
      return new Response(JSON.stringify({ sent: false, reason: "dry_run", count: deduped.length, message }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: settings } = await supabase.from("app_settings").select("key, value").eq("key", "line_channel_token");
    const channelToken = (settings || [])[0]?.value?.trim() || Deno.env.get("LINE_CHANNEL_ACCESS_TOKEN") || "";

    if (!channelToken) {
      return new Response(JSON.stringify({ sent: false, reason: "no_channel_token", message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: rows } = await supabase
      .from("notification_recipients")
      .select("line_user_id, topics, is_active");

    const recipients = Array.from(new Set(
      (rows || [])
        .filter((r: any) => r.is_active !== false)
        .filter((r: any) => !Array.isArray(r.topics) || r.topics.length === 0 || r.topics.includes("water_alert"))
        .map((r: any) => String(r.line_user_id || "").trim())
        .filter(Boolean),
    ));

    if (recipients.length === 0) {
      return new Response(JSON.stringify({ sent: false, reason: "no_recipients", message }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await pushLine(channelToken, recipients, message);
    return new Response(JSON.stringify({ sent: true, count: deduped.length, recipients: recipients.length, message, result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("water-alert-daily error:", error);
    return new Response(JSON.stringify({ sent: false, error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
