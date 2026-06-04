/* ===== FELLES: HILSEN PÅ DASHBOARD ===== */

const greeting = document.getElementById("greeting");
const todayText = document.getElementById("todayText");

if (greeting) {
  const hour = new Date().getHours();

  if (hour < 11) greeting.textContent = "God morgen, Benjamin";
  else if (hour < 17) greeting.textContent = "God dag, Benjamin";
  else greeting.textContent = "God kveld, Benjamin";
}

if (todayText) {
  const today = new Date();
  todayText.textContent = today.toLocaleDateString("no-NO", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  });
}

/* ===== VAKTPLAN ===== */

const employeeFilter = document.getElementById("employeeFilter");
const departmentFilter = document.getElementById("departmentFilter");

const weekTitle = document.getElementById("weekTitle");
const weekDates = document.getElementById("weekDates");
const prevWeekBtn = document.getElementById("prevWeek");
const nextWeekBtn = document.getElementById("nextWeek");
const currentWeekBtn = document.getElementById("currentWeek");

let viewedWeekStart = getMonday(new Date());
const realCurrentWeekStart = getMonday(new Date());

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

if (employeeFilter && departmentFilter) {
  employeeFilter.addEventListener("change", filterShifts);
  departmentFilter.addEventListener("change", filterShifts);
}

function getCurrentWeekKey() {
  return viewedWeekStart.toISOString().slice(0, 10);
}

function getCellKey(cell) {
  const row = cell.closest("tr");
  const table = cell.closest("table");
  const departmentSection = cell.closest(".department-section");
  const department = row?.dataset.department || "Ukjent";
  const employee = row?.dataset.employee || "Ukjent";
  const rowIndex = Array.from(table.querySelectorAll("tbody tr")).indexOf(row);
  const cellIndex = Array.from(row.children).indexOf(cell);

  return `kbfb-shift-${getCurrentWeekKey()}-${department}-${employee}-${rowIndex}-${cellIndex}`;
}

function setupEditableCells() {
  document.querySelectorAll('.editable-shifts td[contenteditable="true"]').forEach(cell => {
    cell.addEventListener("input", () => {
      const key = getCellKey(cell);
      localStorage.setItem(key, cell.textContent.trim());
      applyShiftCellStyling();
    });

    cell.addEventListener("blur", () => {
      cell.textContent = cell.textContent.trim();
      const key = getCellKey(cell);
      localStorage.setItem(key, cell.textContent);
      applyShiftCellStyling();
    });
  });
}

function loadSavedShiftsForWeek() {
  document.querySelectorAll('.editable-shifts td[contenteditable="true"]').forEach(cell => {
    const key = getCellKey(cell);
    const savedValue = localStorage.getItem(key);

    if (savedValue !== null) {
      cell.textContent = savedValue;
    }
  });
}

function applyShiftCellStyling() {
  document.querySelectorAll('.editable-shifts td[contenteditable="true"]').forEach(cell => {
    const text = cell.textContent.trim().toUpperCase();

    cell.classList.remove(
      "shift-tv",
      "shift-tm",
      "shift-mv",
      "shift-sm",
      "shift-sv",
      "shift-pt",
      "shift-free",
      "shift-office",
      "shift-custom"
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

setupEditableCells();
updateWeekView();
filterShifts();
