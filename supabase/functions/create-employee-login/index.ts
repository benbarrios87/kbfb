// KBFB Personal: create-employee-login
//
// Lets an admin create a brand-new login (Supabase Auth user + kbfb_employees
// row) in one step from the Admin page, without ever touching Supabase
// directly. Runs server-side so the powerful service-role key never reaches
// the browser - only this function holds it, read from environment secrets.
//
// Deploy via Supabase Studio -> Edge Functions -> paste this file -> Deploy.
// No CLI required. SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided
// automatically by Supabase - no manual secret setup needed.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

    // Scoped to the caller's own token - only used to find out who's calling.
    const callerClient = createClient(supabaseUrl, serviceRoleKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userError } = await callerClient.auth.getUser();
    if (userError || !userData?.user) {
      return jsonResponse({ error: "Ugyldig innlogging." }, 401);
    }

    // Full-access client - only used after the admin check below passes.
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: callerEmployee, error: callerError } = await adminClient
      .from("kbfb_employees")
      .select("is_admin")
      .eq("user_id", userData.user.id)
      .single();

    if (callerError || !callerEmployee?.is_admin) {
      return jsonResponse({ error: "Kun admin kan opprette nye brukere." }, 403);
    }

    const { name, email, password, role, department } = await req.json();

    if (!name || !email || !password) {
      return jsonResponse({ error: "Navn, e-post og passord er påkrevd." }, 400);
    }

    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (createError || !newUser?.user) {
      return jsonResponse({ error: createError?.message || "Kunne ikke opprette bruker." }, 400);
    }

    const { error: employeeError } = await adminClient
      .from("kbfb_employees")
      .insert([{
        name,
        role: role || null,
        department: department || null,
        user_id: newUser.user.id,
        is_admin: false,
        active: true,
      }]);

    if (employeeError) {
      return jsonResponse({
        error: "Brukeren ble opprettet, men ansatt-raden kunne ikke lagres: " + employeeError.message,
      }, 500);
    }

    return jsonResponse({ success: true, user_id: newUser.user.id });
  } catch (err) {
    return jsonResponse({ error: String(err) }, 500);
  }
});
