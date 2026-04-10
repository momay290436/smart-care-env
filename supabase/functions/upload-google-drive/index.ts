import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "@supabase/supabase-js/cors";

const DRIVE_FOLDER_ID = "1hzhFX6hCAkXi2XBioOpVP-VQd7kkDBx6";

async function getAccessToken(): Promise<string> {
  const email = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_EMAIL");
  const privateKeyRaw = Deno.env.get("GOOGLE_PRIVATE_KEY");
  if (!email || !privateKeyRaw) throw new Error("Google credentials not configured");

  const privateKeyPem = privateKeyRaw.replace(/\\n/g, "\n");

  const header = { alg: "RS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const claim = {
    iss: email,
    scope: "https://www.googleapis.com/auth/drive.file",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };

  const encode = (obj: unknown) =>
    btoa(JSON.stringify(obj)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

  const unsignedToken = `${encode(header)}.${encode(claim)}`;

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
    "RSASSA-PKCS1-v1_5", cryptoKey,
    new TextEncoder().encode(unsignedToken)
  );

  const sig = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

  const jwt = `${unsignedToken}.${sig}`;

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  if (!tokenRes.ok) throw new Error(`Token exchange failed: ${await tokenRes.text()}`);
  const { access_token } = await tokenRes.json();
  return access_token;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { imageUrl, fileName, subFolder } = await req.json();
    if (!imageUrl || !fileName) {
      return new Response(JSON.stringify({ error: "imageUrl and fileName required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const accessToken = await getAccessToken();

    // Create subfolder if specified
    let parentFolderId = DRIVE_FOLDER_ID;
    if (subFolder) {
      // Check if subfolder exists
      const searchRes = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(`name='${subFolder}' and '${DRIVE_FOLDER_ID}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`)}&fields=files(id)`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const searchData = await searchRes.json();

      if (searchData.files && searchData.files.length > 0) {
        parentFolderId = searchData.files[0].id;
      } else {
        // Create subfolder
        const createRes = await fetch("https://www.googleapis.com/drive/v3/files", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: subFolder,
            mimeType: "application/vnd.google-apps.folder",
            parents: [DRIVE_FOLDER_ID],
          }),
        });
        const folderData = await createRes.json();
        parentFolderId = folderData.id;
      }
    }

    // Download image
    const imageRes = await fetch(imageUrl);
    if (!imageRes.ok) throw new Error(`Failed to download image: ${imageRes.status}`);
    const imageBlob = await imageRes.blob();
    const contentType = imageBlob.type || "image/jpeg";

    // Upload to Drive using multipart upload
    const metadata = JSON.stringify({
      name: fileName,
      parents: [parentFolderId],
    });

    const boundary = "boundary_" + Date.now();
    const body = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: ${contentType}\r\n\r\n`;
    const bodyEnd = `\r\n--${boundary}--`;

    const imageArrayBuffer = await imageBlob.arrayBuffer();
    const bodyStart = new TextEncoder().encode(body);
    const bodyEndBytes = new TextEncoder().encode(bodyEnd);
    const combined = new Uint8Array(bodyStart.length + imageArrayBuffer.byteLength + bodyEndBytes.length);
    combined.set(bodyStart, 0);
    combined.set(new Uint8Array(imageArrayBuffer), bodyStart.length);
    combined.set(bodyEndBytes, bodyStart.length + imageArrayBuffer.byteLength);

    const uploadRes = await fetch(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": `multipart/related; boundary=${boundary}`,
        },
        body: combined,
      }
    );

    if (!uploadRes.ok) throw new Error(`Drive upload failed: ${await uploadRes.text()}`);
    const uploadData = await uploadRes.json();

    return new Response(JSON.stringify({ success: true, fileId: uploadData.id, webViewLink: uploadData.webViewLink }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
