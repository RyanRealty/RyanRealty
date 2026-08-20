#!/usr/bin/env node
/**
 * check-brand-voice.mjs
 *
 * Scans public copy for the three things VOICE.md gates mechanically: the
 * "Value my home" CTA phrasings, the virtues we may not claim for ourselves,
 * and em/en dashes inside authored prose. Copy is read from string literals
 * AND JSX text children, so a sentence written between tags is caught too.
 *
 * WHAT COUNTS AS PUBLIC COPY (the scope block below is the authority, and
 * scripts/__tests__/brand-voice-scope.test.mjs pins it): every .ts/.tsx/.js/.jsx
 * file under app/ and components/ minus the internal surfaces, plus the page
 * registries in data/ and lib/*-content.ts. The extension has never mattered —
 * a .ts data module is scanned exactly like a .tsx component.
 *
 * Banned vocabulary canonical source: marketing_brain_skills/brand-voice/VOICE.md
 * The virtue list is PARSED from that file at startup, so narrowing the machine
 * list without editing the canon fails this gate on itself.
 *
 * Modes:
 *   node scripts/check-brand-voice.mjs                 → check against baseline, exit 1 if violations INCREASED
 *   node scripts/check-brand-voice.mjs --write-baseline → snapshot current state to scripts/brand-voice-baseline.json
 *   node scripts/check-brand-voice.mjs --report         → human-readable report, never exits 1
 */

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs'
import { join, relative, sep, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'
import { createRequire } from 'node:module'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT = join(__dirname, '..')
const BASELINE_PATH = join(ROOT, 'scripts/brand-voice-baseline.json')

// Single source of truth for the banned vocabulary, shared with the
// ESLint plugin at eslint-rules/no-brand-voice-violations.js. Test
// scripts/__tests__/brand-voice-vocabulary.test.cjs verifies parity.
const require = createRequire(import.meta.url)
const VOCAB = require('./brand-voice-vocabulary.cjs')
const ts = require('typescript')

// WHY lib/ IS NOT HERE, measured 2026-08-06 rather than assumed.
//
// VOICE.md governs email bodies, SMS bodies and listing alerts, which live in
// lib/crm, lib/email and lib/alerts — so this scan looks like it has a hole,
// and the obvious fix is to widen it. I tried. Adding lib/ wholesale reports
// 305 violations; excluding colocated test files (see TEST_FILE below) brings
// that to 17; reading all 17 shows they are code comments, a regex literal, an
// admin validation hint, and internal health diagnostics. Not one is copy a
// lead reads.
//
// The reason is structural. This scanner extracts string literals and assumes
// most of them are reader-facing, which holds in app/ and components/ and does
// not hold in lib/, where literals are overwhelmingly logs, errors and
// developer prose. Widening the scan would trade a precise gate for a noisy
// one, and a noisy gate gets ignored.
//
// Send-path copy IS gated, by different machinery: ci:voice-constructions
// sweeps the whole repo including lib/, and lib/voice/check.ts hard-fails at
// runtime on all five send paths (ci:voice-send-paths). What was missing was
// never a gate — it was that nobody had READ that copy against the canon. That
// read happened 2026-08-06.
//
// PUBLIC COPY REGISTRIES, added 2026-08-19, and why they are named rather than
// swept. A reviewer reported this gate blind to "copy that lives in .ts data
// modules", citing app/cities/[slug]/_v3/city-market-charts-data.ts. That file
// was already covered: FILE_EXTS has always held '.ts', so every .ts module
// under app/ and components/ is scanned exactly like a .tsx one (probe: a
// "What's my home worth" literal and an em-dash prose sentence appended to that
// exact file both fail the gate). The premise was wrong; the defect class was
// not.
//
// The real hole is one directory over. A page's prose does not all live under
// app/. The city, community, resort, lead-landing, event, park, trail, venue,
// school and golf pages render their sentences from registries in data/ and
// lib/*-content.ts, and NONE of those were scanned. That is public copy — the
// same sentences, one import away — sitting outside the gate.
//
// Scope is drawn by measurement, not by instinct:
//   data/**            17 .ts registry modules, every one of them page copy.
//                      Adds 0 violations today: the 35 dashes in them are all
//                      inside /** */ and // comments, which the scanner strips.
//   lib/**/*-content.ts  the 5 named content registries. -content.ts is the
//                      repo's existing name for a public registry, and
//                      ci:voice-constructions already documents data/ and the
//                      lib/ content registries as public-copy surfaces. This
//                      widening makes the two gates agree on what is public.
//
// lib/ WHOLESALE STAYS OUT, re-measured 2026-08-19 rather than inherited. The
// number quoted for this decision was 305, taken 2026-08-06 against a much
// larger vocabulary; D11 has emptied most of those lists since, so the figure
// was stale the moment it became the justification. Today lib/ as a whole
// reports 170 violations across 69 files, and the top of that list is agent
// prompts, LLM instructions, pipeline diagnostics, and 12 hits inside
// lib/brand-voice/generated-vocabulary.ts — the rule mirror flagging itself for
// containing the rules. The conclusion survived the re-measurement: a gate whose
// output is mostly developer prose is a gate people learn to override. Named
// scope, not a sweep.
const SCAN_DIRS = ['app', 'components', 'data']

// Files outside SCAN_DIRS that are public copy by naming convention. Matched
// against the repo-relative path so a new lib/<surface>-content.ts is covered
// the day it is written, not the day someone remembers this list.
const PUBLIC_COPY_FILE = /^lib\/(?:[^/]+\/)*[^/]*-content\.ts$/

// PUBLIC COPY THAT LIVES INSIDE ONE FUNCTION, added 2026-08-19.
//
// Some client-facing sentences are not in a registry file at all: they are
// assembled inside a composer in a lib/ module that ALSO holds internal logs and
// queue plumbing. The file cannot be covered wholesale and the copy cannot be
// left uncovered, so scope is the FUNCTION BODY, resolved from the TypeScript
// AST. Literals outside the named function are not read.
//
// FOUND BY, and the reason this is not a hypothetical: composeCmaEmail builds
// the CMA delivery email in two parallel bodies, `text` and `html`. The html
// branch was rewritten to the canon; the text branch was not, and kept
// "The full report is attached — it walks through..." plus a second em-dash
// sentence, in an email a homeowner receives. Nothing could see it. This gate
// stopped at app/components/data, ci:voice-constructions checks sentence SHAPES
// and not punctuation, and ci:voice-send-paths lists lib/cma/build.ts (the
// report prose) but not the delivery email, so no runtime checkBrandVoice ran
// on the string that was actually sent.
//
// WHY NOT JUST ADD THE FILE. Measured today, not recalled: adding
// lib/cma-delivery.ts wholesale costs one more baseline entry for
// `no assigned broker email available — review needed in admin queue`, an
// internal errors[] row bound for the admin queue. Baselines only shrink, and
// rewriting an internal log to satisfy a public-copy gate is the move that
// makes a gate feel arbitrary and gets it switched off. Function scope keeps
// the client sentences gated and leaves the log alone.
const PUBLIC_COPY_FUNCTIONS = [
  {
    file: 'lib/cma-delivery.ts',
    fn: 'composeCmaEmail',
    why: 'subject + body of the CMA delivery email a homeowner receives',
  },
]
const PUBLIC_COPY_FUNCTION_FILES = new Map()
for (const entry of PUBLIC_COPY_FUNCTIONS) {
  const forFile = PUBLIC_COPY_FUNCTION_FILES.get(entry.file) ?? []
  forFile.push(entry.fn)
  PUBLIC_COPY_FUNCTION_FILES.set(entry.file, forFile)
}

const EXCLUDED_DIRS = new Set(['node_modules', '.next', 'out', 'build', 'dist', '__tests__'])
const FILE_EXTS = new Set(['.ts', '.tsx', '.js', '.jsx'])

// A colocated `foo.test.ts` is not copy. Only `__tests__/` was excluded, which
// held while the scan was app + components (tests there live in __tests__), and
// breaks the moment the scan widens: measured 2026-08-06, adding lib/ surfaced
// 305 "violations" that were overwhelmingly em-dashes inside test NAMES. A gate
// that reports a test description as a brand-voice failure is a gate nobody
// reads.
const TEST_FILE = /\.(test|spec)\.[cm]?[jt]sx?$/

// Banned words sourced from scripts/brand-voice-vocabulary.cjs so this
// list and the ESLint rule's list cannot drift. Modify lists THERE,
// not here. The full canonical reference is CLAUDE.md §3.
const BANNED_WORDS = VOCAB.BANNED_WORD_STRINGS

// PROJECTION CHECK — the canon reaching the machine list, verified.
//
// The vocabulary file's contract was only ever enforced in one direction: a word
// is banned here only because VOICE.md bans it. The reverse — every word VOICE.md
// bans arriving here — was enforced by nobody, so four of the canon's six
// self-praise terms were never projected and `lead="Honest answers to the
// questions Bend buyers and sellers ask us"` shipped live on /faq while this gate
// reported clean (Matt, 2026-08-06). A gate that is green for the wrong reason is
// worse than no gate, because it is trusted.
//
// This runs before any file is scanned: if a canon term has no covering phrasing,
// the gate fails on itself rather than silently under-enforcing.
// VOICE.md > "Never name the virtues" — the phrasings that claim a virtue for
// us. Read from the vocabulary module, never typed here (ci:voice-vocab-parity).
const SELF_PRAISE = VOCAB.SELF_PRAISE ?? []
const ALL_BANNED_PHRASES = [...BANNED_WORDS, ...SELF_PRAISE]

for (const { canon, covered } of VOCAB.PROJECTION_REQUIRED ?? []) {
  if (!ALL_BANNED_PHRASES.some((w) => w.includes(covered))) {
    console.error(
      `\n✖ brand-voice vocabulary is out of sync with the canon.\n` +
        `  VOICE.md bans "${canon}", and the phrasing that projects it ` +
        `("${covered}") is missing from scripts/brand-voice-vocabulary.cjs.\n` +
        `  Add it to WORTH_CTA, or correct PROJECTION_REQUIRED if the canon changed.\n`
    )
    process.exit(1)
  }
}

// THE GUARD READS THE CANON, not a hand-copied mirror of it (2026-08-19).
//
// PROJECTION_REQUIRED above is an array a person maintains, so it proves
// nothing against the one edit that actually breaks projection: narrowing the
// canon's coverage and the guard's expectations in the SAME commit. That is
// exactly what happened at D11 (0ad6a0c2) — SELF_PRAISE went to [] and
// PROJECTION_REQUIRED lost its six virtue entries together, and the gate stayed
// green while VOICE.md still said "Do not call ourselves authentic, genuine,
// honest, simple, transparent, trusted, dedicated". Second recurrence of the
// /faq failure, same mechanism.
//
// So the virtue list is parsed out of VOICE.md itself. Narrowing the machine
// list now fails here; the only way to un-ban a virtue is to edit the canon,
// which is where that argument belongs. A canon rewrite that drops the anchor
// sentence fails loudly rather than silently passing.
const VOICE_MD_PATH = join(ROOT, 'marketing_brain_skills/brand-voice/VOICE.md')
const VIRTUE_SENTENCE = /Do not call ourselves\s+([^.]+?)\s*,?\s*or any other virtue/i

// VOICE.md > "About mission (the one exception)": this exact sentence may
// appear on About. Nowhere else uses authentic / exceptional as a claim about
// us, so the carve-out is the SENTENCE, not the words.
const ABOUT_MISSION = VOCAB.ABOUT_MISSION_SENTENCE ?? ''

function canonVirtueWords(canonText) {
  const m = canonText.match(VIRTUE_SENTENCE)
  if (!m) return null
  return m[1]
    .split(',')
    .map((w) => w.trim().toLowerCase())
    .filter((w) => /^[a-z]+$/.test(w))
}

function assertCanonProjection() {
  if (!existsSync(VOICE_MD_PATH)) {
    console.error(
      `\n✖ brand-voice canon not found at marketing_brain_skills/brand-voice/VOICE.md.\n` +
        `  This gate projects that file. It does not run without it.\n`
    )
    process.exit(1)
  }
  const canonText = readFileSync(VOICE_MD_PATH, 'utf8')

  const virtues = canonVirtueWords(canonText)
  if (!virtues || virtues.length === 0) {
    console.error(
      `\n✖ brand-voice canon anchor missing.\n` +
        `  This gate finds the banned virtues by reading the sentence\n` +
        `  "Do not call ourselves <words>, or any other virtue." in VOICE.md,\n` +
        `  and that sentence no longer parses. Re-anchor VIRTUE_SENTENCE in\n` +
        `  scripts/check-brand-voice.mjs against the rewritten canon.\n`
    )
    process.exit(1)
  }

  const missing = virtues.filter((v) => !SELF_PRAISE.some((p) => p.includes(v)))
  if (missing.length > 0) {
    console.error(
      `\n✖ brand-voice vocabulary is out of sync with the canon.\n` +
        `  VOICE.md bans calling ourselves ${missing.map((v) => `"${v}"`).join(', ')}, ` +
        `and no phrasing in SELF_PRAISE carries ${missing.length === 1 ? 'that word' : 'those words'}.\n` +
        `  Add the phrasing to SELF_PRAISE in scripts/brand-voice-vocabulary.cjs.\n` +
        `  Un-banning a virtue is a canon edit, not a vocabulary edit.\n`
    )
    process.exit(1)
  }

  // The About-mission carve-out below is only legitimate while the canon still
  // grants it. If that exception is ever withdrawn, the exemption dies with it.
  if (ABOUT_MISSION && !canonText.includes(ABOUT_MISSION)) {
    console.error(
      `\n✖ brand-voice About-mission exemption no longer matches the canon.\n` +
        `  ABOUT_MISSION_SENTENCE in scripts/brand-voice-vocabulary.cjs is not\n` +
        `  present verbatim in VOICE.md, so the carve-out is exempting a\n` +
        `  sentence the canon does not permit. Re-copy it, or delete it.\n`
    )
    process.exit(1)
  }
}

// The canon grants the mission sentence to ONE page: "This sentence may appear
// on About". Scoping the carve-out to app/about/ is what makes the next clause
// ("Nowhere else uses authentic / exceptional as a claim about us") mechanical
// rather than honour-system — the same sentence pasted onto /sell or a listing
// page is a violation, and now fails.
const ABOUT_SURFACE = 'app/about/'

function findSelfPraiseViolations(value, lineNum, snippet, relPath) {
  if (ABOUT_MISSION && value.includes(ABOUT_MISSION) && (relPath ?? '').startsWith(ABOUT_SURFACE)) {
    return []
  }
  const out = []
  for (const phrase of SELF_PRAISE) {
    // Word-boundary matched, not substring: a plain `includes` reports
    // "a dishonest broker" as us claiming to be an honest broker, and a gate
    // that flags the opposite of the sin is one people learn to override.
    if (selfPraiseRe(phrase).test(value)) {
      out.push({ word: `Never name the virtues: "${phrase}"`, line: lineNum, snippet })
    }
  }
  return out
}

const SELF_PRAISE_RE_CACHE = new Map()
function selfPraiseRe(phrase) {
  let re = SELF_PRAISE_RE_CACHE.get(phrase)
  if (!re) {
    re = new RegExp(`\\b${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')
    SELF_PRAISE_RE_CACHE.set(phrase, re)
  }
  return re
}

assertCanonProjection()

// SCOPE — our language only (VOICE.md): the laws bind Ryan Realty's own
// authored marketing copy. Reviews/testimonials and broker-written listing
// remarks render from DATA (variables), never literals, so they are never
// scanned and never rewritten. The gate sees only sentences we typed in.
// VOICE.md "banned moves" — regex patterns for the law-breaking sentences that
// contain no banned word (self-virtue, warmth filler, category self-naming).
// Compiled once; run case-insensitively against each user-facing literal.
const BANNED_PATTERNS = (VOCAB.BANNED_PATTERNS ?? []).map((p) => ({
  law: p.law,
  label: p.label,
  re: new RegExp(p.source, 'i'),
}))

// PUNCTUATION (wired 2026-08-02). D11 bans em dash, en dash, semicolon, and
// `!` in public prose. VOCAB.PUNCTUATION is the source. This scanner enforces
// em dash and en dash in authored sentences. Semicolon and `!` stay in the
// runtime check (lib/voice/check.ts) because they are also code punctuation.
//
// SCOPE — em dash and en dash ONLY, deliberately not all four entries:
//
//   semicolon      String literals in app/ and components/ are full of CSS and
//                  SVG, where ';' is SYNTAX ("display:none;color:red", style
//                  strings, path data). A blanket ban flags those as prose and
//                  drowns the real signal. §2 bans it in BODY PROSE, which this
//                  scanner cannot reliably separate from a style string.
//   exclamation    D11 bans `!` in public prose. A literal-level gate here
//                  would also flag code ('!important', '!='), so `!` stays
//                  in the runtime check, not this file scanner.
//
// Both remain enforced by human review per §2. Encoding them here would trade a
// real gate for a noisy one. The two dashes have no legitimate use in authored
// UI prose, so they gate cleanly at the literal level.
const BANNED_PUNCTUATION = (VOCAB.PUNCTUATION ?? []).filter((p) => p.char === '—' || p.char === '–')

// EXEMPTIONS. Each one is carved out by §2 itself or falls outside what §2
// governs. Without them this check flags legitimate output and the "fix" makes
// the product worse ("$300K – $500K" does not improve as "$300K. $500K").
//
// 1. DATA PLACEHOLDER — §2, verbatim: "the em-dash is allowed as a literal data
//    placeholder for 'unavailable' in a stats table." In practice that is
//    `${beds ?? '—'}`, so the dash sits INSIDE a ${...} expression. Stripping
//    interpolations before testing removes exactly this class, and only this
//    class, because authored prose never lives inside an expression.
// 2. NUMERIC RANGE — a dash separating two values ("2–4 beds", "$300K – $500K",
//    "${start} – ${end}") is typography, not prose punctuation. §2's remedy
//    ("replace with a period or comma") is incoherent applied to a range, which
//    is the tell that ranges were never the target.
// 3. DEBUG OUTPUT — §2: "Internal-only text (… debugging logs …) is NOT
//    governed." Console strings are tagged "[scope] …" by convention here.
// 4. CLIENT REVIEWS — §2: the gate "never touches reviews, external quotes, or
//    broker-written listing remarks." Those are the client's words, not ours;
//    editing them would misquote a real person.
const REVIEW_DATA_FILES = new Set(['app/lp/seller-home-value/data.ts'])

const INTERPOLATION = /\$\{[^}]*\}/g
// A sentinel that cannot occur in authored source text. Deliberately NOT a
// space: RANGE_SEPARATOR includes this character in its class, and a space
// there would make ' — ' read as a range and silently exempt real prose.
// Written as an escape, not a literal control byte, so the file stays text.
const PLACEHOLDER_MARK = '\u0000'

function stripInterpolations(value) {
  return value.replace(INTERPOLATION, PLACEHOLDER_MARK)
}

// A dash is a range separator when both sides are values rather than words:
// a digit, a currency/scale marker, or an interpolated expression.
const RANGE_SEPARATOR = new RegExp(
  `[\\d%${PLACEHOLDER_MARK}KkMm)]\\s*[–—]\\s*[\\d$${PLACEHOLDER_MARK}]`,
)

function isDebugOutput(value) {
  return /^\s*\[[a-z0-9_-]+\]/i.test(value)
}

// 5. EMBEDDED CODE — <style>{`...`}</style> and inline <script>{`...`}</script>
//    bodies are template literals holding CSS or JS, so the scanner sees them
//    as one giant "string". Any dash in them lives in a CSS or JS comment,
//    which §2 explicitly does not govern ("code comments"). Detect by syntax
//    rather than by tag, since the literal is all the scanner has.
function isEmbeddedCode(value) {
  if (/@media|:root\b|var\(--|function\s*\(|window\.|document\./.test(value)) return true
  // A CSS rule block: a selector, braces, and at least one `prop: value;` pair.
  return /\{[^}]*[a-z-]+\s*:[^};]+;/i.test(value)
}

// 6. SEO METADATA — Matt, 2026-08-02: "We can have em dashes in page titles for
//    SEO and SEO where appropriate." A SERP title is not body prose; the dash is
//    a scannable separator between the page name and the brand/qualifier, and it
//    is what Google renders. This exempts the metadata VALUES only — title,
//    template, default, description, siteName — and only from the PUNCTUATION
//    rule. Banned words and the VOICE.md banned moves still apply to titles,
//    because "stunning" in a <title> is still "stunning".
const SEO_METADATA_ASSIGNMENT = /\b(title|template|default|description|siteName)\s*:\s*(`|'|")?$/

// 7. NOT PROSE A READER SEES — Matt, 2026-08-02: "The em dash rule only applies
//    to text users are reading on a page that might make it seem like it was
//    written by AI."
//
//    That is the WHY behind the rule, and it narrows it sharply. The em dash is
//    an AI tell inside a SENTENCE. It is not a tell in a short label, a field
//    separator, or an accessibility attribute, and banning it there produced
//    changes that made copy worse without making it less AI-looking.
//
//    Two mechanical consequences:
//
//    a) ATTRIBUTE VALUES (alt, aria-label, title=, placeholder) are read by a
//       screen reader or shown on hover, never as page prose.
//    b) SHORT LABELS AND SEPARATORS ("Bend — $755,000", "No MLS match — manual
//       CMA needed") are composition, not writing. A sentence long enough to
//       read as authored prose is the actual target.
const ATTRIBUTE_ASSIGNMENT = /\b(alt|aria-label|aria-describedby|placeholder|title)\s*=\s*[{('"`]*$/

// Sentence-shaped: enough total words to read as authored prose, and a real
// clause after the dash rather than a value.
//
// The sides are weighted differently on purpose. What reads as AI is the
// EXPANSION after the dash — "Central Oregon — where the high desert meets the
// mountains" has only two words in front of it and is still exactly the tell.
// What stays exempt is a separator, where the trailing side is a value rather
// than a clause: "Bend — $755,000", "Matt Ryan — Ryan Realty".
// Word counts alone cannot tell "Central Oregon — where the high desert meets
// the mountains" (the tell) from "Matt Ryan — Ryan Realty principal broker" (a
// label). Both are short-then-long. The discriminator is what the dash DOES:
//
//   AI tell   the sentence CONTINUES, so the next word is lowercase
//             "…live market data — not from a guess", "Central Oregon — where…"
//   label     a new VALUE starts, so it is capitalised or numeric
//             "Matt Ryan — Ryan Realty", "Awbrey Butte — 12 active listings"
//
// Requiring a lowercase continuation keeps separators out of the gate, which
// matters more than catching every last one: a false positive here is what
// produced the over-correction this rule change is undoing.
const PROSE_MIN_WORDS = 8
const PROSE_MIN_WORDS_AFTER = 4

function countWords(s) {
  return (s.trim().match(/[A-Za-z][A-Za-z'’-]*/g) ?? []).length
}

function isProseSentence(value, char) {
  if (countWords(value) < PROSE_MIN_WORDS) return false
  const parts = value.split(char)
  for (let i = 1; i < parts.length; i++) {
    const after = parts[i].trimStart()
    if (countWords(after) < PROSE_MIN_WORDS_AFTER) continue
    if (/^[a-z]/.test(after)) return true // clause continues -> authored prose
  }
  return false
}

// Metadata in this repo is frequently split across two lines:
//
//   description:
//     'Find your next home in Bend — pricing, photos, and live data.',
//
// so the assignment sits on the PREVIOUS line and a same-line-only check would
// miss it and flag the value as prose. `prevLineText` closes that.
function isSeoMetadataValue(lineText, value, prevLineText) {
  if (prevLineText && SEO_METADATA_ASSIGNMENT.test(prevLineText.trimEnd())) {
    // Current line must be just the literal, not code that happens to follow.
    if (/^\s*[`'"]/.test(lineText ?? '')) return true
  }
  if (!lineText) return false
  // The literal's own line, up to where the literal starts.
  const idx = lineText.indexOf(value.slice(0, 24))
  const prefix = idx > 0 ? lineText.slice(0, idx) : lineText
  return SEO_METADATA_ASSIGNMENT.test(prefix.trimEnd())
}

function isAttributeValue(lineText, value) {
  if (!lineText) return false
  const idx = lineText.indexOf(value.slice(0, 24))
  const prefix = idx > 0 ? lineText.slice(0, idx) : lineText
  return ATTRIBUTE_ASSIGNMENT.test(prefix.trimEnd())
}

function findPunctuationViolations(value, lineNum, snippet, relPath, lineText, prevLineText) {
  if (isSeoMetadataValue(lineText, value, prevLineText)) return []
  if (isAttributeValue(lineText, value)) return []
  if (relPath && REVIEW_DATA_FILES.has(relPath)) return []
  if (isDebugOutput(value)) return []
  if (isEmbeddedCode(value)) return []
  // The bare placeholder itself: <span>—</span>, or the '—' literal handed to a
  // formatter as the "unavailable" value. Nothing but dashes and space, so it
  // cannot be a sentence. This is the §2 carve-out in its most literal form.
  if (/^[\s–—]+$/.test(value)) return []

  const stripped = stripInterpolations(value)
  const out = []
  for (const p of BANNED_PUNCTUATION) {
    if (!stripped.includes(p.char)) continue // dash lived inside ${...}: placeholder
    // Remove every range-separator occurrence, then see if any dash survives.
    let residual = stripped
    let prev
    do {
      prev = residual
      residual = residual.replace(RANGE_SEPARATOR, PLACEHOLDER_MARK)
    } while (residual !== prev)
    if (!residual.includes(p.char)) continue
    // The rule targets an AI tell inside a SENTENCE. A short label or a
    // separator between two values is not what a reader clocks as machine
    // writing, so it is not a violation.
    if (!isProseSentence(residual, p.char)) continue
    out.push({ word: `${p.label} — ${p.advice}`, line: lineNum, snippet })
  }
  return out
}

// Exported for scripts/__tests__/brand-voice-punctuation.test.mjs. The
// exemptions below encode §2 carve-outs; a silent regression in one of them
// would either re-open the em-dash hole or start flagging legitimate output.
export {
  findPunctuationViolations,
  findSelfPraiseViolations,
  isEmbeddedCode,
  isDebugOutput,
  isProseSentence,
  stripInterpolations,
  functionScopeRanges,
  PUBLIC_COPY_FUNCTIONS,
}

function normalize(p) {
  return p.split(sep).join('/')
}

function* walk(dir) {
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return
  }
  for (const entry of entries) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (EXCLUDED_DIRS.has(entry.name)) continue
      yield* walk(full)
    } else if (entry.isFile()) {
      const ext = entry.name.slice(entry.name.lastIndexOf('.'))
      if (FILE_EXTS.has(ext) && !TEST_FILE.test(entry.name)) yield full
    }
  }
}

// Match anything inside a string literal (' " or `). We're not parsing JSX
// perfectly — we're catching the common case of user-visible text written as
// string literals. False positives in code comments are filtered below.
function extractStringLiterals(src) {
  const literals = []
  // Quick-and-dirty: scan for quotes and grab until matching quote, skip escaped.
  let i = 0
  while (i < src.length) {
    const ch = src[i]
    if (ch === '/' && src[i + 1] === '/') {
      // Skip line comment
      const eol = src.indexOf('\n', i)
      i = eol === -1 ? src.length : eol
      continue
    }
    if (ch === '/' && src[i + 1] === '*') {
      // Skip block comment
      const end = src.indexOf('*/', i + 2)
      i = end === -1 ? src.length : end + 2
      continue
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      const quote = ch
      const start = i
      i++
      while (i < src.length) {
        if (src[i] === '\\') {
          i += 2
          continue
        }
        if (src[i] === quote) {
          literals.push({ value: src.slice(start + 1, i), startIndex: start })
          i++
          break
        }
        // Template literal interpolation
        if (quote === '`' && src[i] === '$' && src[i + 1] === '{') {
          let depth = 1
          i += 2
          while (i < src.length && depth > 0) {
            if (src[i] === '{') depth++
            else if (src[i] === '}') depth--
            i++
          }
          continue
        }
        i++
      }
      continue
    }
    i++
  }
  return literals
}

// JSX TEXT CHILDREN — the slogan blind spot (added 2026-06-14). The literal
// scanner above only sees quoted strings; copy written as element children
// (<H2>Ready to work with us?</H2>, <Body>the whole brokerage is behind you</Body>)
// is invisible to it, which let a whole class of slogans ship past the gate.
// Parse with the TS compiler and collect JsxText nodes so banned words +
// VOICE.md moves are caught in element children too. A parse failure falls back
// to literal-only scanning (never throws the gate).
function extractJsxText(content) {
  const out = []
  let sf
  try {
    sf = ts.createSourceFile('scan.tsx', content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  } catch {
    return out
  }
  const visit = (node) => {
    if (node.kind === ts.SyntaxKind.JsxText) {
      const raw = node.getText(sf)
      if (raw.trim().length > 1) out.push({ value: raw, startIndex: node.getStart(sf) })
    }
    node.forEachChild(visit)
  }
  visit(sf)
  return out
}

// Byte ranges of the named functions in a PUBLIC_COPY_FUNCTIONS file, from the
// TS AST. Covers `function f()`, `export function f()`, and `const f = () =>`.
//
// Returns null when a name is not found, and the caller turns that into a gate
// FAILURE rather than an empty scan. A composer that gets renamed or split must
// not silently fall out of coverage — that is the same silent-under-enforcement
// mechanism this whole pass exists to close.
function functionScopeRanges(content, fnNames) {
  let sf
  try {
    sf = ts.createSourceFile('scan.tsx', content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  } catch {
    return null
  }
  const found = new Map()
  const visit = (node) => {
    let name = null
    if (ts.isFunctionDeclaration(node) && node.name) name = node.name.text
    else if (
      ts.isVariableDeclaration(node) &&
      node.name &&
      ts.isIdentifier(node.name) &&
      node.initializer &&
      (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))
    ) {
      name = node.name.text
    }
    if (name && fnNames.includes(name)) {
      found.set(name, { start: node.getStart(sf), end: node.getEnd() })
    }
    node.forEachChild(visit)
  }
  visit(sf)
  if (found.size !== fnNames.length) return null
  return [...found.values()]
}

// A string literal is a code-mechanical token when it appears as an
// import path (`from '<...>'`) or as the argument to `require()` or
// `import()`. Those are NOT user-facing prose and matching banned
// words inside them is a false positive (the canonical example is
// `import dynamic from 'next/dynamic'` flagging the AI-filler word
// "dynamic"). Skip them.
const IMPORT_PATH_LINE = /(^|\s)(from|import\s*\(|require\s*\()\s*['"`]/

// Framework-mechanical string VALUES that are not prose. The canonical case is
// the Next.js route-segment-config `export const dynamic = 'force-dynamic'` —
// the literal 'force-dynamic' contains the banned AI-filler word "dynamic", but
// it is a Next.js API value, never user-visible copy. Matching it is a false
// positive (it inflated the baseline across every force-dynamic admin page).
// Files whose PURPOSE is voice enforcement embed the banned-word lexicon
// itself (regexes, LLM prompt rules listing the banned words). Every hit in
// them is a meta-reference, not prose — skip the whole file.
const LEXICON_FILES = new Set([])

const MECHANICAL_LITERALS = new Set([
  'force-dynamic',
  'force-static',
  'force-cache',
  'force-no-store',
])

// PUBLIC-FACING ONLY (Matt directive 2026-06-13: "I'm only looking at content
// that's public facing. If it's within the code, I'm not concerned — it's
// really what the public sees that should make sense"). The voice laws govern
// what a visitor reads, not internal code strings. Skip non-rendered / internal
// surfaces entirely: server actions (AI prompts, generation logic), API routes,
// admin UI (staff-facing), and metadata files (sitemap/robots). The remaining
// app/ pages + components/ are the public marketing surfaces.
const EXCLUDED_PATH_PREFIXES = [
  'app/api/',
  'app/actions/',
  'app/admin/',
  'components/admin/',
]
const EXCLUDED_EXACT_FILES = new Set([
  'app/sitemap.ts',
  'app/robots.ts',
])
function isInternal(relPath) {
  return (
    EXCLUDED_EXACT_FILES.has(relPath) ||
    EXCLUDED_PATH_PREFIXES.some((p) => relPath.startsWith(p))
  )
}

function scanFile(absPath) {
  const relPath = normalize(relative(ROOT, absPath))
  if (LEXICON_FILES.has(relPath)) return null
  if (isInternal(relPath)) return null // public-facing surfaces only
  let content
  try {
    content = readFileSync(absPath, 'utf8')
  } catch {
    return null
  }
  const lines = content.split('\n')

  // Function-scoped files: only literals inside the named composer bodies are
  // public copy. A missing name is a hard failure, never a silent empty scan.
  const scopedFns = PUBLIC_COPY_FUNCTION_FILES.get(relPath)
  let scopeRanges = null
  if (scopedFns) {
    scopeRanges = functionScopeRanges(content, scopedFns)
    if (!scopeRanges) {
      console.error(
        `\n✖ brand-voice cannot find the public-copy composer it is told to gate.\n` +
          `  ${relPath} should define ${scopedFns.map((f) => `"${f}"`).join(', ')}.\n` +
          `  If it was renamed or split, update PUBLIC_COPY_FUNCTIONS in\n` +
          `  scripts/check-brand-voice.mjs. Client-facing copy does not get to\n` +
          `  leave coverage by being moved.\n`
      )
      process.exit(1)
    }
  }
  const inScope = (startIndex) =>
    !scopeRanges || scopeRanges.some((r) => startIndex >= r.start && startIndex < r.end)

  const literals = extractStringLiterals(content)
  const violations = []
  for (const lit of literals) {
    if (!inScope(lit.startIndex)) continue
    const lineNum = content.slice(0, lit.startIndex).split('\n').length
    const lineText = lines[lineNum - 1] ?? ''
    // Skip if this string literal is on an import line.
    if (IMPORT_PATH_LINE.test(lineText)) continue
    // Skip framework-mechanical config values (e.g. Next.js 'force-dynamic').
    if (MECHANICAL_LITERALS.has(lit.value.trim())) continue
    const lower = lit.value.toLowerCase()
    for (const word of BANNED_WORDS) {
      const re = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')
      if (re.test(lower)) {
        violations.push({ word, line: lineNum, snippet: lit.value.slice(0, 80) })
      }
    }
    // VOICE.md banned moves — law-breaking sentences with no banned word.
    for (const pat of BANNED_PATTERNS) {
      if (pat.re.test(lit.value)) {
        violations.push({ word: `Law ${pat.law}: ${pat.label}`, line: lineNum, snippet: lit.value.slice(0, 80) })
      }
    }
    violations.push(...findSelfPraiseViolations(lit.value, lineNum, lit.value.slice(0, 80), relPath))
    violations.push(...findPunctuationViolations(lit.value, lineNum, lit.value.slice(0, 80), relPath, lineText, lines[lineNum - 2] ?? ''))
  }

  // JSX text children — slogans written between tags, invisible to the literal
  // scanner. Same banned-word + banned-move checks. (Import-line / mechanical-
  // literal skips don't apply: JSX text is never an import path or config value.)
  for (const frag of extractJsxText(content)) {
    if (!inScope(frag.startIndex)) continue
    const lineNum = content.slice(0, frag.startIndex).split('\n').length
    const snippet = frag.value.trim().slice(0, 80)
    const lower = frag.value.toLowerCase()
    for (const word of BANNED_WORDS) {
      const re = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')
      if (re.test(lower)) {
        violations.push({ word, line: lineNum, snippet })
      }
    }
    for (const pat of BANNED_PATTERNS) {
      if (pat.re.test(frag.value)) {
        violations.push({ word: `Law ${pat.law}: ${pat.label}`, line: lineNum, snippet })
      }
    }
    violations.push(...findSelfPraiseViolations(frag.value, lineNum, snippet, relPath))
    violations.push(...findPunctuationViolations(frag.value, lineNum, snippet, relPath, lines[lineNum - 1] ?? '', lines[lineNum - 2] ?? ''))
  }

  if (violations.length === 0) return null
  return { file: relPath, count: violations.length, violations }
}

// Every file this gate reads, repo-relative. Exported so the regression test
// can assert the .ts registries are in scope without re-deriving the walk.
export function collectScannedFiles() {
  const files = []
  for (const dir of SCAN_DIRS) {
    const absDir = join(ROOT, dir)
    if (!existsSync(absDir)) continue
    for (const file of walk(absDir)) files.push(file)
  }
  // Named public-copy registries outside SCAN_DIRS (lib/*-content.ts). Walking
  // lib/ here is a filter, not a widening: only paths PUBLIC_COPY_FILE matches
  // are kept, so the 305-violation lib/ sweep measured above never happens.
  const libDir = join(ROOT, 'lib')
  if (existsSync(libDir)) {
    for (const file of walk(libDir)) {
      if (PUBLIC_COPY_FILE.test(normalize(relative(ROOT, file)))) files.push(file)
    }
  }
  // Files covered only inside a named composer (PUBLIC_COPY_FUNCTIONS). Listed
  // explicitly so a deleted or moved file fails loudly here rather than
  // quietly dropping the copy it carries.
  for (const rel of PUBLIC_COPY_FUNCTION_FILES.keys()) {
    const abs = join(ROOT, rel)
    if (!existsSync(abs)) {
      console.error(
        `\n✖ brand-voice is told to gate ${rel}, and that file does not exist.\n` +
          `  Update PUBLIC_COPY_FUNCTIONS in scripts/check-brand-voice.mjs.\n`
      )
      process.exit(1)
    }
    files.push(abs)
  }
  return files
}

function scanAll() {
  const results = []
  for (const file of collectScannedFiles()) {
    const r = scanFile(file)
    if (r) results.push(r)
  }
  results.sort((a, b) => b.count - a.count)
  return results
}

function summarize(results) {
  const total = results.reduce((s, r) => s + r.count, 0)
  const byFile = Object.fromEntries(results.map((r) => [r.file, r.count]))
  return { total, byFile }
}

function loadBaseline() {
  if (!existsSync(BASELINE_PATH)) return null
  try {
    return JSON.parse(readFileSync(BASELINE_PATH, 'utf8'))
  } catch {
    return null
  }
}

function main() {
  const args = process.argv.slice(2)
  const writeBaseline = args.includes('--write-baseline')
  const reportOnly = args.includes('--report')

  const results = scanAll()
  const summary = summarize(results)

  if (writeBaseline) {
    writeFileSync(
      BASELINE_PATH,
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          total: summary.total,
          byFile: summary.byFile,
          note: 'Generated by scripts/check-brand-voice.mjs --write-baseline. Total must monotonically decrease toward 0.',
        },
        null,
        2
      ) + '\n'
    )
    console.log(`✓ Baseline written: ${summary.total} violations across ${results.length} files.`)
    process.exit(0)
  }

  if (reportOnly) {
    console.log(`Brand voice scan — ${summary.total} violations across ${results.length} files\n`)
    for (const r of results.slice(0, 20)) {
      console.log(`  ${r.count.toString().padStart(4)} ${r.file}`)
      for (const v of r.violations.slice(0, 3)) {
        console.log(`         line ${v.line}: "${v.word}" — ${v.snippet}`)
      }
    }
    if (results.length > 20) console.log(`  ... and ${results.length - 20} more files`)
    process.exit(0)
  }

  const baseline = loadBaseline()
  if (!baseline) {
    console.error('✗ No baseline found at scripts/brand-voice-baseline.json')
    console.error('  Run: node scripts/check-brand-voice.mjs --write-baseline')
    process.exit(2)
  }

  if (summary.total > baseline.total) {
    console.error(`✗ Brand voice regression: ${summary.total} violations vs baseline ${baseline.total}`)
    console.error('')
    for (const r of results) {
      const baselineCount = baseline.byFile[r.file] ?? 0
      if (r.count > baselineCount) {
        console.error(`  ${r.file}: ${r.count} (baseline: ${baselineCount})`)
        for (const v of r.violations.slice(0, 5)) {
          console.error(`    line ${v.line}: "${v.word}" — ${v.snippet}`)
        }
      }
    }
    console.error('')
    console.error('See marketing_brain_skills/brand-voice/VOICE.md.')
    process.exit(1)
  }

  if (summary.total < baseline.total) {
    console.log(`✓ Brand voice improved: ${summary.total} violations vs baseline ${baseline.total} (−${baseline.total - summary.total})`)
  } else {
    console.log(`✓ Brand voice stable: ${summary.total} violations (= baseline)`)
  }
  process.exit(0)
}

// Only run the scan when invoked as a CLI. Importing this module (the test
// imports the exemption helpers) must not kick off a full scan or process.exit.
if (process.argv[1] && resolve(process.argv[1]) === resolve(__filename)) {
  main()
}
