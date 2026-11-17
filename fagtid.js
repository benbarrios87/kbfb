/* ===== KBFB PERSONAL - FAGTID.JS =====
   Fagtid / assistenttreff. Lastes etter app.js.

   - Anonym undersøkelse: de ansatte velger temaer selv. Svaret lagres i
     kbfb_fagtid_svar UTEN navn (se add-fagtid.sql).
   - Admin ser opptelling og fritekstsvar, og kan slette alle svar for å
     starte en ny runde.
   - Kjøreplanen for treffet er statisk tekst i fagtid.html (admin-only). */

(function () {
  const app = document.getElementById("fagtidApp");
  if (!app) return;

  const TABLE = "kbfb_fagtid_svar";
  const MAX_TOPICS = 3;
  const ANSWERED_KEY = "kbfb_fagtid_besvart";

  const TOPICS = [
    "Barn som utfordrer oss (uro, utagering, barn som trekker seg unna)",
    "Foreldresamarbeid (vanskelige samtaler, levering og henting)",
    "Lek: komme inn i leken og hjelpe barn som står utenfor",
    "Overganger og rutiner (påkledning, måltid, hvile)",
    "Språk i hverdagen",
    "Samarbeid i personalgruppa"
  ];

  const LEARNING = [
    "Snakke i par eller små grupper",
    "Høre et kort innlegg",
    "Se på filmklipp eller eksempler",
    "Prøve noe praktisk"
  ];

  const esc = value => (typeof escapeHtml === "function" ? escapeHtml(value) : String(value ?? ""));
  const $ = selector => document.querySelector(selector);

  function waitForEmployee() {
    return new Promise(resolve => {
      const timer = setInterval(() => {
        if (typeof currentEmployee !== "undefined" && currentEmployee) {
          clearInterval(timer);
          resolve(currentEmployee);
        }
      }, 80);
      setTimeout(() => { clearInterval(timer); resolve(null); }, 15000);
    });
  }

  function readFlag() {
    try { return localStorage.getItem(ANSWERED_KEY) === "1"; } catch (e) { return false; }
  }

  function writeFlag(value) {
    try {
      if (value) localStorage.setItem(ANSWERED_KEY, "1");
      else localStorage.removeItem(ANSWERED_KEY);
    } catch (e) { /* privat modus o.l. - ikke viktig */ }
  }

  function renderOptions(container, items, name) {
    container.innerHTML = items.map((text, index) => `
      <label class="fagtid-option">
        <input type="checkbox" name="${name}" value="${esc(text)}" id="${name}${index}" />
        <span>${esc(text)}</span>
      </label>`).join("");
  }

  function checkedValues(name) {
    return Array.from(document.querySelectorAll(`input[name="${name}"]:checked`)).map(input => input.value);
  }

  /* ---------- Undersøkelsen ---------- */

  function showAnswered(answered) {
    $("#fagtidAlreadyAnswered").hidden = !answered;
    $("#fagtidForm").hidden = answered;
  }

  function enforceTopicLimit() {
    const boxes = Array.from(document.querySelectorAll('input[name="fagtidTopic"]'));
    const count = boxes.filter(box => box.checked).length;
    boxes.forEach(box => { box.disabled = !box.checked && count >= MAX_TOPICS; });
    $("#fagtidTopicLimit").hidden = count < MAX_TOPICS;
  }

  async function submitSurvey(event) {
    event.preventDefault();
    const status = $("#fagtidStatus");
    const button = $("#fagtidSubmit");

    const answer = {
      temaer: checkedValues("fagtidTopic").slice(0, MAX_TOPICS),
      annet_tema: $("#fagtidOtherTopic").value.trim() || null,
      situasjon: $("#fagtidSituation").value.trim() || null,
      laeringsform: checkedValues("fagtidLearning"),
      class_tanker: $("#fagtidClass").value.trim() || null,
      nyttig_mote: $("#fagtidUseful").value.trim() || null
    };

    const isEmpty = !answer.temaer.length && !answer.annet_tema && !answer.situasjon &&
      !answer.laeringsform.length && !answer.class_tanker && !answer.nyttig_mote;
    if (isEmpty) {
      status.textContent = "Svar på minst ett av spørsmålene før du sender.";
      return;
    }

    button.disabled = true;
    status.textContent = "Sender...";

    const { error } = await supabaseClient.from(TABLE).insert(answer);

    button.disabled = false;
    if (error) {
      console.error("Fagtid: kunne ikke lagre svar", error);
      status.textContent = "Noe gikk galt, svaret ble ikke sendt. Prøv igjen.";
      return;
    }

    status.textContent = "";
    $("#fagtidForm").reset();
    enforceTopicLimit();
    writeFlag(true);
    showAnswered(true);
    if (currentEmployee && currentEmployee.is_admin) loadResults();
  }

  /* ---------- Resultater (admin) ---------- */

  function countValues(rows, field) {
    const counts = new Map();
    rows.forEach(row => (row[field] || []).forEach(value => counts.set(value, (counts.get(value) || 0) + 1)));
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }

  function barList(entries, total) {
    if (!entries.length) return '<p class="muted">Ingen har valgt noe her ennå.</p>';
    const max = Math.max(...entries.map(entry => entry[1]));
    return `<ul class="fagtid-bars">${entries.map(([label, count]) => `
      <li>
        <div class="fagtid-bar-label"><span>${esc(label)}</span><strong>${count} av ${total}</strong></div>
        <div class="fagtid-bar"><span style="width:${Math.round((count / max) * 100)}%"></span></div>
      </li>`).join("")}</ul>`;
  }

  function textList(rows, field) {
    const texts = rows.map(row => row[field]).filter(Boolean);
    if (!texts.length) return '<p class="muted">Ingen svar her ennå.</p>';
    return `<ul class="fagtid-quotes">${texts.map(text => `<li>${esc(text)}</li>`).join("")}</ul>`;
  }

  async function loadResults() {
    const container = $("#fagtidResults");
    const { data, error } = await supabaseClient
      .from(TABLE)
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Fagtid: kunne ikke hente svar", error);
      container.innerHTML = '<p class="muted">Kunne ikke hente svarene.</p>';
      return;
    }

    const rows = data || [];
    $("#fagtidCount").textContent = rows.length === 1 ? "1 svar" : `${rows.length} svar`;

    if (!rows.length) {
      container.innerHTML = '<p class="muted">Ingen svar ennå. Del lenken til denne siden med de ansatte.</p>';
      return;
    }

    container.innerHTML = `
      <div class="fagtid-result-block">
        <h3>Temaer de vil ha</h3>
        ${barList(countValues(rows, "temaer"), rows.length)}
        <h4>Egne temaer</h4>
        ${textList(rows, "annet_tema")}
      </div>
      <div class="fagtid-result-block">
        <h3>Konkrete situasjoner de vil ha hjelp til</h3>
        ${textList(rows, "situasjon")}
      </div>
      <div class="fagtid-result-block">
        <h3>Hvordan de lærer best</h3>
        ${barList(countValues(rows, "laeringsform"), rows.length)}
      </div>
      <div class="fagtid-result-block">
        <h3>Tanker om CLASS</h3>
        ${textList(rows, "class_tanker")}
      </div>
      <div class="fagtid-result-block">
        <h3>Hva gjør et møte nyttig</h3>
        ${textList(rows, "nyttig_mote")}
      </div>`;
  }

  async function clearResults() {
    const ok = confirm("Slette ALLE svar på undersøkelsen? Dette kan ikke angres. Gjør dette bare når du vil starte en ny runde.");
    if (!ok) return;
    const { error } = await supabaseClient.from(TABLE).delete().not("id", "is", null);
    if (error) {
      console.error("Fagtid: kunne ikke slette svar", error);
      alert("Kunne ikke slette svarene.");
      return;
    }
    writeFlag(false);
    showAnswered(false);
    loadResults();
  }

  /* ---------- Oppstart ---------- */

  async function init() {
    renderOptions($("#fagtidTopics"), TOPICS, "fagtidTopic");
    renderOptions($("#fagtidLearning"), LEARNING, "fagtidLearning");

    $("#fagtidTopics").addEventListener("change", enforceTopicLimit);
    $("#fagtidForm").addEventListener("submit", submitSurvey);
    $("#fagtidAnswerAgain").addEventListener("click", () => showAnswered(false));
    const employee = await waitForEmployee();
    if (!employee) return;

    // Bare assistenter kan svare (håndheves også i RLS, se add-fagtid.sql).
    const isAssistant = employee.role === "Assistent";
    if (isAssistant) {
      showAnswered(readFlag());
    } else if (employee.is_admin) {
      // Admin ser skjemaet slik assistentene ser det, men kan ikke sende.
      $("#fagtidNotForYou").hidden = false;
      $("#fagtidNotForYou").textContent = "Forhåndsvisning: bare assistenter kan sende inn svar. Slik ser skjemaet ut for dem.";
      $("#fagtidSubmit").disabled = true;
      $("#fagtidForm").hidden = false;
    } else {
      $("#fagtidNotForYou").hidden = false;
    }

    if (!employee.is_admin) return;

    $("#fagtidRefresh").addEventListener("click", loadResults);
    $("#fagtidClear").addEventListener("click", clearResults);
    $("#fagtidPrint").addEventListener("click", () => {
      $("#fagtidPlanCard").open = true;
      document.body.classList.add("fagtid-printing");
      window.print();
      setTimeout(() => document.body.classList.remove("fagtid-printing"), 500);
    });
    loadResults();
  }

  init();
})();
