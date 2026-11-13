// Run with: node --test tests/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

await import("../extension/lib/engine.js");
const E = globalThis.SEBanglishEngine;
const dict = JSON.parse(readFileSync(new URL("../extension/dictionary/core.json", import.meta.url), "utf8"));
const lexicon = readFileSync(new URL("../extension/dictionary/lexicon.txt", import.meta.url), "utf8");

const rules = (pairs, opts) => {
  for (const [latin, bangla] of Object.entries(pairs)) {
    assert.equal(E.phonetic(latin, opts), bangla, `${latin} → ${bangla}`);
  }
};

test("basic letters, kar and independent vowels", () => {
  rules({
    ami: "আমি", tumi: "তুমি", kemon: "কেমন", achen: "আছেন", desh: "দেশ",
    onek: "অনেক", ei: "এই", uttor: "উত্তর", oitihasik: "ঐতিহাসিক", meye: "মেয়ে", hoy: "হয়",
  });
});

test("only real conjuncts are joined", () => {
  rules({
    rajshahi: "রাজশাহি", // জ + শ is not a conjunct
    bybohar: "ব্যবহার",
    shikkha: "শিক্ষা", lokkhmi: "লক্ষ্মি", gyan: "জ্ঞান", biggan: "বিজ্ঞান",
    shanti: "শান্তি", bondhu: "বন্ধু", grontho: "গ্রন্থ", onchol: "অঞ্চল", nishchoy: "নিশ্চয়",
    tottwo: "তত্ত্ব", shonkho: "শঙ্খ",
  });
});

test("ra-phala, ya-phala, ba-phala and reph", () => {
  rules({
    rastro: "রাস্ত্র", stri: "স্ত্রি", proshno: "প্রস্ন",
    bidyut: "বিদ্যুত", dwitiyo: "দ্বিতিয়", bishwo: "বিশ্ব",
    kormo: "কর্ম", dhorrmo: "ধর্ম",
  });
});

test("vowel sequences", () => {
  rules({ jao: "জাও", khaoa: "খাওয়া", dia: "দিয়া", boi: "বই", koi: "কই", boishakh: "বৈশাখ" });
});

test("anusvar, visarga, chandrabindu, khanda-ta, separator", () => {
  rules({
    bangla: "বাংলা", bangali: "বাঙালি", rongin: "রঙিন", singho: "সিংহ",
    "du:kho": "দুঃখ", "note:": "নতে:", "ca^d": "চাঁদ", "ut``sob": "উৎসব", "ek`ta": "একতা",
  });
});

test("capital letters only matter where Avro gives them meaning", () => {
  rules({ Rahim: "রাহিম", Nahid: "নাহিদ", Dhaka: "ঢাকা", Taka: "টাকা", SoSTho: "শশঠ", KALAM: "কালাম" });
  rules({ miNGa: "মিঞা", oNgo: "অঙ" }); // NG and Ng keep their case
});

test("variants used by the candidate window", () => {
  rules({ prithibi: "পৃথিবি", brishti: "বৃস্তি" }, { riKar: true });
  rules({ korbo: "করব", amra: "আম্রা" }, { loose: true });
  rules({ korbo: "কর্বো" }, { finalO: true });
});

test("dictionary, custom words, learned picks and suffixes", () => {
  E.setDictionary(dict);
  E.setCustomDictionary({});
  E.setLearned({});
  E.setOptions({ autoCorrect: true });
  assert.equal(E.transliterate("prithibi"), "পৃথিবী");
  assert.equal(E.transliterate("Prithibi"), "পৃথিবী");
  assert.equal(E.transliterate("je"), "যে");
  assert.equal(E.transliterate("jonno"), "জন্য");
  assert.equal(E.transliterate("korbo"), "করব");
  assert.equal(E.transliterate("prithibite"), "পৃথিবীতে");
  assert.equal(E.transliterate("manushke"), "মানুষকে");
  assert.equal(E.transliterate("desher"), "দেশের");
  assert.equal(E.transliterate("2024"), "2024");

  E.setCustomDictionary({ Rakib: "রাকিব" });
  assert.equal(E.transliterate("rakib"), "রাকিব");
  E.setLearned({ hello: "hello" });
  assert.equal(E.transliterate("hello"), "hello");
  E.setLearned({});

  E.setOptions({ autoCorrect: false });
  assert.equal(E.transliterate("prithibi"), "প্রিথিবি");
  assert.equal(E.transliterate("rakib"), "রাকিব", "custom words still apply");
  E.setOptions({ autoCorrect: true });
});

test("suggestions", () => {
  E.setDictionary(dict);
  const s = E.suggest("bangla");
  assert.equal(s[0], "বাংলা");
  assert.ok(s.includes("বাংলাদেশ"), "prefix completion");
  assert.equal(s[s.length - 1], "bangla", "Latin original is the last candidate");
  assert.ok(s.length <= 9);
  assert.equal(new Set(s).size, s.length, "no duplicates");
  assert.ok(E.suggest("srishtipur").includes("সৃস্তিপুর"), "ri-kar variant for unknown words");
  assert.deepEqual(E.suggest("123"), []);
});

