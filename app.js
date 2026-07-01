/* ===== KBFB PERSONAL - REN APP.JS ===== */

/* ---------- HJELPEFUNKSJONER ---------- */

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

/* ---------- DATOER / ÅRSHJUL ---------- */

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

async function saveEventToSupabase(eventData) {
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

function getEvents() {
  return eventsCache;
}
function categoryLabel(category) {
  const labels = {
    general: "Generelt",
    personal: "Personalmøte / sosialt",
    plandager: "Plandag",
    overnatting: "Overnatting / tur",
    foreldre: "Foreldre",
    styre: "Styremøte",
    su: "SU-møte"
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
    su: "🟪"
  };

  return emojis[category] || "⚪";
}

function eventIsInWeek(eventDate, weekStart) {
  const date = new Date(eventDate + "T12:00:00");
  const start = new Date(weekStart);
  const end = addDays(start, 4);

  return date >= start && date <= end;
}

/* ---------- DASHBOARD ---------- */

const dashboardWeekTitle = document.getElementById("dashboardWeekTitle");
const dashboardWeekDates = document.getElementById("dashboardWeekDates");
const dashboardPrevWeek = document.getElementById("dashboardPrevWeek");
const dashboardNextWeek = document.getElementById("dashboardNextWeek");
const dashboardCurrentWeek = document.getElementById("dashboardCurrentWeek");
const dashboardKitchenNotes = document.getElementById("dashboardKitchenNotes");
const dashboardSubs = document.getElementById("dashboardSubs");
const dashboardAbsences = document.getElementById("dashboardAbsences");
const dashboardEvents = document.getElementById("dashboardEvents");

let dashboardViewedWeekStart = getMonday(new Date());
const dashboardRealWeekStart = getMonday(new Date());

function dateIsInDashboardWeek(dateString) {
  if (!dateString) return false;
  return eventIsInWeek(dateString, dashboardViewedWeekStart);
}

function dateRangeTouchesDashboardWeek(startDate, endDate) {
  if (!startDate || !endDate) return false;

  const start = new Date(startDate + "T12:00:00");
  const end = new Date(endDate + "T12:00:00");
  const weekStart = new Date(dashboardViewedWeekStart);
  const weekEnd = addDays(weekStart, 4);

  return start <= weekEnd && end >= weekStart;
}

function renderDashboardEvents() {
  if (!dashboardEvents) return;

  const events = getEvents()
    .filter(event => eventIsInWeek(event.date, dashboardViewedWeekStart))
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  dashboardEvents.innerHTML = events.length
    ? events.map(event => `
      <div class="compact-item">
        <strong>${categoryEmoji(event.category)} ${formatKitchenDate(event.date)}</strong>
        <span>${event.title}${event.note ? ` · ${event.note}` : ""}</span>
      </div>
    `).join("")
    : `<p class="muted">Ingen datoer denne uka.</p>`;
}

function renderDashboardKitchenNotes() {
  if (!dashboardKitchenNotes) return;

  const notes = notesCache
    .filter(note => dateIsInDashboardWeek(note.date))
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  dashboardKitchenNotes.innerHTML = notes.length
    ? notes.map(note => `
      <div class="compact-item">
        <strong>${formatKitchenDate(note.date)} · ${note.author}</strong>
        <span>${note.text}</span>
      </div>
    `).join("")
    : `<p class="muted">Ingen beskjeder denne uka.</p>`;
}
function showToast(message) {
  let toast = document.getElementById("toast");

  if (!toast) {
    toast = document.createElement("div");
    toast.id = "toast";
    document.body.appendChild(toast);
  }

  toast.textContent = "✅ " + message;
  toast.className = "show";

  setTimeout(() => {
    toast.className = "";
  }, 2500);
}

function renderDashboardSubs() {
  if (!dashboardSubs) return;

  const subs = subsCache
    .filter(sub => dateIsInDashboardWeek(sub.date))
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  dashboardSubs.innerHTML = subs.length
    ? subs.map(sub => `
      <div class="compact-item">
       <strong>${formatKitchenDate(sub.date)} · ${renderVikarBadge(sub.name)}</strong>
       <span>${sub.department} · ${sub.start_time}–${sub.end_time} · ${sub.hours} timer</span>
      </div>
    `).join("")
    : `<p class="muted">Ingen vikarvakter denne uka.</p>`;
}

function renderDashboardAbsences() {
  if (!dashboardAbsences) return;

  const absences = JSON.parse(localStorage.getItem("kbfb-absence-records") || "[]")
    .filter(record => dateRangeTouchesDashboardWeek(record.startDate, record.endDate))
    .sort((a, b) => new Date(a.startDate) - new Date(b.startDate));

  dashboardAbsences.innerHTML = absences.length
    ? absences.map(record => `
      <div class="compact-item">
        <strong>${record.name} · ${record.type}</strong>
        <span>${formatDateRange(record.startDate, record.endDate)}${record.hours ? ` · ${record.hours} timer` : ""}</span>
      </div>
    `).join("")
    : `<p class="muted">Ingen fravær registrert denne uka.</p>`;
}

function updateDashboardWeek() {
  if (!dashboardWeekTitle || !dashboardWeekDates) return;

  const weekNumber = getWeekNumber(dashboardViewedWeekStart);
  const friday = addDays(dashboardViewedWeekStart, 4);

  dashboardWeekTitle.textContent = `Uke ${weekNumber}`;
  dashboardWeekDates.textContent = `${formatShortDate(dashboardViewedWeekStart)}–${formatShortDate(friday)} · Ukas oversikt`;

  renderDashboardEvents();
  renderDashboardKitchenNotes();
  renderDashboardSubs();
  renderDashboardAbsences();
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
              <span>${shift.shift_value || "-"}</span>
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
  const monthKey = viewedWeekStart.toISOString().slice(0, 7);

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

const shiftValues = ["", "TV", "TM", "MV", "SM", "SV", "PT", "F", "AVS", "KONTOR", "MØTE", "ANNET"];

function getCurrentWeekKey() {
  return viewedWeekStart.toISOString().slice(0, 10);
}

function getShiftStorageKey(cell) {
  const row = cell.closest("tr");
  const table = cell.closest("table");
  const department = row?.dataset.department || "Ukjent";
  const employee = row?.dataset.employee || "Ukjent";
  const rowIndex = Array.from(table.querySelectorAll("tbody tr")).indexOf(row);
  const cellIndex = Array.from(row.children).indexOf(cell);

  return `kbfb-shift-${getCurrentWeekKey()}-${department}-${employee}-${rowIndex}-${cellIndex}`;
}

function getShiftSelectClass(value) {
  if (value === "TV") return "tv";
  if (value === "TM") return "tm";
  if (value === "MV") return "mv";
  if (value === "SM") return "sm";
  if (value === "SV") return "sv";
  if (value === "PT") return "pt";
  if (value === "F" || value === "AVS") return "free";
  if (value === "KONTOR" || value === "MØTE") return "office";
  if (value === "ANNET") return "custom";
  return "";
}

function colorShiftSelect(select) {
  select.className = "shift-select";
  const color = getShiftSelectClass(select.value);
  if (color) select.classList.add(color);
}

function buildShiftDropdowns() {
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
    });

    cell.innerHTML = "";
    cell.appendChild(select);
    cell.appendChild(customInput);
  });
}
function renderWeekEvents() {
  if (!weekEvents) return;

  const events = getEvents()
    .filter(event => eventIsInWeek(event.date, viewedWeekStart))
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  weekEvents.innerHTML = events.length
    ? events.map(event => `
      <div class="compact-item">
        <strong>${categoryEmoji(event.category)} ${formatKitchenDate(event.date)}</strong>
        <span>${event.title}${event.note ? ` · ${event.note}` : ""}</span>
      </div>
    `).join("")
    : `<p class="muted">Ingen datoer denne uka.</p>`;
}

