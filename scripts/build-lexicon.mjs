// Builds extension/dictionary/lexicon.txt from the open-source Avro word list.
//
//   git clone --depth 1 https://github.com/sarim/ibus-avro /tmp/ibus-avro
//   node scripts/build-lexicon.mjs /tmp/ibus-avro/avrodict.js
//
// The word list (avrodict.js) is (c) OmicronLab and licensed under the Mozilla
// Public License 2.0. The generated lexicon.txt is a modified form of that file
// and stays under the MPL 2.0 — see extension/dictionary/LEXICON-LICENSE.txt.
//
// Output: one line per sound key, "key<TAB>word word …", sorted by key.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = process.argv[2];
if (!source) {
  console.error("usage: node scripts/build-lexicon.mjs <path to ibus-avro/avrodict.js>");
  process.exit(1);
}

await import("../extension/lib/engine.js");
const E = globalThis.SEBanglishEngine;

// avrodict.js is `var tables = { "w_a": [ ... ], ... };` — read it as data,
// never run it.
const text = readFileSync(source, "utf8");
const tables = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1));

// Archaic (sadhu-bhasha) and dialect verb forms nobody types in chat; they
// only crowd the suggestions: …ইয়াছ…, …ইতেছ…, …ছিলুম, …ছিলেম
const ARCHAIC = /[ইি](য়া|তে)ছ|(ছিলুম|ছিলেম)$/;
const PLAIN = /^[ঀ-ৣৰৱ]+$/;
const precompose = (w) =>
  w.normalize("NFC").replace(/য়/g, "য়").replace(/ড়/g, "ড়").replace(/ঢ়/g, "ঢ়");

const byKey = new Map();
const add = (word) => {
  const key = E.banglaKey(word);
  if (!key || key.length < 2) return false;
  if (!byKey.has(key)) byKey.set(key, new Set());
  byKey.get(key).add(word);
  return true;
};

let total = 0;
for (const table of Object.values(tables)) {
  if (!Array.isArray(table)) continue;
  for (const raw of table) {
    if (typeof raw !== "string") continue;
    total++;
    const word = precompose(raw);
    if (word.length < 2 || word.length > 18 || !PLAIN.test(word) || ARCHAIC.test(word)) continue;
    add(word);
  }
}

// Everyday words from the hand-checked dictionary join the list too.
const core = JSON.parse(readFileSync(join(root, "extension", "dictionary", "core.json"), "utf8"));
for (const word of new Set(Object.values(core))) {
  if (PLAIN.test(word)) add(word);
}

const keys = [...byKey.keys()].sort();
const body = keys.map((k) => k + "\t" + [...byKey.get(k)].join(" ")).join("\n") + "\n";
writeFileSync(join(root, "extension", "dictionary", "lexicon.txt"), body);
const words = [...byKey.values()].reduce((n, s) => n + s.size, 0);
console.log(
  `${total} source words → ${words} kept under ${keys.length} sound keys → ${(Buffer.byteLength(body) / 1048576).toFixed(2)} MB`,
);
