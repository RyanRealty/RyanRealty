/* eslint-disable */
// GENERATED — DO NOT EDIT. Source of truth: scripts/brand-voice-vocabulary.cjs
// Regenerate: node scripts/gen-brand-voice-consumers.mjs --write
//
// The single in-bundle mirror of the canonical banned vocabulary. App-bundle
// TS (voice checks, brief generation, GBP scan) imports THIS instead of
// hand-typing a list — the ci:voice-vocab-parity gate fails on any drift.

export interface BannedWord { readonly word: string; readonly category: string }

/** Banned punctuation characters (em-dash, en-dash, semicolon, exclamation). */
export const PUNCTUATION_CHARS: readonly string[] = ["—", "–", ";", "!"]

/** Deduped, lowercased, sorted banned-word/phrase strings. */
export const BANNED_WORD_STRINGS: readonly string[] = [
  "act fast",
  "actually traded",
  "buying a home is a big decision",
  "dedicated agent",
  "dedicated broker",
  "dedicated team",
  "dedicated to your",
  "don't miss out",
  "dont miss out",
  "full-service brokerage",
  "great question",
  "has traded",
  "have traded",
  "home traded",
  "homes trade",
  "homes traded",
  "honest advice",
  "honest answers",
  "honest broker",
  "independent brokerage by design",
  "let me explain in simple terms",
  "licensed and active brokers",
  "most trusted",
  "premier agent",
  "premier brokerage",
  "premier destination",
  "premier real estate",
  "small team",
  "three brokers",
  "top producing",
  "trades at a",
  "trusted advisor",
  "trusted brokerage",
  "trusted name",
  "trusted partner",
  "we are honest",
  "we will handle everything",
  "we're honest",
  "won't last long",
  "wont last long",
  "you have great taste",
  "your local experts",
]

/** Banned words with their category, for richer violation messages. */
export const BANNED_WORDS: readonly BannedWord[] = [
  { word: "act fast", category: "fake-urgency" },
  { word: "actually traded", category: "trading-language" },
  { word: "buying a home is a big decision", category: "pandering" },
  { word: "dedicated agent", category: "self-praise" },
  { word: "dedicated broker", category: "self-praise" },
  { word: "dedicated team", category: "self-praise" },
  { word: "dedicated to your", category: "self-praise" },
  { word: "don't miss out", category: "fake-urgency" },
  { word: "dont miss out", category: "fake-urgency" },
  { word: "full-service brokerage", category: "category-positioning" },
  { word: "great question", category: "pandering" },
  { word: "has traded", category: "trading-language" },
  { word: "have traded", category: "trading-language" },
  { word: "home traded", category: "trading-language" },
  { word: "homes trade", category: "trading-language" },
  { word: "homes traded", category: "trading-language" },
  { word: "honest advice", category: "self-praise" },
  { word: "honest answers", category: "self-praise" },
  { word: "honest broker", category: "self-praise" },
  { word: "independent brokerage by design", category: "category-positioning" },
  { word: "let me explain in simple terms", category: "pandering" },
  { word: "licensed and active brokers", category: "category-positioning" },
  { word: "most trusted", category: "self-praise" },
  { word: "premier agent", category: "self-praise" },
  { word: "premier brokerage", category: "self-praise" },
  { word: "premier destination", category: "self-praise" },
  { word: "premier real estate", category: "self-praise" },
  { word: "small team", category: "category-positioning" },
  { word: "three brokers", category: "category-positioning" },
  { word: "top producing", category: "self-praise" },
  { word: "trades at a", category: "trading-language" },
  { word: "trusted advisor", category: "self-praise" },
  { word: "trusted brokerage", category: "self-praise" },
  { word: "trusted name", category: "self-praise" },
  { word: "trusted partner", category: "self-praise" },
  { word: "we are honest", category: "self-praise" },
  { word: "we will handle everything", category: "pandering" },
  { word: "we're honest", category: "self-praise" },
  { word: "won't last long", category: "fake-urgency" },
  { word: "wont last long", category: "fake-urgency" },
  { word: "you have great taste", category: "pandering" },
  { word: "your local experts", category: "self-praise" },
]
