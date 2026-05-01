/**
 * VO script helpers: number-to-words for ElevenLabs ingestion, IPA phoneme
 * tagging for tricky Central Oregon place names, and the canonical anti-slop
 * banned-word list.
 *
 * All functions are pure and deterministic. They are the building blocks for
 * generate-script.ts but are also exported individually so other pipeline
 * stages (caption sanitizer, post-render banned-word grep) share the same
 * source of truth.
 *
 * Hard rules (per skills/youtube-market-reports/SKILL.md Section 9.3 and
 * brand-system.md Section 4.3):
 *   - No banned words (real estate slop, AI filler, hedging substitutes).
 *   - No em-dashes, semicolons, exclamation marks, emoji.
 *   - Numbers spelled out for ElevenLabs.
 *   - IPA tags for Deschutes, Tumalo, Tetherow, Awbrey, Terrebonne.
 */

// ---------------------------------------------------------------------------
// Banned-word list (canonical)
// ---------------------------------------------------------------------------

/** Real-estate slop language. Never appears in any VO script or caption. */
export const BANNED_REAL_ESTATE: readonly string[] = [
  'stunning',
  'nestled',
  'boasts',
  'charming',
  'pristine',
  'gorgeous',
  'breathtaking',
  'must-see',
  'must see',
  'dream home',
  'meticulously maintained',
  "entertainer's dream",
  'tucked away',
  'hidden gem',
  'truly',
  'spacious',
  'cozy',
  'luxurious',
  'updated throughout',
  'turnkey',
] as const;

/** AI-filler vocabulary that signals machine-generated copy. */
export const BANNED_AI_FILLER: readonly string[] = [
  'delve',
  'leverage',
  'tapestry',
  'navigate',
  'robust',
  'seamless',
  'comprehensive',
  'elevate',
  'unlock',
] as const;

/** Number-hedging words that substitute for actual data. */
export const BANNED_HEDGES: readonly string[] = ['approximately', 'roughly'] as const;

/** Punctuation strictly forbidden in VO scripts (per brand-system.md 4.3). */
export const BANNED_PUNCTUATION: readonly string[] = ['—', ';', '!'] as const;

/** Combined banned word list for grep-style validation. */
export const BANNED_WORDS: readonly string[] = [
  ...BANNED_REAL_ESTATE,
  ...BANNED_AI_FILLER,
  ...BANNED_HEDGES,
] as const;

/** Compiled regex matching any banned word, case-insensitive, word-boundary. */
export const BANNED_WORDS_REGEX = new RegExp(
  '\\b(' + BANNED_WORDS.map(escapeRegex).join('|') + ')\\b',
  'gi',
);

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** All banned tokens (words + punctuation) found in `text`, in source order. */
export function findBannedTokens(text: string): string[] {
  const out: string[] = [];
  for (const punct of BANNED_PUNCTUATION) {
    if (text.includes(punct)) out.push(punct);
  }
  const wordMatches = text.match(BANNED_WORDS_REGEX);
  if (wordMatches) out.push(...wordMatches);
  return out;
}

// ---------------------------------------------------------------------------
// Number → spoken words (ElevenLabs ingestion)
// ---------------------------------------------------------------------------

const ONES = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
  'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen',
  'sixteen', 'seventeen', 'eighteen', 'nineteen',
];

const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

function intToWords(n: number): string {
  if (n < 0) return `negative ${intToWords(-n)}`;
  if (n < 20) return ONES[n]!;
  if (n < 100) {
    const t = Math.floor(n / 10);
    const r = n % 10;
    return r === 0 ? TENS[t]! : `${TENS[t]} ${ONES[r]}`;
  }
  if (n < 1000) {
    const h = Math.floor(n / 100);
    const r = n % 100;
    return r === 0 ? `${ONES[h]} hundred` : `${ONES[h]} hundred ${intToWords(r)}`;
  }
  if (n < 1_000_000) {
    const k = Math.floor(n / 1000);
    const r = n % 1000;
    const head = `${intToWords(k)} thousand`;
    return r === 0 ? head : `${head} ${intToWords(r)}`;
  }
  if (n < 1_000_000_000) {
    const m = Math.floor(n / 1_000_000);
    const r = n % 1_000_000;
    const head = `${intToWords(m)} million`;
    return r === 0 ? head : `${head} ${intToWords(r)}`;
  }
  // Very large numbers shouldn't appear in market reports.
  return n.toString();
}

