/* ===== KBFB PERSONAL - REN APP.JS ===== */

/* ---------- HJELPEFUNKSJONER ---------- */

// Anything an employee typed (notes, item names, reasons, etc.) must go
// through this before landing in innerHTML - otherwise someone could type
// HTML/script into a text field and have it run in a colleague's browser.
function escapeHtml(value) {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function toDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toMonthKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function getMonday(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function addWeeks(date, weeks) {
  return addDays(date, weeks * 7);
}

function getWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

function formatShortDate(date) {
  return date.toLocaleDateString("no-NO", {
    day: "2-digit",
    month: "2-digit"
  });
}

function formatNorwegianDate(dateString) {
  if (!dateString) return "";
  return new Date(dateString + "T12:00:00").toLocaleDateString("no-NO", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
}

function formatKitchenDate(dateString) {
  if (!dateString) return "";
  return new Date(dateString + "T12:00:00").toLocaleDateString("no-NO", {
    weekday: "long",
    day: "numeric",
    month: "long"
  });
}

function formatDateRange(startDate, endDate) {
  if (!startDate || !endDate) return "";
  if (startDate === endDate) return formatNorwegianDate(startDate);
  return `${formatNorwegianDate(startDate)} – ${formatNorwegianDate(endDate)}`;
}

function shortDate(dateString) {
  if (!dateString) return "";
  return new Date(dateString + "T12:00:00").toLocaleDateString("no-NO", {
    day: "2-digit",
    month: "2-digit"
  });
}

/* ---------- DATOER / ÅRSHJUL ---------- */

let notesCache = [];

// Declared this early (not down by the rest of the vikarer.html code) to
// avoid the same category of temporal-dead-zone bug notesCache had - a
// synchronous top-level call reaching this before the script got to the
// vikarer.html section further down.
let subsCache = [];
let subPeopleCache = [];

// Shared name -> avatar_url lookup so every place that shows an employee's
// name (schedule grid, kitchen notes, sidebar, ...) can show their photo
// too, without each spot running its own query. Kept up here with the
// other early caches rather than down by the account-settings code, since
// renderQuickNotes() (defined much earlier in the file) reads it too.
let employeeAvatarCache = {};

const eventStorageKey = "kbfb-events";
let eventsCache = [];

async function loadEventsFromSupabase() {
  const { data, error } = await supabaseClient
    .from("kbfb_events")
    .select("*")
    .order("date", { ascending: true });

  if (error) {
    console.error("Kunne ikke hente events:", error);
    return [];
  }

  eventsCache = data || [];
  return eventsCache;
}
let employeesCache = [];

// Same palette as the vikar color picker (vikarer.html) - one color per
// person, shown on their vaktplan row. Kept wide (16) since a small
// barnehage staff list still needs every person to be visually distinct.
const employeeColorPalette = [
  { value: "#fde68a", label: "Gul" },
  { value: "#fed7aa", label: "Oransje" },
  { value: "#fecaca", label: "Korall" },
  { value: "#fecdd3", label: "Rosa" },
  { value: "#f5d0fe", label: "Fuksia" },
  { value: "#e9d5ff", label: "Lilla" },
  { value: "#c7d2fe", label: "Indigo" },
  { value: "#bfdbfe", label: "Blå" },
  { value: "#bae6fd", label: "Lys blå" },
  { value: "#a5f3fc", label: "Cyan" },
  { value: "#99f6e4", label: "Turkis" },
  { value: "#a7f3d0", label: "Smaragd" },
  { value: "#bbf7d0", label: "Grønn" },
  { value: "#d9f99d", label: "Lime" },
  { value: "#fef08a", label: "Sand" },
  { value: "#cbd5e1", label: "Grå" }
];

async function loadEmployeesFromSupabase() {
  const { data, error } = await supabaseClient
    .from("kbfb_employees")
    .select("*")
    .eq("active", true)
    .order("department")
    .order("name");

  if (error) {
    console.error("Kunne ikke hente ansatte:", error);
    return [];
  }

  employeesCache = data || [];

  // buildShiftDropdowns() may already have run (with an empty cache) before
  // this resolves - re-apply row colors now that we actually know them.
  if (typeof applyEmployeeRowColors === "function") applyEmployeeRowColors();

  return employeesCache;
}
function populateEmployeeSelect(selectId, options = {}) {

  const select = document.getElementById(selectId);
  if (!select) return;

  const {
    includeBlank = true,
    blankText = "Velg ansatt",
    includeAll = false,
    departmentFilter = null
  } = options;

  select.innerHTML = "";

  if (includeAll) {
    select.innerHTML += `<option value="all">Alle</option>`;
  }

  if (includeBlank) {
    select.innerHTML += `<option value="">${blankText}</option>`;
  }

  const list = departmentFilter
    ? employeesCache.filter(employee => employee.department === departmentFilter)
    : employeesCache;

  list.forEach(employee => {
    select.innerHTML += `
      <option value="${escapeHtml(employee.name)}">
        ${escapeHtml(employee.name)}
      </option>
    `;
  });
}

async function saveEventToSupabase(eventData) {
  if (eventData.id) {
    const { error } = await supabaseClient
      .from("kbfb_events")
      .update({
        date: eventData.date,
        title: eventData.title,
        category: eventData.category,
        note: eventData.note
      })
      .eq("id", eventData.id);

    if (error) {
      console.error("Kunne ikke oppdatere event:", error);
    }

    return;
  }

  const { error } = await supabaseClient
    .from("kbfb_events")
    .insert([{
      date: eventData.date,
      title: eventData.title,
      category: eventData.category,
      note: eventData.note
    }]);

  if (error) {
    console.error("Kunne ikke lagre event:", error);
  }
}

async function deleteEventFromSupabase(id) {
  const { error } = await supabaseClient
    .from("kbfb_events")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Kunne ikke slette event:", error);
  }
}

function getEvents() {
  return eventsCache;
}
function categoryLabel(category) {
  const labels = {
    general: "Generelt",
    personal: "Personalmøte",
    plandager: "Plandag",
    overnatting: "Overnatting / tur",
    foreldre: "Foreldre",
    styre: "Styremøte",
    su: "SU-møte",
    bursdag: "Bursdag",
    jubileum: "Jubileum"
  };

  return labels[category] || "Generelt";
}

function categoryEmoji(category) {
  const emojis = {
    general: "⚪",
    personal: "🟧",
    plandager: "🟥",
    overnatting: "🟦",
    foreldre: "🟨",
    styre: "🟩",
    su: "🟪",
    bursdag: "🎂",
    jubileum: "🏆"
  };

  return emojis[category] || "⚪";
}

/* ---------- BURSDAGER ----------
   Birthdays live on kbfb_employees.birthday (a date column - only the
   month/day is ever used, the year is ignored). They're turned into
   virtual "events" on the fly so they can slot into the same upcoming-
   dates feeds as real kbfb_events rows, without needing to be
   re-entered every year. */

function employeeBirthdayMonthDay(employee) {
  if (!employee?.birthday) return null;
  const parsed = new Date(employee.birthday + "T12:00:00");
  if (Number.isNaN(parsed.getTime())) return null;
  return { month: parsed.getMonth(), day: parsed.getDate() };
}

// Next occurrence of an employee's birthday from today (this year if it
// hasn't passed yet, otherwise next year).
function nextBirthdayDateKey(employee, fromDate = new Date()) {
  const monthDay = employeeBirthdayMonthDay(employee);
  if (!monthDay) return null;

  const today = new Date(fromDate);
  today.setHours(0, 0, 0, 0);

  let candidate = new Date(today.getFullYear(), monthDay.month, monthDay.day);
  if (candidate < today) {
    candidate = new Date(today.getFullYear() + 1, monthDay.month, monthDay.day);
  }

  return toDateKey(candidate);
}

function getEmployeesWithBirthdayToday(fromDate = new Date()) {
  const todayMonthDay = { month: fromDate.getMonth(), day: fromDate.getDate() };

  return employeesCache.filter(employee => {
    const monthDay = employeeBirthdayMonthDay(employee);
    return monthDay && monthDay.month === todayMonthDay.month && monthDay.day === todayMonthDay.day;
  });
}

// Virtual "events" (never written to kbfb_events) so birthdays show up
// alongside real dates in the upcoming-dates feeds.
function getUpcomingBirthdayEvents() {
  return employeesCache
    .filter(employee => employeeBirthdayMonthDay(employee))
    .map(employee => ({
      date: nextBirthdayDateKey(employee),
      title: `${employee.name} har bursdag`,
      category: "bursdag",
      note: "",
      isBirthday: true
    }))
    .filter(event => event.date);
}

/* ---------- JUBILEUM ----------
   Same idea as birthdays, but built on kbfb_employees.start_date - here
   the year matters too, since it's used to count "X år hos oss" on
   each anniversary. Celebrated every year, not just round numbers. */

function employeeStartInfo(employee) {
  if (!employee?.start_date) return null;
  const parsed = new Date(employee.start_date + "T12:00:00");
  if (Number.isNaN(parsed.getTime())) return null;
  return { month: parsed.getMonth(), day: parsed.getDate(), year: parsed.getFullYear() };
}

// Next anniversary from today, plus how many years of service it marks.
function nextAnniversary(employee, fromDate = new Date()) {
  const info = employeeStartInfo(employee);
  if (!info) return null;

  const today = new Date(fromDate);
  today.setHours(0, 0, 0, 0);

  let candidateYear = today.getFullYear();
  let candidate = new Date(candidateYear, info.month, info.day);
  if (candidate < today) {
    candidateYear += 1;
    candidate = new Date(candidateYear, info.month, info.day);
  }

  const years = candidateYear - info.year;
  if (years <= 0) return null;

  return { dateKey: toDateKey(candidate), years };
}

function getEmployeesWithAnniversaryToday(fromDate = new Date()) {
  const todayKey = toDateKey(fromDate);

  return employeesCache
    .map(employee => {
      const next = nextAnniversary(employee, fromDate);
      return next && next.dateKey === todayKey ? { employee, years: next.years } : null;
    })
    .filter(Boolean);
}

function getUpcomingAnniversaryEvents() {
  return employeesCache
    .map(employee => {
      const next = nextAnniversary(employee);
      if (!next) return null;

      return {
        date: next.dateKey,
        title: `${employee.name} har ${next.years}-årsjubileum`,
        category: "jubileum",
        note: "",
        isAnniversary: true
      };
    })
    .filter(Boolean);
}

function getUpcomingEventsWithBirthdays(limit = 5) {
  const todayKey = toDateKey(new Date());

  return [...getEvents(), ...getUpcomingBirthdayEvents(), ...getUpcomingAnniversaryEvents()]
    .filter(event => event.date >= todayKey)
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .slice(0, limit);
}

function renderDashboardBirthdayBanner() {
  const banner = document.getElementById("dashboardBirthdayBanner");
  const text = document.getElementById("dashboardBirthdayText");
  if (!banner || !text) return;

  const birthdayEmployees = getEmployeesWithBirthdayToday();
  const anniversaryEmployees = getEmployeesWithAnniversaryToday();

  if (!birthdayEmployees.length && !anniversaryEmployees.length) {
    banner.style.display = "none";
    return;
  }

  const lines = [];

  if (birthdayEmployees.length) {
    const names = birthdayEmployees.map(employee => escapeHtml(employee.name));
    const namesText = names.length === 1
      ? names[0]
      : `${names.slice(0, -1).join(", ")} og ${names[names.length - 1]}`;

    lines.push(`🎉🎂 Gratulerer med dagen, ${namesText}!`);
  }

  anniversaryEmployees.forEach(({ employee, years }) => {
    lines.push(`🏆 Gratulerer med ${years} år hos oss, ${escapeHtml(employee.name)}!`);
  });

  text.innerHTML = lines.join("<br>");
  banner.style.display = "flex";
}

// Big confetti burst on top of the banner above - fires once per
// birthday-person per day (sessionStorage-gated), for whoever visits the
// dashboard that day, not just the birthday person themselves.
function triggerBirthdayConfettiIfNeeded() {
  const birthdayEmployees = getEmployeesWithBirthdayToday();
  if (!birthdayEmployees.length) return;

  const todayKey = toDateKey(new Date());
  const sessionKey = `kbfb-birthday-confetti-${todayKey}`;
  if (sessionStorage.getItem(sessionKey)) return;
  sessionStorage.setItem(sessionKey, "1");

  const names = birthdayEmployees.map(employee => employee.name);
  const namesText = names.length === 1
    ? names[0]
    : `${names.slice(0, -1).join(", ")} og ${names[names.length - 1]}`;

  launchBirthdayConfetti(namesText);
}

function launchBirthdayConfetti(namesText) {
  const message = document.createElement("div");
  message.className = "birthday-confetti-message";
  message.textContent = `🎉 Gratulerer med dagen, ${namesText}! 🎉`;
  document.body.appendChild(message);

  const canvas = document.createElement("canvas");
  canvas.className = "birthday-confetti-canvas";
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  document.body.appendChild(canvas);

  const ctx = canvas.getContext("2d");
  const colors = ["#ff6b6b", "#ffd93d", "#6bcb77", "#4d96ff", "#ff8fab", "#c77dff", "#ffa62b"];
  const pieces = [];

  for (let i = 0; i < 260; i++) {
    pieces.push({
      x: Math.random() * canvas.width,
      y: -20 - Math.random() * canvas.height,
      size: 6 + Math.random() * 9,
      color: colors[Math.floor(Math.random() * colors.length)],
      speedY: 2 + Math.random() * 4.5,
      speedX: -2.5 + Math.random() * 5,
      rotation: Math.random() * 360,
      rotationSpeed: -9 + Math.random() * 18,
      shape: Math.random() > 0.5 ? "rect" : "circle"
    });
  }

  let frame = 0;
  const maxFrames = 480;

  function draw() {
    frame++;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    pieces.forEach(piece => {
      piece.y += piece.speedY;
      piece.x += piece.speedX;
      piece.rotation += piece.rotationSpeed;

      if (piece.y > canvas.height + 20) {
        piece.y = -20;
        piece.x = Math.random() * canvas.width;
      }

      ctx.save();
      ctx.translate(piece.x, piece.y);
      ctx.rotate((piece.rotation * Math.PI) / 180);
      ctx.fillStyle = piece.color;

      if (piece.shape === "rect") {
        ctx.fillRect(-piece.size / 2, -piece.size / 4, piece.size, piece.size / 2);
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, piece.size / 2, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    });

    if (frame < maxFrames) {
      requestAnimationFrame(draw);
    } else {
      canvas.style.transition = "opacity 0.8s ease";
      message.style.transition = "opacity 0.8s ease";
      canvas.style.opacity = "0";
      message.style.opacity = "0";
      setTimeout(() => {
        canvas.remove();
        message.remove();
      }, 800);
    }
  }

  draw();
}

// Personal "Hei {name}!" greeting with photo, top-left of the dashboard
// hero. Re-run once loadEmployeeAvatars() resolves too, so the real
// photo swaps in for the initial-letter placeholder once it's fetched.
function renderDashboardGreeting() {
  const container = document.getElementById("dashboardGreeting");
  if (!container || typeof currentEmployee === "undefined" || !currentEmployee) return;

  const hour = new Date().getHours();
  const greetingWord = hour < 10 ? "God morgen" : hour < 18 ? "Hei" : "God kveld";

  container.innerHTML =
    `${avatarSpanFor(currentEmployee.name, "avatar-medium")}${greetingWord}, ${escapeHtml(currentEmployee.name)}! 👋`;
}

// Was comparing Date objects where the week's end boundary carried the
// same 00:00:00 time as its start (from getMonday), while eventDate was
// always T12:00:00 - so Friday's own notes/events (noon) fell *after*
// the Friday-midnight end boundary and got excluded from "this week".
// In practice: on a Friday, today's kitchen notes silently disappeared
// from the dashboard while Thursday's still showed. Comparing plain
// yyyy-mm-dd strings sidesteps the time-of-day mismatch entirely.
function eventIsInWeek(eventDate, weekStart) {
  const startKey = toDateKey(weekStart);
  const endKey = toDateKey(addDays(weekStart, 4));

  return eventDate >= startKey && eventDate <= endKey;
}

/* ---------- DASHBOARD ---------- */

const dashboardWeekTitle = document.getElementById("dashboardWeekTitle");
const dashboardWeekDates = document.getElementById("dashboardWeekDates");
const dashboardPrevWeek = document.getElementById("dashboardPrevWeek");
const dashboardNextWeek = document.getElementById("dashboardNextWeek");
const dashboardCurrentWeek = document.getElementById("dashboardCurrentWeek");
const dashboardKitchenNotes = document.getElementById("dashboardKitchenNotes");
const dashboardEvents = document.getElementById("dashboardEvents");

let dashboardViewedWeekStart = getMonday(new Date());
const dashboardRealWeekStart = getMonday(new Date());

function dateIsInDashboardWeek(dateString) {
  if (!dateString) return false;
  return eventIsInWeek(dateString, dashboardViewedWeekStart);
}

function renderDashboardEvents() {
  if (!dashboardEvents) return;

  const upcoming = getUpcomingEventsWithBirthdays(5);

  dashboardEvents.innerHTML = upcoming.length
    ? upcoming.map(event => `
      <div class="compact-item">
        <strong>${categoryEmoji(event.category)} ${formatKitchenDate(event.date)}</strong>
        <span>${escapeHtml(event.title)}${event.note ? ` · ${escapeHtml(event.note)}` : ""}</span>
      </div>
    `).join("")
    : `<p class="muted">Ingen kommende datoer.</p>`;

  renderDashboardBirthdayBanner();
  triggerBirthdayConfettiIfNeeded();
}

// Best-effort: finds a clock time mentioned inside a note's own text
// ("kl 14", "14:30", "kl. 9.15") so the day's notes can be shown in the
// order things actually happen, not the order they were typed. Notes
// with no recognizable time sort to the bottom (stable - keeps their
// relative order). Known limitation: a bare "20.08"-style date inside
// a note could get misread as a time (20:08) - "kl "-prefixed times
// are checked first and are unambiguous, so this only affects notes
// that mention a bare DD.MM date with no "kl" anywhere in the text.
function extractMentionedTimeMinutes(text) {
  if (!text) return null;

  const withKl = text.match(/\bkl\.?\s*(\d{1,2})(?:[:.,](\d{2}))?/i);
  if (withKl) {
    const hours = Number(withKl[1]);
    const minutes = withKl[2] ? Number(withKl[2]) : 0;
    if (hours <= 23 && minutes <= 59) return hours * 60 + minutes;
  }

  const bare = text.match(/\b([01]?\d|2[0-3])[:.]([0-5]\d)\b/);
  if (bare) return Number(bare[1]) * 60 + Number(bare[2]);

  return null;
}

function sortNotesByMentionedTime(notes) {
  return notes
    .map((note, index) => ({ note, index, time: extractMentionedTimeMinutes(note.text) }))
    .sort((a, b) => {
      if (a.time === null || b.time === null) {
        if (a.time === null && b.time === null) return a.index - b.index;
        return a.time === null ? 1 : -1;
      }
      return a.time - b.time || a.index - b.index;
    })
    .map(entry => entry.note);
}

function renderDashboardKitchenNotes() {
  if (!dashboardKitchenNotes) return;

  const now = new Date();
  const target = getUpcomingShiftDate(now);
  const targetKey = toDateKey(target);
  const dayLabel = relativeDayLabel(target, now);

  const kitchenPriorityTag = document.getElementById("kitchenPriorityTag");
  if (kitchenPriorityTag) kitchenPriorityTag.textContent = `📌 Kjøkkenboka ${dayLabel}`;

  const notes = sortNotesByMentionedTime(notesCache.filter(note => note.date === targetKey));

  dashboardKitchenNotes.innerHTML = notes.length
    ? notes.map(note => `
      <div class="compact-item">
        <strong>${escapeHtml(note.author)}</strong>
        <span>${escapeHtml(note.text)}</span>
      </div>
    `).join("") + renderDayReadBar(targetKey)
    : `<p class="muted">Ingen beskjeder ${dayLabel}.</p>`;

  dashboardKitchenNotes.querySelectorAll("[data-read-date]").forEach(button => {
    button.addEventListener("click", async () => {
      button.disabled = true;
      await toggleDayRead(button.dataset.readDate);
      await loadDayReadsFromSupabase();
      renderDashboardKitchenNotes();
      if (typeof renderQuickNotes === "function") renderQuickNotes();
    });
  });
}

const departmentEmoji = { Sommerfuglen: "🦋", Regnbuen: "🌈" };

// Barnehagen stenger kl 17 - etter det er "i dag" ikke lenger nyttig
// info, så vis neste virkedag i stedet (hopper over helg).
const BARNEHAGE_CLOSING_HOUR = 17;
const NORWEGIAN_WEEKDAYS = ["søndag", "mandag", "tirsdag", "onsdag", "torsdag", "fredag", "lørdag"];

function getUpcomingShiftDate(now = new Date()) {
  const target = new Date(now);
  if (now.getHours() >= BARNEHAGE_CLOSING_HOUR) target.setDate(target.getDate() + 1);
  while (target.getDay() === 0 || target.getDay() === 6) target.setDate(target.getDate() + 1);
  return target;
}

function relativeDayLabel(target, now) {
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfTarget = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  const diffDays = Math.round((startOfTarget - startOfToday) / 86400000);
  if (diffDays === 0) return "i dag";
  if (diffDays === 1) return "i morgen";
  return `på ${NORWEGIAN_WEEKDAYS[target.getDay()]}`;
}

// "Hvem jobber" - on-duty staff per department for the next relevant day,
// independent of whatever week the dashboard's own week-nav is browsing.
async function loadTodayShiftsForDashboard() {
  const container = document.getElementById("dashboardTodayShifts");
  if (!container) return;

  const now = new Date();
  const target = getUpcomingShiftDate(now);

  const priorityTag = document.getElementById("shiftPriorityTag");
  if (priorityTag) priorityTag.textContent = `📌 Hvem jobber ${relativeDayLabel(target, now)}`;

  const dayIndex = target.getDay() - 1;
  const weekStartValue = toDateKey(getMonday(target));

  const { data, error } = await supabaseClient
    .from("kbfb_shifts")
    .select("*")
    .eq("week_start", weekStartValue)
    .eq("day_index", dayIndex);

  if (error) {
    console.error("Kunne ikke hente dagens vakter:", error);
    container.innerHTML = `<p class="muted">Kunne ikke hente dagens vakter.</p>`;
    return;
  }

  const supportRows = ["Vikar", "Foreldreinnsats", "Ekstra"];
  const byDepartment = {};

  (data || []).forEach(shift => {
    const value = (shift.shift_value || "").trim();
    if (!value || absenceShiftCodes.includes(value)) return;

    if (!byDepartment[shift.department]) byDepartment[shift.department] = [];
    byDepartment[shift.department].push(shift);
  });

  // Chronological by shift start (TV -> TM -> MV -> SV), not whatever
  // order the rows happened to come back in - anything else (MØTE,
  // ANNET, vikar/foreldre/ekstra entries) keeps its relative order at
  // the end.
  const shiftOrder = ["TV", "TM", "MV", "SV"];
  Object.values(byDepartment).forEach(shifts => {
    shifts.sort((a, b) => {
      const aIndex = shiftOrder.indexOf(a.shift_value);
      const bIndex = shiftOrder.indexOf(b.shift_value);
      return (aIndex === -1 ? shiftOrder.length : aIndex) - (bIndex === -1 ? shiftOrder.length : bIndex);
    });
  });

  const departments = Object.keys(byDepartment).sort();

  if (!departments.length) {
    container.innerHTML = `<p class="muted">Ingen vakter registrert ${relativeDayLabel(target, now)} ennå.</p>`;
    return;
  }

  container.innerHTML = departments.map(dept => `
    <div class="today-shift-department">
      <h3>${departmentEmoji[dept] || "🏢"} ${escapeHtml(dept)}</h3>
      <div class="today-shift-list">
        ${byDepartment[dept].map(shift => supportRows.includes(shift.employee)
          ? `<span class="today-shift-person">🕒 ${escapeHtml(shift.shift_value)}</span>`
          : `<span class="today-shift-person">${avatarSpanFor(shift.employee, "avatar-medium")}${escapeHtml(shift.employee)} <span class="badge ${getShiftSelectClass(shift.shift_value)}">${escapeHtml(shift.shift_value)}</span></span>`
        ).join("")}
      </div>
    </div>
  `).join("");
}

const weatherIconByCode = {
  0: "☀️", 1: "🌤", 2: "⛅", 3: "☁️",
  45: "🌫", 48: "🌫",
  51: "🌦", 53: "🌦", 55: "🌧",
  56: "🌧", 57: "🌧",
  61: "🌦", 63: "🌧", 65: "🌧",
  66: "🌧", 67: "🌧",
  71: "🌨", 73: "🌨", 75: "❄️", 77: "❄️",
  80: "🌦", 81: "🌧", 82: "⛈",
  85: "🌨", 86: "❄️",
  95: "⛈", 96: "⛈", 99: "⛈"
};

function weatherIconFor(code) {
  return weatherIconByCode[code] || "🌡";
}

// Vøyenenga, Bærum - fixed coordinates for the barnehage. Open-Meteo:
// free, no API key, CORS-enabled for direct browser calls (unlike
// MET Norway's API, which needs a server-side User-Agent).
async function loadDashboardWeather() {
  const container = document.getElementById("dashboardWeather");
  if (!container) return;

  try {
    const response = await fetch(
      "https://api.open-meteo.com/v1/forecast?latitude=59.9085&longitude=10.4748&current=temperature_2m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=Europe%2FOslo&forecast_days=4"
    );

    if (!response.ok) throw new Error("Vær-API svarte med feil");

    const data = await response.json();
    const current = data.current;
    const daily = data.daily;
    const dayNames = ["Søn", "Man", "Tir", "Ons", "Tor", "Fre", "Lør"];

    const upcomingDays = daily.time.slice(1, 4).map((dateStr, i) => {
      const date = new Date(dateStr + "T12:00:00");
      return `
        <div class="weather-day">
          <span>${dayNames[date.getDay()]}</span>
          <span>${weatherIconFor(daily.weather_code[i + 1])}</span>
          <span>${Math.round(daily.temperature_2m_max[i + 1])}° / ${Math.round(daily.temperature_2m_min[i + 1])}°</span>
        </div>
      `;
    }).join("");

    container.innerHTML = `
      <div class="weather-current">
        <span class="weather-current-icon">${weatherIconFor(current.weather_code)}</span>
        <span class="weather-current-temp">${Math.round(current.temperature_2m)}°</span>
      </div>
      <div class="weather-upcoming">${upcomingDays}</div>
    `;
  } catch (error) {
    console.error("Kunne ikke hente værmelding:", error);
    container.innerHTML = `<p class="muted">Kunne ikke hente værmelding akkurat nå.</p>`;
  }
}

/* ---------- HYGGELIG BESKJED ---------- */

/* ---------- DEL ET BILDE (dashboard photo-share widget) ---------- */

const photoShareForm = document.getElementById("photoShareForm");
const photoShareInput = document.getElementById("photoShareInput");
const photoShareCaption = document.getElementById("photoShareCaption");
const photoShareStatus = document.getElementById("photoShareStatus");
const photoShareFeed = document.getElementById("photoShareFeed");

let photoReactionsCache = [];

async function loadPhotoReactionsFromSupabase() {
  const { data, error } = await supabaseClient.from("kbfb_photo_reactions").select("*");

  if (error) {
    console.error("Kunne ikke hente bildereaksjoner:", error);
    return [];
  }

  photoReactionsCache = data || [];
  return photoReactionsCache;
}

function reactionsForPhoto(photoId) {
  const myName = typeof currentEmployee !== "undefined" ? currentEmployee?.name : null;

  return REACTION_EMOJIS.map(emoji => {
    const matches = photoReactionsCache.filter(
      reaction => reaction.photo_id === photoId && reaction.emoji === emoji
    );

    return {
      emoji,
      count: matches.length,
      names: matches.map(reaction => reaction.author),
      reactedByMe: matches.some(reaction => reaction.author === myName)
    };
  });
}

async function togglePhotoReaction(photoId, emoji) {
  if (typeof currentEmployee === "undefined" || !currentEmployee) return;

  const existing = photoReactionsCache.find(
    reaction => reaction.photo_id === photoId && reaction.emoji === emoji && reaction.author === currentEmployee.name
  );

  if (existing) {
    const { error } = await supabaseClient.from("kbfb_photo_reactions").delete().eq("id", existing.id);
    if (error) console.error("Kunne ikke fjerne reaksjon:", error);
    return;
  }

  const { error } = await supabaseClient
    .from("kbfb_photo_reactions")
    .insert([{ photo_id: photoId, author: currentEmployee.name, emoji }]);

  if (error) console.error("Kunne ikke lagre reaksjon:", error);
}

function renderPhotoReactionBar(photoId) {
  const reactions = reactionsForPhoto(photoId);

  return `
    <div class="reaction-bar" data-photo-id="${photoId}">
      ${reactions.map(reaction => `
        <button
          type="button"
          class="reaction-btn${reaction.reactedByMe ? " reacted" : ""}"
          data-react-photo-id="${photoId}"
          data-react-emoji="${reaction.emoji}"
          ${reaction.count ? `title="${escapeHtml(reaction.names.join(", "))}"` : ""}
        >
          <span>${reaction.emoji}</span>
          ${reaction.count ? `<span class="reaction-count">${reaction.count}</span>` : ""}
        </button>
      `).join("")}
    </div>
  `;
}

function wireSharedPhotoReactionButtons() {
  document.querySelectorAll("[data-react-photo-id]").forEach(button => {
    button.addEventListener("click", async () => {
      button.disabled = true;
      await togglePhotoReaction(button.dataset.reactPhotoId, button.dataset.reactEmoji);
      await loadPhotoReactionsFromSupabase();

      document.querySelectorAll(".compact-item .reaction-bar[data-photo-id]").forEach(bar => {
        bar.outerHTML = renderPhotoReactionBar(bar.dataset.photoId);
      });

      wireSharedPhotoReactionButtons();
    });
  });
}

async function loadSharedPhotos() {
  if (!photoShareFeed) return;

  const [sharedPhotosResult] = await Promise.all([
    supabaseClient
      .from("kbfb_shared_photos")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(3),
    loadPhotoReactionsFromSupabase()
  ]);

  const { data, error } = sharedPhotosResult;

  if (error) {
    console.error("Kunne ikke hente delte bilder:", error);
    return;
  }

  if (!data.length) {
    photoShareFeed.innerHTML = `<p class="muted">Ingen bilder delt ennå. Vær den første!</p>`;
    return;
  }

  const isAdmin = typeof currentEmployee !== "undefined" && !!currentEmployee?.is_admin;

  photoShareFeed.innerHTML = data.map(photo => `
    <div class="compact-item">
      <strong>${avatarSpanFor(photo.author, "avatar-tiny")}${escapeHtml(photo.author)}</strong>
      <img class="shared-photo-img" src="${photo.photo_url}" alt="${escapeHtml(photo.caption || "Delt bilde")}" />
      ${photo.caption ? `<span>${escapeHtml(photo.caption)}</span>` : ""}
      ${renderPhotoReactionBar(photo.id)}
      ${(isAdmin || (typeof currentEmployee !== "undefined" && currentEmployee?.name === photo.author)) ? `<button class="kitchen-delete" data-shared-photo-id="${photo.id}" style="margin-top: 4px;">Slett</button>` : ""}
    </div>
  `).join("");

  document.querySelectorAll("[data-shared-photo-id]").forEach(button => {
    button.addEventListener("click", async () => {
      await supabaseClient.from("kbfb_shared_photos").delete().eq("id", button.dataset.sharedPhotoId);
      await loadSharedPhotos();
    });
  });

  photoShareFeed.querySelectorAll(".shared-photo-img").forEach(img => {
    img.addEventListener("click", () => openPhotoLightbox(img.src));
  });

  wireSharedPhotoReactionButtons();
}

function openPhotoLightbox(url) {
  const overlay = document.createElement("div");
  overlay.className = "photo-lightbox";
  overlay.innerHTML = `<img src="${escapeHtml(url)}" alt="" />`;
  overlay.addEventListener("click", () => overlay.remove());
  document.body.appendChild(overlay);
}

if (photoShareForm) {
  photoShareForm.addEventListener("submit", async event => {
    event.preventDefault();

    if (typeof currentEmployee === "undefined" || !currentEmployee) {
      if (photoShareStatus) photoShareStatus.textContent = "Fant ikke innlogget bruker. Prøv å laste siden på nytt.";
      return;
    }

    const file = photoShareInput.files[0];
    if (!file) return;

    if (photoShareStatus) photoShareStatus.textContent = "Laster opp...";

    const extension = file.name.split(".").pop() || "jpg";
    const filePath = `${currentEmployee.id}-${Date.now()}.${extension}`;

    const { error: uploadError } = await supabaseClient.storage
      .from("shared-photos")
      .upload(filePath, file, { contentType: file.type || "image/jpeg" });

    if (uploadError) {
      console.error("Kunne ikke laste opp bilde:", uploadError);
      if (photoShareStatus) photoShareStatus.textContent = "Kunne ikke laste opp bilde.";
      return;
    }

    const { data: publicUrlData } = supabaseClient.storage
      .from("shared-photos")
      .getPublicUrl(filePath);

    const { error } = await supabaseClient.from("kbfb_shared_photos").insert([{
      author: currentEmployee.name,
      photo_url: publicUrlData.publicUrl,
      caption: photoShareCaption.value.trim() || null
    }]);

    if (error) {
      console.error("Kunne ikke dele bilde:", error);
      if (photoShareStatus) photoShareStatus.textContent = "Kunne ikke dele bilde. Prøv igjen.";
      return;
    }

    photoShareForm.reset();
    if (photoShareStatus) photoShareStatus.textContent = "Bilde delt!";
    await loadSharedPhotos();
  });
}

loadSharedPhotos();

/* ---------- HYGGELIG BESKJED ---------- */

const kindMessageForm = document.getElementById("kindMessageForm");
const kindMessageText = document.getElementById("kindMessageText");
const kindMessageFeed = document.getElementById("kindMessageFeed");

async function loadKindMessages() {
  if (!kindMessageFeed) return;

  const { data, error } = await supabaseClient
    .from("kbfb_kind_messages")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(3);

  if (error) {
    console.error("Kunne ikke hente hyggelige beskjeder:", error);
    return;
  }

  if (!data.length) {
    kindMessageFeed.innerHTML = `<p class="muted">Ingen hyggelige beskjeder ennå. Vær den første!</p>`;
    return;
  }

  const isAdmin = typeof currentEmployee !== "undefined" && !!currentEmployee?.is_admin;

  kindMessageFeed.innerHTML = data.map(msg => `
    <div class="compact-item">
      <strong>${avatarSpanFor(msg.author, "avatar-tiny")}${escapeHtml(msg.author)}</strong>
      <span>${escapeHtml(msg.text)}</span>
      ${(isAdmin || (typeof currentEmployee !== "undefined" && currentEmployee?.name === msg.author)) ? `<button class="kitchen-delete" data-kind-message-id="${msg.id}" style="margin-top: 4px;">Slett</button>` : ""}
    </div>
  `).join("");

  document.querySelectorAll("[data-kind-message-id]").forEach(button => {
    button.addEventListener("click", async () => {
      await supabaseClient.from("kbfb_kind_messages").delete().eq("id", button.dataset.kindMessageId);
      await loadKindMessages();
    });
  });
}

if (kindMessageForm) {
  kindMessageForm.addEventListener("submit", async event => {
    event.preventDefault();

    if (typeof currentEmployee === "undefined" || !currentEmployee) {
      alert("Fant ikke innlogget bruker. Prøv å laste siden på nytt.");
      return;
    }

    const { error } = await supabaseClient
      .from("kbfb_kind_messages")
      .insert([{ author: currentEmployee.name, text: kindMessageText.value.trim() }]);

    if (error) {
      console.error("Kunne ikke sende hyggelig beskjed:", error);
      alert("Kunne ikke sende. Prøv igjen.");
      return;
    }

    kindMessageForm.reset();
    await loadKindMessages();
  });
}

loadTodayShiftsForDashboard();
loadDashboardWeather();
loadKindMessages();

function updateDashboardWeek() {
  if (!dashboardWeekTitle || !dashboardWeekDates) return;

  const weekNumber = getWeekNumber(dashboardViewedWeekStart);
  const friday = addDays(dashboardViewedWeekStart, 4);

  dashboardWeekTitle.textContent = `Uke ${weekNumber}`;
  dashboardWeekDates.textContent = `${formatShortDate(dashboardViewedWeekStart)}–${formatShortDate(friday)} · Ukas oversikt`;

  renderDashboardEvents();
  renderDashboardKitchenNotes();
}

if (dashboardPrevWeek) {
  dashboardPrevWeek.addEventListener("click", () => {
    dashboardViewedWeekStart = addWeeks(dashboardViewedWeekStart, -1);
    updateDashboardWeek();
  });
}

if (dashboardNextWeek) {
  dashboardNextWeek.addEventListener("click", () => {
    dashboardViewedWeekStart = addWeeks(dashboardViewedWeekStart, 1);
    updateDashboardWeek();
  });
}

if (dashboardCurrentWeek) {
  dashboardCurrentWeek.addEventListener("click", () => {
    dashboardViewedWeekStart = new Date(dashboardRealWeekStart);
    updateDashboardWeek();
  });
}

updateDashboardWeek();

let shiftsCache = [];

async function loadShiftsFromSupabase() {
  const weekKey = getCurrentWeekKey();

  const { data, error } = await supabaseClient
    .from("kbfb_shifts")
    .select("*")
    .eq("week_start", weekKey);

  if (error) {
    console.error("Kunne ikke hente vakter:", error);
    return [];
  }

  shiftsCache = data || [];
  return shiftsCache;
}
async function renderMonthView() {
  if (!monthViewContent) return;

  const shifts = await loadMonthShiftsFromSupabase();

  if (!shifts.length) {
    monthViewContent.innerHTML = `<p class="muted">Ingen vakter denne måneden.</p>`;
    return;
  }

  const grouped = {};

  shifts.forEach(shift => {
    if (!grouped[shift.employee]) {
      grouped[shift.employee] = [];
    }

    grouped[shift.employee].push(shift);
  });

  monthViewContent.innerHTML = Object.entries(grouped)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([employee, employeeShifts]) => `
      <div class="month-employee-card">
        <h3>${employee}</h3>

        ${employeeShifts
          .sort((a, b) =>
            a.week_start.localeCompare(b.week_start) ||
            a.day_index - b.day_index
          )
          .map(shift => `
            <div class="compact-item">
              <strong>${formatMonthShiftDate(shift.week_start, shift.day_index)}</strong>
              <span>${escapeHtml(shift.shift_value) || "-"}</span>
            </div>
          `)
          .join("")}
      </div>
    `)
    .join("");
}

function formatMonthShiftDate(weekStart, dayIndex) {
  const date = addDays(new Date(weekStart + "T12:00:00"), dayIndex);
  return date.toLocaleDateString("no-NO", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit"
  });
}
async function loadMonthShiftsFromSupabase() {
  const monthKey = toMonthKey(viewedWeekStart);

  const { data, error } = await supabaseClient
    .from("kbfb_shifts")
    .select("*")
    .gte("week_start", `${monthKey}-01`)
    .lt("week_start", `${monthKey}-32`);

  if (error) {
    console.error(error);
    return [];
  }

  return data || [];
}

async function saveShiftToSupabase(shift) {
  const existing = shiftsCache.find(item =>
    item.week_start === shift.week_start &&
    item.department === shift.department &&
    item.employee === shift.employee &&
    item.day_index === shift.day_index
  );

  if (existing) {
    const { error } = await supabaseClient
      .from("kbfb_shifts")
      .update({
        shift_value: shift.shift_value
      })
      .eq("id", existing.id);

    if (error) {
      console.error(error);
    }

    return;
  }

  const { error } = await supabaseClient
    .from("kbfb_shifts")
    .insert([shift]);

  if (error) {
    console.error(error);
  }
}

/* ---------- VAKTLISTE MED DROPDOWN ---------- */

const employeeFilter = document.getElementById("employeeFilter");
const departmentFilter = document.getElementById("departmentFilter");
const dateSearch = document.getElementById("dateSearch");
const weekEvents = document.getElementById("weekEvents");

const weekTitle = document.getElementById("weekTitle");
const weekDates = document.getElementById("weekDates");
const prevWeekBtn = document.getElementById("prevWeek");
const nextWeekBtn = document.getElementById("nextWeek");
const currentWeekBtn = document.getElementById("currentWeek");
const weekViewBtn = document.getElementById("weekViewBtn");
const monthViewBtn = document.getElementById("monthViewBtn");
const monthViewSection = document.getElementById("monthViewSection");
const monthViewContent = document.getElementById("monthViewContent");

let viewedWeekStart = getMonday(new Date());
const realCurrentWeekStart = getMonday(new Date());

const shiftValues = ["", "TV", "TM", "MV", "SV", "F", "AVS", "TJ", "PERM", "PLANDAG", "MØTE", "ANNET"];

function getCurrentWeekKey() {
  return toDateKey(viewedWeekStart);
}

function getShiftSelectClass(value) {
  if (value === "TV") return "tv";
  if (value === "TM") return "tm";
  if (value === "MV") return "mv";
  if (value === "SM") return "sm";
  if (value === "SV") return "sv";
  if (value === "PT") return "pt";
  if (value === "F" || value === "AVS" || value === "TJ" || value === "PERM" || value === "PLANDAG") return "free";
  if (value === "KONTOR" || value === "MØTE") return "office";
  if (value === "ANNET") return "custom";
  return "";
}

// On the vaktplan grid, rows carry the employee's own color (see
// applyEmployeeRowColors) instead of the shift type - so here we just
// reset to a neutral, legible style rather than coloring by shift value.
function colorShiftSelect(select) {
  // Row color replaces shift-type coloring for regular shifts - but
  // "unavailable" (F/AVS/TJ/PERM/PLANDAG) still needs to read as red at a
  // glance regardless of whose row it's on, so that one signal survives.
  const isUnavailable = getShiftSelectClass(select.value) === "free";
  select.className = isUnavailable ? "shift-select free" : "shift-select neutral";
}

// Whole rows on the vaktplan department tables show the employee's own
// color instead of shift-type coloring - easier to scan a person's week
// across the row. Support rows (Vikar/Foreldreinnsats/Ekstra) aren't tied
// to one person, so they're left uncolored.
function applyEmployeeRowColors() {
  document.querySelectorAll(".department-table tr[data-employee]").forEach(row => {
    const name = row.dataset.employee;
    if (name === "Vikar" || name === "Foreldreinnsats" || name === "Ekstra") return;

    const employee = employeesCache.find(item => item.name === name);
    row.style.background = employee?.color || "";
  });
}

function buildShiftDropdowns() {
  const isAdmin = typeof currentEmployee !== "undefined" &&
    !!(currentEmployee?.is_admin || currentEmployee?.role === "Avdelingsleder");

  const shiftEditHelp = document.getElementById("shiftEditHelp");
  if (shiftEditHelp) shiftEditHelp.style.display = isAdmin ? "" : "none";

  applyEmployeeRowColors();

  document.querySelectorAll(".shift-cell").forEach(cell => {
    const row = cell.closest("tr");

    const dayIndex =
      Array.from(row.querySelectorAll(".shift-cell")).indexOf(cell);

    const existingShift = shiftsCache.find(item =>
      item.week_start === getCurrentWeekKey() &&
      item.department === row.dataset.department &&
      item.employee === row.dataset.employee &&
      item.day_index === dayIndex
    );

    const defaultValue =
      existingShift?.shift_value ||
      cell.dataset.default ||
      "";

    if (!isAdmin) {
      cell.innerHTML = "";
      const badge = document.createElement("span");
      const isUnavailable = getShiftSelectClass(defaultValue) === "free";
      badge.className = isUnavailable ? "badge free" : "badge neutral";
      badge.textContent = defaultValue || "—";
      cell.appendChild(badge);
      return;
    }

    const isVikarRow = row.dataset.employee === "Vikar";
    const isParentRow = row.dataset.employee === "Foreldreinnsats";
    const isExtraRow = row.dataset.employee === "Ekstra";

    if (isParentRow || isExtraRow) {
      cell.innerHTML = "";

      const freeTextInput = document.createElement("input");
      freeTextInput.type = "text";
      freeTextInput.className = "custom-shift-input";
      freeTextInput.placeholder = isExtraRow ? "Navn på ansatt, f.eks. Benjamin" : "Navn på forelder";
      freeTextInput.style.display = "block";
      freeTextInput.value = defaultValue;

      freeTextInput.addEventListener("input", async () => {
        await saveShiftToSupabase({
          week_start: getCurrentWeekKey(),
          department: row.dataset.department,
          employee: row.dataset.employee,
          day_index: dayIndex,
          shift_value: freeTextInput.value.trim()
        });

        await loadShiftsFromSupabase();
        updateShiftHeadcounts();
      });

      cell.appendChild(freeTextInput);
      return;
    }

    if (isVikarRow) {
      cell.innerHTML = "";

      // A saved value looks like "Kari 08:00-16:00" - split off the name
      // (if it matches someone in the pool) from the time/note that follows.
      const matchedPerson = (subPeopleCache || []).find(person =>
        defaultValue === person.name ||
        defaultValue.toLowerCase().startsWith(`${person.name.toLowerCase()} `)
      );
      const initialName = matchedPerson ? matchedPerson.name : "";
      const initialTime = matchedPerson
        ? defaultValue.slice(matchedPerson.name.length).trim()
        : defaultValue;

      const vikarPicker = document.createElement("select");
      vikarPicker.className = "vikar-picker";

      const emptyOption = document.createElement("option");
      emptyOption.value = "";
      emptyOption.textContent = "Velg vikar...";
      vikarPicker.appendChild(emptyOption);

      (subPeopleCache || []).forEach(person => {
        const option = document.createElement("option");
        option.value = person.name;
        option.textContent = person.name;
        vikarPicker.appendChild(option);
      });

      const nameChip = document.createElement("div");
      nameChip.className = "vikar-chip";

      const nameChipLabel = document.createElement("span");
      const nameChipClear = document.createElement("button");
      nameChipClear.type = "button";
      nameChipClear.className = "vikar-chip-clear";
      nameChipClear.textContent = "×";
      nameChip.appendChild(nameChipLabel);
      nameChip.appendChild(nameChipClear);

      const timeInput = document.createElement("input");
      timeInput.type = "text";
      timeInput.className = "custom-shift-input";
      timeInput.placeholder = "Klokkeslett, f.eks. 08:00–16:00";
      timeInput.value = initialTime;

      function setVikarName(name) {
        if (name) {
          nameChipLabel.textContent = name;
          nameChip.style.display = "flex";
          vikarPicker.style.display = "none";
        } else {
          nameChip.style.display = "none";
          vikarPicker.style.display = "block";
          vikarPicker.value = "";
        }
      }

      async function saveVikarCell() {
        const name = nameChip.style.display === "none" ? "" : nameChipLabel.textContent;
        const combined = [name, timeInput.value.trim()].filter(Boolean).join(" ").trim();

        await saveShiftToSupabase({
          week_start: getCurrentWeekKey(),
          department: row.dataset.department,
          employee: row.dataset.employee,
          day_index: dayIndex,
          shift_value: combined
        });

        await loadShiftsFromSupabase();
        updateShiftHeadcounts();
      }

      vikarPicker.addEventListener("change", async () => {
        if (!vikarPicker.value) return;
        setVikarName(vikarPicker.value);
        timeInput.focus();
        await saveVikarCell();
      });

      nameChipClear.addEventListener("click", async () => {
        setVikarName("");
        await saveVikarCell();
      });

      timeInput.addEventListener("input", saveVikarCell);

      setVikarName(initialName);

      cell.appendChild(vikarPicker);
      cell.appendChild(nameChip);
      cell.appendChild(timeInput);
      return;
    }

    const select = document.createElement("select");
    select.className = "shift-select";

    shiftValues.forEach(value => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = value === "" ? "—" : value;
      select.appendChild(option);
    });

    const customInput = document.createElement("input");
    customInput.type = "text";
    customInput.className = "custom-shift-input";
    customInput.placeholder = "11–14, Maxi, Sharlene...";
    customInput.style.display = "none";

    if (shiftValues.includes(defaultValue)) {
      select.value = defaultValue;
    } else if (defaultValue) {
      select.value = "ANNET";
      customInput.value = defaultValue;
      customInput.style.display = "block";
    }

    colorShiftSelect(select);

    select.addEventListener("change", async () => {
      colorShiftSelect(select);

      if (select.value === "ANNET") {
        customInput.style.display = "block";
        customInput.focus();

        await saveShiftToSupabase({
          week_start: getCurrentWeekKey(),
          department: row.dataset.department,
          employee: row.dataset.employee,
          day_index: dayIndex,
          shift_value: customInput.value.trim()
        });

      } else {
        customInput.style.display = "none";
        customInput.value = "";

        await saveShiftToSupabase({
          week_start: getCurrentWeekKey(),
          department: row.dataset.department,
          employee: row.dataset.employee,
          day_index: dayIndex,
          shift_value: select.value
        });
      }

      await loadShiftsFromSupabase();
      updateShiftHeadcounts();
    });

    customInput.addEventListener("input", async () => {
      await saveShiftToSupabase({
        week_start: getCurrentWeekKey(),
        department: row.dataset.department,
        employee: row.dataset.employee,
        day_index: dayIndex,
        shift_value: customInput.value.trim()
      });

      await loadShiftsFromSupabase();
      updateShiftHeadcounts();
    });

    cell.innerHTML = "";
    cell.appendChild(select);
    cell.appendChild(customInput);
  });
}

