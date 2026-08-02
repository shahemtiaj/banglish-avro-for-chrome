# SE Banglish Avro for Chrome

[![Chrome Web Store Version](https://img.shields.io/chrome-web-store/v/negapmfaeibbdafolmhidaoiddcigdbh?label=Chrome%20Web%20Store&color=FF9F1C&logo=googlechrome&logoColor=white)](https://chromewebstore.google.com/detail/se-banglish-avro-for-chro/negapmfaeibbdafolmhidaoiddcigdbh)
[![Chrome Web Store Users](https://img.shields.io/chrome-web-store/users/negapmfaeibbdafolmhidaoiddcigdbh?label=Users&color=FFC857&logo=googlechrome&logoColor=white)](https://chromewebstore.google.com/detail/se-banglish-avro-for-chro/negapmfaeibbdafolmhidaoiddcigdbh)
[![License: MIT](https://img.shields.io/badge/License-MIT-3B82F6.svg)](LICENSE)
[![Manifest V3](https://img.shields.io/badge/Manifest-V3-10B981.svg)](https://developer.chrome.com/docs/extensions/mv3/intro/)

> An Apple-inspired, Avro-style phonetic keyboard for Chrome. Type English letters and watch flawless Bangla appear in every input, textarea, and content editor on the web.

**[Install from Chrome Web Store](https://chromewebstore.google.com/detail/se-banglish-avro-for-chro/negapmfaeibbdafolmhidaoiddcigdbh?authuser=0&hl=en)** · **[Landing Page](https://shahemtiaj.com)** · **[Report an Issue](../../issues)**

---

## Features

- **Avro-style phonetic engine** — Longest-match tokenizer with full support for kar, ref, juktakkhor, hasanta, chandrabindu, anuswar, and visarga. Under 5 ms per keystroke.
- **Floating candidate window** — Glassy suggestion popup with arrow-key navigation, number shortcuts, and one-click commit — inspired by macOS IMEs.
- **Works everywhere** — Gmail, X, Facebook, Messenger, Notion, Medium, ChatGPT, Claude, Gemini, Google Docs, and any editable field on any site.
- **Custom dictionary** — Add names, brands, and slang once; they show up as top suggestions everywhere. Import and export as JSON.
- **Apple-inspired UI** — Material 3 motion, Apple HIG spacing, smooth springs, ripple hovers, and light/dark/system theme.
- **Private by design** — Everything runs locally. No servers, no analytics, no tracking. Your dictionary syncs only via Chrome Storage Sync.

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
| Select next suggestion | `↓` or `Tab` |
| Select previous suggestion | `↑` |
| Commit selected suggestion | `Enter` or `Space` |
| Insert Bengali dari (।) | `.` in Bangla mode |

Type phonetically, e.g.:

| Phonetic | Bangla |
| --- | --- |
| `ami` | আমি |
| `bangla` | বাংলা |
| `shikkha` | শিক্ষা |
| `bybohar` | ব্যবহার |
| `bishwabidyaloy` | বিশ্ববিদ্যালয় |
| `muktijuddho` | মুক্তিযুদ্ধ |

## Privacy

SE Banglish Avro does not collect, transmit, or store any personal data on external servers. All transliteration happens locally in your browser. Your custom dictionary is stored in Chrome's synced storage and stays tied to your Google account only if you have Chrome Sync enabled.

## Development

This project is built as a Manifest V3 Chrome Extension using vanilla JavaScript. The landing page is a TanStack Start application.

```bash
# Install dependencies
bun install

# Run the landing page dev server
bun dev

# Build the extension ZIP
bun run build:extension
```

## Credits

Made with love by **[Shah Emtiaj](https://shahemtiaj.com)**.

- Website: [shahemtiaj.com](https://shahemtiaj.com)
- GitHub: [@shahemtiaj](https://github.com/shahemtiaj)
- Facebook: [@shahemtiaj](https://facebook.com/shahemtiaj)

## License

[MIT](LICENSE) © **[Shah Emtiaj](https://shahemtiaj.com)**
