import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getWaterAlertLevel, getWastewaterAlertLevel, getSedimentAlertLevel, getDisinfectantAlertLevel, mergeThresholds } from "./rules.ts";

const DEFAULT_LINE_GROUP_ID = "Cb126126f5369ab6272ba2775e35c0641";

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
  if (recipients.length === 0) {
    const res = await fetch("https://api.line.me/v2/bot/message/broadcast", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ messages: [{ type: "text", text }] }),
    });
    const responseBody = await res.text();
    if (!res.ok) {
      console.error(`LINE broadcast failed [${res.status}]: ${responseBody}`);
      throw new Error(`[${res.status}] ${responseBody}`);
    }
    return { status: res.status, body: responseBody };
  }

  // /push accepts user, group and room ids (multicast only accepts user ids)
  const results: { to: string; status: number; body: string }[] = [];
  const errors: string[] = [];
  for (const to of recipients.slice(0, 500)) {
    const res = await fetch("https://api.line.me/v2/bot/message/push", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ to, messages: [{ type: "text", text }] }),
    });
    const responseBody = await res.text();
    results.push({ to, status: res.status, body: responseBody });
    if (!res.ok) {
      console.error(`LINE push failed for ${to} [${res.status}]: ${responseBody}`);
      errors.push(`${to}: [${res.status}] ${responseBody}`);
    }
  }
  if (errors.length === results.length) throw new Error(errors.join(" | "));
  return { status: 200, body: JSON.stringify(results), errors };
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

    const { data: thresholdSetting } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "water_thresholds")
      .maybeSingle();
    let thresholds = mergeThresholds(null);
    try {
      if (thresholdSetting?.value) thresholds = mergeThresholds(JSON.parse(thresholdSetting.value));
    } catch (_) { /* keep defaults */ }

    // 1) สารเคมีกำจัดเชื้อโรค / คุณภาพน้ำประปา
    const { data: wq } = await supabase
      .from("water_quality_logs")
      .select("check_point, check_date, status, ph_value, chlorine_value, turbidity_value")
      .eq("check_date", today)
      .is("disinfectant_name", null);

    for (const r of wq || []) {
      const point = r.check_point === "สารเคมีกำจัดเชื้อโรค" ? "สารเคมีกำจัดเชื้อโรค (ประปา)" : `คุณภาพน้ำ ${r.check_point}`;
      const cl = num(r.chlorine_value);
      const ph = num(r.ph_value);
      const tb = num(r.turbidity_value);
      const entryAlerts = getWaterAlertLevel(cl, ph, tb, thresholds);
      for (const alert of entryAlerts) {
        alerts.push({ level: alert.level, text: `${point} ${alert.text}` });
      }
    }

    const { data: disinfectantLogs } = await supabase
      .from("water_quality_logs")
      .select("check_point, check_date, source_concentration, source_ph, outlet_concentration, outlet_ph")
      .eq("check_date", today)
      .not("disinfectant_name", "is", null);

    for (const r of disinfectantLogs || []) {
      const sourceCl = num(r.source_concentration);
      const sourcePh = num(r.source_ph);
      const outletCl = num(r.outlet_concentration);
      const outletPh = num(r.outlet_ph);
      const entryAlerts = getDisinfectantAlertLevel(sourceCl, sourcePh, outletCl, outletPh, thresholds);
      for (const alert of entryAlerts) {
        alerts.push({ level: alert.level, text: `น้ำประปา (สารเคมีกำจัดเชื้อโรค) ${alert.text}` });
      }
    }

    // 2) ระบบบำบัดน้ำเสีย
    const { data: insp } = await supabase
      .from("wastewater_inspection_logs")
      .select("check_date, chlorine_residual, ph_value, do_value, sediment_volume, treatment_odor, aerator_status, sludge_pump_status")
      .eq("check_date", today);

    for (const r of insp || []) {
      const cl = num(r.chlorine_residual);
      const ph = num(r.ph_value);
      const dov = num(r.do_value);
      const sed = num(r.sediment_volume);
      const entryAlerts = getWastewaterAlertLevel(cl, ph, dov, thresholds);
      for (const alert of entryAlerts) {
        alerts.push({ level: alert.level, text: `ระบบบำบัดน้ำเสีย ${alert.text}` });
      }
      const sedimentAlert = getSedimentAlertLevel(sed, thresholds);
      if (sedimentAlert) {
        alerts.push({ level: sedimentAlert.level, text: `ระบบบำบัดน้ำเสีย ${sedimentAlert.text}` });
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

    if (alerts.length === 0) {
      return new Response(JSON.stringify({ sent: false, reason: "no_anomaly", date: today, message: "" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const bad = alerts.filter((a) => a.level === "bad");
    const warn = alerts.filter((a) => a.level === "warn");
    const dateTh = new Date(today).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" });

    const lines: string[] = [`🚱 แจ้งเตือนคุณภาพน้ำ ${dateTh}`, ""];
    if (bad.length) {
      lines.push(`🔴 วิกฤติ!!! แก้ไขทันที`);
      lines.push(...bad.map((a) => `• ${a.text}`));
    }
    if (warn.length) {
      if (bad.length) lines.push("", "🟡 โปรดเฝ้าระวัง");
      else lines.push(`🟡 โปรดเฝ้าระวัง`);
      lines.push(...warn.map((a) => `• ${a.text}`));
    }
    lines.push("", "โปรดตรวจสอบและแก้ไขโดยด่วน");
    const message = lines.join("\n");

    if (dryRun) {
      return new Response(JSON.stringify({ sent: false, reason: "dry_run", count: alerts.length, message }), {
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
      [
        ...((rows || [])
          .filter((r: any) => r.is_active !== false)
          .filter((r: any) => !Array.isArray(r.topics) || r.topics.length === 0 || r.topics.includes("water_alert"))
          .map((r: any) => String(r.line_user_id || "").trim())
          .filter(Boolean)),
        DEFAULT_LINE_GROUP_ID,
      ],
    ));

    if (recipients.length === 0) {
      return new Response(JSON.stringify({ sent: false, reason: "no_recipients", message }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await pushLine(channelToken, recipients, message);
    return new Response(JSON.stringify({ sent: true, count: alerts.length, recipients: recipients.length, message, result }), {
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
