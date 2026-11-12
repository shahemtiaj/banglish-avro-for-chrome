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

  // Listeners are collected first and attached together, so they can be
  // re-attached: document.open() (how classic rich-text iframes are built)
  // silently removes every listener from the document and window.
  const bindings = [];
  let ac = null;
  const on = (target, type, fn, capture) => bindings.push([target, type, fn, !!capture]);
  function attach() {
    if (ac) ac.abort();
    ac = new AbortController();
    for (const [target, type, fn, capture] of bindings) {
      target.addEventListener(type, fn, { capture, signal: ac.signal });
    }
  }
  // A key we handle ourselves must not reach the page as well: editors such as
  // Lexical and Draft.js act on keydown directly and ignore preventDefault.
  const consume = (e) => { e.preventDefault(); e.stopImmediatePropagation(); };

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
      if (!active()) { hidePanel(); proxyBuffer.flush(); }
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

  // The dictionary is only requested by frames the user actually types in, and
  // comes from the service worker rather than a web-accessible URL.
  let dictRequested = false;
  function ensureDictionary() {
    if (dictRequested) return;
    dictRequested = true;
    try {
      chrome.runtime.sendMessage({ type: "SE_GET_DICTIONARY" }, (data) => {
        if (chrome.runtime.lastError || !data) { dictRequested = false; return; }
        if (data.words || data.lexicon) {
          E.setDictionary(data.words || {});
          if (data.lexicon && E.setLexicon) E.setLexicon(data.lexicon);
        } else {
          E.setDictionary(data);
        }
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
  // Code editors that keep the real text elsewhere and only use a hidden
  // textarea to receive keystrokes. Reading that textarea tells us nothing.
  const PROXY_EDITORS = ".CodeMirror, .ace_editor, .monaco-editor";
  const TERMINALS = ".xterm, .terminal-wrapper";

  const isField = (el) => el.tagName === "TEXTAREA" || el.tagName === "INPUT";
  const closest = (el, selector) => { try { return el.closest(selector); } catch (_) { return null; } };
  const isProxyField = (el) => !!el && el.tagName === "TEXTAREA" && !!closest(el, PROXY_EDITORS);

  function isEditable(el) {
    if (!el || el.nodeType !== 1) return false;
    if (closest(el, TERMINALS)) return false;
    if (el.isContentEditable) return !closest(el, ".CodeMirror");
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

  // Shadow roots, including closed ones (content scripts may open those).
  function shadowRootOf(el) {
    if (!el || el.nodeType !== 1) return null;
    if (el.shadowRoot) return el.shadowRoot;
    try { return chrome.dom && chrome.dom.openOrClosedShadowRoot ? chrome.dom.openOrClosedShadowRoot(el) : null; } catch (_) { return null; }
  }
  function deepActiveElement() {
    let a = document.activeElement;
    for (let guard = 0; a && guard < 12; guard++) {
      const root = shadowRootOf(a);
      if (!root || !root.activeElement) break;
      a = root.activeElement;
    }
    return a;
  }
  // The element being typed in, seen through shadow roots (web components).
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
  // window.getSelection() stops at a shadow host; ask the shadow root instead.
  function selectionFor(el) {
    try {
      const root = el && el.getRootNode ? el.getRootNode() : null;
      if (root && root.nodeType === 11 && typeof root.getSelection === "function") {
        const sel = root.getSelection();
        if (sel) return sel;
      }
    } catch (_) {}
    return window.getSelection();
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
    const sel = selectionFor(el);
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

  function insertAtSelection(el, str) {
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
      const sel = selectionFor(el);
      if (!sel || sel.rangeCount === 0) return;
      const range = sel.getRangeAt(0);
      range.deleteContents();
      const node = document.createTextNode(str);
      range.insertNode(node);
      sel.setBaseAndExtent(node, node.length, node, node.length);
    }
    el.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: str }));
  }

  // Replace the text between info.start and info.end (offsets in the field
  // value, or in info.node for rich text) with `replacement`, in ONE edit.
  //
  // Rich-text editors fall into two families and each needs its own approach:
  //  - model-driven editors (Lexical, Slate, CKEditor 5, Quill) answer a
  //    `beforeinput` event that carries the range to replace, and ignore
  //    document.execCommand;
  //  - DOM-observing editors (ProseMirror, Draft.js, CodeMirror 6) and plain
  //    contenteditable ignore that event and pick up execCommand edits.
  // So: offer the event first; if nobody claims it, fall back to execCommand.
  function replaceRange(el, info, replacement) {
    selfEdit++;
    try {
      if (isField(el)) {
        try { el.setSelectionRange(info.start, info.end); } catch (_) {}
        insertAtSelection(el, replacement);
        return;
      }
      const node = info.node;
      if (!node) return;
      let claimed = false;
      try {
        const range = new StaticRange({ startContainer: node, startOffset: info.start, endContainer: node, endOffset: info.end });
        const ev = new InputEvent("beforeinput", {
          bubbles: true, cancelable: true, composed: true,
          inputType: "insertText", data: replacement, targetRanges: [range],
        });
        claimed = !el.dispatchEvent(ev);
      } catch (_) {}
      if (claimed) return;
      const sel = selectionFor(el);
      if (!sel) return;
      sel.setBaseAndExtent(node, info.start, node, info.end);
      insertAtSelection(el, replacement);
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
    if (isProxyField(target)) return target.getBoundingClientRect(); // these sit at the cursor
    if (isField(target)) return fieldCaretRect(target);
    const sel = selectionFor(target);
    if (sel && sel.rangeCount) {
      const r = sel.getRangeAt(0).getBoundingClientRect();
      if (r.width || r.height) return r;
    }
    return target.getBoundingClientRect();
  }

  // ============================================================
  // Candidate window
  // ============================================================
  // Built without innerHTML or <style> text so it also works on pages that
  // enforce Trusted Types or a strict style CSP, and shown in the browser's
  // top layer so modal dialogs and full-screen elements cannot cover it.
  const PANEL_CSS = `
    .panel {
      position: fixed; min-width: 180px; max-width: 320px; box-sizing: border-box;
      background: rgba(255,255,255,0.97);
      backdrop-filter: blur(20px) saturate(180%);
      color: #111;
      border-radius: 14px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.18), 0 2px 6px rgba(0,0,0,0.08);
      border: 1px solid rgba(0,0,0,0.06);
      padding: 6px;
      font: 14px/1.4 "Noto Sans Bengali", "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      text-align: left; direction: ltr; cursor: default; user-select: none;
      pointer-events: none;
      opacity: 0; transform: translateY(4px) scale(0.98);
      transition: opacity 120ms ease, transform 120ms cubic-bezier(0.2, 0.8, 0.2, 1);
      max-height: 320px; overflow-y: auto;
    }
    .panel.open { opacity: 1; transform: translateY(0) scale(1); pointer-events: auto; }
    .panel.dark { background: rgba(30,30,30,0.97); color: #FAFAFA; border-color: rgba(255,255,255,0.08); }
    .item { display: flex; align-items: center; gap: 10px; padding: 7px 10px; border-radius: 10px; cursor: pointer; }
    .item:hover { background: rgba(255,159,28,0.14); }
    .item.active { background: linear-gradient(135deg, #F28C0F, #F5A623); color: #fff; }
    .num { font: 500 11px "Inter", sans-serif; opacity: 0.6; min-width: 14px; }
    .item.active .num { opacity: 0.95; }
    .txt { flex: 1; font-size: 15px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .item.latin .txt { font-size: 13px; opacity: 0.75; }
    @media (prefers-reduced-motion: reduce) { .panel { transition: none; } }
  `;
  const PILL_CSS = `
    .pill {
      font: 600 12px/1 "Noto Sans Bengali", "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      padding: 8px 12px; border-radius: 999px;
      background: linear-gradient(135deg, #F28C0F, #F5A623);
      color: #fff; box-shadow: 0 8px 24px rgba(255,159,28,0.35);
      opacity: 0; transform: translateY(6px);
      transition: opacity 200ms ease, transform 200ms ease;
      letter-spacing: 0.02em; white-space: nowrap;
    }
    .pill.show { opacity: 0.97; transform: translateY(0); }
    .pill.en { background: linear-gradient(135deg, #444, #666); box-shadow: 0 6px 18px rgba(0,0,0,0.2); }
    @media (prefers-reduced-motion: reduce) { .pill { transition: none; } }
  `;

  function makeHost(hostCss, css, className, role) {
    const host = document.createElement("div");
    host.style.cssText = "all:initial;" + hostCss;
    host.setAttribute("contenteditable", "false");
    host.setAttribute("aria-hidden", "false");
    const root = host.attachShadow({ mode: "open" });
    try {
      const sheet = new CSSStyleSheet();
      sheet.replaceSync(css);
      root.adoptedStyleSheets = [sheet];
    } catch (_) {
      const style = document.createElement("style");
      style.textContent = css;
      root.appendChild(style);
    }
    const box = document.createElement("div");
    box.className = className;
    box.setAttribute("role", role);
    root.appendChild(box);
    return { host, box };
  }

  const panel = { host: null, list: null, items: [], index: 0, target: null, latin: "", onPick: null };

  const isDark = () =>
    settings.theme === "dark" ||
    (settings.theme !== "light" && window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches);

  function ensurePanel(target) {
    if (!panel.host || !panel.host.isConnected) {
      const made = makeHost(
        "position:fixed;top:0;left:0;width:0;height:0;margin:0;padding:0;border:0;overflow:visible;background:transparent;z-index:2147483647;pointer-events:none;",
        PANEL_CSS, "panel", "listbox",
      );
      panel.host = made.host;
      panel.list = made.box;
      panel.list.setAttribute("aria-label", "Bangla suggestions");
      try { panel.host.popover = "manual"; } catch (_) {}
    }
    // Everything outside a modal <dialog> is inert, so live inside it when the
    // field does; otherwise at the document root.
    const modal = target ? closest(target, "dialog:modal") : null;
    const parent = modal || document.documentElement;
    if (panel.host.parentNode !== parent) parent.appendChild(panel.host);
  }

  function renderPanel() {
    const list = panel.list;
    if (!list) return;
    list.classList.toggle("dark", isDark());
    list.textContent = "";
    panel.items.forEach((txt, i) => {
      const row = document.createElement("div");
      row.className = "item" + (i === panel.index ? " active" : "") + (txt === panel.latin ? " latin" : "");
      row.setAttribute("role", "option");
      row.setAttribute("aria-selected", i === panel.index ? "true" : "false");
      const num = document.createElement("span");
      num.className = "num";
      num.textContent = String(i + 1);
      const label = document.createElement("span");
      label.className = "txt";
      label.textContent = txt;
      row.append(num, label);
      row.addEventListener("mousedown", (e) => { e.preventDefault(); e.stopPropagation(); commitPanel(i); });
      list.appendChild(row);
    });
    const activeRow = list.children[panel.index];
    if (activeRow && activeRow.scrollIntoView) activeRow.scrollIntoView({ block: "nearest" });
  }

  function placePanel(rect) {
    // Measure off-screen, then flip / shift to stay inside the viewport.
    const list = panel.list;
    list.style.left = "-9999px";
    list.style.top = "0px";
    const vw = window.innerWidth, vh = window.innerHeight;
    const pw = list.offsetWidth || 240;
    const ph = list.offsetHeight || 200;
    const gap = 6;
    let top = rect.bottom + gap;
    if (top + ph > vh - 8) {
      const above = rect.top - gap - ph;
      top = above >= 8 ? above : Math.max(8, vh - ph - 8);
    }
    let left = rect.left;
    if (left + pw > vw - 8) left = Math.max(8, vw - pw - 8);
    if (left < 8) left = 8;
    list.style.left = left + "px";
    list.style.top = top + "px";
  }

  // opts: { target, latin, items, index, rect, onPick }
  function openPanel(opts) {
    ensurePanel(opts.target);
    panel.target = opts.target || null;
    panel.latin = opts.latin || "";
    panel.items = opts.items;
    panel.index = opts.index || 0;
    panel.onPick = opts.onPick || null;
    renderPanel();
    try { if (panel.host.showPopover && !panel.host.matches(":popover-open")) panel.host.showPopover(); } catch (_) {}
    placePanel(opts.rect || caretRect(opts.target));
    panel.list.classList.add("open");
  }

  function hidePanel() {
    const wasOpen = panel.items.length > 0;
    panel.items = [];
    panel.target = null;
    panel.latin = "";
    panel.onPick = null;
    if (panel.list) panel.list.classList.remove("open");
    if (wasOpen && panel.host) {
      try { if (panel.host.hidePopover && panel.host.matches(":popover-open")) panel.host.hidePopover(); } catch (_) {}
    }
  }

  // Open for ordinary (non-buffered) typing in `el`.
  const panelOpenFor = (el) => panel.items.length > 0 && panel.target === el && !panel.onPick;

  // ============================================================
  // Committing, learning and undo
  // ============================================================
  let lastCommit = null; // { el, latin, bangla } — for Backspace undo
  let lastKeyAt = 0;

  function remember(latin, choice) {
    const key = latin.toLowerCase();
    if (learned[key] === choice) return;
    const keys = Object.keys(learned);
    if (keys.length >= 500) delete learned[keys[0]];
    learned[key] = choice;
    E.setLearned(learned);
    try { chrome.storage.local.set({ learned }); } catch (_) {}
  }

  // Convert the Latin word before the caret to `choice` (or the engine's best
  // guess), followed by `tail`. Returns true if the text changed.
  function commitWord(el, choice, tail) {
    const info = getWordBeforeCaret(el);
    if (!info || !info.text || !E.hasLetter(info.text)) return false;
    const bn = choice || E.transliterate(info.text);
    if (!bn || bn === info.text) return false;
    replaceRange(el, info, bn + (tail || ""));
    lastCommit = { el, latin: info.text, bangla: bn };
    updateStats(bn);
    return true;
  }

  function commitPanel(index) {
    const choice = panel.items[index];
    if (panel.onPick) {
      const pick = panel.onPick;
      hidePanel();
      if (choice) pick(index, choice);
      return;
    }
    const el = panel.target;
    const latin = panel.latin;
    hidePanel();
    if (!el || !choice) return;
    // Picking anything but the default teaches the engine; picking the Latin
    // original teaches it to leave that word alone.
    if (index > 0) remember(latin, choice);
    const space = settings.autoSpace ? " " : "";
    if (choice === latin) {
      if (space) { selfEdit++; try { insertAtSelection(el, space); } finally { selfEdit--; } }
      return;
    }
    commitWord(el, choice, space);
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
    replaceRange(el, { start: ctx.pos - len, end: ctx.pos, node: ctx.node }, commit.latin);
    // Editors that render asynchronously have not updated the page yet.
    setTimeout(() => { if (deepActiveElement() === el || el.contains(deepActiveElement())) refreshPanel(el); }, 0);
    return true;
  }

  // A full stop typed on its own. Returns true if we wrote something instead.
  function handleLoneDot(el) {
    const ctx = beforeCaret(el);
    if (!ctx) return false;
    const prevChar = ctx.text.slice(ctx.pos - 1, ctx.pos);
    if (prevChar === "।") {
      // a second dot turns the dari back into dots, so "..." stays an ellipsis
      replaceRange(el, { start: ctx.pos - 1, end: ctx.pos, node: ctx.node }, "..");
      return true;
    }
    // After Bangla text a full stop is a dari; after Latin, digits, spaces or
    // another dot it stays a full stop (3.5, v2.1, file.txt, "...").
    if (!/[\u0980-\u09E5\u09F0-\u09FF]/.test(prevChar)) return false;
    replaceRange(el, { start: ctx.pos, end: ctx.pos, node: ctx.node }, "।");
    return true;
  }

  const MODIFIER_KEYS = new Set(["Shift", "Control", "Alt", "Meta", "CapsLock", "AltGraph"]);

  function onKeyDown(e) {
    if (e.isComposing || e.keyCode === 229) return; // an OS IME is composing
    if (isDocsTextEventFrame()) return; // handled by the Google Docs adapter
    if (MODIFIER_KEYS.has(e.key)) return;

    const undoable = lastCommit;
    lastCommit = null;

    const el = eventTarget(e);
    if (isProxyField(el)) { proxyBuffer.keydown(e, el); return; }
    if (!active()) return;
    if (!isEditable(el)) return;
    ensureDictionary();
    lastKeyAt = Date.now();

    const key = e.key;
    const mod = e.ctrlKey || e.metaKey || e.altKey;

    if (key === "Backspace" && !mod && undoable && undoable.el === el && undoCommit(el, undoable)) {
      consume(e);
      return;
    }

    if (panelOpenFor(el)) {
      if (key === "ArrowDown") { consume(e); panel.index = (panel.index + 1) % panel.items.length; renderPanel(); return; }
      if (key === "ArrowUp") { consume(e); panel.index = (panel.index - 1 + panel.items.length) % panel.items.length; renderPanel(); return; }
      // Tab always takes the highlighted candidate. Enter does too once the
      // selection has been moved; on the default candidate it converts the
      // word and still reaches the page, so one Enter sends a chat message.
      if (!mod && (key === "Tab" || (key === "Enter" && panel.index > 0))) { consume(e); commitPanel(panel.index); return; }
      if (key === "Escape") { consume(e); hidePanel(); return; }
      if (/^[1-9]$/.test(key) && mod) {
        const idx = parseInt(key, 10) - 1;
        if (idx < panel.items.length) { consume(e); commitPanel(idx); return; }
      }
    }

    if (mod && key !== "Enter") return; // leave keyboard shortcuts alone

    // Any key that ends a word converts it: space, Enter, Tab and punctuation.
    const endsWord = key === "Enter" || key === "Tab" || (key.length === 1 && !E.isWordChar(key));
    if (!endsWord) return;

    // Space takes the highlighted candidate when the user has moved the selection.
    const picked = key === " " && panelOpenFor(el) && panel.index > 0 ? panel.items[panel.index] : null;
    const latin = panel.latin;
    hidePanel();
    if (picked) remember(latin, picked);
    const keepLatin = !!picked && picked === latin;
    // A full stop ending a Bangla word is written together with it as a dari,
    // in the same edit: editors that render asynchronously cannot take two.
    const dot = key === "." && !mod;
    const committed = keepLatin ? false : commitWord(el, picked, dot ? "।" : "");
    if (!dot) return;
    if (committed || handleLoneDot(el)) consume(e);
  }

  function refreshPanel(el) {
    const info = getWordBeforeCaret(el);
    if (!settings.candidateWindow || !info || !info.text || info.text.length > 40 || !E.hasLetter(info.text)) {
      if (!panel.onPick) hidePanel();
      return;
    }
    const items = E.suggest(info.text);
    if (items.length === 0) { hidePanel(); return; }
    if (panelOpenFor(el) && panel.latin === info.text) return; // already showing this word
    openPanel({ target: el, latin: info.text, items });
  }

  function onInput(e) {
    if (selfEdit) return;
    if (isDocsTextEventFrame()) return;
    if (!active()) { hidePanel(); return; }
    if (e.isComposing) return;
    const el = eventTarget(e);
    if (!isEditable(el) || isProxyField(el)) return;
    ensureDictionary();
    refreshPanel(el);
  }

  // Some editors cancel the browser's own insertion and never fire `input`;
  // the caret still moves, so follow that while the user is typing.
  function onSelectionChange() {
    if (selfEdit || panel.onPick || !active()) return;
    const typing = Date.now() - lastKeyAt < 500;
    if (!typing && panel.items.length === 0) return;
    const el = deepActiveElement();
    if (!el || !isEditable(el) || isField(el)) return;
    if (typing) { refreshPanel(el); return; }
    const info = getWordBeforeCaret(el);
    if (!info || info.text !== panel.latin) hidePanel(); // caret moved away
  }

  function onFocusIn(e) {
    if (active() && isEditable(eventTarget(e))) ensureDictionary();
  }
  function onFocusOut(e) {
    if (proxyBuffer.pending && isProxyField(eventTarget(e))) proxyBuffer.flush();
    if (!panel.onPick || !docsPanelActive) hidePanel();
  }

  on(document, "keydown", onKeyDown, true);
  on(document, "input", onInput, true);
  on(document, "selectionchange", onSelectionChange, false);
  on(document, "focusin", onFocusIn, true);
  on(document, "focusout", onFocusOut, true);
  on(document, "mousedown", (e) => {
    const path = (e.composedPath && e.composedPath()) || [];
    if (panel.host && path.includes(panel.host)) return;
    if (proxyBuffer.pending) proxyBuffer.flush(); // write it where the caret still is
    if (docsPanelActive) docsPostToFrame({ kind: "flush" });
  }, true);
  on(window, "scroll", (e) => { if (!panel.host || e.target !== panel.host) hidePanel(); }, true);
  on(window, "resize", () => hidePanel(), false);

  // ============================================================
  // Buffered typing
  // ============================================================
  // Where the text being edited cannot be read back (Google Docs draws on a
  // canvas; CodeMirror 5, Ace and Monaco use a hidden textarea), the Latin
  // keystrokes are held here instead of reaching the editor, shown in the
  // candidate window, and only the finished Bangla word is inserted.
  //
  // io: { insert(text), show(items, index, raw), setIndex(i), hide(), stats(text), enterAsText }
  function createBuffer(io) {
    let buf = "";
    let index = 0;
    const items = () => E.suggest(buf);
    const converted = () => (E.hasLetter(buf) ? E.transliterate(buf) : buf);
    const show = () => { if (buf && E.hasLetter(buf)) io.show(items(), index, buf); else io.hide(); };
    const commit = (text, tail) => {
      const raw = buf;
      buf = "";
      index = 0;
      io.hide();
      io.insert((text || "") + (tail || ""));
      if (text && text !== raw) io.stats(text);
    };
    return {
      get pending() { return buf !== ""; },
      pick(text) { if (buf && text) commit(text, settings.autoSpace ? " " : ""); },
      flush() { if (buf) commit(converted(), ""); },
      keydown(e) {
        if (e.isComposing || e.keyCode === 229 || MODIFIER_KEYS.has(e.key)) return;
        if (!active()) { buf = ""; index = 0; return; }
        ensureDictionary();
        const key = e.key;
        if (e.ctrlKey || e.metaKey || e.altKey) { this.flush(); return; }

        if (buf) {
          if (key === "ArrowDown" || key === "ArrowUp") {
            const n = items().length || 1;
            index = (index + (key === "ArrowDown" ? 1 : -1) + n) % n;
            consume(e);
            io.setIndex(index);
            return;
          }
          if (key === "Tab") { consume(e); commit(items()[index] || converted(), ""); return; }
          if (key === "Escape") { consume(e); commit(buf, ""); return; } // hand the Latin back
          if (key === "Backspace") { consume(e); buf = buf.slice(0, -1); index = 0; show(); return; }
        }

        // Hold printable Latin — the editor must not receive it. A word starts
        // with a letter; digits and marks only join one already in progress.
        if (key.length === 1 && (buf ? E.isWordChar(key) : /[A-Za-z]/.test(key))) {
          consume(e);
          buf += key;
          index = 0;
          show();
          return;
        }
        if (!buf) return; // nothing held: the key is the editor's

        if (key.length === 1) {
          consume(e);
          const hasWord = E.hasLetter(buf);
          const word = hasWord ? (key === " " && index > 0 && items()[index]) || E.transliterate(buf) : buf;
          commit(word, key === "." && hasWord ? "।" : key);
          return;
        }
        if (key === "Enter" && index > 0) { consume(e); commit(items()[index] || converted(), ""); return; }
        if (key === "Enter" && io.enterAsText) { consume(e); commit(converted(), "\n"); return; }
        // Enter, arrows and other named keys: write the word, then let them act.
        this.flush();
      },
    };
  }

  // ---- code editors with a hidden textarea ----
  let proxyEl = null;
  const proxyBuffer = (() => {
    const buffer = createBuffer({
      insert(text) {
        if (!text || !proxyEl) return;
        selfEdit++;
        try { if (deepActiveElement() !== proxyEl) proxyEl.focus(); insertAtSelection(proxyEl, text); } finally { selfEdit--; }
      },
      show(items, index, raw) {
        if (!proxyEl) return;
        openPanel({ target: proxyEl, latin: raw, items, index, onPick: (_i, choice) => buffer.pick(choice) });
      },
      setIndex(i) { panel.index = i; renderPanel(); },
      hide: () => hidePanel(),
      stats: (text) => updateStats(text),
    });
    return {
      get pending() { return buffer.pending; },
      flush: () => buffer.flush(),
      keydown(e, el) {
        if (proxyEl !== el) { buffer.flush(); proxyEl = el; }
        buffer.keydown(e);
      },
    };
  })();

  // ============================================================
  // Google Docs
  // ============================================================
  // Keystrokes go to a hidden .docs-texteventtarget-iframe; the buffer runs
  // there and the candidate window is drawn by the top frame at the Kix caret.
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

  // ---- top frame: draw the panel on behalf of the hidden iframe ----
  if (IS_DOCS && IS_TOP) {
    on(window, "message", (ev) => {
      const d = ev.data;
      if (!d || d.__seDocs !== 1) return;
      docsFrameWin = ev.source;
      if (d.kind === "show") {
        docsPanelActive = true;
        openPanel({
          target: null,
          latin: String(d.raw || ""),
          items: Array.isArray(d.items) ? d.items.map(String) : [],
          index: d.index || 0,
          rect: docsCaretRect(),
          onPick: (index, text) => docsPostToFrame({ kind: "commit", index, text }),
        });
      } else if (d.kind === "index") {
        panel.index = d.index || 0;
        renderPanel();
      } else if (d.kind === "hide") {
        docsPanelActive = false;
        hidePanel();
      } else if (d.kind === "stats") {
        updateStats(String(d.text || ""));
      }
    }, false);
  }

  // ---- hidden iframe: hold the typing ----
  if (IS_DOCS && !IS_TOP) {
    const toTop = (payload) => { try { window.top.postMessage({ __seDocs: 1, ...payload }, "*"); } catch (_) {} };
    const docsBuffer = createBuffer({
      enterAsText: true,
      insert(text) {
        if (!text) return;
        let ok = false;
        try { ok = document.execCommand("insertText", false, text); } catch (_) {}
        if (ok) return;
        try {
          const dt = new DataTransfer();
          dt.setData("text/plain", text);
          (document.activeElement || document.body).dispatchEvent(
            new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true }),
          );
        } catch (_) {}
      },
      show: (items, index, raw) => toTop({ kind: "show", items, index, raw }),
      setIndex: (index) => toTop({ kind: "index", index }),
      hide: () => toTop({ kind: "hide" }),
      stats: (text) => toTop({ kind: "stats", text }),
    });
    on(window, "message", (ev) => {
      const d = ev.data;
      if (!d || d.__seDocs !== 1) return;
      if (d.kind === "commit" && d.text) docsBuffer.pick(String(d.text));
      else if (d.kind === "flush") docsBuffer.flush();
    }, false);
    on(document, "keydown", (e) => { if (isDocsTextEventFrame()) docsBuffer.keydown(e); }, true);
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
  const indicator = { host: null, pill: null, timer: null };

  // `force` shows the pill even if the ambient indicator is switched off, so a
  // keyboard-shortcut toggle always gives feedback.
  function flashIndicator(force) {
    if (!IS_TOP || document.hidden || !document.documentElement) return;
    if (!force && !settings.floatingIndicator) {
      if (indicator.pill) indicator.pill.classList.remove("show");
      return;
    }
    if (!indicator.host || !indicator.host.isConnected) {
      const made = makeHost(
        "position:fixed;right:16px;bottom:16px;z-index:2147483646;pointer-events:none;",
        PILL_CSS, "pill", "status",
      );
      indicator.host = made.host;
      indicator.pill = made.box;
      document.documentElement.appendChild(indicator.host);
    }
    const bangla = active();
    const pill = indicator.pill;
    pill.textContent = !settings.enabled ? "Banglish off" : siteOff ? "Off on this site" : bangla ? "বাংলা" : "English";
    pill.classList.toggle("en", !bangla);
    pill.classList.add("show");
    clearTimeout(indicator.timer);
    indicator.timer = setTimeout(() => pill.classList.remove("show"), 1400);
  }

  // ============================================================
  // Lifecycle
  // ============================================================
  // document.open() replaces the root element and drops our listeners.
  let knownRoot = document.documentElement;
  const rootObserver = new MutationObserver(() => {
    if (document.documentElement === knownRoot) return;
    knownRoot = document.documentElement;
    panel.host = panel.list = indicator.host = indicator.pill = null;
    panel.items = [];
    attach();
  });
  try { rootObserver.observe(document, { childList: true }); } catch (_) {}

  function teardown() {
    if (ac) ac.abort();
    rootObserver.disconnect();
    clearTimeout(statsTimer);
    clearTimeout(indicator.timer);
    try { chrome.storage.onChanged.removeListener(onStorageChanged); } catch (_) {}
    try { chrome.runtime.onMessage.removeListener(onMessage); } catch (_) {}
    if (panel.host) panel.host.remove();
    if (indicator.host) indicator.host.remove();
    panel.host = panel.list = indicator.host = indicator.pill = null;
    if (window.__SE_BANGLISH__ === instance) window.__SE_BANGLISH__ = null;
  }
  on(document, TEARDOWN_EVENT, teardown, false);

  const instance = { alive, teardown };
  window.__SE_BANGLISH__ = instance;
  // engine hook for tests and debugging
  window.__SE_TRANSLIT = E.transliterate;

  attach();
  if (isEditable(deepActiveElement())) ensureDictionary();
})();
