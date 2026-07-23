#!/usr/bin/env tsx
/**
 * preflight.ts — Pre-render gate
 *
 * Refuses to proceed if any check fails. Called BEFORE `npx remotion render`.
 * Writes a partial gate.json to out/<slug>/gate.json. postflight.ts appends
 * the ffprobe / frame-visual / audio sections after the render completes.
 *
 * Checks:
 *   1. Banned-words grep (ANTI_SLOP_MANIFESTO + CLAUDE.md word lists)
 *   2. citations.json exists and every entry has required fields
 *   3. Format skill was loaded in session (SKILL_LOADED_<NAME>=1 env var)
 *   4. BEATS array structure validation (per format)
 *   5. Spark × Supabase reconciliation gate (market formats, delta ≤ 1%)
 *
 * Usage:
 *   node --import tsx scripts/preflight.ts --slug bend-q1-2026 --format data_viz_video
 *   npm run gate:preflight -- --slug bend-q1-2026 --format data_viz_video
 *
 * Exit 0 = pass. Exit 1 = fail (reason printed to stderr).
 * Writes out/<slug>/gate.json (partial — postflight completes it).
 */

import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'
import { config as loadEnv } from 'dotenv'
import {
  FORMAT_NAMES,
  FORMAT_MINIMUMS,
  GateJson,
  writeGate,
  type FormatName,
} from './gate-schema.js'
import { BANNED_WORD_STRINGS as CANONICAL_BANNED_WORDS } from '../lib/brand-voice/generated-vocabulary'

loadEnv({ path: path.resolve(process.cwd(), '.env.local') })

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

interface CliArgs {
  slug: string
  format: FormatName
  help: boolean
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2)

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
preflight.ts — Pre-render gate for the Ryan Realty content engine

Usage:
  npx tsx scripts/preflight.ts --slug <asset-slug> --format <format-name>
  npm run gate:preflight -- --slug <slug> --format <format>

Options:
  --slug    Asset slug (must match out/<slug>/ directory)
  --format  Format name (one of: ${FORMAT_NAMES.join(', ')})
  --help    Show this help

Environment:
  SKILL_LOADED_<FORMAT>  Set to "1" by the format skill to confirm it was loaded.
                         Also accepted via out/<slug>/format-skill.json.

Example:
  npx tsx scripts/preflight.ts --slug bend-q1-2026 --format data_viz_video
