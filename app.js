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
  return date.toLocaleDateString("no-NO", { day: "2-digit", month: "2-digit" });
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

/* ---------- VAKTLISTE ---------- */

const employeeFilter = document.getElementById("employeeFilter");
const departmentFilter = document.getElementById("departmentFilter");
const weekTitle = document.getElementById("weekTitle");
const weekDates = document.getElementById("weekDates");
const prevWeekBtn = document.getElementById("prevWeek");
const nextWeekBtn = document.getElementById("nextWeek");
const currentWeekBtn = document.getElementById("currentWeek");

let viewedWeekStart = getMonday(new Date());
const realCurrentWeekStart = getMonday(new Date());

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

  loadSavedShiftsForWeek();
  applyShiftCellStyling();
}

function getCurrentWeekKey() {
  return viewedWeekStart.toISOString().slice(0, 10);
}

function getCellKey(cell) {
  const row = cell.closest("tr");
  const table = cell.closest("table");
  const department = row?.dataset.department || "Ukjent";
  const employee = row?.dataset.employee || "Ukjent";
  const rowIndex = Array.from(table.querySelectorAll("tbody tr")).indexOf(row);
  const cellIndex = Array.from(row.children).indexOf(cell);

  return `kbfb-shift-${getCurrentWeekKey()}-${department}-${employee}-${rowIndex}-${cellIndex}`;
}

function setupEditableCells() {
  document.querySelectorAll('.editable-shifts td[contenteditable="true"]').forEach(cell => {
    cell.addEventListener("input", () => {
      localStorage.setItem(getCellKey(cell), cell.textContent.trim());
      applyShiftCellStyling();
    });

    cell.addEventListener("blur", () => {
      cell.textContent = cell.textContent.trim();
      localStorage.setItem(getCellKey(cell), cell.textContent);
      applyShiftCellStyling();
    });
  });
}

function loadSavedShiftsForWeek() {
  document.querySelectorAll('.editable-shifts td[contenteditable="true"]').forEach(cell => {
    const savedValue = localStorage.getItem(getCellKey(cell));
    if (savedValue !== null) cell.textContent = savedValue;
  });
}

function applyShiftCellStyling() {
  document.querySelectorAll('.editable-shifts td[contenteditable="true"]').forEach(cell => {
    const text = cell.textContent.trim().toUpperCase();

    cell.classList.remove(
      "shift-tv", "shift-tm", "shift-mv", "shift-sm", "shift-sv",
      "shift-pt", "shift-free", "shift-office", "shift-custom"
    );

    if (!text) return;

    if (text.includes("TV")) cell.classList.add("shift-tv");
    else if (text.includes("TM")) cell.classList.add("shift-tm");
    else if (text.includes("MV")) cell.classList.add("shift-mv");
    else if (text.includes("SM")) cell.classList.add("shift-sm");
    else if (text.includes("SV")) cell.classList.add("shift-sv");
    else if (text.includes("PT") || text.includes("PD")) cell.classList.add("shift-pt");
    else if (text.includes("FERIE") || text.includes("AVS") || text === "F") cell.classList.add("shift-free");
    else if (text.includes("KONTOR") || text.includes("MØTE")) cell.classList.add("shift-office");
    else if (/\d{1,2}[:.]?\d{0,2}\s*[–-]\s*\d{1,2}/.test(text)) cell.classList.add("shift-custom");
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

if (prevWeekBtn) {
  prevWeekBtn.addEventListener("click", () => {
    viewedWeekStart = addWeeks(viewedWeekStart, -1);
    updateWeekView();
  });
}

if (nextWeekBtn) {
  nextWeekBtn.addEventListener("click", () => {
    viewedWeekStart = addWeeks(viewedWeekStart, 1);
    updateWeekView();
  });
}

if (currentWeekBtn) {
  currentWeekBtn.addEventListener("click", () => {
    viewedWeekStart = new Date(realCurrentWeekStart);
    updateWeekView();
  });
}

if (employeeFilter && departmentFilter) {
  employeeFilter.addEventListener("change", filterShifts);
  departmentFilter.addEventListener("change", filterShifts);
}

setupEditableCells();
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

if (quickNoteDate) quickNoteDate.value = new Date().toISOString().slice(0, 10);

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
