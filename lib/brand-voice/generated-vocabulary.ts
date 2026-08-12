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
  "what is my home worth",
  "what is your home worth",
  "what's my home worth",
  "what's your home worth",
  "whats my home worth",
  "whats your home worth",
]

/** Banned words with their category, for richer violation messages. */
export const BANNED_WORDS: readonly BannedWord[] = [
  { word: "what is my home worth", category: "worth-cta" },
  { word: "what is your home worth", category: "worth-cta" },
  { word: "what's my home worth", category: "worth-cta" },
  { word: "what's your home worth", category: "worth-cta" },
  { word: "whats my home worth", category: "worth-cta" },
  { word: "whats your home worth", category: "worth-cta" },
]
