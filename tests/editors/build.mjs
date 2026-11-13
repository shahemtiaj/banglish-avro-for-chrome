// Bundles one small test page per editor into dist/.
import { copyFileSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const here = dirname(fileURLToPath(import.meta.url));
const dist = join(here, "dist");
mkdirSync(dist, { recursive: true });

const entries = readdirSync(join(here, "src")).filter((f) => /\.jsx?$/.test(f));
await build({
  entryPoints: entries.map((f) => join(here, "src", f)),
  bundle: true,
  format: "esm",
  outdir: dist,
  logLevel: "error",
  define: { "process.env.NODE_ENV": '"development"', global: "window" },
  loader: { ".css": "empty", ".ttf": "empty" },
});

const STYLE =
  "body{font:16px sans-serif;padding:24px} p{margin:0} " +
  ".box,textarea,#ed[contenteditable],.ProseMirror,.ql-editor,.public-DraftEditor-content,.cm-editor" +
  "{border:1px solid #888;min-height:80px;padding:8px;width:520px;outline:none}";
writeFileSync(join(dist, "page.css"), STYLE);
copyFileSync(join(here, "node_modules", "codemirror5", "lib", "codemirror.css"), join(dist, "cm5.css"));

for (const file of entries) {
  const name = file.replace(/\.jsx?$/, "");
  const extraCss = name === "cm5" ? '<link rel="stylesheet" href="cm5.css">' : "";
  const editable = name === "lexical" ? ' contenteditable="true"' : "";
  writeFileSync(
    join(dist, name + ".html"),
    `<!doctype html><meta charset="utf-8"><title>${name}</title><link rel="stylesheet" href="page.css">${extraCss}` +
      `<h3>${name}</h3><div id="root"></div><div id="ed"${editable}></div><script type="module" src="${name}.js"></script>\n`,
  );
}
console.log(`built ${entries.length} editor pages`);
