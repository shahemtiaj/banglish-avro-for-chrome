// SE Banglish Avro — phonetic engine (single source of truth).
//
// Classic script on purpose: it is loaded as a content script, from the options
// page via <script>, from the landing page via a side-effect import, and from
// Node for tests. It has no DOM or chrome.* dependency.
//
// Public API: globalThis.SEBanglishEngine
//   transliterate(latin)        best single conversion (dictionary aware)
//   phonetic(latin, opts)       pure rule-based conversion, no dictionary
//   suggest(latin, max)         ranked candidates for the candidate window
//   setDictionary / setCustomDictionary / setLearned / setOptions
//   isWordChar(ch), WORD_CHARS  what counts as part of a Banglish word

(function (root) {
  "use strict";

  const HASANTA = "\u09CD";

  // ------------------------------------------------------------------
  // Tables
  // ------------------------------------------------------------------
  const CONSONANTS = {
    "kh": "খ", "gh": "ঘ", "Ng": "ঙ",
    "chh": "ছ", "ch": "ছ", "jh": "ঝ", "NG": "ঞ",
    "Th": "ঠ", "Dh": "ঢ",
    "th": "থ", "dh": "ধ",
    "ph": "ফ", "bh": "ভ",
    "sh": "শ", "S": "শ", "Sh": "ষ", "ss": "স",
    "Rh": "ঢ়",
    "k": "ক", "q": "ক", "g": "গ",
    "c": "চ", "j": "জ",
    "T": "ট", "D": "ড", "N": "ণ",
    "t": "ত", "d": "দ", "n": "ন",
    "p": "প", "f": "ফ", "b": "ব", "v": "ভ", "m": "ম",
    "z": "য", "l": "ল",
    "s": "স", "h": "হ",
    "R": "ড়",
  };

  // Special conjuncts (juktakkhor) whose spelling is not a plain
  // letter-by-letter join. Checked before generic consonants (longest match).
  const CLUSTERS = {
    "kkh": "ক্ষ", "ksh": "ক্ষ", "kSh": "ক্ষ", "kx": "ক্ষ",
    "jNG": "জ্ঞ", "gg": "জ্ঞ", "gy": "জ্ঞ", "jny": "জ্ঞ",
    "hm": "হ্ম", "hn": "হ্ন", "hN": "হ্ণ", "hl": "হ্ল", "hb": "হ্ব",
    "ttw": "ত্ত্ব", "ttv": "ত্ত্ব", "tm": "ত্ম", "tn": "ত্ন",
    "shc": "শ্চ", "shch": "শ্চ", "shchh": "শ্ছ",
    "nc": "ঞ্চ", "nch": "ঞ্চ", "nchh": "ঞ্ছ", "nj": "ঞ্জ", "njh": "ঞ্ঝ",
    "ND": "ণ্ড", "NT": "ণ্ট", "NTh": "ণ্ঠ", "NDh": "ণ্ঢ", "Nn": "ণ্ন", "Nm": "ণ্ম",
    "ShT": "ষ্ট", "ShTh": "ষ্ঠ", "ShN": "ষ্ণ", "Shp": "ষ্প", "Shk": "ষ্ক", "Shm": "ষ্ম",
    "shT": "ষ্ট", "shTh": "ষ্ঠ", "shN": "ষ্ণ",
    "st": "স্ত", "sth": "স্থ", "sn": "স্ন", "sp": "স্প", "sk": "স্ক", "sf": "স্ফ", "sm": "স্ম", "sl": "স্ল",
    "sht": "স্ত", "shth": "স্থ", "shn": "স্ন",
    "ngg": "ঙ্গ", "ngk": "ঙ্ক", "ngkh": "ঙ্খ", "nggh": "ঙ্ঘ", "nk": "ঙ্ক", "nkh": "ঙ্খ",
    "nt": "ন্ত", "nth": "ন্থ", "nd": "ন্দ", "ndh": "ন্ধ", "nn": "ন্ন", "nm": "ন্ম", "ntr": "ন্ত্র", "ndr": "ন্দ্র",
    "pn": "প্ন", "pl": "প্ল", "ps": "প্স", "pt": "প্ত",
    "mn": "ম্ন", "mp": "ম্প", "mb": "ম্ব", "mbh": "ম্ভ", "ml": "ম্ল",
    "lp": "ল্প", "lk": "ল্ক", "lT": "ল্ট", "lD": "ল্ড", "lm": "ল্ম", "lb": "ল্ব",
    "ddh": "দ্ধ", "db": "দ্ব", "dv": "দ্ব", "dm": "দ্ম",
    "dhb": "ধ্ব",
    "bdh": "ব্ধ", "bl": "ব্ল",
    "cc": "চ্চ", "cch": "চ্ছ", "cchh": "চ্ছ",
    "jj": "জ্জ", "jjh": "জ্ঝ",
    "TT": "ট্ট", "DD": "ড্ড",
    "kk": "ক্ক", "kT": "ক্ট", "kt": "ক্ত", "kl": "ক্ল", "kb": "ক্ব", "km": "ক্ম",
    "gdh": "গ্ধ", "gn": "গ্ন", "gm": "গ্ম", "gl": "গ্ল", "gb": "গ্ব",
    "ghn": "ঘ্ন",
    "shb": "শ্ব",
  };

  const VOWELS = {
    "rri": { ind: "ঋ", kar: "ৃ" },
    "OI":  { ind: "ঐ", kar: "ৈ" },
    "oi":  { ind: "ঐ", kar: "ৈ" },
    "OU":  { ind: "ঔ", kar: "ৌ" },
    "ou":  { ind: "ঔ", kar: "ৌ" },
    "aa":  { ind: "আ", kar: "া" },
    "A":   { ind: "আ", kar: "া" },
    "a":   { ind: "আ", kar: "া" },
    "I":   { ind: "ঈ", kar: "ী" },
    "ii":  { ind: "ঈ", kar: "ী" },
    "ee":  { ind: "ঈ", kar: "ী" },
    "i":   { ind: "ই", kar: "ি" },
    "U":   { ind: "ঊ", kar: "ূ" },
    "uu":  { ind: "ঊ", kar: "ূ" },
    "oo":  { ind: "উ", kar: "ু" },
    "u":   { ind: "উ", kar: "ু" },
    "E":   { ind: "এ", kar: "ে" },
    "e":   { ind: "এ", kar: "ে" },
    "O":   { ind: "ও", kar: "ো" },
    "o":   { ind: "অ", kar: "" }, // inherent vowel
  };

  // Tokens with bespoke handling in the main loop.
  const SPECIAL = ["rr", "r", "y", "Y", "w", "x", "ng", "t``", "^", ":", "`"];

  const DIGIT_MAP = { "0": "০", "1": "১", "2": "২", "3": "৩", "4": "৪", "5": "৫", "6": "৬", "7": "৭", "8": "৮", "9": "৯" };
  const PUNCT_MAP = { ".": "।" };

  // Which consonant pairs form a real Bangla conjunct. Anything else is written
  // side by side (rajshahi → রাজশাহি, never রাজ্শাহি). র-ফলা, য-ফলা, ব-ফলা and
  // reph are handled separately by the r / y / w / rr rules.
  const VALID_PAIRS = (() => {
    const table = {
      "ক": "কটতবমলষস", "গ": "গধনবমলণ", "ঘ": "ন", "ঙ": "কখগঘম",
      "চ": "চছঞ", "জ": "জঝঞব", "ঞ": "চছজঝ",
      "ট": "টবম", "ড": "ডব", "ণ": "টঠডঢণবম",
      "ত": "তথনবম", "থ": "ব", "দ": "গঘদধবভম", "ধ": "নবম",
      "ন": "টঠডতথদধনবমস",
      "প": "টতনপলস", "ফ": "টল", "ব": "জদধবল", "ভ": "ল",
      "ম": "নপফবভমল",
      "ল": "কগটডপফবমল",
      "শ": "চছতনবমল", "ষ": "কটঠণপফবম", "স": "কখটতথনপফবমল",
      "হ": "ণনবমল",
    };
    const set = new Set();
    for (const a in table) for (const b of table[a]) set.add(a + b);
    return set;
  })();

  // Three-letter conjuncts allowed on top of an existing ligature.
  const VALID_TRIPLES = new Set([
    "ক্ষ|ম", "ক্ষ|ণ", "ক্ষ|ব", "ন্ত|ব", "ন্দ|ব", "ত্ত|ব", "জ্জ|ব", "চ্ছ|ব", "দ্দ|ব", "স্ত|ব",
    "ম্প|ল", "স্প|ল", "স্ক|ল", "ঙ্ক|ষ", "ন্ধ|ব",
  ]);

  const CASE_INSENSITIVE = /[JCKGBPMLHFVWZQX]/g;
  const LATIN_VOWEL = /[aeiouAEIOU]/;
  const WORD_CHARS = "A-Za-z0-9^:`";
  const WORD_CHAR_RE = new RegExp("[" + WORD_CHARS + "]");
  const HAS_LETTER_RE = /[A-Za-z]/;

  // Token index by first character, longest first.
  const TOKEN_INDEX = (() => {
    const all = [...Object.keys(VOWELS), ...Object.keys(CONSONANTS), ...Object.keys(CLUSTERS), ...SPECIAL];
    const idx = {};
    for (const t of new Set(all)) (idx[t[0]] = idx[t[0]] || []).push(t);
    for (const k in idx) idx[k].sort((a, b) => b.length - a.length);
    return idx;
  })();

  function normalizeCase(s) {
    // Avro is case-sensitive only where case carries meaning (T/t, D/d, N/n,
    // S/s, R/r and the vowels). NG (ঞ) is the one place a capital G matters.
    s = s.replace(CASE_INSENSITIVE, (c, at) => (c === "G" && s[at - 1] === "N" ? c : c.toLowerCase()));
    // ড়, ঢ় and ণ never start a word; a leading capital there is just a
    // capitalised name or sentence start (Rahim, Nahid).
    if (/^R/.test(s)) s = "r" + s.slice(1);
    else if (/^N(?![gG])/.test(s)) s = "n" + s.slice(1);
    return s;
  }

  // ------------------------------------------------------------------
  // Rule-based transliteration
  // ------------------------------------------------------------------
  // opts.loose   → never auto-join two plain consonants (করব instead of কর্ব)
  // opts.riKar   → consonant + "ri" becomes ঋ-kar (পৃথিবী instead of প্রিথিবি)
  // opts.finalO  → a word-final "o" after a consonant is written as ো
  function phonetic(input, opts) {
    if (!input) return "";
    opts = opts || {};
    const latin = normalizeCase(String(input));
    const len = latin.length;
    let i = 0;
    let out = "";
    // prev: start | consonant | ref | vowel | mark | other
    let prev = "start";
    let cur = ""; // the consonant / conjunct currently being built

    const lastLetter = () => {
      for (let k = cur.length - 1; k >= 0; k--) {
        const ch = cur[k];
        if (ch !== HASANTA && ch !== "\u09BC") return ch;
      }
      return "";
    };
    const canJoin = (next) => {
      if (opts.loose) return false;
      if (cur === "র") return true; // reph
      if (!cur.includes(HASANTA)) return VALID_PAIRS.has(cur + next);
      return VALID_TRIPLES.has(cur + "|" + next);
    };
    const pushConsonant = (bn) => {
      if (prev === "ref") { out += bn; cur = "র" + HASANTA + bn; }
      else if (prev === "consonant" && canJoin(bn[0])) { out += HASANTA + bn; cur += HASANTA + bn; }
      else { out += bn; cur = bn; }
      prev = "consonant";
    };

    while (i < len) {
      const ch = latin[i];
      let matched = null;
      const bucket = TOKEN_INDEX[ch];
      if (bucket) {
        for (const t of bucket) {
          if (latin.startsWith(t, i)) { matched = t; break; }
        }
      }
      if (!matched) {
        out += DIGIT_MAP[ch] || PUNCT_MAP[ch] || ch;
        prev = "other"; cur = "";
        i++;
        continue;
      }
      i += matched.length;
      const atEnd = i >= len;

      // ---- vowels ----
      if (VOWELS[matched]) {
        const v = VOWELS[matched];
        if (prev === "consonant" || prev === "ref") {
          if (prev === "ref") out = out.slice(0, -1); // র্ + vowel sign is not a thing
          if (matched === "oi" && atEnd) out += "ই"; // boi → বই, koi → কই
          else if (matched === "o" && atEnd && opts.finalO) out += "ো";
          else out += v.kar;
        } else if (prev === "vowel" && v.ind === "আ") {
          out += "য়া"; // dia → দিয়া, khaoa → খাওয়া
        } else if (prev === "vowel" && matched === "o") {
          out += "ও"; // jao → জাও
        } else {
          out += v.ind;
        }
        prev = "vowel"; cur = "";
        continue;
      }

      // ---- special conjuncts ----
      if (CLUSTERS[matched]) {
        const g = CLUSTERS[matched];
        if (prev === "ref") out += g;
        else if (prev === "consonant" && cur === "র" && !opts.loose) out += HASANTA + g;
        else out += g;
        cur = g; prev = "consonant";
        continue;
      }

      if (matched === "rr") {
        // reph: র্ + the consonant that follows
        out += "র" + HASANTA;
        prev = "ref"; cur = "";
        continue;
      }
      if (matched === "r") {
        if (prev === "consonant" && lastLetter() !== "র" && cur !== "য়") {
          // ri after a consonant can optionally be ঋ-kar
          if (opts.riKar && latin[i] === "i" && latin[i + 1] !== "i") {
            out += "ৃ"; i += 1; prev = "vowel"; cur = "";
            continue;
          }
          out += HASANTA + "র"; cur += HASANTA + "র"; // র-ফলা
        } else if (prev === "ref") {
          out += "র"; cur = "র" + HASANTA + "র";
        } else {
          out += "র"; cur = "র";
        }
        prev = "consonant";
        continue;
      }
      if (matched === "y") {
        if (prev === "consonant" && cur !== "য়" && lastLetter() !== "য") {
          // র + য-ফলা needs a ZWJ, otherwise it renders as reph (র‍্যাব vs র্যাব)
          out += (cur === "র" ? "\u200D" : "") + HASANTA + "য"; cur += HASANTA + "য"; // য-ফলা
        } else {
          out += "য়"; cur = "য়";
        }
        prev = "consonant";
        continue;
      }
      if (matched === "Y") {
        out += "য়"; cur = "য়"; prev = "consonant";
        continue;
      }
      if (matched === "w") {
        if (prev === "consonant" && cur !== "য়" && lastLetter() !== "ব") {
          out += HASANTA + "ব"; cur += HASANTA + "ব"; // ব-ফলা
        } else {
          out += "ওয়"; cur = "য়";
        }
        prev = "consonant";
        continue;
      }
      if (matched === "x") {
        out += "ক্স"; cur = "ক্স"; prev = "consonant";
        continue;
      }
      if (matched === "ng") {
        if (!atEnd && LATIN_VOWEL.test(latin[i])) {
          out += "ঙ"; cur = "ঙ"; prev = "consonant"; // bangali → বাঙালি
        } else {
          out += "ং"; cur = ""; prev = "mark"; // bangla → বাংলা
        }
        continue;
      }
      if (matched === "t``") {
        out += "ৎ"; cur = ""; prev = "mark";
        continue;
      }
      if (matched === "^") {
        out += "ঁ";
        continue;
      }
      if (matched === ":") {
        // visarga inside a word (du:kho → দুঃখ); a trailing colon stays a colon
        if (atEnd || prev === "start" || prev === "other") { out += ":"; prev = "other"; }
        else { out += "ঃ"; prev = "mark"; }
        cur = "";
        continue;
      }
      if (matched === "`") {
        // separator: breaks a conjunct without printing anything (ek`ta → একটা)
        prev = prev === "consonant" || prev === "ref" ? "other" : prev;
        cur = "";
        continue;
      }

      // ---- plain consonants ----
      pushConsonant(CONSONANTS[matched]);
    }
    if (prev === "ref") out = out.slice(0, -1);
    return out;
  }

  // ------------------------------------------------------------------
  // Dictionary layer
  // ------------------------------------------------------------------
  let dictionary = {};
  let dictKeys = [];
  let customDict = {};
  let customKeys = [];
  let learned = {};
  const options = { autoCorrect: true };

  const hasOwn = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  const clean = (obj) => {
    const outObj = Object.create(null);
    if (obj && typeof obj === "object") {
      for (const k in obj) {
        if (hasOwn(obj, k) && typeof obj[k] === "string" && obj[k]) outObj[String(k).toLowerCase()] = obj[k];
      }
    }
    return outObj;
  };

  function setDictionary(obj) { dictionary = clean(obj); dictKeys = Object.keys(dictionary).sort(); }
  function setCustomDictionary(obj) { customDict = clean(obj); customKeys = Object.keys(customDict).sort(); }
  function setLearned(obj) { learned = clean(obj); }
  function setOptions(o) { if (o && typeof o.autoCorrect === "boolean") options.autoCorrect = o.autoCorrect; }

  // Common case endings. `after` says what the Bangla stem must end with.
  const SUFFIXES = [
    { s: "gulo", bn: "গুলো", after: "any" }, { s: "guli", bn: "গুলি", after: "any" },
    { s: "der", bn: "দের", after: "any" }, { s: "tar", bn: "টার", after: "any" }, { s: "tir", bn: "টির", after: "any" },
    { s: "era", bn: "েরা", after: "cons" }, { s: "er", bn: "ের", after: "cons" },
    { s: "ke", bn: "কে", after: "any" }, { s: "te", bn: "তে", after: "any" },
    { s: "ta", bn: "টা", after: "any" }, { s: "ti", bn: "টি", after: "any" },
    { s: "ra", bn: "রা", after: "any" }, { s: "r", bn: "র", after: "vowel" },
    { s: "y", bn: "য়", after: "vowel" }, { s: "e", bn: "ে", after: "cons" },
  ];
  const ENDS_VOWEL = /[\u0985-\u0994\u09BE-\u09CC]$/;
  const ENDS_CONS = /[\u0995-\u09B9\u09DC-\u09DF]$/;

  function stemLookup(key) {
    for (const suf of SUFFIXES) {
      if (!key.endsWith(suf.s)) continue;
      const stem = key.slice(0, -suf.s.length);
      if (stem.length < 4) continue;
      const bn = customDict[stem] || dictionary[stem];
      if (!bn || bn.includes(" ")) continue;
      if (suf.after === "vowel" && !ENDS_VOWEL.test(bn)) continue;
      if (suf.after === "cons" && !ENDS_CONS.test(bn)) continue;
      return bn + suf.bn;
    }
    return null;
  }

  // Returns { text, source } where source is custom | learned | dict | stem | rule.
  function resolve(latin) {
    const key = latin.toLowerCase();
    if (customDict[key]) return { text: customDict[key], source: "custom" };
    if (learned[key]) return { text: learned[key], source: "learned" };
    if (options.autoCorrect) {
      if (dictionary[key]) return { text: dictionary[key], source: "dict" };
      const stemmed = stemLookup(key);
      if (stemmed) return { text: stemmed, source: "stem" };
    }
    return { text: phonetic(latin), source: "rule" };
  }

  function transliterate(latin) {
    if (!latin) return "";
    if (!HAS_LETTER_RE.test(latin)) return latin;
    return resolve(latin).text;
  }

  function lowerBound(keys, target) {
    let lo = 0, hi = keys.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (keys[mid] < target) lo = mid + 1; else hi = mid;
    }
    return lo;
  }
  function prefixHits(keys, prefix, limit) {
    const hits = [];
    for (let k = lowerBound(keys, prefix); k < keys.length && keys[k].startsWith(prefix); k++) {
      if (keys[k].length > prefix.length) hits.push(keys[k]);
      if (hits.length >= 400) break;
    }
    hits.sort((a, b) => a.length - b.length || (a < b ? -1 : 1));
    return hits.slice(0, limit);
  }

  function suggest(latin, max) {
    max = max || 8;
    if (!latin || !HAS_LETTER_RE.test(latin)) return [];
    const key = latin.toLowerCase();
    const out = [];
    const add = (s) => { if (s && !out.includes(s)) out.push(s); };

    const primary = resolve(latin);
    add(primary.text);
    if (customDict[key]) add(customDict[key]);
    if (dictionary[key]) add(dictionary[key]);

    const variants = () => {
      add(phonetic(latin));
      add(phonetic(latin, { riKar: true }));
      add(phonetic(latin, { finalO: true }));
      add(phonetic(latin, { loose: true }));
    };
    const completions = () => {
      for (const k of prefixHits(customKeys, key, max)) add(customDict[k]);
      for (const k of prefixHits(dictKeys, key, max)) add(dictionary[k]);
    };
    if (primary.source === "rule") { variants(); completions(); }
    else { completions(); variants(); }

    // The untouched Latin word is always the last choice, so an English word
    // can be kept without leaving Bangla mode.
    const top = out.slice(0, max - 1);
    if (!top.includes(latin)) top.push(latin);
    return top;
  }

  const api = {
    phonetic,
    transliterate,
    suggest,
    setDictionary,
    setCustomDictionary,
    setLearned,
    setOptions,
    isWordChar: (ch) => WORD_CHAR_RE.test(ch),
    hasLetter: (s) => HAS_LETTER_RE.test(s),
    WORD_CHARS,
  };

  root.SEBanglishEngine = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
