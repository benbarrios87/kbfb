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

const employeeFilter = document.getElementById("employeeFilter");
const departmentFilter = document.getElementById("departmentFilter");

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
