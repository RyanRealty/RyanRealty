/**
 * Local ESLint plugin: rr-brand-voice
 *
 * Single rule `no-violations` blocks the brand-voice §6.1 + §6.2 hard
 * fails from appearing in JSX text and string-literal JSX attribute
 * values. Canonical source for the banned set:
 *
 *   marketing_brain_skills/brand-voice/voice_guidelines.md §6.1 + §6.2
 *   CLAUDE.md §3 (Brand Voice — ABSOLUTE)
 *
 * What gets flagged:
 *   - Em-dash (U+2014) and en-dash (U+2013) in body prose
 *   - Semicolon (;) and exclamation mark (!) in body prose
 *   - Every §6.2 banned word (real-estate clichés, AI filler, vague
 *     qualifiers) matched case-insensitively on word boundaries
 *
 * Allowed exception:
 *   - A standalone em-dash whose trimmed text is exactly "—" — that's
 *     the canonical data-placeholder pattern used in stats tables to
 *     mean "unavailable" (CLAUDE.md §3 + voice_guidelines.md §6.1).
 *
 * Scope:
 *   - JSXText nodes (text between JSX tags)
 *   - String / template literals used as JSX attribute values
 *   - String / template literals rendered inside JSX expression
 *     containers ({"text in jsx"}) — same effective body prose
 *
 *   NOT scanned: regular code comments, identifiers, non-JSX string
 *   literals in JS/TS. Those are not user-facing per CLAUDE.md §3.
 *
 * Output format: one ESLint error per banned token, message names the
 * specific violation so the fix is obvious.
 */

'use strict'

// ─── Banned punctuation ───────────────────────────────────────────────

const PUNCTUATION = [
  { char: '—', label: 'em-dash (U+2014)', advice: 'Replace with a period or comma.' },
  { char: '–', label: 'en-dash (U+2013)', advice: 'Replace with a period or comma.' },
  { char: ';', label: 'semicolon', advice: 'Replace with a period.' },
  { char: '!', label: 'exclamation mark', advice: 'Drop or rephrase. Body prose is exclamation-free.' },
]

// ─── §6.2 banned words (canonical list, do not reorder lightly) ───────

const CLICHES = [
  'stunning', 'breathtaking', 'gorgeous', 'charming', 'pristine', 'nestled',
  'boasts', 'must-see', 'dream home', 'meticulously maintained',
  "entertainer's dream", 'tucked away', 'hidden gem', 'truly', 'spacious',
  'cozy', 'luxurious', 'updated throughout', 'turnkey', 'immaculate',
  'captivating', 'exquisite',
]

const AI_FILLER = [
  'delve', 'leverage', 'tapestry', 'navigate', 'robust', 'seamless',
  'comprehensive', 'elevate', 'unlock', 'holistic', 'dynamic', 'vibrant',
  'bustling', 'eclectic', 'curated', 'bespoke', 'foster',
]

const VAGUE_QUALIFIERS = [
  'approximately', 'roughly', 'about', 'around', 'fairly', 'somewhat',
]

const BANNED_WORDS = [
  ...CLICHES.map((w) => ({ word: w, category: 'real-estate cliché' })),
  ...AI_FILLER.map((w) => ({ word: w, category: 'AI filler' })),
  ...VAGUE_QUALIFIERS.map((w) => ({ word: w, category: 'vague qualifier' })),
]

// Escape regex metachars then build a single regex per word with
// word-boundary anchors. `\b` is ASCII-only but every banned token here
// starts and ends with [a-z'-] which behaves correctly under `\b`.
function bannedWordRegex(word) {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(^|[^a-zA-Z'-])${escaped}([^a-zA-Z'-]|$)`, 'i')
}

const BANNED_WORD_REGEXES = BANNED_WORDS.map(({ word, category }) => ({
  word,
  category,
  re: bannedWordRegex(word),
}))

// ─── Helpers ──────────────────────────────────────────────────────────

function isDataPlaceholder(text) {
  return text.trim() === '—'
}

function scanText(text, report, node) {
  if (typeof text !== 'string') return
  if (isDataPlaceholder(text)) return
  for (const { char, label, advice } of PUNCTUATION) {
    if (text.includes(char)) {
      report({
        node,
        messageId: 'punctuation',
        data: { label, advice, snippet: snippetAround(text, char) },
      })
    }
  }
  for (const { word, category, re } of BANNED_WORD_REGEXES) {
    if (re.test(text)) {
      report({
        node,
        messageId: 'bannedWord',
        data: { word, category, snippet: snippetAround(text, word) },
      })
    }
  }
}

function snippetAround(text, needle) {
  const compact = text.replace(/\s+/g, ' ').trim()
  if (compact.length <= 80) return compact
  const idx = compact.toLowerCase().indexOf(needle.toLowerCase())
  if (idx < 0) return compact.slice(0, 80) + '…'
  const start = Math.max(0, idx - 20)
  const end = Math.min(compact.length, idx + needle.length + 20)
  return (start > 0 ? '…' : '') + compact.slice(start, end) + (end < compact.length ? '…' : '')
}

function isInsideJsx(node) {
  let p = node.parent
  while (p) {
    if (p.type === 'JSXElement' || p.type === 'JSXFragment' || p.type === 'JSXAttribute') return true
    p = p.parent
  }
  return false
}

// ─── Rule ─────────────────────────────────────────────────────────────

const rule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Block brand-voice §6.1 + §6.2 hard fails (em-dash, en-dash, semicolon, exclamation, banned words) in JSX text and string-literal JSX attribute values.',
    },
    schema: [],
    messages: {
      punctuation:
        'Brand voice §6.1: banned {{label}} in user-facing JSX text. {{advice}} Found: "{{snippet}}".',
      bannedWord:
        'Brand voice §6.2: banned {{category}} "{{word}}" in user-facing JSX text. Found: "{{snippet}}".',
    },
  },

  create(context) {
    const report = (descriptor) => context.report(descriptor)

    return {
      JSXText(node) {
        scanText(node.value, report, node)
      },

      // String literal as a JSX attribute value: `placeholder="…"`,
      // `aria-label="…"`, etc. Filter to attribute parents only — bare
      // string literals in JS code are not user-facing.
      Literal(node) {
        if (typeof node.value !== 'string') return
        if (!node.parent) return

        if (node.parent.type === 'JSXAttribute') {
          scanText(node.value, report, node)
          return
        }

        // String inside `{"…"}` rendered as JSX child.
        if (
          node.parent.type === 'JSXExpressionContainer' &&
          isInsideJsx(node.parent)
        ) {
          scanText(node.value, report, node)
        }
      },

      // Template literal as JSX child or attribute value. Only flag the
      // static `quasis` parts — interpolated expressions can be runtime
      // data placeholders (a dash served from the API to mean
      // unavailable is fine).
      TemplateLiteral(node) {
        if (!node.parent) return
        const parentIsJsxChild =
          node.parent.type === 'JSXExpressionContainer' && isInsideJsx(node.parent)
        const parentIsJsxAttr = node.parent.type === 'JSXAttribute'
        if (!parentIsJsxChild && !parentIsJsxAttr) return
        for (const q of node.quasis) {
          scanText(q.value.cooked ?? q.value.raw, report, q)
        }
      },
    }
  },
}

// ─── Plugin export (flat-config shape) ────────────────────────────────

module.exports = {
  meta: { name: 'rr-brand-voice', version: '1.0.0' },
  rules: {
    'no-violations': rule,
  },
}