async function updateWeekView() {
  await loadShiftsFromSupabase();

  if (!weekTitle || !weekDates) return;


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
  renderWeekEvents();
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

if (prevWeekBtn) {
  prevWeekBtn.addEventListener("click", () => {
    viewedWeekStart = addWeeks(viewedWeekStart, -1);
    updateWeekView();
    filterShifts();
  });
}

if (nextWeekBtn) {
  nextWeekBtn.addEventListener("click", () => {
    viewedWeekStart = addWeeks(viewedWeekStart, 1);
    updateWeekView();
    filterShifts();
  });
}

if (currentWeekBtn) {
  currentWeekBtn.addEventListener("click", () => {
    viewedWeekStart = new Date(realCurrentWeekStart);
    updateWeekView();
    filterShifts();
  });
}

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

/* ---------- ENKEL KJØKKENBOK - SUPABASE ---------- */

const quickNoteForm = document.getElementById("quickNoteForm");
const quickNoteAuthor = document.getElementById("quickNoteAuthor");
const quickNoteDate = document.getElementById("quickNoteDate");
const quickNoteText = document.getElementById("quickNoteText");
const quickNoteFeed = document.getElementById("quickNoteFeed");
const clearQuickNotes = document.getElementById("clearQuickNotes");

let notesCache = [];

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
  console.log("LAGRER NOTE", note);

  const { data, error } = await supabaseClient
    .from("kbfb_notes")
    .insert([{
      author: note.author,
      date: note.date,
      text: note.text
    }])
    .select();

  console.log("NOTE DATA", data);
  console.log("NOTE ERROR", error);
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

function renderQuickNotes() {
  if (!quickNoteFeed) return;

  const notes = notesCache;

  if (!notes.length) {
    quickNoteFeed.innerHTML = `<p class="muted">Ingen beskjeder ennå.</p>`;
    return;
  }

  const grouped = {};

  notes.forEach(note => {
    if (!grouped[note.date]) grouped[note.date] = [];
    grouped[note.date].push(note);
  });

  quickNoteFeed.innerHTML = Object.entries(grouped).map(([date, dayNotes]) => `
    <div class="kitchen-day">
      <h3>${formatKitchenDate(date)}</h3>

      ${dayNotes.map(note => `
        <article class="kitchen-entry">
          <div class="kitchen-entry-top">
            <strong>${note.author}</strong>
            <button class="kitchen-delete" data-quick-note-id="${note.id}">Slett</button>
          </div>
          <p>${note.text}</p>
        </article>
      `).join("")}
    </div>
  `).join("");

  document.querySelectorAll("[data-quick-note-id]").forEach(button => {
    button.addEventListener("click", async () => {
      await deleteNoteFromSupabase(button.dataset.quickNoteId);
      await loadNotesFromSupabase();
      renderQuickNotes();
      renderDashboardKitchenNotes();
    });
  });
}

if (quickNoteDate) {
  quickNoteDate.value = new Date().toISOString().slice(0, 10);
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

    const note = {
      author: quickNoteAuthor.value,
      date: quickNoteDate.value,
      text: quickNoteText.value.trim()
    };

    await saveNoteToSupabase(note);
    await loadNotesFromSupabase();

    quickNoteText.value = "";

    renderQuickNotes();
    renderDashboardKitchenNotes();
  });
}

