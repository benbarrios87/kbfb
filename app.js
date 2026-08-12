/* ===== KBFB PERSONAL - REN APP.JS ===== */

/* ---------- HJELPEFUNKSJONER ---------- */

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

// Declared this early (not down by the rest of the vikarer.html code) because
// dashboard.html's updateDashboardWeek() -> renderDashboardSubs() reads it
// synchronously at page-load time, before the script has reached that part
// of the file - same reason notesCache lives up here too.
let subsCache = [];
let subPeopleCache = [];

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
  return employeesCache;
}
function populateEmployeeSelect(selectId, options = {}) {

  const select = document.getElementById(selectId);
  if (!select) return;

  const {
    includeBlank = true,
    blankText = "Velg ansatt",
    includeAll = false
  } = options;

  select.innerHTML = "";

  if (includeAll) {
    select.innerHTML += `<option value="all">Alle</option>`;
  }

  if (includeBlank) {
    select.innerHTML += `<option value="">${blankText}</option>`;
  }

  employeesCache.forEach(employee => {
    select.innerHTML += `
      <option value="${employee.name}">
        ${employee.name}
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

const shiftValues = ["", "TV", "TM", "MV", "SM", "SV", "F", "AVS", "TJ", "PERM", "MØTE", "ANNET"];

function getCurrentWeekKey() {
  return toDateKey(viewedWeekStart);
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
  if (value === "F" || value === "AVS" || value === "TJ" || value === "PERM") return "free";
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
  const isAdmin = typeof currentEmployee !== "undefined" &&
    !!(currentEmployee?.is_admin || currentEmployee?.role === "Avdelingsleder");

  const shiftEditHelp = document.getElementById("shiftEditHelp");
  if (shiftEditHelp) shiftEditHelp.style.display = isAdmin ? "" : "none";

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
      badge.className = `badge ${getShiftSelectClass(defaultValue)}`;
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
  updateShiftHeadcounts();
  renderWeekEvents();
  populateSwapWithSelect();
  loadSwapInbox();
}

const absenceShiftCodes = ["F", "AVS", "TJ", "PERM"];

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

/* ---------- VAKTBYTTE ---------- */

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
        <strong>${req.from_employee} vil bytte vakt med deg ${formatNorwegianDate(actualDate)}</strong>
        <span>${req.from_employee} har: ${req.from_shift_value || "—"} · Du har: ${req.to_shift_value || "—"}</span>
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
      const { error } = await supabaseClient.rpc("kbfb_accept_shift_swap", { request_id: button.dataset.acceptSwap });

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
      ? `<span class="muted">Grunn: ${req.decline_reason}</span>`
      : "";

    return `
      <div class="summary-item">
        <strong>Bytte med ${req.to_employee} ${formatNorwegianDate(actualDate)}</strong>
        <span>${swapStatusLabel[req.status] || req.status}</span>
        ${reasonLine}
      </div>
    `;
  }).join("");
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

function canDeleteNote(note) {
  const isAdmin = typeof currentEmployee !== "undefined" && !!currentEmployee?.is_admin;
  const isAuthor = typeof currentEmployee !== "undefined" && currentEmployee?.name === note.author;
  return isAdmin || isAuthor;
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

  quickNoteFeed.innerHTML = dayNamesLong.map((dayName, dayIndex) => {
    const date = addDays(kitchenViewedWeekStart, dayIndex);
    const dateKey = toDateKey(date);
    const dayNotes = notesCache.filter(note => note.date === dateKey);

    return `
      <div class="kitchen-day">
        <h3>${dayName}<span class="kitchen-day-date">${formatShortDate(date)}</span></h3>

        ${dayNotes.length ? dayNotes.map(note => `
          <article class="kitchen-entry">
            <div class="kitchen-entry-top">
              <strong>${note.author}</strong>
              ${canDeleteNote(note) ? `<button class="kitchen-delete" data-quick-note-id="${note.id}">Slett</button>` : ""}
            </div>
            <p>${note.text}</p>
          </article>
        `).join("") : `<p class="muted">Ingen beskjeder.</p>`}
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
}

const kitchenPrevWeek = document.getElementById("kitchenPrevWeek");
const kitchenNextWeek = document.getElementById("kitchenNextWeek");
const kitchenCurrentWeek = document.getElementById("kitchenCurrentWeek");

if (kitchenPrevWeek) {
  kitchenPrevWeek.addEventListener("click", () => {
    kitchenViewedWeekStart = addWeeks(kitchenViewedWeekStart, -1);
    renderQuickNotes();
  });
}

if (kitchenNextWeek) {
  kitchenNextWeek.addEventListener("click", () => {
    kitchenViewedWeekStart = addWeeks(kitchenViewedWeekStart, 1);
    renderQuickNotes();
  });
}

if (kitchenCurrentWeek) {
  kitchenCurrentWeek.addEventListener("click", () => {
    kitchenViewedWeekStart = getMonday(new Date());
    renderQuickNotes();
  });
}

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

    await saveNoteToSupabase(note);
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
                <strong>${shortDate(event.date)} · ${event.title}</strong>
                <span>${categoryEmoji(event.category)} ${categoryLabel(event.category)}${event.note ? ` · ${event.note}` : ""}</span>
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
      <td>${typeof currentEmployee !== "undefined" && currentEmployee?.is_admin ? `<button class="kitchen-delete" data-sub-id="${sub.id}">Slett</button>` : ""}</td>
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
    subDate.value = toDateKey(new Date());
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
  renderDashboardSubs();
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

function renderVacationQuotaEditor() {
  const container = document.getElementById("vacationQuotaList");
  if (!container) return;

  container.innerHTML = employeesCache.map(employee => `
    <div class="summary-item">
      <strong>${employee.name}</strong>
      <span>
        Feriedager:
        <input type="number" min="0" step="1" class="vacation-days-input" data-employee="${employee.name}" value="${getVacationDaysFor(employee.name)}" style="width:60px;" />
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

function getFilteredAbsences() {
  const selected = absenceFilter?.value || "all";

  return absencesCache.filter(record =>
    selected === "all" || record.name === selected
  );
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
      <strong>${name} · ${info.hours} t</strong>
      <span>${info.entries
        .map(entry => `${formatDateRange(entry.start_date, entry.end_date)}${entry.note ? ` · ${entry.note}` : ""}`)
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
      <td>${record.name}</td>
      <td>${record.type}</td>
      <td>${formatDateRange(record.start_date, record.end_date)}</td>
      <td>${countWeekdays(record.start_date, record.end_date)}</td>
      <td>${record.hours || ""}</td>
      <td>${record.status || "Registrert"}</td>
      <td>${record.note || ""}</td>
      <td>
        ${isAdmin && record.status === "Ønsket" ? `
          <button class="secondary-btn" data-approve-id="${record.id}">Godkjenn</button>
          <button class="secondary-btn" data-reject-id="${record.id}">Avslå</button>
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
      renderDashboardAbsences();
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
      renderDashboardAbsences();
    });
  });

  document.querySelectorAll("[data-reject-id]").forEach(button => {
    button.addEventListener("click", async () => {
      await updateAbsenceStatusInSupabase(button.dataset.rejectId, "Avslått");
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
        tjenestefri: 0,
        avsOpptjent: 0,
        avsBrukt: 0,
        overtid: 0,
        permisjonMed: 0,
        permisjonUten: 0,
        velferd: 0
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

        <div>🏡 Tjenestefri: <strong>${t.tjenestefri}</strong> dager</div>

        <div>💰 Overtid: <strong>${t.overtid.toFixed(1)}</strong> t</div>

        <div>📄 Permisjon m/lønn: <strong>${t.permisjonMed}</strong> dager</div>

        <div>📄 Permisjon u/lønn: <strong>${t.permisjonUten}</strong> dager</div>

        <div>❤️ Velferd: <strong>${t.velferd}</strong> dager</div>

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

const noApprovalNeededTypes = ["Overtid", "Avspasering brukt", "Avspasering opptjent"];

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
}

if (absenceType) {
  absenceType.addEventListener("change", updateAbsenceStatusVisibility);
  updateAbsenceStatusVisibility();
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
    renderDashboardAbsences();
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

  if (!currentEmployee.is_admin) {
    absenceFilter.innerHTML = `<option value="${currentEmployee.name}">${currentEmployee.name}</option>`;
    absenceFilter.value = currentEmployee.name;
    absenceFilter.disabled = true;
  } else {
    absenceFilter.disabled = false;
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

  renderAbsences();
  renderDashboardAbsences();
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
      <td><strong>${employee.name}</strong></td>
      <td>
        <input type="text" class="admin-field" data-id="${employee.id}" data-field="role" value="${employee.role || ""}" style="width: 140px;" />
      </td>
      <td>
        <input type="text" class="admin-field" data-id="${employee.id}" data-field="department" value="${employee.department || ""}" style="width: 130px;" />
      </td>
      <td style="text-align: center;">
        <input type="checkbox" class="admin-field" data-id="${employee.id}" data-field="is_admin" ${employee.is_admin ? "checked" : ""} />
      </td>
      <td style="text-align: center;">
        <input type="checkbox" class="admin-field" data-id="${employee.id}" data-field="active" ${employee.active ? "checked" : ""} />
      </td>
      <td>
        <input type="text" class="admin-field" data-id="${employee.id}" data-field="user_id" value="${employee.user_id || ""}" placeholder="Ikke koblet ennå" style="width: 260px; font-family: monospace; font-size: 0.85rem;" />
      </td>
      <td>
        ${employee.user_id ? `
          <div style="display: flex; gap: 6px;">
            <input type="text" class="reset-password-input" data-id="${employee.id}" placeholder="Nytt passord" style="width: 130px;" />
            <button type="button" class="secondary-btn reset-password-btn" data-id="${employee.id}">Nullstill</button>
          </div>
        ` : `<span class="muted">Ikke koblet</span>`}
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
      <strong>${record.name} · ${record.type}</strong>
      <span>${formatDateRange(record.start_date, record.end_date)}${record.note ? ` · ${record.note}` : ""}</span>
    </div>
  `).join("");
}

async function initializeAdmin() {
  if (!adminEmployeeTableBody) return;

  await loadAllEmployeesForAdmin();
  renderAdminEmployeeTable();
  loadPendingApprovalsSummary();
  loadFeedbackForAdmin();
}

initializeAdmin();

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
      <strong>${item.name} · ${formatNorwegianDate(item.created_at.slice(0, 10))}</strong>
      <span>${item.text}</span>
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

// Swaps the initial-letter placeholder avatars on the schedule grid for
// real photos, for anyone who has uploaded one.
async function applyEmployeeAvatarsToGrid() {
  const { data, error } = await supabaseClient
    .from("kbfb_employees")
    .select("name, avatar_url")
    .not("avatar_url", "is", null);

  if (error) {
    console.error("Kunne ikke hente profilbilder:", error);
    return;
  }

  const avatarByName = {};
  data.forEach(emp => { avatarByName[emp.name] = emp.avatar_url; });

  document.querySelectorAll(".department-table tbody tr[data-employee]").forEach(row => {
    const url = avatarByName[row.dataset.employee];
    const avatarSpan = row.querySelector(".person .avatar");
    if (!avatarSpan || !url) return;

    avatarSpan.style.backgroundImage = `url(${url})`;
    avatarSpan.textContent = "";
  });
}

if (avatarUploadInput) {
  avatarUploadInput.addEventListener("change", async () => {
    if (!avatarUploadStatus || typeof currentEmployee === "undefined" || !currentEmployee) return;

    const file = avatarUploadInput.files?.[0];
    if (!file) return;

    avatarUploadStatus.textContent = "Laster opp...";

    const fileExt = file.name.split(".").pop();
    const filePath = `${currentEmployee.id}.${fileExt}`;

    const { error: uploadError } = await supabaseClient.storage
      .from("avatars")
      .upload(filePath, file, { upsert: true });

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
    renderMyAvatarPreview();
    applyEmployeeAvatarsToGrid();
    avatarUploadStatus.textContent = "Bilde lagret ✓";
  });
}

/* ---------- BESTILLINGER ---------- */

const supplyForm = document.getElementById("supplyForm");
const supplyItem = document.getElementById("supplyItem");
const supplyOpenList = document.getElementById("supplyOpenList");
const supplyOrderedList = document.getElementById("supplyOrderedList");
const supplyOrderedSection = document.getElementById("supplyOrderedSection");

let suppliesCache = [];

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
  const open = suppliesCache.filter(s => !s.ordered);
  const ordered = suppliesCache.filter(s => s.ordered);

  supplyOpenList.innerHTML = open.length
    ? open.map(s => `
      <div class="summary-item">
        <strong>${s.item}</strong>
        <span>Meldt av ${s.requested_by}</span>
        ${isAdmin ? `
          <div style="display: flex; gap: 8px; margin-top: 6px;">
            <button class="secondary-btn" type="button" data-mark-ordered="${s.id}">Bestilt ✓</button>
            <button class="secondary-btn" type="button" data-delete-supply="${s.id}">Fjern</button>
          </div>
        ` : ""}
      </div>
    `).join("")
    : `<p class="muted">Ingenting meldt inn ennå.</p>`;

  if (supplyOrderedSection) {
    supplyOrderedSection.style.display = ordered.length ? "" : "none";
  }

  if (supplyOrderedList) {
    supplyOrderedList.innerHTML = ordered.map(s => `
      <div class="summary-item">
        <strong>${s.item}</strong>
        <span>Meldt av ${s.requested_by} · Bestilt ✓</span>
        ${isAdmin ? `<button class="secondary-btn" type="button" data-delete-supply="${s.id}" style="margin-top: 6px; width: fit-content;">Fjern</button>` : ""}
      </div>
    `).join("");
  }

  document.querySelectorAll("[data-mark-ordered]").forEach(button => {
    button.addEventListener("click", async () => {
      button.disabled = true;
      const { error } = await supabaseClient
        .from("kbfb_supplies")
        .update({ ordered: true, ordered_at: new Date().toISOString() })
        .eq("id", button.dataset.markOrdered);

      if (error) {
        alert("Kunne ikke merke som bestilt: " + error.message);
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
      .insert([{ item: supplyItem.value.trim(), requested_by: currentEmployee.name }]);

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
