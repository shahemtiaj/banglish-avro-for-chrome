import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { TryDemo } from "@/components/TryDemo";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const download = () => {
    setError(null);
    setDownloading(true);
    fetch("/se-banglish-avro.zip")
      .then((res) => {
        if (!res.ok) throw new Error(`Download failed (${res.status})`);
        return res.blob();
      })
      .then((blob) => {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "se-banglish-avro.zip";
        a.click();
        URL.revokeObjectURL(a.href);
      })
      .catch((err) => setError(err.message))
      .finally(() => setDownloading(false));
  };

  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      {/* Nav */}
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-background/70 border-b border-border/60">
        <div className="mx-auto max-w-6xl px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-white font-bold shadow-lg" style={{ background: "linear-gradient(135deg, #FF9F1C, #FFC857)", boxShadow: "0 8px 24px rgba(255,159,28,0.35)", fontFamily: "'Noto Sans Bengali', sans-serif" }}>
              অ
            </span>
            <div className="flex flex-col leading-tight">
              <span className="text-sm font-semibold">SE Banglish Avro</span>
              <span className="text-[11px] text-muted-foreground">for Chrome</span>
            </div>
          </div>
          <nav className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors">Features</a>
            <a href="#install" className="hover:text-foreground transition-colors">Install</a>
            <a href="#faq" className="hover:text-foreground transition-colors">FAQ</a>
          </nav>
          <button
            onClick={download}
            disabled={downloading}
            className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-white shadow-md transition-transform active:scale-[0.98] disabled:opacity-70"
            style={{ background: "linear-gradient(135deg, #FF9F1C, #FFC857)", boxShadow: "0 8px 20px rgba(255,159,28,0.35)" }}
          >
            {downloading ? "Preparing…" : "Download"}
          </button>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-0 -z-10"
          style={{
            background:
              "radial-gradient(1200px 500px at 20% -10%, rgba(255,159,28,0.18), transparent 60%), radial-gradient(1000px 500px at 90% 10%, rgba(255,200,87,0.18), transparent 60%)",
          }}
        />
        <div className="mx-auto max-w-6xl px-6 pt-20 pb-16 md:pt-28 md:pb-24">
          <div className="flex flex-col items-center text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/60 px-3 py-1 text-xs text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: "#FF9F1C" }} />
              Manifest V3 · Blazing fast · Zero telemetry
            </span>
            <h1 className="mt-6 text-4xl md:text-6xl font-semibold tracking-tight leading-[1.05]">
              Type Bangla anywhere.
              <br />
              <span
                className="bg-clip-text text-transparent"
                style={{ backgroundImage: "linear-gradient(135deg, #FF9F1C, #FFC857)" }}
              >
                Beautifully, instantly.
              </span>
            </h1>
            <p className="mt-6 max-w-2xl text-lg text-muted-foreground">
              An Apple-inspired, Avro-style phonetic keyboard for Chrome. Type English
              letters and watch flawless Bangla appear in every input, textarea, and
              editor on the web.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <button
                onClick={download}
                disabled={downloading}
                className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-base font-semibold text-white shadow-lg transition-transform active:scale-[0.98] disabled:opacity-70"
                style={{ background: "linear-gradient(135deg, #FF9F1C, #FFC857)", boxShadow: "0 12px 30px rgba(255,159,28,0.4)" }}
              >
                {downloading ? "Preparing your download…" : "Download for Chrome"}
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12"/><path d="m6 9 6 6 6-6"/><path d="M5 21h14"/></svg>
              </button>
              <a
                href="#install"
                className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-6 py-3 text-base font-semibold hover:bg-accent transition-colors"
              >
                How to install
              </a>
            </div>
            {error && <p className="mt-4 text-sm text-destructive">{error}</p>}

            {/* Demo card */}
            <div className="mt-14 w-full max-w-3xl">
              <div className="rounded-3xl border border-border bg-card p-2 shadow-2xl">
                <div className="rounded-2xl bg-background p-6 md:p-8">
                  <div className="flex items-center gap-2 mb-5">
                    <span className="h-3 w-3 rounded-full bg-[#FF605C]" />
                    <span className="h-3 w-3 rounded-full bg-[#FFBD44]" />
                    <span className="h-3 w-3 rounded-full bg-[#00CA4E]" />
                    <span className="ml-3 text-xs text-muted-foreground">any editable field on any website</span>
                  </div>
                  <TryDemo />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-6xl px-6 py-20">
        <div className="text-center max-w-2xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">Everything you'd expect. Nothing you wouldn't.</h2>
          <p className="mt-4 text-muted-foreground">
            A carefully designed engine with a candidate window, learning dictionary,
            and native-feeling controls — wrapped in a Material 3 + Apple HIG interface.
          </p>
        </div>
        <div className="mt-14 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-2xl border border-border bg-card p-6 hover:shadow-lg transition-shadow">
              <div
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl mb-4"
                style={{ background: "linear-gradient(135deg, rgba(255,159,28,0.15), rgba(255,200,87,0.25))", color: "#FF9F1C" }}
                aria-hidden
              >
                {f.icon}
              </div>
              <h3 className="text-base font-semibold">{f.title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Install */}
      <section id="install" className="mx-auto max-w-4xl px-6 py-20">
        <div className="text-center">
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">Install in under a minute</h2>
          <p className="mt-4 text-muted-foreground">Works in Chrome, Edge, Brave, Arc, and any Chromium browser.</p>
        </div>
        <ol className="mt-12 space-y-4">
          {STEPS.map((s, i) => (
            <li key={s.title} className="flex gap-4 items-start rounded-2xl border border-border bg-card p-5">
              <span
                className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold text-white"
                style={{ background: "linear-gradient(135deg, #FF9F1C, #FFC857)" }}
              >
                {i + 1}
              </span>
              <div>
                <h3 className="text-base font-semibold">{s.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
        <div className="mt-10 text-center">
          <button
            onClick={download}
            disabled={downloading}
            className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-base font-semibold text-white shadow-lg transition-transform active:scale-[0.98] disabled:opacity-70"
            style={{ background: "linear-gradient(135deg, #FF9F1C, #FFC857)", boxShadow: "0 12px 30px rgba(255,159,28,0.4)" }}
          >
            {downloading ? "Preparing…" : "Download the extension"}
          </button>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="mx-auto max-w-3xl px-6 py-20">
        <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-center">Questions</h2>
        <div className="mt-10 space-y-3">
          {FAQ.map((q) => (
            <details key={q.q} className="group rounded-2xl border border-border bg-card p-5 open:shadow-md transition-shadow">
              <summary className="cursor-pointer list-none flex items-center justify-between text-base font-semibold">
                {q.q}
                <span className="ml-4 text-muted-foreground transition-transform group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{q.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border">
        <div className="mx-auto max-w-6xl px-6 py-10 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-md text-white text-xs font-bold" style={{ background: "linear-gradient(135deg, #FF9F1C, #FFC857)", fontFamily: "'Noto Sans Bengali', sans-serif" }}>অ</span>
            <span>SE Banglish Avro · v2.1.1</span>
          </div>
          <div className="flex items-center gap-6">
            <a href="#features" className="hover:text-foreground">Features</a>
            <a href="#install" className="hover:text-foreground">Install</a>
            <a href="#faq" className="hover:text-foreground">FAQ</a>
          </div>
        </div>
      </footer>

      {/* Floating credit */}
      <a
        href="https://shahemtiaj.com"
        target="_blank"
        rel="noopener"
        className="fixed bottom-5 right-5 z-50 inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/80 px-4 py-2 text-xs font-medium text-muted-foreground shadow-lg backdrop-blur-xl hover:text-foreground hover:shadow-xl transition-all"
        style={{ boxShadow: "0 8px 24px rgba(0,0,0,0.08)" }}
      >
        Made with <span style={{ color: "#FF5A5F" }}>♥</span> by
        <span className="font-semibold text-foreground">Shah Emtiaj</span>
      </a>
    </div>
  );
}

const FEATURES = [
  {
    title: "Avro-style phonetic engine",
    body: "Longest-match tokenizer with full support for kar, ref, juktakkhor, hasanta, chandrabindu, anuswar, and visarga. Under 5 ms per keystroke.",
    icon: <Icon path="M4 7h16M4 12h10M4 17h16" />,
  },
  {
    title: "Live candidate window",
    body: "Glassy suggestion popup with arrow-key navigation, number shortcuts, and one-click commit — inspired by macOS IMEs.",
    icon: <Icon path="M3 5h18v14H3z M7 9h10 M7 13h6" />,
  },
  {
    title: "Works everywhere",
    body: "Every input, textarea, and contenteditable — Gmail, X, Facebook, Notion, Medium, ChatGPT, Claude, Gemini, and beyond.",
    icon: <Icon path="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z M2 12h20 M12 2c3 3 3 17 0 20 M12 2c-3 3-3 17 0 20" />,
  },
  {
    title: "Custom dictionary",
    body: "Add names, brands, and slang once — they show up as top suggestions everywhere. Import and export as JSON.",
    icon: <Icon path="M4 4h16v16H4z M8 8h8 M8 12h5 M8 16h8" />,
  },
  {
    title: "Apple-inspired UI",
    body: "Material 3 motion, Apple HIG spacing, smooth 200 ms springs, ripple hovers, and a light/dark/system theme.",
    icon: <Icon path="M12 3v18 M3 12h18" />,
  },
  {
    title: "Private by design",
    body: "Everything runs locally. No servers, no analytics, no tracking. Your dictionary syncs only via Chrome Storage Sync.",
    icon: <Icon path="M12 2 4 6v6c0 5 3.5 9 8 10 4.5-1 8-5 8-10V6z" />,
  },
];

const STEPS = [
  { title: "Download the ZIP", body: "Click the download button above to grab se-banglish-avro.zip." },
  { title: "Unzip the file", body: "Extract it anywhere — Desktop, Documents, wherever feels right." },
  { title: "Open chrome://extensions", body: "Paste that URL into your address bar and press Enter." },
  { title: "Enable Developer mode", body: "Toggle it on in the top-right corner of the extensions page." },
  { title: "Click 'Load unpacked'", body: "Select the unzipped folder. That's it — you're typing Bangla." },
];

const FAQ = [
  {
    q: "Does it work on Gmail, X, Facebook, and ChatGPT?",
    a: "Yes — any editable field on any site is supported, including chat inputs on ChatGPT, Claude, and Gemini.",
  },
  {
    q: "Is my typing sent anywhere?",
    a: "No. All transliteration happens on-device inside the extension. Nothing is uploaded, and there is no telemetry.",
  },
  {
    q: "How do I switch between Bangla and English?",
    a: "Press Ctrl + Space (or MacCtrl + Space on macOS). You can also switch from the extension popup.",
  },
  {
    q: "Why load unpacked instead of the Chrome Web Store?",
    a: "This is a self-hosted build. You can publish your own to the Web Store by uploading the same ZIP.",
  },
];

function Icon({ path }: { path: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d={path} />
    </svg>
  );
}