if (clearQuickNotes) {
  clearQuickNotes.addEventListener("click", () => {
    alert("Tøm testdata er skrudd av nå som kjøkkenboka bruker Supabase.");
  });
}

async function initializeNotes() {
  await loadNotesFromSupabase();
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
    su: "SU-møte"
  };

  return titles[category] || "Viktig dato";
}

function monthHeading(dateString) {
  return new Date(dateString + "T12:00:00").toLocaleDateString("no-NO", {
    month: "long",
    year: "numeric"
  });
}

function shortDate(dateString) {
  return new Date(dateString + "T12:00:00").toLocaleDateString("no-NO", {
    day: "2-digit",
    month: "2-digit"
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
        ${monthEvents.map(event => `
          <article class="date-item date-${event.category}">
            <div class="date-item-top">
              <div>
                <strong>${shortDate(event.date)} · ${event.title}</strong>
                <span>${categoryEmoji(event.category)} ${categoryLabel(event.category)}${event.note ? ` · ${event.note}` : ""}</span>
              </div>

              <div class="date-actions">
                <button class="date-edit" type="button" data-edit-date="${event.id}">Endre</button>
                <button class="date-delete" type="button" data-delete-date="${event.id}">Slett</button>
              </div>
            </div>
          </article>
        `).join("")}
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
    button.addEventListener("click", () => {
      const updated = getEvents().filter(item => item.id !== button.dataset.deleteDate);
      

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
    eventDate.value = new Date().toISOString().slice(0, 10);
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
      id: existingId || crypto.randomUUID(),
      date: eventDate.value,
      title: eventTitle.value.trim(),
      category: eventCategory.value,
      note: eventNote.value.trim()
    };

    await saveEventToSupabase(eventData);

await loadEventsFromSupabase();

    dateForm.reset();
    dateId.value = "";
    eventDate.value = new Date().toISOString().slice(0, 10);
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

function seedDefaultEventsIfEmpty() {
  const existing = getEvents();
  if (existing.length) return;

  const defaultEvents = [
    { date: "2026-08-14", title: "Planleggingsdag", category: "plandager", note: "Barnehagen stengt" },
    { date: "2026-08-20", title: "Foreldremøte", category: "foreldre", note: "" },
    { date: "2026-09-02", title: "Dugnad", category: "foreldre", note: "" },
    { date: "2026-09-09", title: "Personalmøte", category: "personal", note: "" },
    { date: "2026-09-17", title: "SU-møte", category: "su", note: "" },
    { date: "2026-09-22", title: "Styremøte", category: "styre", note: "" },
    { date: "2026-10-08", title: "Personalmøte", category: "personal", note: "" },
    { date: "2026-10-29", title: "Dugnad", category: "foreldre", note: "" },
    { date: "2026-11-03", title: "Planleggingsdag", category: "plandager", note: "" },
    { date: "2026-11-17", title: "Styremøte", category: "styre", note: "" },
    { date: "2026-12-11", title: "Lucia og julegløgg", category: "foreldre", note: "Med foreldre" },
    { date: "2026-12-18", title: "Julebord", category: "personal", note: "" },
    { date: "2027-01-04", title: "Planleggingsdag", category: "plandager", note: "Barnehagen stengt" },
    { date: "2027-01-14", title: "Personalmøte", category: "personal", note: "" },
    { date: "2027-02-04", title: "Styremøte", category: "styre", note: "" },
    { date: "2027-02-23", title: "Karneval", category: "general", note: "" },
    { date: "2027-03-04", title: "Maxi skiovernatting", category: "overnatting", note: "" },
    { date: "2027-03-11", title: "Personalmøte", category: "personal", note: "" },
    { date: "2027-03-23", title: "Styremøte", category: "styre", note: "" },
    { date: "2027-04-15", title: "Personalmøte", category: "personal", note: "" },
    { date: "2027-05-05", title: "Dugnad", category: "foreldre", note: "" },
    { date: "2027-05-13", title: "17. mai markering", category: "foreldre", note: "" },
    { date: "2027-05-19", title: "Visittur for nye barn", category: "foreldre", note: "" },
    { date: "2027-05-27", title: "SU-møte", category: "su", note: "" }
  ].map(event => ({
    id: crypto.randomUUID(),
    ...event
  }));
  
}

async function initializeEvents() {
  await loadEventsFromSupabase();

  renderEvents();
  renderDashboardEvents();
  renderWeekEvents();
}

initializeEvents();
renderEvents();
renderDashboardEvents();
renderWeekEvents();
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

let subsCache = [];
let subPeopleCache = [];

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
  const { data, error } = await supabaseClient
    .from("kbfb_subs")
    .insert([{ name, color }])
    .select();

  console.log("NY VIKAR DATA", data);
  console.log("NY VIKAR ERROR", error);
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
    ${person.name}
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

    await saveSubPersonToSupabase(name, subPersonColor.value);
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
  const { data, error } = await supabaseClient
    .from("kbfb_sub_hours")
    .insert([{
      name: sub.name,
      date: sub.date,
      department: sub.department,
      start_time: sub.start_time,
      end_time: sub.end_time,
      hours: sub.hours,
      note: sub.note
    }])
    .select();

  console.log("VIKAR DATA", data);
  console.log("VIKAR ERROR", error);
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

function renderSubs() {
  if (!subTableBody || !subSummary) return;

  subTableBody.innerHTML = "";

  if (!subsCache.length) {
    subSummary.innerHTML = `<p class="muted">Ingen vakter registrert ennå.</p>`;
    return;
  }

  subsCache.forEach(sub => {
    const row = document.createElement("tr");

    row.innerHTML = `
      <td>${formatNorwegianDate(sub.date)}</td>
      <td>${renderVikarBadge(sub.name)}</td>
      <td>${sub.department || ""}</td>
      <td>${sub.start_time || ""}–${sub.end_time || ""}</td>
      <td>${sub.hours || 0}</td>
      <td>${sub.note || ""}</td>
      <td><button class="kitchen-delete" data-sub-id="${sub.id}">Slett</button></td>
    `;

    subTableBody.appendChild(row);
  });

  renderSubSummary();

  document.querySelectorAll("[data-sub-id]").forEach(button => {
    button.addEventListener("click", async () => {
      await deleteSubFromSupabase(button.dataset.subId);
      await loadSubsFromSupabase();
      renderSubs();
      renderDashboardSubs();
    });
  });
}

function getSubPersonColor(name) {
  const person = subPeopleCache.find(p => p.name === name);
  return person?.color || "#f3f4f6";
}

function renderVikarBadge(name) {
  return `<span class="vikar-badge" style="background:${getSubPersonColor(name)}">${name}</span>`;
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
  return new Date().toISOString().slice(0, 7);
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
      dates.push(current.toISOString().slice(0, 10));
    }

    current.setDate(current.getDate() + 1);
  }

  return dates;
}

if (subDate) {
  subDate.value = new Date().toISOString().slice(0, 10);
}

if (subForm) {
  subForm.addEventListener("submit", async event => {
    event.preventDefault();

    const hours = calculateHours(subStart.value, subEnd.value);

    const startDate = subDate.value;
    const endDate = subEndDate.value || subDate.value;
    const dates = getWeekdaysBetween(startDate, endDate);

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

      const duplicate = subsCache.some(existing =>
        existing.name === sub.name &&
        existing.date === sub.date &&
        existing.start_time === sub.start_time &&
        existing.end_time === sub.end_time
      );

      if (!duplicate) {
        await saveSubToSupabase(sub);
      }
    }

    await loadSubsFromSupabase();

    subForm.reset();
    subDate.value = new Date().toISOString().slice(0, 10);
    subEndDate.value = "";
    subStart.value = "08:30";
    subEnd.value = "16:00";

    renderSubs();
    renderDashboardSubs();
  });
}

if (clearSubs) {
  clearSubs.addEventListener("click", () => {
    alert("Tøm testdata er deaktivert.");
  });
}

async function initializeSubs() {
  await loadSubPeopleFromSupabase();
  await loadSubsFromSupabase();

  renderSubPeople();
  renderSubs();
  renderDashboardSubs();
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
const absenceNote = document.getElementById("absenceNote");
const absenceFilter = document.getElementById("absenceFilter");
const absenceSummary = document.getElementById("absenceSummary");
const absenceTableBody = document.getElementById("absenceTableBody");
const clearAbsences = document.getElementById("clearAbsences");

let absencesCache = [];

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
  const { data, error } = await supabaseClient
    .from("kbfb_absences")
    .insert([record])
    .select();

  console.log("FRAVÆR DATA", data);
  console.log("FRAVÆR ERROR", error);
}

async function deleteAbsenceFromSupabase(id) {
  const { error } = await supabaseClient
    .from("kbfb_absences")
    .delete()
    .eq("id", id);

  if (error) console.error("Kunne ikke slette fravær:", error);
}

function countWeekdays(startDate, endDate) {
  const dates = getWeekdaysBetween(startDate, endDate);
  return dates.length;
}

function getFilteredAbsences() {
  const selected = absenceFilter?.value || "all";

  return absencesCache.filter(record =>
    selected === "all" || record.name === selected
  );
}

function renderAbsences() {
  if (!absenceTableBody || !absenceSummary) return;

  const records = getFilteredAbsences();

  if (!records.length) {
    absenceTableBody.innerHTML = "";
    absenceSummary.innerHTML = `<p class="muted">Ingen føringer ennå.</p>`;
    return;
  }

  absenceTableBody.innerHTML = records.map(record => `
    <tr>
      <td>${record.name}</td>
      <td>${record.type}</td>
      <td>${formatDateRange(record.start_date, record.end_date)}</td>
      <td>${countWeekdays(record.start_date, record.end_date)}</td>
      <td>${record.hours || ""}</td>
      <td>${record.status || "Registrert"}</td>
      <td>${record.note || ""}</td>
      <td><button class="kitchen-delete" data-absence-id="${record.id}">Slett</button></td>
    </tr>
  `).join("");

  renderAbsenceSummary(records);

  document.querySelectorAll("[data-absence-id]").forEach(button => {
    button.addEventListener("click", async () => {
      await deleteAbsenceFromSupabase(button.dataset.absenceId);
      await loadAbsencesFromSupabase();
      renderAbsences();
      renderDashboardAbsences();
    });
  });
}

function renderAbsenceSummary(records) {
  const grouped = {};

  records.forEach(record => {
    if (!grouped[record.name]) {
      grouped[record.name] = {
        ferie: 0,
        avspaseringBrukt: 0,
        avspaseringOpptjent: 0,
        overtid: 0,
        permisjon: 0
      };
    }

    const days = countWeekdays(record.start_date, record.end_date);
    const hours = Number(record.hours || 0);

    if (record.type === "Ferie") grouped[record.name].ferie += days;
    if (record.type === "Avspasering brukt") grouped[record.name].avspaseringBrukt += hours || days * 7.5;
    if (record.type === "Avspasering opptjent") grouped[record.name].avspaseringOpptjent += hours;
    if (record.type === "Overtid") grouped[record.name].overtid += hours;
    if (record.type === "Permisjon") grouped[record.name].permisjon += days;
  });

  absenceSummary.innerHTML = Object.entries(grouped).map(([name, total]) => `
    <div class="compact-item">
      <strong>${name}</strong>
      <span>
        Ferie: ${total.ferie} dager · 
        Avsp. brukt: ${total.avspaseringBrukt} t · 
        Opptjent: ${total.avspaseringOpptjent} t · 
        Overtid: ${total.overtid} t
      </span>
    </div>
  `).join("");
}

if (absenceStartDate) {
  absenceStartDate.value = new Date().toISOString().slice(0, 10);
}

if (absenceEndDate) {
  absenceEndDate.value = new Date().toISOString().slice(0, 10);
}

if (absenceForm) {
  absenceForm.addEventListener("submit", async event => {
    event.preventDefault();

    const record = {
      name: absenceName.value,
      type: absenceType.value,
      start_date: absenceStartDate.value,
      end_date: absenceEndDate.value,
      hours: absenceHours.value ? Number(absenceHours.value) : null,
      status: absenceStatus.value,
      note: absenceNote.value.trim()
    };

    await saveAbsenceToSupabase(record);
    await loadAbsencesFromSupabase();

    absenceForm.reset();
    absenceStartDate.value = new Date().toISOString().slice(0, 10);
    absenceEndDate.value = new Date().toISOString().slice(0, 10);

    renderAbsences();
    renderDashboardAbsences();
  });
}

if (absenceFilter) {
  absenceFilter.addEventListener("change", renderAbsences);
}

if (clearAbsences) {
  clearAbsences.addEventListener("click", () => {
    alert("Tøm testdata er deaktivert.");
  });
}

async function initializeAbsences() {
  await loadAbsencesFromSupabase();
  renderAbsences();
  renderDashboardAbsences();
}

initializeAbsences();
