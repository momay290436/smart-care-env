import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "@supabase/supabase-js/cors";

const SHEET_ID = "1dGCeW4kTLYKFI0kdcZXrExeaaYeUrgguxj9w-e5ojnM";

async function getAccessToken(): Promise<string> {
  const email = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_EMAIL");
  const privateKeyRaw = Deno.env.get("GOOGLE_PRIVATE_KEY");
  if (!email || !privateKeyRaw) throw new Error("Google credentials not configured");

  const privateKeyPem = privateKeyRaw.replace(/\\n/g, "\n");

  // Create JWT
  const header = { alg: "RS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const claim = {
    iss: email,
    scope: "https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };

  const encode = (obj: unknown) =>
    btoa(JSON.stringify(obj)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

  const unsignedToken = `${encode(header)}.${encode(claim)}`;

  // Import private key
  const pemBody = privateKeyPem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s/g, "");
  const binaryKey = Uint8Array.from(atob(pemBody), (c) => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8", binaryKey,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false, ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    new TextEncoder().encode(unsignedToken)
  );

  const sig = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

  const jwt = `${unsignedToken}.${sig}`;

  // Exchange JWT for access token
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  if (!tokenRes.ok) {
    const err = await tokenRes.text();
    throw new Error(`Token exchange failed: ${err}`);
  }

  const { access_token } = await tokenRes.json();
  return access_token;
}

async function appendToSheet(accessToken: string, sheetName: string, values: string[][]) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(sheetName)}!A1:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ values }),
  });

  if (!res.ok) {
    // Try creating the sheet if it doesn't exist
    if (res.status === 400) {
      await createSheet(accessToken, sheetName);
      const retry = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ values }),
      });
      if (!retry.ok) throw new Error(`Append failed: ${await retry.text()}`);
      return await retry.json();
    }
    throw new Error(`Append failed: ${await res.text()}`);
  }
  return await res.json();
}

async function createSheet(accessToken: string, title: string) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}:batchUpdate`;
  await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      requests: [{ addSheet: { properties: { title } } }],
    }),
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { type, data } = await req.json();
    const accessToken = await getAccessToken();

    if (type === "5s") {
      const { department, auditor, scores, totalScore, grade, notes, date, photoBeforeUrl, photoAfterUrl } = data;
      const values = [[
        date, department, auditor,
        String(scores.seiri), String(scores.seiton), String(scores.seiso),
        String(scores.seiketsu), String(scores.shitsuke),
        String(totalScore), grade, notes || "",
        photoBeforeUrl || "", photoAfterUrl || "",
      ]];

      // Ensure header exists by checking
      try {
        const checkUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent("5S Audit")}!A1`;
        const check = await fetch(checkUrl, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const checkData = await check.json();
        if (!checkData.values || checkData.values.length === 0) {
          await appendToSheet(accessToken, "5S Audit", [[
            "วันที่", "แผนก", "ผู้ตรวจ", "สะสาง", "สะดวก", "สะอาด",
            "สุขลักษณะ", "สร้างนิสัย", "คะแนนรวม", "เกรด", "หมายเหตุ",
            "รูปก่อน", "รูปหลัง",
          ]]);
        }
      } catch {
        await appendToSheet(accessToken, "5S Audit", [[
          "วันที่", "แผนก", "ผู้ตรวจ", "สะสาง", "สะดวก", "สะอาด",
          "สุขลักษณะ", "สร้างนิสัย", "คะแนนรวม", "เกรด", "หมายเหตุ",
          "รูปก่อน", "รูปหลัง",
        ]]);
      }

      await appendToSheet(accessToken, "5S Audit", values);
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (type === "env") {
      const { department, inspector, date, items, summary } = data;

      // Summary sheet
      try {
        const checkUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent("ENV Round Summary")}!A1`;
        const check = await fetch(checkUrl, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const checkData = await check.json();
        if (!checkData.values || checkData.values.length === 0) {
          await appendToSheet(accessToken, "ENV Round Summary", [[
            "วันที่", "แผนก", "ผู้ตรวจ", "จุดปกติ", "จุดผิดปกติ", "ความเสี่ยงสูง",
          ]]);
        }
      } catch {
        await appendToSheet(accessToken, "ENV Round Summary", [[
          "วันที่", "แผนก", "ผู้ตรวจ", "จุดปกติ", "จุดผิดปกติ", "ความเสี่ยงสูง",
        ]]);
      }

      await appendToSheet(accessToken, "ENV Round Summary", [[
        date, department, inspector,
        String(summary.normal), String(summary.abnormal), String(summary.highRisk),
      ]]);

      // Detail sheet
      if (items && items.length > 0) {
        try {
          const checkUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent("ENV Round Details")}!A1`;
          const check = await fetch(checkUrl, {
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          const checkData = await check.json();
          if (!checkData.values || checkData.values.length === 0) {
            await appendToSheet(accessToken, "ENV Round Details", [[
              "วันที่", "แผนก", "หมวดหมู่", "รายการ", "ผลตรวจ", "ระดับความรุนแรง", "หมายเหตุ", "รูปภาพ",
            ]]);
          }
        } catch {
          await appendToSheet(accessToken, "ENV Round Details", [[
            "วันที่", "แผนก", "หมวดหมู่", "รายการ", "ผลตรวจ", "ระดับความรุนแรง", "หมายเหตุ", "รูปภาพ",
          ]]);
        }

        const detailRows = items.map((item: any) => [
          date, department, item.category, item.item_name,
          item.result === "normal" ? "ปกติ" : "ผิดปกติ",
          item.severity || "-", item.notes || "", item.photo_url || "",
        ]);
        await appendToSheet(accessToken, "ENV Round Details", detailRows);
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown type" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
