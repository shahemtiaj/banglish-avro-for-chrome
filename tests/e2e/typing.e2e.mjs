// End-to-end check in a real Chromium with the unpacked extension loaded.
// Optional — needs Playwright:  npm i -D playwright && node tests/e2e/typing.e2e.mjs
// Set CHROME_PATH to use a specific Chromium / Chrome for Testing binary.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const extensionPath = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "extension");
const PAGE = `<!doctype html><meta charset="utf-8"><title>e2e</title>
<body style="font:16px sans-serif;padding:24px">
<input id="text" type="text" style="width:400px"><br><br>
<input id="email" type="email" style="width:400px"><br><br>
<textarea id="area" rows="4" cols="50"></textarea><br><br>
<div id="rich" contenteditable="true" style="border:1px solid #999;min-height:40px;width:400px"></div>
</body>`;

const server = createServer((_req, res) => {
  res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  res.end(PAGE);
}).listen(0, "127.0.0.1");
await new Promise((r) => server.once("listening", r));
const url = `http://127.0.0.1:${server.address().port}/`;

const profile = mkdtempSync(join(tmpdir(), "se-banglish-e2e-"));
const context = await chromium.launchPersistentContext(profile, {
  headless: false,
  executablePath: process.env.CHROME_PATH || undefined,
  channel: process.env.CHROME_PATH ? undefined : "chromium",
  args: ["--headless=new", "--no-sandbox", `--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
});

const results = [];
const check = async (name, fn) => {
  try { await fn(); results.push(["ok", name]); }
  catch (err) { results.push(["FAIL", name, err.message.split("\n").slice(0, 4).join(" | ")]); }
};
const norm = (s) => s.replace(/ /g, " ");

try {
  const worker = context.serviceWorkers()[0] || (await context.waitForEvent("serviceworker"));
  const extId = new URL(worker.url()).host;
  const errors = [];
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push("page: " + e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()); });
  await page.goto(url);
  await page.waitForFunction(() => document.readyState === "complete");

  const value = (id) => page.$eval("#" + id, (el) => ("value" in el ? el.value : el.textContent));
  const clear = async (id) => {
    await page.$eval("#" + id, (el) => { if ("value" in el) el.value = ""; else el.textContent = ""; });
    await page.click("#" + id);
  };
  const type = (text) => page.keyboard.type(text, { delay: 15 });
  const panel = () =>
    page.evaluate(() => {
      for (const host of document.documentElement.children) {
        const p = host.shadowRoot && host.shadowRoot.querySelector(".panel");
        if (p) return { open: p.classList.contains("open"), items: [...p.querySelectorAll(".txt")].map((n) => n.textContent) };
      }
      return null;
    });
  const setSync = (patch) => worker.evaluate((p) => chrome.storage.sync.set(p), patch);

  // warm-up: first focus loads the dictionary from the service worker
  await page.click("#text");
  await type("a");
  await page.waitForTimeout(400);

  await check("input: sentence converts word by word", async () => {
    await clear("text");
    await type("ami tomake bhalobashi ");
    assert.equal(await value("text"), "আমি তোমাকে ভালোবাসি ");
  });
  await check("word list reaches the page: words outside the dictionary are spelled right", async () => {
    await clear("text");
    await type("surjasto dekhte prodhanmontri asben ");
    assert.equal(await value("text"), "সূর্যাস্ত দেখতে প্রধানমন্ত্রী আসবেন ");
  });
  await check("candidate window opens with ranked choices, Latin last", async () => {
    await clear("text");
    await type("bangla");
    const p = await panel();
    assert.ok(p && p.open, "panel open");
    assert.equal(p.items[0], "বাংলা");
    assert.equal(p.items.at(-1), "bangla");
    await page.keyboard.press("Escape");
    assert.equal((await panel()).open, false);
  });
  await check("ArrowDown + Space commits the highlighted candidate", async () => {
    await clear("text");
    await type("bangla");
    const second = (await panel()).items[1];
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Space");
    assert.equal(await value("text"), second + " ");
    await worker.evaluate(() => chrome.storage.local.set({ learned: {} }));
    await page.waitForTimeout(150);
  });
  await check("Enter converts and still reaches the page; after ArrowDown it only picks", async () => {
    await clear("area");
    await type("tumi");
    await page.keyboard.press("Enter");
    assert.equal(await value("area"), "তুমি\n");
    await clear("area");
    await type("bangla");
    const second = (await panel()).items[1];
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    assert.equal(await value("area"), second);
    await worker.evaluate(() => chrome.storage.local.set({ learned: {} }));
    await page.waitForTimeout(150);
  });
  await check("Tab takes the highlighted candidate and keeps focus", async () => {
    await clear("text");
    await type("tumi");
    await page.keyboard.press("Tab");
    assert.equal(await value("text"), "তুমি");
    assert.equal(await page.evaluate(() => document.activeElement.id), "text");
  });
  await check("Backspace reopens the converted word", async () => {
    await clear("text");
    await type("desh ");
    assert.equal(await value("text"), "দেশ ");
    await page.keyboard.press("Backspace");
    assert.equal(await value("text"), "desh");
    await type("e ");
    assert.equal(await value("text"), "দেশে ");
  });
  await check("punctuation ends a word; visarga survives", async () => {
    await clear("text");
    await type("(ami) ami-tumi du:kho ");
    assert.equal(await value("text"), "(আমি) আমি-তুমি দুঃখ ");
  });
  await check("textarea: dari, ellipsis and decimals", async () => {
    await clear("area");
    await type("ami bhat khai. tai... 3.5 taka");
    await page.keyboard.press("Space");
    assert.equal(await value("area"), "আমি ভাত খাই। তাই... 3.5 টাকা ");
  });
  await check("contenteditable converts in place", async () => {
    await clear("rich");
    await type("amar sonar bangla ");
    assert.equal(norm(await value("rich")), "আমার সোনার বাংলা ");
  });
  await check("contenteditable: Backspace undo and dari", async () => {
    await clear("rich");
    await type("desh ");
    await page.keyboard.press("Backspace");
    assert.equal(norm(await value("rich")), "desh");
    await type("er kotha.");
    assert.equal(norm(await value("rich")), "দেশের কথা।");
  });
  await check("e-mail fields are left alone", async () => {
    await clear("email");
    await type("ami x");
    assert.equal(await value("email"), "ami x");
  });
  await check("re-injection never double-handles a key", async () => {
    await worker.evaluate(async () => {
      const [tab] = await chrome.tabs.query({ active: true });
      await chrome.scripting.executeScript({ target: { tabId: tab.id, allFrames: true }, files: ["lib/engine.js", "content/content.js"] });
    });
    await clear("text");
    await type("ami tumi ");
    assert.equal(await value("text"), "আমি তুমি ");
    const hosts = await page.evaluate(() => [...document.documentElement.children].filter((n) => n.shadowRoot).length);
    assert.ok(hosts <= 2, `shadow hosts: ${hosts}`);
  });
  await check("English mode types Latin", async () => {
    await setSync({ language: "en" });
    await page.waitForTimeout(200);
    await clear("text");
    await type("ami ");
    assert.equal(await value("text"), "ami ");
    await setSync({ language: "bn" });
    await page.waitForTimeout(200);
  });
  await check("per-site switch turns typing off", async () => {
    await setSync({ disabledSites: ["127.0.0.1"] });
    await page.waitForTimeout(200);
    await clear("text");
    await type("ami ");
    assert.equal(await value("text"), "ami ");
    await setSync({ disabledSites: [] });
    await page.waitForTimeout(200);
    await clear("text");
    await type("ami ");
    assert.equal(await value("text"), "আমি ");
  });
  await check("auto correction off falls back to plain phonetic rules", async () => {
    await setSync({ autoCorrect: false });
    await page.waitForTimeout(200);
    await clear("text");
    await type("prithibi ");
    assert.equal(await value("text"), "প্রিথিবি ");
    await setSync({ autoCorrect: true });
    await page.waitForTimeout(200);
  });
  await check("the page cannot probe extension files", async () => {
    const reachable = await page.evaluate(
      (id) => fetch(`chrome-extension://${id}/dictionary/core.json`).then(() => true, () => false),
      extId,
    );
    assert.equal(reachable, false);
    await page.waitForTimeout(100);
    errors.length = 0; // the blocked request above logs a console error by design
  });
  await check("statistics are stored locally", async () => {
    await page.waitForTimeout(3500);
    const { stats } = await worker.evaluate(() => chrome.storage.local.get("stats"));
    assert.ok(stats && stats.wordsTyped > 10, JSON.stringify(stats));
    const sync = await worker.evaluate(() => chrome.storage.sync.get(null));
    assert.ok(!("stats" in sync));
  });

  const ext = await context.newPage();
  ext.on("pageerror", (e) => errors.push("extension page: " + e.message));
  ext.on("console", (m) => { if (m.type() === "error") errors.push("extension console: " + m.text()); });
  await check("options: custom word, safe rendering, try-it box", async () => {
    await ext.goto(`chrome-extension://${extId}/options/options.html`);
    await ext.click('[data-section="dictionary"]');
    await ext.fill("#dict-key", "rakib");
    await ext.fill("#dict-val", '<img src=x onerror="document.title=1">রাকিব');
    await ext.click("#dict-add");
    await ext.waitForSelector(".dict-row");
    assert.equal(await ext.$$eval("#dict-list img", (n) => n.length), 0, "markup must not be parsed");
    await ext.click("[data-del]");
    await ext.fill("#dict-key", "rakib");
    await ext.fill("#dict-val", "রাকিব");
    await ext.click("#dict-add");
    await ext.waitForSelector(".dict-row");
    await ext.click('[data-section="typing"]');
    await ext.click("#try-input");
    await ext.keyboard.type("rakib prithibite thake ", { delay: 15 });
    assert.equal(await ext.$eval("#try-input", (el) => el.value), "রাকিব পৃথিবীতে থাকে ");
    assert.match(await ext.textContent("#version"), /^Version \d+\.\d+\.\d+$/);
  });
  await check("custom word reaches open pages", async () => {
    await page.bringToFront();
    await clear("text");
    await type("rakib ");
    assert.equal(await value("text"), "রাকিব ");
  });
  await check("popup renders and toggles", async () => {
    await ext.bringToFront();
    await ext.goto(`chrome-extension://${extId}/popup/popup.html`);
    await ext.waitForFunction(() => document.querySelector("#version").textContent.startsWith("v"));
    assert.equal(await ext.textContent("#status-text"), "Enabled — Bangla");
    await ext.click('[data-lang="en"]');
    await ext.waitForFunction(() => document.querySelector("#status-text").textContent === "Enabled — English");
    await ext.click('[data-lang="bn"]');
  });
  await check("no errors on the page or extension pages", async () => {
    assert.equal(errors.join(" ;; "), "");
  });
} finally {
  await context.close();
  server.close();
  rmSync(profile, { recursive: true, force: true });
}

for (const r of results) console.log(r.join("  "));
const failed = results.filter((r) => r[0] !== "ok").length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
