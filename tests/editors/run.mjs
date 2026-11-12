// Types into every editor page with the unpacked extension loaded and compares
// the editor's own model text with what should have been written.
//   node run.mjs <extensionDir> [page filter]        (run build.mjs first)
import { createServer } from "node:http"; import { readFileSync, mkdtempSync, existsSync } from "node:fs";
import { tmpdir } from "node:os"; import { join, extname, dirname } from "node:path"; import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
const here = dirname(fileURLToPath(import.meta.url)); const ext = process.argv[2]; const filter = process.argv[3] || "";
const TYPES = { ".css": "text/css", ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8" };
const server = createServer((q, r) => { const p = join(here, "dist", decodeURIComponent(q.url.split("?")[0]));
  if (!existsSync(p)) { r.writeHead(404); return r.end(); } const h = { "content-type": TYPES[extname(p)] || "application/octet-stream" };
  if (p.endsWith("csp.html")) h["content-security-policy"] = "default-src 'self'; script-src 'self'; style-src 'self'; require-trusted-types-for 'script'; trusted-types 'none'";
  r.writeHead(200, h); r.end(readFileSync(p)); }).listen(0, "127.0.0.1");
await new Promise((r) => server.once("listening", r)); const base = `http://127.0.0.1:${server.address().port}/`;
const ctx = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), "lab-")), { headless: false, executablePath: process.env.CHROME_PATH || undefined, channel: process.env.CHROME_PATH ? undefined : "chromium",
  args: ["--headless=new", "--no-sandbox", `--disable-extensions-except=${ext}`, `--load-extension=${ext}`] });
const worker = ctx.serviceWorkers()[0] || (await ctx.waitForEvent("serviceworker"));
const PAGES = ["plain.html", "plain.html#ce-html", "plain.html#ce-plaintext", "plain.html#design", "plain.html#srcdoc", "plain.html#search", "plain.html#dialog", "plain.html#transform", "csp.html", "csp.html#ce", "react.html", "react.html#ta", "shadow.html", "shadow.html#ce", "shadow.html#closed",
  "lexical.html", "lexical.html#chat", "draft.html", "slate.html", "tiptap.html", "tiptap.html#chat", "quill.html", "cm6.html", "cm5.html", "ace.html", "monaco.html#textarea", "ckeditor.html", "tinymce.html", "tinymce.html#inline"].filter((p) => p.includes(filter)).filter((_, i) => !process.env.SHARD || i % Number(process.env.SHARD.split("/")[1]) === Number(process.env.SHARD.split("/")[0]));
