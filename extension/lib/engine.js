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
  let dictValues = new Set();
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

  function setDictionary(obj) {
    dictionary = clean(obj);
    dictKeys = Object.keys(dictionary).sort();
    dictValues = new Set(Object.values(dictionary));
  }
  function setCustomDictionary(obj) { customDict = clean(obj); customKeys = Object.keys(customDict).sort(); }
  function setLearned(obj) { learned = clean(obj); }
  function setOptions(o) { if (o && typeof o.autoCorrect === "boolean") options.autoCorrect = o.autoCorrect; }

  // ------------------------------------------------------------------
  // Word list ("lexicon") matched by sound
  // ------------------------------------------------------------------
  // People spell the same Bangla word many ways in Latin letters (shundor /
  // sundor, bhalo / valo, biddaloy / bidyaloy). Instead of listing every
  // spelling, both the typed text and every word in the list are reduced to a
  // "sound key": letters people use interchangeably are merged, doubled
  // letters collapse, and the inherent vowel, y and w are dropped. Words with
  // the same key as what was typed are candidates, ranked by how closely their
  // plain romanisation matches the typing.
  const KEY_LATIN = [
    ["chh", "C"], ["kkh", "K"], ["ksh", "K"], ["rri", "ri"],
    ["ch", "C"], ["kh", "K"], ["gh", "G"], ["jh", "J"], ["th", "T"], ["dh", "D"], ["ph", "f"], ["bh", "v"],
    ["sh", "s"], ["ss", "s"],
    ["aa", "a"], ["ee", "i"], ["ii", "i"], ["oo", "u"], ["uu", "u"], ["oi", "i"], ["ou", "u"],
    ["a", "a"], ["b", "b"], ["c", "C"], ["d", "d"], ["e", "e"], ["f", "f"], ["g", "g"], ["h", "h"], ["i", "i"],
    ["j", "j"], ["k", "k"], ["l", "l"], ["m", "m"], ["n", "n"], ["o", "0"], ["p", "p"], ["q", "k"], ["r", "r"],
    ["s", "s"], ["t", "t"], ["u", "u"], ["v", "v"], ["w", "0"], ["x", "ks"], ["y", "0"], ["z", "j"],
  ];
  const KEY_LATIN_INDEX = (() => {
    const idx = {};
    for (const rule of KEY_LATIN) (idx[rule[0][0]] = idx[rule[0][0]] || []).push(rule);
    for (const k in idx) idx[k].sort((a, b) => b[0].length - a[0].length);
    return idx;
  })();
  const KEY_VOWELS = "aeiu0";
  // unaspirated + aspirated written together sound like the aspirated one
  const KEY_ASPIRATE = { kK: "K", gG: "G", jJ: "J", tT: "T", dD: "D" };

  // Append one consonant symbol that directly follows the previous one.
  function joinSymbol(out, sym) {
    const prev = out[out.length - 1];
    if (prev === undefined || KEY_VOWELS.includes(prev)) { out.push(sym); return; }
    if (prev === sym) return; // doubled letter
    if (KEY_ASPIRATE[prev + sym]) { out[out.length - 1] = sym; return; }
    if (prev === "n" && sym === "g") return; // ng
    out.push(sym);
  }

  function latinKey(latin) {
    const s = String(latin).toLowerCase();
    const out = [];
    let i = 0;
    // A word-initial "o" (অ / ও) is always typed, unlike the inherent vowel.
    if (s[0] === "o" && !/^o[iuo]/.test(s)) { out.push("o"); i = 1; }
    while (i < s.length) {
      const rules = KEY_LATIN_INDEX[s[i]];
      let hit = null;
      if (rules) for (const r of rules) { if (s.startsWith(r[0], i)) { hit = r; break; } }
      if (!hit) {
        if (s[i] === "^" || s[i] === ":" || s[i] === "`") { i++; continue; }
        return ""; // digits or symbols: not a plain word
      }
      i += hit[0].length;
      for (const sym of hit[1]) {
        if (KEY_VOWELS.includes(sym)) out.push(sym); else joinSymbol(out, sym);
      }
    }
    return out.join("").replace(/0/g, "");
  }

  const KEY_BANGLA = {
    "ক": "k", "খ": "K", "গ": "g", "ঘ": "G", "ঙ": "n", "চ": "C", "ছ": "C", "জ": "j", "ঝ": "J", "ঞ": "n",
    "ট": "t", "ঠ": "T", "ড": "d", "ঢ": "D", "ণ": "n", "ত": "t", "থ": "T", "দ": "d", "ধ": "D", "ন": "n",
    "প": "p", "ফ": "f", "ব": "b", "ভ": "v", "ম": "m", "য": "j", "র": "r", "ল": "l",
    "শ": "s", "ষ": "s", "স": "s", "হ": "h", "ড়": "r", "ঢ়": "r", "য়": "0", "ৎ": "t", "ং": "n",
    "অ": "0", "আ": "a", "ই": "i", "ঈ": "i", "উ": "u", "ঊ": "u", "ঋ": "ri", "এ": "e", "ঐ": "i", "ও": "0", "ঔ": "u",
    "া": "a", "ি": "i", "ী": "i", "ু": "u", "ূ": "u", "ৃ": "ri", "ে": "e", "ৈ": "i", "ো": "0", "ৌ": "u",
    "ঃ": "", "ঁ": "", "‌": "", "‍": "",
  };
  // ব-ফলা is silent after these
  const SILENT_BA_AFTER = "শষসতথদধজকনণটচছ";

  // Sound key of a Bangla word, or "" if it is not a plain word.
  function banglaKey(word) {
    const w = String(word).replace(/\u09AF\u09BC/g, "\u09DF").replace(/\u09A1\u09BC/g, "\u09DC").replace(/\u09A2\u09BC/g, "\u09DD");
    const out = [];
    let joined = false; // previous character was a hasanta
    let prevChar = "";
    for (let i = 0; i < w.length; i++) {
      const ch = w[i];
      if (ch === HASANTA) { joined = true; continue; }
      const conj = joined;
      joined = false;
      if (ch === "ক" && w[i + 1] === HASANTA && w[i + 2] === "ষ") {
        if (conj) joinSymbol(out, "K"); else out.push("K");
        i += 2; prevChar = "ষ";
        continue;
      }
      if (ch === "জ" && w[i + 1] === HASANTA && w[i + 2] === "ঞ") {
        if (conj) joinSymbol(out, "g"); else out.push("g");
        i += 2; prevChar = "ঞ";
        continue;
      }
      if (i === 0 && (ch === "অ" || ch === "ও")) { out.push("o"); prevChar = ch; continue; }
      const sym = KEY_BANGLA[ch];
      if (sym === undefined) return "";
      if (conj) {
        if (ch === "য" && prevChar !== "র") { prevChar = ch; continue; } // য-ফলা (র্য is reph + য)
        if (ch === "ব" && SILENT_BA_AFTER.includes(prevChar)) { prevChar = ch; continue; }
        joinSymbol(out, sym);
      } else if (sym === "g" && (prevChar === "ং" || prevChar === "ঙ")) {
        // ংগ / ঙগ sound like ঙ্গ
      } else {
        for (const c of sym) out.push(c);
      }
      prevChar = ch;
    }
    return out.join("").replace(/0/g, "");
  }

  // Plain romanisation used only to rank candidates that share a sound key.
  // ক্ষ and জ্ঞ are single units (X, Q) so "shikkh" is never read as শিখ.
  const ROMAN = {
    "ক": "k", "খ": "kh", "গ": "g", "ঘ": "gh", "ঙ": "ng", "চ": "ch", "ছ": "ch", "জ": "j", "ঝ": "jh", "ঞ": "n",
    "ট": "t", "ঠ": "th", "ড": "d", "ঢ": "dh", "ণ": "n", "ত": "t", "থ": "th", "দ": "d", "ধ": "dh", "ন": "n",
    "প": "p", "ফ": "f", "ব": "b", "ভ": "v", "ম": "m", "য": "j", "র": "r", "ল": "l",
    "শ": "s", "ষ": "s", "স": "s", "হ": "h", "ড়": "r", "ঢ়": "r", "য়": "y", "ৎ": "t", "ং": "ng",
    "অ": "o", "আ": "a", "ই": "i", "ঈ": "i", "উ": "u", "ঊ": "u", "ঋ": "ri", "এ": "e", "ঐ": "oi", "ও": "o", "ঔ": "ou",
    "া": "a", "ি": "i", "ী": "i", "ু": "u", "ূ": "u", "ৃ": "ri", "ে": "e", "ৈ": "oi", "ো": "o", "ৌ": "ou",
    "ঃ": "", "ঁ": "",
  };
  const IS_CONSONANT = /[\u0995-\u09B9\u09DC-\u09DF]/;
  const SOUNDS_INHERENT = /[\u0985-\u0994\u0995-\u09B9\u09DC-\u09DF]/; // before a consonant or a full vowel
  function romanize(word) {
    let out = "";
    let seenConsonant = false;
    for (let i = 0; i < word.length; i++) {
      const ch = word[i];
      if (ch === "ক" && word[i + 1] === HASANTA && word[i + 2] === "ষ") { out += "X"; i += 2; seenConsonant = true; continue; }
      if (ch === "জ" && word[i + 1] === HASANTA && word[i + 2] === "ঞ") { out += "Q"; i += 2; seenConsonant = true; continue; }
      if (ch === HASANTA) {
        const next = word[i + 1], before = word[i - 1];
        // য-ফলা and a silent ব-ফলা are heard as a doubled consonant, except on
        // the first consonant of a word (ব্যবহার, স্বাধীন) where they are not heard.
        if ((next === "য" && before !== "র") || (next === "ব" && SILENT_BA_AFTER.includes(before))) {
          if (out && !/^[^\u0995-\u09B9\u09DC-\u09DF]*[\u0995-\u09B9\u09DC-\u09DF]$/.test(word.slice(0, i))) out += out[out.length - 1];
          i++;
        }
        continue;
      }
      if (ch === "\u09DF" && i === word.length - 1) { out += "Y"; continue; } // a final য় is always typed
      out += ROMAN[ch] || "";
      // an inherent vowel is usually sounded between two unjoined consonants
      if (IS_CONSONANT.test(ch) && SOUNDS_INHERENT.test(word[i + 1] || "")) out += "o";
    }
    return out;
  }
  function plainLatin(latin) {
    return String(latin).toLowerCase().replace(/[^a-z]/g, "")
      .replace(/chh/g, "ch").replace(/c(?!h)/g, "ch").replace(/ph/g, "f").replace(/bh/g, "v").replace(/z/g, "j")
      .replace(/aa/g, "a").replace(/ee|ii/g, "i").replace(/oo|uu/g, "u").replace(/ksh|kkh/g, "X").replace(/gy|gg/g, "Q")
      .replace(/q/g, "k").replace(/x/g, "ks").replace(/sh/g, "s")
      .replace(/yo?$/, "Y")
      // consonant + y / w: nothing on a word's first consonant, a doubling later
      .replace(/^([^aeiouyw]+)[yw](?=[aeiou])/, "$1")
      .replace(/([^aeiouywY])[yw](?=[aeiou]|$)/g, "$1$1");
  }
  // Edit distance where the letters people leave out or add freely are cheap:
  // the inherent vowel, h, y / w, and doubling a letter.
  const CHEAP = { o: 0.2, h: 0.5, y: 0.4, w: 0.4 };
  const REPEAT = 0.3;
  const gapCost = (s, i) => {
    const c = s[i];
    if (i > 0 && c === s[i - 1]) return REPEAT;
    if (c === "o" && (s[i + 1] === "i" || s[i + 1] === "u")) return 1; // oi / ou are real vowels
    return CHEAP[c] || 1;
  };
  function soundDistance(a, b) {
    const n = a.length, m = b.length;
    let prev = new Array(m + 1);
    let cur = new Array(m + 1);
    prev[0] = 0;
    for (let j = 1; j <= m; j++) prev[j] = prev[j - 1] + gapCost(b, j - 1);
    for (let i = 1; i <= n; i++) {
      const ca = a[i - 1];
      const costA = gapCost(a, i - 1);
      cur[0] = prev[0] + costA;
      for (let j = 1; j <= m; j++) {
        const sub = prev[j - 1] + (ca === b[j - 1] ? 0 : 1);
        const del = prev[j] + costA;
        const ins = cur[j - 1] + gapCost(b, j - 1);
        cur[j] = sub < del ? (sub < ins ? sub : ins) : (del < ins ? del : ins);
      }
      const t = prev; prev = cur; cur = t;
    }
    return prev[m];
  }

  // The lexicon is one big string of lines "key<TAB>word word …", sorted by
  // key, with an index of line starts. This keeps memory small (no per-word
  // objects) and lookups are a binary search.
  let lexText = "";
  let lexStarts = null;
  function setLexicon(text) {
    lexText = typeof text === "string" ? text : "";
    lexStarts = null;
  }
  function lexIndex() {
    if (lexStarts) return lexStarts;
    const starts = [];
    if (lexText) {
      starts.push(0);
      for (let i = lexText.indexOf("\n"); i !== -1 && i + 1 < lexText.length; i = lexText.indexOf("\n", i + 1)) starts.push(i + 1);
    }
    lexStarts = new Int32Array(starts);
    return lexStarts;
  }
  const lexKeyAt = (starts, n) => lexText.slice(starts[n], lexText.indexOf("\t", starts[n]));
  function lexWordsAt(starts, n) {
    const from = lexText.indexOf("\t", starts[n]) + 1;
    let to = n + 1 < starts.length ? starts[n + 1] - 1 : lexText.length;
    if (lexText[to - 1] === "\n") to--;
    return lexText.slice(from, to).split(" ");
  }
  function lexLowerBound(starts, key) {
    let lo = 0, hi = starts.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (lexKeyAt(starts, mid) < key) lo = mid + 1; else hi = mid;
    }
    return lo;
  }

  // Words that sound like `latin`, best first: [{ word, score }].
  function soundMatches(latin) {
    if (!lexText) return [];
    const key = latinKey(latin);
    if (!key) return [];
    const starts = lexIndex();
    const at = lexLowerBound(starts, key);
    if (at >= starts.length || lexKeyAt(starts, at) !== key) return [];
    const typed = plainLatin(latin);
    const exact = phonetic(latin);
    // `distance` is how far the typing is from the word; the small bonuses only
    // settle near-ties and can never outweigh a real difference.
    const scored = lexWordsAt(starts, at).map((word) => {
      const distance = soundDistance(typed, romanize(word));
      let score = distance;
      if (word === exact) score -= 0.05; // typed precisely, Avro-style
      if (dictValues.has(word)) score -= 0.15; // an everyday word
      return { word, score, distance };
    });
    scored.sort((a, b) => a.score - b.score || a.word.length - b.word.length);
    return scored;
  }

  // Longer words that start the way `latin` sounds.
  function soundCompletions(latin, limit) {
    if (!lexText) return [];
    const key = latinKey(latin);
    if (key.length < 2) return [];
    const starts = lexIndex();
    const found = [];
    for (let n = lexLowerBound(starts, key), seen = 0; n < starts.length && seen < 250; n++, seen++) {
      const k = lexKeyAt(starts, n);
      if (!k.startsWith(key)) break;
      if (k.length === key.length) continue;
      for (const word of lexWordsAt(starts, n)) found.push({ word, extra: k.length - key.length, common: dictValues.has(word) ? 0 : 1 });
    }
    found.sort((a, b) => a.common - b.common || a.extra - b.extra || a.word.length - b.word.length);
    return found.slice(0, limit).map((f) => f.word);
  }

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
  const ENDS_VOWEL = /[অ-ঔা-ৌ]$/;
  const ENDS_CONS = /[ক-হড়-য়]$/;

  // stemOf(stem) returns the Bangla for a Latin stem, or a falsy value.
  function withSuffix(key, stemOf, minStem) {
    for (const suf of SUFFIXES) {
      if (!key.endsWith(suf.s)) continue;
      const stem = key.slice(0, -suf.s.length);
      if (stem.length < (minStem || 4)) continue;
      const bn = stemOf(stem);
      if (!bn || bn.includes(" ")) continue;
      if (suf.after === "vowel" && !ENDS_VOWEL.test(bn)) continue;
      if (suf.after === "cons" && !ENDS_CONS.test(bn)) continue;
      return bn + suf.bn;
    }
    return null;
  }

  // Everyday chat spelling writes ছ as "s": korsi, bolse, kortesi, ase.
  // Returns the careful spelling (korchi, bolche, kortechi, ache) or "".
  const CHAT_ENDING = /^([a-z]*[a-rt-z])s(i|e|o|en|is|ilo|ilam|ile|ilen)$/;
  function chatVariant(key) {
    const m = CHAT_ENDING.exec(key);
    return m && m[1].length >= 1 ? m[1] + "ch" + m[2] : "";
  }
  const CHAT_CONTINUOUS = /tes(i|e|o|en|is|ilo|ilam|ile|ilen)$/; // kortesi, jaitese

  // Spellings a typist may have meant by the same keys: ত/ট, দ/ড, স/শ, ি/ী.
  // Used only to offer extra choices for names and unknown words.
  function letterVariants(latin) {
    const out = [];
    const swap = (re, to) => { if (re.test(latin)) out.push(latin.replace(re, to)); };
    swap(/s(?!h)/, "sh");
    swap(/sh/, "s");
    swap(/t(?!h)/, "T");
    swap(/d(?!h)/, "D");
    swap(/i$/, "I");
    swap(/n(?=[aeiou]|$)(?!.*n)/, "N");
    return out;
  }

  // A sound match becomes the default only if it differs from the typing by
  // less than one real letter (dropped vowels, doubling, y / w).
  const SOUND_LIMIT = 0.9;

  // Returns { text, source }: custom | learned | dict | stem | sound | rule.
  function resolve(latin) {
    const key = latin.toLowerCase();
    if (customDict[key]) return { text: customDict[key], source: "custom" };
    if (learned[key]) return { text: learned[key], source: "learned" };
    if (options.autoCorrect) {
      if (dictionary[key]) return { text: dictionary[key], source: "dict" };
      const stemmed = withSuffix(key, (stem) => customDict[stem] || dictionary[stem]);
      if (stemmed) return { text: stemmed, source: "stem" };
      const chat = chatVariant(key);
      if (chat && dictionary[chat]) return { text: dictionary[chat], source: "dict" };
      // Very short typing matches too many words by sound to guess safely.
      if (key.length >= 3) {
        const matches = soundMatches(latin);
        if (matches.length && matches[0].distance <= SOUND_LIMIT) return { text: matches[0].word, source: "sound" };
        // an unknown word may still be a known one with an ending: lokera, bondhur
        const built = withSuffix(key, (stem) => {
          const m = soundMatches(stem);
          return m.length && m[0].distance <= 0.5 ? m[0].word : null;
        }, 3);
        if (built) return { text: built, source: "stem" };
        if (chat) {
          // nothing is spelled this way with স; try it as ছ (bolsilo → বলছিল)
          const m = soundMatches(chat);
          if (m.length && m[0].distance <= 0.5) return { text: m[0].word, source: "sound" };
          if (CHAT_CONTINUOUS.test(key)) return { text: phonetic(chat), source: "rule" };
        }
      }
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

  // Candidates for the suggestion window, best first:
  //   1. the conversion Space would produce
  //   2. other real words that sound like what was typed
  //   3. the letter-by-letter spelling and its variants (ঋ-kar, ো, unjoined)
  //   4. longer words that start this way
  //   5. the typing itself, so an English word can be kept
  function suggest(latin, max) {
    max = max || 9;
    if (!latin || !HAS_LETTER_RE.test(latin)) return [];
    const key = latin.toLowerCase();
    const out = [];
    const add = (s) => { if (s && !out.includes(s)) out.push(s); };

    const primary = resolve(latin);
    add(primary.text);
    if (customDict[key]) add(customDict[key]);
    if (dictionary[key]) add(dictionary[key]);
    // the careful spelling of a chat-style ending: ase → আছে next to আসে
    const chat = options.autoCorrect ? chatVariant(key) : "";
    if (chat) add(customDict[chat] || dictionary[chat] || (key.length >= 4 ? phonetic(chat) : ""));

    const sounds = soundMatches(latin);
    for (let i = 0; i < sounds.length && i < 4; i++) { if (sounds[i].distance <= 0.5) add(sounds[i].word); }
    add(phonetic(latin));

    const room = Math.max(2, max - 1 - out.length - 1);
    const completions = [];
    const push = (s) => { if (s && !out.includes(s) && !completions.includes(s)) completions.push(s); };
    for (const k of prefixHits(customKeys, key, room)) push(customDict[k]);
    for (const k of prefixHits(dictKeys, key, room)) push(dictionary[k]);
    for (const w of soundCompletions(latin, room)) push(w);
    const variants = [phonetic(latin, { riKar: true }), phonetic(latin, { finalO: true })]
      .concat(letterVariants(latin).map((v) => phonetic(v)), [phonetic(latin, { loose: true })])
      .filter((v, i, all) => !out.includes(v) && all.indexOf(v) === i);

    // Words the dictionary does not know (names, mostly) keep room for other
    // spellings; known words keep one.
    const known = primary.source !== "rule";
    const keepVariant = Math.min(variants.length, known ? 1 : 4);
    for (const c of completions) { if (out.length >= max - 1 - keepVariant) break; add(c); }
    for (const v of variants) { if (out.length >= max - 1) break; add(v); }
    for (const c of completions) { if (out.length >= max - 1) break; add(c); }

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
    setLexicon,
    setOptions,
    latinKey,
    banglaKey,
    isWordChar: (ch) => WORD_CHAR_RE.test(ch),
    hasLetter: (s) => HAS_LETTER_RE.test(s),
    WORD_CHARS,
  };

  root.SEBanglishEngine = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