/* ---------- VIKAR/FORELDREINNSATS/EKSTRA - SKJUL NÅR TOMME ----------
   These support rows exist on every department table but most weeks
   only one or none of them are actually used - showing all three,
   every week, made the schedule feel cluttered. So: hide a support row
   by default when it has nothing entered for the displayed week, and
   let a small toggle per department reveal them again for editing. Any
   row that DOES have content stays visible automatically - nothing
   real ever gets hidden. */

function supportRowHasContent(row) {
  const isVikarRow = row.dataset.employee === "Vikar";

  return Array.from(row.querySelectorAll(".shift-cell")).some(cell => {
    const badge = cell.querySelector(".badge");
    if (badge) {
      const value = badge.textContent.trim();
      return !!value && value !== "—";
    }

    if (isVikarRow) {
      const nameChip = cell.querySelector(".vikar-chip");
      const timeInput = cell.querySelector(".custom-shift-input");
      const hasName = !!nameChip && nameChip.style.display !== "none";
      return hasName || !!timeInput?.value.trim();
    }

    // A "support" row that's actually a named person (e.g. Lola) still gets
    // the normal shift-type dropdown, not a free-text cell - check that too,
    // otherwise her existing shifts would look empty in the admin edit view
    // and the row would wrongly collapse.
    const select = cell.querySelector("select.shift-select");
    if (select) return !!select.value;

    const customInput = cell.querySelector(".custom-shift-input");
    return !!customInput?.value.trim();
  });
}

