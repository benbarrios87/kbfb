/* ===== KBFB PERSONAL - AUTH.JS =====
   Shared on every protected page, loaded after supabase.js and before app.js.
   Checks that someone is logged in, loads their employee record, hides
   admin-only UI for non-admins, and wires up the logout button. */

let currentEmployee = null;

async function requireAuth() {
  const { data: { session } } = await supabaseClient.auth.getSession();

  if (!session) {
    window.location.href = "login.html";
    return null;
  }

  const { data, error } = await supabaseClient
    .from("kbfb_employees")
    .select("*")
    .eq("user_id", session.user.id)
    .single();

  if (error || !data) {
    console.error("Fant ingen ansatt koblet til denne brukeren:", error);
    await supabaseClient.auth.signOut();
    window.location.href = "login.html";
    return null;
  }

  currentEmployee = data;
  applyRoleVisibility();
  renderUserBadge();

  // Some pages may have already rendered before we knew who's logged in
  // (or whether they're admin) - re-render now that we know for sure.
  if (typeof buildShiftDropdowns === "function") {
    buildShiftDropdowns();
  }

  if (typeof renderQuickNoteAuthor === "function") {
    renderQuickNoteAuthor();
  }

  if (typeof renderQuickNotes === "function") {
    renderQuickNotes();
  }

  if (typeof renderEvents === "function") {
    renderEvents();
  }

  if (typeof lockAbsenceNameToSelf === "function") {
    lockAbsenceNameToSelf();
  }

  if (typeof lockAbsenceFilterToSelf === "function") {
    lockAbsenceFilterToSelf();
  }

  return currentEmployee;
}

function applyRoleVisibility() {
  const isAdmin = !!(currentEmployee && currentEmployee.is_admin);
  document.querySelectorAll("[data-admin-only]").forEach((el) => {
    el.style.display = isAdmin ? "" : "none";
  });
}

function renderUserBadge() {
  const badge = document.getElementById("userBadge");
  if (badge && currentEmployee) {
    badge.textContent = currentEmployee.name;
  }
}

async function logout() {
  await supabaseClient.auth.signOut();
  window.location.href = "login.html";
}

document.addEventListener("DOMContentLoaded", () => {
  requireAuth();

  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", logout);
  }
});
