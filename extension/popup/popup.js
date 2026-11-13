// Popup controller
const DEFAULTS = {
  enabled: true,
  language: "bn",
  candidateWindow: true,
  autoCorrect: true,
  autoSpace: false,
  rememberLastLanguage: true,
  floatingIndicator: true,
  theme: "system",
  disabledSites: [],
};

const $ = (sel) => document.querySelector(sel);
let siteHost = "";

function applyTheme(theme) {
  if (theme === "light" || theme === "dark") document.documentElement.dataset.theme = theme;
  else document.documentElement.removeAttribute("data-theme");
}

function setPressed(group, value, attr) {
  document.querySelectorAll(group).forEach((btn) => {
    btn.setAttribute("aria-pressed", btn.dataset[attr] === value ? "true" : "false");
  });
}

function render(state) {
  $("#toggle-enabled").checked = !!state.enabled;
  $("#toggle-cw").checked = !!state.candidateWindow;
  $("#toggle-ac").checked = !!state.autoCorrect;
  $("#toggle-as").checked = !!state.autoSpace;
  $("#toggle-remember").checked = !!state.rememberLastLanguage;
  $("#toggle-indicator").checked = !!state.floatingIndicator;
  setPressed("[data-lang]", state.language, "lang");
  setPressed("[data-theme]", state.theme, "theme");

  const sites = Array.isArray(state.disabledSites) ? state.disabledSites : [];
  const siteOff = !!siteHost && sites.includes(siteHost);
  $("#site-card").hidden = !siteHost;
  $("#site-host").textContent = siteHost;
  $("#toggle-site").checked = !siteOff;

  let status = "Disabled";
  if (state.enabled) {
    status = siteOff ? "Off on this site" : state.language === "bn" ? "Enabled — Bangla" : "Enabled — English";
  }
  $("#status-text").textContent = status;
  $("#status-dot").classList.toggle("off", !state.enabled || siteOff);
  applyTheme(state.theme);
}

async function load() {
  render(await chrome.storage.sync.get(DEFAULTS));
}

async function update(patch) {
  await chrome.storage.sync.set(patch);
  await load();
}

async function toggleSite(on) {
  if (!siteHost) return;
  const { disabledSites } = await chrome.storage.sync.get({ disabledSites: [] });
  const set = new Set(Array.isArray(disabledSites) ? disabledSites : []);
  if (on) set.delete(siteHost);
  else set.add(siteHost);
  await update({ disabledSites: [...set].sort() });
}

async function detectSite() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const url = new URL(tab?.url || "");
    if (url.protocol === "http:" || url.protocol === "https:") siteHost = url.hostname;
  } catch (_) {
    siteHost = "";
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  $("#version").textContent = "v" + chrome.runtime.getManifest().version;
  await detectSite();
  await load();
  // Live update when settings change elsewhere (e.g. the Ctrl+Space toggle)
  chrome.storage.onChanged.addListener((_ch, area) => {
    if (area === "sync") load();
  });
  $("#toggle-enabled").addEventListener("change", (e) => update({ enabled: e.target.checked }));
  $("#toggle-site").addEventListener("change", (e) => toggleSite(e.target.checked));
  $("#toggle-cw").addEventListener("change", (e) => update({ candidateWindow: e.target.checked }));
  $("#toggle-ac").addEventListener("change", (e) => update({ autoCorrect: e.target.checked }));
  $("#toggle-as").addEventListener("change", (e) => update({ autoSpace: e.target.checked }));
  $("#toggle-remember").addEventListener("change", (e) => update({ rememberLastLanguage: e.target.checked }));
  $("#toggle-indicator").addEventListener("change", (e) => update({ floatingIndicator: e.target.checked }));
  document.querySelectorAll("[data-lang]").forEach((btn) => {
    btn.addEventListener("click", () => update({ language: btn.dataset.lang }));
  });
  document.querySelectorAll("[data-theme]").forEach((btn) => {
    btn.addEventListener("click", () => update({ theme: btn.dataset.theme }));
  });
  $("#open-options").addEventListener("click", () => chrome.runtime.openOptionsPage());
});
