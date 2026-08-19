// KBFB Personal: send-push-notification
//
// Sends a real Web Push notification (works even when the app isn't
// open - phone lock screen, browser notification tray) to one or more
// employees, using the browser subscriptions saved in
// kbfb_push_subscriptions.
//
// Any logged-in employee can call this (not admin-only) - it's used
// for routine staff-to-staff notices like "someone wants to swap a
// shift with you" or "your swap was accepted", not a privileged action.
//
// Needs three secrets set once in Supabase Studio -> Edge Functions ->
// send-push-notification -> Secrets:
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:...)
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided automatically
// by Supabase - no manual secret setup needed for those two.
//
// Deploy via Supabase Studio -> Edge Functions -> paste this file ->
// Deploy. No CLI required.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ error: "Ikke innlogget." }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");
    const vapidSubject = Deno.env.get("VAPID_SUBJECT");

    if (!vapidPublicKey || !vapidPrivateKey || !vapidSubject) {
      return jsonResponse({ error: "VAPID-nøkler er ikke satt opp på serveren ennå." }, 500);
    }

    // Scoped to the caller's own token - only used to confirm they're
    // actually logged in. Any authenticated employee may send.
    const callerClient = createClient(supabaseUrl, serviceRoleKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userError } = await callerClient.auth.getUser();
    if (userError || !userData?.user) {
      return jsonResponse({ error: "Ugyldig innlogging." }, 401);
    }

    const { to, title, body, url } = await req.json();

    if (!Array.isArray(to) || !to.length || !title || !body) {
      return jsonResponse({ error: "to (liste med navn), title og body er påkrevd." }, 400);
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: subscriptions, error: subsError } = await adminClient
      .from("kbfb_push_subscriptions")
      .select("*")
      .in("employee_name", to);

    if (subsError) {
      return jsonResponse({ error: subsError.message }, 500);
    }

    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

    const payload = JSON.stringify({ title, body, url: url || "dashboard.html" });

    let sent = 0;
    for (const sub of subscriptions || []) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload
        );
        sent++;
      } catch (err) {
        // 404/410 = the browser dropped this subscription (uninstalled,
        // cleared data, ...) - remove it so we stop retrying forever.
        const statusCode = (err as { statusCode?: number })?.statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await adminClient.from("kbfb_push_subscriptions").delete().eq("id", sub.id);
        } else {
          console.error("Push-sending feilet for", sub.employee_name, err);
        }
      }
    }

    return jsonResponse({ success: true, sent });
  } catch (err) {
    return jsonResponse({ error: String(err) }, 500);
  }
});
