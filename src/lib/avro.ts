import dictJson from "./bn-dictionary.json";

const dictionary = dictJson as Record<string, string>;

const CONSONANTS: Record<string, string> = {
  kh: "খ", gh: "ঘ", Ng: "ঙ", chh: "ছ", ch: "ছ", jh: "ঝ", NG: "ঞ",
  Th: "ঠ", Dh: "ঢ", th: "থ", dh: "ধ", ph: "ফ", bh: "ভ",
  sh: "শ", Sh: "ষ", ss: "স", Rh: "ঢ়",
  k: "ক", g: "গ", c: "চ", j: "জ", T: "ট", D: "ড", N: "ণ",
  t: "ত", d: "দ", n: "ন", p: "প", f: "ফ", b: "ব", v: "ভ", m: "ম",
  z: "য", y: "য়", l: "ল", s: "স", h: "হ",
  R: "ড়", Y: "য়", w: "ওয়", ng: "ং",
};

const CLUSTERS: Record<string, string> = {
  // ক্ষ family
  kkh: "ক্ষ", ksh: "ক্ষ", kSh: "ক্ষ", kx: "ক্ষ",
  // জ্ঞ family
  jNG: "জ্ঞ", gg: "জ্ঞ", gy: "জ্ঞ", jny: "জ্ঞ",
  // হ্ম / হ্ন / হ্ণ / হ্ল / হ্ব
  hm: "হ্ম", hn: "হ্ন", hN: "হ্ণ", hl: "হ্ল", hb: "হ্ব", hw: "হ্ব", hy: "হ্য", hr: "হ্র",
  // ত্ত্ব / ত্ম / ত্ন / ত্র / ত্য
  ttw: "ত্ত্ব", ttv: "ত্ত্ব", tm: "ত্ম", tn: "ত্ন", ty: "ত্য", tr: "ত্র",
  // শ্চ / শ্ছ / ঞ্চ / ঞ্জ / ঞ্ছ
  shc: "শ্চ", shch: "শ্ছ", nc: "ঞ্চ", nj: "ঞ্জ", nch: "ঞ্ছ", nchh: "ঞ্ছ",
  // ণ conjuncts
  ND: "ণ্ড", NT: "ণ্ট", NTh: "ণ্ঠ", NDh: "ণ্ঢ", Nn: "ণ্ন", Nm: "ণ্ম",
  // ষ conjuncts
  ShT: "ষ্ট", ShTh: "ষ্ঠ", ShN: "ষ্ণ", Shp: "ষ্প", Shk: "ষ্ক", Shm: "ষ্ম", Shl: "ষ্ল",
  // ষ্ট / ষ্ঠ also via lowercase-sh convention (common Avro typing)
  shT: "ষ্ট", shTh: "ষ্ঠ", shN: "ষ্ণ",
  // স conjuncts
  st: "স্ত", sth: "স্থ", sn: "স্ন", sp: "স্প", sk: "স্ক", sf: "স্ফ", sm: "স্ম", sl: "স্ল", sr: "স্র", sw: "স্ব",
  // sht/shth/shn keep as স variants (common Banglish typing)
  sht: "স্ত", shth: "স্থ", shn: "স্ন",
  // ঙ conjuncts
  ngg: "ঙ্গ", ngk: "ঙ্ক", ngkh: "ঙ্খ", nggh: "ঙ্ঘ",
  // ন্ত / ন্দ / ন্ধ / ন্ন / ন্ব / ন্ম
  nt: "ন্ত", nd: "ন্দ", ndh: "ন্ধ", nn: "ন্ন", nb: "ন্ব", nm: "ন্ম", ntr: "ন্ত্র", ndr: "ন্দ্র",
  // প্ন / প্ল / প্র / প্স / প্ত
  pn: "প্ন", pl: "প্ল", ps: "প্স", pt: "প্ত",
  // ম্ন / ম্প / ম্ব / ম্ভ / ম্র
  mn: "ম্ন", mp: "ম্প", mb: "ম্ব", mbh: "ম্ভ", mr: "ম্র", ml: "ম্ল",
  // ল্প / ল্ক / ল্ট / ল্ড / ল্ম
  lp: "ল্প", lk: "ল্ক", lT: "ল্ট", lD: "ল্ড", lm: "ল্ম", lb: "ল্ব",
  // দ্ধ / দ্ব / দ্র / দ্য / দ্ম
  ddh: "দ্ধ", db: "দ্ব", dv: "দ্ব", dr: "দ্র", dy: "দ্য", dm: "দ্ম",
  // ধ্ব / ধ্র / ধ্য
  dhb: "ধ্ব", dhr: "ধ্র", dhy: "ধ্য",
  // ব্ধ / ব্র / ব্য / ব্ল
  bdh: "ব্ধ", br: "ব্র", by: "ব্য", bl: "ব্ল",
  // চ্চ / চ্ছ
  cc: "চ্চ", cch: "চ্ছ", cchh: "চ্ছ",
  // জ্জ / জ্ঝ / জ্য / জ্র
  jj: "জ্জ", jjh: "জ্ঝ", jy: "জ্য", jr: "জ্র",
  // ট্ট / ট্র / ঠ্য
  TT: "ট্ট", Tr: "ট্র",
  // ড্ড / ড্র / ঢ্র
  DD: "ড্ড", Dr: "ড্র",
  // ক্ক / ক্ট / ক্ত / ক্র / ক্ল / ক্ব / ক্ম / ক্য
  kk: "ক্ক", kT: "ক্ট", kt: "ক্ত", kr: "ক্র", kl: "ক্ল", kb: "ক্ব", km: "ক্ম", ky: "ক্য",
  // গ্ধ / গ্ন / গ্ম / গ্র / গ্ল / গ্ব
  gdh: "গ্ধ", gn: "গ্ন", gm: "গ্ম", gr: "গ্র", gl: "গ্ল", gb: "গ্ব",
  // ঘ্ন / ঘ্র
  ghn: "ঘ্ন", ghr: "ঘ্র",
  // shr / shl / shb / shm / shy
  shr: "শ্র", shb: "শ্ব", shy: "শ্য",
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
const PUNCT_MAP: Record<string, string> = { ".": "।" };
// Letters that are case-insensitive (uppercase should behave like lowercase).
// We DO NOT normalize A,I,U,E,O,T,D,N,R,S,Y — those uppercase forms carry meaning.
const CASE_INSENSITIVE = /[JCKGBPMLHFVWZ]/g;
function normalizeCase(s: string): string {
  return s.replace(CASE_INSENSITIVE, (c) => c.toLowerCase());
}
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
  latin = normalizeCase(latin);
  let i = 0;
  let out = "";
  let prev: "start" | "consonant" | "vowel" | "ref" | "other" = "start";
  while (i < latin.length) {
    let m: string | null = null;
    for (const t of TOKENS) if (latin.startsWith(t, i)) { m = t; break; }
    if (!m) {
      const ch = latin[i++];
      out += PUNCT_MAP[ch] ?? ch;
      prev = "other";
      continue;
    }
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