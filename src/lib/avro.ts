// The landing-page demo runs the exact engine the extension ships
// (extension/lib/engine.js), so the two can never drift apart.
import "../../extension/lib/engine.js";
import dictJson from "./bn-dictionary.json";

const engine = globalThis.SEBanglishEngine;
engine.setDictionary(dictJson as Record<string, string>);

export function transliterate(latin: string): string {
  return engine.transliterate(latin);
}

export function suggest(latin: string): string[] {
  return engine.suggest(latin);
}
