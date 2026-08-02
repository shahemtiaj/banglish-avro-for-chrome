# Avro Chrome

You are a senior Chrome Extension engineer, UX designer, and Bangla input method expert.

Build a production-ready Chrome Extension named:

SE Banglish Avro for Chrome

Goal:

Create the best Bangla phonetic typing extension for Chrome with an Apple-inspired Material 3 interface.

This should feel more polished than existing Bangla typing extensions while remaining lightweight, blazing fast, and modern.

====================================================

CORE PURPOSE

====================================================

The extension allows users to type Bangla anywhere on the web using Avro-style phonetic transliteration.

Users type English letters.

Example:

ami

→ আমি

bangladesh

→ বাংলাদেশ

shundor

→ সুন্দর

kotha

→ কথা

valo

→ ভালো

The extension should automatically replace Latin characters with Bangla.

The typing experience must be extremely responsive.

Typing latency should feel almost zero.

====================================================

DESIGN REQUIREMENTS

====================================================

Visual Style:

Apple Human Interface inspired

Google Material 3

Minimal

Premium

Elegant

Smooth animations

Glassmorphism where appropriate

Rounded corners

Soft shadows

Excellent spacing

No clutter

Feels like a native macOS application.

====================================================

COLOR PALETTE

====================================================

Primary

#FF9F1C

Secondary

#FFB84D

Background Light

#FAFAFA

Background Dark

#1E1E1E

Text

#111111

Accent

#FFC857

====================================================

TYPOGRAPHY

====================================================

Inter

Noto Sans Bengali

Use proper typography hierarchy.

====================================================

POPUP UI

====================================================

Modern dashboard.

Header

Extension logo

Name

Settings button

Main Toggle

Enable/Disable typing

Language selector

Bangla

English

Typing Mode

Phonetic

Candidate window toggle

Auto correction toggle

Auto space toggle

Remember last language

Floating status indicator toggle

Dark mode

Light mode

System mode

Footer

Version

GitHub

Privacy

====================================================

TYPING ENGINE

====================================================

Implement Avro-style phonetic transliteration engine.

Must support

Complex Bangla conjuncts

Kar

Ref

Juktakkhor

Hasanta

Chandrabindu

Anuswar

Visarga

ZWNJ

ZWJ

Smart vowel handling

Context-aware replacements

Incremental conversion

No input lag.

Architecture must allow loading dictionary separately.

Dictionary should be JSON-based.

====================================================

CANDIDATE WINDOW

====================================================

Like Microsoft IME / Google Japanese IME.

Shows

Top suggestions

Keyboard navigation

Arrow keys

Enter

Tab

Number shortcuts

Mouse click

Live updating

Scrollable

Smooth animation

====================================================

SMART FEATURES

====================================================

Prediction

Word completion

User history

Frequently used words

Recent words

Pinned words

Learning dictionary

Custom dictionary

Add word

Delete word

Import dictionary

Export dictionary

====================================================

SHORTCUTS

====================================================

Configurable shortcut

Default

Ctrl + Space

Switch Bangla / English

Popup shortcut

Context menu

====================================================

SUPPORTED INPUTS

====================================================

Input

textarea

input

contenteditable

Google Docs (best effort)

Facebook

Messenger

Twitter/X

Gmail

Reddit

Notion

Medium

WordPress

Elementor

ChatGPT

Claude

Gemini

Every editable webpage.

====================================================

PERFORMANCE

====================================================

Typing latency

Under 5ms

Memory

Minimal

No unnecessary DOM observers.

Efficient event delegation.

Lazy loading.

====================================================

OPTIONS PAGE

====================================================

Apple-style settings page.

Sections

General

Typing

Dictionary

Appearance

Shortcuts

Backup

About

====================================================

FEATURES

====================================================

Import settings

Export settings

Cloud-ready architecture

Sync with Chrome Storage Sync

Reset settings

Statistics

Words typed

Characters typed

Most used language

====================================================

ACCESSIBILITY

====================================================

Keyboard-first

ARIA

High contrast

Screen reader friendly

RTL-safe

====================================================

ANIMATIONS

====================================================

Material Motion

Spring animations

150-250ms

Subtle hover effects

Ripple effects

Smooth transitions

====================================================

TECH STACK

====================================================

Manifest V3

Vanilla TypeScript

ES Modules

No React

No Vue

No Angular

No jQuery

SCSS

Chrome Storage API

Commands API

ContextMenus API

Offscreen API only if required.

====================================================

PROJECT STRUCTURE

====================================================

Use clean architecture.

src/

engine/

dictionary/

popup/

options/

content/

background/

shared/

assets/

styles/

utils/

====================================================

CODE QUALITY

====================================================

Strict TypeScript

ESLint

Prettier

Reusable components

Zero duplicated code

Comments only where necessary.

====================================================

FUTURE FEATURES (Architecture Ready)

====================================================

AI prediction

Cloud sync

Phrase suggestions

Emoji suggestions

Voice typing

OCR typing

Offline dictionary updates

Multiple layouts

Ridmik style

National layout

Probhat

Custom layout

====================================================

DELIVERABLE

====================================================

Produce a complete production-ready Chrome Extension.

Everything should be modular.

Every component must be fully implemented.

No placeholders.

No demo code.

No fake implementations.

The final extension should be polished enough to publish directly to the Chrome Web Store.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/cd0c7f62-70ee-4fef-bb8a-97d93a5b9218).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
