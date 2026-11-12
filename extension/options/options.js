// Options page controller. The phonetic engine comes from ../lib/engine.js.
const E = globalThis.SEBanglishEngine;

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
  customDictionary: {},
  disabledSites: [],
};
const DEFAULT_STATS = { wordsTyped: 0, charsTyped: 0, bnWords: 0, enWords: 0 };
const BOOLEAN_KEYS = ["enabled", "candidateWindow", "autoCorrect", "autoSpace", "rememberLastLanguage", "floatingIndicator"];
// chrome.storage.sync allows 8 KB per item; leave headroom for the key itself.
const DICT_BYTE_LIMIT = 7800;

const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));
const byteSize = (obj) => new TextEncoder().encode(JSON.stringify(obj)).length;

function applyTheme(theme) {
  if (theme === "light" || theme === "dark") document.documentElement.dataset.theme = theme;
  else document.documentElement.removeAttribute("data-theme");
}

const loadState = () => chrome.storage.sync.get(DEFAULTS);

// Accept only well-formed Banglish → Bangla pairs.
function sanitizeDictionary(input) {
  const out = {};
  if (!input || typeof input !== "object" || Array.isArray(input)) return out;
  for (const [k, v] of Object.entries(input)) {
    if (typeof v !== "string") continue;
    const key = String(k).trim().toLowerCase();
    const val = v.trim();
    if (/^[a-z][a-z0-9^:`]{0,39}$/.test(key) && val && val.length <= 80) out[key] = val;
  }
  return out;
}

function sanitizeSites(input) {
  if (!Array.isArray(input)) return [];
  return [...new Set(input.filter((h) => typeof h === "string" && /^[a-z0-9.-]{1,253}$/i.test(h)))].sort();
}

// Keep only known settings with valid values from an imported backup.
function sanitizeSettings(data) {
  const out = {};
  if (!data || typeof data !== "object") return out;
  for (const k of BOOLEAN_KEYS) if (typeof data[k] === "boolean") out[k] = data[k];
  if (data.language === "bn" || data.language === "en") out.language = data.language;
  if (["light", "dark", "system"].includes(data.theme)) out.theme = data.theme;
  if ("customDictionary" in data) out.customDictionary = sanitizeDictionary(data.customDictionary);
  if ("disabledSites" in data) out.disabledSites = sanitizeSites(data.disabledSites);
  return out;
}

function emptyRow(text) {
  const div = document.createElement("div");
  div.className = "list-empty";
  div.textContent = text;
  return div;
}

function paintDict(dict) {
  const list = $("#dict-list");
  list.textContent = "";
  const entries = Object.entries(dict).sort((a, b) => a[0].localeCompare(b[0]));
  if (entries.length === 0) {
    list.appendChild(emptyRow("No custom words yet. Add one above."));
    return;
  }
  for (const [k, v] of entries) {
    const row = document.createElement("div");
    row.className = "dict-row";
    const key = document.createElement("span");
    key.textContent = k;
    const val = document.createElement("span");
    val.className = "bn";
    val.textContent = v;
    const del = document.createElement("button");
    del.className = "btn danger";
    del.textContent = "Remove";
    del.dataset.del = k;
    del.setAttribute("aria-label", `Remove ${k}`);
    row.append(key, val, del);
    list.appendChild(row);
  }
}

function paintSites(sites) {
  const list = $("#site-list");
  list.textContent = "";
  if (sites.length === 0) {
    list.appendChild(emptyRow("Typing is on for every site."));
    return;
  }
  for (const host of sites) {
    const row = document.createElement("div");
    row.className = "dict-row site-row";
    const name = document.createElement("span");
    name.textContent = host;
    const del = document.createElement("button");
    del.className = "btn";
    del.textContent = "Turn back on";
    del.dataset.site = host;
    row.append(name, del);
    list.appendChild(row);
  }
}

async function paintLocal() {
  const { stats, learned } = await chrome.storage.local.get({ stats: DEFAULT_STATS, learned: {} });
  const s = { ...DEFAULT_STATS, ...stats };
  $("#stat-words").textContent = s.wordsTyped.toLocaleString();
  $("#stat-chars").textContent = s.charsTyped.toLocaleString();
  $("#stat-bn").textContent = s.bnWords.toLocaleString();
  $("#stat-en").textContent = s.enWords.toLocaleString();
  $("#stat-mostused").textContent =
    s.bnWords === 0 && s.enWords === 0 ? "—" : s.bnWords >= s.enWords ? "বাংলা (Bangla)" : "English";

  const count = Object.keys(learned || {}).length;
  $("#learned-hint").textContent =
    count === 0
      ? "Words you pick from the suggestion window are remembered on this device"
      : `${count.toLocaleString()} remembered ${count === 1 ? "choice" : "choices"} on this device`;
  $("#learned-clear").disabled = count === 0;
  E.setLearned(learned || {});
}

function paint(state) {
  $$("input[data-setting]").forEach((el) => {
    if (el.type === "checkbox") el.checked = !!state[el.dataset.setting];
  });
  $$("select[data-setting]").forEach((el) => { el.value = state[el.dataset.setting]; });
  $$("[data-setting-group]").forEach((group) => {
    const key = group.dataset.settingGroup;
    group.querySelectorAll("button").forEach((b) => {
      b.setAttribute("aria-pressed", b.dataset.value === state[key] ? "true" : "false");
    });
  });
  applyTheme(state.theme);
  const dict = sanitizeDictionary(state.customDictionary);
  paintDict(dict);
  paintSites(sanitizeSites(state.disabledSites));
  E.setCustomDictionary(dict);
  E.setOptions({ autoCorrect: state.autoCorrect !== false });
}

async function update(patch) {
  await chrome.storage.sync.set(patch);
  paint(await loadState());
}

function showDictError(message) {
  const el = $("#dict-error");
  el.textContent = message || "";
  el.hidden = !message;
}

async function saveDictionary(dict) {
  if (byteSize(dict) > DICT_BYTE_LIMIT) {
    showDictError("Your custom dictionary is full — Chrome Sync allows about 8 KB. Remove a few words to add more.");
    return false;
  }
  try {
    await update({ customDictionary: dict });
    showDictError("");
    return true;
  } catch (err) {
    showDictError("Could not save: " + (err?.message || "storage error"));
    return false;
  }
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

  // Custom dictionary
  const addWord = async () => {
    const k = $("#dict-key").value.trim().toLowerCase();
    const v = $("#dict-val").value.trim();
    if (!k || !v) return;
    const entry = sanitizeDictionary({ [k]: v });
    if (!(k in entry)) {
      showDictError("The Banglish side must be a single word made of English letters, for example: rakib");
      return;
    }
    const dict = sanitizeDictionary((await loadState()).customDictionary);
    dict[k] = entry[k];
    if (await saveDictionary(dict)) {
      $("#dict-key").value = "";
      $("#dict-val").value = "";
      $("#dict-key").focus();
    }
  };
  $("#dict-add").addEventListener("click", addWord);
  for (const id of ["#dict-key", "#dict-val"]) {
    $(id).addEventListener("keydown", (e) => { if (e.key === "Enter") addWord(); });
  }
  $("#dict-list").addEventListener("click", async (e) => {
    const key = e.target?.dataset?.del;
    if (!key) return;
    const dict = sanitizeDictionary((await loadState()).customDictionary);
    delete dict[key];
    await saveDictionary(dict);
  });
  $("#site-list").addEventListener("click", async (e) => {
    const host = e.target?.dataset?.site;
    if (!host) return;
    const sites = sanitizeSites((await loadState()).disabledSites).filter((h) => h !== host);
    await update({ disabledSites: sites });
  });
  $("#learned-clear").addEventListener("click", async () => {
    await chrome.storage.local.set({ learned: {} });
    await paintLocal();
  });

  // Shortcuts
  const openShortcuts = () => chrome.tabs.create({ url: "chrome://extensions/shortcuts" });
  $("#open-shortcuts").addEventListener("click", openShortcuts);
  $("#open-shortcuts-2").addEventListener("click", openShortcuts);

  // Backup
  $("#export-btn").addEventListener("click", async () => {
    const state = await loadState();
    const backup = { app: "se-banglish-avro", version: chrome.runtime.getManifest().version, ...state };
    const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `se-banglish-settings-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  $("#import-file").addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const hint = $("#import-hint");
    try {
      const settings = sanitizeSettings(JSON.parse(await file.text()));
      if (Object.keys(settings).length === 0) throw new Error("no settings found in this file");
      if (settings.customDictionary && byteSize(settings.customDictionary) > DICT_BYTE_LIMIT) {
        throw new Error("the dictionary in this file is larger than Chrome Sync allows (about 8 KB)");
      }
      await update(settings);
      const words = Object.keys(settings.customDictionary || {}).length;
      hint.textContent = `Imported — ${words.toLocaleString()} custom ${words === 1 ? "word" : "words"} restored.`;
    } catch (err) {
      hint.textContent = "Import failed: " + (err?.message || "invalid backup file") + ".";
    }
  });
  $("#reset-btn").addEventListener("click", async () => {
    if (!confirm("Reset all settings to defaults? Your custom dictionary will be kept.")) return;
    const customDictionary = sanitizeDictionary((await loadState()).customDictionary);
    await chrome.storage.sync.clear();
    await update({ ...DEFAULTS, customDictionary });
  });

  // "Try it" box — the same engine and dictionary the content script uses.
  const tryEl = $("#try-input");
  tryEl.addEventListener("keydown", (e) => {
    if (e.isComposing || e.ctrlKey || e.metaKey || e.altKey) return;
    const endsWord = e.key === "Enter" || (e.key.length === 1 && !E.isWordChar(e.key));
    if (!endsWord) return;
    const val = tryEl.value;
    const pos = tryEl.selectionStart;
    let start = pos;
    while (start > 0 && E.isWordChar(val[start - 1])) start--;
    const word = val.slice(start, pos);
    if (!word || !E.hasLetter(word)) return;
    const bn = E.transliterate(word);
    if (!bn || bn === word) return;
    tryEl.setSelectionRange(start, pos);
    if (!document.execCommand("insertText", false, bn)) tryEl.setRangeText(bn, start, pos, "end");
  });
}

async function loadEngineDictionary() {
  try {
    const res = await fetch(chrome.runtime.getURL("dictionary/core.json"));
    E.setDictionary(await res.json());
    const lex = await fetch(chrome.runtime.getURL("dictionary/lexicon.txt"));
    if (lex.ok) E.setLexicon(await lex.text());
  } catch (_) {
    // the rule-based engine still works without them
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  $("#version").textContent = "Version " + chrome.runtime.getManifest().version;
  bindNav();
  bindControls();
  loadEngineDictionary();
  paint(await loadState());
  await paintLocal();
  chrome.storage.onChanged.addListener(async (_changes, area) => {
    if (area === "sync") paint(await loadState());
    else if (area === "local") paintLocal();
  });
});
