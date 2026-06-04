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
 * Scope (only surfaces a person actually reads, per CLAUDE.md §3):
 *   - JSXText nodes (text between JSX tags)
 *   - Human-readable JSX attributes ONLY: alt, title, placeholder,
 *     label, summary, aria-label / aria-description / etc.
 *   - String / template literals rendered inside JSX expression
 *     containers ({"text in jsx"}) — same effective body prose
 *
 *   NOT scanned: code comments, identifiers, non-JSX string literals,
 *   non-readable attributes (className, style, allow, href, src, id,
 *   role, type …), and the body of <script> / <Script> elements (that
 *   is JavaScript — analytics pixels, JSON-LD — whose semicolons and
 *   exclamation marks are syntax, not prose). None of these are
 *   user-facing per CLAUDE.md §3.
 *
 * Output format: one ESLint error per banned token, message names the
 * specific violation so the fix is obvious.
 */

'use strict'

// Banned vocabulary loaded from the single source of truth at
// scripts/brand-voice-vocabulary.cjs. Both this ESLint rule and the
// CI script scripts/check-brand-voice.mjs consume the same module so
// the lists cannot drift apart. See feedback memory entry for
// `no-adhoc-sql` and the G20 gate (data-access vocabulary discipline).

const VOCAB = require('../scripts/brand-voice-vocabulary.cjs')
const { PUNCTUATION, BANNED_WORDS } = VOCAB

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

// Attributes whose string value is genuinely read by a person — visible
// text or assistive-tech labels. Brand voice applies to these. Every
// other attribute (className, style, allow, href, src, id, role, type,
// rel, target, name …) is code, not prose, and must NOT be scanned.
// CLAUDE.md §3: only what a client or member of the public could read is
// governed.
const HUMAN_READABLE_ATTRS = new Set([
  'alt',
  'title',
  'placeholder',
  'label',
  'summary',
  'aria-label',
  'aria-description',
  'aria-placeholder',
  'aria-roledescription',
  'aria-valuetext',
])

function attrName(jsxAttributeNode) {
  const n = jsxAttributeNode && jsxAttributeNode.name
  return n && n.type === 'JSXIdentifier' ? n.name : null
}

function isHumanReadableAttr(jsxAttributeNode) {
  return HUMAN_READABLE_ATTRS.has(attrName(jsxAttributeNode))
}

// True when the node sits inside a <script>, <Script>, or <style>
// element. The body of those is code — JavaScript (analytics pixels,
// JSON-LD) or CSS (keyframes, custom properties, scoped page styles) —
// not prose. Its semicolons, em-dashes, and exclamation marks are
// syntax, not brand-voice misses.
function isInsideCodeElement(node) {
  let p = node.parent
  while (p) {
    if (p.type === 'JSXElement' && p.openingElement) {
      const name = p.openingElement.name
      const tag =
        name && name.type === 'JSXIdentifier'
          ? name.name
          : name && name.type === 'JSXMemberExpression' && name.property
            ? name.property.name
            : null
      if (tag === 'script' || tag === 'Script' || tag === 'style') return true
    }
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
        if (isInsideCodeElement(node)) return
        scanText(node.value, report, node)
      },

      // String literal as a JSX attribute value. Only scan attributes a
      // person actually reads (alt, title, placeholder, aria-*). className,
      // allow, href, style, id, etc. are code, not prose — skip them.
      Literal(node) {
        if (typeof node.value !== 'string') return
        if (!node.parent) return

        if (node.parent.type === 'JSXAttribute') {
          if (isHumanReadableAttr(node.parent)) scanText(node.value, report, node)
          return
        }

        // String inside `{"…"}` rendered as JSX child — visible prose,
        // unless it sits inside a <script> block (then it is JS).
        if (
          node.parent.type === 'JSXExpressionContainer' &&
          isInsideJsx(node.parent)
        ) {
          if (isInsideCodeElement(node)) return
          scanText(node.value, report, node)
        }
      },

      // Template literal as JSX child or human-readable attribute value.
      // Only flag the static `quasis` parts — interpolated expressions can
      // be runtime data placeholders (a dash served from the API to mean
      // unavailable is fine).
      TemplateLiteral(node) {
        if (!node.parent) return
        const parentIsJsxChild =
          node.parent.type === 'JSXExpressionContainer' && isInsideJsx(node.parent)
        const parentIsJsxAttr = node.parent.type === 'JSXAttribute'
        if (!parentIsJsxChild && !parentIsJsxAttr) return
        if (parentIsJsxAttr && !isHumanReadableAttr(node.parent)) return
        if (parentIsJsxChild && isInsideCodeElement(node)) return
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
