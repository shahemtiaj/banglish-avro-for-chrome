// SE Banglish Avro — background service worker (MV3, module)

const DEFAULT_SETTINGS = {
  enabled: true,
  language: "bn", // "bn" | "en"
  mode: "phonetic",
  candidateWindow: true,
  autoCorrect: true,
  autoSpace: false,
  rememberLastLanguage: true,
  floatingIndicator: true,
  theme: "system", // "light" | "dark" | "system"
  layout: "avro",
  stats: { wordsTyped: 0, charsTyped: 0, bnWords: 0, enWords: 0 },
  customDictionary: {},
};

async function ensureDefaults() {
  const stored = await chrome.storage.sync.get(null);
  const merged = { ...DEFAULT_SETTINGS, ...stored };
  await chrome.storage.sync.set(merged);
  return merged;
}

chrome.runtime.onInstalled.addListener(async () => {
  await ensureDefaults();
  try {
    chrome.contextMenus.create({
      id: "se-banglish-toggle",
      title: "Toggle Bangla typing on this page",
      contexts: ["editable", "page"],
    });
    chrome.contextMenus.create({
      id: "se-banglish-options",
      title: "SE Banglish Avro settings…",
      contexts: ["action", "page"],
    });
  } catch (_) {
    // menus may already exist
  }
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "se-banglish-toggle") {
    await toggleLanguage(tab?.id);
  } else if (info.menuItemId === "se-banglish-options") {
    chrome.runtime.openOptionsPage();
  }
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command === "toggle-banglish") {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    await toggleLanguage(tab?.id);
  }
});

async function toggleLanguage(tabId) {
  const { language } = await chrome.storage.sync.get({ language: "bn" });
  const next = language === "bn" ? "en" : "bn";
  await chrome.storage.sync.set({ language: next });
  if (tabId) {
    try {
      await chrome.tabs.sendMessage(tabId, { type: "SE_LANG_CHANGED", language: next });
    } catch (_) {
      // tab may not have the content script
    }
  }
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "SE_GET_SETTINGS") {
    chrome.storage.sync.get(DEFAULT_SETTINGS).then(sendResponse);
    return true;
  }
  if (msg?.type === "SE_UPDATE_STATS") {
    chrome.storage.sync.get({ stats: DEFAULT_SETTINGS.stats }).then(({ stats }) => {
      const next = {
        wordsTyped: stats.wordsTyped + (msg.words || 0),
        charsTyped: stats.charsTyped + (msg.chars || 0),
        bnWords: stats.bnWords + (msg.bn || 0),
        enWords: stats.enWords + (msg.en || 0),
      };
      chrome.storage.sync.set({ stats: next }).then(() => sendResponse(next));
    });
    return true;
  }
  return false;
});