function applySupportRowVisibility() {
  document.querySelectorAll(".department-section").forEach(section => {
    const supportRows = Array.from(section.querySelectorAll(".support-row"));
    const toggle = section.querySelector(".support-toggle");
    if (!supportRows.length) return;

    const expanded = section.dataset.supportExpanded === "1";
    const emptyRows = supportRows.filter(row => !supportRowHasContent(row));

    supportRows.forEach(row => {
      row.style.display = emptyRows.includes(row) && !expanded ? "none" : "";
    });

    if (!toggle) return;

    if (!emptyRows.length) {
      toggle.style.display = "none";
      return;
    }

    toggle.style.display = "";
    toggle.textContent = expanded
      ? "− Skjul tomme rader"
      : "+ Vis vikar / foreldreinnsats / ekstra";
  });
}

document.querySelectorAll(".support-toggle").forEach(toggle => {
  toggle.addEventListener("click", () => {
    const section = toggle.closest(".department-section");
    if (!section) return;
    section.dataset.supportExpanded = section.dataset.supportExpanded === "1" ? "0" : "1";
    applySupportRowVisibility();
  });
});

function renderWeekEvents() {
  if (!weekEvents) return;

  const events = getEvents()
    .filter(event => eventIsInWeek(event.date, viewedWeekStart))
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  weekEvents.innerHTML = events.length
    ? events.map(event => `
      <div class="compact-item">
        <strong>${categoryEmoji(event.category)} ${formatKitchenDate(event.date)}</strong>
        <span>${escapeHtml(event.title)}${event.note ? ` · ${escapeHtml(event.note)}` : ""}</span>
      </div>
    `).join("")
    : `<p class="muted">Ingen datoer denne uka.</p>`;
}

// Sommerfuglen/Regnbuen alternate "inneansvar"/"uteansvar" every week.
// Reference point: uke 34, 2026 (week starting 2026-08-17) - Sommerfuglen
// had inne, Regnbuen had ute that week. Any other week just counts whole
// weeks from this date to know whether it's flipped or not.
const responsibilityReferenceWeekStart = "2026-08-17";
const responsibilityReferenceInne = "Sommerfuglen";
const responsibilityReferenceUte = "Regnbuen";

function getWeeklyResponsibility(weekStartValue) {
  const refDate = new Date(responsibilityReferenceWeekStart + "T12:00:00");
  const targetDate = new Date(weekStartValue + "T12:00:00");
  const weeksDiff = Math.round((targetDate - refDate) / (7 * 24 * 60 * 60 * 1000));
  const flipped = (((weeksDiff % 2) + 2) % 2) === 1;

  return flipped
    ? { inne: responsibilityReferenceUte, ute: responsibilityReferenceInne }
    : { inne: responsibilityReferenceInne, ute: responsibilityReferenceUte };
}

function renderResponsibilityBanner(weekStartValue) {
  const container = document.getElementById("responsibilityBanner");
  if (!container) return;

  const responsibility = getWeeklyResponsibility(weekStartValue);
  const inneEmoji = responsibility.inne === "Sommerfuglen" ? "🦋" : "🌈";
  const uteEmoji = responsibility.ute === "Sommerfuglen" ? "🦋" : "🌈";

  container.innerHTML =
    `🏠 ${inneEmoji} <strong>${escapeHtml(responsibility.inne)}</strong> har inneansvar` +
    ` · 🌳 ${uteEmoji} <strong>${escapeHtml(responsibility.ute)}</strong> har uteansvar denne uka`;
}

async function updateWeekView() {
  await loadShiftsFromSupabase();

  if (!weekTitle || !weekDates) return;

  await loadSubPeopleFromSupabase();

  const weekNumber = getWeekNumber(viewedWeekStart);
  const friday = addDays(viewedWeekStart, 4);

  weekTitle.textContent = `Uke ${weekNumber}`;
  weekDates.textContent = `${formatShortDate(viewedWeekStart)}–${formatShortDate(friday)} · Åpningstid 07:30–17:00`;

  const dayNames = ["Mandag", "Tirsdag", "Onsdag", "Torsdag", "Fredag"];

  document.querySelectorAll(".day-head").forEach(head => {
    const dayIndex = Number(head.dataset.day);
    const date = addDays(viewedWeekStart, dayIndex);
    head.innerHTML = `${dayNames[dayIndex]}<br><span>${formatShortDate(date)}</span>`;
  });

  buildShiftDropdowns();
  applySupportRowVisibility();
  updateShiftHeadcounts();
  renderWeekEvents();
  populateSwapWithSelect();
  loadSwapInbox();
  renderResponsibilityBanner(toDateKey(viewedWeekStart));
}

const absenceShiftCodes = ["F", "AVS", "TJ", "PERM", "PLANDAG"];

function updateShiftHeadcounts() {
  document.querySelectorAll(".department-table").forEach(table => {
    const rows = Array.from(table.querySelectorAll("tbody tr"));

    for (let dayIndex = 0; dayIndex < 5; dayIndex++) {
      let count = 0;

      rows.forEach(row => {
        const cell = row.querySelectorAll(".shift-cell")[dayIndex];
        if (!cell) return;

        const select = cell.querySelector("select.shift-select");
        const customInput = cell.querySelector(".custom-shift-input");
        const badge = cell.querySelector(".badge");
        const vikarChip = cell.querySelector(".vikar-chip");

        let hasSomeone = false;

        if (select) {
          const value = select.value === "ANNET" ? (customInput?.value.trim() || "") : select.value;
          hasSomeone = !!value && !absenceShiftCodes.includes(value);
        } else if (badge) {
          const value = badge.textContent === "—" ? "" : badge.textContent.trim();
          hasSomeone = !!value && !absenceShiftCodes.includes(value);
        } else {
          const vikarNamed = !!vikarChip && vikarChip.style.display !== "none";
          hasSomeone = vikarNamed || !!customInput?.value.trim();
        }

        if (hasSomeone) count++;
      });

      const countCell = table.querySelector(`.day-count[data-day="${dayIndex}"]`);
      if (!countCell) continue;

      countCell.textContent = `(${count})`;
      countCell.classList.toggle("thin", count <= 1);
    }
  });
}

/* ---------- PUSH-VARSLER (Vaktbytte fase 2) ---------- */

// Public VAPID key - safe to expose client-side, this is the whole point
// of the public/private VAPID split. Must match VAPID_PRIVATE_KEY set as
// a secret on the send-push-notification Edge Function.
const VAPID_PUBLIC_KEY = "BLdbTLsLsfwTGcJe7CezOkqX5tAQIB8M47mFCql2plJnRx7Hh13xkdCmuW_l5JDNIshQ-J-32JqUSKAcbbTYj-8";

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map(char => char.charCodeAt(0)));
}

function pushSupported() {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

async function getPushSubscription() {
  if (!pushSupported()) return null;
  const registration = await navigator.serviceWorker.ready;
  return registration.pushManager.getSubscription();
}

async function enablePushNotifications() {
  if (!pushSupported()) {
    alert("Denne nettleseren/enheten støtter ikke push-varsler.");
    return false;
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    alert("Du må tillate varsler i nettleseren for å skru dette på.");
    return false;
  }

  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
  });

  const json = subscription.toJSON();
  const { error } = await supabaseClient
    .from("kbfb_push_subscriptions")
    .upsert([{
      employee_name: currentEmployee.name,
      endpoint: json.endpoint,
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
    }], { onConflict: "endpoint" });

  if (error) {
    console.error("Kunne ikke lagre push-abonnement:", error);
    alert("Kunne ikke skru på varsler. Prøv igjen.");
    return false;
  }

  return true;
}

async function disablePushNotifications() {
  const subscription = await getPushSubscription();
  if (!subscription) return;

  await supabaseClient.from("kbfb_push_subscriptions").delete().eq("endpoint", subscription.endpoint);
  await subscription.unsubscribe();
}

function setPushToggleLabel(button, subscribed) {
  button.textContent = subscribed ? "🔕 Skru av varsler på denne enheten" : "🔔 Skru på varsler på denne enheten";
  button.dataset.subscribed = subscribed ? "1" : "0";
}

async function initPushToggle() {
  const button = document.getElementById("pushToggleBtn");
  const status = document.getElementById("pushToggleStatus");
  if (!button) return;

  if (!pushSupported()) {
    button.style.display = "none";
    if (status) status.textContent = "Push-varsler støttes ikke i denne nettleseren.";
    return;
  }

  const existing = await getPushSubscription();
  setPushToggleLabel(button, !!existing);

  button.addEventListener("click", async () => {
    button.disabled = true;
    const subscribed = button.dataset.subscribed === "1";

    if (subscribed) {
      await disablePushNotifications();
      setPushToggleLabel(button, false);
      if (status) status.textContent = "Varsler skrudd av på denne enheten.";
    } else {
      const success = await enablePushNotifications();
      setPushToggleLabel(button, success);
      if (status) status.textContent = success ? "Varsler skrudd på for denne enheten ✓" : "";
    }

    button.disabled = false;
  });
}

// Fire-and-forget - a failed push should never block the action that
// triggered it (sending a swap request, accepting one, ...).
async function sendPushNotification(employeeNames, title, body, url) {
  const targets = [...new Set(employeeNames)].filter(name => name && name !== currentEmployee?.name);
  if (!targets.length) return;

  try {
    await supabaseClient.functions.invoke("send-push-notification", {
      body: { to: targets, title, body, url },
    });
  } catch (error) {
    console.error("Kunne ikke sende push-varsel:", error);
  }
}

async function notifyDepartmentLeadersOfSwap(departments, message) {
  const uniqueDepartments = [...new Set(departments.filter(Boolean))];
  if (!uniqueDepartments.length) return;

  const { data, error } = await supabaseClient
    .from("kbfb_employees")
    .select("name")
    .eq("role", "Avdelingsleder")
    .in("department", uniqueDepartments);

  if (error || !data?.length) return;

  sendPushNotification(data.map(employee => employee.name), "Vaktbytte godtatt", message, "vakter.html");
}

/* ---------- VAKTBYTTE ---------- */

let swapInboxCache = [];

const swapRequestForm = document.getElementById("swapRequestForm");
const swapDate = document.getElementById("swapDate");
const swapWithEmployee = document.getElementById("swapWithEmployee");
const swapPreview = document.getElementById("swapPreview");
const swapRequestStatus = document.getElementById("swapRequestStatus");
const swapInboxList = document.getElementById("swapInboxList");

// shiftsCache only holds whatever week is currently displayed on vakter.html,
// but a swap request can point at any date - so look up the real row from
// Supabase directly instead of trusting the cache.
async function fetchShiftValue(weekStartValue, department, employee, dayIndex) {
  if (!department || !employee) return "";

  const { data, error } = await supabaseClient
    .from("kbfb_shifts")
    .select("shift_value")
    .eq("week_start", weekStartValue)
    .eq("department", department)
    .eq("employee", employee)
    .eq("day_index", dayIndex)
    .order("created_at", { ascending: false })
    .limit(1);

  if (error) {
    console.error("Kunne ikke hente vakt for bytte:", error);
    return "";
  }

  return data?.[0]?.shift_value || "";
}

// currentEmployee.department (from kbfb_employees) doesn't reliably match
// which department someone's shifts are actually logged under in
// kbfb_shifts (e.g. Daglig leder isn't tied to one department) - so read it
// straight off the schedule grid instead, same source used for the person
// you're swapping with.
function findEmployeeDepartmentFromGrid(name) {
  const row = Array.from(document.querySelectorAll(".department-table tbody tr[data-employee]"))
    .find(r => !r.classList.contains("support-row") && r.dataset.employee === name);
  return row?.dataset.department || null;
}

function populateSwapWithSelect() {
  if (!swapWithEmployee) return;

  const rows = Array.from(document.querySelectorAll(".department-table tbody tr[data-employee]"))
    .filter(row => !row.classList.contains("support-row"));

  const seen = new Set();
  swapWithEmployee.innerHTML = `<option value="">Velg ansatt</option>`;

  rows.forEach(row => {
    const name = row.dataset.employee;
    const department = row.dataset.department;
    if (!name || seen.has(name)) return;
    if (typeof currentEmployee !== "undefined" && currentEmployee?.name === name) return;
    seen.add(name);

    const option = document.createElement("option");
    option.value = name;
    option.dataset.department = department;
    option.textContent = `${name} (${department})`;
    swapWithEmployee.appendChild(option);
  });
}

function swapDayIndexFromDate(dateString) {
  const date = new Date(dateString + "T12:00:00");
  const dayOfWeek = date.getDay();
  if (dayOfWeek === 0 || dayOfWeek === 6) return null;
  return { date, dayIndex: dayOfWeek - 1 };
}

async function updateSwapPreview() {
  if (!swapPreview) return;

  if (!swapDate?.value || !swapWithEmployee?.value) {
    swapPreview.innerHTML = "";
    return;
  }

  if (typeof currentEmployee === "undefined" || !currentEmployee) {
    swapPreview.innerHTML = `<p class="muted">Fant ikke innlogget bruker.</p>`;
    return;
  }

  const parsed = swapDayIndexFromDate(swapDate.value);
  if (!parsed) {
    swapPreview.innerHTML = `<p class="muted">Velg en hverdag (mandag-fredag).</p>`;
    return;
  }

  const myDepartment = findEmployeeDepartmentFromGrid(currentEmployee.name);
  if (!myDepartment) {
    swapPreview.innerHTML = `<p class="muted">Fant ikke din avdeling.</p>`;
    return;
  }

  const weekStartValue = toDateKey(getMonday(parsed.date));
  const targetOption = swapWithEmployee.options[swapWithEmployee.selectedIndex];
  const targetDepartment = targetOption?.dataset.department;

  swapPreview.innerHTML = `<p class="muted">Henter vakter...</p>`;

  const [myShift, theirShift] = await Promise.all([
    fetchShiftValue(weekStartValue, myDepartment, currentEmployee.name, parsed.dayIndex),
    fetchShiftValue(weekStartValue, targetDepartment, swapWithEmployee.value, parsed.dayIndex)
  ]);

  swapPreview.innerHTML = `
    <div class="summary-item">
      <strong>Du har: ${myShift || "—"}</strong>
      <span>${swapWithEmployee.value} har: ${theirShift || "—"}</span>
    </div>
  `;
}

if (swapDate) swapDate.addEventListener("change", updateSwapPreview);
if (swapWithEmployee) swapWithEmployee.addEventListener("change", updateSwapPreview);

if (swapRequestForm) {
  swapRequestForm.addEventListener("submit", async event => {
    event.preventDefault();

    if (!swapRequestStatus) return;

    if (typeof currentEmployee === "undefined" || !currentEmployee) {
      swapRequestStatus.textContent = "Fant ikke innlogget bruker.";
      return;
    }

    const parsed = swapDayIndexFromDate(swapDate.value);
    if (!parsed) {
      swapRequestStatus.textContent = "Velg en hverdag (mandag-fredag).";
      return;
    }

    const targetName = swapWithEmployee.value;
    if (!targetName) {
      swapRequestStatus.textContent = "Velg hvem du vil bytte med.";
      return;
    }

    const targetOption = swapWithEmployee.options[swapWithEmployee.selectedIndex];
    const targetDepartment = targetOption?.dataset.department;
    const weekStartValue = toDateKey(getMonday(parsed.date));

    const myDepartment = findEmployeeDepartmentFromGrid(currentEmployee.name);
    if (!myDepartment) {
      swapRequestStatus.textContent = "Fant ikke din avdeling.";
      return;
    }

    const [myShift, theirShift] = await Promise.all([
      fetchShiftValue(weekStartValue, myDepartment, currentEmployee.name, parsed.dayIndex),
      fetchShiftValue(weekStartValue, targetDepartment, targetName, parsed.dayIndex)
    ]);

    const { error } = await supabaseClient
      .from("kbfb_shift_swap_requests")
      .insert([{
        from_employee: currentEmployee.name,
        to_employee: targetName,
        from_department: myDepartment,
        to_department: targetDepartment,
        week_start: weekStartValue,
        day_index: parsed.dayIndex,
        from_shift_value: myShift,
        to_shift_value: theirShift
      }]);

    if (error) {
      console.error("Kunne ikke sende byttforespørsel:", error);
      swapRequestStatus.textContent = "Kunne ikke sende forespørsel. Prøv igjen.";
      return;
    }

    swapRequestStatus.textContent = "Forespørsel sendt!";
    swapRequestForm.reset();
    if (swapPreview) swapPreview.innerHTML = "";
    if (typeof loadSentSwapRequests === "function") loadSentSwapRequests();
    sendPushNotification([targetName], "Ny byttforespørsel", `${currentEmployee.name} vil bytte vakt med deg`, "vakter.html");
  });
}

