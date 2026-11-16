/* ===== KBFB PERSONAL - MAANEDSBREV.JS =====
   Månedsbrev til foreldre: pedagogen fyller inn faste deler, og siden lager et
   avisaktig brev (likt format for alle avdelinger). Lastes etter app.js.

   - Skjema til venstre, live forhåndsvisning til høyre
   - Autolagring av utkast, publiser selv, arkiv per avdeling og måned
   - Eksport: "Lagre som PDF / skriv ut" (egen A4-CSS) og "Kopier som tekst"
   - Bilder ligger i en LUKKET bøtte (newspaper-photos), bare ansatte ser dem
   - AI-hjelp kommer senere: hvert tekstfelt har en skjult knapp-plass
     (data-ai-slot) som kan kobles til en Edge Function. Ikke implementert. */

(function () {
  const app = document.getElementById("newsletterApp");
  if (!app) return;

  const BUCKET = "newsletter-photos";
  const DEPARTMENTS = ["Sommerfuglen", "Regnbuen"];

  const DEPT_STYLE = {
    Sommerfuglen: { name: "Sommerfugl-posten", emoji: "🦋", color: "#e8663d", dark: "#b84a25", soft: "#fde9e0" },
    Regnbuen: { name: "Regnbue-posten", emoji: "🌈", color: "#7a4e9b", dark: "#5a3475", soft: "#f0e8f6" }
  };
  const FALLBACK_STYLE = { name: "Månedsbrev", emoji: "", color: "#2f6b3f", dark: "#234d31", soft: "#e7f2e7" };

  // Romslige tak, bare for å hindre uhell. Hvor langt brevet blir, ser du i
  // måleren over forhåndsvisningen (ca. antall A4-sider).
  const LIMITS = {
    done_title: 80, done_text: 2000,
    workItemTitle: 80, workItemText: 800, maxWorkItems: 6,
    home_text: 800, greeting: 120,
    practicalLines: 14, practicalLine: 140,
    maxImages: 4
  };

  const MONTHS = ["januar", "februar", "mars", "april", "mai", "juni", "juli", "august", "september", "oktober", "november", "desember"];
  const MONTHS_SHORT = ["jan.", "feb.", "mars", "apr.", "mai", "juni", "juli", "aug.", "sep.", "okt.", "nov.", "des."];

  // Datoer som vanligvis ikke angår foreldre starter uten hake.
  const DEFAULT_ON = ["general", "plandager", "overnatting", "foreldre"];
  const SKIP_CATEGORIES = ["bursdag", "jubileum"];

  const ICONS = {
    done: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M8 12.5l3 3 5-6"/></svg>',
    working: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21v-8"/><path d="M12 13c0-4 3-6 7-6 0 4-3 6-7 6z"/><path d="M12 15c0-3-2-5-6-5 0 3 2 5 6 5z"/></svg>',
    upcoming: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/></svg>',
    home: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 11l8-7 8 7"/><path d="M6 10v10h12V10"/><path d="M10 20v-6h4v6"/></svg>',
    practical: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 7h11M9 12h11M9 17h11"/><path d="M4.5 7h.01M4.5 12h.01M4.5 17h.01"/></svg>'
  };

  const state = {
    employee: null,
    department: null,
    monthKey: null, // "YYYY-MM"
    letter: null,
    canWrite: false,
    dirty: false,
    saving: false,
    saveTimer: null,
    loadId: 0,
    imageUrls: {}
  };

  /* ---------- Små hjelpere ---------- */

  const esc = value => (typeof escapeHtml === "function" ? escapeHtml(value) : String(value ?? ""));
  const $ = selector => app.querySelector(selector);

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

  function monthKeyOf(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  }

  function dateKeyOf(date) {
    return `${monthKeyOf(date)}-${String(date.getDate()).padStart(2, "0")}`;
  }

  function lastDayOfMonth(year, month) {
    return new Date(year, month, 0).getDate(); // month er 1-12
  }

  function capitalize(text) {
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  function styleFor(department) {
    return DEPT_STYLE[department] || FALLBACK_STYLE;
  }

  function monthTitle(monthKey) {
    const [year, month] = monthKey.split("-").map(Number);
    return `${capitalize(MONTHS[month - 1])} ${year}`;
  }

  function parseDay(dateKey) {
    const [year, month, day] = dateKey.split("-").map(Number);
    return { year, month, day };
  }

  // "14. nov." eller "14.-16. nov." eller "30. nov.-2. des."
  function chipLabel(dateKey, endKey) {
    const a = parseDay(dateKey);
    if (!endKey || endKey === dateKey) return `${a.day}. ${MONTHS_SHORT[a.month - 1]}`;
    const b = parseDay(endKey);
    if (a.month === b.month && a.year === b.year) return `${a.day}.–${b.day}. ${MONTHS_SHORT[b.month - 1]}`;
    return `${a.day}. ${MONTHS_SHORT[a.month - 1]}–${b.day}. ${MONTHS_SHORT[b.month - 1]}`;
  }

  // Liten kalenderbrikke: måned øverst, dag(er) stort under.
  function tileHtml(dateKey, endKey) {
    const a = parseDay(dateKey);
    const short = month => MONTHS_SHORT[month - 1].replace(".", "");
    let day = String(a.day);
    let month = short(a.month);

    if (endKey && endKey !== dateKey) {
      const b = parseDay(endKey);
      day = `${a.day}–${b.day}`;
      month = a.month === b.month && a.year === b.year ? short(b.month) : `${short(a.month)}–${short(b.month)}`;
    }

    return `<span class="nl-datetile"><i>${esc(month)}</i><b>${esc(day)}</b></span>`;
  }

  function cleanWorkItems(letter) {
    return (letter.working_items || [])
      .map(item => ({ title: String(item.title || "").trim(), text: String(item.text || "").trim() }))
      .filter(item => item.title || item.text);
  }

  // Eldre brev har ett tema i working_title/working_text: løft det inn i listen.
  function normalizeWorkItems(letter) {
    if (Array.isArray(letter.working_items) && letter.working_items.length) return;
    letter.working_items = letter.working_title || letter.working_text
      ? [{ title: letter.working_title || "", text: letter.working_text || "" }]
      : [{ title: "", text: "" }];
  }

  function firstName(name) {
    return String(name || "").split(" ")[0];
  }

  function defaultGreeting(department) {
    const me = firstName(state.employee?.name);
    return me ? `Hilsen ${me} og alle på ${department}` : `Hilsen alle på ${department}`;
  }

  function emptyLetter(department, monthKey, issueNo) {
    return {
      id: null,
      department,
      month: `${monthKey}-01`,
      issue_no: issueNo || 1,
      status: "draft",
      done_title: "",
      done_text: "",
      working_title: "",
      working_text: "",
      working_items: [{ title: "", text: "" }],
      upcoming: [],
      home_text: "",
      practical: [],
      greeting: defaultGreeting(department),
      images: []
    };
  }

  /* ---------- Datoer fra datolista ---------- */

  async function loadUpcomingEvents(monthKey) {
    const [year, month] = monthKey.split("-").map(Number);
    const monthStart = `${monthKey}-01`;
    const monthEnd = `${monthKey}-${String(lastDayOfMonth(year, month)).padStart(2, "0")}`;
    const todayKey = dateKeyOf(new Date());

    // Fra i dag hvis brevet gjelder denne måneden, ellers fra månedens start.
    const from = todayKey >= monthStart && todayKey <= monthEnd ? todayKey : monthStart;

    const next = new Date(year, month, 1); // første i neste måned
    const to = `${monthKeyOf(next)}-${String(lastDayOfMonth(next.getFullYear(), next.getMonth() + 1)).padStart(2, "0")}`;

    const { data, error } = await supabaseClient
      .from("kbfb_events")
      .select("*")
      .gte("date", from)
      .lte("date", to)
      .order("date", { ascending: true });

    if (error) {
      console.error("Kunne ikke hente datoer:", error);
      return [];
    }

    return (data || [])
      .filter(event => !SKIP_CATEGORIES.includes(event.category))
      .map(event => ({
        key: `e:${event.id}`,
        date: event.date,
        end_date: event.end_date || null,
        title: event.title || "",
        note: event.note || "",
        category: event.category || "general",
        custom: false
      }));
  }

  // Utkast: datolista er fasit for det som finnes der, valgene dine beholdes.
  // Publiserte brev beholder listen akkurat som den var.
  function mergeUpcoming(letter, events) {
    const saved = Array.isArray(letter.upcoming) ? letter.upcoming : [];
    if (letter.status === "published") return saved;

    const savedByKey = new Map(saved.map(item => [item.key, item]));
    const merged = events.map(event => {
      const old = savedByKey.get(event.key);
      return {
        ...event,
        include: old ? !!old.include : DEFAULT_ON.includes(event.category)
      };
    });

    saved.filter(item => item.custom).forEach(item => merged.push(item));
    return sortUpcoming(merged);
  }

  function sortUpcoming(list) {
    return [...list].sort((a, b) => (a.date || "").localeCompare(b.date || "") || (a.title || "").localeCompare(b.title || ""));
  }

  /* ---------- Bilder (lukket bøtte, signerte lenker) ---------- */

  async function ensureImageUrls(paths) {
    const missing = paths.filter(path => !state.imageUrls[path]);
    if (!missing.length) return;

    const { data, error } = await supabaseClient.storage.from(BUCKET).createSignedUrls(missing, 3600);
    if (error) {
      console.error("Kunne ikke hente bilder:", error);
      return;
    }
    (data || []).forEach(item => {
      if (item.signedUrl) state.imageUrls[item.path] = item.signedUrl;
    });
  }

  async function resizeImage(file, maxSide = 1000) {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return new Promise(resolve => canvas.toBlob(resolve, "image/jpeg", 0.85));
  }

  /* ---------- Avisen (brukes av både forhåndsvisning og utskrift) ---------- */

  function paragraphs(text) {
    return String(text || "")
      .split(/\n+/)
      .map(line => line.trim())
      .filter(Boolean)
      .map(line => `<p>${esc(line)}</p>`)
      .join("");
  }

  function pill(kind, label) {
    return `<span class="nl-pill nl-pill-${kind}">${ICONS[kind]}${esc(label)}</span>`;
  }

  function paperHtml(letter) {
    const style = styleFor(letter.department);
    const monthKey = String(letter.month).slice(0, 7);

    const includedDates = sortUpcoming((letter.upcoming || []).filter(item => item.include));
    const practical = (letter.practical || []).filter(Boolean);
    const images = (letter.images || []).filter(path => state.imageUrls[path]);

    const hasDone = letter.done_title || letter.done_text || images.length;
    const workItems = cleanWorkItems(letter);
    const hasWorking = workItems.length > 0;
    const hasAnything = hasDone || hasWorking || includedDates.length || letter.home_text || practical.length || letter.greeting;

    if (!hasAnything) {
      return `<div class="nl-empty">Forhåndsvisningen dukker opp her når du begynner å skrive.</div>`;
    }

    const done = hasDone ? `
      <section class="nl-section nl-done">
        ${pill("done", "Dette har vi gjort")}
        ${letter.done_title ? `<h3>${esc(letter.done_title)}</h3>` : ""}
        <div class="nl-body nl-dropcap">${paragraphs(letter.done_text)}</div>
        ${images.length ? `<div class="nl-images nl-images-${images.length}">${images.map(path => `<img src="${esc(state.imageUrls[path])}" alt="">`).join("")}</div>` : ""}
      </section>` : "";

    const working = hasWorking ? `
      <section class="nl-section nl-working">
        ${pill("working", "Dette jobber vi med")}
        ${workItems.map(item => `
          <div class="nl-topic">
            ${item.title ? `<h3>${esc(item.title)}</h3>` : ""}
            <div class="nl-body">${paragraphs(item.text)}</div>
          </div>`).join("")}
      </section>` : "";

    const upcoming = includedDates.length ? `
      <section class="nl-section nl-upcoming">
        ${pill("upcoming", "Fremover")}
        <ul class="nl-dates">
          ${includedDates.map(item => `
            <li>
              ${tileHtml(item.date, item.end_date)}
              <span class="nl-datetext"><strong>${esc(item.title)}</strong>${item.note ? `<small>${esc(item.note)}</small>` : ""}</span>
            </li>`).join("")}
        </ul>
      </section>` : "";

    const home = letter.home_text ? `
      <section class="nl-section nl-home">
        ${pill("home", "Til dere hjemme")}
        <div class="nl-callout">${paragraphs(letter.home_text)}</div>
      </section>` : "";

    const practicalHtml = practical.length ? `
      <section class="nl-section nl-practical">
        ${pill("practical", "Praktisk")}
        <div class="nl-note">
          <ul class="nl-list">${practical.map(line => `<li>${esc(line)}</li>`).join("")}</ul>
        </div>
      </section>` : "";

    return `
      <article class="nl-paper" style="--nl:${style.color};--nl-dark:${style.dark};--nl-soft:${style.soft}">
        <div class="nl-topbar"></div>
        <header class="nl-nameplate">
          <h1>${style.emoji ? `<span class="nl-emoji">${style.emoji}</span> ` : ""}${esc(style.name)}${style.emoji ? `&nbsp;<span class="nl-emoji">${style.emoji}</span>` : ""}</h1>
          <p class="nl-tagline"><span>Månedsbrev fra ${esc(letter.department)}</span></p>
        </header>
        <div class="nl-dateline">
          <span>Kirkerudbakken Friluftsbarnehage</span>
          <span>${esc(monthTitle(monthKey))}</span>
          <span>Nr. ${esc(letter.issue_no)}</span>
        </div>
        <div class="nl-columns">
          ${upcoming || home || practicalHtml ? `<aside class="nl-side">${upcoming}${home}${practicalHtml}</aside>` : ""}
          <div class="nl-main">${done}${working}</div>
        </div>
        ${letter.greeting ? `<footer class="nl-greeting">${style.emoji ? `<span class="nl-emoji">${style.emoji}</span> ` : ""}${esc(letter.greeting)}${style.emoji ? `&nbsp;<span class="nl-emoji">${style.emoji}</span>` : ""}</footer>` : ""}
      </article>`;
  }

  function renderPreview() {
    const target = $("#nlPreview");
    if (!target || !state.letter) return;
    target.innerHTML = paperHtml(state.letter);
    refreshAccStates();
    scheduleLengthEstimate();
  }

  // Måler hvor høyt brevet blir med utskriftsmålene (A4, 9,5 pt) ved å tegne en
  // kopi utenfor skjermen. Skjermen bruker større skrift, så vi skalerer.
  let lengthTimer = null;

  function scheduleLengthEstimate() {
    clearTimeout(lengthTimer);
    lengthTimer = setTimeout(updateLengthEstimate, 250);
  }

  function updateLengthEstimate() {
    const el = $("#nlLength");
    const paper = $("#nlPreview .nl-paper");
    if (!el) return;

    if (!paper) {
      el.textContent = "";
      return;
    }

    const scale = 9.5 / (0.93 * 16 * 0.75); // utskriftsskrift / skjermskrift
    const wrap = document.createElement("div");
    wrap.style.cssText = `position:absolute;left:-9999px;top:0;width:${733 / scale}px;visibility:hidden;`;
    const clone = paper.cloneNode(true);
    wrap.appendChild(clone);
    document.body.appendChild(wrap);

    clone.querySelectorAll(".nl-images img").forEach(img => { img.style.height = `${(30 / 25.4) * 96 / scale}px`; });
    const height = clone.getBoundingClientRect().height * scale;
    wrap.remove();

    const pageHeight = ((297 - 16) / 25.4) * 96;
    const pages = height / pageHeight;
    const rounded = Math.max(0.1, Math.round(pages * 10) / 10);

    el.textContent = pages <= 1.02
      ? `ca. ${rounded.toLocaleString("nb-NO")} side, passer på én A4`
      : pages <= 2
        ? `ca. ${rounded.toLocaleString("nb-NO")} sider, blir to A4`
        : `ca. ${rounded.toLocaleString("nb-NO")} sider, vurder å korte ned`;
    el.dataset.level = pages <= 1.02 ? "ok" : pages <= 2 ? "two" : "long";
  }

  // Ren tekst som kan limes rett inn i en e-post.
  function plainText(letter) {
    const style = styleFor(letter.department);
    const monthKey = String(letter.month).slice(0, 7);
    const lines = [`${style.emoji ? `${style.emoji} ` : ""}${style.name}${style.emoji ? ` ${style.emoji}` : ""} – ${monthTitle(monthKey)} (nr. ${letter.issue_no})`, "Kirkerudbakken Friluftsbarnehage", ""];

    if (letter.done_title || letter.done_text) {
      lines.push("DETTE HAR VI GJORT");
      if (letter.done_title) lines.push(letter.done_title);
      if (letter.done_text) lines.push(letter.done_text);
      lines.push("");
    }
    const topics = cleanWorkItems(letter);
    if (topics.length) {
      lines.push("DETTE JOBBER VI MED");
      topics.forEach(item => {
        if (item.title) lines.push(item.title);
        if (item.text) lines.push(item.text);
        lines.push("");
      });
    }
    const dates = sortUpcoming((letter.upcoming || []).filter(item => item.include));
    if (dates.length) {
      lines.push("FREMOVER");
      dates.forEach(item => lines.push(`${chipLabel(item.date, item.end_date)}: ${item.title}${item.note ? ` (${item.note})` : ""}`));
      lines.push("");
    }
    if (letter.home_text) lines.push("TIL DERE HJEMME", letter.home_text, "");
    const practical = (letter.practical || []).filter(Boolean);
    if (practical.length) {
      lines.push("PRAKTISK");
      practical.forEach(line => lines.push(`- ${line}`));
      lines.push("");
    }
    if (letter.greeting) lines.push(`${style.emoji ? `${style.emoji} ` : ""}${letter.greeting}${style.emoji ? ` ${style.emoji}` : ""}`);
    return lines.join("\n").trim();
  }

  /* ---------- Lagring ---------- */

  function setSaveStatus(text, kind) {
    const el = $("#nlSaveStatus");
    if (!el) return;
    el.textContent = text;
    el.dataset.kind = kind || "";
  }

  function scheduleSave() {
    if (!state.canWrite) return;
    state.dirty = true;
    setSaveStatus("Skriver ...", "pending");
    clearTimeout(state.saveTimer);
    state.saveTimer = setTimeout(saveNow, 1500);
  }

  function payloadOf(letter) {
    return {
      issue_no: letter.issue_no,
      status: letter.status,
      done_title: letter.done_title,
      done_text: letter.done_text,
      working_items: cleanWorkItems(letter),
      working_title: cleanWorkItems(letter)[0]?.title || "",
      working_text: cleanWorkItems(letter)[0]?.text || "",
      upcoming: letter.upcoming,
      home_text: letter.home_text,
      practical: letter.practical,
      greeting: letter.greeting,
      images: letter.images,
      published_at: letter.published_at || null,
      updated_at: new Date().toISOString()
    };
  }

  async function saveNow() {
    clearTimeout(state.saveTimer);
    if (!state.canWrite || !state.letter || !state.dirty) return true;
    if (state.saving) {
      state.saveTimer = setTimeout(saveNow, 400);
      return true;
    }

    state.saving = true;
    state.dirty = false;
    const letter = state.letter;

    let error = null;

    if (letter.id) {
      ({ error } = await supabaseClient.from("kbfb_newsletters").update(payloadOf(letter)).eq("id", letter.id));
    } else {
      const { data, error: insertError } = await supabaseClient
        .from("kbfb_newsletters")
        .insert([{
          department: letter.department,
          month: letter.month,
          author: state.employee?.name || null,
          ...payloadOf(letter)
        }])
        .select()
        .single();

      error = insertError;
      if (data) letter.id = data.id;
    }

    state.saving = false;

    if (error) {
      console.error("Kunne ikke lagre månedsbrev:", error);
      state.dirty = true;
      setSaveStatus(error.code === "23505"
        ? "Noen andre har allerede startet dette brevet. Last siden på nytt."
        : "Kunne ikke lagre. Har du kjørt SQL-steget (STEP 75) i Supabase?", "error");
      return false;
    }

    const time = new Date().toLocaleTimeString("nb-NO", { hour: "2-digit", minute: "2-digit" });
    setSaveStatus(`Lagret kl. ${time}`, "ok");
    renderToolbarState();
    refreshArchive();
    return true;
  }

  window.addEventListener("beforeunload", event => {
    if (state.dirty) {
      event.preventDefault();
      event.returnValue = "";
    }
  });

  /* ---------- Åpne et brev ---------- */

  async function openLetter(department, monthKey) {
    if (state.dirty) await saveNow();

    const loadId = ++state.loadId;
    state.department = department;
    state.monthKey = monthKey;

    const { data, error } = await supabaseClient
      .from("kbfb_newsletters")
      .select("*")
      .eq("department", department)
      .eq("month", `${monthKey}-01`)
      .maybeSingle();

    if (loadId !== state.loadId) return;

    if (error) console.error("Kunne ikke hente månedsbrev:", error);

    let letter = data;
    if (!letter) {
      const { data: last } = await supabaseClient
        .from("kbfb_newsletters")
        .select("issue_no")
        .eq("department", department)
        .order("issue_no", { ascending: false })
        .limit(1);
      letter = emptyLetter(department, monthKey, (last?.[0]?.issue_no || 0) + 1);
    }

    // Foreldre ser bare publiserte brev; ansatte som ikke skriver også.
    if (!state.canWriteFor(department) && letter.status !== "published") {
      letter = emptyLetter(department, monthKey, letter.issue_no);
      letter.greeting = "";
      letter._notPublished = true;
    }

    if (state.canWriteFor(department) && letter.status !== "published") {
      const events = await loadUpcomingEvents(monthKey);
      if (loadId !== state.loadId) return;
      letter.upcoming = mergeUpcoming(letter, events);
    }

    await ensureImageUrls(letter.images || []);
    if (loadId !== state.loadId) return;

    normalizeWorkItems(letter);
    state.letter = letter;
    state.canWrite = state.canWriteFor(department);
    state.dirty = false;

    renderEditor();
    renderToolbarState();
    renderPreview();
    refreshArchive();
    setSaveStatus(letter.id ? "Åpnet" : "Nytt brev", "");

    // Nye utkast med datoer fra datolista lagres først når du skriver.
  }

  /* ---------- Verktøylinje og arkiv ---------- */

  function renderToolbarState() {
    const letter = state.letter;
    if (!letter) return;

    const published = letter.status === "published";
    const badge = $("#nlStatusBadge");
    badge.textContent = published ? "Publisert" : letter.id ? "Utkast" : "Nytt";
    badge.className = `nl-status nl-status-${published ? "published" : "draft"}`;

    const publishBtn = $("#nlPublishBtn");
    publishBtn.style.display = state.canWrite ? "" : "none";
    publishBtn.textContent = published ? "Sett tilbake til utkast" : "Publiser";
    publishBtn.className = published ? "secondary-btn" : "primary-btn";

    $("#nlEditor").style.display = state.canWrite ? "" : "none";
    app.classList.toggle("nl-readonly", !state.canWrite);

    const note = $("#nlNotPublished");
    note.style.display = letter._notPublished ? "" : "none";
  }

  async function refreshArchive() {
    const list = $("#nlArchiveList");
    if (!list) return;

    let query = supabaseClient
      .from("kbfb_newsletters")
      .select("id, department, month, issue_no, status")
      .eq("department", state.department)
      .order("month", { ascending: false });

    if (!state.canWriteFor(state.department)) query = query.eq("status", "published");

    const { data, error } = await query;
    if (error) {
      list.innerHTML = `<p class="muted">Kunne ikke hente arkivet.</p>`;
      return;
    }

    const countEl = $("#nlArchiveCount");
    if (countEl) countEl.textContent = data?.length ? `(${data.length})` : "";

    if (!data?.length) {
      list.innerHTML = `<p class="muted">Ingen brev ennå for ${esc(state.department)}.</p>`;
      return;
    }

    list.innerHTML = data.map(row => {
      const key = String(row.month).slice(0, 7);
      const active = key === state.monthKey;
      return `<button type="button" class="nl-archive-item${active ? " active" : ""}" data-month="${key}">
        <strong>${esc(monthTitle(key))}</strong>
        <span>Nr. ${esc(row.issue_no)} · ${row.status === "published" ? "Publisert" : "Utkast"}</span>
      </button>`;
    }).join("");

    list.querySelectorAll("[data-month]").forEach(button => {
      button.addEventListener("click", () => {
        setMonthControls(button.dataset.month);
        openLetter(state.department, button.dataset.month);
      });
    });
  }

  function setMonthControls(monthKey) {
    const [year, month] = monthKey.split("-");
    const yearSelect = $("#nlYear");
    if (![...yearSelect.options].some(option => option.value === year)) {
      yearSelect.insertAdjacentHTML("beforeend", `<option value="${year}">${year}</option>`);
    }
    yearSelect.value = year;
    $("#nlMonth").value = month;
  }

  /* ---------- Skjemaet ---------- */

  function counter(field, value) {
    return `${String(value || "").length} tegn`;
  }

  function textField({ field, label, hint, rows, placeholder, multiline = true }) {
    const value = state.letter[field] || "";
    const limit = LIMITS[field];
    const input = multiline
      ? `<textarea data-field="${field}" rows="${rows || 4}" maxlength="${limit}" placeholder="${esc(placeholder || "")}">${esc(value)}</textarea>`
      : `<input type="text" data-field="${field}" maxlength="${limit}" placeholder="${esc(placeholder || "")}" value="${esc(value)}">`;

    return `
      <label class="nl-field">
        <span class="nl-label">${esc(label)} <span class="nl-counter" data-counter="${field}">${counter(field, value)}</span></span>
        ${input}
        <small class="muted">${hint}</small>
        <span data-ai-slot="${field}" hidden></span>
      </label>`;
  }

  function upcomingEditorHtml() {
    const items = sortUpcoming(state.letter.upcoming || []);
    if (!items.length) {
      return `<p class="muted">Ingen datoer i datolista for denne perioden. Legg til egne under.</p>`;
    }

    return items.map(item => `
      <label class="nl-date-row">
        <input type="checkbox" data-upcoming="${esc(item.key)}" ${item.include ? "checked" : ""}>
        <span class="nl-datechip">${esc(chipLabel(item.date, item.end_date))}</span>
        <span class="nl-date-title">${esc(item.title)}${item.note ? ` <small class="muted">${esc(item.note)}</small>` : ""}</span>
        ${item.custom ? `<button type="button" class="nl-remove" data-remove-upcoming="${esc(item.key)}" title="Fjern denne datoen">Fjern</button>` : ""}
      </label>`).join("");
  }

  function imagesEditorHtml() {
    const images = state.letter.images || [];
    return `
      ${images.length ? `<div class="nl-thumbs">${images.map(path => `
        <div class="nl-thumb">
          ${state.imageUrls[path] ? `<img src="${esc(state.imageUrls[path])}" alt="">` : ""}
          <button type="button" data-remove-image="${esc(path)}" title="Fjern bildet">Fjern</button>
        </div>`).join("")}</div>` : ""}
      ${images.length < LIMITS.maxImages ? `
        <div class="nl-upload">
          <label class="nl-confirm">
            <input type="checkbox" id="nlNoFaces"> Bildet viser <strong>ikke ansikter</strong> (hender, ryggen, ting vi har laget, natur)
          </label>
          <input type="file" id="nlImageInput" accept="image/*" disabled>
        </div>` : `<p class="muted">Maks ${LIMITS.maxImages} bilder.</p>`}`;
  }

  function accState() {
    const l = state.letter;
    const dates = (l.upcoming || []).filter(item => item.include).length;
    const points = (l.practical || []).length;
    return {
      done: l.done_title || l.done_text ? "Fylt ut" : "Tom",
      working: cleanWorkItems(l).length ? `${cleanWorkItems(l).length} ${cleanWorkItems(l).length === 1 ? "tema" : "temaer"}` : "Tom",
      upcoming: dates ? `${dates} ${dates === 1 ? "dato" : "datoer"}` : "Ingen",
      home: l.home_text ? "Fylt ut" : "Tom",
      practical: points ? `${points} ${points === 1 ? "punkt" : "punkter"}` : "Tom"
    };
  }

  function refreshAccStates() {
    if (!state.letter) return;
    const states = accState();
    app.querySelectorAll("[data-acc-state]").forEach(el => {
      const text = states[el.dataset.accState];
      el.textContent = text;
      el.classList.toggle("filled", text !== "Tom" && text !== "Ingen");
    });
  }

  function accordion(key, kind, label, content, open) {
    return `
      <details class="nl-acc nl-acc-${kind}" ${open ? "open" : ""}>
        <summary>
          ${pill(kind, label)}
          <span class="nl-acc-state" data-acc-state="${key}"></span>
        </summary>
        <div class="nl-acc-body">${content}</div>
      </details>`;
  }

  function workItemsHtml() {
    const items = state.letter.working_items || [];
    return items.map((item, index) => `
      <div class="nl-work-item">
        <div class="nl-work-head">
          <span class="nl-label">Tema ${index + 1}</span>
          ${items.length > 1 ? `<button type="button" class="nl-remove" data-work-remove="${index}">Fjern</button>` : ""}
        </div>
        <input type="text" data-work-field="title" data-work-index="${index}" maxlength="${LIMITS.workItemTitle}" placeholder="Vennskap og samspill" value="${esc(item.title || "")}">
        <textarea data-work-field="text" data-work-index="${index}" rows="3" maxlength="${LIMITS.workItemText}" placeholder="Vi øver oss på å vente på tur ...">${esc(item.text || "")}</textarea>
        <span class="nl-counter nl-work-counter" data-work-counter="${index}">${String(item.text || "").length} tegn</span>
      </div>`).join("") + (items.length < LIMITS.maxWorkItems
        ? `<button type="button" class="secondary-btn" id="nlWorkAdd">+ Legg til et tema</button>`
        : `<p class="muted nl-small">Maks ${LIMITS.maxWorkItems} temaer.</p>`);
  }

  function renderEditor() {
    const letter = state.letter;
    const el = $("#nlEditor");
    if (!el) return;

    el.innerHTML = `
      <div class="nl-reminder">
        <span><strong>Husk:</strong> ikke fulle navn på barn, og ingen ansikter på bilder.</span>
        <label class="nl-issue-inline">Nr. <input type="number" min="1" max="999" data-field="issue_no" value="${esc(letter.issue_no)}"></label>
      </div>

      ${accordion("done", "done", "Dette har vi gjort", `
        ${textField({ field: "done_title", label: "Overskrift", multiline: false, placeholder: "Bål og pinnebrød ved Kirkerud", hint: "Kort og konkret." })}
        ${textField({ field: "done_text", label: "Tekst", rows: 5, placeholder: "Denne måneden har vi ...", hint: "Skriv så mye du synes er fornuftig. Lengden ser du over forhåndsvisningen." })}
        <div class="nl-field">
          <span class="nl-label">Bilder (0–4, små)</span>
          <div id="nlImages">${imagesEditorHtml()}</div>
        </div>
      `, true)}

      ${accordion("working", "working", "Dette jobber vi med", `
        <p class="muted nl-small">Ett tema per overskrift, opptil ${LIMITS.maxWorkItems}. Eksempel: «Vennskap», «Tall og telling», «Sanger».</p>
        <div id="nlWorkItems">${workItemsHtml()}</div>
      `)}

      ${accordion("upcoming", "upcoming", "Fremover", `
        <p class="muted nl-small">Fra datolista, resten av måneden og neste måned. Hak av det som gjelder ${esc(letter.department)}.</p>
        <div id="nlUpcomingList">${upcomingEditorHtml()}</div>
        <div class="nl-add-date">
          <input type="date" id="nlCustomDate" aria-label="Dato">
          <input type="text" id="nlCustomTitle" maxlength="70" placeholder="Egen dato, f.eks. Tur til skogen" aria-label="Tekst">
          <button type="button" class="secondary-btn" id="nlCustomAdd">Legg til</button>
        </div>
      `)}

      ${accordion("home", "home", "Til dere hjemme", `
        ${textField({ field: "home_text", label: "Tekst", rows: 3, placeholder: "Snakk om hva dere ser på vei til barnehagen.", hint: "Noe enkelt dere kan gjøre hjemme." })}
      `)}

      ${accordion("practical", "practical", "Praktisk", `
        <label class="nl-field">
          <span class="nl-label">Ett punkt per linje <span class="nl-counter" data-counter="practical">${(letter.practical || []).length} punkter</span></span>
          <textarea data-field="practical" rows="4" placeholder="Husk varme votter og ekstra sokker&#10;Planleggingsdag fredag 14.">${esc((letter.practical || []).join("\n"))}</textarea>
          <small class="muted">Klær, påminnelser, frister.</small>
        </label>
        <button type="button" class="nl-linkbtn" id="nlCopyPrevBtn">Hent Praktisk og Hilsen fra forrige brev</button>
      `)}

      <div class="nl-greeting-field">
        ${textField({ field: "greeting", label: "Hilsen", multiline: false, placeholder: "Hilsen Imelda og alle på Sommerfuglen", hint: "Avslutningen nederst i brevet." })}
      </div>
    `;

    bindEditor();
    refreshAccStates();
  }

  function bindEditor() {
    const el = $("#nlEditor");

    $("#nlCopyPrevBtn")?.addEventListener("click", copyFromPrevious);

    // Temaer under "Dette jobber vi med"
    el.querySelectorAll("[data-work-field]").forEach(input => {
      input.addEventListener("input", () => {
        const item = state.letter.working_items[Number(input.dataset.workIndex)];
        if (!item) return;
        item[input.dataset.workField] = input.value;
        if (input.dataset.workField === "text") {
          const counterEl = el.querySelector(`[data-work-counter="${input.dataset.workIndex}"]`);
          if (counterEl) counterEl.textContent = `${input.value.length} tegn`;
        }
        scheduleSave();
        renderPreview();
      });
    });

    el.querySelectorAll("[data-work-remove]").forEach(button => {
      button.addEventListener("click", () => {
        state.letter.working_items.splice(Number(button.dataset.workRemove), 1);
        if (!state.letter.working_items.length) state.letter.working_items.push({ title: "", text: "" });
        $("#nlWorkItems").innerHTML = workItemsHtml();
        bindEditor();
        scheduleSave();
        renderPreview();
      });
    });

    $("#nlWorkAdd")?.addEventListener("click", () => {
      if (state.letter.working_items.length >= LIMITS.maxWorkItems) return;
      state.letter.working_items.push({ title: "", text: "" });
      $("#nlWorkItems").innerHTML = workItemsHtml();
      bindEditor();
      const inputs = el.querySelectorAll('[data-work-field="title"]');
      inputs[inputs.length - 1]?.focus();
    });

    el.querySelectorAll("[data-field]").forEach(input => {
      input.addEventListener("input", () => {
        const field = input.dataset.field;

        if (field === "practical") {
          const lines = input.value.split("\n").map(line => line.trim().slice(0, LIMITS.practicalLine)).filter(Boolean).slice(0, LIMITS.practicalLines);
          state.letter.practical = lines;
          const counterEl = el.querySelector('[data-counter="practical"]');
          if (counterEl) counterEl.textContent = `${lines.length} punkter`;
        } else if (field === "issue_no") {
          state.letter.issue_no = Math.max(1, parseInt(input.value, 10) || 1);
        } else {
          state.letter[field] = input.value;
          const counterEl = el.querySelector(`[data-counter="${field}"]`);
          if (counterEl) counterEl.textContent = counter(field, input.value);
        }

        scheduleSave();
        renderPreview();
      });
    });

    el.querySelectorAll("[data-upcoming]").forEach(box => {
      box.addEventListener("change", () => {
        const item = state.letter.upcoming.find(entry => entry.key === box.dataset.upcoming);
        if (item) item.include = box.checked;
        scheduleSave();
        renderPreview();
      });
    });

    el.querySelectorAll("[data-remove-upcoming]").forEach(button => {
      button.addEventListener("click", event => {
        event.preventDefault();
        state.letter.upcoming = state.letter.upcoming.filter(entry => entry.key !== button.dataset.removeUpcoming);
        $("#nlUpcomingList").innerHTML = upcomingEditorHtml();
        bindEditor();
        scheduleSave();
        renderPreview();
      });
    });

    $("#nlCustomAdd")?.addEventListener("click", () => {
      const date = $("#nlCustomDate").value;
      const title = $("#nlCustomTitle").value.trim();
      if (!date || !title) {
        alert("Fyll inn både dato og tekst.");
        return;
      }
      state.letter.upcoming.push({
        key: `c:${(crypto.randomUUID && crypto.randomUUID()) || Date.now()}`,
        date,
        end_date: null,
        title,
        note: "",
        custom: true,
        include: true
      });
      state.letter.upcoming = sortUpcoming(state.letter.upcoming);
      $("#nlCustomDate").value = "";
      $("#nlCustomTitle").value = "";
      $("#nlUpcomingList").innerHTML = upcomingEditorHtml();
      bindEditor();
      scheduleSave();
      renderPreview();
    });

    // Bilder: må bekrefte "ingen ansikter" før en fil kan velges.
    const noFaces = $("#nlNoFaces");
    const fileInput = $("#nlImageInput");
    if (noFaces && fileInput) {
      noFaces.addEventListener("change", () => { fileInput.disabled = !noFaces.checked; });
      fileInput.addEventListener("change", () => uploadImage(fileInput));
    }

    el.querySelectorAll("[data-remove-image]").forEach(button => {
      button.addEventListener("click", () => removeImage(button.dataset.removeImage));
    });
  }

  async function uploadImage(input) {
    const file = input.files?.[0];
    if (!file) return;

    if (!$("#nlNoFaces").checked) {
      alert("Bekreft først at bildet ikke viser ansikter.");
      input.value = "";
      return;
    }

    input.disabled = true;
    setSaveStatus("Laster opp bilde ...", "pending");

    try {
      const blob = await resizeImage(file);
      const id = (crypto.randomUUID && crypto.randomUUID()) || String(Date.now());
      const path = `${state.department}/${state.monthKey}/${id}.jpg`;

      const { error } = await supabaseClient.storage.from(BUCKET).upload(path, blob, { contentType: "image/jpeg" });
      if (error) throw error;

      state.letter.images = [...(state.letter.images || []), path];
      await ensureImageUrls([path]);
      $("#nlImages").innerHTML = imagesEditorHtml();
      bindEditor();
      scheduleSave();
      renderPreview();
    } catch (error) {
      console.error("Kunne ikke laste opp bilde:", error);
      alert("Kunne ikke laste opp bildet. Har du kjørt SQL-steget (STEP 75) i Supabase?");
      input.disabled = false;
      setSaveStatus("Bildet ble ikke lastet opp", "error");
    }
  }

  async function removeImage(path) {
    if (!confirm("Fjerne dette bildet fra brevet?")) return;
    state.letter.images = (state.letter.images || []).filter(item => item !== path);
    delete state.imageUrls[path];
    await supabaseClient.storage.from(BUCKET).remove([path]);
    $("#nlImages").innerHTML = imagesEditorHtml();
    bindEditor();
    scheduleSave();
    renderPreview();
  }

  /* ---------- Knapper ---------- */

  async function copyFromPrevious() {
    const letter = state.letter;

    const { data, error } = await supabaseClient
      .from("kbfb_newsletters")
      .select("practical, greeting, month")
      .eq("department", state.department)
      .lt("month", letter.month)
      .order("month", { ascending: false })
      .limit(1);

    if (error || !data?.length) {
      alert("Fant ikke noe tidligere brev å kopiere fra.");
      return;
    }

    const hasContent = (letter.practical || []).length || (letter.greeting && letter.greeting !== defaultGreeting(state.department));
    if (hasContent && !confirm("Dette erstatter Praktisk og Hilsen i dette brevet. Fortsette?")) return;

    letter.practical = data[0].practical || [];
    letter.greeting = data[0].greeting || letter.greeting;
    renderEditor();
    scheduleSave();
    renderPreview();
  }

  async function togglePublish() {
    const letter = state.letter;
    const publishing = letter.status !== "published";

    if (publishing && !(letter.done_text || letter.done_title || cleanWorkItems(letter).length)) {
      alert("Skriv litt i brevet først.");
      return;
    }

    letter.status = publishing ? "published" : "draft";
    letter.published_at = publishing ? new Date().toISOString() : null;
    state.dirty = true;

    const ok = await saveNow();
    if (!ok) {
      letter.status = publishing ? "draft" : "published";
      return;
    }

    renderToolbarState();
    renderEditor();
    setSaveStatus(publishing ? "Publisert. Trykk «Lagre som PDF» for å sende til foreldre." : "Satt tilbake til utkast", "ok");
  }

  function printLetter() {
    if (!state.letter) return;
    const style = document.createElement("style");
    style.id = "nlPageStyle";
    style.textContent = "@page { size: A4; margin: 8mm; }";
    document.head.appendChild(style);

    const cleanup = () => {
      style.remove();
      window.removeEventListener("afterprint", cleanup);
    };
    window.addEventListener("afterprint", cleanup);
    window.print();
  }

  async function copyText() {
    if (!state.letter) return;
    try {
      await navigator.clipboard.writeText(plainText(state.letter));
      setSaveStatus("Teksten er kopiert. Lim den inn i e-posten.", "ok");
    } catch (error) {
      console.error("Kunne ikke kopiere:", error);
      alert("Kunne ikke kopiere automatisk.");
    }
  }

  /* ---------- Oppstart ---------- */

  async function init() {
    const employee = await waitForEmployee();
    if (!employee) return;
    state.employee = employee;

    const isAdmin = !!employee.is_admin;
    const isLead = typeof isDepartmentLeadRole === "function" && isDepartmentLeadRole(employee.role);

    state.canWriteFor = department => isAdmin || (isLead && employee.department === department);

    const writableDepartments = DEPARTMENTS.filter(department => state.canWriteFor(department));
    const startDepartment = writableDepartments[0] || (DEPARTMENTS.includes(employee.department) ? employee.department : DEPARTMENTS[0]);

    const deptSelect = $("#nlDepartment");
    deptSelect.innerHTML = DEPARTMENTS.map(dept => `<option value="${dept}">${dept}</option>`).join("");
    deptSelect.value = startDepartment;

    const now = new Date();
    $("#nlMonth").innerHTML = MONTHS.map((name, index) => `<option value="${String(index + 1).padStart(2, "0")}">${capitalize(name)}</option>`).join("");
    $("#nlYear").innerHTML = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1]
      .map(year => `<option value="${year}">${year}</option>`).join("");
    setMonthControls(monthKeyOf(now));

    const change = () => openLetter($("#nlDepartment").value, `${$("#nlYear").value}-${$("#nlMonth").value}`);
    deptSelect.addEventListener("change", change);
    $("#nlMonth").addEventListener("change", change);
    $("#nlYear").addEventListener("change", change);

    $("#nlPublishBtn").addEventListener("click", togglePublish);
    $("#nlPrintBtn").addEventListener("click", printLetter);
    $("#nlCopyTextBtn").addEventListener("click", copyText);

    await openLetter(startDepartment, monthKeyOf(now));
  }

  init();
})();