/**
 * Spell out a number for ElevenLabs ingestion. Drops decimals beyond two
 * places. Negative numbers prefixed with "negative".
 *
 *   725000  -> "seven hundred twenty five thousand"
 *   2.1     -> "two point one"
 *   97.1    -> "ninety seven point one"
 */
export function spellNumber(n: number): string {
  if (!Number.isFinite(n)) return 'unavailable';
  const intPart = Math.trunc(n);
  const head = intToWords(intPart);
  const decimal = Math.abs(n) - Math.abs(intPart);
  if (decimal === 0) return head;
  // Two-decimal precision is plenty for currency / pct.
  const decimalStr = (Math.round(decimal * 100) / 100).toFixed(2).split('.')[1] ?? '';
  const trimmed = decimalStr.replace(/0+$/, '');
  if (trimmed === '') return head;
  const digits = trimmed
    .split('')
    .map((d) => ONES[parseInt(d, 10)])
    .join(' ');
  return `${head} point ${digits}`;
}

/** Spell a currency amount, e.g. 725000 -> "seven hundred twenty five thousand dollars". */
export function spellDollars(n: number): string {
  if (!Number.isFinite(n)) return 'an unknown amount';
  return `${spellNumber(Math.round(n))} dollars`;
}

/**
 * Replace every numeric literal in a string with its spelled-out equivalent.
 * Handles $725,000 / 725K / 12 days / 2.1% formats.
 */
export function spellNumbersInLine(line: string): string {
  return line
    // $725K / $1.5M / $1,075,000
    .replace(/\$(\d{1,3}(?:,\d{3})*(?:\.\d+)?)(K|M)?/g, (_, raw, suffix) => {
      const base = parseFloat(raw.replace(/,/g, ''));
      const mult = suffix === 'M' ? 1_000_000 : suffix === 'K' ? 1_000 : 1;
      return spellDollars(base * mult);
    })
    // 2.1%
    .replace(/(-?\d+(?:\.\d+)?)\s*%/g, (_, raw) => `${spellNumber(parseFloat(raw))} percent`)
    // 12 days / 188 sales / 412 active
    .replace(/(\d+(?:\.\d+)?)\s+(days?|months?|sales?|active|pending|closed|listings?)/gi,
      (_, raw, unit) => `${spellNumber(parseFloat(raw))} ${unit}`)
    // bare numeric tail like "2026" — leave the year alone (4-digit) but spell isolated 1-3 digit ints
    .replace(/\b(\d{1,3})\b/g, (_, raw) => spellNumber(parseInt(raw, 10)));
}

// ---------------------------------------------------------------------------
// IPA phoneme tagging for place names
// ---------------------------------------------------------------------------

/** IPA pronunciations for Central Oregon place names that ElevenLabs mangles. */
export const PHONEME_MAP: Readonly<Record<string, string>> = {
  Deschutes: 'dəˈʃuːts',
  Tumalo: 'ˈtuː.mə.loʊ',
  Tetherow: 'ˈtɛð.ə.roʊ',
  Awbrey: 'ˈɔ.bri',
  Terrebonne: 'ˈtɛə.rə.boʊn',
};

/**
 * Wrap each known place name in a `<phoneme>` tag with its IPA pronunciation.
 * Uses the eleven_v3-compatible SSML-ish syntax. Idempotent — running twice
 * does not double-wrap.
 */
export function tagPhonemes(line: string): string {
  let out = line;
  for (const [name, ipa] of Object.entries(PHONEME_MAP)) {
    // Skip if already wrapped.
    const taggedRe = new RegExp(`<phoneme[^>]*>${escapeRegex(name)}</phoneme>`, 'g');
    if (taggedRe.test(out)) continue;
    const wordRe = new RegExp(`\\b${escapeRegex(name)}\\b`, 'g');
    out = out.replace(wordRe, `<phoneme alphabet="ipa" ph="${ipa}">${name}</phoneme>`);
  }
  return out;
}

// ---------------------------------------------------------------------------
// VO sentence sanitizer — strip em-dashes, semicolons, exclamation marks
// ---------------------------------------------------------------------------

/** Replace em-dashes with periods; semicolons with periods; drop exclamations. */
export function sanitizePunctuation(line: string): string {
  return line
    .replace(/—/g, '.')
    .replace(/;/g, '.')
    .replace(/!/g, '.')
    .replace(/\.{2,}/g, '.')
    .replace(/\s+\./g, '.');
}