async function loadSwapInbox() {
  if (!swapInboxList || typeof currentEmployee === "undefined" || !currentEmployee) return;

  const { data, error } = await supabaseClient
    .from("kbfb_shift_swap_requests")
    .select("*")
    .eq("to_employee", currentEmployee.name)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Kunne ikke hente byttforespørsler:", error);
    return;
  }

  swapInboxCache = data || [];

  const swapAlertBanner = document.getElementById("swapAlertBanner");
  const swapAlertText = document.getElementById("swapAlertText");

  if (swapAlertBanner) {
    swapAlertBanner.style.display = data.length ? "flex" : "none";
    if (swapAlertText) {
      swapAlertText.textContent = data.length === 1
        ? "🔔 Du har 1 ny vaktbytte-forespørsel"
        : `🔔 Du har ${data.length} nye vaktbytte-forespørsler`;
    }
  }

  if (!data.length) {
    swapInboxList.innerHTML = `<p class="muted">Ingen ventende forespørsler.</p>`;
    return;
  }

  swapInboxList.innerHTML = data.map(req => {
    const actualDate = toDateKey(addDays(new Date(req.week_start + "T12:00:00"), req.day_index));

    return `
      <div class="summary-item">
        <strong>${escapeHtml(req.from_employee)} vil bytte vakt med deg ${formatNorwegianDate(actualDate)}</strong>
        <span>${escapeHtml(req.from_employee)} har: ${escapeHtml(req.from_shift_value) || "—"} · Du har: ${escapeHtml(req.to_shift_value) || "—"}</span>
        <div style="display: flex; gap: 8px; margin-top: 6px;">
          <button class="secondary-btn" type="button" data-accept-swap="${req.id}">Godta</button>
          <button class="secondary-btn" type="button" data-decline-swap="${req.id}">Avslå</button>
        </div>
        <div data-decline-box="${req.id}" style="display: none; margin-top: 8px; display: grid; gap: 6px;">
          <input type="text" placeholder="Valgfri grunn..." data-decline-reason-input="${req.id}" />
          <button class="secondary-btn" type="button" data-confirm-decline="${req.id}" style="width: fit-content;">Bekreft avslag</button>
        </div>
      </div>
    `;
  }).join("");

  const swapInboxActionStatus = document.getElementById("swapInboxActionStatus");

  document.querySelectorAll("[data-accept-swap]").forEach(button => {
    button.addEventListener("click", async () => {
      button.disabled = true;
      const requestId = button.dataset.acceptSwap;
      const req = swapInboxCache.find(candidate => String(candidate.id) === requestId);
      const { error } = await supabaseClient.rpc("kbfb_accept_shift_swap", { request_id: requestId });

      if (error) {
        alert("Kunne ikke godta byttet: " + error.message);
        button.disabled = false;
        return;
      }

      if (swapInboxActionStatus) swapInboxActionStatus.textContent = "Bytte godtatt ✓";
      await loadShiftsFromSupabase();
      buildShiftDropdowns();
      updateShiftHeadcounts();
      await loadSwapInbox();

      if (req) {
        const actualDate = toDateKey(addDays(new Date(req.week_start + "T12:00:00"), req.day_index));
        notifyDepartmentLeadersOfSwap(
          [req.from_department, req.to_department],
          `${currentEmployee.name} og ${req.from_employee} har byttet vakt ${formatNorwegianDate(actualDate)}`
        );
      }
    });
  });

  document.querySelectorAll("[data-decline-swap]").forEach(button => {
    button.addEventListener("click", () => {
      const box = document.querySelector(`[data-decline-box="${button.dataset.declineSwap}"]`);
      if (box) box.style.display = "grid";
    });
  });

  document.querySelectorAll("[data-confirm-decline]").forEach(button => {
    button.addEventListener("click", async () => {
      const id = button.dataset.confirmDecline;
      const reasonInput = document.querySelector(`[data-decline-reason-input="${id}"]`);
      const reason = reasonInput?.value.trim() || null;

      button.disabled = true;
      const { error } = await supabaseClient.rpc("kbfb_decline_shift_swap", { request_id: id, reason });

      if (error) {
        alert("Kunne ikke avslå: " + error.message);
        button.disabled = false;
        return;
      }

      if (swapInboxActionStatus) swapInboxActionStatus.textContent = "Avslag sendt ✓";
      await loadSwapInbox();
    });
  });
}

const swapSentList = document.getElementById("swapSentList");
const swapStatusLabel = {
  pending: "⏳ Venter på svar",
  accepted: "✅ Godtatt",
  declined: "❌ Avslått"
};

// Shows the sender their own recent swap requests and what happened to
// them - otherwise a decline is invisible to the person who asked.
async function loadSentSwapRequests() {
  if (!swapSentList || typeof currentEmployee === "undefined" || !currentEmployee) return;

  const { data, error } = await supabaseClient
    .from("kbfb_shift_swap_requests")
    .select("*")
    .eq("from_employee", currentEmployee.name)
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) {
    console.error("Kunne ikke hente sendte forespørsler:", error);
    return;
  }

  if (!data.length) {
    swapSentList.innerHTML = `<p class="muted">Ingen sendte forespørsler ennå.</p>`;
    return;
  }

  swapSentList.innerHTML = data.map(req => {
    const actualDate = toDateKey(addDays(new Date(req.week_start + "T12:00:00"), req.day_index));
    const reasonLine = req.status === "declined" && req.decline_reason
      ? `<span class="muted">Grunn: ${escapeHtml(req.decline_reason)}</span>`
      : "";

    return `
      <div class="summary-item">
        <strong>Bytte med ${escapeHtml(req.to_employee)} ${formatNorwegianDate(actualDate)}</strong>
        <span>${swapStatusLabel[req.status] || req.status}</span>
        ${reasonLine}
        ${req.status !== "pending" ? `<button class="kitchen-delete" data-delete-sent-swap="${req.id}">Slett</button>` : ""}
      </div>
    `;
  }).join("");

  document.querySelectorAll("[data-delete-sent-swap]").forEach(button => {
    button.addEventListener("click", async () => {
      button.disabled = true;
      const { error } = await supabaseClient
        .from("kbfb_shift_swap_requests")
        .delete()
        .eq("id", button.dataset.deleteSentSwap);

      if (error) {
        alert("Kunne ikke slette: " + error.message);
        button.disabled = false;
        return;
      }

      await loadSentSwapRequests();
    });
  });
}

// Runs on every page (not just vakter.html) so the "Vakter" nav link
// shows a badge no matter where someone is when a swap request comes in.
async function loadSwapNavBadge() {
  const badges = document.querySelectorAll(".nav-badge");
  if (!badges.length || typeof currentEmployee === "undefined" || !currentEmployee) return;

  const { count, error } = await supabaseClient
    .from("kbfb_shift_swap_requests")
    .select("id", { count: "exact", head: true })
    .eq("to_employee", currentEmployee.name)
    .eq("status", "pending");

  if (error) {
    console.error("Kunne ikke hente antall byttforespørsler:", error);
    return;
  }

  badges.forEach(badge => {
    badge.textContent = count || "";
    badge.style.display = count ? "inline-flex" : "none";
  });
}

function filterShifts() {
  const employee = employeeFilter?.value || "all";
  const department = departmentFilter?.value || "all";
  const rows = document.querySelectorAll(".shift-table tbody tr");

  rows.forEach(row => {
    const matchesEmployee = employee === "all" || row.dataset.employee === employee;
    const matchesDepartment = department === "all" || row.dataset.department === department;
    row.style.display = matchesEmployee && matchesDepartment ? "" : "none";
  });

  document.querySelectorAll(".department-section").forEach(section => {
    const visibleRows = section.querySelectorAll("tbody tr:not([style*='display: none'])");
    section.style.display = visibleRows.length ? "" : "none";
  });
}

function goToPrevWeek() {
  viewedWeekStart = addWeeks(viewedWeekStart, -1);
  updateWeekView();
  filterShifts();
}

function goToNextWeek() {
  viewedWeekStart = addWeeks(viewedWeekStart, 1);
  updateWeekView();
  filterShifts();
}

function goToCurrentWeek() {
  viewedWeekStart = new Date(realCurrentWeekStart);
  updateWeekView();
  filterShifts();
}

// Duplicated on each department table too (not just once at the very
// bottom), so whichever one you're looking at has a nearby button - no
// need to scroll all the way back up just to flip a week.
[prevWeekBtn, document.getElementById("prevWeekSF"), document.getElementById("prevWeekRB")].forEach(btn => {
  if (btn) btn.addEventListener("click", goToPrevWeek);
});
[nextWeekBtn, document.getElementById("nextWeekSF"), document.getElementById("nextWeekRB")].forEach(btn => {
  if (btn) btn.addEventListener("click", goToNextWeek);
});
[currentWeekBtn, document.getElementById("currentWeekSF"), document.getElementById("currentWeekRB")].forEach(btn => {
  if (btn) btn.addEventListener("click", goToCurrentWeek);
});

if (dateSearch) {
  dateSearch.addEventListener("change", () => {
    if (!dateSearch.value) return;

    viewedWeekStart = getMonday(new Date(dateSearch.value + "T12:00:00"));
    updateWeekView();
    filterShifts();
  });
}

if (employeeFilter && departmentFilter) {
  employeeFilter.addEventListener("change", filterShifts);
  departmentFilter.addEventListener("change", filterShifts);
}

updateWeekView();
filterShifts();

if (monthViewBtn) {
  monthViewBtn.addEventListener("click", async () => {
    document.getElementById("weekViewSection").style.display = "none";
    monthViewSection.style.display = "block";

    await renderMonthView();
  });
}

if (weekViewBtn) {
  weekViewBtn.addEventListener("click", () => {
    monthViewSection.style.display = "none";
    document.getElementById("weekViewSection").style.display = "block";
  });
}

const exportWeekVaktplanBtn = document.getElementById("exportWeekVaktplanBtn");

if (exportWeekVaktplanBtn) {
  exportWeekVaktplanBtn.addEventListener("click", () => {
    const weekKey = getCurrentWeekKey();
    const dayNames = ["Mandag", "Tirsdag", "Onsdag", "Torsdag", "Fredag"];
    const dayHeaders = dayNames.map((name, i) => `${name} ${formatShortDate(addDays(viewedWeekStart, i))}`);

    const rows = [["Avdeling", "Ansatt", ...dayHeaders]];

    document.querySelectorAll(".department-table tbody tr[data-employee]").forEach(row => {
      const department = row.dataset.department;
      const employee = row.dataset.employee;

      const days = [0, 1, 2, 3, 4].map(dayIndex => {
        const match = shiftsCache.find(item =>
          item.week_start === weekKey &&
          item.department === department &&
          item.employee === employee &&
          item.day_index === dayIndex
        );
        return match?.shift_value || "";
      });

      if (employee === "Vikar" && !days.some(Boolean)) return;

      rows.push([department, employee, ...days]);
    });

    downloadWorkbook(rows, `Uke ${getWeekNumber(viewedWeekStart)}`, `vaktplan-uke-${getWeekNumber(viewedWeekStart)}-${weekKey}.xlsx`);
  });
}

/* ---------- ENKEL KJØKKENBOK - SUPABASE ---------- */

const quickNoteForm = document.getElementById("quickNoteForm");
const quickNoteAuthorDisplay = document.getElementById("quickNoteAuthorDisplay");
const quickNoteDate = document.getElementById("quickNoteDate");
const quickNoteText = document.getElementById("quickNoteText");
const quickNoteFeed = document.getElementById("quickNoteFeed");

let kitchenViewedWeekStart = getMonday(new Date());

async function loadNotesFromSupabase() {
  const { data, error } = await supabaseClient
    .from("kbfb_notes")
    .select("*")
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Kunne ikke hente kjøkkenbok:", error);
    return [];
  }

  notesCache = data || [];
  return notesCache;
}


async function saveNoteToSupabase(note) {
  const { error } = await supabaseClient
    .from("kbfb_notes")
    .insert([{
      author: note.author,
      date: note.date,
      text: note.text
    }]);

  if (error) {
    console.error("Kunne ikke lagre beskjed:", error);
  }

  return !error;
}

async function deleteNoteFromSupabase(id) {
  const { error } = await supabaseClient
    .from("kbfb_notes")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Kunne ikke slette beskjed:", error);
  }
}

function canDeleteNote(note) {
  const isAdmin = typeof currentEmployee !== "undefined" && !!currentEmployee?.is_admin;
  const isAuthor = typeof currentEmployee !== "undefined" && currentEmployee?.name === note.author;
  return isAdmin || isAuthor;
}

/* ---------- KJØKKENBOKA - EMOJI-REAKSJONER ---------- */

const REACTION_EMOJIS = ["👍", "❤️", "😂"];
let noteReactionsCache = [];

async function loadNoteReactionsFromSupabase() {
  const { data, error } = await supabaseClient
    .from("kbfb_note_reactions")
    .select("*");

  if (error) {
    console.error("Kunne ikke hente reaksjoner:", error);
    return [];
  }

  noteReactionsCache = data || [];
  return noteReactionsCache;
}

// Summarizes reactions for one note into what the reaction bar needs:
// each emoji's count, and whether the current user has already reacted
// with it (so the button can show as "on").
function reactionsForNote(noteId) {
  const myName = typeof currentEmployee !== "undefined" ? currentEmployee?.name : null;

  return REACTION_EMOJIS.map(emoji => {
    const matches = noteReactionsCache.filter(
      reaction => reaction.note_id === noteId && reaction.emoji === emoji
    );

    return {
      emoji,
      count: matches.length,
      reactedByMe: matches.some(reaction => reaction.author === myName)
    };
  });
}

async function toggleNoteReaction(noteId, emoji) {
  if (typeof currentEmployee === "undefined" || !currentEmployee) return;

  const existing = noteReactionsCache.find(
    reaction => reaction.note_id === noteId && reaction.emoji === emoji && reaction.author === currentEmployee.name
  );

  if (existing) {
    const { error } = await supabaseClient
      .from("kbfb_note_reactions")
      .delete()
      .eq("id", existing.id);

    if (error) console.error("Kunne ikke fjerne reaksjon:", error);
    return;
  }

  const { error } = await supabaseClient
    .from("kbfb_note_reactions")
    .insert([{ note_id: noteId, author: currentEmployee.name, emoji }]);

  if (error) console.error("Kunne ikke lagre reaksjon:", error);
}

function renderReactionBar(noteId) {
  const reactions = reactionsForNote(noteId);

  return `
    <div class="reaction-bar" data-note-id="${noteId}">
      ${reactions.map(reaction => `
        <button
          type="button"
          class="reaction-btn${reaction.reactedByMe ? " reacted" : ""}"
          data-react-note-id="${noteId}"
          data-react-emoji="${reaction.emoji}"
        >
          <span>${reaction.emoji}</span>
          ${reaction.count ? `<span class="reaction-count">${reaction.count}</span>` : ""}
        </button>
      `).join("")}
    </div>
  `;
}

/* ---------- KJØKKENBOKA - DAGSKVITTERING ----------
   Mirrors how the real, physical kitchen book works: you flip through
   a day's notes and sign that you've seen them, once, for the whole
   day - not a per-message tick. */

let dayReadsCache = [];

async function loadDayReadsFromSupabase() {
  const { data, error } = await supabaseClient
    .from("kbfb_day_reads")
    .select("*");

  if (error) {
    console.error("Kunne ikke hente lest-kvitteringer:", error);
    return [];
  }

  dayReadsCache = data || [];
  return dayReadsCache;
}

function readersForDay(dateKey) {
  return dayReadsCache.filter(read => read.date === dateKey);
}

async function toggleDayRead(dateKey) {
  if (typeof currentEmployee === "undefined" || !currentEmployee) return;

  const existing = dayReadsCache.find(
    read => read.date === dateKey && read.reader === currentEmployee.name
  );

  if (existing) {
    const { error } = await supabaseClient
      .from("kbfb_day_reads")
      .delete()
      .eq("id", existing.id);

    if (error) console.error("Kunne ikke fjerne lest-kvittering:", error);
    return;
  }

  const { error } = await supabaseClient
    .from("kbfb_day_reads")
    .insert([{ date: dateKey, reader: currentEmployee.name }]);

  if (error) console.error("Kunne ikke lagre lest-kvittering:", error);
}

function renderDayReadBar(dateKey) {
  const readers = readersForDay(dateKey);
  const myName = typeof currentEmployee !== "undefined" ? currentEmployee?.name : null;
  const iHaveRead = readers.some(read => read.reader === myName);

  return `
    <div class="day-read-bar">
      <button type="button" class="day-read-btn${iHaveRead ? " read" : ""}" data-read-date="${dateKey}">
        ${iHaveRead ? "✓ Lest" : "Merk som lest"}
      </button>
      ${readers.length ? `
        <div class="day-read-avatars" title="${readers.map(r => escapeHtml(r.reader)).join(", ")}">
          ${readers.slice(0, 6).map(r => avatarSpanFor(r.reader, "avatar-tiny")).join("")}
          ${readers.length > 6 ? `<span class="day-read-more">+${readers.length - 6}</span>` : ""}
        </div>
      ` : ""}
    </div>
  `;
}

function renderQuickNoteAuthor() {
  if (quickNoteAuthorDisplay && typeof currentEmployee !== "undefined" && currentEmployee) {
    quickNoteAuthorDisplay.value = currentEmployee.name;
  }
}

const dayNamesLong = ["Mandag", "Tirsdag", "Onsdag", "Torsdag", "Fredag"];

function renderQuickNotes() {
  if (!quickNoteFeed) return;

  const kitchenWeekLabel = document.getElementById("kitchenWeekLabel");
  if (kitchenWeekLabel) {
    const weekNumber = getWeekNumber(kitchenViewedWeekStart);
    const friday = addDays(kitchenViewedWeekStart, 4);
    kitchenWeekLabel.textContent =
      `Uke ${weekNumber} · ${formatShortDate(kitchenViewedWeekStart)}–${formatShortDate(friday)}`;
  }

  renderResponsibilityBanner(toDateKey(kitchenViewedWeekStart));

  quickNoteFeed.innerHTML = dayNamesLong.map((dayName, dayIndex) => {
    const date = addDays(kitchenViewedWeekStart, dayIndex);
    const dateKey = toDateKey(date);
    const dayNotes = sortNotesByMentionedTime(notesCache.filter(note => note.date === dateKey));

    return `
      <div class="kitchen-day">
        <h3>${dayName}<span class="kitchen-day-date">${formatShortDate(date)}</span></h3>

        ${dayNotes.length ? dayNotes.map(note => `
          <article class="kitchen-entry">
            <div class="kitchen-entry-top">
              <strong>${avatarSpanFor(note.author, "avatar-tiny")}${escapeHtml(note.author)}</strong>
              ${canDeleteNote(note) ? `<button class="kitchen-delete" data-quick-note-id="${note.id}">Slett</button>` : ""}
            </div>
            <p>${escapeHtml(note.text)}</p>
            ${renderReactionBar(note.id)}
          </article>
        `).join("") : `<p class="muted">Ingen beskjeder.</p>`}

        ${dayNotes.length ? renderDayReadBar(dateKey) : ""}
      </div>
    `;
  }).join("");

  document.querySelectorAll("[data-quick-note-id]").forEach(button => {
    button.addEventListener("click", async () => {
      await deleteNoteFromSupabase(button.dataset.quickNoteId);
      await loadNotesFromSupabase();
      renderQuickNotes();
      renderDashboardKitchenNotes();
    });
  });

  document.querySelectorAll("[data-react-note-id]").forEach(button => {
    button.addEventListener("click", async () => {
      button.disabled = true;
      await toggleNoteReaction(button.dataset.reactNoteId, button.dataset.reactEmoji);
      await loadNoteReactionsFromSupabase();
      renderQuickNotes();
    });
  });

  document.querySelectorAll("[data-read-date]").forEach(button => {
    button.addEventListener("click", async () => {
      button.disabled = true;
      await toggleDayRead(button.dataset.readDate);
      await loadDayReadsFromSupabase();
      renderQuickNotes();
      if (typeof renderDashboardKitchenNotes === "function") renderDashboardKitchenNotes();
    });
  });
}

const kitchenPrevWeek = document.getElementById("kitchenPrevWeek");
const kitchenNextWeek = document.getElementById("kitchenNextWeek");
const kitchenCurrentWeek = document.getElementById("kitchenCurrentWeek");

function goToKitchenPrevWeek() {
  kitchenViewedWeekStart = addWeeks(kitchenViewedWeekStart, -1);
  renderQuickNotes();
}

function goToKitchenNextWeek() {
  kitchenViewedWeekStart = addWeeks(kitchenViewedWeekStart, 1);
  renderQuickNotes();
}

function goToKitchenCurrentWeek() {
  kitchenViewedWeekStart = getMonday(new Date());
  renderQuickNotes();
}

// Duplicated at the bottom of the week grid too, same reasoning as vakter.html.
[kitchenPrevWeek, document.getElementById("kitchenPrevWeekBottom")].forEach(btn => {
  if (btn) btn.addEventListener("click", goToKitchenPrevWeek);
});
[kitchenNextWeek, document.getElementById("kitchenNextWeekBottom")].forEach(btn => {
  if (btn) btn.addEventListener("click", goToKitchenNextWeek);
});
[kitchenCurrentWeek, document.getElementById("kitchenCurrentWeekBottom")].forEach(btn => {
  if (btn) btn.addEventListener("click", goToKitchenCurrentWeek);
});

const kitchenDateSearch = document.getElementById("kitchenDateSearch");

if (kitchenDateSearch) {
  kitchenDateSearch.addEventListener("change", () => {
    if (!kitchenDateSearch.value) return;
    kitchenViewedWeekStart = getMonday(new Date(kitchenDateSearch.value + "T12:00:00"));
    renderQuickNotes();
  });
}

if (quickNoteDate) {
  quickNoteDate.value = toDateKey(new Date());
}

document.querySelectorAll(".quick-template").forEach(button => {
  button.addEventListener("click", () => {
    if (!quickNoteText) return;
    quickNoteText.value = button.dataset.text;
    quickNoteText.focus();
  });
});

if (quickNoteForm) {
  quickNoteForm.addEventListener("submit", async event => {
    event.preventDefault();

    if (typeof currentEmployee === "undefined" || !currentEmployee) {
      alert("Fant ikke innlogget bruker. Prøv å laste siden på nytt.");
      return;
    }

    const note = {
      author: currentEmployee.name,
      date: quickNoteDate.value,
      text: quickNoteText.value.trim()
    };

    const saved = await saveNoteToSupabase(note);
    if (!saved) {
      alert("Kunne ikke lagre beskjeden. Prøv igjen.");
      return;
    }

    await loadNotesFromSupabase();

    quickNoteText.value = "";

    // Jump the week view to wherever the note landed, so it's visible
    // right away even if it's for a different week than the one showing.
    kitchenViewedWeekStart = getMonday(new Date(note.date + "T12:00:00"));

    renderQuickNotes();
    renderDashboardKitchenNotes();
  });
}

async function initializeNotes() {
  await Promise.all([
    loadNotesFromSupabase(),
    loadNoteReactionsFromSupabase(),
    loadDayReadsFromSupabase()
  ]);
  renderQuickNotes();
  renderDashboardKitchenNotes();
}

initializeNotes();

/* ---------- DATOER-SIDEN ---------- */

/* ---------- DATOER-SIDEN ---------- */

