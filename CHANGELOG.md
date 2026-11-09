# Changelog

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