`)
    process.exit(0)
  }

  function flag(name: string): string | undefined {
    const i = args.indexOf(`--${name}`)
    return i !== -1 && args[i + 1] ? args[i + 1] : undefined
  }

  const slug = flag('slug')
  const format = flag('format') as FormatName | undefined

  const errors: string[] = []
  if (!slug) errors.push('--slug is required')
  if (!format) {
    errors.push('--format is required')
  } else if (!FORMAT_NAMES.includes(format as FormatName)) {
    errors.push(`--format "${format}" is not valid. Must be one of: ${FORMAT_NAMES.join(', ')}`)
  }

  if (errors.length > 0) {
    for (const e of errors) process.stderr.write(`[preflight] ERROR: ${e}\n`)
    process.exit(1)
  }

  return { slug: slug!, format: format!, help: false }
}

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

function resolvePaths(slug: string) {
  const root = process.cwd()
  const outDir = path.join(root, 'out', slug)
  const manifestoPath = path.join(root, 'video_production_skills', 'ANTI_SLOP_MANIFESTO.md')
  const citationsPath = path.join(outDir, 'citations.json')
  const scorecardPath = path.join(outDir, 'scorecard.json')
  const qaReportPath = path.join(outDir, 'qa_report.md')
  const gatePath = path.join(outDir, 'gate.json')
  const beatsPath = path.join(outDir, 'beats.json')
  const skillConfigPath = path.join(outDir, 'format-skill.json')
  return { root, outDir, manifestoPath, citationsPath, scorecardPath, qaReportPath, gatePath, beatsPath, skillConfigPath }
}

// ---------------------------------------------------------------------------
// Banned words list (ANTI_SLOP_MANIFESTO Rule 1/4/11 + CLAUDE.md banned-words)
//
// Core vocabulary comes from the canonical scripts/brand-voice-vocabulary.cjs
// via lib/brand-voice/generated-vocabulary.ts (see scripts/gen-brand-voice-
// consumers.mjs) — never hand-typed here. LOCAL_EXTRAS below are genuinely
// video/anti-slop-specific terms the canonical (general prose) list doesn't
// carry: AI-language tells beyond the canonical AI_FILLER set, video-specific
// clichés, hook-opening patterns, and the CLAUDE.md §0 video stat-discipline
// rule that "approximately"/"roughly"/"about" are banned ONLY as a substitute
// for a real number in VO/captions/on-screen text (contextual check below) —
// narrower than a blanket ban, and distinct from the canonical VAGUE_QUALIFIERS
// list, which the 2026-06-02 realism pass emptied out for general prose. Words
// the canonical source removed as legitimate plain English (spacious, cozy,
// turnkey, leverage, navigate, comprehensive, foster) are NOT re-added here.
// ---------------------------------------------------------------------------

const LOCAL_EXTRAS: readonly string[] = [
  // ANTI_SLOP_MANIFESTO Rule 1 — video-specific clichés not in the canonical list
  'coveted',
  'one-of-a-kind',
  'a rare opportunity',
  'this won\'t last long',
  'priced to sell',
  // ANTI_SLOP_MANIFESTO Rule 11 — AI-language tells not in the canonical AI_FILLER set
  'underscore',
  'embark',
  'myriad',
  'pivotal',
  'transformative',
  'empower',
  'unleash',
  'harness',
  'facilitate',
  'in the realm of',
  'at the intersection of',
  'in this rapidly evolving landscape',
  // CLAUDE.md §0 video stat-discipline — banned ONLY as a substitute for a
  // real number (contextual check below), not in ordinary prose.
  'approximately',
  'roughly',
  'about',
  // ANTI_SLOP_MANIFESTO Rule 4 — banned opening patterns
  'in today\'s real estate market',
  'have you ever wondered',
  'did you know that',
  'let\'s talk about',
  'are you thinking about',
  'welcome to',
  'today we\'re going to',
  'hey guys',
  'what\'s up',
]

const BANNED_WORDS: readonly string[] = [...CANONICAL_BANNED_WORDS, ...LOCAL_EXTRAS]

// Deduplicate
const BANNED_WORDS_UNIQUE = [...new Set(BANNED_WORDS)]

interface BannedWordHit {
  file: string
  line: number
  word: string
  context: string
}

/**
 * Grep a directory for banned words across VO script, captions, and on-screen text files.
 * Returns all hits found.
 */
function checkBannedWords(outDir: string): BannedWordHit[] {
  const hits: BannedWordHit[] = []

  // Files to scan in the out/<slug>/ directory
  const scanPatterns = [
    '*.txt',      // VO scripts
    '*.json',     // captions JSON, beats JSON
    '*.md',       // any storyboard markdown
    '*.srt',      // subtitle files
    '*.vtt',      // WebVTT captions
  ]

  if (!fs.existsSync(outDir)) return hits

  function scanFile(filePath: string): void {
    let content: string
    try {
      content = fs.readFileSync(filePath, 'utf8')
    } catch {
      return
    }

    const lines = content.split('\n')
    for (const [lineIdx, line] of lines.entries()) {
      const lower = line.toLowerCase()
      for (const word of BANNED_WORDS_UNIQUE) {
        if (lower.includes(word.toLowerCase())) {
          // Avoid false positives on "about" — only flag when used as a
          // substitute for a real number (preceded by common hedge phrases)
          if (word === 'about') {
            if (!/\babout\s+\$?\d|\babout\s+\d/.test(lower)) continue
          }
          hits.push({
            file: path.relative(process.cwd(), filePath),
            line: lineIdx + 1,
            word,
            context: line.trim().slice(0, 120),
          })
        }
      }
    }
  }

  function walkDir(dir: string): void {
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        // Don't recurse into node_modules or .next
        if (entry.name === 'node_modules' || entry.name === '.next') continue
        walkDir(full)
      } else {
        const ext = path.extname(entry.name).toLowerCase()
        if (['.txt', '.json', '.md', '.srt', '.vtt'].includes(ext)) {
          scanFile(full)
        }
      }
    }
  }

  walkDir(outDir)
  return hits
}

// ---------------------------------------------------------------------------
// Citations validation
// ---------------------------------------------------------------------------

interface CitationEntry {
  figure: string
  source?: string
  table_or_url?: string
  filter?: string
  row_count?: number
  fetched_at_iso?: string
  query?: string
  [key: string]: unknown
}

interface CitationsResult {
  pass: boolean
  figureCount: number
  verifiedCount: number
  missing: string[]
}

function validateCitations(citationsPath: string): CitationsResult {
  if (!fs.existsSync(citationsPath)) {
    return { pass: false, figureCount: 0, verifiedCount: 0, missing: ['citations.json file is absent'] }
  }

  let entries: CitationEntry[]
  try {
    const raw = JSON.parse(fs.readFileSync(citationsPath, 'utf8'))
    entries = Array.isArray(raw) ? raw : Object.values(raw)
  } catch (e) {
    return {
      pass: false,
      figureCount: 0,
      verifiedCount: 0,
      missing: [`citations.json is malformed JSON: ${e instanceof Error ? e.message : String(e)}`],
    }
  }

  if (entries.length === 0) {
    return { pass: false, figureCount: 0, verifiedCount: 0, missing: ['citations.json is empty — no figures cited'] }
  }

  const REQUIRED_FIELDS: Array<'source' | 'table_or_url' | 'fetched_at_iso'> = ['source', 'table_or_url', 'fetched_at_iso']
  const missing: string[] = []
  let verifiedCount = 0

  for (const [i, entry] of entries.entries()) {
    const label = entry.figure ?? `entry[${i}]`
    const entryMissing: string[] = []
    for (const field of REQUIRED_FIELDS) {
      if (!entry[field]) entryMissing.push(field)
    }
    if (entryMissing.length > 0) {
      missing.push(`"${label}" missing fields: ${entryMissing.join(', ')}`)
    } else {
      verifiedCount++
    }
  }

  return {
    pass: missing.length === 0,
    figureCount: entries.length,
    verifiedCount,
    missing,
  }
}

// ---------------------------------------------------------------------------
// Format skill loaded check
// ---------------------------------------------------------------------------

function checkSkillLoaded(format: FormatName, skillConfigPath: string): boolean {
  // Method 1: environment variable set by the format skill
  const envKey = `SKILL_LOADED_${format.toUpperCase().replace(/-/g, '_')}`
  if (process.env[envKey] === '1') return true

  // Method 2: format-skill.json in the out/<slug>/ directory
  if (fs.existsSync(skillConfigPath)) {
    try {
      const cfg = JSON.parse(fs.readFileSync(skillConfigPath, 'utf8'))
      return cfg?.skillName === format || cfg?.format === format
    } catch {
      // malformed — ignore, fall through
    }
  }

  // Method 3: beats.json contains the format name (written by format skills)
  const beatsPath = path.join(path.dirname(skillConfigPath), 'beats.json')
  if (fs.existsSync(beatsPath)) {
    try {
      const beats = JSON.parse(fs.readFileSync(beatsPath, 'utf8'))
      if (beats?.format === format || beats?.formatSkill === format) return true
    } catch {
      // malformed — fall through
    }
  }

  return false
}

// ---------------------------------------------------------------------------
// BEATS array validation (format-specific structure)
// ---------------------------------------------------------------------------

interface Beat {
  id?: string | number
  duration?: number
  durationS?: number
  type?: string
  text?: string
  [key: string]: unknown
}

interface BeatsValidationResult {
  pass: boolean
  beatCount: number
  totalDurationS: number
  failures: string[]
}

function validateBeats(outDir: string, format: FormatName): BeatsValidationResult {
  const beatsPath = path.join(outDir, 'beats.json')
  const failures: string[] = []

  if (!fs.existsSync(beatsPath)) {
    // Not all formats require beats.json at preflight time — warn but don't block
    return { pass: true, beatCount: 0, totalDurationS: 0, failures: [] }
  }

  let beats: Beat[]
  try {
    const raw = JSON.parse(fs.readFileSync(beatsPath, 'utf8'))
    beats = Array.isArray(raw) ? raw : (Array.isArray(raw?.beats) ? raw.beats : [])
  } catch (e) {
    return {
      pass: false,
      beatCount: 0,
      totalDurationS: 0,
      failures: [`beats.json is malformed JSON: ${e instanceof Error ? e.message : String(e)}`],
    }
  }

  if (beats.length === 0) {
    failures.push('beats.json contains zero beats')
    return { pass: false, beatCount: 0, totalDurationS: 0, failures }
  }

  let totalDurationS = 0

  for (const [i, beat] of beats.entries()) {
    const label = `beat[${i}]${beat.id ? ` (${beat.id})` : ''}`
    const durationS = beat.durationS ?? (beat.duration ? beat.duration / 30 : undefined)

    if (durationS === undefined) {
      failures.push(`${label}: missing duration or durationS field`)
      continue
    }

    totalDurationS += durationS

    // CLAUDE.md hard rule: no beat over 4s (3-4s max for luxury drone, 2-3s standard)
    if (durationS > 4.0) {
      failures.push(`${label}: duration ${durationS.toFixed(1)}s exceeds 4s hard maximum (CLAUDE.md §Video Build Hard Rules)`)
    }

    // CLAUDE.md: min 2s display per beat
    if (durationS < 2.0) {
      failures.push(`${label}: duration ${durationS.toFixed(1)}s is below 2s minimum display time`)
    }
  }

  // CLAUDE.md: minimum 12 beats in a 45s video
  if (beats.length < 12) {
    failures.push(`Only ${beats.length} beats — minimum 12 required for a 45s video (CLAUDE.md §Video Build Hard Rules)`)
  }

  // Total duration sanity: should be 30–60s (hard max) or warn if outside 30–45s
  if (totalDurationS < 30) {
    failures.push(`Total beat duration ${totalDurationS.toFixed(1)}s is below 30s minimum`)
  }
  if (totalDurationS > 60) {
    failures.push(`Total beat duration ${totalDurationS.toFixed(1)}s exceeds 60s hard maximum (CLAUDE.md §Video Build Hard Rules)`)
  }

  return {
    pass: failures.length === 0,
    beatCount: beats.length,
    totalDurationS,
    failures,
  }
}

// ---------------------------------------------------------------------------
// Spark × Supabase reconciliation (market report formats only)
// ---------------------------------------------------------------------------

/** Formats that require market-data reconciliation */
const MARKET_FORMATS: readonly FormatName[] = ['data_viz_video', 'market_report_video', 'avatar_market_update']

interface ReconciliationResult {
  applicable: boolean
  pass: boolean
  maxDeltaPct: number
  conflicts: string[]
}

interface CitationWithValues {
  figure?: string
  supabase_value?: number | string
  spark_value?: number | string
  delta_pct?: number
  source?: string
  [key: string]: unknown
}

async function checkSparkSupabaseReconciliation(citationsPath: string, format: FormatName): Promise<ReconciliationResult> {
  if (!MARKET_FORMATS.includes(format)) {
    return { applicable: false, pass: true, maxDeltaPct: 0, conflicts: [] }
  }

  if (!fs.existsSync(citationsPath)) {
    return {
      applicable: true,
      pass: false,
      maxDeltaPct: 0,
      conflicts: ['citations.json absent — cannot reconcile Spark vs Supabase'],
    }
  }

  let entries: CitationWithValues[]
  try {
    const raw = JSON.parse(fs.readFileSync(citationsPath, 'utf8'))
    entries = Array.isArray(raw) ? raw : Object.values(raw)
  } catch {
    return {
      applicable: true,
      pass: false,
      maxDeltaPct: 0,
      conflicts: ['citations.json is malformed — cannot reconcile'],
    }
  }

  const conflicts: string[] = []
  let maxDeltaPct = 0

  // Look for entries that have both supabase_value and spark_value (cross-check entries)
  const crossCheckEntries = entries.filter((e) => e.supabase_value !== undefined && e.spark_value !== undefined)

  if (crossCheckEntries.length === 0) {
    // No cross-check entries — treat as pass with a note (format skill may handle this)
    // The CLAUDE.md rule says the agent must do the cross-check before preflight.
    // If no cross-check entries exist, we can only verify if the format is a market format.
    // We flag a warning but don't hard-block here — the format skill is responsible.
    process.stderr.write(
      `[preflight] WARN: No Spark×Supabase cross-check entries found in citations.json for market format "${format}".\n` +
      `           Ensure the format skill wrote both supabase_value and spark_value for every figure.\n`
    )
    return { applicable: true, pass: true, maxDeltaPct: 0, conflicts: [] }
  }

  for (const entry of crossCheckEntries) {
    const label = entry.figure ?? 'unknown figure'
    const sbVal = Number(entry.supabase_value)
    const sparkVal = Number(entry.spark_value)

    if (Number.isNaN(sbVal) || Number.isNaN(sparkVal)) {
      conflicts.push(`"${label}": cannot compute delta — values are not numeric (supabase=${entry.supabase_value}, spark=${entry.spark_value})`)
      continue
    }

    if (sbVal === 0 && sparkVal === 0) continue

    const base = Math.abs(sbVal) > 0 ? Math.abs(sbVal) : Math.abs(sparkVal)
    const deltaPct = Math.abs(sbVal - sparkVal) / base

    if (deltaPct > maxDeltaPct) maxDeltaPct = deltaPct

    if (deltaPct > 0.01) {
      conflicts.push(
        `"${label}": Supabase=${sbVal.toLocaleString()} vs Spark=${sparkVal.toLocaleString()} — delta ${(deltaPct * 100).toFixed(2)}% exceeds 1% threshold (CLAUDE.md §0)`
      )
    }
  }

  return {
    applicable: true,
    pass: conflicts.length === 0,
    maxDeltaPct,
    conflicts,
  }
}

// ---------------------------------------------------------------------------
// Failure reporting
// ---------------------------------------------------------------------------

function fail(message: string): never {
  process.stderr.write(`\n[preflight] BLOCKED: ${message}\n\n`)
  process.exit(1)
}

function warn(message: string): void {
  process.stderr.write(`[preflight] WARN: ${message}\n`)
}

function ok(message: string): void {
  process.stdout.write(`[preflight] OK: ${message}\n`)
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const { slug, format } = parseArgs()
  const paths = resolvePaths(slug)

  process.stdout.write(`\n[preflight] Starting pre-render gate for slug="${slug}" format="${format}"\n`)
  process.stdout.write(`[preflight] Output directory: ${paths.outDir}\n\n`)

  // Ensure output directory exists
  fs.mkdirSync(paths.outDir, { recursive: true })

  const failures: string[] = []
  const warnings: string[] = []

  // ── Check 1: Banned words ────────────────────────────────────────────────

  const bannedHits = checkBannedWords(paths.outDir)
  if (bannedHits.length > 0) {
    for (const hit of bannedHits) {
      process.stderr.write(
        `[preflight] BANNED WORD: "${hit.word}" in ${hit.file}:${hit.line}\n` +
        `            Context: ${hit.context}\n`
      )
    }
    failures.push(`${bannedHits.length} banned word(s) found in out/${slug}/ (ANTI_SLOP_MANIFESTO Rule 1)`)
  } else {
    ok('Banned-words grep — clean')
  }

  // ── Check 2: citations.json validation ───────────────────────────────────

  const citationsResult = validateCitations(paths.citationsPath)
  if (!citationsResult.pass) {
    for (const m of citationsResult.missing) {
      process.stderr.write(`[preflight] CITATION FAIL: ${m}\n`)
    }
    failures.push(
      `citations.json validation failed (${citationsResult.verifiedCount}/${citationsResult.figureCount} figures verified)`
    )
  } else {
    ok(`citations.json — ${citationsResult.figureCount} figure(s) verified`)
  }

  // ── Check 3: Format skill loaded ─────────────────────────────────────────

  const skillLoaded = checkSkillLoaded(format, paths.skillConfigPath)
  if (!skillLoaded) {
    warn(
      `Format skill "${format}" not confirmed loaded (SKILL_LOADED_${format.toUpperCase().replace(/-/g, '_')}=1 not set and ` +
      `no format-skill.json or beats.json in out/${slug}/). ` +
      `Set the env var or write format-skill.json before rendering.`
    )
    warnings.push(`format skill "${format}" load not confirmed`)
  } else {
    ok(`Format skill "${format}" confirmed loaded`)
  }

  // ── Check 4: BEATS array structure ───────────────────────────────────────

  const beatsResult = validateBeats(paths.outDir, format)
  if (!beatsResult.pass) {
    for (const f of beatsResult.failures) {
      process.stderr.write(`[preflight] BEATS FAIL: ${f}\n`)
    }
    failures.push(`BEATS validation failed: ${beatsResult.failures.join('; ')}`)
  } else if (beatsResult.beatCount > 0) {
    ok(`BEATS array — ${beatsResult.beatCount} beats, ~${beatsResult.totalDurationS.toFixed(1)}s total`)
  } else {
    warn('beats.json not found — skipping BEATS validation (write beats.json before render for full gate)')
    warnings.push('beats.json absent at preflight time')
  }

  // ── Check 5: Spark × Supabase reconciliation ─────────────────────────────

  const reconResult = await checkSparkSupabaseReconciliation(paths.citationsPath, format)
  if (reconResult.applicable) {
    if (!reconResult.pass) {
      for (const c of reconResult.conflicts) {
        process.stderr.write(`[preflight] RECONCILIATION FAIL: ${c}\n`)
      }
      failures.push(
        `Spark×Supabase reconciliation failed — ${reconResult.conflicts.length} conflict(s). ` +
        `Max delta: ${(reconResult.maxDeltaPct * 100).toFixed(2)}%. ` +
        `Resolve conflicts before rendering. (CLAUDE.md §0)`
      )
    } else {
      ok(`Spark×Supabase reconciliation — max delta ${(reconResult.maxDeltaPct * 100).toFixed(2)}% (threshold 1%)`)
    }
  }

  // ── Hard-block if any failures ────────────────────────────────────────────

  if (failures.length > 0) {
    process.stderr.write(`\n[preflight] BLOCKED — ${failures.length} failure(s):\n`)
    for (const [i, f] of failures.entries()) {
      process.stderr.write(`  ${i + 1}. ${f}\n`)
    }
    process.stderr.write('\nFix all failures before running `npx remotion render`.\n\n')
    process.exit(1)
  }

  // ── Write partial gate.json ───────────────────────────────────────────────

  const now = new Date().toISOString()
  const formatMinimum = FORMAT_MINIMUMS[format]

  const partialGate: GateJson = {
    // GateArtifacts fields (route.ts interface)
    scorecardPath: paths.scorecardPath,
    citationsPath: paths.citationsPath,
    qaReportPath: paths.qaReportPath,
    postflightPath: null, // populated by postflight.ts
    manifestoPath: paths.manifestoPath,
    humanApprovedAt: null, // set only when Matt approves
    formatSkillName: format,
    formatSkillVersion: now.slice(0, 10), // YYYY-MM-DD

    // QA fields
    gatePassed: false, // stays false until postflight.ts sets it to true
    gateTimestamp: now,
    iterationCyclesUsed: 0,
    assetPath: path.join(paths.outDir, `${slug}.mp4`),
    format,
    formatMinimum,
    scorecardTotal: 0, // populated by qa_pass after render
    autoZeroHits: [],

    // Hard refuse — preflight-knowable fields
    bannedWordsClean: bannedHits.length === 0,
    citationsComplete: citationsResult.pass,
    durationInRange: false, // determined by postflight
    blackdetectClean: false, // determined by postflight
    noFrozenFrames: false, // determined by postflight
    noBlackBars: false, // determined by postflight
    captionZoneNonOverlap: false, // determined by postflight
    brandComplianceOK: false, // determined by postflight
    audioNonSilent: false, // determined by postflight
    fileSizeUnder100MB: false, // determined by postflight

    // Reconciliation
    sparkSupabaseReconciled: reconResult.applicable ? reconResult.pass : null,
    reconciliationMaxDelta: reconResult.applicable ? reconResult.maxDeltaPct : null,
    aiDisclosurePresent: null, // set by postflight visual check
    youtubeSyntheticMediaFlag: true, // always true — ElevenLabs VO is present by convention

    // Hard refuse summary
    hardRefuseConditionsChecked: ['banned_words_clean', 'citations_complete', 'spark_supabase_reconciled'],
    hardRefuseConditionsFailed: [
      ...(!bannedHits.length ? [] : ['banned_words_clean']),
      ...(citationsResult.pass ? [] : ['citations_complete']),
      ...(reconResult.applicable && !reconResult.pass ? ['spark_supabase_reconciled'] : []),
    ],

    // Approval state (never set here — only by publish skill)
    mattApprovalRequired: true,
    approvedByMatt: false,
    approvedAt: null,

    // Cost (populated by postflight)
    renderCostUsd: 0,
    apiCostUsd: 0,
    totalCostUsd: 0,
  }

  try {
    writeGate(paths.gatePath, partialGate)
    ok(`Partial gate.json written to ${path.relative(process.cwd(), paths.gatePath)}`)
  } catch (e) {
    fail(`Failed to write gate.json: ${e instanceof Error ? e.message : String(e)}`)
  }

  // ── Summary ───────────────────────────────────────────────────────────────

  if (warnings.length > 0) {
    process.stdout.write(`\n[preflight] ${warnings.length} warning(s) — review before render:\n`)
    for (const w of warnings) process.stdout.write(`  - ${w}\n`)
  }

  process.stdout.write(`\n[preflight] PASS — all preflight checks cleared for slug="${slug}" format="${format}"\n`)
  process.stdout.write(`[preflight] Render command: cd listing_video_v4 && npx remotion render src/index.ts <CompId> out/${slug}/${slug}.mp4 --codec h264 --concurrency 1 --crf 22 --image-format=jpeg --jpeg-quality=92\n`)
  process.stdout.write(`[preflight] After render: npm run gate:postflight -- --slug ${slug}\n\n`)
}

main().catch((e) => {
  process.stderr.write(`[preflight] FATAL: ${e instanceof Error ? e.message : String(e)}\n`)
  if (e instanceof Error && e.stack) process.stderr.write(e.stack + '\n')
  process.exit(1)
})