const dateForm = document.getElementById("dateForm");
const dateId = document.getElementById("dateId");
const eventDate = document.getElementById("eventDate");
const eventTitle = document.getElementById("eventTitle");
const eventCategory = document.getElementById("eventCategory");
const eventNote = document.getElementById("eventNote");
const dateList = document.getElementById("dateList");
const dateCategoryFilter = document.getElementById("dateCategoryFilter");

function defaultEventTitle(category) {
  const titles = {
    general: "Viktig dato",
    personal: "Personalmøte",
    plandager: "Planleggingsdag",
    overnatting: "Overnatting / tur",
    foreldre: "Foreldremøte",
    styre: "Styremøte",
    su: "SU-møte",
    bursdag: "Bursdag"
  };

  return titles[category] || "Viktig dato";
}

function monthHeading(dateString) {
  return new Date(dateString + "T12:00:00").toLocaleDateString("no-NO", {
    month: "long",
    year: "numeric"
  });
}


function renderEvents() {
  if (!dateList) return;

  const category = dateCategoryFilter?.value || "all";

  let events = getEvents()
    .filter(event => category === "all" || event.category === category)
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  if (!events.length) {
    dateList.innerHTML = `<p class="muted">Ingen datoer lagt inn ennå.</p>`;
    return;
  }

  const grouped = {};

  events.forEach(event => {
    const month = monthHeading(event.date);
    if (!grouped[month]) grouped[month] = [];
    grouped[month].push(event);
  });

  dateList.innerHTML = Object.entries(grouped).map(([month, monthEvents]) => `
    <section class="month-group">
      <h3>${month}</h3>

      <div class="month-events">
        ${monthEvents.map(event => {
          const isPast = new Date(event.date + "T23:59:59") < new Date();
          return `
          <article class="date-item date-${event.category} ${isPast ? "date-past" : ""}">
            <div class="date-item-top">
              <div>
                <strong>${shortDate(event.date)} · ${escapeHtml(event.title)}</strong>
                <span>${categoryEmoji(event.category)} ${categoryLabel(event.category)}${event.note ? ` · ${escapeHtml(event.note)}` : ""}</span>
              </div>

              ${typeof currentEmployee !== "undefined" && currentEmployee?.is_admin ? `
              <div class="date-actions">
                <button class="date-edit" type="button" data-edit-date="${event.id}">Endre</button>
                <button class="date-delete" type="button" data-delete-date="${event.id}">Slett</button>
              </div>
              ` : ""}
            </div>
          </article>
        `;
        }).join("")}
      </div>
    </section>
  `).join("");

  document.querySelectorAll("[data-edit-date]").forEach(button => {
    button.addEventListener("click", () => {
      const event = getEvents().find(item => item.id === button.dataset.editDate);
      if (!event) return;

      dateId.value = event.id;
      eventDate.value = event.date;
      eventTitle.value = event.title;
      eventCategory.value = event.category;
      eventNote.value = event.note || "";

      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  });

  document.querySelectorAll("[data-delete-date]").forEach(button => {
    button.addEventListener("click", async () => {
      await deleteEventFromSupabase(button.dataset.deleteDate);
      await loadEventsFromSupabase();

      renderEvents();
      renderDashboardEvents();
      renderWeekEvents();
    });
  });
}

if (eventCategory && eventTitle) {
  eventCategory.addEventListener("change", () => {
    if (!eventTitle.value.trim() || eventTitle.value === defaultEventTitle(eventCategory.dataset.previousCategory)) {
      eventTitle.value = defaultEventTitle(eventCategory.value);
    }

    eventCategory.dataset.previousCategory = eventCategory.value;
  });
}

if (dateForm) {
  if (eventDate && !eventDate.value) {
    eventDate.value = toDateKey(new Date());
  }

  if (eventCategory && eventTitle && !eventTitle.value) {
    eventTitle.value = defaultEventTitle(eventCategory.value);
    eventCategory.dataset.previousCategory = eventCategory.value;
  }

 dateForm.addEventListener("submit", async event => {
    event.preventDefault();

    const events = getEvents();
    const existingId = dateId.value;

    const eventData = {
      id: existingId || null,
      date: eventDate.value,
      title: eventTitle.value.trim(),
      category: eventCategory.value,
      note: eventNote.value.trim()
    };

    await saveEventToSupabase(eventData);

await loadEventsFromSupabase();

    dateForm.reset();
    dateId.value = "";
    eventDate.value = toDateKey(new Date());
    eventTitle.value = defaultEventTitle(eventCategory.value);
    eventCategory.dataset.previousCategory = eventCategory.value;

    renderEvents();
    renderDashboardEvents();
    renderWeekEvents();
  });
}

if (dateCategoryFilter) {
  dateCategoryFilter.addEventListener("change", renderEvents);
}

async function initializeEvents() {
  // Also load employees here (if some other init on the page hasn't
  // already) so birthdays are available for the dashboard banner and
  // the merged upcoming-dates feed, on every page that runs this.
  await Promise.all([
    loadEventsFromSupabase(),
    employeesCache.length ? Promise.resolve() : loadEmployeesFromSupabase()
  ]);

  renderEvents();
  renderDashboardEvents();
  renderWeekEvents();
}

initializeEvents();
/* ---------- VIKARER - SUPABASE ---------- */

const subForm = document.getElementById("subForm");
const subName = document.getElementById("subName");
const subDate = document.getElementById("subDate");
const subStart = document.getElementById("subStart");
const subEnd = document.getElementById("subEnd");
const subDepartment = document.getElementById("subDepartment");
const subNote = document.getElementById("subNote");
const subTableBody = document.getElementById("subTableBody");
const subSummary = document.getElementById("subSummary");
const clearSubs = document.getElementById("clearSubs");
const subEndDate = document.getElementById("subEndDate");

const subPersonForm = document.getElementById("subPersonForm");
const subPersonName = document.getElementById("subPersonName");
const subPersonColor = document.getElementById("subPersonColor");
const subPersonList = document.getElementById("subPersonList");
const subMonthFilter = document.getElementById("subMonthFilter");

async function loadSubPeopleFromSupabase() {
  const { data, error } = await supabaseClient
    .from("kbfb_subs")
    .select("*")
    .eq("active", true)
    .order("name", { ascending: true });

  if (error) {
    console.error("Kunne ikke hente vikarer:", error);
    return [];
  }

  subPeopleCache = data || [];
  return subPeopleCache;
}

async function saveSubPersonToSupabase(name, color) {
  const { error } = await supabaseClient
    .from("kbfb_subs")
    .insert([{ name, color }]);

  if (error) {
    console.error("Kunne ikke legge til vikar:", error);
  }

  return !error;
}

function renderSubPeople() {
  if (subName) {
    subName.innerHTML = `<option value="">Velg vikar</option>`;

    subPeopleCache.forEach(person => {
      const option = document.createElement("option");
      option.value = person.name;
      option.textContent = person.name;
      subName.appendChild(option);
    });
  }

  if (subPersonList) {
    subPersonList.innerHTML = subPeopleCache.length
      ? subPeopleCache.map(person => `
          <div class="compact-item">
            <strong>
  <span class="vikar-badge" style="background:${person.color || '#f3f4f6'}">
    ${escapeHtml(person.name)}
  </span>
</strong>
<span>Aktiv vikar</span>
          </div>
        `).join("")
      : `<p class="muted">Ingen vikarer lagt inn ennå.</p>`;
  }
}

if (subPersonForm) {
  subPersonForm.addEventListener("submit", async event => {
    event.preventDefault();

    const name = subPersonName.value.trim();

    if (!name) return;

    const alreadyExists = subPeopleCache.some(person =>
      person.name.toLowerCase() === name.toLowerCase()
    );

    if (alreadyExists) {
      alert("Denne vikaren finnes allerede.");
      return;
    }

    const saved = await saveSubPersonToSupabase(name, subPersonColor.value);
    if (!saved) {
      alert("Kunne ikke legge til vikar. Prøv igjen.");
      return;
    }

    await loadSubPeopleFromSupabase();

    subPersonName.value = "";
    renderSubPeople();
  });
}

function calculateHours(start, end) {
  if (!start || !end) return 0;

  const [startHour, startMinute] = start.split(":").map(Number);
  const [endHour, endMinute] = end.split(":").map(Number);

  const startTotal = startHour * 60 + startMinute;
  const endTotal = endHour * 60 + endMinute;

  return Math.max(0, Math.round(((endTotal - startTotal) / 60) * 100) / 100);
}

async function loadSubsFromSupabase() {
  const { data, error } = await supabaseClient
    .from("kbfb_sub_hours")
    .select("*")
    .order("date", { ascending: false });

  if (error) {
    console.error("Kunne ikke hente vikarvakter:", error);
    return [];
  }

  subsCache = data || [];
  return subsCache;
}

async function saveSubToSupabase(sub) {
  const { error } = await supabaseClient
    .from("kbfb_sub_hours")
    .insert([{
      name: sub.name,
      date: sub.date,
      department: sub.department,
      start_time: sub.start_time,
      end_time: sub.end_time,
      hours: sub.hours,
      note: sub.note
    }]);

  if (error) {
    console.error("Kunne ikke lagre vikarvakt:", error);
  }

  return !error;
}

async function deleteSubFromSupabase(id) {
  const { error } = await supabaseClient
    .from("kbfb_sub_hours")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Kunne ikke slette vikarvakt:", error);
  }
}

async function updateSubToSupabase(id, fields) {
  const { error } = await supabaseClient
    .from("kbfb_sub_hours")
    .update(fields)
    .eq("id", id);

  if (error) {
    console.error("Kunne ikke oppdatere vikarvakt:", error);
    return false;
  }

  return true;
}

const subDepartmentOptions = ["Sommerfuglen", "Regnbuen", "Begge", "Annet"];
let editingSubId = null;

function renderSubs() {
  if (!subTableBody || !subSummary) return;

  subTableBody.innerHTML = "";

  if (!subsCache.length) {
    subSummary.innerHTML = `<p class="muted">Ingen vakter registrert ennå.</p>`;
    return;
  }

  const isAdmin = typeof currentEmployee !== "undefined" && !!currentEmployee?.is_admin;

  subsCache.forEach(sub => {
    const row = document.createElement("tr");

    if (isAdmin && sub.id === editingSubId) {
      row.innerHTML = `
        <td><input type="date" class="sub-edit-date" value="${sub.date || ""}" /></td>
        <td>
          <select class="sub-edit-name">
            ${subPeopleCache.map(p => `<option value="${escapeHtml(p.name)}" ${p.name === sub.name ? "selected" : ""}>${escapeHtml(p.name)}</option>`).join("")}
          </select>
        </td>
        <td>
          <select class="sub-edit-department">
            ${subDepartmentOptions.map(d => `<option value="${d}" ${d === sub.department ? "selected" : ""}>${d}</option>`).join("")}
          </select>
        </td>
        <td>
          <input type="time" class="sub-edit-start" value="${sub.start_time || ""}" style="width: 90px;" />
          –
          <input type="time" class="sub-edit-end" value="${sub.end_time || ""}" style="width: 90px;" />
        </td>
        <td>${sub.hours || 0}</td>
        <td><input type="text" class="sub-edit-note" value="${escapeHtml(sub.note)}" /></td>
        <td>
          <div style="display: flex; gap: 6px;">
            <button class="secondary-btn" data-sub-save-id="${sub.id}">Lagre</button>
            <button class="secondary-btn" data-sub-cancel-id="${sub.id}">Avbryt</button>
          </div>
        </td>
      `;
    } else {
      row.innerHTML = `
        <td>${formatNorwegianDate(sub.date)}</td>
        <td>${renderVikarBadge(sub.name)}</td>
        <td>${escapeHtml(sub.department)}</td>
        <td>${sub.start_time || ""}–${sub.end_time || ""}</td>
        <td>${sub.hours || 0}</td>
        <td>${escapeHtml(sub.note)}</td>
        <td>${isAdmin ? `
          <div style="display: flex; gap: 6px;">
            <button class="secondary-btn" data-sub-edit-id="${sub.id}">Endre</button>
            <button class="kitchen-delete" data-sub-id="${sub.id}">Slett</button>
          </div>
        ` : ""}</td>
      `;
    }

    subTableBody.appendChild(row);
  });

  renderSubSummary();

  document.querySelectorAll("[data-sub-id]").forEach(button => {
    button.addEventListener("click", async () => {
      await deleteSubFromSupabase(button.dataset.subId);
      await loadSubsFromSupabase();
      renderSubs();
    });
  });

  document.querySelectorAll("[data-sub-edit-id]").forEach(button => {
    button.addEventListener("click", () => {
      editingSubId = button.dataset.subEditId;
      renderSubs();
    });
  });

  document.querySelectorAll("[data-sub-cancel-id]").forEach(button => {
    button.addEventListener("click", () => {
      editingSubId = null;
      renderSubs();
    });
  });

  document.querySelectorAll("[data-sub-save-id]").forEach(button => {
    button.addEventListener("click", async () => {
      const row = button.closest("tr");
      const hours = calculateHours(
        row.querySelector(".sub-edit-start").value,
        row.querySelector(".sub-edit-end").value
      );

      const saved = await updateSubToSupabase(button.dataset.subSaveId, {
        date: row.querySelector(".sub-edit-date").value,
        name: row.querySelector(".sub-edit-name").value,
        department: row.querySelector(".sub-edit-department").value,
        start_time: row.querySelector(".sub-edit-start").value,
        end_time: row.querySelector(".sub-edit-end").value,
        hours,
        note: row.querySelector(".sub-edit-note").value.trim()
      });

      if (!saved) {
        alert("Kunne ikke lagre endringen. Prøv igjen.");
        return;
      }

      editingSubId = null;
      await loadSubsFromSupabase();
      renderSubs();
    });
  });
}

function getSubPersonColor(name) {
  const person = subPeopleCache.find(p => p.name === name);
  return person?.color || "#f3f4f6";
}

function renderVikarBadge(name) {
  return `<span class="vikar-badge" style="background:${getSubPersonColor(name)}">${escapeHtml(name)}</span>`;
}

function renderSubSummary() {
  if (!subSummary) return;

  if (!subsCache.length) {
    subSummary.innerHTML = `<p class="muted">Ingen vakter registrert ennå.</p>`;
    return;
  }

  populateSubMonthFilter();

  const selectedMonth = subMonthFilter?.value || getCurrentMonthKey();

  const monthSubs = subsCache.filter(sub =>
    sub.date && sub.date.slice(0, 7) === selectedMonth
  );

  if (!monthSubs.length) {
    subSummary.innerHTML = `<p class="muted">Ingen vikarvakter i ${formatMonth(selectedMonth)}.</p>`;
    return;
  }

  const grouped = {};

  monthSubs.forEach(sub => {
    if (!grouped[sub.name]) {
      grouped[sub.name] = {
        name: sub.name,
        days: new Set(),
        hours: 0
      };
    }

    grouped[sub.name].days.add(sub.date);
    grouped[sub.name].hours += Number(sub.hours || 0);
  });

  const totalHours = Object.values(grouped)
    .reduce((sum, item) => sum + item.hours, 0);

  subSummary.innerHTML = `
    <div class="compact-item">
      <strong>${formatMonth(selectedMonth)}</strong>
      <span>Totalt ${Math.round(totalHours * 100) / 100} timer</span>
    </div>

    ${Object.values(grouped).map(item => `
      <div class="compact-item">
        <strong>${renderVikarBadge(item.name)}</strong>
        <span>${item.days.size} dager · ${Math.round(item.hours * 100) / 100} timer</span>
      </div>
    `).join("")}
  `;
}

function formatMonth(monthKey) {
  const [year, month] = monthKey.split("-");
  return new Date(Number(year), Number(month) - 1, 1).toLocaleDateString("no-NO", {
    month: "long",
    year: "numeric"
  });
}
function getCurrentMonthKey() {
  return toMonthKey(new Date());
}

function populateSubMonthFilter() {
  if (!subMonthFilter) return;

  const currentValue = subMonthFilter.value || getCurrentMonthKey();

  const months = [...new Set(
    subsCache
      .filter(sub => sub.date)
      .map(sub => sub.date.slice(0, 7))
  )].sort((a, b) => b.localeCompare(a));

  if (!months.includes(getCurrentMonthKey())) {
    months.unshift(getCurrentMonthKey());
  }

  subMonthFilter.innerHTML = months.map(month => `
    <option value="${month}">${formatMonth(month)}</option>
  `).join("");

  subMonthFilter.value = months.includes(currentValue)
    ? currentValue
    : getCurrentMonthKey();
}

function getWeekdaysBetween(startDate, endDate) {
  const dates = [];
  const current = new Date(startDate + "T12:00:00");
  const end = new Date(endDate + "T12:00:00");

  while (current <= end) {
    const day = current.getDay();

    if (day !== 0 && day !== 6) {
      dates.push(toDateKey(current));
    }

    current.setDate(current.getDate() + 1);
  }

  return dates;
}

if (subDate) {
  subDate.value = toDateKey(new Date());
}

if (subForm) {
  subForm.addEventListener("submit", async event => {
    event.preventDefault();

    const hours = calculateHours(subStart.value, subEnd.value);

    const startDate = subDate.value;
    const endDate = subEndDate.value || subDate.value;
    const dates = getWeekdaysBetween(startDate, endDate);
    let anyFailed = false;
    let anyDuplicate = false;

    for (const date of dates) {
      const sub = {
        name: subName.value,
        date,
        department: subDepartment.value,
        start_time: subStart.value,
        end_time: subEnd.value,
        hours,
        note: subNote.value.trim()
      };

      // One vakt per vikar per dag - even if the time/avdeling differs from
      // an existing entry, it's still a double-booking on the same day.
      const duplicate = subsCache.some(existing =>
        existing.name === sub.name &&
        existing.date === sub.date
      );

      if (duplicate) {
        anyDuplicate = true;
        continue;
      }

      const saved = await saveSubToSupabase(sub);
      if (!saved) anyFailed = true;
    }

    if (anyDuplicate) {
      alert(`${subName.value} har allerede en vakt registrert på minst én av disse dagene - den ble ikke lagt til på nytt. Slett den gamle først hvis du vil endre den.`);
    }

    if (anyFailed) {
      alert("Noen vikarvakter kunne ikke lagres. Prøv igjen.");
    }

    await loadSubsFromSupabase();

    subForm.reset();
    subDate.value = toDateKey(new Date());
    subEndDate.value = "";
    subStart.value = "08:30";
    subEnd.value = "16:00";

    renderSubs();
  });
}

if (clearSubs) {
  clearSubs.addEventListener("click", () => {
    alert("Tøm testdata er deaktivert.");
  });
}

function applySubFormVisibility() {
  const section = document.getElementById("subFormSection");
  if (!section || typeof currentEmployee === "undefined" || !currentEmployee) return;

  const isAdmin = !!currentEmployee.is_admin;
  const isVikar = currentEmployee.role === "Vikar";

  section.style.display = (isAdmin || isVikar) ? "" : "none";

  if (subName) {
    if (isVikar && !isAdmin) {
      subName.value = currentEmployee.name;
      subName.disabled = true;
    } else {
      subName.disabled = false;
    }
  }
}

async function initializeSubs() {
  await loadSubPeopleFromSupabase();
  await loadSubsFromSupabase();

  renderSubPeople();
  renderSubs();
  applySubFormVisibility();
}
if (subMonthFilter) {
  subMonthFilter.addEventListener("change", renderSubSummary);
}

initializeSubs();
/* ---------- FERIE / FRAVÆR - SUPABASE ---------- */

const absenceForm = document.getElementById("absenceForm");
const absenceName = document.getElementById("absenceName");
const absenceType = document.getElementById("absenceType");
const absenceStartDate = document.getElementById("absenceStartDate");
const absenceEndDate = document.getElementById("absenceEndDate");
const absenceHours = document.getElementById("absenceHours");
const absenceStatus = document.getElementById("absenceStatus");
const absenceStatusField = document.getElementById("absenceStatusField");
const absenceNote = document.getElementById("absenceNote");
const absenceFilter = document.getElementById("absenceFilter");
if (absenceFilter) {
  absenceFilter.addEventListener("change", renderAbsences);
}
const absenceYearFilter = document.getElementById("absenceYearFilter");
if (absenceYearFilter) {
  absenceYearFilter.addEventListener("change", renderAbsences);
}
const absenceSummary = document.getElementById("absenceSummary");
const absenceTableBody = document.getElementById("absenceTableBody");
const clearAbsences = document.getElementById("clearAbsences");
const overtimeSummary = document.getElementById("overtimeSummary");
const overtimeSummaryMonth = document.getElementById("overtimeSummaryMonth");

let absencesCache = [];
let employeeSettingsCache = [];

async function loadEmployeeSettingsFromSupabase() {
  const { data, error } = await supabaseClient
    .from("kbfb_employee_settings")
    .select("*");

  if (error) {
    console.error("Kunne ikke hente feriedager-innstillinger:", error);
    return [];
  }

  employeeSettingsCache = data || [];
  return employeeSettingsCache;
}

function getVacationDaysFor(name) {
  const setting = employeeSettingsCache.find(s => s.employee === name);
  return setting && setting.vacation_days != null ? setting.vacation_days : 25;
}

async function saveVacationDaysToSupabase(name, days) {
  const { data, error } = await supabaseClient
    .from("kbfb_employee_settings")
    .update({ vacation_days: days })
    .eq("employee", name)
    .select();

  if (error) {
    console.error("Kunne ikke oppdatere feriedager:", error);
    return;
  }

  if (!data || !data.length) {
    const { error: insertError } = await supabaseClient
      .from("kbfb_employee_settings")
      .insert([{ employee: name, vacation_days: days }]);

    if (insertError) {
      console.error("Kunne ikke opprette feriedager-rad:", insertError);
    }
  }
}

function getTjenestefriDaysFor(name) {
  const setting = employeeSettingsCache.find(s => s.employee === name);
  return setting && setting.tjenestefri_days != null ? setting.tjenestefri_days : 10;
}

async function saveTjenestefriDaysToSupabase(name, days) {
  const { data, error } = await supabaseClient
    .from("kbfb_employee_settings")
    .update({ tjenestefri_days: days })
    .eq("employee", name)
    .select();

  if (error) {
    console.error("Kunne ikke oppdatere tjenestefri-dager:", error);
    return;
  }

  if (!data || !data.length) {
    const { error: insertError } = await supabaseClient
      .from("kbfb_employee_settings")
      .insert([{ employee: name, tjenestefri_days: days }]);

    if (insertError) {
      console.error("Kunne ikke opprette tjenestefri-rad:", insertError);
    }
  }
}

function renderVacationQuotaEditor() {
  const container = document.getElementById("vacationQuotaList");
  if (!container) return;

  container.innerHTML = employeesCache.map(employee => `
    <div class="summary-item">
      <strong>${escapeHtml(employee.name)}</strong>
      <span>
        Feriedager:
        <input type="number" min="0" step="1" class="vacation-days-input" data-employee="${escapeHtml(employee.name)}" value="${getVacationDaysFor(employee.name)}" style="width:60px;" />
        &nbsp;&nbsp;Tjenestefri-dager:
        <input type="number" min="0" step="1" class="tjenestefri-days-input" data-employee="${escapeHtml(employee.name)}" value="${getTjenestefriDaysFor(employee.name)}" style="width:60px;" />
      </span>
    </div>
  `).join("");

  container.querySelectorAll(".vacation-days-input").forEach(input => {
    input.addEventListener("change", async () => {
      const days = Number(input.value) || 0;
      await saveVacationDaysToSupabase(input.dataset.employee, days);
      await loadEmployeeSettingsFromSupabase();
      renderAbsences();
    });
  });

  container.querySelectorAll(".tjenestefri-days-input").forEach(input => {
    input.addEventListener("change", async () => {
      const days = Number(input.value) || 0;
      await saveTjenestefriDaysToSupabase(input.dataset.employee, days);
      await loadEmployeeSettingsFromSupabase();
      renderAbsences();
    });
  });
}

async function loadAbsencesFromSupabase() {
  const { data, error } = await supabaseClient
    .from("kbfb_absences")
    .select("*")
    .order("start_date", { ascending: false });

  if (error) {
    console.error("Kunne ikke hente fravær:", error);
    return [];
  }

  absencesCache = data || [];
  return absencesCache;
}

async function saveAbsenceToSupabase(record) {
  const { error } = await supabaseClient
    .from("kbfb_absences")
    .insert([record]);

  if (error) {
    console.error("Kunne ikke lagre fravær:", error);
  }

  return !error;
}

async function deleteAbsenceFromSupabase(id) {
  const { error } = await supabaseClient
    .from("kbfb_absences")
    .delete()
    .eq("id", id);

  if (error) console.error("Kunne ikke slette fravær:", error);
}

async function updateAbsenceStatusInSupabase(id, status) {
  const { error } = await supabaseClient
    .from("kbfb_absences")
    .update({ status })
    .eq("id", id);

  if (error) {
    console.error("Kunne ikke oppdatere status:", error);
  }
}

const shiftTypesFromAbsence = {
  "Ferie": "F",
  "Tjenestefri": "TJ",
  "Permisjon": "PERM"
};

async function upsertShiftForApproval(week_start, department, employee, day_index, shift_value) {
  const { data: existing, error: selectError } = await supabaseClient
    .from("kbfb_shifts")
    .select("id")
    .eq("week_start", week_start)
    .eq("department", department)
    .eq("employee", employee)
    .eq("day_index", day_index)
    .maybeSingle();

  if (selectError) {
    console.error("Kunne ikke sjekke eksisterende vakt:", selectError);
    return;
  }

  if (existing) {
    const { error } = await supabaseClient
      .from("kbfb_shifts")
      .update({ shift_value })
      .eq("id", existing.id);

    if (error) console.error("Kunne ikke oppdatere vakt:", error);
  } else {
    const { error } = await supabaseClient
      .from("kbfb_shifts")
      .insert([{ week_start, department, employee, day_index, shift_value }]);

    if (error) console.error("Kunne ikke opprette vakt:", error);
  }
}

async function applyApprovedAbsenceToShifts(record) {
  const shiftValue = shiftTypesFromAbsence[record.type];
  if (!shiftValue) return;

  const employee = employeesCache.find(e => e.name === record.name);
  if (!employee || !employee.department) {
    console.error("Fant ikke avdeling for", record.name, "- kan ikke oppdatere vaktplanen automatisk.");
    return;
  }

  const weekdays = getWeekdaysBetween(record.start_date, record.end_date);

  for (const dateStr of weekdays) {
    const date = new Date(dateStr + "T12:00:00");
    const weekStart = toDateKey(getMonday(date));
    const dayIndex = date.getDay() - 1;

    await upsertShiftForApproval(weekStart, employee.department, record.name, dayIndex, shiftValue);
  }
}

function countWeekdays(startDate, endDate) {
  const dates = getWeekdaysBetween(startDate, endDate);
  return dates.length;
}

function populateAbsenceYearFilter() {
  if (!absenceYearFilter) return;

  const currentYear = new Date().getFullYear();
  const years = new Set([currentYear]);

  absencesCache.forEach(record => {
    if (record.start_date) years.add(Number(record.start_date.slice(0, 4)));
  });

  const previousValue = absenceYearFilter.value;
  const sortedYears = Array.from(years).sort((a, b) => b - a);

  absenceYearFilter.innerHTML = sortedYears
    .map(year => `<option value="${year}">${year}</option>`)
    .join("");

  absenceYearFilter.value = sortedYears.includes(Number(previousValue))
    ? previousValue
    : String(currentYear);
}

function getFilteredAbsences() {
  const selected = absenceFilter?.value || "all";
  const selectedYear = absenceYearFilter?.value ? Number(absenceYearFilter.value) : new Date().getFullYear();

  return absencesCache.filter(record => {
    const matchesEmployee = selected === "all" || record.name === selected;
    const matchesYear = !record.start_date || Number(record.start_date.slice(0, 4)) === selectedYear;
    return matchesEmployee && matchesYear;
  });
}

function renderOvertimeSummary() {
  if (!overtimeSummary) return;

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  if (overtimeSummaryMonth) {
    overtimeSummaryMonth.textContent = now.toLocaleDateString("no-NO", { month: "long", year: "numeric" });
  }

  const overtimeRecords = absencesCache.filter(record => {
    if (record.type !== "Overtid") return false;
    const recordDate = new Date(record.start_date + "T12:00:00");
    return recordDate.getMonth() === currentMonth && recordDate.getFullYear() === currentYear;
  });

  if (!overtimeRecords.length) {
    overtimeSummary.innerHTML = `<p class="muted">Ingen overtid registrert denne måneden.</p>`;
    return;
  }

  const grouped = {};

  overtimeRecords.forEach(record => {
    if (!grouped[record.name]) grouped[record.name] = { hours: 0, entries: [] };
    grouped[record.name].hours += Number(record.hours) || 0;
    grouped[record.name].entries.push(record);
  });

  overtimeSummary.innerHTML = Object.entries(grouped).map(([name, info]) => `
    <div class="summary-item">
      <strong>${escapeHtml(name)} · ${info.hours} t</strong>
      <span>${info.entries
        .map(entry => `${formatDateRange(entry.start_date, entry.end_date)}${entry.note ? ` · ${escapeHtml(entry.note)}` : ""}`)
        .join(" · ")}</span>
    </div>
  `).join("");
}

function renderAbsences() {
  renderOvertimeSummary();

  if (!absenceTableBody || !absenceSummary) return;

  const records = getFilteredAbsences();

  if (!records.length) {
    absenceTableBody.innerHTML = "";
    absenceSummary.innerHTML = `<p class="muted">Ingen føringer ennå.</p>`;
    return;
  }

  const isAdmin = typeof currentEmployee !== "undefined" && !!currentEmployee?.is_admin;

  absenceTableBody.innerHTML = records.map(record => `
    <tr>
      <td>${escapeHtml(record.name)}</td>
      <td>${escapeHtml(record.type)}</td>
      <td>${formatDateRange(record.start_date, record.end_date)}</td>
      <td>${countWeekdays(record.start_date, record.end_date)}</td>
      <td>${record.hours || ""}</td>
      <td>${escapeHtml(record.status) || "Registrert"}</td>
      <td>${escapeHtml(record.note)}</td>
      <td>
        ${isAdmin && record.status === "Ønsket" && record.name !== currentEmployee?.name ? `
          <button class="secondary-btn" data-approve-id="${record.id}">Godkjenn</button>
          <button class="secondary-btn" data-reject-id="${record.id}">Avslå</button>
        ` : ""}
        ${isAdmin && record.status === "Ønsket" && record.name === currentEmployee?.name ? `
          <span class="muted">Venter på noen andre</span>
        ` : ""}
        ${isAdmin ? `<button class="kitchen-delete" data-absence-id="${record.id}">Slett</button>` : ""}
      </td>
    </tr>
  `).join("");

  renderAbsenceSummary(records);

  document.querySelectorAll("[data-absence-id]").forEach(button => {
    button.addEventListener("click", async () => {
      await deleteAbsenceFromSupabase(button.dataset.absenceId);
      await loadAbsencesFromSupabase();
      renderAbsences();
    });
  });

  document.querySelectorAll("[data-approve-id]").forEach(button => {
    button.addEventListener("click", async () => {
      const id = button.dataset.approveId;
      const record = absencesCache.find(item => String(item.id) === String(id));

      await updateAbsenceStatusInSupabase(id, "Godkjent");

      if (record && shiftTypesFromAbsence[record.type]) {
        await applyApprovedAbsenceToShifts(record);
      }

      await loadAbsencesFromSupabase();
      renderAbsences();

      if (record) {
        sendPushNotification(
          [record.name],
          "Søknad godkjent",
          `${record.type} ${formatDateRange(record.start_date, record.end_date)} er godkjent`,
          "ferieogavspasering.html"
        );
      }
    });
  });

  document.querySelectorAll("[data-reject-id]").forEach(button => {
    button.addEventListener("click", async () => {
      const id = button.dataset.rejectId;
      const record = absencesCache.find(item => String(item.id) === String(id));

      await updateAbsenceStatusInSupabase(id, "Avslått");
      await loadAbsencesFromSupabase();
      renderAbsences();

      if (record) {
        sendPushNotification(
          [record.name],
          "Søknad avslått",
          `${record.type} ${formatDateRange(record.start_date, record.end_date)} ble avslått`,
          "ferieogavspasering.html"
        );
      }
    });
  });
}

function renderAbsenceSummary(records) {
  const grouped = {};

  records.forEach(record => {
    if (!grouped[record.name]) {
      grouped[record.name] = {
        ferie: 0,
        tjenestefri: 0,
        avsOpptjent: 0,
        avsBrukt: 0,
        overtid: 0,
        permisjonMed: 0,
        permisjonUten: 0,
        velferd: 0,
        egenmelding: 0,
        sykemelding: 0,
        omsorgsdager: 0
      };
    }

    const days = countWeekdays(record.start_date, record.end_date);
    const hours = Number(record.hours || 0);

    switch (record.type) {

      case "Ferie":
        grouped[record.name].ferie += days;
        break;

      case "Tjenestefri":
        grouped[record.name].tjenestefri += days;
        break;

      case "Avspasering opptjent":
        grouped[record.name].avsOpptjent += hours;
        break;

      case "Avspasering brukt":
        grouped[record.name].avsBrukt += hours || (days * 7.5);
        break;

      case "Overtid":
        grouped[record.name].overtid += hours;
        break;

      case "Permisjon med lønn":
        grouped[record.name].permisjonMed += days;
        break;

      case "Permisjon uten lønn":
        grouped[record.name].permisjonUten += days;
        break;

      case "Velferdspermisjon":
        grouped[record.name].velferd += days;
        break;

      case "Egenmelding":
        grouped[record.name].egenmelding += days;
        break;

      case "Sykemelding":
        grouped[record.name].sykemelding += days;
        break;

      case "Omsorgsdager":
        grouped[record.name].omsorgsdager += days;
        break;
    }
  });

  absenceSummary.innerHTML = Object.entries(grouped)
    .sort(([a],[b]) => a.localeCompare(b))
    .map(([name, t]) => {

      const saldo = t.avsOpptjent - t.avsBrukt;

      return `
      <div class="summary-card">

        <h3>${name}</h3>

        <div>🌴 Ferie: <strong>${t.ferie}/${getVacationDaysFor(name)}</strong> dager</div>

        <div>🏡 Tjenestefri: <strong>${t.tjenestefri}/${getTjenestefriDaysFor(name)}</strong> dager</div>

        <div>💰 Overtid: <strong>${t.overtid.toFixed(1)}</strong> t</div>

        <div>📄 Permisjon m/lønn: <strong>${t.permisjonMed}</strong> dager</div>

        <div>📄 Permisjon u/lønn: <strong>${t.permisjonUten}</strong> dager</div>

        <div>❤️ Velferd: <strong>${t.velferd}</strong> dager</div>

        <div>🤒 Egenmelding: <strong>${t.egenmelding}</strong> dager</div>

        <div>🏥 Sykemelding: <strong>${t.sykemelding}</strong> dager</div>

        <div>👶 Omsorgsdager: <strong>${t.omsorgsdager}</strong> dager</div>

        <hr>

        <div>➕ Opptjent avsp.: ${t.avsOpptjent.toFixed(1)} t</div>

        <div>➖ Brukt avsp.: ${t.avsBrukt.toFixed(1)} t</div>

        <div style="font-size:1.1rem;font-weight:bold;margin-top:6px;">
            Saldo: ${saldo.toFixed(1)} t
        </div>

      </div>
      `;
    })
    .join("");
}

const noApprovalNeededTypes = [
  "Overtid", "Avspasering brukt", "Avspasering opptjent",
  "Egenmelding", "Sykemelding", "Omsorgsdager"
];

const avspaseringTypes = ["Avspasering opptjent", "Avspasering brukt"];

function updateAbsenceStatusVisibility() {
  if (!absenceType || !absenceStatusField || !absenceStatus) return;

  if (noApprovalNeededTypes.includes(absenceType.value)) {
    absenceStatusField.style.display = "none";
    absenceStatus.value = "Registrert";
  } else {
    absenceStatusField.style.display = "";
    if (absenceType.value === "Ferie" || absenceType.value === "Tjenestefri") {
      absenceStatus.value = "Ønsket";
    }
  }

  // Avspasering is an hours ledger, not a day-range - skip the dates and
  // require a note explaining what it's for instead (e.g. "kveldsmøte").
  const isAvspasering = avspaseringTypes.includes(absenceType.value);
  const startField = document.getElementById("absenceStartDateField");
  const endField = document.getElementById("absenceEndDateField");

  if (startField) startField.style.display = isAvspasering ? "none" : "";
  if (endField) endField.style.display = isAvspasering ? "none" : "";
  if (absenceStartDate) absenceStartDate.required = !isAvspasering;
  // Til dato is always optional - a single day (e.g. one egenmeldingsdag) is
  // the common case, so it defaults to matching fra dato if left blank.
  if (absenceNote) absenceNote.required = isAvspasering;

  // Can't self-approve/self-reject - not even admin logging their own
  // Ferie/Tjenestefri/etc. Those options just aren't offered when the name
  // on the form is your own.
  const godkjentOption = document.getElementById("absenceStatusGodkjentOption");
  const avslattOption = document.getElementById("absenceStatusAvslattOption");
  const isOwnEntry = typeof currentEmployee !== "undefined" && currentEmployee &&
    absenceName?.value === currentEmployee.name;

  if (godkjentOption) godkjentOption.disabled = isOwnEntry;
  if (avslattOption) avslattOption.disabled = isOwnEntry;

  if (isOwnEntry && (absenceStatus.value === "Godkjent" || absenceStatus.value === "Avslått")) {
    absenceStatus.value = "Ønsket";
  }
}

if (absenceType) {
  absenceType.addEventListener("change", updateAbsenceStatusVisibility);
  updateAbsenceStatusVisibility();
}

if (absenceName) {
  absenceName.addEventListener("change", updateAbsenceStatusVisibility);
}

// Accepts either decimal hours ("1,25"/"1.25") or time:minutt ("1:15")
// and always returns decimal hours - "1:15" is unambiguous (1t 15min =
// 1.25), which plain decimal typing isn't (people naturally write
// "1,15" for 1t 15min, which is actually 1.15 = 1t 9min).
function parseHoursInput(raw) {
  const value = (raw || "").trim();
  if (!value) return null;

  const timeMatch = value.match(/^(\d+):([0-5]?\d)$/);
  if (timeMatch) {
    return Number(timeMatch[1]) + Number(timeMatch[2]) / 60;
  }

  const num = Number(value.replace(",", "."));
  return Number.isNaN(num) ? null : num;
}

if (absenceForm) {
  absenceForm.addEventListener("submit", async event => {
    event.preventDefault();

    const todayKey = toDateKey(new Date());
    const isAvspaseringEntry = avspaseringTypes.includes(absenceType.value);

    const record = {
      name: absenceName.value,
      type: absenceType.value,
      start_date: isAvspaseringEntry ? todayKey : absenceStartDate.value,
      end_date: isAvspaseringEntry ? todayKey : (absenceEndDate.value || absenceStartDate.value),
      hours: parseHoursInput(absenceHours.value),
      status: absenceStatus.value,
      note: absenceNote.value.trim()
    };

    const saved = await saveAbsenceToSupabase(record);
    if (!saved) {
      alert("Kunne ikke lagre fravær. Prøv igjen.");
      return;
    }

    if (record.type === "Overtid" && record.hours) {
      await saveAbsenceToSupabase({
        name: record.name,
        type: "Avspasering opptjent",
        start_date: record.start_date,
        end_date: record.end_date,
        hours: record.hours,
        status: record.status,
        note: record.note ? `Fra overtid: ${record.note}` : "Automatisk opptjent fra overtid"
      });
    }

    await loadAbsencesFromSupabase();

    absenceForm.reset();
    lockAbsenceNameToSelf();
    updateAbsenceStatusVisibility();

    renderAbsences();
  });
}

function lockAbsenceNameToSelf() {
  if (!absenceName || typeof currentEmployee === "undefined" || !currentEmployee) return;

  if (!currentEmployee.is_admin) {
    absenceName.value = currentEmployee.name;
    absenceName.disabled = true;
  } else {
    absenceName.disabled = false;
  }
}

function lockAbsenceFilterToSelf() {
  if (!absenceFilter || typeof currentEmployee === "undefined" || !currentEmployee) return;

  if (currentEmployee.is_admin) {
    absenceFilter.disabled = false;
  } else if (currentEmployee.role === "Avdelingsleder") {
    // Sees their own department's overview, not locked to just themselves -
    // matches what the database actually allows them to read.
    populateEmployeeSelect("absenceFilter", {
      includeBlank: false,
      includeAll: true,
      departmentFilter: currentEmployee.department
    });
    absenceFilter.disabled = false;
  } else {
    absenceFilter.innerHTML = `<option value="${escapeHtml(currentEmployee.name)}">${escapeHtml(currentEmployee.name)}</option>`;
    absenceFilter.value = currentEmployee.name;
    absenceFilter.disabled = true;
  }

  renderAbsences();
}

async function initializeAbsences() {
  await loadEmployeesFromSupabase();
  await loadEmployeeSettingsFromSupabase();

  populateEmployeeSelect("absenceName");
  populateEmployeeSelect("absenceFilter", {
    includeBlank: false,
    includeAll: true
  });
  lockAbsenceNameToSelf();
  lockAbsenceFilterToSelf();
  renderVacationQuotaEditor();

  await loadAbsencesFromSupabase();
  populateAbsenceYearFilter();

  renderAbsences();
}

initializeAbsences();

/* ---------- ADMIN - ANSATTSTYRING ---------- */

const newEmployeeForm = document.getElementById("newEmployeeForm");
const newEmployeeName = document.getElementById("newEmployeeName");
const newEmployeeRole = document.getElementById("newEmployeeRole");
const newEmployeeDepartment = document.getElementById("newEmployeeDepartment");
const adminEmployeeTableBody = document.getElementById("adminEmployeeTableBody");

const newEmployeeLoginForm = document.getElementById("newEmployeeLoginForm");
const loginEmployeeName = document.getElementById("loginEmployeeName");
const loginEmployeeRole = document.getElementById("loginEmployeeRole");
const loginEmployeeDepartment = document.getElementById("loginEmployeeDepartment");
const loginEmployeeEmail = document.getElementById("loginEmployeeEmail");
const loginEmployeePassword = document.getElementById("loginEmployeePassword");
const loginEmployeeStatus = document.getElementById("loginEmployeeStatus");

if (newEmployeeLoginForm) {
  newEmployeeLoginForm.addEventListener("submit", async event => {
    event.preventDefault();

    if (loginEmployeeStatus) {
      loginEmployeeStatus.textContent = "Oppretter...";
    }

    const { data, error } = await supabaseClient.functions.invoke("create-employee-login", {
      body: {
        name: loginEmployeeName.value.trim(),
        role: loginEmployeeRole.value.trim(),
        department: loginEmployeeDepartment.value.trim(),
        email: loginEmployeeEmail.value.trim(),
        password: loginEmployeePassword.value
      }
    });

    if (error || data?.error) {
      const message = data?.error || error?.message || "Ukjent feil.";
      console.error("Kunne ikke opprette ansatt med innlogging:", message);
      if (loginEmployeeStatus) {
        loginEmployeeStatus.textContent = `Feilet: ${message} (Er Edge Function-en satt opp? Bruk fallback-skjemaet under i mellomtiden.)`;
      }
      return;
    }

    if (loginEmployeeStatus) {
      loginEmployeeStatus.textContent = `${loginEmployeeName.value.trim()} er lagt til med innlogging.`;
    }

    newEmployeeLoginForm.reset();
    await loadAllEmployeesForAdmin();
    renderAdminEmployeeTable();
  });
}

let adminEmployeesCache = [];

async function loadAllEmployeesForAdmin() {
  const { data, error } = await supabaseClient
    .from("kbfb_employees")
    .select("*")
    .order("name");

  if (error) {
    console.error("Kunne ikke hente ansatte (admin):", error);
    return [];
  }

  adminEmployeesCache = data || [];
  return adminEmployeesCache;
}

async function updateEmployeeField(id, fields) {
  const { error } = await supabaseClient
    .from("kbfb_employees")
    .update(fields)
    .eq("id", id);

  if (error) {
    console.error("Kunne ikke oppdatere ansatt:", error);
    alert("Kunne ikke lagre endringen. Sjekk at du er logget inn som admin.");
  }
}

function renderAdminEmployeeTable() {
  if (!adminEmployeeTableBody) return;

  adminEmployeeTableBody.innerHTML = adminEmployeesCache.map(employee => `
    <tr>
      <td><strong>${escapeHtml(employee.name)}</strong></td>
      <td>
        <input type="text" class="admin-field" data-id="${employee.id}" data-field="role" value="${escapeHtml(employee.role)}" style="width: 140px;" />
      </td>
      <td>
        <input type="text" class="admin-field" data-id="${employee.id}" data-field="department" value="${escapeHtml(employee.department)}" style="width: 130px;" />
      </td>
      <td>
        <select class="admin-field" data-id="${employee.id}" data-field="color" style="width: 110px; background: ${employee.color || "white"};">
          <option value="">Ingen</option>
          ${employeeColorPalette.map(c => `
            <option value="${c.value}" ${employee.color === c.value ? "selected" : ""}>${c.label}</option>
          `).join("")}
        </select>
      </td>
      <td>
        <input type="date" class="admin-field" data-id="${employee.id}" data-field="birthday" value="${employee.birthday || ""}" style="width: 150px;" />
      </td>
      <td>
        <input type="date" class="admin-field" data-id="${employee.id}" data-field="start_date" value="${employee.start_date || ""}" style="width: 150px;" />
      </td>
      <td style="text-align: center;">
        <input type="checkbox" class="admin-field" data-id="${employee.id}" data-field="is_admin" ${employee.is_admin ? "checked" : ""} />
      </td>
      <td style="text-align: center;">
        <input type="checkbox" class="admin-field" data-id="${employee.id}" data-field="active" ${employee.active ? "checked" : ""} />
      </td>
      <td>
        <input type="text" class="admin-field" data-id="${employee.id}" data-field="user_id" value="${escapeHtml(employee.user_id)}" placeholder="Ikke koblet ennå" style="width: 260px; font-family: monospace; font-size: 0.85rem;" />
      </td>
      <td>
        ${employee.user_id ? `
          <div style="display: flex; gap: 6px;">
            <input type="text" class="reset-password-input" data-id="${employee.id}" placeholder="Nytt passord" style="width: 130px;" />
            <button type="button" class="secondary-btn reset-password-btn" data-id="${employee.id}">Nullstill</button>
          </div>
        ` : `<span class="muted">Ikke koblet</span>`}
      </td>
      <td>
        <button type="button" class="kitchen-delete delete-employee-btn" data-id="${employee.id}">Slett</button>
      </td>
    </tr>
  `).join("");

  document.querySelectorAll(".reset-password-btn").forEach(button => {
    button.addEventListener("click", async () => {
      const id = button.dataset.id;
      const input = document.querySelector(`.reset-password-input[data-id="${id}"]`);
      const employee = adminEmployeesCache.find(e => String(e.id) === String(id));
      const newPassword = input?.value.trim();

      if (!newPassword) {
        alert("Skriv inn et nytt passord først.");
        return;
      }

      button.disabled = true;
      button.textContent = "...";

      const { data, error } = await supabaseClient.functions.invoke("create-employee-login", {
        body: { action: "reset_password", user_id: employee.user_id, password: newPassword }
      });

      button.disabled = false;
      button.textContent = "Nullstill";

      if (error || data?.error) {
        alert("Kunne ikke nullstille passord: " + (data?.error || error?.message || "Ukjent feil."));
        return;
      }

      input.value = "";
      alert(`Passord nullstilt for ${employee.name}.`);
    });
  });

  document.querySelectorAll(".admin-field").forEach(field => {
    const eventName = field.type === "checkbox" ? "change" : "change";

    field.addEventListener(eventName, async () => {
      const id = field.dataset.id;
      const key = field.dataset.field;
      const value = field.type === "checkbox" ? field.checked : field.value.trim();

      await updateEmployeeField(id, { [key]: value === "" ? null : value });
      await loadAllEmployeesForAdmin();
    });
  });

  document.querySelectorAll(".delete-employee-btn").forEach(button => {
    button.addEventListener("click", async () => {
      const id = button.dataset.id;
      const employee = adminEmployeesCache.find(e => String(e.id) === String(id));
      if (!employee) return;

      const confirmed = confirm(
        `Slette ${employee.name}? ${employee.user_id ? "Innloggingen deres slettes også." : ""} Dette kan ikke angres.`
      );
      if (!confirmed) return;

      button.disabled = true;
      button.textContent = "...";

      const { data, error } = await supabaseClient.functions.invoke("create-employee-login", {
        body: { action: "delete", employee_id: employee.id, user_id: employee.user_id || null }
      });

      if (error || data?.error) {
        alert("Kunne ikke slette: " + (data?.error || error?.message || "Ukjent feil."));
        button.disabled = false;
        button.textContent = "Slett";
        return;
      }

      await loadAllEmployeesForAdmin();
    });
  });
}

if (newEmployeeForm) {
  newEmployeeForm.addEventListener("submit", async event => {
    event.preventDefault();

    const name = newEmployeeName.value.trim();
    if (!name) return;

    const alreadyExists = adminEmployeesCache.some(employee =>
      employee.name.toLowerCase() === name.toLowerCase()
    );

    if (alreadyExists) {
      alert("Det finnes allerede en ansatt med dette navnet.");
      return;
    }

    const { error } = await supabaseClient
      .from("kbfb_employees")
      .insert([{
        name,
        role: newEmployeeRole.value.trim() || null,
        department: newEmployeeDepartment.value.trim() || null,
        is_admin: false,
        active: true
      }]);

    if (error) {
      console.error("Kunne ikke legge til ansatt:", error);
      alert("Kunne ikke legge til ansatt. Sjekk at du er logget inn som admin.");
      return;
    }

    newEmployeeForm.reset();
    await loadAllEmployeesForAdmin();
    renderAdminEmployeeTable();
  });
}

async function loadPendingApprovalsSummary() {
  const container = document.getElementById("pendingApprovalsSummary");
  if (!container) return;

  const { data, error } = await supabaseClient
    .from("kbfb_absences")
    .select("*")
    .eq("status", "Ønsket")
    .order("start_date");

  if (error) {
    console.error("Kunne ikke hente ubehandlede søknader:", error);
    container.innerHTML = `<p class="muted">Kunne ikke hente søknader.</p>`;
    return;
  }

  if (!data.length) {
    container.innerHTML = `<p class="muted">Ingen ubehandlede søknader akkurat nå.</p>`;
    return;
  }

  container.innerHTML = data.map(record => `
    <div class="summary-item">
      <strong>${escapeHtml(record.name)} · ${escapeHtml(record.type)}</strong>
      <span>${formatDateRange(record.start_date, record.end_date)}${record.note ? ` · ${escapeHtml(record.note)}` : ""}</span>
    </div>
  `).join("");
}

// The nav link to admin.html is already hidden from non-admins, but
// nothing stops someone typing the URL directly - this is the actual
// gate. Runs on every page (cheap early-return everywhere but admin.html).
function enforceAdminPageAccess() {
  const protectedPages = ["admin.html", "nokkeltall.html", "avvik.html"];
  if (!protectedPages.some(page => window.location.pathname.endsWith(page))) return;
  if (typeof currentEmployee === "undefined" || !currentEmployee) return;

  if (!currentEmployee.is_admin) {
    window.location.href = "dashboard.html";
  }
}

// Guest kitchen-iPad login: sensitive pages are hidden from the nav, but
// that alone doesn't stop someone typing the URL directly - this is the
// actual gate, same pattern as enforceAdminPageAccess.
function enforceGuestPageRestrictions() {
  const restrictedPages = ["ferieogavspasering.html"];
  if (!restrictedPages.some(page => window.location.pathname.endsWith(page))) return;
  if (typeof currentEmployee === "undefined" || !currentEmployee) return;

  if (currentEmployee.role === "Gjest") {
    window.location.href = "dashboard.html";
  }
}

async function initializeAdmin() {
  if (!adminEmployeeTableBody) return;

  await loadAllEmployeesForAdmin();
  renderAdminEmployeeTable();
  loadPendingApprovalsSummary();
  loadFeedbackForAdmin();
}

initializeAdmin();

/* ---------- ADMIN - NØKKELTALL ---------- */

const sickAbsenceTypes = ["Egenmelding", "Sykemelding", "Omsorgsdager"];
const countedAbsenceStatuses = ["Ønsket", "Godkjent"];

function daysBetweenInclusive(startDate, endDate) {
  if (!startDate || !endDate) return 1;
  const start = new Date(startDate + "T12:00:00");
  const end = new Date(endDate + "T12:00:00");
  return Math.max(1, Math.round((end - start) / 86400000) + 1);
}

// Reads a clock-time range like "08:00-16:00" or "08.00–16.00" out of a
// free-text shift value and returns the hours between them. Anything
// without a recognizable range (a plain name, "Maxi", etc.) returns 0 -
// it still counts as a shift, just not toward the hour total.
function parseShiftHours(shiftValue) {
  if (!shiftValue) return 0;
  const match = shiftValue.match(/(\d{1,2})[:.](\d{2})\s*[-–]\s*(\d{1,2})[:.](\d{2})/);
  if (!match) return 0;

  const [, h1, m1, h2, m2] = match.slice(1).map(Number);
  const start = h1 + m1 / 60;
  let end = h2 + m2 / 60;
  if (end < start) end += 24;

  return Math.max(0, end - start);
}

// The "Vikar" row's shift_value is free text like "Kari 08:00-16:00" -
// split off the leading name part (if any) from the time/note after it.
function parseVikarName(shiftValue) {
  const match = (shiftValue || "").trim().match(/^([A-Za-zÆØÅæøå ]+?)(?=\s+\d|$)/);
  const name = match ? match[1].trim() : "";
  return name || "Ikke navngitt";
}

function currentPeriodRange(period) {
  const today = new Date();
  const todayKey = toDateKey(today);

  if (period === "month") {
    const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    return { start: toDateKey(firstOfMonth), end: todayKey };
  }

  const firstOfYear = new Date(today.getFullYear(), 0, 1);
  return { start: toDateKey(firstOfYear), end: todayKey };
}

function computeAbsenceStats(absences, periodStart, periodEnd) {
  const stats = {};

  absences.forEach(absence => {
    if (!countedAbsenceStatuses.includes(absence.status)) return;
    if (!absence.start_date || absence.start_date > periodEnd || absence.start_date < periodStart) return;

    if (!stats[absence.name]) {
      stats[absence.name] = { sickDays: 0, vacationDays: 0, avspaseringHours: 0, permisjonDays: 0 };
    }

    const entry = stats[absence.name];
    const days = daysBetweenInclusive(absence.start_date, absence.end_date);

    if (sickAbsenceTypes.includes(absence.type)) {
      entry.sickDays += days;
    } else if (absence.type === "Ferie") {
      entry.vacationDays += days;
    } else if (absence.type === "Avspasering brukt") {
      entry.avspaseringHours += absence.hours || 0;
    } else if ((absence.type || "").startsWith("Permisjon")) {
      entry.permisjonDays += days;
    }
  });

  return stats;
}

function renderAbsenceStatsTable(period) {
  const body = document.getElementById("absenceStatsTableBody");
  if (!body) return;

  const { start, end } = currentPeriodRange(period);
  const stats = computeAbsenceStats(absencesCache, start, end);
  const names = Object.keys(stats).sort((a, b) => a.localeCompare(b));

  body.innerHTML = names.length
    ? names.map(name => {
        const s = stats[name];
        return `
          <tr>
            <td><strong>${escapeHtml(name)}</strong></td>
            <td>${s.sickDays || "–"}</td>
            <td>${s.vacationDays || "–"}</td>
            <td>${s.avspaseringHours || "–"}</td>
            <td>${s.permisjonDays || "–"}</td>
          </tr>
        `;
      }).join("")
    : `<tr><td colspan="5" class="muted">Ingen registrert fravær i perioden.</td></tr>`;

  // Total sick days in the year-to-date view feeds the stat card up top.
  const statSickDaysYtd = document.getElementById("statSickDaysYtd");
  if (statSickDaysYtd && period === "year") {
    const total = names.reduce((sum, name) => sum + stats[name].sickDays, 0);
    statSickDaysYtd.textContent = total;
  }
}

let nokkeltallShiftsCache = [];

// Loads every kbfb_shifts row with a week_start in the given range -
// separate from vakter.html's shiftsCache, which only ever holds the one
// week currently being viewed there.
async function loadShiftsForNokkeltall(weekStartFrom, weekStartTo) {
  const { data, error } = await supabaseClient
    .from("kbfb_shifts")
    .select("*")
    .gte("week_start", weekStartFrom)
    .lte("week_start", weekStartTo);

  if (error) {
    console.error("Kunne ikke hente vakter for nøkkeltall:", error);
    return [];
  }

  nokkeltallShiftsCache = data || [];
  return nokkeltallShiftsCache;
}

function computeVikarUsageByMonth(shifts) {
  const byMonth = {};

  shifts.forEach(shift => {
    if (shift.employee !== "Vikar") return;
    const value = (shift.shift_value || "").trim();
    if (!value) return;

    const date = addDays(new Date(shift.week_start + "T12:00:00"), shift.day_index);
    const monthKey = toMonthKey(date);
    const hours = parseShiftHours(value);

    if (!byMonth[monthKey]) byMonth[monthKey] = { shiftCount: 0, totalHours: 0, byPerson: {} };

    byMonth[monthKey].shiftCount += 1;
    byMonth[monthKey].totalHours += hours;

    const name = parseVikarName(value);
    byMonth[monthKey].byPerson[name] = (byMonth[monthKey].byPerson[name] || 0) + hours;
  });

  return byMonth;
}

function monthLabel(monthKey) {
  const [year, month] = monthKey.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString("no-NO", { month: "long", year: "numeric" });
}

let vikarUsageByMonthCache = {};

function renderVikarTables() {
  const trendBody = document.getElementById("vikarTrendTableBody");
  const personBody = document.getElementById("vikarPersonTableBody");
  if (!trendBody || !personBody) return;

  const months = Object.keys(vikarUsageByMonthCache).sort();

  trendBody.innerHTML = months.length
    ? months.map(monthKey => {
        const m = vikarUsageByMonthCache[monthKey];
        return `
          <tr>
            <td><strong>${monthLabel(monthKey)}</strong></td>
            <td>${m.shiftCount}</td>
            <td>${m.totalHours ? m.totalHours.toFixed(1) + " t" : "–"}</td>
          </tr>
        `;
      }).join("")
    : `<tr><td colspan="3" class="muted">Ingen vikarvakter registrert i perioden.</td></tr>`;

  const currentMonthKey = toMonthKey(new Date());
  const currentMonth = vikarUsageByMonthCache[currentMonthKey];

  const statVikarHoursMonth = document.getElementById("statVikarHoursMonth");
  if (statVikarHoursMonth) {
    statVikarHoursMonth.textContent = currentMonth ? currentMonth.totalHours.toFixed(1) : "0";
  }

  if (!currentMonth || !Object.keys(currentMonth.byPerson).length) {
    personBody.innerHTML = `<tr><td colspan="3" class="muted">Ingen vikarvakter denne måneden.</td></tr>`;
    return;
  }

  personBody.innerHTML = Object.entries(currentMonth.byPerson)
    .sort(([, a], [, b]) => b - a)
    .map(([name, hours]) => {
      const shiftCount = nokkeltallShiftsCache.filter(shift =>
        shift.employee === "Vikar" &&
        parseVikarName(shift.shift_value) === name &&
        toMonthKey(addDays(new Date(shift.week_start + "T12:00:00"), shift.day_index)) === currentMonthKey
      ).length;

      return `
        <tr>
          <td><strong>${escapeHtml(name)}</strong></td>
          <td>${shiftCount}</td>
          <td>${hours ? hours.toFixed(1) + " t" : "–"}</td>
        </tr>
      `;
    }).join("");
}

async function loadStatCards() {
  const { count: openSwaps } = await supabaseClient
    .from("kbfb_shift_swap_requests")
    .select("*", { count: "exact", head: true })
    .eq("status", "pending");

  const statOpenSwaps = document.getElementById("statOpenSwaps");
  if (statOpenSwaps) statOpenSwaps.textContent = openSwaps ?? "0";

  const statPendingAbsences = document.getElementById("statPendingAbsences");
  if (statPendingAbsences) {
    statPendingAbsences.textContent = absencesCache.filter(a => a.status === "Ønsket").length;
  }
}

async function initializeNokkeltall() {
  const container = document.getElementById("nokkeltallStats");
  if (!container) return;

  await loadAbsencesFromSupabase();
  renderAbsenceStatsTable("month");
  renderAbsenceStatsTable("year");
  await loadStatCards();

  // Last 6 months of shifts, so the vikarbruk trend has something to show.
  const sixMonthsAgo = getMonday(addDays(new Date(), -180));
  await loadShiftsForNokkeltall(toDateKey(sixMonthsAgo), toDateKey(getMonday(new Date())));
  vikarUsageByMonthCache = computeVikarUsageByMonth(nokkeltallShiftsCache);
  renderVikarTables();

  const periodToggle = document.getElementById("absenceStatsPeriodToggle");
  if (periodToggle) {
    periodToggle.querySelectorAll("button").forEach(button => {
      button.addEventListener("click", () => {
        periodToggle.querySelectorAll("button").forEach(b => b.className = "secondary-btn");
        button.className = "primary-btn";
        renderAbsenceStatsTable(button.dataset.period);
      });
    });
  }

  setupNokkeltallExports();
}

/* ---------- EKSPORT (Excel via SheetJS, PDF via utskrift) ---------- */

function downloadWorkbook(sheetData, sheetName, fileName) {
  if (typeof XLSX === "undefined") {
    alert("Eksport-biblioteket lastet ikke inn. Sjekk internettforbindelsen og prøv igjen.");
    return;
  }

  const worksheet = XLSX.utils.aoa_to_sheet(sheetData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  XLSX.writeFile(workbook, fileName);
}

function setupNokkeltallExports() {
  const exportAbsenceExcel = document.getElementById("exportAbsenceExcel");
  const exportVikarExcel = document.getElementById("exportVikarExcel");
  const exportWeekExcel = document.getElementById("exportWeekExcel");
  const exportPrintPdf = document.getElementById("exportPrintPdf");

  if (exportAbsenceExcel) {
    exportAbsenceExcel.addEventListener("click", () => {
      const { start, end } = currentPeriodRange("year");
      const stats = computeAbsenceStats(absencesCache, start, end);
      const rows = [["Ansatt", "Sykefravær (dager)", "Ferie (dager)", "Avspasering brukt (timer)", "Permisjon (dager)"]];

      Object.entries(stats).forEach(([name, s]) => {
        rows.push([name, s.sickDays, s.vacationDays, s.avspaseringHours, s.permisjonDays]);
      });

      downloadWorkbook(rows, "Fraværsstatistikk", `fravaersstatistikk-${toDateKey(new Date())}.xlsx`);
    });
  }

  if (exportVikarExcel) {
    exportVikarExcel.addEventListener("click", () => {
      const rows = [["Måned", "Antall vikarvakter", "Estimerte timer"]];

      Object.keys(vikarUsageByMonthCache).sort().forEach(monthKey => {
        const m = vikarUsageByMonthCache[monthKey];
        rows.push([monthLabel(monthKey), m.shiftCount, Number(m.totalHours.toFixed(1))]);
      });

      downloadWorkbook(rows, "Vikarbruk", `vikarbruk-${toDateKey(new Date())}.xlsx`);
    });
  }

  if (exportWeekExcel) {
    exportWeekExcel.addEventListener("click", async () => {
      const weekStart = toDateKey(getMonday(new Date()));
      const { data, error } = await supabaseClient
        .from("kbfb_shifts")
        .select("*")
        .eq("week_start", weekStart);

      if (error) {
        alert("Kunne ikke hente denne ukas vaktplan.");
        return;
      }

      const dayNames = ["Mandag", "Tirsdag", "Onsdag", "Torsdag", "Fredag"];
      const rows = [["Avdeling", "Ansatt", ...dayNames]];
      const byPerson = {};

      (data || []).forEach(shift => {
        const key = `${shift.department}__${shift.employee}`;
        if (!byPerson[key]) {
          byPerson[key] = { department: shift.department, employee: shift.employee, days: ["", "", "", "", ""] };
        }
        byPerson[key].days[shift.day_index] = shift.shift_value || "";
      });

      Object.values(byPerson)
        .sort((a, b) => a.department.localeCompare(b.department) || a.employee.localeCompare(b.employee))
        .forEach(row => rows.push([row.department, row.employee, ...row.days]));

      downloadWorkbook(rows, "Vaktplan", `vaktplan-uke-${getWeekNumber(getMonday(new Date()))}.xlsx`);
    });
  }

  if (exportPrintPdf) {
    exportPrintPdf.addEventListener("click", () => window.print());
  }
}

initializeNokkeltall();

/* ---------- FORBEDRINGSBEHOV (FEEDBACK) ---------- */

const feedbackForm = document.getElementById("feedbackForm");
const feedbackText = document.getElementById("feedbackText");
const feedbackStatus = document.getElementById("feedbackStatus");

if (feedbackForm) {
  feedbackForm.addEventListener("submit", async event => {
    event.preventDefault();

    if (typeof currentEmployee === "undefined" || !currentEmployee) {
      if (feedbackStatus) feedbackStatus.textContent = "Fant ikke innlogget bruker. Prøv å laste siden på nytt.";
      return;
    }

    const { error } = await supabaseClient
      .from("kbfb_feedback")
      .insert([{ name: currentEmployee.name, text: feedbackText.value.trim() }]);

    if (error) {
      console.error("Kunne ikke sende inn forbedringsbehov:", error);
      if (feedbackStatus) feedbackStatus.textContent = "Kunne ikke sende inn. Prøv igjen.";
      return;
    }

    feedbackForm.reset();
    if (feedbackStatus) feedbackStatus.textContent = "Takk! Sendt inn.";
  });
}

async function loadFeedbackForAdmin() {
  const container = document.getElementById("feedbackAdminList");
  if (!container) return;

  const { data, error } = await supabaseClient
    .from("kbfb_feedback")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Kunne ikke hente forbedringsbehov:", error);
    container.innerHTML = `<p class="muted">Kunne ikke hente innspill.</p>`;
    return;
  }

  if (!data.length) {
    container.innerHTML = `<p class="muted">Ingen innspill ennå.</p>`;
    return;
  }

  container.innerHTML = data.map(item => `
    <div class="summary-item">
      <strong>${escapeHtml(item.name)} · ${formatNorwegianDate(item.created_at.slice(0, 10))}</strong>
      <span>${escapeHtml(item.text)}</span>
      <button class="secondary-btn" type="button" data-feedback-id="${item.id}" style="margin-top: 6px; width: fit-content;">Fjern</button>
    </div>
  `).join("");

  container.querySelectorAll("[data-feedback-id]").forEach(button => {
    button.addEventListener("click", async () => {
      await supabaseClient.from("kbfb_feedback").delete().eq("id", button.dataset.feedbackId);
      await loadFeedbackForAdmin();
    });
  });
}

/* ---------- AVVIK (avvikshåndtering - internt, admin-only for nå) ---------- */

let avvikCache = [];

const avvikForm = document.getElementById("avvikForm");
const avvikFormStatus = document.getElementById("avvikFormStatus");
const avvikDateField = document.getElementById("avvikDate");
const avvikListEl = document.getElementById("avvikList");
const avvikStatusFilter = document.getElementById("avvikStatusFilter");

if (avvikDateField) {
  avvikDateField.value = toDateKey(new Date());
}

if (avvikForm) {
  avvikForm.addEventListener("submit", async event => {
    event.preventDefault();

    if (typeof currentEmployee === "undefined" || !currentEmployee) return;

    const { error } = await supabaseClient.from("kbfb_avvik").insert([{
      reported_by: currentEmployee.name,
      category: document.getElementById("avvikCategory").value,
      severity: document.getElementById("avvikSeverity").value,
      department: document.getElementById("avvikDepartment").value || null,
      date_occurred: avvikDateField.value,
      description: document.getElementById("avvikDescription").value.trim(),
      status: "Meldt"
    }]);

    if (error) {
      console.error("Kunne ikke registrere avvik:", error);
      if (avvikFormStatus) avvikFormStatus.textContent = "Kunne ikke lagre. Prøv igjen.";
      return;
    }

    avvikForm.reset();
    avvikDateField.value = toDateKey(new Date());
    if (avvikFormStatus) avvikFormStatus.textContent = "Avvik registrert.";
    await loadAvvikFromSupabase();
  });
}

async function loadAvvikFromSupabase() {
  if (!avvikListEl) return;

  const { data, error } = await supabaseClient
    .from("kbfb_avvik")
    .select("*")
    .order("date_occurred", { ascending: false });

  if (error) {
    console.error("Kunne ikke hente avvik:", error);
    avvikListEl.innerHTML = `<p class="muted">Kunne ikke hente avvik.</p>`;
    return;
  }

  avvikCache = data || [];
  renderAvvikList();
}

function avvikStatusClass(status) {
  if (status === "Under behandling") return "under-behandling";
  if (status === "Lukket") return "lukket";
  return "meldt";
}

function avvikSeverityClass(severity) {
  if (severity === "Høy") return "hoy";
  if (severity === "Middels") return "middels";
  return "lav";
}

function renderAvvikList() {
  if (!avvikListEl) return;

  const filter = avvikStatusFilter?.value || "open";
  const visible = avvikCache.filter(item => {
    if (filter === "all") return true;
    if (filter === "Lukket") return item.status === "Lukket";
    return item.status !== "Lukket";
  });

  if (!visible.length) {
    avvikListEl.innerHTML = `<p class="muted">Ingen avvik i denne visningen.</p>`;
    return;
  }

  avvikListEl.innerHTML = visible.map(item => `
    <div class="summary-item avvik-item">
      <div class="avvik-item-top">
        <strong>${escapeHtml(item.category)}${item.department ? ` · ${escapeHtml(item.department)}` : ""}</strong>
        <span class="avvik-tag ${avvikSeverityClass(item.severity)}">${escapeHtml(item.severity)}</span>
        <span class="avvik-tag ${avvikStatusClass(item.status)}">${escapeHtml(item.status)}</span>
      </div>
      <span>${formatNorwegianDate(item.date_occurred)} · Meldt av ${escapeHtml(item.reported_by)}</span>
      <p>${escapeHtml(item.description)}</p>

      <label class="wide-field">
        Tiltak / oppfølging
        <textarea rows="2" class="avvik-field" data-id="${item.id}" data-field="tiltak" placeholder="Hva gjøres for å følge opp?">${escapeHtml(item.tiltak || "")}</textarea>
      </label>

      <div class="avvik-item-controls">
        <label>
          Ansvarlig
          <input type="text" class="avvik-field" data-id="${item.id}" data-field="responsible" value="${escapeHtml(item.responsible || "")}" placeholder="Hvem følger opp?" />
        </label>
        <label>
          Status
          <select class="avvik-field" data-id="${item.id}" data-field="status">
            <option value="Meldt" ${item.status === "Meldt" ? "selected" : ""}>Meldt</option>
            <option value="Under behandling" ${item.status === "Under behandling" ? "selected" : ""}>Under behandling</option>
            <option value="Lukket" ${item.status === "Lukket" ? "selected" : ""}>Lukket</option>
          </select>
        </label>
      </div>
      ${item.status === "Lukket" && item.closed_at ? `<span class="muted">Lukket ${formatNorwegianDate(item.closed_at.slice(0, 10))} av ${escapeHtml(item.closed_by || "")}</span>` : ""}
    </div>
  `).join("");

  avvikListEl.querySelectorAll(".avvik-field").forEach(field => {
    field.addEventListener("change", async () => {
      const id = field.dataset.id;
      const key = field.dataset.field;
      const value = field.value.trim();

      const fields = { [key]: value === "" ? null : value };

      if (key === "status") {
        if (value === "Lukket") {
          fields.closed_at = new Date().toISOString();
          fields.closed_by = currentEmployee?.name || null;
        } else {
          fields.closed_at = null;
          fields.closed_by = null;
        }
      }

      const { error } = await supabaseClient.from("kbfb_avvik").update(fields).eq("id", id);
      if (error) {
        console.error("Kunne ikke oppdatere avvik:", error);
        alert("Kunne ikke lagre endringen.");
        return;
      }

      await loadAvvikFromSupabase();
    });
  });
}

if (avvikStatusFilter) {
  avvikStatusFilter.addEventListener("change", renderAvvikList);
}

loadAvvikFromSupabase();

/* ---------- MIN KONTO (passord + profilbilde) ---------- */

const changePasswordForm = document.getElementById("changePasswordForm");
const changePasswordStatus = document.getElementById("changePasswordStatus");

if (changePasswordForm) {
  changePasswordForm.addEventListener("submit", async event => {
    event.preventDefault();
    if (!changePasswordStatus) return;

    const newPassword = document.getElementById("newPassword").value;
    const confirmPassword = document.getElementById("confirmPassword").value;

    if (newPassword !== confirmPassword) {
      changePasswordStatus.textContent = "Passordene er ikke like.";
      return;
    }

    if (newPassword.length < 6) {
      changePasswordStatus.textContent = "Passordet må være minst 6 tegn.";
      return;
    }

    const { error } = await supabaseClient.auth.updateUser({ password: newPassword });

    if (error) {
      console.error("Kunne ikke bytte passord:", error);
      changePasswordStatus.textContent = "Kunne ikke bytte passord. Prøv igjen.";
      return;
    }

    changePasswordStatus.textContent = "Passord byttet ✓";
    changePasswordForm.reset();
  });
}

function renderMyAvatarPreview() {
  const preview = document.getElementById("myAvatarPreview");
  if (!preview || typeof currentEmployee === "undefined" || !currentEmployee) return;

  if (currentEmployee.avatar_url) {
    preview.style.backgroundImage = `url(${currentEmployee.avatar_url})`;
    preview.textContent = "";
  } else {
    preview.style.backgroundImage = "";
    preview.textContent = currentEmployee.name?.[0] || "?";
  }
}

const avatarUploadInput = document.getElementById("avatarUploadInput");
const avatarUploadStatus = document.getElementById("avatarUploadStatus");

async function loadEmployeeAvatars() {
  const { data, error } = await supabaseClient
    .from("kbfb_employees")
    .select("name, avatar_url");

  if (error) {
    console.error("Kunne ikke hente profilbilder:", error);
    return;
  }

  employeeAvatarCache = {};
  (data || []).forEach(emp => {
    if (emp.avatar_url) employeeAvatarCache[emp.name] = emp.avatar_url;
  });

  // This fetch is async and may resolve after other renders already ran
  // with an empty cache (showing initials) - re-run every consumer of
  // avatarSpanFor() now that photos are actually known. Keep this list in
  // sync with wherever avatarSpanFor() gets called from.
  if (typeof applyEmployeeAvatarsToGrid === "function") applyEmployeeAvatarsToGrid();
  if (typeof renderQuickNotes === "function") renderQuickNotes();
  if (typeof renderUserBadge === "function") renderUserBadge();
  if (typeof renderDashboardGreeting === "function") renderDashboardGreeting();
  if (typeof loadTodayShiftsForDashboard === "function") loadTodayShiftsForDashboard();
  if (typeof loadKindMessages === "function") loadKindMessages();
  if (typeof renderSupplies === "function") renderSupplies();
  if (typeof renderDashboardKitchenNotes === "function") renderDashboardKitchenNotes();
  if (typeof renderDashboardGreeting === "function") renderDashboardGreeting();
}

// Builds the HTML for a small round avatar next to someone's name -
// their photo if they have one, otherwise their initial.
function avatarSpanFor(name, sizeClass) {
  const url = employeeAvatarCache[name];
  const cls = `avatar${sizeClass ? " " + sizeClass : ""}`;

  if (url) {
    return `<span class="${cls}" style="background-image:url('${url}')"></span>`;
  }

  return `<span class="${cls}">${escapeHtml((name || "?")[0] || "?")}</span>`;
}

// Swaps the initial-letter placeholder avatars on the schedule grid for
// real photos, for anyone who has uploaded one.
function applyEmployeeAvatarsToGrid() {
  document.querySelectorAll(".department-table tbody tr[data-employee]").forEach(row => {
    const url = employeeAvatarCache[row.dataset.employee];
    const avatarSpan = row.querySelector(".person .avatar");
    if (!avatarSpan || !url) return;

    avatarSpan.style.backgroundImage = `url(${url})`;
    avatarSpan.textContent = "";
  });
}

async function uploadAvatarBlob(blob) {
  if (!avatarUploadStatus || typeof currentEmployee === "undefined" || !currentEmployee) return;

  avatarUploadStatus.textContent = "Laster opp...";

  const filePath = `${currentEmployee.id}.png`;

  const { error: uploadError } = await supabaseClient.storage
    .from("avatars")
    .upload(filePath, blob, { upsert: true, contentType: "image/png" });

  if (uploadError) {
    console.error("Kunne ikke laste opp bilde:", uploadError);
    avatarUploadStatus.textContent = "Kunne ikke laste opp bilde.";
    return;
  }

  const { data: publicUrlData } = supabaseClient.storage
    .from("avatars")
    .getPublicUrl(filePath);

  const publicUrl = `${publicUrlData.publicUrl}?v=${Date.now()}`;

  const { error: rpcError } = await supabaseClient.rpc("kbfb_update_own_avatar", { new_avatar_url: publicUrl });

  if (rpcError) {
    console.error("Kunne ikke lagre bilde:", rpcError);
    avatarUploadStatus.textContent = "Kunne ikke lagre bilde.";
    return;
  }

  currentEmployee.avatar_url = publicUrl;
  employeeAvatarCache[currentEmployee.name] = publicUrl;

  renderMyAvatarPreview();
  applyEmployeeAvatarsToGrid();
  if (typeof renderQuickNotes === "function") renderQuickNotes();
  if (typeof renderUserBadge === "function") renderUserBadge();

  avatarUploadStatus.textContent = "Bilde lagret ✓";
}

/* ---- Avatar cropper: pick a photo, drag to reposition, zoom, save ---- */

let avatarCropperState = null;
const avatarCropCanvas = document.getElementById("avatarCropCanvas");
const avatarCropperSection = document.getElementById("avatarCropperSection");
const avatarZoomSlider = document.getElementById("avatarZoomSlider");
const avatarCropSave = document.getElementById("avatarCropSave");
const avatarCropCancel = document.getElementById("avatarCropCancel");

function clampAvatarCropOffset(state) {
  const size = state.canvas.width;
  const drawW = state.img.width * state.baseScale * state.scale;
  const drawH = state.img.height * state.baseScale * state.scale;
  const maxX = Math.max(0, (drawW - size) / 2);
  const maxY = Math.max(0, (drawH - size) / 2);
  state.offsetX = Math.min(maxX, Math.max(-maxX, state.offsetX));
  state.offsetY = Math.min(maxY, Math.max(-maxY, state.offsetY));
}

function drawAvatarCropper() {
  if (!avatarCropperState) return;
  const { ctx, canvas, img, baseScale, scale, offsetX, offsetY } = avatarCropperState;
  const drawW = img.width * baseScale * scale;
  const drawH = img.height * baseScale * scale;
  const x = canvas.width / 2 - drawW / 2 + offsetX;
  const y = canvas.height / 2 - drawH / 2 + offsetY;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, x, y, drawW, drawH);
}

