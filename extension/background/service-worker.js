// SE Banglish Avro — background service worker (MV3, module)

// Synced settings. Typing statistics and learned picks live in storage.local:
// they change on every word and must not eat the sync write quota.
const DEFAULT_SETTINGS = {
  enabled: true,
  language: "bn", // "bn" | "en"
  candidateWindow: true,
  autoCorrect: true,
  autoSpace: false,
  rememberLastLanguage: true,
  floatingIndicator: true,
  banglaDigits: false,
  theme: "system", // "light" | "dark" | "system"
  layout: "avro",
  customDictionary: {},
  disabledSites: [],
};
const DEFAULT_STATS = { wordsTyped: 0, charsTyped: 0, bnWords: 0, enWords: 0 };
const CONTENT_FILES = ["lib/engine.js", "content/content.js"];

async function ensureDefaults() {
  const stored = await chrome.storage.sync.get(null);
  const missing = {};
  for (const k in DEFAULT_SETTINGS) if (!(k in stored)) missing[k] = DEFAULT_SETTINGS[k];
  if (Object.keys(missing).length) await chrome.storage.sync.set(missing);

  // Older versions kept statistics in sync storage; move them once.
  if (stored.stats) {
    const local = await chrome.storage.local.get("stats");
    if (!local.stats) await chrome.storage.local.set({ stats: { ...DEFAULT_STATS, ...stored.stats } });
    await chrome.storage.sync.remove(["stats", "mode"]);
  }
}

function createMenus() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: "se-banglish-toggle",
      title: "Toggle Bangla / English typing",
      contexts: ["editable", "page"],
    });
    chrome.contextMenus.create({
      id: "se-banglish-options",
      title: "SE Banglish Avro settings…",
      contexts: ["action"],
    });
  });
}

async function updateBadge() {
  try {
    const { enabled, language } = await chrome.storage.sync.get({ enabled: true, language: "bn" });
    const text = !enabled ? "OFF" : language === "en" ? "EN" : "";
    await chrome.action.setBadgeBackgroundColor({ color: enabled ? "#555555" : "#9CA3AF" });
    await chrome.action.setBadgeText({ text });
  } catch (_) {
    // action API unavailable — cosmetic only
  }
}

// Tabs that were already open when the extension is installed or updated have
// no content script yet; give them one so typing works without a reload.
async function injectIntoOpenTabs() {
  try {
    const tabs = await chrome.tabs.query({ url: ["http://*/*", "https://*/*", "file:///*"] });
    await Promise.all(
      tabs.map((tab) =>
        tab.id == null || tab.discarded
          ? null
          : chrome.scripting
              .executeScript({ target: { tabId: tab.id, allFrames: true }, files: CONTENT_FILES })
              .catch(() => {}), // restricted page (Web Store, viewer, …)
      ),
    );
  } catch (_) {
    // ignore
  }
}

chrome.runtime.onInstalled.addListener(async () => {
  await ensureDefaults();
  createMenus();
  await updateBadge();
  await injectIntoOpenTabs();
});

chrome.runtime.onStartup.addListener(async () => {
  const { rememberLastLanguage } = await chrome.storage.sync.get({ rememberLastLanguage: true });
  // With "remember last language" off, every browser session starts in Bangla.
  if (!rememberLastLanguage) await chrome.storage.sync.set({ language: "bn" });
  await updateBadge();
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "sync" && ("enabled" in changes || "language" in changes)) updateBadge();
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "se-banglish-toggle") await toggleLanguage(tab?.id);
  else if (info.menuItemId === "se-banglish-options") chrome.runtime.openOptionsPage();
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "toggle-banglish") return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  await toggleLanguage(tab?.id);
});

async function toggleLanguage(tabId) {
  const { language } = await chrome.storage.sync.get({ language: "bn" });
  const next = language === "bn" ? "en" : "bn";
  await chrome.storage.sync.set({ language: next });
  if (tabId != null) {
    // Lets the page confirm the switch even when the ambient indicator is off.
    chrome.tabs.sendMessage(tabId, { type: "SE_LANG_CHANGED", language: next }).catch(() => {});
  }
}

// The dictionaries are served from here so they do not have to be
// web-accessible resources (which would let any site detect the extension).
//   words   — hand-checked Banglish → Bangla spellings (core.json)
//   lexicon — large word list matched by sound (lexicon.txt)
let dictionaryPromise = null;
function loadDictionary() {
  if (!dictionaryPromise) {
    const words = fetch(chrome.runtime.getURL("dictionary/core.json")).then((r) => r.json());
    const lexicon = fetch(chrome.runtime.getURL("dictionary/lexicon.txt")).then((r) => (r.ok ? r.text() : "")).catch(() => "");
    dictionaryPromise = Promise.all([words, lexicon])
      .then(([w, l]) => ({ words: w, lexicon: l }))
      .catch(() => { dictionaryPromise = null; return { words: {}, lexicon: "" }; });
  }
  return dictionaryPromise;
}

// Statistics updates arrive from many frames; apply them one after another.
let statsChain = Promise.resolve();
function addStats(delta) {
  statsChain = statsChain
    .then(async () => {
      const { stats } = await chrome.storage.local.get({ stats: DEFAULT_STATS });
      const n = (v) => (Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);
      const next = {
        wordsTyped: n(stats.wordsTyped) + n(delta.words),
        charsTyped: n(stats.charsTyped) + n(delta.chars),
        bnWords: n(stats.bnWords) + n(delta.bn),
        enWords: n(stats.enWords) + n(delta.en),
      };
      await chrome.storage.local.set({ stats: next });
      return next;
    })
    .catch(() => null);
  return statsChain;
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "SE_GET_DICTIONARY") {
    loadDictionary().then(sendResponse);
    return true;
  }
  if (msg?.type === "SE_GET_SETTINGS") {
    chrome.storage.sync.get(DEFAULT_SETTINGS).then(sendResponse);
    return true;
  }
  if (msg?.type === "SE_UPDATE_STATS") {
    addStats(msg).then(sendResponse);
    return true;
  }
  return false;
});
