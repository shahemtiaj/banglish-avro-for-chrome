// Run with: node --test tests/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

await import("../extension/lib/engine.js");
const E = globalThis.SEBanglishEngine;
const dict = JSON.parse(readFileSync(new URL("../extension/dictionary/core.json", import.meta.url), "utf8"));

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
  assert.ok(s.length <= 8);
  assert.equal(new Set(s).size, s.length, "no duplicates");
  assert.ok(E.suggest("srishtishil").includes("সৃস্তিশিল"), "ri-kar variant for unknown words");
  assert.deepEqual(E.suggest("123"), []);
});

test("stays fast", () => {
  E.setDictionary(dict);
  const words = ["ami", "bangladesh", "bishwabidyaloy", "shadhinota", "k", "pro", "muktijuddho"];
  const t0 = performance.now();
  for (let i = 0; i < 2000; i++) E.suggest(words[i % words.length]);
  const perCall = (performance.now() - t0) / 2000;
  assert.ok(perCall < 2, `suggest() took ${perCall.toFixed(3)} ms`);
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