function openAvatarCropper(file) {
  if (!avatarCropCanvas) return;

  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      const ctx = avatarCropCanvas.getContext("2d");
      const baseScale = Math.max(
        avatarCropCanvas.width / img.width,
        avatarCropCanvas.height / img.height
      );

      avatarCropperState = {
        img, ctx, canvas: avatarCropCanvas,
        baseScale, scale: 1, offsetX: 0, offsetY: 0,
        dragging: false, lastX: 0, lastY: 0
      };

      if (avatarZoomSlider) avatarZoomSlider.value = 1;
      drawAvatarCropper();
      if (avatarCropperSection) avatarCropperSection.style.display = "grid";
    };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
}

function closeAvatarCropper() {
  avatarCropperState = null;
  if (avatarCropperSection) avatarCropperSection.style.display = "none";
  if (avatarUploadInput) avatarUploadInput.value = "";
}

function avatarPointerPos(event) {
  const point = event.touches ? event.touches[0] : event;
  return { x: point.clientX, y: point.clientY };
}

if (avatarCropCanvas) {
  avatarCropCanvas.addEventListener("mousedown", event => {
    if (!avatarCropperState) return;
    avatarCropperState.dragging = true;
    const pos = avatarPointerPos(event);
    avatarCropperState.lastX = pos.x;
    avatarCropperState.lastY = pos.y;
  });

  avatarCropCanvas.addEventListener("touchstart", event => {
    if (!avatarCropperState) return;
    avatarCropperState.dragging = true;
    const pos = avatarPointerPos(event);
    avatarCropperState.lastX = pos.x;
    avatarCropperState.lastY = pos.y;
  });

  const moveHandler = event => {
    if (!avatarCropperState || !avatarCropperState.dragging) return;
    event.preventDefault();
    const pos = avatarPointerPos(event);
    avatarCropperState.offsetX += pos.x - avatarCropperState.lastX;
    avatarCropperState.offsetY += pos.y - avatarCropperState.lastY;
    avatarCropperState.lastX = pos.x;
    avatarCropperState.lastY = pos.y;
    clampAvatarCropOffset(avatarCropperState);
    drawAvatarCropper();
  };

  window.addEventListener("mousemove", moveHandler);
  window.addEventListener("touchmove", moveHandler, { passive: false });

  const endHandler = () => {
    if (avatarCropperState) avatarCropperState.dragging = false;
  };

  window.addEventListener("mouseup", endHandler);
  window.addEventListener("touchend", endHandler);
}

