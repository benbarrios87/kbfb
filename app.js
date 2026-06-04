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
function formatNorwegianDate(dateString) {
  if (!dateString) return "";

  return new Date(dateString + "T12:00:00").toLocaleDateString("no-NO", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
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

/* ===== FERIE / AVSPASERING / OVERTID ===== */

const absenceForm = document.getElementById("absenceForm");
const absenceTableBody = document.getElementById("absenceTableBody");
const absenceSummary = document.getElementById("absenceSummary");
const absenceFilter = document.getElementById("absenceFilter");
const clearAbsences = document.getElementById("clearAbsences");

const absenceStorageKey = "kbfb-absence-records";

function getAbsences() {
  return JSON.parse(localStorage.getItem(absenceStorageKey) || "[]");
}

function saveAbsences(records) {
  localStorage.setItem(absenceStorageKey, JSON.stringify(records));
}

function countWeekdays(startDate, endDate) {
  if (!startDate || !endDate) return 0;

  const start = new Date(startDate + "T12:00:00");
  const end = new Date(endDate + "T12:00:00");

  if (end < start) return 0;

  let count = 0;
  const current = new Date(start);

  while (current <= end) {
    const day = current.getDay();
    if (day !== 0 && day !== 6) count++;
    current.setDate(current.getDate() + 1);
  }

  return count;
}

function formatDateRange(startDate, endDate) {
  if (startDate === endDate) return formatNorwegianDate(startDate);
  return `${formatNorwegianDate(startDate)} – ${formatNorwegianDate(endDate)}`;
}

function normalizeStatus(status) {
  return status
    .toLowerCase()
    .replace("ø", "o")
    .replace("å", "a")
    .replace("æ", "a");
}

function renderAbsences() {
  if (!absenceTableBody || !absenceSummary) return;

  const selected = absenceFilter?.value || "all";
  const allRecords = getAbsences().sort((a, b) => new Date(b.startDate) - new Date(a.startDate));
  const records = selected === "all"
    ? allRecords
    : allRecords.filter(record => record.name === selected);

  absenceTableBody.innerHTML = "";

  records.forEach(record => {
    const row = document.createElement("tr");
    const statusClass = `status-${normalizeStatus(record.status)}`;

    row.innerHTML = `
      <td><strong>${record.name}</strong></td>
      <td class="absence-type">${record.type}</td>
      <td>${formatDateRange(record.startDate, record.endDate)}</td>
      <td>${record.days}</td>
      <td>${record.hours || ""}</td>
      <td><span class="status-pill ${statusClass}">${record.status}</span></td>
      <td>${record.note || ""}</td>
      <td><button class="delete-row" data-absence-id="${record.id}">Slett</button></td>
    `;

    absenceTableBody.appendChild(row);
  });

  renderAbsenceSummary(records);

  document.querySelectorAll("[data-absence-id]").forEach(button => {
    button.addEventListener("click", () => {
      const id = button.dataset.absenceId;
      const updated = getAbsences().filter(record => record.id !== id);
      saveAbsences(updated);
      renderAbsences();
    });
  });
}

function renderAbsenceSummary(records) {
  if (!absenceSummary) return;

  if (!records.length) {
    absenceSummary.innerHTML = `<p class="muted">Ingen føringer ennå.</p>`;
    return;
  }

  const totals = {};

  records.forEach(record => {
    if (!totals[record.name]) {
      totals[record.name] = {
        ferie: 0,
        avspaseringBrukt: 0,
        avspaseringOpptjent: 0,
        overtid: 0
      };
    }

    const hours = Number(record.hours || 0);

    if (record.type === "Ferie") totals[record.name].ferie += Number(record.days || 0);
    if (record.type === "Avspasering brukt") totals[record.name].avspaseringBrukt += hours;
    if (record.type === "Avspasering opptjent") totals[record.name].avspaseringOpptjent += hours;
    if (record.type === "Overtid") totals[record.name].overtid += hours;
  });

  absenceSummary.innerHTML = Object.entries(totals)
    .map(([name, total]) => {
      const avspaseringSaldo = Math.round((total.avspaseringOpptjent - total.avspaseringBrukt) * 100) / 100;

      return `
        <div class="summary-item">
          <strong>${name}</strong>
          <div class="summary-mini">
            <span>Ferie registrert: ${total.ferie} dager</span>
            <span>Avspasering saldo: ${avspaseringSaldo} timer</span>
            <span>Overtid registrert: ${Math.round(total.overtid * 100) / 100} timer</span>
          </div>
        </div>
      `;
    })
    .join("");
}

if (absenceForm) {
  const startDateInput = document.getElementById("absenceStartDate");
  const endDateInput = document.getElementById("absenceEndDate");

  const today = new Date().toISOString().slice(0, 10);
  startDateInput.value = today;
  endDateInput.value = today;

  startDateInput.addEventListener("change", () => {
    if (!endDateInput.value || endDateInput.value < startDateInput.value) {
      endDateInput.value = startDateInput.value;
    }
  });

  absenceForm.addEventListener("submit", event => {
    event.preventDefault();

    const name = document.getElementById("absenceName").value;
    const type = document.getElementById("absenceType").value;
    const startDate = document.getElementById("absenceStartDate").value;
    const endDate = document.getElementById("absenceEndDate").value;
    const hours = document.getElementById("absenceHours").value;
    const status = document.getElementById("absenceStatus").value;
    const note = document.getElementById("absenceNote").value.trim();
    const days = countWeekdays(startDate, endDate);

    const record = {
      id: crypto.randomUUID(),
      name,
      type,
      startDate,
      endDate,
      days,
      hours,
      status,
      note
    };

    const records = getAbsences();
    records.push(record);
    saveAbsences(records);

    absenceForm.reset();
    document.getElementById("absenceStartDate").value = today;
    document.getElementById("absenceEndDate").value = today;

    renderAbsences();
  });
}

if (absenceFilter) {
  absenceFilter.addEventListener("change", renderAbsences);
}

if (clearAbsences) {
  clearAbsences.addEventListener("click", () => {
    localStorage.removeItem(absenceStorageKey);
    renderAbsences();
  });
}

renderAbsences();

/* ===== KJØKKENBOKA ===== */

const noteForm = document.getElementById("noteForm");
const noteFeed = document.getElementById("noteFeed");
const noteCategoryFilter = document.getElementById("noteCategoryFilter");
const noteSearch = document.getElementById("noteSearch");
const clearNotes = document.getElementById("clearNotes");
const noteCount = document.getElementById("noteCount");

const noteStorageKey = "kbfb-kjokkenboka";

function getNotes() {
  return JSON.parse(localStorage.getItem(noteStorageKey) || "[]");
}

function saveNotes(notes) {
  localStorage.setItem(noteStorageKey, JSON.stringify(notes));
}

function getCategoryIcon(category) {
  const icons = {
    Viktig: "📌",
    Møte: "📅",
    Personal: "👥",
    Barn: "🧒",
    Tur: "🏕️",
    Praktisk: "🔧"
  };

  return icons[category] || "📖";
}

function normalizeClass(text) {
  return text
    .toLowerCase()
    .replace("ø", "o")
    .replace("å", "a")
    .replace("æ", "a");
}

function renderNotes() {
  if (!noteFeed) return;

  const category = noteCategoryFilter?.value || "all";
  const search = (noteSearch?.value || "").toLowerCase();

  let notes = getNotes().sort((a, b) => {
    const aDate = `${a.date} ${a.time || "00:00"}`;
    const bDate = `${b.date} ${b.time || "00:00"}`;
    return new Date(bDate) - new Date(aDate);
  });

  notes = notes.filter(note => {
    const matchesCategory = category === "all" || note.category === category;
    const matchesSearch =
      note.text.toLowerCase().includes(search) ||
      note.author.toLowerCase().includes(search) ||
      note.category.toLowerCase().includes(search);

    return matchesCategory && matchesSearch;
  });

  if (noteCount) {
    noteCount.textContent = `${notes.length} ${notes.length === 1 ? "beskjed" : "beskjeder"}`;
  }

  if (!notes.length) {
    noteFeed.innerHTML = `<p class="muted">Ingen beskjeder å vise.</p>`;
    return;
  }

  noteFeed.innerHTML = notes.map(note => `
    <article class="note-card ${normalizeClass(note.category)}">
      <div class="note-top">
        <div class="note-meta">
          <span class="note-author">${note.author}</span>
          <span class="note-date">${formatNorwegianDate(note.date)}${note.time ? ` kl. ${note.time}` : ""}</span>
          <span class="note-category">${getCategoryIcon(note.category)} ${note.category}</span>
        </div>

        <button class="note-delete" data-note-id="${note.id}">Slett</button>
      </div>

      <p class="note-text">${note.text}</p>
    </article>
  `).join("");

  document.querySelectorAll("[data-note-id]").forEach(button => {
    button.addEventListener("click", () => {
      const id = button.dataset.noteId;
      const updated = getNotes().filter(note => note.id !== id);
      saveNotes(updated);
      renderNotes();
    });
  });
}

if (noteForm) {
  const noteDate = document.getElementById("noteDate");
  if (noteDate) noteDate.value = new Date().toISOString().slice(0, 10);

  noteForm.addEventListener("submit", event => {
    event.preventDefault();

    const note = {
      id: crypto.randomUUID(),
      author: document.getElementById("noteAuthor").value,
      date: document.getElementById("noteDate").value,
      category: document.getElementById("noteCategory").value,
      time: document.getElementById("noteTime").value,
      text: document.getElementById("noteText").value.trim()
    };

    const notes = getNotes();
    notes.push(note);
    saveNotes(notes);

    noteForm.reset();
    document.getElementById("noteDate").value = new Date().toISOString().slice(0, 10);

    renderNotes();
  });
}

if (noteCategoryFilter) {
  noteCategoryFilter.addEventListener("change", renderNotes);
}

if (noteSearch) {
  noteSearch.addEventListener("input", renderNotes);
}

if (clearNotes) {
  clearNotes.addEventListener("click", () => {
    localStorage.removeItem(noteStorageKey);
    renderNotes();
  });
}

renderNotes();

/* ===== ENKEL KJØKKENBOK ===== */

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

function formatKitchenDate(dateString) {
  return new Date(dateString + "T12:00:00").toLocaleDateString("no-NO", {
    weekday: "long",
    day: "numeric",
    month: "long"
  });
}

function renderQuickNotes() {
  if (!quickNoteFeed) return;

  const notes = getQuickNotes().sort((a, b) => {
    return new Date(b.date) - new Date(a.date);
  });

  if (!notes.length) {
    quickNoteFeed.innerHTML = `<p class="muted">Ingen beskjeder ennå.</p>`;
    return;
  }

  const grouped = {};

  notes.forEach(note => {
    if (!grouped[note.date]) grouped[note.date] = [];
    grouped[note.date].push(note);
  });

  quickNoteFeed.innerHTML = Object.entries(grouped)
    .map(([date, dayNotes]) => `
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
    `)
    .join("");

  document.querySelectorAll("[data-quick-note-id]").forEach(button => {
    button.addEventListener("click", () => {
      const id = button.dataset.quickNoteId;
      const updated = getQuickNotes().filter(note => note.id !== id);
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
