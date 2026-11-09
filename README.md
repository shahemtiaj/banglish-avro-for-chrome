# SE Banglish Avro for Chrome

[![Chrome Web Store Version](https://img.shields.io/chrome-web-store/v/negapmfaeibbdafolmhidaoiddcigdbh?label=Chrome%20Web%20Store&color=FF9F1C&logo=googlechrome&logoColor=white)](https://chromewebstore.google.com/detail/se-banglish-avro-for-chro/negapmfaeibbdafolmhidaoiddcigdbh)
[![Chrome Web Store Users](https://img.shields.io/chrome-web-store/users/negapmfaeibbdafolmhidaoiddcigdbh?label=Users&color=FFC857&logo=googlechrome&logoColor=white)](https://chromewebstore.google.com/detail/se-banglish-avro-for-chro/negapmfaeibbdafolmhidaoiddcigdbh)
[![License: MIT](https://img.shields.io/badge/License-MIT-3B82F6.svg)](LICENSE)
[![Manifest V3](https://img.shields.io/badge/Manifest-V3-10B981.svg)](https://developer.chrome.com/docs/extensions/mv3/intro/)

> An Apple-inspired, Avro-style phonetic keyboard for Chrome. Type English letters and watch flawless Bangla appear in every input, textarea, and content editor on the web.

**[Install from Chrome Web Store](https://chromewebstore.google.com/detail/se-banglish-avro-for-chro/negapmfaeibbdafolmhidaoiddcigdbh?authuser=0&hl=en)** · **[Landing Page](https://shahemtiaj.com)** · **[Report an Issue](../../issues)**

---

## Features

- **Avro-style phonetic engine** — Longest-match tokenizer with kar, reph, র/য/ব-ফলা, hasanta, chandrabindu, anuswar and visarga. Only real Bangla conjuncts are joined, so `rajshahi` gives রাজশাহি, never রাজ্শাহি. Well under 1 ms per keystroke.
- **6,000-word spelling dictionary** — Common words come out with the correct banan (`prithibi` → পৃথিবী), including case endings (`prithibite` → পৃথিবীতে, `manushke` → মানুষকে).
- **Candidate window at the caret** — Dictionary completions, phonetic alternatives (ঋ-kar, ো, unjoined) and the untouched English word, with arrow-key navigation. It remembers what you pick.
- **Backspace to undo** — Pressing Backspace right after a conversion reopens the word as you typed it.
- **Works everywhere** — Gmail, X, Facebook, Messenger, Notion, Medium, ChatGPT, Claude, Gemini, Google Docs, and any editable field. E-mail, password, phone and OTP fields are left alone.
- **Per-site switch** — Turn Bangla typing off for a single site from the toolbar popup.
- **Custom dictionary** — Add names, brands, and slang once; they show up as top suggestions everywhere. Import and export as JSON.
- **Private by design** — Everything runs locally. No servers, no analytics, no tracking, and web pages cannot detect that the extension is installed.

## Installation

### Option 1: Chrome Web Store (Recommended)

Click the button below and install in one click:

**[Install SE Banglish Avro from Chrome Web Store](https://chromewebstore.google.com/detail/se-banglish-avro-for-chro/negapmfaeibbdafolmhidaoiddcigdbh?authuser=0&hl=en)**

### Option 2: Manual Load (Unpacked)

1. Download the latest `se-banglish-avro.zip` from the [releases page](../../releases) or the [landing page](https://shahemtiaj.com).
2. Unzip the file anywhere on your computer.
3. Open Chrome and go to `chrome://extensions`.
4. Enable **Developer mode** (toggle in the top-right corner).
5. Click **Load unpacked** and select the unzipped folder.
6. Done — start typing Bangla anywhere.

## Usage

| Action | Shortcut |
| --- | --- |
| Toggle Bangla / English | `Ctrl + Space` (Windows/Linux) or `MacCtrl + Space` (macOS) |
| Convert the word | `Space`, `Enter`, or any punctuation |
| Move through suggestions | `↓` / `↑` |
| Take the highlighted suggestion | `Tab`, or `Space` / `Enter` after moving the selection |
| Take suggestion number *n* | `Alt + n` |
| Close the suggestion window | `Esc` |
| Reopen the word you just converted | `Backspace` |
| Bengali dari (।) | `.` after a word — type `.` again for `..` / `...`; decimals like `3.5` stay as they are |
| Keep a word in English | pick the last suggestion (the word as typed) |

Typing rules worth knowing:

| Type | Get | Why |
| --- | --- | --- |
| `kormo` / `dhorrmo` | কর্ম / ধর্ম | `r` before a consonant, or `rr`, makes a reph |
| `bishwo`, `bidyut` | বিশ্ব, বিদ্যুত | `w` and `y` after a consonant are ব-ফলা and য-ফলা |
| `bangla`, `bangali` | বাংলা, বাঙালি | `ng` is ং before a consonant and ঙ before a vowel |
| `du:kho` | দুঃখ | `:` inside a word is a visarga |
| `ca^d` | চাঁদ | `^` is a chandrabindu |
| <code>ut``sob</code> | উৎসব | `t` followed by two backticks is khanda-ta (ৎ) |
| <code>ek`ta</code> | একতা | a single backtick keeps two letters from joining |
| `T D N S R` | ট ড ণ শ ড় | capitals select the retroflex / alternate letter |

Type phonetically, e.g.:

| Phonetic | Bangla |
| --- | --- |
| `ami` | আমি |
| `bangla` | বাংলা |
| `shikkha` | শিক্ষা |
| `bybohar` | ব্যবহার |
| `bishwabidyaloy` | বিশ্ববিদ্যালয় |
| `muktijuddho` | মুক্তিযুদ্ধ |

## Privacy

SE Banglish Avro does not collect, transmit, or store any personal data on external servers. All transliteration happens locally in your browser. Your settings and custom dictionary are stored in Chrome's synced storage and leave your device only if you have Chrome Sync enabled. Typing statistics and learned suggestions never leave the device. The extension asks for no network access of its own and exposes no files to web pages.

## Development

The extension is a Manifest V3 Chrome extension in plain JavaScript — no build step, load `extension/` unpacked. The landing page is a TanStack Start application.

```
extension/
  lib/engine.js           phonetic engine — the single copy used by the content script,
                          the options page, the landing-page demo and the tests
  content/content.js      typing, candidate window, Google Docs adapter
  background/             service worker: settings, dictionary delivery, statistics
  dictionary/core.json    Banglish → Bangla spelling dictionary
  popup/  options/        UI
tests/                    engine + dictionary tests (Node), optional browser test
scripts/build-extension.mjs
```

```bash
# Engine and dictionary tests (Node 20+, no dependencies)
npm test

# Pack extension/ into public/se-banglish-avro.zip (pure Node, any OS)
npm run build:extension

# Optional: real-browser typing test
npm i -D playwright && node tests/e2e/typing.e2e.mjs

# Landing page
bun install && bun dev
```

When you change `extension/dictionary/core.json`, run `npm run build:extension` — it also refreshes the copy the landing page uses.

## Credits

Made with love by **[Shah Emtiaj](https://shahemtiaj.com)**.

- Website: [shahemtiaj.com](https://shahemtiaj.com)
- GitHub: [@shahemtiaj](https://github.com/shahemtiaj)
- Facebook: [@shahemtiaj](https://facebook.com/shahemtiaj)

## License

[MIT](LICENSE) © **[Shah Emtiaj](https://shahemtiaj.com)**
