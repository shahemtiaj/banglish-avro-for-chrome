## Goal

Bangla Academy'r "সরকারি কাজে প্রমিত বাংলা ব্যবহারের নিয়ম" PDF theke word list ar juktakkhor list extract kore extension er dictionary ar transliteration engine e merge kora — jate `শিক্ষা`, `জ্ঞান`, `ণত্ব-ষত্ব` valid banan gula thik ashe.

Scope: **dictionary expand + juktakkhor fix only** (per user). Full ণত্ব-ষত্ব rule engine ei plan e nei.

## Steps

1. **Extract from PDF** (`/tmp/b.pdf` → text already at `/tmp/b.txt`, 10k lines)
   - Parse the যুক্তবর্ণ / juktakkhor section → list of Bangla conjuncts with example words.
   - Parse the standard banan word lists (sarkari promito banan) → Bangla words.
   - Script (Python) writes two artifacts:
     - `/tmp/clusters.json` — Bangla conjunct + example
     - `/tmp/promito-words.json` — list of correctly-spelled Bangla words

2. **Build phonetic reverse-map (Bangla → Banglish keys)**
   - Auto-generate a Banglish key for each Bangla word using a reverse-transliteration table (same rules as the engine, inverse). E.g. `শিক্ষা` → `shikkha`, `জ্ঞান` → `gyan`, `বিশ্ববিদ্যালয়` → `bishwabidyaloy`.
   - Handle common alt spellings (v/bh, sh/S, ee/i, oo/u) by emitting 1–3 keys per word.
   - Output merged dict: `{ banglish_key: bangla_word }`.

3. **Expand juktakkhor cluster map** in both engines
   - `extension/content/content.js` and `src/lib/avro.ts` — add missing clusters found in PDF: `ksh/kkh/kSh→ক্ষ`, `jny/gy/gg→জ্ঞ`, `hm/hn/hN→হ্ম/হ্ন/হ্ণ`, `NT/NTh/ND/NDh→ণ্ট/ণ্ঠ/ণ্ড/ণ্ঢ`, `shch/nch/nj→শ্চ/ঞ্চ/ঞ্জ`, `ttv/ttw→ত্ত্ব`, `shT/shTh/shN→ষ্ট/ষ্ঠ/ষ্ণ`, `sht/shth/shn→স্ত/স্থ/স্ন`, `ngg/ngk/ngkh→ঙ্গ/ঙ্ক/ঙ্খ`, `ndr/ntr/mpr` etc. Expand from PDF cluster list.
   - Fix the tokenizer bug: current `shikkha → শিক্খা` is because `sh + i + kkh + a` — `kkh` cluster needs to bind to the following vowel as `ক্ষা` not break. Verify `CLUSTERS` matching runs BEFORE consonant match and the following vowel becomes kar of last consonant in cluster.

4. **Merge dictionary** into `extension/dictionary/core.json` and `src/lib/bn-dictionary.json`
   - Combine current ~600 entries + generated promito entries (target 2000–3000 unique keys). Dedupe by key; prefer promito banan on conflict.

5. **Rebuild & verify**
   - Repack `public/se-banglish-avro.zip`.
   - Playwright: hit `/`, type `shikkha`, `gyan`, `krishno`, `bishwabidyaloy`, `mahanogor` — verify suggestions include correct promito banan.

## Technical notes

- PDF text is corrupted in places (font mapping), so word extraction will need a heuristic filter: keep only strings matching `[\u0980-\u09FF]{2,}` and drop non-dictionary noise. Manual pass may drop 20–30% garbage but rest is usable.
- Reverse-transliteration is lossy; generating multiple Banglish keys per Bangla word is fine (dictionary is many→one mapping).
- No engine architecture change — cluster table + dictionary grow only. Keeps <5ms latency.

## Out of scope (per user)

- ণত্ব-ষত্ব post-processor
- Full grammar rule engine
- Auto banan-correction of user's typed English words