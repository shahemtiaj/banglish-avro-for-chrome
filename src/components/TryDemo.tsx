import { useEffect, useMemo, useRef, useState } from "react";
import { suggest, transliterate } from "@/lib/avro";

const LATIN = /[A-Za-z^:0-9]/;

export function TryDemo() {
  const [value, setValue] = useState("");
  const [caret, setCaret] = useState(0);
  const [active, setActive] = useState(0);
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const { word, start } = useMemo(() => {
    let s = caret;
    while (s > 0 && LATIN.test(value[s - 1] ?? "")) s--;
    return { word: value.slice(s, caret), start: s };
  }, [value, caret]);

  const items = useMemo(() => (word ? suggest(word) : []), [word]);
  const showPanel = focused && items.length > 0 && word.length > 0 && /[A-Za-z]/.test(word);

  useEffect(() => { setActive(0); }, [word]);

  const commit = (choice: string) => {
    const next = value.slice(0, start) + choice + value.slice(caret);
    setValue(next);
    const pos = start + choice.length;
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(pos, pos);
      setCaret(pos);
    });
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Read live from the DOM so we don't fight React's async state.
    const el = e.currentTarget;
    const curVal = el.value;
    const curPos = el.selectionStart ?? curVal.length;
    let s = curPos;
    while (s > 0 && LATIN.test(curVal[s - 1] ?? "")) s--;
    const curWord = curVal.slice(s, curPos);
    const curItems = curWord && /[A-Za-z]/.test(curWord) ? suggest(curWord) : [];

    if (curItems.length > 0) {
      if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => (a + 1) % items.length); return; }
      if (e.key === "ArrowUp")   { e.preventDefault(); setActive((a) => (a - 1 + items.length) % items.length); return; }
      if (e.key === "Tab" || e.key === "Enter") {
        e.preventDefault();
        const pick = curItems[active] ?? curItems[0];
        const next = curVal.slice(0, s) + pick + curVal.slice(curPos);
        setValue(next);
        const pos = s + pick.length;
        requestAnimationFrame(() => { el.setSelectionRange(pos, pos); setCaret(pos); });
        return;
      }
      if (e.key === "Escape")    { e.preventDefault(); setFocused(false); (e.target as HTMLInputElement).blur(); return; }
    }
    if (e.key === " " || /^[.,!?;:।]$/.test(e.key)) {
      if (curWord && /[A-Za-z]/.test(curWord)) {
        const bn = transliterate(curWord);
        if (bn && bn !== curWord) {
          e.preventDefault();
          const next = curVal.slice(0, s) + bn + e.key + curVal.slice(curPos);
          setValue(next);
          const pos = s + bn.length + 1;
          requestAnimationFrame(() => {
            el.setSelectionRange(pos, pos);
            setCaret(pos);
          });
        }
      }
    }
  };

  const sync = () => {
    const el = inputRef.current;
    if (!el) return;
    setCaret(el.selectionStart ?? el.value.length);
  };

  return (
    <div className="relative">
      <label className="text-xs uppercase tracking-widest text-muted-foreground mb-2 block">
        Live demo — type Banglish, watch it turn Bangla
      </label>
      <input
        ref={inputRef}
        value={value}
        placeholder="try: ami bangla likhchi"
        onChange={(e) => { setValue(e.target.value); requestAnimationFrame(sync); }}
        onKeyDown={onKeyDown}
        onKeyUp={sync}
        onClick={sync}
        onFocus={() => { setFocused(true); sync(); }}
        onBlur={() => setTimeout(() => setFocused(false), 120)}
        className="w-full rounded-xl border border-border bg-background px-4 py-3 text-lg outline-none focus:border-[#FF9F1C] focus:ring-2 focus:ring-[#FF9F1C]/30 transition"
        style={{ fontFamily: "'Noto Sans Bengali', 'Inter', sans-serif" }}
        autoComplete="off"
        spellCheck={false}
      />
      {showPanel && (
        <div
          role="listbox"
          className="absolute left-0 right-auto top-full mt-2 z-30 min-w-[220px] max-w-[320px] rounded-2xl border border-border bg-background/95 backdrop-blur-xl p-1.5 shadow-2xl"
          style={{ boxShadow: "0 20px 40px rgba(0,0,0,0.12), 0 4px 12px rgba(0,0,0,0.06)" }}
        >
          {items.map((txt, i) => (
            <button
              key={txt + i}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); commit(txt); }}
              onMouseEnter={() => setActive(i)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left transition-colors ${
                i === active
                  ? "text-white"
                  : "hover:bg-accent text-foreground"
              }`}
              style={i === active ? { background: "linear-gradient(135deg, #FF9F1C, #FFC857)" } : undefined}
            >
              <span className={`text-[11px] font-medium ${i === active ? "text-white/90" : "text-muted-foreground"}`}>{i + 1}</span>
              <span className="text-lg" style={{ fontFamily: "'Noto Sans Bengali', sans-serif" }}>{txt}</span>
            </button>
          ))}
          <div className="px-3 pt-1.5 pb-1 text-[11px] text-muted-foreground border-t border-border/60 mt-1">
            ↑ ↓ to move · Enter to pick · Space to commit
          </div>
        </div>
      )}
      <p className="mt-3 text-xs text-muted-foreground">
        Same engine that ships in the extension. Install to use it in Gmail, Facebook, ChatGPT, and every input on the web.
      </p>
    </div>
  );
}