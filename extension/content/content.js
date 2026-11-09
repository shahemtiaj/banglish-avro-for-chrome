// SE Banglish Avro — content script (all frames).
// Depends on lib/engine.js, which the manifest loads first.

(() => {
  const E = globalThis.SEBanglishEngine;
  if (!E) return;

  // ============================================================
  // Single live instance per frame
  // ============================================================
  // After an extension update Chrome re-injects this file while the previous
  // copy is still attached to the page with a dead chrome.* API. The new copy
  // asks any older one to detach, so a keystroke is never handled twice.
  const TEARDOWN_EVENT = "se-banglish-teardown";
  const alive = () => { try { return !!chrome.runtime.id; } catch (_) { return false; } };
  const previous = window.__SE_BANGLISH__;
  if (previous && previous.alive && previous.alive()) return;
  try { if (previous && previous.teardown) previous.teardown(); } catch (_) {}
  try { document.dispatchEvent(new CustomEvent(TEARDOWN_EVENT)); } catch (_) {}

  const ac = new AbortController();
  const on = (target, type, fn, capture) =>
    target.addEventListener(type, fn, { capture: !!capture, signal: ac.signal });

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
    theme: "system",
    customDictionary: {},
    disabledSites: [],
  };
  const settings = { ...DEFAULTS };
  const IS_TOP = (() => { try { return window.top === window; } catch (_) { return false; } })();

  // Per-site switch follows the page the user sees, so iframes obey the top page.
  const SITE_HOST = (() => {
    try {
      if (IS_TOP) return location.hostname;
      const anc = location.ancestorOrigins;
      if (anc && anc.length) return new URL(anc[anc.length - 1]).hostname;
    } catch (_) {}
    return location.hostname;
  })();
  let siteOff = false;
  let learned = {};

  function applySettings() {
    E.setCustomDictionary(settings.customDictionary || {});
    E.setOptions({ autoCorrect: settings.autoCorrect !== false });
    siteOff = Array.isArray(settings.disabledSites) && !!SITE_HOST && settings.disabledSites.includes(SITE_HOST);
  }
  const active = () => settings.enabled && settings.language === "bn" && !siteOff;

  function onStorageChanged(changes, area) {
    if (area === "sync") {
      for (const k in changes) {
        if (k in DEFAULTS) settings[k] = changes[k].newValue === undefined ? DEFAULTS[k] : changes[k].newValue;
      }
      applySettings();
      if (!active()) hidePanel();
      if ("language" in changes || "enabled" in changes || "disabledSites" in changes) flashIndicator(false);
    } else if (area === "local" && changes.learned) {
      learned = changes.learned.newValue || {};
      E.setLearned(learned);
    }
  }
  function onMessage(msg) {
    if (msg && msg.type === "SE_LANG_CHANGED") {
      settings.language = msg.language;
      flashIndicator(true);
    }
  }

  try {
    chrome.storage.sync.get(DEFAULTS, (s) => { Object.assign(settings, s); applySettings(); });
    chrome.storage.local.get({ learned: {} }, (s) => { learned = s.learned || {}; E.setLearned(learned); });
    chrome.storage.onChanged.addListener(onStorageChanged);
    chrome.runtime.onMessage.addListener(onMessage);
  } catch (_) {
    // running outside an extension context (tests)
  }

  // The 200 KB dictionary is only requested by frames the user actually types
  // in, and comes from the service worker rather than a web-accessible URL.
  let dictRequested = false;
  function ensureDictionary() {
    if (dictRequested) return;
    dictRequested = true;
    try {
      chrome.runtime.sendMessage({ type: "SE_GET_DICTIONARY" }, (dict) => {
        if (chrome.runtime.lastError || !dict) { dictRequested = false; return; }
        E.setDictionary(dict);
      });
    } catch (_) { dictRequested = false; }
  }

  // ============================================================
  // Editable detection
  // ============================================================
  const TEXT_INPUT_TYPES = new Set(["text", "search", ""]);
  const SKIP_INPUTMODE = new Set(["numeric", "decimal", "tel", "email", "url"]);
  const SKIP_AUTOCOMPLETE = /(^|\s)(username|email|current-password|new-password|one-time-code|url|tel[\w-]*|cc-[\w-]+|postal-code|bday[\w-]*)(\s|$)/i;
  const SKIP_NAME = /^(e-?mail|user[-_]?(name|id)?|login|passw(or)?d|otp|captcha|phone|mobile|url)$/i;

  const isField = (el) => el.tagName === "TEXTAREA" || el.tagName === "INPUT";

  function isEditable(el) {
    if (!el || el.nodeType !== 1) return false;
    if (el.isContentEditable) return true;
    if (el.tagName === "TEXTAREA") return !el.readOnly && !el.disabled;
    if (el.tagName !== "INPUT") return false;
    if (el.readOnly || el.disabled) return false;
    if (!TEXT_INPUT_TYPES.has((el.type || "text").toLowerCase())) return false;
    // Bangla has no business in e-mail, username, OTP, phone or card fields.
    if (SKIP_INPUTMODE.has((el.inputMode || "").toLowerCase())) return false;
    if (SKIP_AUTOCOMPLETE.test(el.autocomplete || "")) return false;
    if (SKIP_NAME.test(el.name || "") || SKIP_NAME.test(el.id || "")) return false;
    return true;
  }

  // Resolve the innermost target, seeing through shadow roots (web-component
  // based editors) and falling back to the deep active element.
  function eventTarget(e) {
    let t = null;
    try { const p = e.composedPath && e.composedPath(); if (p && p.length) t = p[0]; } catch (_) {}
    if (!t || t.nodeType !== 1) t = e.target;
    if (!isEditable(t)) {
      const a = deepActiveElement();
      if (a && isEditable(a)) t = a;
    }
    return t;
  }
  function deepActiveElement() {
    let a = document.activeElement;
    let guard = 0;
    while (a && a.shadowRoot && a.shadowRoot.activeElement && guard++ < 10) a = a.shadowRoot.activeElement;
    return a;
  }

  // ============================================================
  // Reading and replacing text at the caret
  // ============================================================
  // Returns the text in front of the caret: { text, pos, node? }.
  function beforeCaret(el) {
    if (isField(el)) {
      const pos = el.selectionStart == null ? el.value.length : el.selectionStart;
      if (el.selectionEnd != null && el.selectionEnd !== pos) return null;
      return { text: el.value, pos };
    }
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return null;
    const range = sel.getRangeAt(0);
    if (!range.collapsed) return null;
    const node = range.startContainer;
    if (node.nodeType !== Node.TEXT_NODE) return null;
    return { text: node.data, pos: range.startOffset, node };
  }

  function getWordBeforeCaret(el) {
    const ctx = beforeCaret(el);
    if (!ctx) return null;
    let start = ctx.pos;
    while (start > 0 && E.isWordChar(ctx.text[start - 1])) start--;
    return { text: ctx.text.slice(start, ctx.pos), start, end: ctx.pos, node: ctx.node };
  }

  // Our own edits fire input events; this keeps the input listener out of them.
  let selfEdit = 0;

  function insertText(el, str) {
    let ok = false;
    try { ok = document.execCommand("insertText", false, str); } catch (_) {}
    if (ok) return;
    if (isField(el)) {
      const val = el.value;
      const s = el.selectionStart == null ? val.length : el.selectionStart;
      const e2 = el.selectionEnd == null ? s : el.selectionEnd;
      el.value = val.slice(0, s) + str + val.slice(e2);
      const c = s + str.length;
      el.setSelectionRange(c, c);
    } else {
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
    }
    el.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: str }));
  }

  // Replace the `count` UTF-16 units before the caret with `replacement`.
  // execCommand("insertText") is used on a real selection so that React inputs,
  // CodeMirror/Monaco textareas and rich editors (Lexical, Draft.js, Slate,
  // ProseMirror, CKEditor) see a genuine beforeinput/input and stay in sync.
  function replaceBeforeCaret(el, info, replacement, exactRange) {
    selfEdit++;
    try {
      const count = info.end - info.start;
      if (isField(el)) {
        try { el.setSelectionRange(info.start, info.end); } catch (_) {}
      } else {
        const sel = window.getSelection();
        if (!sel) return;
        if (exactRange && info.node) {
          // Bangla text: caret stops are grapheme clusters, so select by offsets.
          sel.setBaseAndExtent(info.node, info.start, info.node, info.end);
        } else {
          try { sel.collapseToEnd(); } catch (_) {}
          for (let i = 0; i < count; i++) sel.modify("extend", "backward", "character");
        }
      }
      insertText(el, replacement);
    } finally {
      selfEdit--;
    }
  }

  // ============================================================
  // Caret position (for placing the candidate window)
  // ============================================================
  const MIRROR_PROPS = [
    "direction", "boxSizing", "width", "height", "overflowX", "overflowY",
    "borderTopWidth", "borderRightWidth", "borderBottomWidth", "borderLeftWidth", "borderStyle",
    "paddingTop", "paddingRight", "paddingBottom", "paddingLeft",
    "fontStyle", "fontVariant", "fontWeight", "fontStretch", "fontSize", "fontSizeAdjust",
    "lineHeight", "fontFamily", "textAlign", "textTransform", "textIndent",
    "letterSpacing", "wordSpacing", "tabSize",
  ];

  function fieldCaretRect(el) {
    const box = el.getBoundingClientRect();
    try {
      const pos = el.selectionStart == null ? el.value.length : el.selectionStart;
      const cs = getComputedStyle(el);
      const mirror = document.createElement("div");
      const st = mirror.style;
      for (const p of MIRROR_PROPS) st[p] = cs[p];
      st.position = "absolute"; st.visibility = "hidden"; st.pointerEvents = "none";
      st.top = "0"; st.left = "-99999px";
      st.whiteSpace = el.tagName === "INPUT" ? "pre" : "pre-wrap";
      st.overflowWrap = "break-word";
      if (el.tagName === "INPUT") st.overflow = "hidden";
      mirror.textContent = el.value.slice(0, pos);
      const marker = document.createElement("span");
      marker.textContent = el.value.slice(pos, pos + 1) || ".";
      mirror.appendChild(marker);
      (document.body || document.documentElement).appendChild(mirror);
      const lineHeight = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.25 || 18;
      let top = box.top + marker.offsetTop + (parseFloat(cs.borderTopWidth) || 0) - el.scrollTop;
      let left = box.left + marker.offsetLeft + (parseFloat(cs.borderLeftWidth) || 0) - el.scrollLeft;
      mirror.remove();
      top = Math.min(Math.max(top, box.top), Math.max(box.top, box.bottom - lineHeight));
      left = Math.min(Math.max(left, box.left), box.right);
      return { left, right: left, top, bottom: top + lineHeight, width: 0, height: lineHeight };
    } catch (_) {
      return box;
    }
  }

  function caretRect(target) {
    if (isField(target)) return fieldCaretRect(target);
    const sel = window.getSelection();
    if (sel && sel.rangeCount) {
      const r = sel.getRangeAt(0).getBoundingClientRect();
      if (r.width || r.height) return r;
    }
    return target.getBoundingClientRect();
  }

  // ============================================================
  // Candidate window (shadow DOM)
  // ============================================================
  let panelHost = null;
  let panelListEl = null;
  let panelItems = [];
  let panelIndex = 0;
  let panelTarget = null;
  let panelLatin = "";

  const isDark = () =>
    settings.theme === "dark" ||
    (settings.theme !== "light" && window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches);

  function ensurePanel() {
    if (panelHost) return;
    panelHost = document.createElement("div");
    panelHost.style.cssText = "all:initial;position:fixed;top:0;left:0;width:0;height:0;z-index:2147483647;pointer-events:none;";
    const root = panelHost.attachShadow({ mode: "open" });
    root.innerHTML = `
      <style>
        .panel {
          position: fixed; min-width: 180px; max-width: 320px;
          background: rgba(255,255,255,0.96);
          backdrop-filter: blur(20px) saturate(180%);
          -webkit-backdrop-filter: blur(20px) saturate(180%);
          color: #111;
          border-radius: 14px;
          box-shadow: 0 10px 40px rgba(0,0,0,0.18), 0 2px 6px rgba(0,0,0,0.08);
          border: 1px solid rgba(0,0,0,0.06);
          padding: 6px;
          font: 14px/1.4 "Noto Sans Bengali", "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          pointer-events: none;
          opacity: 0; transform: translateY(4px) scale(0.98);
          transition: opacity 120ms ease, transform 120ms cubic-bezier(0.2, 0.8, 0.2, 1);
          max-height: 300px; overflow-y: auto;
        }
        .panel.open { opacity: 1; transform: translateY(0) scale(1); pointer-events: auto; }
        .panel.dark { background: rgba(30,30,30,0.96); color: #FAFAFA; border-color: rgba(255,255,255,0.08); }
        .item {
          display: flex; align-items: center; gap: 10px;
          padding: 7px 10px; border-radius: 10px; cursor: pointer;
        }
        .item:hover { background: rgba(255,159,28,0.14); }
        .item.active { background: linear-gradient(135deg, #F28C0F, #F5A623); color: #fff; }
        .num { font: 500 11px "Inter", sans-serif; opacity: 0.6; min-width: 14px; }
        .item.active .num { opacity: 0.95; }
        .txt { flex: 1; font-size: 15px; }
        .item.latin .txt { font-size: 13px; opacity: 0.75; }
        @media (prefers-reduced-motion: reduce) { .panel { transition: none; } }
      </style>
      <div class="panel" role="listbox" aria-label="Bangla suggestions"></div>
    `;
    panelListEl = root.querySelector(".panel");
    document.documentElement.appendChild(panelHost);
  }

  function renderPanel() {
    if (!panelListEl) return;
    panelListEl.classList.toggle("dark", isDark());
    panelListEl.textContent = "";
    panelItems.forEach((txt, i) => {
      const row = document.createElement("div");
      row.className = "item" + (i === panelIndex ? " active" : "") + (txt === panelLatin ? " latin" : "");
      row.setAttribute("role", "option");
      row.setAttribute("aria-selected", i === panelIndex ? "true" : "false");
      const num = document.createElement("span");
      num.className = "num";
      num.textContent = String(i + 1);
      const label = document.createElement("span");
      label.className = "txt";
      label.textContent = txt;
      row.append(num, label);
      row.addEventListener("mousedown", (e) => { e.preventDefault(); commitPanel(i); });
      panelListEl.appendChild(row);
    });
    const activeRow = panelListEl.children[panelIndex];
    if (activeRow && activeRow.scrollIntoView) activeRow.scrollIntoView({ block: "nearest" });
  }

  function placePanel(rect) {
    // Measure off-screen, then flip / shift to stay inside the viewport.
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

  function showPanel(target, latin, items) {
    ensurePanel();
    panelTarget = target;
    panelLatin = latin;
    panelItems = items;
    panelIndex = 0;
    renderPanel();
    placePanel(caretRect(target));
    panelListEl.classList.add("open");
  }

  function hidePanel() {
    docsPanelActive = false;
    panelItems = [];
    panelTarget = null;
    panelLatin = "";
    if (panelListEl) panelListEl.classList.remove("open");
  }

  const panelOpenFor = (el) => panelItems.length > 0 && panelTarget === el;

  // ============================================================
  // Committing, learning and undo
  // ============================================================
  let lastCommit = null; // { el, latin, bangla } — for Backspace undo

  function remember(latin, choice) {
    const key = latin.toLowerCase();
    if (learned[key] === choice) return;
    const keys = Object.keys(learned);
    if (keys.length >= 500) delete learned[keys[0]];
    learned[key] = choice;
    E.setLearned(learned);
    try { chrome.storage.local.set({ learned }); } catch (_) {}
  }

  // Convert the Latin word before the caret. Returns true if text changed.
  function commitWord(el, choice) {
    const info = getWordBeforeCaret(el);
    if (!info || !info.text || !E.hasLetter(info.text)) return false;
    const bn = choice || E.transliterate(info.text);
    if (!bn || bn === info.text) return false;
    replaceBeforeCaret(el, info, bn, false);
    lastCommit = { el, latin: info.text, bangla: bn };
    updateStats(bn);
    return true;
  }

  function commitPanel(index) {
    const choice = panelItems[index];
    if (docsPanelActive) {
      docsPostToFrame({ kind: "commit", index, text: choice });
      hidePanel();
      return;
    }
    const el = panelTarget;
    const latin = panelLatin;
    hidePanel();
    if (!el || !choice) return;
    // Picking anything but the default teaches the engine; picking the Latin
    // original teaches it to leave that word alone.
    if (index > 0) remember(latin, choice);
    if (choice === latin) {
      if (settings.autoSpace) { selfEdit++; try { insertText(el, " "); } finally { selfEdit--; } }
      return;
    }
    commitWord(el, choice + (settings.autoSpace ? " " : ""));
    if (lastCommit && settings.autoSpace) lastCommit.bangla = choice;
  }

  // Backspace right after a conversion reopens the word as it was typed, so it
  // can be extended (desh → deshe), re-picked, or kept in English.
  function undoCommit(el, commit) {
    const ctx = beforeCaret(el);
    if (!ctx) return false;
    const head = ctx.text.slice(0, ctx.pos);
    let tail = "";
    if (!head.endsWith(commit.bangla)) {
      const last = head.slice(-1);
      if (!last || E.isWordChar(last) || !head.slice(0, -1).endsWith(commit.bangla)) return false;
      tail = last;
    }
    const len = commit.bangla.length + tail.length;
    replaceBeforeCaret(el, { start: ctx.pos - len, end: ctx.pos, node: ctx.node }, commit.latin, true);
    refreshPanel(el);
    return true;
  }

  // "." becomes a dari, except where a real full stop is clearly meant.
  function handleDot(el, wordCommitted) {
    const ctx = beforeCaret(el);
    if (!ctx) return false;
    const prevChar = ctx.text.slice(ctx.pos - 1, ctx.pos);
    if (prevChar === "।") {
      // a second dot turns the dari back into dots: "..." stays an ellipsis
      replaceBeforeCaret(el, { start: ctx.pos - 1, end: ctx.pos, node: ctx.node }, "..", true);
      return true;
    }
    if (prevChar === "." || prevChar === "" || /\s/.test(prevChar)) return false;
    if (!wordCommitted && /[0-9০-৯A-Za-z]/.test(prevChar)) return false; // 3.5, v2.1, file.txt
    selfEdit++;
    try { insertText(el, "।"); } finally { selfEdit--; }
    return true;
  }

  const MODIFIER_KEYS = new Set(["Shift", "Control", "Alt", "Meta", "CapsLock", "AltGraph"]);

  function onKeyDown(e) {
    if (e.isComposing || e.keyCode === 229) return; // an OS IME is composing
    if (isDocsTextEventFrame()) return; // handled by the Google Docs adapter
    if (MODIFIER_KEYS.has(e.key)) return;

    const undoable = lastCommit;
    lastCommit = null;

    if (!active()) return;
    const el = eventTarget(e);
    if (!isEditable(el)) return;
    ensureDictionary();

    const key = e.key;
    const mod = e.ctrlKey || e.metaKey || e.altKey;

    if (key === "Backspace" && !mod && undoable && undoable.el === el && undoCommit(el, undoable)) {
      e.preventDefault();
      return;
    }

    if (panelOpenFor(el)) {
      if (key === "ArrowDown") { e.preventDefault(); panelIndex = (panelIndex + 1) % panelItems.length; renderPanel(); return; }
      if (key === "ArrowUp") { e.preventDefault(); panelIndex = (panelIndex - 1 + panelItems.length) % panelItems.length; renderPanel(); return; }
      // Tab always takes the highlighted candidate. Enter does too once the
      // selection has been moved; on the default candidate it converts the
      // word and still reaches the page, so one Enter sends a chat message.
      if (!mod && (key === "Tab" || (key === "Enter" && panelIndex > 0))) { e.preventDefault(); commitPanel(panelIndex); return; }
      if (key === "Escape") { e.preventDefault(); hidePanel(); return; }
      if (/^[1-9]$/.test(key) && mod) {
        const idx = parseInt(key, 10) - 1;
        if (idx < panelItems.length) { e.preventDefault(); commitPanel(idx); return; }
      }
    }

    if (mod && key !== "Enter") return; // leave keyboard shortcuts alone

    // Any key that ends a word converts it: space, Enter, Tab and punctuation.
    const endsWord = key === "Enter" || key === "Tab" || (key.length === 1 && !E.isWordChar(key));
    if (!endsWord) return;

    // Space takes the highlighted candidate when the user has moved the selection.
    const picked = key === " " && panelOpenFor(el) && panelIndex > 0 ? panelItems[panelIndex] : null;
    const latin = panelLatin;
    hidePanel();
    let committed = false;
    if (picked) {
      remember(latin, picked);
      committed = picked === latin ? false : commitWord(el, picked);
    } else {
      committed = commitWord(el);
    }
    if (key === "." && !mod && handleDot(el, committed)) e.preventDefault();
  }

  function refreshPanel(el) {
    const info = getWordBeforeCaret(el);
    if (!settings.candidateWindow || !info || !info.text || info.text.length > 40 || !E.hasLetter(info.text)) {
      hidePanel();
      return;
    }
    const items = E.suggest(info.text);
    if (items.length === 0) { hidePanel(); return; }
    showPanel(el, info.text, items);
  }

  function onInput(e) {
    if (selfEdit) return;
    if (isDocsTextEventFrame()) return;
    if (!active()) { hidePanel(); return; }
    if (e.isComposing) return;
    const el = eventTarget(e);
    if (!isEditable(el)) return;
    ensureDictionary();
    refreshPanel(el);
  }

  function onFocusIn(e) {
    if (active() && isEditable(eventTarget(e))) ensureDictionary();
  }

  on(document, "keydown", onKeyDown, true);
  on(document, "input", onInput, true);
  on(document, "focusin", onFocusIn, true);
  on(document, "focusout", () => hidePanel(), true);
  on(window, "scroll", (e) => { if (e.target !== panelHost) hidePanel(); }, true);
  on(window, "resize", () => hidePanel());

  // ============================================================
  // Google Docs support
  // Docs renders text on a <canvas>; keystrokes go to a hidden
  // .docs-texteventtarget-iframe. We buffer Latin keys in that frame, insert
  // only the finished Bangla word, and render the candidate panel in the top
  // frame near the Kix caret.
  // ============================================================
  const IS_DOCS = /(^|\.)docs\.google\.com$/.test(location.hostname) ||
    (() => { try { return !IS_TOP && /docs\.google\.com/.test(document.referrer); } catch (_) { return false; } })();

  let docsPanelActive = false;
  let docsFrameWin = null;

  function docsPostToFrame(payload) {
    try {
      const frame = document.querySelector("iframe.docs-texteventtarget-iframe");
      const win = docsFrameWin || (frame && frame.contentWindow);
      if (win) win.postMessage({ __seDocs: 1, ...payload }, "*");
    } catch (_) {}
  }

  function docsCaretRect() {
    const caret = document.querySelector(".kix-cursor-caret") || document.querySelector(".kix-cursor");
    if (caret) {
      const r = caret.getBoundingClientRect();
      if (r.width || r.height) return r;
    }
    const page = document.querySelector(".kix-page") || document.body;
    const r = page.getBoundingClientRect();
    return { left: r.left + 40, right: r.left + 40, top: r.top + 80, bottom: r.top + 80, width: 0, height: 0 };
  }

  function isDocsTextEventFrame() {
    if (!IS_DOCS) return false;
    try {
      const fe = window.frameElement;
      return !!fe && /docs-texteventtarget-iframe/.test(fe.className || "");
    } catch (_) { return false; }
  }

  // ---- top frame: render the panel on behalf of the hidden iframe ----
  if (IS_DOCS && IS_TOP) {
    on(window, "message", (ev) => {
      const d = ev.data;
      if (!d || d.__seDocs !== 1) return;
      docsFrameWin = ev.source;
      if (d.kind === "show") {
        ensurePanel();
        docsPanelActive = true;
        panelTarget = null;
        panelLatin = d.raw || "";
        panelItems = Array.isArray(d.items) ? d.items.map(String) : [];
        panelIndex = d.index || 0;
        renderPanel();
        placePanel(docsCaretRect());
        panelListEl.classList.add("open");
      } else if (d.kind === "index") {
        panelIndex = d.index || 0;
        renderPanel();
      } else if (d.kind === "hide") {
        hidePanel();
      } else if (d.kind === "stats") {
        updateStats(String(d.text || ""));
      }
    });
  }

  // ---- hidden iframe: intercept typing ----
  if (IS_DOCS) {
    // Swallow the Latin keystrokes entirely (Docs never sees them), keep them
    // in our own buffer, and insert only the finished Bangla word. This avoids
    // synthetic-Backspace deletion, which Docs handles unreliably.
    let buf = "";
    let docsIndex = 0;
    let afterBangla = false; // the last thing inserted was a converted word
    const toTop = (payload) => { try { window.top.postMessage({ __seDocs: 1, ...payload }, "*"); } catch (_) {} };

    function docsInsert(text) {
      if (!text) return;
      const el = document.activeElement || document.body;
      let ok = false;
      try { ok = document.execCommand("insertText", false, text); } catch (_) {}
      if (!ok) {
        try {
          const dt = new DataTransfer();
          dt.setData("text/plain", text);
          el.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true }));
        } catch (_) {}
      }
    }
    const hideTop = () => toTop({ kind: "hide" });
    function sendPanel() {
      if (!buf || !E.hasLetter(buf) || !settings.candidateWindow) { hideTop(); return; }
      toTop({ kind: "show", items: E.suggest(buf), index: docsIndex, raw: buf });
    }
    function commit(text, tail) {
      docsInsert((text || "") + (tail || ""));
      buf = "";
      docsIndex = 0;
      hideTop();
      if (text) toTop({ kind: "stats", text });
    }

    on(window, "message", (ev) => {
      const d = ev.data;
      if (!d || d.__seDocs !== 1 || d.kind !== "commit") return;
      if (!buf || !d.text) return;
      commit(String(d.text), settings.autoSpace ? " " : "");
      afterBangla = true;
    });

    on(document, "keydown", (e) => {
      if (!isDocsTextEventFrame()) return;
      if (e.isComposing || MODIFIER_KEYS.has(e.key)) return;
      if (!active()) { buf = ""; return; }
      ensureDictionary();
      if (e.ctrlKey || e.metaKey || e.altKey) {
        if (buf) commit(E.transliterate(buf), "");
        return;
      }

      if (buf) {
        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
          const items = E.suggest(buf);
          docsIndex = (docsIndex + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
          e.preventDefault();
          toTop({ kind: "index", index: docsIndex });
          return;
        }
        if (e.key === "Tab") {
          e.preventDefault();
          commit(E.suggest(buf)[docsIndex] || E.transliterate(buf), "");
          return;
        }
        if (e.key === "Escape") {
          e.preventDefault();
          commit(buf, ""); // give the raw Latin back so nothing is lost
          return;
        }
        if (e.key === "Backspace") {
          e.preventDefault();
          buf = buf.slice(0, -1);
          docsIndex = 0;
          sendPanel();
          return;
        }
      }

      // Buffer printable Latin — Docs must not receive it.
      if (e.key.length === 1 && E.isWordChar(e.key) && (buf || !/[0-9]/.test(e.key))) {
        e.preventDefault();
        buf += e.key;
        docsIndex = 0;
        sendPanel();
        return;
      }

      if (e.key.length === 1) {
        if (!buf) {
          // nothing pending: Docs types it, except a full stop closing a Bangla word
          if (e.key === "." && afterBangla) { e.preventDefault(); docsInsert("।"); }
          if (e.key !== " ") afterBangla = false;
          hideTop();
          return;
        }
        e.preventDefault();
        const hasWord = E.hasLetter(buf);
        const word = hasWord
          ? (e.key === " " && docsIndex > 0 && E.suggest(buf)[docsIndex]) || E.transliterate(buf)
          : buf;
        commit(word, e.key === "." && hasWord ? "।" : e.key);
        afterBangla = hasWord && e.key === " ";
        return;
      }
      afterBangla = false;
      if (e.key === "Enter") {
        if (buf && E.hasLetter(buf)) {
          e.preventDefault();
          commit(E.transliterate(buf), "\n");
          return;
        }
        if (buf) commit(buf, "");
        return;
      }
      // navigation and other named keys: flush what was typed, then let Docs act
      if (buf) commit(E.hasLetter(buf) ? E.transliterate(buf) : buf, "");
    }, true);
  }

  // ============================================================
  // Stats (batched, stored locally by the service worker)
  // ============================================================
  let statsQueue = { words: 0, chars: 0, bn: 0, en: 0 };
  let statsTimer = null;
  function updateStats(text) {
    statsQueue.words += 1;
    statsQueue.chars += [...text].length;
    statsQueue.bn += 1;
    if (statsTimer) return;
    statsTimer = setTimeout(() => {
      try { chrome.runtime.sendMessage({ type: "SE_UPDATE_STATS", ...statsQueue }, () => void chrome.runtime.lastError); } catch (_) {}
      statsQueue = { words: 0, chars: 0, bn: 0, en: 0 };
      statsTimer = null;
    }, 3000);
  }

  // ============================================================
  // Floating status indicator (top frame only)
  // ============================================================
  let indicatorHost = null;
  let indicatorPill = null;
  let indicatorTimer = null;

  function ensureIndicator() {
    if (indicatorHost) return;
    indicatorHost = document.createElement("div");
    indicatorHost.style.cssText = "all:initial;position:fixed;right:16px;bottom:16px;z-index:2147483646;pointer-events:none;";
    const root = indicatorHost.attachShadow({ mode: "open" });
    root.innerHTML = `
      <style>
        .pill {
          font: 600 12px/1 "Noto Sans Bengali", "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          padding: 8px 12px; border-radius: 999px;
          background: linear-gradient(135deg, #F28C0F, #F5A623);
          color: #fff; box-shadow: 0 8px 24px rgba(255,159,28,0.35);
          opacity: 0; transform: translateY(6px);
          transition: opacity 200ms ease, transform 200ms ease;
          letter-spacing: 0.02em;
        }
        .pill.show { opacity: 0.97; transform: translateY(0); }
        .pill.en { background: linear-gradient(135deg, #444, #666); box-shadow: 0 6px 18px rgba(0,0,0,0.2); }
        @media (prefers-reduced-motion: reduce) { .pill { transition: none; } }
      </style>
      <div class="pill" role="status"></div>
    `;
    indicatorPill = root.querySelector(".pill");
    document.documentElement.appendChild(indicatorHost);
  }

  // `force` shows the pill even if the ambient indicator is switched off, so a
  // keyboard-shortcut toggle always gives feedback.
  function flashIndicator(force) {
    if (!IS_TOP || document.hidden) return;
    if (!force && !settings.floatingIndicator) {
      if (indicatorPill) indicatorPill.classList.remove("show");
      return;
    }
    ensureIndicator();
    const bangla = active();
    indicatorPill.textContent = !settings.enabled ? "Banglish off" : siteOff ? "Off on this site" : bangla ? "বাংলা" : "English";
    indicatorPill.classList.toggle("en", !bangla);
    indicatorPill.classList.add("show");
    clearTimeout(indicatorTimer);
    indicatorTimer = setTimeout(() => indicatorPill && indicatorPill.classList.remove("show"), 1400);
  }

  // ============================================================
  // Teardown
  // ============================================================
  function teardown() {
    ac.abort();
    clearTimeout(statsTimer);
    clearTimeout(indicatorTimer);
    try { chrome.storage.onChanged.removeListener(onStorageChanged); } catch (_) {}
    try { chrome.runtime.onMessage.removeListener(onMessage); } catch (_) {}
    if (panelHost) panelHost.remove();
    if (indicatorHost) indicatorHost.remove();
    panelHost = panelListEl = indicatorHost = indicatorPill = null;
    if (window.__SE_BANGLISH__ === instance) window.__SE_BANGLISH__ = null;
  }
  on(document, TEARDOWN_EVENT, teardown);

  const instance = { alive, teardown };
  window.__SE_BANGLISH__ = instance;
  // engine hook for tests and debugging
  window.__SE_TRANSLIT = E.transliterate;

  if (isEditable(deepActiveElement())) ensureDictionary();
})();
