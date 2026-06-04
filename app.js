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

/* ---------- DASHBOARD ---------- */

const dashboardWeekTitle = document.getElementById("dashboardWeekTitle");
const dashboardWeekDates = document.getElementById("dashboardWeekDates");
const dashboardPrevWeek = document.getElementById("dashboardPrevWeek");
const dashboardNextWeek = document.getElementById("dashboardNextWeek");
const dashboardCurrentWeek = document.getElementById("dashboardCurrentWeek");
const dashboardKitchenNotes = document.getElementById("dashboardKitchenNotes");
const dashboardSubs = document.getElementById("dashboardSubs");
const dashboardAbsences = document.getElementById("dashboardAbsences");

let dashboardViewedWeekStart = getMonday(new Date());
const dashboardRealWeekStart = getMonday(new Date());

function dateIsInDashboardWeek(dateString) {
  if (!dateString) return false;

  const date = new Date(dateString + "T12:00:00");
  const start = new Date(dashboardViewedWeekStart);
  const end = addDays(start, 4);

  return date >= start && date <= end;
}

function dateRangeTouchesDashboardWeek(startDate, endDate) {
  if (!startDate || !endDate) return false;

  const start = new Date(startDate + "T12:00:00");
  const end = new Date(endDate + "T12:00:00");
  const weekStart = new Date(dashboardViewedWeekStart);
  const weekEnd = addDays(weekStart, 4);

  return start <= weekEnd && end >= weekStart;
}

function updateDashboardWeek() {
  if (!dashboardWeekTitle || !dashboardWeekDates) return;

  const weekNumber = getWeekNumber(dashboardViewedWeekStart);
  const friday = addDays(dashboardViewedWeekStart, 4);

  dashboardWeekTitle.textContent = `Uke ${weekNumber}`;
  dashboardWeekDates.textContent = `${formatShortDate(dashboardViewedWeekStart)}–${formatShortDate(friday)} · Ukas oversikt`;

  renderDashboardKitchenNotes();
  renderDashboardSubs();
  renderDashboardAbsences();
}

function renderDashboardKitchenNotes() {
  if (!dashboardKitchenNotes) return;

  const notes = JSON.parse(localStorage.getItem("kbfb-quick-kjokkenbok") || "[]")
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

function renderDashboardSubs() {
  if (!dashboardSubs) return;

  const subs = JSON.parse(localStorage.getItem("kbfb-vikarvakter") || "[]")
    .filter(sub => dateIsInDashboardWeek(sub.date))
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  dashboardSubs.innerHTML = subs.length
    ? subs.map(sub => `
      <div class="compact-item">
        <strong>${formatKitchenDate(sub.date)} · ${sub.name}</strong>
        <span>${sub.department} · ${sub.start}–${sub.end} · ${sub.hours} timer</span>
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
        <span>${formatDateRange(record.startDate, record.endDate)} ${record.hours ? `· ${record.hours} timer` : ""}</span>
      </div>
    `).join("")
    : `<p class="muted">Ingen fravær registrert denne uka.</p>`;
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

/* ---------- VAKTLISTE MED DROPDOWN ---------- */

const employeeFilter = document.getElementById("employeeFilter");
const departmentFilter = document.getElementById("departmentFilter");
const dateSearch = document.getElementById("dateSearch");

const weekTitle = document.getElementById("weekTitle");
const weekDates = document.getElementById("weekDates");
const prevWeekBtn = document.getElementById("prevWeek");
const nextWeekBtn = document.getElementById("nextWeek");
const currentWeekBtn = document.getElementById("currentWeek");

let viewedWeekStart = getMonday(new Date());
const realCurrentWeekStart = getMonday(new Date());

const shiftValues = [
  "",
  "TV",
  "TM",
  "MV",
  "SM",
  "SV",
  "PT",
  "F",
  "AVS",
  "KONTOR",
  "MØTE",
  "ANNET"
];

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
    const key = getShiftStorageKey(cell);
    const saved = localStorage.getItem(key);
    const defaultValue = saved !== null ? saved : cell.dataset.default || "";

    const select = document.createElement("select");
    select.className = "shift-select";

    shiftValues.forEach(value => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = value === "" ? "—" : value;
      select.appendChild(option);
    });

    const customInput = document.createElement("input");
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

    select.addEventListener("change", () => {
      colorShiftSelect(select);

      if (select.value === "ANNET") {
        customInput.style.display = "block";
        customInput.focus();
        localStorage.setItem(key, customInput.value.trim());
      } else {
        customInput.style.display = "none";
        customInput.value = "";
        localStorage.setItem(key, select.value);
      }
    });

    customInput.addEventListener("input", () => {
      localStorage.setItem(key, customInput.value.trim());
    });

    cell.innerHTML = "";
    cell.appendChild(select);
    cell.appendChild(customInput);
  });
}