const norm = (s) => String(s).replace(/\u00A0/g, " ").replace(/[\u200B\uFEFF]/g, "").replace(/\n+/g, "\n").replace(/[ \n]+$/, "");
const D = Number(process.env.DELAY || 20);
const rows = [];
for (const name of PAGES) {
  const page = await ctx.newPage(); const errs = [];
  page.on("pageerror", (e) => errs.push(e.message.slice(0, 120)));
  page.on("console", (m) => { if (m.type() === "error" && !/favicon|Failed to load resource/.test(m.text())) errs.push(m.text().slice(0, 120)); });
  await page.goto(base + name);
  if (name.includes("#")) await page.reload();
  try { await page.waitForFunction(() => window.lab, null, { timeout: 15000 }); } catch { rows.push([name, "LOAD", "lab not ready: " + errs.join(" | ")]); await page.close(); continue; }
  const lab = await page.evaluate(() => ({ sel: lab.sel, focusSel: lab.focusSel, frame: !!lab.frame, frameSel: lab.frameSel, chat: typeof lab.sent === "function", buffered: !!lab.buffered }));
  const focus = async () => {
    if (lab.frame) { const f = page.frameLocator(lab.sel); const l = f.locator(lab.frameSel || "body"); try { await l.click({ timeout: 1500 }); } catch { await l.focus(); } }
    else await page.click(lab.focusSel || lab.sel);
    await page.waitForTimeout(80);
  };
  const text = async () => norm(await page.evaluate(() => lab.text()));
  const reset = async () => { await page.keyboard.press("Escape"); await page.evaluate(() => lab.clear()); await page.waitForTimeout(80); await focus(); await worker.evaluate(() => chrome.storage.local.set({ learned: {} })); await page.waitForTimeout(60); };
  const type = (t, d = D) => page.keyboard.type(t, { delay: d });
  const kb = page.keyboard;
  const T = async (label, fn, expected) => {
    try { await reset(); const before = errs.length; let got = await fn(); if (got === undefined) { await page.waitForTimeout(120); got = await text(); }
      const ok = norm(got) === expected && errs.length === before;
      rows.push([name, ok ? "ok" : "FAIL", label, ok ? "" : `got ${JSON.stringify(norm(got))} want ${JSON.stringify(expected)}` + (errs.length > before ? " ERR " + errs.slice(before).join(" | ") : "")]);
    } catch (e) { rows.push([name, "FAIL", label, "threw " + e.message.split("\n")[0].slice(0, 140)]); }
  };
  try { await focus(); } catch (e) { rows.push([name, "LOAD", "cannot focus: " + e.message.split("\n")[0]]); await page.close(); continue; }
  await type("a"); await page.waitForTimeout(500); // warm dictionary
  const multiline = !/search|react\.html$/.test(name);
  const chat = /#chat|#search/.test(name);
  await T("sentence", async () => { await type("ami tomake bhalobashi "); }, "আমি তোমাকে ভালোবাসি ".trimEnd());
  await T("fast typing", async () => { await type("amar sonar bangla ami tomay bhalobashi ", 0); }, "আমার সোনার বাংলা আমি তোমায় ভালোবাসি");
  await T("dari + comma", async () => { await type("ami bhalo achi, tumi kemon acho. "); }, "আমি ভালো আছি, তুমি কেমন আছ।");
  if (!lab.buffered) await T("backspace undo", async () => { await type("desh "); await kb.press("Backspace"); await page.waitForTimeout(60); const mid = await text(); await type("e "); await page.waitForTimeout(100); return mid + "|" + (await text()); }, "desh|দেশে");
  const second = async () => page.evaluate(() => { for (const n of document.querySelectorAll("*")) { const p = n.shadowRoot && n.shadowRoot.querySelector(".panel.open"); if (p) return p.querySelectorAll(".txt")[1].textContent; } for (const f of document.querySelectorAll("iframe")) { try { for (const n of f.contentDocument.querySelectorAll("*")) { const p = n.shadowRoot && n.shadowRoot.querySelector(".panel.open"); if (p) return p.querySelectorAll(".txt")[1].textContent; } } catch {} } return "(no panel)"; });
  await T("arrow + enter pick", async () => { await type("bangla"); await page.waitForTimeout(120); const want = await second(); await kb.press("ArrowDown"); await kb.press("Enter"); await type(" desh "); await page.waitForTimeout(120); return (await text()) === want + " দেশ" ? "PICKED" : (await text()) + " (wanted " + want + " দেশ)"; }, "PICKED");
  await T("panel shows on the first word", async () => { await type("ba"); await page.waitForTimeout(150); const w = await second(); await kb.press("Escape"); return w === "(no panel)" ? w : "SHOWN"; }, "SHOWN");
  await T("punctuation", async () => { await type("tumi kemon acho? (ami) bhalo! thik-thak; "); }, "তুমি কেমন আছ? (আমি) ভালো! ঠিক-থাক;");
  await T("tab pick", async () => { await type("tumi"); await page.waitForTimeout(80); await kb.press("Tab"); await type(" ami "); }, "তুমি আমি");
  await T("edit at line start", async () => { await type("ami tumi "); await kb.press("Home"); await type("ebong "); }, "এবং আমি তুমি");
  await T("second word after bangla", async () => { await type("ami "); await page.waitForTimeout(300); await type("tumi "); await page.waitForTimeout(300); await type("se "); }, "আমি তুমি সে");
  if (!lab.frame) await T("click a candidate", async () => { await type("bangla"); await page.waitForTimeout(150);
    const box = await page.evaluate(() => { for (const n of document.querySelectorAll("*")) { const p = n.shadowRoot && n.shadowRoot.querySelector(".panel.open"); if (p) { const it = p.querySelectorAll(".item")[1]; if (!it) return null; const r = it.getBoundingClientRect(); const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return { x: r.left + r.width / 2, y: r.top + r.height / 2, hit: top === n, vis: r.width > 20 && r.top >= 0 && r.bottom <= innerHeight }; } } return null; });
    if (!box) return "(no open panel)"; if (!box.vis) return "(panel off-screen)"; if (!box.hit) return "(panel covered)";
    const want = await second(); await page.mouse.click(box.x, box.y); await page.waitForTimeout(120); await type(" desh "); await page.waitForTimeout(120); return (await text()) === want + " দেশ" ? "PICKED" : (await text()) + " (wanted " + want + " দেশ)"; }, "PICKED");
  if (multiline && !chat) await T("two lines", async () => { await type("ami"); await kb.press("Enter"); await type("tumi"); await kb.press("Enter"); await type("se "); }, "আমি\nতুমি\nসে");
  if (chat) await T("enter sends converted text", async () => { await type("tumi kemon"); await kb.press("Enter"); await page.waitForTimeout(150); return (await page.evaluate(() => lab.sent().slice(-1)[0])) || "(nothing sent)"; }, "তুমি কেমন");
  await T("english mode untouched", async () => { await worker.evaluate(() => chrome.storage.sync.set({ language: "en" })); await page.waitForTimeout(150); await type("ami tumi. "); await page.waitForTimeout(80); const t = await text(); await worker.evaluate(() => chrome.storage.sync.set({ language: "bn" })); await page.waitForTimeout(150); return t; }, "ami tumi.");
  if (errs.length) rows.push([name, "ERRS", [...new Set(errs)].slice(0, 3).join(" | ")]);
  await page.close();
}
await ctx.close(); server.close();
const fails = rows.filter((r) => r[1] !== "ok");
const byPage = {}; for (const r of rows) (byPage[r[0]] ||= { ok: 0, bad: 0 })[r[1] === "ok" ? "ok" : "bad"]++;
console.log(Object.entries(byPage).map(([p, c]) => (c.bad ? "✗ " : "✓ ") + p.replace(".html", "") + " " + c.ok + "/" + (c.ok + c.bad)).join("   "));
console.log(); for (const r of fails) console.log(r.join(" · ").slice(0, 230));
console.log(`\n${rows.length - fails.length}/${rows.length} ok`); process.exit(fails.length ? 1 : 0);
