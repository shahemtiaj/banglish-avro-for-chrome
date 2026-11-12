# Changelog

## 3.3.0

### Works on more sites
Tested against the editor frameworks popular sites are built on (`tests/editors`). Fixed:
- **Slate (Discord) and CKEditor 5**: nothing was converted, and Slate text could be scrambled. These editors ignore `document.execCommand`; conversions are now offered as a `beforeinput` event first, which they accept.
- **Lexical (Facebook, Messenger, WhatsApp Web) and Draft.js (X)**: picking a suggestion with Enter also inserted a line break, Backspace-undo ate an extra letter, and the dari after a word was lost. Keys the extension handles no longer reach the editor as well, and a word and its dari are written in one edit.
- **Rich-text iframes built with `document.open()`** (classic forum / CMS editors): typing did nothing, because that call removes the extension's listeners. They are re-attached.
- **Shadow DOM**: contenteditable fields inside web components, and fields inside *closed* shadow roots, now convert.
- **Modal dialogs and full-screen elements** no longer cover the suggestion window (it is shown in the browser's top layer).
- **CodeMirror 5, Ace and Monaco** (hidden-textarea code editors): typed words used to vanish. They now use the same buffered typing as Google Docs. Terminals are left alone.
- Editors that cancel the browser's own text insertion never fired `input`, so the suggestion window did not open; it now also follows the caret.
- The suggestion window and language pill are built without `innerHTML` / inline `<style>`, so strict Trusted-Types pages cannot block them.

### Better spelling and more suggestions
- A 140,000-word Bangla word list is matched **by sound**. Both the typing and every word are reduced to a sound key (s / sh, bh / v, j / z, doubled letters, dropped inherent vowels, y / w), so the usual spelling variations all find the real word: `surjasto` → সূর্যাস্ত, `bidda` / `bidya` → বিদ্যা, `bisso` / `bishwo` → বিশ্ব, `orthonoitik` → অর্থনৈতিক.
- Unknown words with a common ending are built from the known stem: `shikkharthira` → শিক্ষার্থীরা, `lokera` → লোকেরা.
- The suggestion window shows up to nine choices: same-sounding words, longer words that start this way, spelling variants, and the Latin original.
- 230 common names and everyday verb forms added to the hand-checked dictionary (রহিম, নুসরাত, আক্তার, ব্যবস্থা, বসে, খেলছে …).
- A full stop becomes a dari only after Bangla text.
- "Auto correction" off disables the word list as well as the dictionary.

### Project
- `tests/editors`: an automated matrix of 29 editor setups, 370 checks.
- `scripts/build-lexicon.mjs` generates the word list. It is derived from the Avro Phonetic dictionary (© OmicronLab) and stays under the MPL 2.0; everything else remains MIT.
- The packaged extension grows from about 90 KB to about 1 MB because of the word list.

## 3.2.0

### Typing
- One shared phonetic engine (`extension/lib/engine.js`) replaces three copies that had drifted apart (content script, options "Try it" box, landing page).
- Consonants are joined only when they form a real Bangla conjunct: `rajshahi` → রাজশাহি (was রাজ্শাহি).
- `w` / `y` after a consonant are ব-ফলা / য-ফলা (`bishwo` → বিশ্ব); `r` after a conjunct is র-ফলা (`rastro` → রাস্ত্র, was রাস্তর).
- `ng` before a vowel is ঙ (`bangali` → বাঙালি); `o` and `a` after a vowel follow Avro (`khao` → খাও, `khaoa` → খাওয়া); word-final `oi` is ই (`boi` → বই).
- `nch` / `shch` produce the common ঞ্চ / শ্চ; added `nth`, `nk`, `nkh`; `S`, `x`, `q`, `ee`, `oo`, khanda-ta and a conjunct separator are mapped.
- A capital first letter no longer produces ড় or ণ at the start of a word (`Rahim` → রাহিম).
- Dictionary words take case endings (`prithibite`, `manushke`, `desher`).
- `:` inside a word is a visarga again (`du:kho` → দুঃখ) — it used to end the word.
- Every punctuation key converts the word before it, not just `. , ! ? ;` (`(ami)`, `ami-tumi`).
- `...` stays an ellipsis and `3.5` stays a decimal instead of turning into dari.
- Space takes the highlighted suggestion once you have moved the selection. A plain Enter converts the word and still reaches the page, so one Enter sends a chat message.
- Backspace right after a conversion reopens the word as typed.
- Suggestions now include phonetic alternatives and the untouched English word, and remember your picks.
- E-mail, username, phone, OTP and card fields are never converted.

### Dictionary
- About 870 entries are repaired, most of them corrupted by an earlier engine bug (জন্য় → জন্য, সূর্জ → সূর্য, মিডিআ → মিডিয়া, গুরুত্ওয়্পূর্ণ → গুরুত্বপূর্ণ, কপি instead of ক্পি, …).
- Everyday words that pointed at the wrong spelling are fixed (`je` → যে, `ar` → আর, `ta` → তা) and ~170 common words and verb forms added.
- য়, ড়, ঢ় are stored in one consistent form.

### Settings that now work
- **Auto correction** switches the spelling dictionary on or off.
- **Auto space** adds a space after you pick a suggestion.
- **Remember last language**: when off, Chrome starts each session in Bangla.
- New: **Use on this site** switch in the popup, with the list of switched-off sites in Settings.
- The toolbar icon shows `EN` or `OFF` when you are not in Bangla mode.

### Performance, privacy, robustness
- The dictionary is loaded only in frames you actually type in, instead of in every iframe of every page.
- No web-accessible resources: sites can no longer detect the extension. The unused `activeTab` permission is gone.
- Statistics moved to local storage; they no longer consume the sync write quota or make the language pill flash in every tab.
- The language pill appears once per page (top frame only), not once per iframe.
- After an update, the old content script detaches cleanly instead of running alongside the new one.
- Candidate window opens at the caret in inputs and textareas and follows the extension theme.
- Google Docs: text typed before an arrow key or shortcut is no longer dropped.

### Options and backup
- Custom words are rendered as text (an imported backup could previously inject markup).
- Imported backups are validated; unknown keys are ignored.
- A clear message when the custom dictionary reaches Chrome Sync's 8 KB limit, instead of failing silently.

### Project
- `npm test` — engine and dictionary tests; optional real-browser test in `tests/e2e`.
- `npm run build:extension` is pure Node (was Nix-only) and produces a reproducible zip.
