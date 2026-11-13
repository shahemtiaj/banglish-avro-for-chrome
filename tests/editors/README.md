# Editor compatibility tests

"Works on every website" really means "works with every way a website can
build a text box". These tests load the unpacked extension in Chrome and type
into small pages built with the editors popular sites use:

| Page | Stands in for |
| --- | --- |
| `plain` (textarea, contenteditable, design-mode iframe, srcdoc iframe, search form, modal dialog, transformed page) | ordinary sites, Gmail-style editors, classic forum editors |
| `react` | controlled React inputs |
| `shadow` (open and closed) | web-component based sites |
| `csp` | sites with a strict Content-Security-Policy and Trusted Types |
| `lexical` | Facebook, Messenger, WhatsApp Web |
| `draft` | X / Twitter |
| `slate` | Discord |
| `tiptap` (ProseMirror) | ChatGPT, Claude, Notion-style editors |
| `quill` | Gemini, LinkedIn, Slack |
| `ckeditor`, `tinymce` | CMS and forum editors, WordPress |
| `cm6`, `cm5`, `ace`, `monaco` | code editors |

Every page is asked for its own *model* text (not the DOM), so an editor that
silently drops or duplicates a conversion fails the test.

```bash
cd tests/editors
npm install
npm test                      # all pages
node run.mjs ../../extension lexical   # one page
```

Set `CHROME_PATH` to a Chrome for Testing / Chromium binary if Playwright's own
is not installed. Branded Google Chrome no longer accepts `--load-extension`.
