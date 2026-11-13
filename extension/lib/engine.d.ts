// Types for engine.js (a classic script that registers a global).
export interface SEBanglishEngineApi {
  phonetic(latin: string, opts?: { loose?: boolean; riKar?: boolean; finalO?: boolean }): string;
  transliterate(latin: string): string;
  suggest(latin: string, max?: number): string[];
  setDictionary(dict: Record<string, string>): void;
  setCustomDictionary(dict: Record<string, string>): void;
  setLearned(dict: Record<string, string>): void;
  setOptions(options: { autoCorrect?: boolean }): void;
  isWordChar(ch: string): boolean;
  hasLetter(s: string): boolean;
  WORD_CHARS: string;
}

declare global {
  // eslint-disable-next-line no-var
  var SEBanglishEngine: SEBanglishEngineApi;
}
