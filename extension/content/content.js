// SE Banglish Avro — content script (self-contained, all frames)
// No ES module imports (content scripts can't use them without bundling).

(() => {
  if (window.__SE_BANGLISH_LOADED__) return;
  window.__SE_BANGLISH_LOADED__ = true;

  // ============================================================
  // Settings
  // ============================================================
  const DEFAULTS = {
    enabled: true,
    language: "bn",
    candidateWindow: true,
    autoCorrect: true,
    autoSpace: false,
    floatingIndicator: true,
    customDictionary: {},
  };
  const settings = { ...DEFAULTS };
  let dictionary = {};

  try {
    chrome.storage.sync.get(DEFAULTS, (s) => Object.assign(settings, s));
    chrome.storage.onChanged.addListener((ch, area) => {
      if (area !== "sync") return;
      for (const k in ch) settings[k] = ch[k].newValue;
      updateIndicator();
    });
    chrome.runtime.onMessage.addListener((msg) => {
      if (msg?.type === "SE_LANG_CHANGED") {
        settings.language = msg.language;
        flashIndicator(true);
      }
    });
    fetch(chrome.runtime.getURL("dictionary/core.json"))
      .then((r) => r.json())
      .then((d) => (dictionary = d))
      .catch(() => {});
  } catch (_) {
    // running outside extension context (e.g. dev)
  }

  // ============================================================
  // Avro-style phonetic engine
  // ============================================================
  const CONSONANTS = {
    "kh": "খ", "gh": "ঘ", "Ng": "ঙ",
    "chh": "ছ", "ch": "ছ", "jh": "ঝ", "NG": "ঞ",
    "Th": "ঠ", "Dh": "ঢ",
    "th": "থ", "dh": "ধ",
    "ph": "ফ", "bh": "ভ",
    "sh": "শ", "Sh": "ষ", "ss": "স",
    "Rh": "ঢ়",
    "k": "ক", "g": "গ",
    "c": "চ", "j": "জ",
    "T": "ট", "D": "ড", "N": "ণ",
    "t": "ত", "d": "দ", "n": "ন",
    "p": "প", "f": "ফ", "b": "ব", "v": "ভ", "m": "ম",
    "z": "য", "y": "য়", "l": "ল",
    "s": "স", "h": "হ",
    "R": "ড়", "Y": "য়", "w": "ওয়",
    "ng": "ং",
  };
  // Special conjuncts (juktakkhor) — checked before generic consonants.
  // Each maps a Banglish cluster to the exact Bangla ligature.
  const CLUSTERS = {
    "kkh": "ক্ষ", "ksh": "ক্ষ", "kSh": "ক্ষ", "kx": "ক্ষ",
    "jNG": "জ্ঞ", "gg": "জ্ঞ", "gy": "জ্ঞ", "jny": "জ্ঞ",
    "hm": "হ্ম", "hn": "হ্ন", "hN": "হ্ণ", "hl": "হ্ল", "hb": "হ্ব", "hw": "হ্ব", "hy": "হ্য", "hr": "হ্র",
    "ttw": "ত্ত্ব", "ttv": "ত্ত্ব", "tm": "ত্ম", "tn": "ত্ন", "ty": "ত্য", "tr": "ত্র",
    "shc": "শ্চ", "shch": "শ্ছ", "nc": "ঞ্চ", "nj": "ঞ্জ", "nch": "ঞ্ছ", "nchh": "ঞ্ছ",
    "ND": "ণ্ড", "NT": "ণ্ট", "NTh": "ণ্ঠ", "NDh": "ণ্ঢ", "Nn": "ণ্ন", "Nm": "ণ্ম",
    "ShT": "ষ্ট", "ShTh": "ষ্ঠ", "ShN": "ষ্ণ", "Shp": "ষ্প", "Shk": "ষ্ক", "Shm": "ষ্ম", "Shl": "ষ্ল",
    "shT": "ষ্ট", "shTh": "ষ্ঠ", "shN": "ষ্ণ",
    "st": "স্ত", "sth": "স্থ", "sn": "স্ন", "sp": "স্প", "sk": "স্ক", "sf": "স্ফ", "sm": "স্ম", "sl": "স্ল", "sr": "স্র", "sw": "স্ব",
    "sht": "স্ত", "shth": "স্থ", "shn": "স্ন",
    "ngg": "ঙ্গ", "ngk": "ঙ্ক", "ngkh": "ঙ্খ", "nggh": "ঙ্ঘ",
    "nt": "ন্ত", "nd": "ন্দ", "ndh": "ন্ধ", "nn": "ন্ন", "nb": "ন্ব", "nm": "ন্ম", "ntr": "ন্ত্র", "ndr": "ন্দ্র",
    "pn": "প্ন", "pl": "প্ল", "ps": "প্স", "pt": "প্ত",
    "mn": "ম্ন", "mp": "ম্প", "mb": "ম্ব", "mbh": "ম্ভ", "mr": "ম্র", "ml": "ম্ল",
    "lp": "ল্প", "lk": "ল্ক", "lT": "ল্ট", "lD": "ল্ড", "lm": "ল্ম", "lb": "ল্ব",
    "ddh": "দ্ধ", "db": "দ্ব", "dv": "দ্ব", "dr": "দ্র", "dy": "দ্য", "dm": "দ্ম",
    "dhb": "ধ্ব", "dhr": "ধ্র", "dhy": "ধ্য",
    "bdh": "ব্ধ", "br": "ব্র", "by": "ব্য", "bl": "ব্ল",
    "cc": "চ্চ", "cch": "চ্ছ", "cchh": "চ্ছ",
    "jj": "জ্জ", "jjh": "জ্ঝ", "jy": "জ্য", "jr": "জ্র",
    "TT": "ট্ট", "Tr": "ট্র",
    "DD": "ড্ড", "Dr": "ড্র",
    "kk": "ক্ক", "kT": "ক্ট", "kt": "ক্ত", "kr": "ক্র", "kl": "ক্ল", "kb": "ক্ব", "km": "ক্ম", "ky": "ক্য",
    "gdh": "গ্ধ", "gn": "গ্ন", "gm": "গ্ম", "gr": "গ্র", "gl": "গ্ল", "gb": "গ্ব",
    "ghn": "ঘ্ন", "ghr": "ঘ্র",
    "shr": "শ্র", "shb": "শ্ব", "shy": "শ্য",
  };
  const VOWELS = {
    "rri": { ind: "ঋ", kar: "ৃ" },
    "OI":  { ind: "ঐ", kar: "ৈ" },
    "oi":  { ind: "ঐ", kar: "ৈ" },
    "OU":  { ind: "ঔ", kar: "ৌ" },
    "ou":  { ind: "ঔ", kar: "ৌ" },
    "aa":  { ind: "আ", kar: "া" },
    "A":   { ind: "আ", kar: "া" },
    "a":   { ind: "আ", kar: "া" },
    "I":   { ind: "ঈ", kar: "ী" },
    "ii":  { ind: "ঈ", kar: "ী" },
    "i":   { ind: "ই", kar: "ি" },
    "U":   { ind: "ঊ", kar: "ূ" },
    "uu":  { ind: "ঊ", kar: "ূ" },
    "u":   { ind: "উ", kar: "ু" },
    "E":   { ind: "এ", kar: "ে" },
    "e":   { ind: "এ", kar: "ে" },
    "O":   { ind: "ও", kar: "ো" },
    "o":   { ind: "অ", kar: "" }, // inherent
  };
  const SYMBOLS = {
    "^": "ঁ",
    ":": "ঃ",
  };
  const PUNCT_MAP = { ".": "।" };
  const CASE_INSENSITIVE = /[JCKGBPMLHFVWZ]/g;
  function normalizeCase(s) { return s.replace(CASE_INSENSITIVE, (c) => c.toLowerCase()); }
  // Special: "rr" before consonant = reph (র্)
  const TOKENS = [
    ...Object.keys(VOWELS),
    ...Object.keys(CONSONANTS),
    ...Object.keys(CLUSTERS),
    ...Object.keys(SYMBOLS),
    "rr",
    "r",
  ].sort((a, b) => b.length - a.length);

  const DIGIT_MAP = { "0":"০","1":"১","2":"২","3":"৩","4":"৪","5":"৫","6":"৬","7":"৭","8":"৮","9":"৯" };

  function transliterate(latin) {
    if (!latin) return "";
    // whole-word dictionary override (case-insensitive)
    const key = latin.toLowerCase();
    if (settings.customDictionary && settings.customDictionary[key]) return settings.customDictionary[key];
    if (dictionary[key]) return dictionary[key];
    latin = normalizeCase(latin);
    let i = 0, out = "", prev = "start";
    while (i < latin.length) {
      let matched = null;
      for (const t of TOKENS) {
        if (latin.startsWith(t, i)) { matched = t; break; }
      }
      if (!matched) {
        const ch = latin[i];
        if (DIGIT_MAP[ch]) { out += DIGIT_MAP[ch]; prev = "other"; }
        else if (PUNCT_MAP[ch]) { out += PUNCT_MAP[ch]; prev = "other"; }
        else { out += ch; prev = "other"; }
        i++;
        continue;
      }
      i += matched.length;
      if (CLUSTERS[matched]) {
        const g = CLUSTERS[matched];
        // If cluster starts with a vowel kar we cannot join to prev; safe by design (all clusters start with a consonant).
        out += (prev === "consonant") ? "্" + g : g;
        // If cluster ends with a kar (contains া, ে, etc. at tail) treat as vowel-terminated
        const last = g[g.length - 1];
        prev = /[\u09BE-\u09CC\u09D7]/.test(last) ? "vowel" : "consonant";
        continue;
      }
      if (matched === "rr") {
        // reph — if followed by a consonant token, emit র্ and skip auto-hasanta on next
        out += "র্";
        prev = "ref";
        continue;
      }
      if (matched === "r") {
        // regular র
        if (prev === "consonant") out += "্র";
        else out += "র";
        prev = "consonant";
        continue;
      }
      if (VOWELS[matched]) {
        const v = VOWELS[matched];
        out += (prev === "consonant" || prev === "ref") ? v.kar : v.ind;
        prev = "vowel";
        continue;
      }
      if (CONSONANTS[matched]) {
        const c = CONSONANTS[matched];
        if (matched === "ng") { out += c; prev = "vowel"; continue; }
        if (prev === "consonant") out += "্" + c;
        else out += c;
        prev = "consonant";
        continue;
      }
      if (SYMBOLS[matched]) {
        out += SYMBOLS[matched];
        // symbols don't change prev meaningfully
        continue;
      }
    }
    return out;
  }

  function suggest(latin) {
    const key = latin.toLowerCase();
    const results = [];
    const primary = transliterate(latin);
    results.push(primary);
    // Dictionary prefix matches (up to 6)
    const custom = settings.customDictionary || {};
    const pool = { ...dictionary, ...custom };
    const hits = [];
    for (const k in pool) {
      if (k.startsWith(key) && k !== key) hits.push(pool[k]);
      if (hits.length >= 8) break;
    }
    for (const h of hits) if (!results.includes(h)) results.push(h);
    return results.slice(0, 8);
  }

  // ============================================================
  // Editable detection + word replacement
  // ============================================================
  function isEditable(el) {
    if (!el) return false;
    if (el.isContentEditable) return true;
    const tag = el.tagName;
    if (tag === "TEXTAREA") return !el.readOnly && !el.disabled;
    if (tag === "INPUT") {
      const t = (el.type || "text").toLowerCase();
      return ["text","search","url","email","tel",""].includes(t) && !el.readOnly && !el.disabled;
    }
    return false;
  }

  function getWordBeforeCaret(el) {
    if (el.tagName === "TEXTAREA" || el.tagName === "INPUT") {
      const val = el.value;
      const pos = el.selectionStart ?? val.length;
      let start = pos;
      while (start > 0 && /[A-Za-z^:0-9]/.test(val[start - 1])) start--;
      return { text: val.slice(start, pos), start, end: pos };
    }
    // contenteditable
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return null;
    const range = sel.getRangeAt(0);
    if (!range.collapsed) return null;
    const node = range.startContainer;
    if (node.nodeType !== Node.TEXT_NODE) return null;
    const offset = range.startOffset;
    const text = node.data;
    let start = offset;
    while (start > 0 && /[A-Za-z^:0-9]/.test(text[start - 1])) start--;
    return { text: text.slice(start, offset), start, end: offset, node };
  }

  function replaceWord(el, info, replacement) {
    if (el.tagName === "TEXTAREA" || el.tagName === "INPUT") {
      const val = el.value;
      el.value = val.slice(0, info.start) + replacement + val.slice(info.end);
      const caret = info.start + replacement.length;
      el.setSelectionRange(caret, caret);
      el.dispatchEvent(new Event("input", { bubbles: true }));
      return;
    }
    // contenteditable: use selection.modify + execCommand insertText so that
    // frameworks like Lexical (Facebook/Messenger), Draft.js, Slate, ProseMirror
    // and CKEditor observe a real beforeinput event and keep their model in sync.
    const sel = window.getSelection();
    if (!sel) return;
    const len = (info.text || "").length;
    if (len > 0) {
      // Collapse to caret first, then extend backward by exact char count.
      try { sel.collapseToEnd(); } catch (_) {}
      for (let i = 0; i < len; i++) sel.modify("extend", "backward", "character");
    }
    let inserted = false;
    try {
      inserted = document.execCommand("insertText", false, replacement);
    } catch (_) {}
    if (!inserted) {
      // Fallback for editors that reject execCommand
      const range = sel.rangeCount ? sel.getRangeAt(0) : document.createRange();
      range.deleteContents();
      const textNode = document.createTextNode(replacement);
      range.insertNode(textNode);
      const r = document.createRange();
      r.setStart(textNode, textNode.length);
      r.collapse(true);
      sel.removeAllRanges();
      sel.addRange(r);
      el.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: replacement }));
    }
  }

  // ============================================================
  // Candidate window (shadow DOM)
  // ============================================================
  let panelHost = null;
  let panelRoot = null;
  let panelListEl = null;
  let panelItems = [];
  let panelIndex = 0;
  let panelTarget = null;
  let panelInfo = null;

  function ensurePanel() {
    if (panelHost) return;
    panelHost = document.createElement("div");
    panelHost.style.cssText = "position:fixed;top:0;left:0;width:0;height:0;z-index:2147483647;pointer-events:none;";
    panelRoot = panelHost.attachShadow({ mode: "open" });
    panelRoot.innerHTML = `
      <style>
        .panel {
          position: fixed; min-width: 180px; max-width: 320px;
          background: rgba(255,255,255,0.92);
          backdrop-filter: blur(20px) saturate(180%);
          -webkit-backdrop-filter: blur(20px) saturate(180%);
          color: #111;
          border-radius: 14px;
          box-shadow: 0 10px 40px rgba(0,0,0,0.18), 0 2px 6px rgba(0,0,0,0.08);
          border: 1px solid rgba(0,0,0,0.06);
          padding: 6px;
          font: 14px/1.4 "Noto Sans Bengali", "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          pointer-events: auto;
          opacity: 0; transform: translateY(4px) scale(0.98);
          transition: opacity 160ms ease, transform 160ms cubic-bezier(0.2, 0.8, 0.2, 1);
          max-height: 300px; overflow-y: auto;
        }
        .panel.open { opacity: 1; transform: translateY(0) scale(1); }
        @media (prefers-color-scheme: dark) {
          .panel { background: rgba(30,30,30,0.92); color: #FAFAFA; border-color: rgba(255,255,255,0.08); }
        }
        .item {
          display: flex; align-items: center; gap: 10px;
          padding: 8px 10px; border-radius: 10px; cursor: pointer;
          transition: background 120ms ease;
        }
        .item:hover { background: rgba(255,159,28,0.12); }
        .item.active { background: linear-gradient(135deg, #FF9F1C, #FFC857); color: #fff; }
        .num { font: 500 11px "Inter", sans-serif; opacity: 0.6; min-width: 14px; }
        .item.active .num { opacity: 0.95; color: #fff; }
        .txt { flex: 1; font-size: 15px; }
      </style>
      <div class="panel" role="listbox" aria-label="Bangla suggestions"></div>
    `;
    panelListEl = panelRoot.querySelector(".panel");
    document.documentElement.appendChild(panelHost);
  }

  function showPanel(target, info, items) {
    ensurePanel();
    panelTarget = target;
    panelInfo = info;
    panelItems = items;
    panelIndex = 0;
    renderPanel();
    positionPanel(target);
    requestAnimationFrame(() => panelListEl.classList.add("open"));
  }

  function renderPanel() {
    if (!panelListEl) return;
    panelListEl.innerHTML = "";
    panelItems.forEach((txt, i) => {
      const row = document.createElement("div");
      row.className = "item" + (i === panelIndex ? " active" : "");
      row.setAttribute("role", "option");
      row.innerHTML = `<span class="num">${i + 1}</span><span class="txt"></span>`;
      row.querySelector(".txt").textContent = txt;
      row.addEventListener("mousedown", (e) => {
        e.preventDefault();
        commitPanel(i);
      });
      panelListEl.appendChild(row);
    });
  }

  function positionPanel(target) {
    let rect;
    if (target.tagName === "TEXTAREA" || target.tagName === "INPUT") {
      rect = target.getBoundingClientRect();
    } else {
      const sel = window.getSelection();
      if (sel && sel.rangeCount) {
        const r = sel.getRangeAt(0).getBoundingClientRect();
        rect = r.width || r.height ? r : target.getBoundingClientRect();
      } else {
        rect = target.getBoundingClientRect();
      }
    }
    // Measure panel then flip/shift to stay inside viewport
    panelListEl.style.left = "-9999px";
    panelListEl.style.top = "0px";
    const vw = window.innerWidth, vh = window.innerHeight;
    const pw = panelListEl.offsetWidth || 240;
    const ph = panelListEl.offsetHeight || 200;
    const gap = 6;
    let top = rect.bottom + gap;
    if (top + ph > vh - 8) {
      const above = rect.top - gap - ph;
      top = above >= 8 ? above : Math.max(8, vh - ph - 8);
    }
    let left = rect.left;
    if (left + pw > vw - 8) left = Math.max(8, vw - pw - 8);
    if (left < 8) left = 8;
    panelListEl.style.left = left + "px";
    panelListEl.style.top = top + "px";
  }

  function hidePanel() {
    if (!panelListEl) return;
    panelListEl.classList.remove("open");
    panelItems = [];
    panelTarget = null;
    panelInfo = null;
  }

  function commitPanel(index) {
    if (!panelTarget || !panelInfo) return hidePanel();
    const choice = panelItems[index];
    if (!choice) return hidePanel();
    // refresh info in case caret moved
    const info = getWordBeforeCaret(panelTarget);
    if (info) replaceWord(panelTarget, info, choice);
    updateStats(choice);
    hidePanel();
  }

  // ============================================================
  // Stats
  // ============================================================
  let statsQueue = { words: 0, chars: 0, bn: 0, en: 0 };
  let statsTimer = null;
  function updateStats(text) {
    statsQueue.words += 1;
    statsQueue.chars += [...text].length;
    if (settings.language === "bn") statsQueue.bn += 1; else statsQueue.en += 1;
    if (statsTimer) return;
    statsTimer = setTimeout(() => {
      try { chrome.runtime.sendMessage({ type: "SE_UPDATE_STATS", ...statsQueue }); } catch (_) {}
      statsQueue = { words: 0, chars: 0, bn: 0, en: 0 };
      statsTimer = null;
    }, 1500);
  }

  // ============================================================
  // Event handling
  // ============================================================
  document.addEventListener("keydown", (e) => {
    if (!settings.enabled || settings.language !== "bn") return;
    const el = e.target;
    if (!isEditable(el)) return;

    // Panel navigation
    if (panelItems.length && panelTarget === el) {
      if (e.key === "ArrowDown") { e.preventDefault(); panelIndex = (panelIndex + 1) % panelItems.length; renderPanel(); return; }
      if (e.key === "ArrowUp")   { e.preventDefault(); panelIndex = (panelIndex - 1 + panelItems.length) % panelItems.length; renderPanel(); return; }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        commitPanel(panelIndex);
        return;
      }
      if (e.key === "Escape") { e.preventDefault(); hidePanel(); return; }
      if (/^[1-9]$/.test(e.key) && (e.ctrlKey || e.metaKey || e.altKey)) {
        const idx = parseInt(e.key, 10) - 1;
        if (idx < panelItems.length) { e.preventDefault(); commitPanel(idx); return; }
      }
    }

    // Commit on space / punctuation
    if (e.key === " " || e.key === "Enter" || /^[.,!?;:।]$/.test(e.key)) {
      const info = getWordBeforeCaret(el);
      if (info && info.text.length > 0 && /[A-Za-z]/.test(info.text)) {
        const bn = transliterate(info.text);
        if (bn && bn !== info.text) {
          replaceWord(el, info, bn);
          updateStats(bn);
        }
      }
      // Map "." to Bangla dari "।"
      if (e.key === ".") {
        e.preventDefault();
        insertAtCaret(el, "।");
      }
      hidePanel();
    }
  }, true);

  function insertAtCaret(el, str) {
    if (el.tagName === "TEXTAREA" || el.tagName === "INPUT") {
      const val = el.value;
      const pos = el.selectionStart ?? val.length;
      el.value = val.slice(0, pos) + str + val.slice(el.selectionEnd ?? pos);
      const c = pos + str.length;
      el.setSelectionRange(c, c);
      el.dispatchEvent(new Event("input", { bubbles: true }));
      return;
    }
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    range.deleteContents();
    const node = document.createTextNode(str);
    range.insertNode(node);
    const r = document.createRange();
    r.setStart(node, node.length);
    r.collapse(true);
    sel.removeAllRanges();
    sel.addRange(r);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }

  document.addEventListener("input", (e) => {
    if (!settings.enabled || settings.language !== "bn") return;
    const el = e.target;
    if (!isEditable(el)) return;
    if (!settings.candidateWindow) return;
    const info = getWordBeforeCaret(el);
    if (!info || info.text.length < 1 || !/[A-Za-z]/.test(info.text)) { hidePanel(); return; }
    const items = suggest(info.text);
    if (items.length === 0) { hidePanel(); return; }
    showPanel(el, info, items);
  }, true);

  document.addEventListener("focusout", () => hidePanel(), true);
  window.addEventListener("scroll", () => hidePanel(), true);
  window.addEventListener("resize", () => hidePanel());

  // ============================================================
  // Floating status indicator
  // ============================================================
  let indicatorHost = null;
  function ensureIndicator() {
    if (indicatorHost) return;
    indicatorHost = document.createElement("div");
    indicatorHost.style.cssText = "position:fixed;right:16px;bottom:16px;z-index:2147483646;pointer-events:none;";
    const root = indicatorHost.attachShadow({ mode: "open" });
    root.innerHTML = `
      <style>
        .pill {
          font: 600 12px/1 "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          padding: 8px 12px; border-radius: 999px;
          background: linear-gradient(135deg, #FF9F1C, #FFC857);
          color: #fff; box-shadow: 0 8px 24px rgba(255,159,28,0.35);
          opacity: 0; transform: translateY(6px);
          transition: opacity 200ms ease, transform 200ms ease;
          letter-spacing: 0.02em;
        }
        .pill.show { opacity: 0.95; transform: translateY(0); }
        .pill.en { background: linear-gradient(135deg, #444, #666); box-shadow: 0 6px 18px rgba(0,0,0,0.2); }
      </style>
      <div class="pill" id="pill"></div>
    `;
    indicatorHost.__pill = root.getElementById("pill");
    document.documentElement.appendChild(indicatorHost);
  }
  let indicatorTimer = null;
  function updateIndicator() { flashIndicator(false); }
  function flashIndicator(force) {
    // `force` = show even if the user disabled the ambient floating indicator
    // (used for Ctrl+Space toggles so the language switch is always visible).
    if (!force && (!settings.floatingIndicator || !settings.enabled)) {
      if (indicatorHost) indicatorHost.__pill.classList.remove("show");
      return;
    }
    ensureIndicator();
    const p = indicatorHost.__pill;
    p.textContent = settings.language === "bn" ? "বাংলা" : "English";
    p.classList.toggle("en", settings.language !== "bn");
    p.classList.add("show");
    clearTimeout(indicatorTimer);
    indicatorTimer = setTimeout(() => p.classList.remove("show"), 1400);
  }

  // expose engine for tests
  window.__SE_TRANSLIT = transliterate;
})();