if (avatarZoomSlider) {
  avatarZoomSlider.addEventListener("input", () => {
    if (!avatarCropperState) return;
    avatarCropperState.scale = Number(avatarZoomSlider.value);
    clampAvatarCropOffset(avatarCropperState);
    drawAvatarCropper();
  });
}

if (avatarCropCancel) {
  avatarCropCancel.addEventListener("click", closeAvatarCropper);
}

if (avatarCropSave) {
  avatarCropSave.addEventListener("click", () => {
    if (!avatarCropperState) return;

    avatarCropperState.canvas.toBlob(blob => {
      if (blob) uploadAvatarBlob(blob);
      closeAvatarCropper();
    }, "image/png");
  });
}

if (avatarUploadInput) {
  avatarUploadInput.addEventListener("change", () => {
    const file = avatarUploadInput.files?.[0];
    if (file) openAvatarCropper(file);
  });
}

/* ---------- BESTILLINGER ---------- */

const supplyForm = document.getElementById("supplyForm");
const supplyItem = document.getElementById("supplyItem");
const supplyPriority = document.getElementById("supplyPriority");
const supplyOpenList = document.getElementById("supplyOpenList");
const supplyOrderedList = document.getElementById("supplyOrderedList");
const supplyOrderedSection = document.getElementById("supplyOrderedSection");
const supplyDeclinedList = document.getElementById("supplyDeclinedList");
const supplyDeclinedSection = document.getElementById("supplyDeclinedSection");

