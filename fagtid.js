/* ===== KBFB PERSONAL - FAGTID.JS =====
   Fagtid / assistenttreff. Lastes etter app.js. Tabeller: se add-fagtid.sql.

   Fase 1 - Undersøkelse: anonym, bare assistenter kan svare. Admin skrur
            den av/på (kbfb_fagtid_innstillinger).
   Fase 2 - Løypa: admin legger inn treff (tema, CLASS-fokus, hva vi gjorde,
            neste gang, lekse). Alle ansatte kan lese. Assistentene kan legge
            igjen korte highlights (sitater med navn) på hvert treff.
            Er Sommerfuglen og Regnbuen på ulike steder, vises to kolonner. */

(function () {
  const app = document.getElementById("fagtidApp");
  if (!app) return;

  const T_SVAR = "kbfb_fagtid_svar";
  const T_INNST = "kbfb_fagtid_innstillinger";
  const T_TREFF = "kbfb_fagtid_treff";
  const T_HL = "kbfb_fagtid_highlights";
  const MAX_TOPICS = 3;
  const ANSWERED_KEY = "kbfb_fagtid_besvart";

  const TOPICS = [
    "Barn som utfordrer oss (uro, utagering, barn som trekker seg unna)",
    "Konflikter mellom barn",
    "Foreldresamarbeid (vanskelige samtaler, levering og henting)",
    "Lek: komme inn i leken og hjelpe barn som står utenfor",
    "Overganger og rutiner (påkledning, måltid, hvile)",
    "Tilvenning og nye barn",
    "Barn som trenger litt ekstra",
    "Språk i hverdagen",
    "Utelek og friluftsliv",
    "Samarbeid i personalgruppa"
  ];

  const LEARNING = [
    "Snakke i par eller små grupper",
    "Høre et kort innlegg",
    "Se på filmklipp eller eksempler",
    "Prøve noe praktisk"
  ];

  const MONTHS = ["januar", "februar", "mars", "april", "mai", "juni", "juli", "august", "september", "oktober", "november", "desember"];
  const DAYS = ["søndag", "mandag", "tirsdag", "onsdag", "torsdag", "fredag", "lørdag"];

  const state = {
    employee: null,
    isAdmin: false,
    isAssistant: false,
    surveyOpen: false,
    treff: [],
    highlights: {},   // treff_id -> [highlight]
    editingId: null
  };

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

  function formatDate(dateKey) {
    if (!dateKey) return "";
    const [y, m, d] = dateKey.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    const sameYear = y === new Date().getFullYear();
    return `${DAYS[date.getDay()]} ${d}. ${MONTHS[m - 1]}${sameYear ? "" : " " + y}`;
  }

  function todayKey() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  }

  const multiline = text => esc(text).replace(/\n/g, "<br>");

  /* =========================================================
     Undersøkelsen
     ========================================================= */

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

  function enforceTopicLimit() {
    const boxes = Array.from(document.querySelectorAll('input[name="fagtidTopic"]'));
    const count = boxes.filter(box => box.checked).length;
    boxes.forEach(box => { box.disabled = !box.checked && count >= MAX_TOPICS; });
    $("#fagtidTopicLimit").hidden = count < MAX_TOPICS;
  }

  function showAnswered(answered) {
    $("#fagtidAlreadyAnswered").hidden = !answered;
    $("#fagtidForm").hidden = answered;
  }

  function renderSurvey() {
    $("#fagtidSurveyCard").hidden = !state.surveyOpen;
    if (!state.surveyOpen) return;

    if (state.isAssistant) {
      $("#fagtidNotForYou").hidden = true;
      showAnswered(readFlag());
    } else if (state.isAdmin) {
      $("#fagtidNotForYou").hidden = false;
      $("#fagtidNotForYou").textContent = "Forhåndsvisning: bare assistenter kan sende inn svar. Slik ser skjemaet ut for dem.";
      $("#fagtidSubmit").disabled = true;
      $("#fagtidAlreadyAnswered").hidden = true;
      $("#fagtidForm").hidden = false;
    } else {
      $("#fagtidNotForYou").hidden = false;
      $("#fagtidAlreadyAnswered").hidden = true;
      $("#fagtidForm").hidden = true;
    }
  }

  async function submitSurvey(event) {
    event.preventDefault();
    const status = $("#fagtidStatus");
    const button = $("#fagtidSubmit");

    const answer = {
      krevende: $("#fagtidKrevende").value.trim() || null,
      temaer: checkedValues("fagtidTopic").slice(0, MAX_TOPICS),
      annet_tema: $("#fagtidOtherTopic").value.trim() || null,
      traff_godt: $("#fagtidTraff").value.trim() || null,
      situasjon: $("#fagtidSituation").value.trim() || null,
      laeringsform: checkedValues("fagtidLearning"),
      nyttig_mote: $("#fagtidUseful").value.trim() || null
    };

    const isEmpty = !answer.krevende && !answer.temaer.length && !answer.annet_tema && !answer.traff_godt &&
      !answer.situasjon && !answer.laeringsform.length && !answer.nyttig_mote;
    if (isEmpty) {
      status.textContent = "Svar på minst ett av spørsmålene før du sender.";
      return;
    }

    button.disabled = true;
    status.textContent = "Sender...";
    const { error } = await supabaseClient.from(T_SVAR).insert(answer);
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
    const { data, error } = await supabaseClient.from(T_SVAR).select("*").order("created_at", { ascending: false });

    if (error) {
      console.error("Fagtid: kunne ikke hente svar", error);
      container.innerHTML = '<p class="muted">Kunne ikke hente svarene.</p>';
      return;
    }

    const rows = data || [];
    $("#fagtidCount").textContent = rows.length === 1 ? "1 svar" : `${rows.length} svar`;

    if (!rows.length) {
      container.innerHTML = '<p class="muted">Ingen svar ennå.</p>';
      return;
    }

    const block = (title, body) => `<div class="fagtid-result-block"><h3>${title}</h3>${body}</div>`;
    container.innerHTML = [
      block("Temaer de vil jobbe med", barList(countValues(rows, "temaer"), rows.length) + "<h4>Egne temaer</h4>" + textList(rows, "annet_tema")),
      block("Mest krevende i hverdagen nå", textList(rows, "krevende")),
      block("Når de traff et barn godt", textList(rows, "traff_godt")),
      block("Konkrete situasjoner de vil ha hjelp til", textList(rows, "situasjon")),
      block("Hvordan de lærer best", barList(countValues(rows, "laeringsform"), rows.length)),
      block("Dette skal til for at de tar det med ut på avdelingen", textList(rows, "nyttig_mote"))
    ].join("");
  }

  async function clearResults() {
    const ok = confirm("Slette ALLE svar på undersøkelsen? Dette kan ikke angres. Gjør dette bare når du vil starte en ny runde.");
    if (!ok) return;
    const { error } = await supabaseClient.from(T_SVAR).delete().not("id", "is", null);
    if (error) {
      console.error("Fagtid: kunne ikke slette svar", error);
      alert("Kunne ikke slette svarene.");
      return;
    }
    loadResults();
  }

  /* ---------- Av/på-bryter ---------- */

  async function loadSettings() {
    const { data, error } = await supabaseClient.from(T_INNST).select("undersokelse_aapen").eq("id", 1).maybeSingle();
    if (error) console.error("Fagtid: kunne ikke hente innstillinger", error);
    state.surveyOpen = data ? !!data.undersokelse_aapen : true;
    const toggle = $("#fagtidSurveyToggle");
    if (toggle) toggle.checked = state.surveyOpen;
    renderSurvey();
  }

  async function toggleSurvey(event) {
    const open = event.target.checked;
    const { error } = await supabaseClient.from(T_INNST).update({ undersokelse_aapen: open }).eq("id", 1);
    if (error) {
      console.error("Fagtid: kunne ikke endre bryter", error);
      alert("Kunne ikke lagre endringen.");
      event.target.checked = !open;
      return;
    }
    state.surveyOpen = open;
    renderSurvey();
  }

  /* =========================================================
     Løypa
     ========================================================= */

  async function loadTreff() {
    const [treffRes, hlRes] = await Promise.all([
      supabaseClient.from(T_TREFF).select("*").order("dato", { ascending: false }).order("created_at", { ascending: false }),
      supabaseClient.from(T_HL).select("*").order("created_at", { ascending: true })
    ]);

    if (treffRes.error) console.error("Fagtid: kunne ikke hente treff", treffRes.error);
    if (hlRes.error) console.error("Fagtid: kunne ikke hente highlights", hlRes.error);

    state.treff = treffRes.data || [];
    state.highlights = {};
    (hlRes.data || []).forEach(hl => {
      (state.highlights[hl.treff_id] = state.highlights[hl.treff_id] || []).push(hl);
    });
    renderLoype();
  }

  // treff er sortert nyest først, så "senest" = den som kommer først i lista.
  function later(a, b) {
    if (!a) return b;
    if (!b) return a;
    return state.treff.indexOf(a) <= state.treff.indexOf(b) ? a : b;
  }

  function currentColumns() {
    const first = avd => state.treff.find(t => t.avdeling === avd) || null;
    const felles = first("Felles");
    const sf = later(first("Sommerfuglen"), felles);
    const rb = later(first("Regnbuen"), felles);

    if (!sf && !rb) return [];
    if (sf === rb) return [{ label: null, treff: sf }];
    return [
      { label: "Sommerfuglen", treff: sf },
      { label: "Regnbuen", treff: rb }
    ];
  }

  function canWriteHighlight() {
    return state.isAssistant || state.isAdmin;
  }

  function highlightsHtml(treff) {
    const list = state.highlights[treff.id] || [];
    const me = state.employee ? state.employee.name : null;

    const quotes = list.length
      ? `<ul class="fagtid-highlights">${list.map(hl => `
          <li>
            <blockquote>«${esc(hl.tekst)}»</blockquote>
            <span class="fagtid-hl-author">${esc(hl.author)}</span>
            ${(state.isAdmin || hl.author === me) ? `<button type="button" class="fagtid-link-btn" data-action="delete-hl" data-id="${esc(hl.id)}">Slett</button>` : ""}
          </li>`).join("")}</ul>`
      : '<p class="muted fagtid-small">Ingen highlights ennå.</p>';

    const form = canWriteHighlight()
      ? `<form class="fagtid-hl-form" data-treff="${esc(treff.id)}">
           <input type="text" maxlength="300" placeholder="Noe du tok med deg? Skriv det kort her" required />
           <button type="submit" class="secondary-btn">Del</button>
         </form>`
      : "";

    return `<div class="fagtid-block">
      <h4>Dette tok vi med oss</h4>
      ${quotes}
      ${form}
    </div>`;
  }

  function treffHtml(treff, { compact = false } = {}) {
    const tag = `<span class="fagtid-tag fagtid-tag-${esc(treff.avdeling.toLowerCase())}">${esc(treff.avdeling)}</span>`;
    const adminButtons = state.isAdmin
      ? `<div class="fagtid-treff-admin">
           <button type="button" class="fagtid-link-btn" data-action="edit-treff" data-id="${esc(treff.id)}">Endre</button>
           <button type="button" class="fagtid-link-btn fagtid-danger" data-action="delete-treff" data-id="${esc(treff.id)}">Slett</button>
         </div>`
      : "";

    const section = (title, text, extraClass = "") => text
      ? `<div class="fagtid-block ${extraClass}"><h4>${title}</h4><p>${multiline(text)}</p></div>`
      : "";

    return `
      <article class="fagtid-treff${compact ? " compact" : ""}">
        <header>
          <p class="fagtid-treff-meta">${esc(formatDate(treff.dato))} ${tag}</p>
          <h3>${esc(treff.tema)}</h3>
          ${treff.class_fokus ? `<p class="fagtid-class-chip">CLASS-fokus: ${esc(treff.class_fokus)}</p>` : ""}
        </header>
        ${section("Dette jobbet vi med", treff.innhold)}
        ${highlightsHtml(treff)}
        ${section("Neste gang", treff.neste_gang)}
        ${section("Lekse til neste gang", treff.lekse, "fagtid-lekse")}
        ${adminButtons}
      </article>`;
  }

  function renderLoype() {
    const columns = currentColumns();
    const hasAny = state.treff.length > 0;

    $("#fagtidLoype").hidden = !hasAny;
    $("#fagtidEmpty").hidden = hasAny || state.surveyOpen;
    if (!hasAny) return;

    const current = $("#fagtidCurrent");
    current.classList.toggle("two", columns.length === 2);
    current.innerHTML = columns.map(col => `
      <div class="fagtid-column card">
        ${col.label ? `<p class="eyebrow fagtid-col-label">${esc(col.label)}</p>` : ""}
        ${col.treff ? treffHtml(col.treff) : '<p class="muted">Ingen treff ennå.</p>'}
      </div>`).join("");

    const shown = new Set(columns.map(col => col.treff && col.treff.id));
    const older = state.treff.filter(t => !shown.has(t.id));
    $("#fagtidArchiveCard").hidden = !older.length;
    $("#fagtidArchive").innerHTML = older.map(t => `
      <details class="fagtid-archive-item">
        <summary>${esc(formatDate(t.dato))} · <strong>${esc(t.tema)}</strong> <span class="fagtid-tag fagtid-tag-${esc(t.avdeling.toLowerCase())}">${esc(t.avdeling)}</span></summary>
        ${treffHtml(t, { compact: true })}
      </details>`).join("");
  }

  async function addHighlight(form) {
    const input = form.querySelector("input");
    const tekst = input.value.trim();
    if (!tekst || !state.employee) return;
    const button = form.querySelector("button");
    button.disabled = true;

    const { error } = await supabaseClient.from(T_HL).insert({
      treff_id: form.dataset.treff,
      author: state.employee.name,
      tekst
    });
    button.disabled = false;

    if (error) {
      console.error("Fagtid: kunne ikke lagre highlight", error);
      alert("Kunne ikke lagre. Prøv igjen.");
      return;
    }
    input.value = "";
    loadTreff();
  }

  async function deleteHighlight(id) {
    if (!confirm("Slette denne highlighten?")) return;
    const { error } = await supabaseClient.from(T_HL).delete().eq("id", id);
    if (error) {
      console.error("Fagtid: kunne ikke slette highlight", error);
      alert("Kunne ikke slette.");
      return;
    }
    loadTreff();
  }

  /* ---------- Admin: treff-skjema ---------- */

  const FIELDS = {
    dato: "#treffDato",
    avdeling: "#treffAvdeling",
    tema: "#treffTema",
    class_fokus: "#treffClass",
    innhold: "#treffInnhold",
    neste_gang: "#treffNeste",
    lekse: "#treffLekse"
  };

  function openTreffForm(treff) {
    state.editingId = treff ? treff.id : null;
    $("#fagtidTreffFormTitle").textContent = treff ? "Endre treff" : "Nytt treff";
    $("#fagtidTreffForm").reset();
    $("#treffStatus").textContent = "";
    Object.entries(FIELDS).forEach(([key, selector]) => {
      $(selector).value = treff ? (treff[key] || "") : "";
    });
    if (!treff) {
      $("#treffDato").value = todayKey();
      $("#treffAvdeling").value = "Felles";
    }
    const card = $("#fagtidTreffFormCard");
    card.hidden = false;
    card.scrollIntoView({ behavior: "smooth", block: "start" });
    $("#treffTema").focus({ preventScroll: true });
  }

  function closeTreffForm() {
    state.editingId = null;
    $("#fagtidTreffFormCard").hidden = true;
  }

  async function saveTreff(event) {
    event.preventDefault();
    const row = {};
    Object.entries(FIELDS).forEach(([key, selector]) => {
      const value = $(selector).value.trim();
      row[key] = value || null;
    });
    if (!row.dato || !row.tema) return;

    const button = $("#treffSave");
    button.disabled = true;
    $("#treffStatus").textContent = "Lagrer...";

    const query = state.editingId
      ? supabaseClient.from(T_TREFF).update(row).eq("id", state.editingId)
      : supabaseClient.from(T_TREFF).insert(row);
    const { error } = await query;
    button.disabled = false;

    if (error) {
      console.error("Fagtid: kunne ikke lagre treff", error);
      $("#treffStatus").textContent = "Noe gikk galt, treffet ble ikke lagret.";
      return;
    }

    closeTreffForm();
    await loadTreff();
    $("#fagtidLoype").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function deleteTreff(id) {
    const treff = state.treff.find(t => t.id === id);
    if (!treff) return;
    if (!confirm(`Slette treffet «${treff.tema}» (${formatDate(treff.dato)})? Highlights på treffet slettes også. Dette kan ikke angres.`)) return;
    const { error } = await supabaseClient.from(T_TREFF).delete().eq("id", id);
    if (error) {
      console.error("Fagtid: kunne ikke slette treff", error);
      alert("Kunne ikke slette treffet.");
      return;
    }
    loadTreff();
  }

  /* =========================================================
     Oppstart
     ========================================================= */

  async function init() {
    renderOptions($("#fagtidTopics"), TOPICS, "fagtidTopic");
    renderOptions($("#fagtidLearning"), LEARNING, "fagtidLearning");

    $("#fagtidTopics").addEventListener("change", enforceTopicLimit);
    $("#fagtidForm").addEventListener("submit", submitSurvey);
    $("#fagtidAnswerAgain").addEventListener("click", () => showAnswered(false));

    // Klikk og skjema inne i løypa (innholdet tegnes på nytt, så vi lytter på app)
    app.addEventListener("click", event => {
      const button = event.target.closest("[data-action]");
      if (!button) return;
      const id = button.dataset.id;
      if (button.dataset.action === "delete-hl") deleteHighlight(id);
      if (button.dataset.action === "edit-treff") openTreffForm(state.treff.find(t => t.id === id));
      if (button.dataset.action === "delete-treff") deleteTreff(id);
    });
    app.addEventListener("submit", event => {
      const form = event.target.closest(".fagtid-hl-form");
      if (!form) return;
      event.preventDefault();
      addHighlight(form);
    });

    const employee = await waitForEmployee();
    if (!employee) return;
    state.employee = employee;
    state.isAdmin = !!employee.is_admin;
    state.isAssistant = employee.role === "Assistent";

    if (state.isAdmin) {
      $("#fagtidSurveyToggle").addEventListener("change", toggleSurvey);
      $("#fagtidNewTreffBtn").addEventListener("click", () => openTreffForm(null));
      $("#fagtidTreffForm").addEventListener("submit", saveTreff);
      $("#treffCancel").addEventListener("click", closeTreffForm);
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

    await loadSettings();
    loadTreff();
  }

  init();
})();
