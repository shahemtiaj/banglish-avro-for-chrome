const DEFAULTS = {
  enabled: true,
  language: "bn",
  candidateWindow: true,
  autoCorrect: true,
  autoSpace: false,
  rememberLastLanguage: true,
  floatingIndicator: true,
  theme: "system",
  layout: "avro",
  stats: { wordsTyped: 0, charsTyped: 0, bnWords: 0, enWords: 0 },
  customDictionary: {},
};

const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));

function applyTheme(theme) {
  if (theme === "system") document.documentElement.removeAttribute("data-theme");
  else document.documentElement.dataset.theme = theme;
}

async function loadState() {
  return chrome.storage.sync.get(DEFAULTS);
}

function paint(state) {
  $$("input[data-setting]").forEach((el) => {
    const k = el.dataset.setting;
    if (el.type === "checkbox") el.checked = !!state[k];
  });
  $$("select[data-setting]").forEach((el) => { el.value = state[el.dataset.setting]; });
  $$("[data-setting-group]").forEach((group) => {
    const key = group.dataset.settingGroup;
    group.querySelectorAll("button").forEach((b) => {
      b.setAttribute("aria-pressed", b.dataset.value === state[key] ? "true" : "false");
    });
  });
  applyTheme(state.theme);

  // stats
  $("#stat-words").textContent = state.stats.wordsTyped.toLocaleString();
  $("#stat-chars").textContent = state.stats.charsTyped.toLocaleString();
  $("#stat-bn").textContent = state.stats.bnWords.toLocaleString();
  $("#stat-en").textContent = state.stats.enWords.toLocaleString();
  const most = state.stats.bnWords === 0 && state.stats.enWords === 0
    ? "—"
    : state.stats.bnWords >= state.stats.enWords ? "বাংলা (Bangla)" : "English";
  $("#stat-mostused").textContent = most;

  paintDict(state.customDictionary || {});
}

function paintDict(dict) {
  const list = $("#dict-list");
  const entries = Object.entries(dict);
  if (entries.length === 0) {
    list.innerHTML = `<div style="padding:24px;text-align:center;color:var(--text-muted)">No custom words yet. Add one above.</div>`;
    return;
  }
  list.innerHTML = "";
  entries.sort((a, b) => a[0].localeCompare(b[0]));
  for (const [k, v] of entries) {
    const row = document.createElement("div");
    row.className = "dict-row";
    row.innerHTML = `<span>${k}</span><span class="bn">${v}</span><button class="btn danger" data-del="${k}">Remove</button>`;
    list.appendChild(row);
  }
}

async function update(patch) {
  await chrome.storage.sync.set(patch);
  paint(await loadState());
}

function bindNav() {
  $$(".nav-item").forEach((btn) => {
    btn.addEventListener("click", () => {
      $$(".nav-item").forEach((b) => { b.classList.remove("active"); b.setAttribute("aria-selected", "false"); });
      btn.classList.add("active");
      btn.setAttribute("aria-selected", "true");
      $$(".section").forEach((s) => s.classList.remove("active"));
      $(`#section-${btn.dataset.section}`).classList.add("active");
    });
  });
}

function bindControls() {
  $$("input[data-setting]").forEach((el) => {
    el.addEventListener("change", () => update({ [el.dataset.setting]: el.type === "checkbox" ? el.checked : el.value }));
  });
  $$("select[data-setting]").forEach((el) => {
    el.addEventListener("change", () => update({ [el.dataset.setting]: el.value }));
  });
  $$("[data-setting-group]").forEach((group) => {
    group.querySelectorAll("button").forEach((b) => {
      b.addEventListener("click", () => update({ [group.dataset.settingGroup]: b.dataset.value }));
    });
  });

  // Dictionary
  $("#dict-add").addEventListener("click", async () => {
    const k = $("#dict-key").value.trim().toLowerCase();
    const v = $("#dict-val").value.trim();
    if (!k || !v) return;
    const { customDictionary } = await loadState();
    customDictionary[k] = v;
    await update({ customDictionary });
    $("#dict-key").value = ""; $("#dict-val").value = "";
  });
  $("#dict-list").addEventListener("click", async (e) => {
    const key = e.target?.dataset?.del;
    if (!key) return;
    const { customDictionary } = await loadState();
    delete customDictionary[key];
    await update({ customDictionary });
  });

  // Shortcuts
  const openShortcuts = () => chrome.tabs.create({ url: "chrome://extensions/shortcuts" });
  $("#open-shortcuts").addEventListener("click", openShortcuts);
  $("#open-shortcuts-2").addEventListener("click", openShortcuts);

  // Backup
  $("#export-btn").addEventListener("click", async () => {
    const state = await loadState();
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `se-banglish-settings-${Date.now()}.json`;
    a.click(); URL.revokeObjectURL(url);
  });
  $("#import-file").addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const txt = await file.text();
    try {
      const data = JSON.parse(txt);
      await chrome.storage.sync.set({ ...DEFAULTS, ...data });
      paint(await loadState());
    } catch (_) {
      alert("Invalid backup file.");
    }
  });
  $("#reset-btn").addEventListener("click", async () => {
    if (!confirm("Reset all settings to defaults? Your custom dictionary will be kept.")) return;
    const { customDictionary } = await loadState();
    await chrome.storage.sync.clear();
    await chrome.storage.sync.set({ ...DEFAULTS, customDictionary });
    paint(await loadState());
  });

  // Try box — replicate simple word-commit for demo
  const tryEl = $("#try-input");
  tryEl.addEventListener("keydown", (e) => {
    if (e.key !== " " && e.key !== "Enter") return;
    const val = tryEl.value;
    const pos = tryEl.selectionStart;
    let start = pos;
    while (start > 0 && /[A-Za-z^:0-9]/.test(val[start - 1])) start--;
    const word = val.slice(start, pos);
    if (!word || !/[A-Za-z]/.test(word)) return;
    // Reuse background-injected engine via a light local port: use fetch of core.json + inline transliterate
    tryTranslit(word).then((bn) => {
      if (!bn || bn === word) return;
      tryEl.value = val.slice(0, start) + bn + val.slice(pos);
      const caret = start + bn.length;
      tryEl.setSelectionRange(caret, caret);
    });
  });
}

