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

  if (data.active === false) {
    console.error("Denne kontoen er deaktivert.");
    await supabaseClient.auth.signOut();
    window.location.href = "login.html?deactivated=1";
    return null;
  }

  currentEmployee = data;
  applyRoleVisibility();
  renderUserBadge();

  if (typeof enforceAdminPageAccess === "function") {
    enforceAdminPageAccess();
  }

  if (typeof enforceGuestPageRestrictions === "function") {
    enforceGuestPageRestrictions();
  }

  if (typeof loadEmployeeAvatars === "function") {
    loadEmployeeAvatars();
  }

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

  if (typeof updateAbsenceStatusVisibility === "function") {
    updateAbsenceStatusVisibility();
  }

  if (typeof renderVacationQuotaEditor === "function") {
    renderVacationQuotaEditor();
  }

  if (typeof renderSubs === "function") {
    renderSubs();
  }

  if (typeof populateSwapWithSelect === "function") {
    populateSwapWithSelect();
  }

  if (typeof loadSwapInbox === "function") {
    loadSwapInbox();
  }

  if (typeof loadSentSwapRequests === "function") {
    loadSentSwapRequests();
  }

  if (typeof loadSwapNavBadge === "function") {
    loadSwapNavBadge();
  }

  if (typeof applySubFormVisibility === "function") {
    applySubFormVisibility();
  }

  if (typeof renderMyAvatarPreview === "function") {
    renderMyAvatarPreview();
  }

  if (typeof renderSupplies === "function") {
    renderSupplies();
  }

  if (typeof applyEmployeeAvatarsToGrid === "function") {
    applyEmployeeAvatarsToGrid();
  }

  if (typeof loadTodayShiftsForDashboard === "function") {
    loadTodayShiftsForDashboard();
  }

  if (typeof renderDashboardGreeting === "function") {
    renderDashboardGreeting();
  }

  if (typeof loadKindMessages === "function") {
    loadKindMessages();
  }

  if (typeof loadAvvikFromSupabase === "function") {
    loadAvvikFromSupabase();
  }

  if (typeof loadChecklistsFromSupabase === "function") {
    loadChecklistsFromSupabase();
  }

  // Re-render once we know for sure whether this person is admin (controls
  // the Slett button on each årshjul item) - initializeArshjul() itself
  // already ran once with an unknown/guest-looking currentEmployee.
  if (typeof renderArshjulMonthDetail === "function") {
    renderArshjulMonthDetail();
  }

  if (typeof renderRoutines === "function") {
    renderRoutines();
  }

  if (typeof renderArsplan === "function") {
    renderArsplan();
  }

  if (typeof loadSharedPhotos === "function") {
    loadSharedPhotos();
  }

  if (typeof initPushToggle === "function") {
    initPushToggle();
  }

  // Keep swap-related UI (nav badge, inbox, sent requests) fresh without
  // needing to reload the page - this is a lighter-weight backstop
  // alongside the real push notifications, in case a push was missed
  // (permission not granted, browser killed it, etc.) while the tab
  // is actually open.
  setInterval(() => {
    if (typeof loadSwapNavBadge === "function") loadSwapNavBadge();
    if (typeof loadSwapInbox === "function") loadSwapInbox();
    if (typeof loadSentSwapRequests === "function") loadSentSwapRequests();
  }, 45000);

  return currentEmployee;
}

function isSubstitute() {
  return !!(currentEmployee && currentEmployee.role === "Vikar");
}

// Shared kitchen iPad login: can read/write Kjøkkenboka, everything else
// either hidden (sensitive pages) or shown read-only (no edit controls).
function isGuest() {
  return !!(currentEmployee && currentEmployee.role === "Gjest");
}

function applyRoleVisibility() {
  const isAdmin = !!(currentEmployee && currentEmployee.is_admin);
  document.querySelectorAll("[data-admin-only]").forEach((el) => {
    el.style.display = isAdmin ? "" : "none";
  });

  const substitute = isSubstitute();
  document.querySelectorAll("[data-hide-from-vikar]").forEach((el) => {
    el.style.display = substitute ? "none" : "";
  });

  const guest = isGuest();
  document.querySelectorAll("[data-hide-from-guest]").forEach((el) => {
    el.style.display = guest ? "none" : "";
  });
}

function renderUserBadge() {
  const badge = document.getElementById("userBadge");
  if (!badge || !currentEmployee) return;

  if (typeof avatarSpanFor === "function" && typeof escapeHtml === "function") {
    badge.innerHTML = `${avatarSpanFor(currentEmployee.name, "avatar-sidebar")}${escapeHtml(currentEmployee.name)}`;
  } else {
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
