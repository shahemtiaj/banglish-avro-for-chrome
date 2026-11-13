// Packs extension/ into public/se-banglish-avro.zip and keeps the landing-page
// dictionary in sync. Pure Node — no zip binary, works on Windows, macOS, Linux.
//
//   node scripts/build-extension.mjs
import { copyFileSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateRawSync } from "node:zlib";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const srcDir = join(root, "extension");
const outFile = join(root, "public", "se-banglish-avro.zip");
const SKIP = /(\.d\.ts|\.map|\.DS_Store)$/;

const CRC_TABLE = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function walk(dir) {
  return readdirSync(dir)
    .sort()
    .flatMap((name) => {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) return walk(full);
      return SKIP.test(name) ? [] : [full];
    });
}

// Sanity checks before packing: a broken manifest should fail the build.
const manifest = JSON.parse(readFileSync(join(srcDir, "manifest.json"), "utf8"));
const dictionary = JSON.parse(readFileSync(join(srcDir, "dictionary", "core.json"), "utf8"));
const referenced = [
  manifest.background.service_worker,
  manifest.action.default_popup,
  manifest.options_ui.page,
  ...manifest.content_scripts.flatMap((c) => c.js),
  ...Object.values(manifest.icons),
];
for (const file of referenced) statSync(join(srcDir, file));
// The sound-matched word list is optional but must come with its licence.
let lexiconWords = 0;
try {
  const lexicon = readFileSync(join(srcDir, "dictionary", "lexicon.txt"), "utf8");
  statSync(join(srcDir, "dictionary", "LEXICON-LICENSE.txt"));
  lexiconWords = lexicon.split("\n").reduce((n, line) => n + (line ? line.split("\t")[1].split(" ").length : 0), 0);
} catch (err) {
  if (err.code !== "ENOENT") throw err;
  console.warn("note: no dictionary/lexicon.txt — run scripts/build-lexicon.mjs for sound-matched suggestions");
}

// Fixed timestamp → identical input always produces an identical zip.
const DOS_TIME = 0;
const DOS_DATE = ((2024 - 1980) << 9) | (1 << 5) | 1;

const locals = [];
const centrals = [];
let offset = 0;
const files = walk(srcDir);
for (const full of files) {
  const name = Buffer.from(relative(srcDir, full).split(sep).join("/"), "utf8");
  const data = readFileSync(full);
  const packed = deflateRawSync(data, { level: 9 });
  const useDeflate = packed.length < data.length;
  const body = useDeflate ? packed : data;
  const crc = crc32(data);

  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt16LE(0x0800, 6); // UTF-8 names
  local.writeUInt16LE(useDeflate ? 8 : 0, 8);
  local.writeUInt16LE(DOS_TIME, 10);
  local.writeUInt16LE(DOS_DATE, 12);
  local.writeUInt32LE(crc, 14);
  local.writeUInt32LE(body.length, 18);
  local.writeUInt32LE(data.length, 22);
  local.writeUInt16LE(name.length, 26);
  locals.push(local, name, body);

  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(20, 4);
  central.writeUInt16LE(20, 6);
  central.writeUInt16LE(0x0800, 8);
  central.writeUInt16LE(useDeflate ? 8 : 0, 10);
  central.writeUInt16LE(DOS_TIME, 12);
  central.writeUInt16LE(DOS_DATE, 14);
  central.writeUInt32LE(crc, 16);
  central.writeUInt32LE(body.length, 20);
  central.writeUInt32LE(data.length, 24);
  central.writeUInt16LE(name.length, 28);
  central.writeUInt32LE(offset, 42);
  centrals.push(central, name);

  offset += local.length + name.length + body.length;
}

const centralSize = centrals.reduce((n, b) => n + b.length, 0);
const end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0);
end.writeUInt16LE(files.length, 8);
end.writeUInt16LE(files.length, 10);
end.writeUInt32LE(centralSize, 12);
end.writeUInt32LE(offset, 16);

const zip = Buffer.concat([...locals, ...centrals, end]);
writeFileSync(outFile, zip);
copyFileSync(join(srcDir, "dictionary", "core.json"), join(root, "src", "lib", "bn-dictionary.json"));

console.log(
  `v${manifest.version}: ${files.length} files, ${Object.keys(dictionary).length} dictionary spellings, ${lexiconWords} lexicon words → ` +
    `${relative(root, outFile)} (${(zip.length / 1024).toFixed(0)} KB)`,
);