// Minimal local transliterator for the "Try it" box, mirrors content engine.
let _dict = null;
async function ensureDict() {
  if (_dict) return _dict;
  try {
    const res = await fetch(chrome.runtime.getURL("dictionary/core.json"));
    _dict = await res.json();
  } catch { _dict = {}; }
  return _dict;
}

const CONSONANTS = { "kh":"খ","gh":"ঘ","Ng":"ঙ","ch":"চ","jh":"ঝ","NG":"ঞ","Th":"ঠ","Dh":"ঢ","th":"থ","dh":"ধ","ph":"ফ","bh":"ভ","sh":"শ","Sh":"ষ","ss":"স","Rh":"ঢ়","k":"ক","g":"গ","c":"চ","j":"জ","T":"ট","D":"ড","N":"ণ","t":"ত","d":"দ","n":"ন","p":"প","f":"ফ","b":"ব","v":"ভ","m":"ম","z":"জ","y":"য়","l":"ল","s":"স","h":"হ","R":"ড়","Y":"য়","w":"ওয়","ng":"ং" };
const VOWELS = { "rri":{ind:"ঋ",kar:"ৃ"},"OI":{ind:"ঐ",kar:"ৈ"},"oi":{ind:"ঐ",kar:"ৈ"},"OU":{ind:"ঔ",kar:"ৌ"},"ou":{ind:"ঔ",kar:"ৌ"},"aa":{ind:"আ",kar:"া"},"A":{ind:"আ",kar:"া"},"a":{ind:"আ",kar:"া"},"I":{ind:"ঈ",kar:"ী"},"ii":{ind:"ঈ",kar:"ী"},"i":{ind:"ই",kar:"ি"},"U":{ind:"ঊ",kar:"ূ"},"uu":{ind:"ঊ",kar:"ূ"},"u":{ind:"উ",kar:"ু"},"E":{ind:"এ",kar:"ে"},"e":{ind:"এ",kar:"ে"},"O":{ind:"ও",kar:"ো"},"o":{ind:"অ",kar:""} };
const SYMBOLS = { "^":"ঁ",":":"ঃ" };
const TOKENS = [...Object.keys(VOWELS), ...Object.keys(CONSONANTS), ...Object.keys(SYMBOLS), "rr", "r"].sort((a, b) => b.length - a.length);

async function tryTranslit(latin) {
  const dict = await ensureDict();
  const key = latin.toLowerCase();
  if (dict[key]) return dict[key];
  let i = 0, out = "", prev = "start";
  while (i < latin.length) {
    let m = null;
    for (const t of TOKENS) if (latin.startsWith(t, i)) { m = t; break; }
    if (!m) { out += latin[i++]; prev = "other"; continue; }
    i += m.length;
    if (m === "rr") { out += "র্"; prev = "ref"; continue; }
    if (m === "r") { out += prev === "consonant" ? "্র" : "র"; prev = "consonant"; continue; }
    if (VOWELS[m]) { const v = VOWELS[m]; out += (prev === "consonant" || prev === "ref") ? v.kar : v.ind; prev = "vowel"; continue; }
    if (CONSONANTS[m]) { const c = CONSONANTS[m]; if (m === "ng") { out += c; prev = "vowel"; continue; } out += prev === "consonant" ? "্" + c : c; prev = "consonant"; continue; }
    if (SYMBOLS[m]) { out += SYMBOLS[m]; continue; }
  }
  return out;
}

document.addEventListener("DOMContentLoaded", async () => {
  bindNav();
  bindControls();
  paint(await loadState());
});