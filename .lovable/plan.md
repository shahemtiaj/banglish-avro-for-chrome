## Overview

Build a production-ready Manifest V3 Chrome Extension, **SE Banglish Avro for Chrome**, inside this TanStack Start project. The extension source lives in `/extension/`, gets zipped to `public/se-banglish-avro.zip`, and the app's home route (`src/routes/index.tsx`) becomes an Apple-style landing page with a download button and install instructions.

Stack for the extension: Manifest V3, vanilla TypeScript compiled to plain JS (bundled with esbuild at package time — no framework runtime), SCSS compiled to CSS, Chrome Storage / Commands / ContextMenus APIs.

## Extension architecture

```text
extension/
├── manifest.json              MV3, permissions: storage, contextMenus, activeTab, scripting; commands: toggle
├── icons/                     16/32/48/128 PNGs (generated)
├── background/
│   └── service-worker.js      command handler, context menu, storage defaults, message bus
├── content/
│   ├── content.js             injects engine into every page; hooks input/textarea/contenteditable
│   ├── composer.js            per-field composition buffer, caret handling, Google Docs best-effort
│   └── candidate-window.js    floating candidate UI, keyboard nav (arrows/enter/tab/1-9), mouse click
├── engine/
│   ├── avro-engine.js         phonetic transliteration (incremental, <5ms), kar/ref/juktakkhor/hasanta/
│   │                          chandrabindu/anuswar/visarga/ZWNJ/ZWJ, context-aware vowel handling
│   ├── suggester.js           top-N candidates: dictionary + learned + recent + pinned
│   └── learn-store.js         frequency + recency store in chrome.storage.local
├── dictionary/
│   ├── core.json              curated Banglish→Bangla word list (thousands of entries, bundled)
│   └── loader.js              lazy JSON fetch, in-memory trie index
├── popup/
│   ├── popup.html/.css/.js    dashboard: enable toggle, language, mode, sub-toggles, theme
├── options/
│   ├── options.html/.css/.js  sections: General, Typing, Dictionary, Appearance, Shortcuts, Backup, About;
│                              import/export/reset, stats (words/chars/most-used lang), custom dict CRUD
├── shared/
│   ├── settings.js            typed settings schema, chrome.storage.sync wrapper, defaults, migrations
│   ├── messages.js            typed message contracts between SW/content/popup/options
│   └── theme.js               light/dark/system, palette tokens
├── styles/
│   ├── _tokens.scss           colors (#FF9F1C, #FFB84D, #FFC857, #FAFAFA, #1E1E1E, #111), radii, shadows,
│   │                          motion (150-250ms springs), glass surfaces
│   ├── _base.scss             Inter + Noto Sans Bengali, typographic scale, a11y focus rings
│   ├── popup.scss / options.scss / candidate.scss
└── utils/
    ├── dom.js                 caret utils, contenteditable range helpers, RTL-safe
    └── perf.js                microtask scheduler, debounced writes
```

Build/package pipeline (added under `scripts/`):
- `scripts/build-extension.mjs` — esbuild bundle TS→JS per entry (background, content, popup, options), sass render SCSS→CSS, copy manifest/icons/dictionary into `extension-dist/`.
- `scripts/package-extension.mjs` — zip `extension-dist/` to `public/se-banglish-avro.zip` (using `nix run nixpkgs#zip`).
- Icons generated once via image generation to `extension/icons/`.

## Typing engine details

- Incremental composition: buffer Latin chars per focused field; on each keystroke run engine and show underlined preview + candidate window.
- Rule table + longest-match: multi-char digraphs first (`sh`, `ch`, `kh`, `gh`, `jh`, `th`, `dh`, `ph`, `bh`, `NG`, `NN`), then vowels with kar/independent form based on position, then consonants, then hasanta joins for juktakkhor. Explicit rules for `^` (chandrabindu), `.` (khanda-ta), `,,` (ZWNJ), `Y` (ya-phala), `rr` (ref) matching Avro conventions.
- Commit on: space, punctuation, Enter, focus loss, Tab (accept top candidate), or number key when candidate window open.
- `learn-store.js` bumps frequency of committed words; suggester merges dictionary hits with learned + recent + pinned, dedup, ranked.
- Perf: single delegated `keydown`/`input`/`compositionstart` listener at document root using capture; no MutationObserver on the whole page; per-field state keyed by WeakMap.

## Candidate window

- Fixed-position shadow-DOM element to isolate from host page CSS; glassmorphism, rounded 12px, soft shadow, spring pop-in (translateY + opacity, 180ms).
- Keyboard: ↑/↓ select, Enter/Tab commit, 1–9 quick pick, Esc dismiss, click to commit. Scrollable when >8 items.

## Popup and options

- Popup: header (logo, name, gear), enable toggle (segmented), language segmented control (Bangla/English), typing mode, toggles (candidate window, auto-correct, auto-space, remember last lang, floating indicator), theme selector (light/dark/system), footer (version, GitHub, Privacy).
- Options: left-rail sections listed above; forms bound to settings schema; dictionary editor (add/delete/import JSON/export JSON); backup import/export whole settings + learned words; stats panel; reset button with confirm.
- All UI uses palette tokens, Inter + Noto Sans Bengali, Material 3 motion + Apple spacing, ARIA labels, keyboard-first, high-contrast focus rings.

## Shortcuts and context

- `commands` in manifest: `toggle-banglish` default `Ctrl+Space` (Mac `MacCtrl+Space`); configurable via `chrome://extensions/shortcuts` (linked from options).
- Context menu: "Toggle Banglish here", "Open settings".

## Landing page in this app

Rewrite `src/routes/index.tsx` (replacing placeholder) as the extension's Apple-style landing page:
- Hero: product name, tagline, download button, screenshot mock.
- Feature grid (engine, candidate window, learning, themes, shortcuts, privacy).
- Install steps (unzip, `chrome://extensions`, Developer mode, Load unpacked).
- Download handled via fetch+blob to `/se-banglish-avro.zip` (per chrome-extension skill; direct `<a download>` fails in preview).
- Update `__root.tsx` `head()` with real title/description/OG/Twitter for the extension; add Inter + Noto Sans Bengali via `<link>` tags (Tailwind v4 rule).
- Add semantic color tokens matching the palette in `src/styles.css` (oklch equivalents); no hardcoded hex in components.

## Deliverables

- Full `/extension/` source, no placeholders.
- `public/se-banglish-avro.zip` produced by the packaging script and committed.
- Landing page at `/` with working download + install instructions.
- README notes on how to rebuild the zip after editing extension source.

## Technical notes (for reviewers)

- Extension code is plain ES modules loaded via manifest; TypeScript is used at authoring time and bundled to JS in `extension-dist/` — Chrome loads JS only.
- No React/Vue/Angular/jQuery inside the extension; the landing page still uses the project's TanStack Start + Tailwind stack.
- The extension does NOT depend on the TanStack app at runtime; only the ZIP is shipped.
- Google Docs support is best-effort via the canvas-based editor's hidden textarea; documented as such in options.
