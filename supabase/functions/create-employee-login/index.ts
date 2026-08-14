// KBFB Personal: create-employee-login
//
// Admin actions that all need the powerful service-role key, so they
// share one function (avoids deploying a separate one for each):
//   - action "create" (default): new Auth user + kbfb_employees row, in one step
//   - action "reset_password": set a new password for an existing login
//   - action "delete": removes the Auth login (if any) and the
//     kbfb_employees row together, so you don't end up with an orphaned
//     login that still exists but has no employee record
// Runs server-side so that key never reaches the browser - only this
// function holds it, read from environment secrets.
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

    const body = await req.json();
    const action = body.action || "create";

    if (action === "reset_password") {
      const { user_id, password } = body;

      if (!user_id || !password) {
        return jsonResponse({ error: "user_id og passord er påkrevd." }, 400);
      }

      const { error: resetError } = await adminClient.auth.admin.updateUserById(user_id, { password });

      if (resetError) {
        return jsonResponse({ error: resetError.message }, 400);
      }

      return jsonResponse({ success: true });
    }

    if (action === "delete") {
      const { employee_id, user_id } = body;

      if (!employee_id) {
        return jsonResponse({ error: "employee_id er påkrevd." }, 400);
      }

      // Delete the Auth login first (if this row ever had one) - if this
      // fails we don't want to also delete the employee row and lose track
      // of the orphaned login.
      if (user_id) {
        const { error: deleteAuthError } = await adminClient.auth.admin.deleteUser(user_id);
        if (deleteAuthError) {
          return jsonResponse({ error: "Kunne ikke slette innlogging: " + deleteAuthError.message }, 400);
        }
      }

      const { error: deleteEmployeeError } = await adminClient
        .from("kbfb_employees")
        .delete()
        .eq("id", employee_id);

      if (deleteEmployeeError) {
        return jsonResponse({ error: "Kunne ikke slette ansatt-raden: " + deleteEmployeeError.message }, 500);
      }

      return jsonResponse({ success: true });
    }

    const { name, email, password, role, department } = body;

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
