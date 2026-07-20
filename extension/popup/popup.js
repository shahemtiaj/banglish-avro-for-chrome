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
};

const $ = (sel) => document.querySelector(sel);

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme === "system" ? "" : theme;
  if (theme === "system") document.documentElement.removeAttribute("data-theme");
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
  setPressed('[data-lang]', state.language, "lang");
  setPressed('[data-theme]', state.theme, "theme");
  const statusText = state.enabled
    ? (state.language === "bn" ? "Enabled — Bangla" : "Enabled — English")
    : "Disabled";
  $("#status-text").textContent = statusText;
  $("#status-dot").classList.toggle("off", !state.enabled);
  applyTheme(state.theme);
}

async function load() {
  const state = await chrome.storage.sync.get(DEFAULTS);
  render(state);
}

async function update(patch) {
  await chrome.storage.sync.set(patch);
  const state = await chrome.storage.sync.get(DEFAULTS);
  render(state);
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id && "language" in patch) {
    try { await chrome.tabs.sendMessage(tab.id, { type: "SE_LANG_CHANGED", language: patch.language }); } catch (_) {}
  }
}

document.addEventListener("DOMContentLoaded", () => {
  load();
  $("#toggle-enabled").addEventListener("change", (e) => update({ enabled: e.target.checked }));
  $("#toggle-cw").addEventListener("change", (e) => update({ candidateWindow: e.target.checked }));
  $("#toggle-ac").addEventListener("change", (e) => update({ autoCorrect: e.target.checked }));
  $("#toggle-as").addEventListener("change", (e) => update({ autoSpace: e.target.checked }));
  $("#toggle-remember").addEventListener("change", (e) => update({ rememberLastLanguage: e.target.checked }));
  $("#toggle-indicator").addEventListener("change", (e) => update({ floatingIndicator: e.target.checked }));
  document.querySelectorAll('[data-lang]').forEach((btn) => {
    btn.addEventListener("click", () => update({ language: btn.dataset.lang }));
  });
  document.querySelectorAll('[data-theme]').forEach((btn) => {
    btn.addEventListener("click", () => update({ theme: btn.dataset.theme }));
  });
  $("#open-options").addEventListener("click", () => chrome.runtime.openOptionsPage());
});