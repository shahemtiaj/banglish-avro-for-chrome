import dictJson from "./bn-dictionary.json";

const dictionary = dictJson as Record<string, string>;

const CONSONANTS: Record<string, string> = {
  kh: "খ", gh: "ঘ", Ng: "ঙ", ch: "চ", jh: "ঝ", NG: "ঞ",
  Th: "ঠ", Dh: "ঢ", th: "থ", dh: "ধ", ph: "ফ", bh: "ভ",
  sh: "শ", Sh: "ষ", ss: "স", Rh: "ঢ়",
  k: "ক", g: "গ", c: "চ", j: "জ", T: "ট", D: "ড", N: "ণ",
  t: "ত", d: "দ", n: "ন", p: "প", f: "ফ", b: "ব", v: "ভ", m: "ম",
  z: "জ", y: "য়", l: "ল", s: "স", h: "হ",
  R: "ড়", Y: "য়", w: "ওয়", ng: "ং",
};

const CLUSTERS: Record<string, string> = {
  kkh: "ক্ষ", ksh: "ক্ষ", kSh: "ক্ষ",
  jNG: "জ্ঞ", gg: "জ্ঞ", gy: "জ্ঞ",
  hm: "হ্ম", hn: "হ্ন", hN: "হ্ণ",
  ttw: "ত্ত্ব", ttv: "ত্ত্ব",
  shch: "শ্চ", nch: "ঞ্চ", nj: "ঞ্জ", nD: "ণ্ড",
  shT: "ষ্ট", shTh: "ষ্ঠ", sht: "স্ত", shth: "স্থ", shn: "ষ্ণ",
  ngg: "ঙ্গ", ngk: "ঙ্ক", ngkh: "ঙ্খ",
};

type Vowel = { ind: string; kar: string };
const VOWELS: Record<string, Vowel> = {
  rri: { ind: "ঋ", kar: "ৃ" },
  OI: { ind: "ঐ", kar: "ৈ" }, oi: { ind: "ঐ", kar: "ৈ" },
  OU: { ind: "ঔ", kar: "ৌ" }, ou: { ind: "ঔ", kar: "ৌ" },
  aa: { ind: "আ", kar: "া" }, A: { ind: "আ", kar: "া" }, a: { ind: "আ", kar: "া" },
  I: { ind: "ঈ", kar: "ী" }, ii: { ind: "ঈ", kar: "ী" }, i: { ind: "ই", kar: "ি" },
  U: { ind: "ঊ", kar: "ূ" }, uu: { ind: "ঊ", kar: "ূ" }, u: { ind: "উ", kar: "ু" },
  E: { ind: "এ", kar: "ে" }, e: { ind: "এ", kar: "ে" },
  O: { ind: "ও", kar: "ো" }, o: { ind: "অ", kar: "" },
};
const SYMBOLS: Record<string, string> = { "^": "ঁ", ":": "ঃ" };
const TOKENS = [
  ...Object.keys(VOWELS),
  ...Object.keys(CONSONANTS),
  ...Object.keys(CLUSTERS),
  ...Object.keys(SYMBOLS),
  "rr",
  "r",
].sort((a, b) => b.length - a.length);

export function transliterate(latin: string): string {
  if (!latin) return "";
  const key = latin.toLowerCase();
  if (dictionary[key]) return dictionary[key];
  let i = 0;
  let out = "";
  let prev: "start" | "consonant" | "vowel" | "ref" | "other" = "start";
  while (i < latin.length) {
    let m: string | null = null;
    for (const t of TOKENS) if (latin.startsWith(t, i)) { m = t; break; }
    if (!m) { out += latin[i++]; prev = "other"; continue; }
    i += m.length;
    if (CLUSTERS[m]) {
      const g = CLUSTERS[m];
      out += prev === "consonant" ? "্" + g : g;
      prev = "consonant";
      continue;
    }
    if (m === "rr") { out += "র্"; prev = "ref"; continue; }
    if (m === "r") { out += prev === "consonant" ? "্র" : "র"; prev = "consonant"; continue; }
    if (VOWELS[m]) {
      const v = VOWELS[m];
      out += prev === "consonant" || prev === "ref" ? v.kar : v.ind;
      prev = "vowel";
      continue;
    }
    if (CONSONANTS[m]) {
      const c = CONSONANTS[m];
      if (m === "ng") { out += c; prev = "vowel"; continue; }
      out += prev === "consonant" ? "্" + c : c;
      prev = "consonant";
      continue;
    }
    if (SYMBOLS[m]) { out += SYMBOLS[m]; continue; }
  }
  return out;
}

export function suggest(latin: string): string[] {
  const key = latin.toLowerCase();
  const results: string[] = [transliterate(latin)];
  for (const k in dictionary) {
    if (k.startsWith(key) && k !== key) {
      const v = dictionary[k];
      if (!results.includes(v)) results.push(v);
      if (results.length >= 6) break;
    }
  }
  return results;
}