test("sound keys merge the spellings people mix up", () => {
  const same = (a, b) => assert.equal(E.latinKey(a), E.latinKey(b), `${a} ~ ${b}`);
  same("shundor", "sundor");
  same("bhalo", "valo");
  same("bidda", "bidya");
  same("bishwo", "bisso");
  same("achhe", "ache");
  same("juddho", "judho");
  same("songit", "shonggit");
  assert.notEqual(E.latinKey("boshe"), E.latinKey("oboshe"), "a leading o is never dropped");
  assert.equal(E.latinKey("abc123"), "", "not a plain word");
  for (const [latin, bangla] of Object.entries({
    sundor: "সুন্দর", bidya: "বিদ্যা", bishwo: "বিশ্ব", shikkha: "শিক্ষা", biggan: "বিজ্ঞান", songit: "সঙ্গীত",
    surjo: "সূর্য", prithibi: "পৃথিবী", onek: "অনেক", dukkho: "দুঃখ", bangla: "বাংলা",
  })) {
    assert.equal(E.latinKey(latin), E.banglaKey(bangla), `${latin} ~ ${bangla}`);
  }
});

test("word list: correct spelling for words outside the hand dictionary", () => {
  E.setDictionary(dict);
  E.setCustomDictionary({});
  E.setLearned({});
  E.setOptions({ autoCorrect: true });
  E.setLexicon(lexicon);
  const expect = {
    surjasto: "সূর্যাস্ত", orthonoitik: "অর্থনৈতিক", protijogitay: "প্রতিযোগিতায়", prodhanmontri: "প্রধানমন্ত্রী",
    shikkharthira: "শিক্ষার্থীরা", lokera: "লোকেরা", ucchash: "উচ্ছ্বাস", bidda: "বিদ্যা", bisso: "বিশ্ব",
    proyojoniyo: "প্রয়োজনীয়", songbidhan: "সংবিধান", abritti: "আবৃত্তি", biddut: "বিদ্যুৎ",
  };
  for (const [latin, bangla] of Object.entries(expect)) assert.equal(E.transliterate(latin), bangla, latin);
  // not a real word: the plain phonetic spelling stands
  assert.equal(E.transliterate("shikkh"), "শিক্ষ");
  assert.equal(E.transliterate("rakibul"), E.phonetic("rakibul"));
  // suggestions include real words that start this way
  assert.ok(E.suggest("prokri").includes("প্রকৃতি"));
  assert.ok(E.suggest("shadhin").includes("স্বাধীনতা"));
  // switched off together with auto correction
  E.setOptions({ autoCorrect: false });
  assert.equal(E.transliterate("surjasto"), E.phonetic("surjasto"));
  E.setOptions({ autoCorrect: true });
  E.setLexicon("");
});

test("word list file is sorted and consistent with the engine", () => {
  const lines = lexicon.split("\n").filter(Boolean);
  assert.ok(lines.length > 50000);
  let prev = "";
  for (let i = 0; i < lines.length; i += 97) {
    const [key, words] = lines[i].split("\t");
    assert.ok(key > prev, `sorted at line ${i}`);
    prev = key;
    for (const w of words.split(" ")) assert.equal(E.banglaKey(w), key, w);
  }
});

test("chat-style spelling and shorthand", () => {
  E.setDictionary(dict);
  E.setLexicon(lexicon);
  E.setCustomDictionary({});
  E.setLearned({});
  E.setOptions({ autoCorrect: true });
  const want = {
    korsi: "করছি", bolse: "বলছে", dekhsi: "দেখছি", bolsilo: "বলছিল", korsilam: "করছিলাম",
    kortesi: "করতেছি", jaitesi: "যাইতেছি", gese: "গেছে", khaisi: "খাইছি", hoise: "হইছে",
    tmi: "তুমি", amr: "আমার", kmn: "কেমন", hbe: "হবে", jbo: "যাব", vlo: "ভালো", plz: "প্লিজ",
    // real words that happen to end the same way are left alone
    ase: "আসে", bose: "বসে", hasi: "হাসি", hese: "হেসে",
  };
  for (const [latin, bangla] of Object.entries(want)) assert.equal(E.transliterate(latin), bangla, latin);
  assert.equal(E.suggest("ase")[1], "আছে", "the ছ reading is the second choice");
  assert.equal(E.suggest("asi")[1], "আছি");
});

test("names get alternative spellings", () => {
  E.setDictionary(dict);
  E.setLexicon(lexicon);
  assert.ok(E.suggest("sakib").includes("শাকিব"));
  assert.ok(E.suggest("rashed").includes("রাসেদ"));
  const s = E.suggest("tasdid");
  assert.ok(s.length >= 4 && s.length <= 9, "unknown words still get several spellings");
  assert.equal(s[s.length - 1], "tasdid");
  assert.equal(new Set(s).size, s.length);
});

test("stays fast", () => {
  E.setDictionary(dict);
  E.setLexicon(lexicon);
  const words = ["ami", "bangladesh", "bishwabidyaloy", "shadhinota", "k", "pro", "muktijuddho"];
  const t0 = performance.now();
  for (let i = 0; i < 2000; i++) E.suggest(words[i % words.length]);
  const perCall = (performance.now() - t0) / 2000;
  assert.ok(perCall < 2, `suggest() took ${perCall.toFixed(3)} ms`);
  E.setLexicon("");
});

test("dictionary is well-formed", () => {
  const H = "্";
  for (const [k, v] of Object.entries(dict)) {
    assert.match(k, /^[a-z][a-z ]*$/, `key "${k}"`);
    assert.ok(!v.includes(H + H), `${k}: double hasanta`);
    assert.ok(!v.endsWith(H), `${k}: trailing hasanta`);
    assert.ok(!/[যডঢ]়/.test(v), `${k}: decomposed nukta letter`);
    assert.ok(!/্ও/.test(v), `${k}: ব-ফলা written as ও`);
    assert.ok(!/[ি-ৌ]আ/.test(v), `${k}: আ after a vowel sign`);
    assert.ok(!/^[া-্]/.test(v), `${k}: starts with a dependent sign`);
  }
});