function updateWeekView() {
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

/* ---------- ENKEL KJØKKENBOK ---------- */

const quickNoteForm = document.getElementById("quickNoteForm");
const quickNoteAuthor = document.getElementById("quickNoteAuthor");
const quickNoteDate = document.getElementById("quickNoteDate");
const quickNoteText = document.getElementById("quickNoteText");
const quickNoteFeed = document.getElementById("quickNoteFeed");
const clearQuickNotes = document.getElementById("clearQuickNotes");

const quickNoteStorageKey = "kbfb-quick-kjokkenbok";

function getQuickNotes() {
  return JSON.parse(localStorage.getItem(quickNoteStorageKey) || "[]");
}

function saveQuickNotes(notes) {
  localStorage.setItem(quickNoteStorageKey, JSON.stringify(notes));
}

function renderQuickNotes() {
  if (!quickNoteFeed) return;

  const notes = getQuickNotes().sort((a, b) => new Date(b.date) - new Date(a.date));

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
    button.addEventListener("click", () => {
      const updated = getQuickNotes().filter(note => note.id !== button.dataset.quickNoteId);
      saveQuickNotes(updated);
      renderQuickNotes();
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
  quickNoteForm.addEventListener("submit", event => {
    event.preventDefault();

    const note = {
      id: crypto.randomUUID(),
      author: quickNoteAuthor.value,
      date: quickNoteDate.value,
      text: quickNoteText.value.trim()
    };

    const notes = getQuickNotes();
    notes.push(note);
    saveQuickNotes(notes);

    quickNoteText.value = "";
    renderQuickNotes();
  });
}

if (clearQuickNotes) {
  clearQuickNotes.addEventListener("click", () => {
    localStorage.removeItem(quickNoteStorageKey);
    renderQuickNotes();
  });
}

renderQuickNotes();

/* ---------- DATOER / ÅRSHJUL ---------- */

const dateForm = document.getElementById("dateForm");
const dateId = document.getElementById("dateId");
const eventDate = document.getElementById("eventDate");
const eventTitle = document.getElementById("eventTitle");
const eventCategory = document.getElementById("eventCategory");
const eventNote = document.getElementById("eventNote");
const dateList = document.getElementById("dateList");
const dateCount = document.getElementById("dateCount");
const dateSearchInput = document.getElementById("dateSearchInput");
const dateCategoryFilter = document.getElementById("dateCategoryFilter");
const seedDates = document.getElementById("seedDates");

const eventStorageKey = "kbfb-events";

function getEvents() {
  return JSON.parse(localStorage.getItem(eventStorageKey) || "[]");
}

function saveEvents(events) {
  localStorage.setItem(eventStorageKey, JSON.stringify(events));
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

function renderEvents() {
  if (!dateList) return;

  const search = (dateSearchInput?.value || "").toLowerCase();
  const category = dateCategoryFilter?.value || "all";

  let events = getEvents().sort((a, b) => new Date(a.date) - new Date(b.date));

  events = events.filter(event => {
    const text = `${event.title} ${event.note || ""} ${categoryLabel(event.category)}`.toLowerCase();
    const matchesSearch = text.includes(search);
    const matchesCategory = category === "all" || event.category === category;
    return matchesSearch && matchesCategory;
  });

  if (dateCount) {
    dateCount.textContent = `${events.length} ${events.length === 1 ? "dato" : "datoer"}`;
  }

  if (!events.length) {
    dateList.innerHTML = `<p class="muted">Ingen datoer å vise.</p>`;
    return;
  }

  dateList.innerHTML = events.map(event => `
    <article class="date-item date-${event.category}">
      <div class="date-item-top">
        <div>
          <strong>${formatNorwegianDate(event.date)} · ${event.title}</strong>
          <span>${categoryEmoji(event.category)} ${categoryLabel(event.category)}${event.note ? ` · ${event.note}` : ""}</span>
        </div>
        <div class="date-actions">
          <button class="date-edit" data-edit-date="${event.id}">Endre</button>
          <button class="date-delete" data-delete-date="${event.id}">Slett</button>
        </div>
      </div>
    </article>
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
      saveEvents(updated);
      renderEvents();
      renderDashboardEvents?.();
      renderWeekEvents?.();
    });
  });
}

if (dateForm) {
  if (eventDate && !eventDate.value) {
    eventDate.value = new Date().toISOString().slice(0, 10);
  }

  dateForm.addEventListener("submit", event => {
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

    const updated = existingId
      ? events.map(item => item.id === existingId ? eventData : item)
      : [...events, eventData];

    saveEvents(updated);
    dateForm.reset();
    dateId.value = "";
    eventDate.value = new Date().toISOString().slice(0, 10);

    renderEvents();
  });
}

if (dateSearchInput) dateSearchInput.addEventListener("input", renderEvents);
if (dateCategoryFilter) dateCategoryFilter.addEventListener("change", renderEvents);

if (seedDates) {
  seedDates.addEventListener("click", () => {
    const demoEvents = [
      { date: "2026-08-14", title: "Planleggingsdager", category: "plandager", note: "Barnehagen er stengt." },
      { date: "2026-08-20", title: "Foreldremøte", category: "foreldre", note: "For alle og litt ekstra møte for Maxi." },
      { date: "2026-09-02", title: "Dugnad", category: "foreldre", note: "" },
      { date: "2026-09-09", title: "Personalmøte", category: "personal", note: "" },
      { date: "2026-09-17", title: "SU-møte", category: "su", note: "" },
      { date: "2026-09-22", title: "Styremøte", category: "styre", note: "" },
      { date: "2026-10-08", title: "Personalmøte", category: "personal", note: "" },
      { date: "2026-10-29", title: "Dugnad", category: "foreldre", note: "" },
      { date: "2026-11-03", title: "Plandag", category: "plandager", note: "" },
      { date: "2026-11-17", title: "Styremøte", category: "styre", note: "" },
      { date: "2026-12-11", title: "Lucia og julegløgg", category: "foreldre", note: "Med foreldre." },
      { date: "2026-12-18", title: "Julebord", category: "personal", note: "" },
      { date: "2027-01-02", title: "Planleggingsdag", category: "plandager", note: "Barnehagen er stengt." },
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
    ].map(event => ({ id: crypto.randomUUID(), ...event }));

    saveEvents(demoEvents);
    renderEvents();
  });
}

renderEvents();