let suppliesCache = [];

const supplyPriorityLabel = {
  haster: "🔥 Haster",
  nice_to_have: "🙂 Hadde vært fint å ha"
};

async function loadSuppliesFromSupabase() {
  const { data, error } = await supabaseClient
    .from("kbfb_supplies")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Kunne ikke hente bestillinger:", error);
    return [];
  }

  suppliesCache = data || [];
  return suppliesCache;
}

function renderSupplies() {
  if (!supplyOpenList) return;

  const isAdmin = typeof currentEmployee !== "undefined" && !!currentEmployee?.is_admin;
  const open = [...suppliesCache.filter(s => !s.ordered && !s.declined)]
    .sort((a, b) => (a.priority === "haster" ? 0 : 1) - (b.priority === "haster" ? 0 : 1));
  const ordered = suppliesCache.filter(s => s.ordered);
  const declined = suppliesCache.filter(s => s.declined);

  supplyOpenList.innerHTML = open.length
    ? `<div class="supply-list">${open.map(s => `
      <div class="supply-item${s.priority === "haster" ? " urgent" : ""}">
        <div class="supply-item-top">
          <span class="supply-item-name">${escapeHtml(s.item)}</span>
          <span class="supply-priority-badge ${s.priority}">${supplyPriorityLabel[s.priority] || ""}</span>
        </div>
        <div class="supply-meta">${avatarSpanFor(s.requested_by, "avatar-tiny")}Meldt av ${escapeHtml(s.requested_by)}</div>
        ${isAdmin ? `
          <div class="supply-actions">
            <button class="secondary-btn" type="button" data-mark-ordered="${s.id}">Merk som bestilt</button>
            <button class="secondary-btn" type="button" data-decline-supply="${s.id}">Avslå</button>
            <button class="secondary-btn" type="button" data-delete-supply="${s.id}">Fjern</button>
          </div>
          <div class="supply-inline-form" data-order-box="${s.id}" style="display: none;">
            <input type="text" placeholder="Kommentar (valgfritt)..." data-order-note-input="${s.id}" />
            <button class="secondary-btn" type="button" data-confirm-order="${s.id}" style="width: fit-content;">Bekreft bestilling</button>
          </div>
          <div class="supply-inline-form" data-decline-box="${s.id}" style="display: none;">
            <input type="text" placeholder="Grunn (valgfritt)..." data-decline-note-input="${s.id}" />
            <button class="secondary-btn" type="button" data-confirm-decline="${s.id}" style="width: fit-content;">Bekreft avslag</button>
          </div>
        ` : ""}
      </div>
    `).join("")}</div>`
    : `<p class="muted">Ingenting meldt inn ennå. 🎉</p>`;

  if (supplyOrderedSection) {
    supplyOrderedSection.style.display = ordered.length ? "" : "none";
  }

  if (supplyOrderedList) {
    supplyOrderedList.innerHTML = `<div class="supply-list">${ordered.map(s => `
      <div class="supply-item done">
        <div class="supply-item-top">
          <span class="supply-item-name">✓ ${escapeHtml(s.item)}</span>
          <span class="supply-status-tag ordered">Bestilt</span>
        </div>
        <div class="supply-meta">${avatarSpanFor(s.requested_by, "avatar-tiny")}Meldt av ${escapeHtml(s.requested_by)}${s.admin_note ? ` · ${escapeHtml(s.admin_note)}` : ""}</div>
        ${isAdmin ? `<div class="supply-actions"><button class="secondary-btn" type="button" data-delete-supply="${s.id}">Fjern</button></div>` : ""}
      </div>
    `).join("")}</div>`;
  }

  if (supplyDeclinedSection) {
    supplyDeclinedSection.style.display = declined.length ? "" : "none";
  }

  if (supplyDeclinedList) {
    supplyDeclinedList.innerHTML = `<div class="supply-list">${declined.map(s => `
      <div class="supply-item done">
        <div class="supply-item-top">
          <span class="supply-item-name">${escapeHtml(s.item)}</span>
          <span class="supply-status-tag declined">Avslått</span>
        </div>
        <div class="supply-meta">${avatarSpanFor(s.requested_by, "avatar-tiny")}Meldt av ${escapeHtml(s.requested_by)}${s.admin_note ? ` · ${escapeHtml(s.admin_note)}` : ""}</div>
        ${isAdmin ? `<div class="supply-actions"><button class="secondary-btn" type="button" data-delete-supply="${s.id}">Fjern</button></div>` : ""}
      </div>
    `).join("")}</div>`;
  }

  document.querySelectorAll("[data-mark-ordered]").forEach(button => {
    button.addEventListener("click", () => {
      const box = document.querySelector(`[data-order-box="${button.dataset.markOrdered}"]`);
      if (box) box.style.display = "grid";
    });
  });

  document.querySelectorAll("[data-confirm-order]").forEach(button => {
    button.addEventListener("click", async () => {
      const id = button.dataset.confirmOrder;
      const noteInput = document.querySelector(`[data-order-note-input="${id}"]`);
      const note = noteInput?.value.trim() || null;

      button.disabled = true;
      const { error } = await supabaseClient
        .from("kbfb_supplies")
        .update({ ordered: true, ordered_at: new Date().toISOString(), admin_note: note })
        .eq("id", id);

      if (error) {
        alert("Kunne ikke merke som bestilt: " + error.message);
        button.disabled = false;
        return;
      }

      await loadSuppliesFromSupabase();
      renderSupplies();
    });
  });

  document.querySelectorAll("[data-decline-supply]").forEach(button => {
    button.addEventListener("click", () => {
      const box = document.querySelector(`[data-decline-box="${button.dataset.declineSupply}"]`);
      if (box) box.style.display = "grid";
    });
  });

  document.querySelectorAll("[data-confirm-decline]").forEach(button => {
    button.addEventListener("click", async () => {
      const id = button.dataset.confirmDecline;
      const noteInput = document.querySelector(`[data-decline-note-input="${id}"]`);
      const note = noteInput?.value.trim() || null;

      button.disabled = true;
      const { error } = await supabaseClient
        .from("kbfb_supplies")
        .update({ declined: true, declined_at: new Date().toISOString(), admin_note: note })
        .eq("id", id);

      if (error) {
        alert("Kunne ikke avslå: " + error.message);
        button.disabled = false;
        return;
      }

      await loadSuppliesFromSupabase();
      renderSupplies();
    });
  });

  document.querySelectorAll("[data-delete-supply]").forEach(button => {
    button.addEventListener("click", async () => {
      button.disabled = true;
      const { error } = await supabaseClient
        .from("kbfb_supplies")
        .delete()
        .eq("id", button.dataset.deleteSupply);

      if (error) {
        alert("Kunne ikke fjerne: " + error.message);
        button.disabled = false;
        return;
      }

      await loadSuppliesFromSupabase();
      renderSupplies();
    });
  });
}

if (supplyForm) {
  supplyForm.addEventListener("submit", async event => {
    event.preventDefault();

    if (typeof currentEmployee === "undefined" || !currentEmployee) {
      alert("Fant ikke innlogget bruker. Prøv å laste siden på nytt.");
      return;
    }

    const { error } = await supabaseClient
      .from("kbfb_supplies")
      .insert([{
        item: supplyItem.value.trim(),
        requested_by: currentEmployee.name,
        priority: supplyPriority?.value || "nice_to_have"
      }]);

    if (error) {
      console.error("Kunne ikke legge til bestilling:", error);
      alert("Kunne ikke legge til. Prøv igjen.");
      return;
    }

    supplyForm.reset();
    await loadSuppliesFromSupabase();
    renderSupplies();
  });
}

async function initializeSupplies() {
  if (!supplyOpenList) return;
  await loadSuppliesFromSupabase();
  renderSupplies();
}

initializeSupplies();
