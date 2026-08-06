#!/usr/bin/env node
/**
 * check-voice-db-copy.mjs — ci:voice-db-copy.
 *
 * THE HOLE THIS CLOSES. Every voice gate in this repo scans FILES. None of them
 * can see a Supabase row. So the largest single body of public copy we own —
 * 55 published blog posts and ~90 CRM templates and sequence steps, the words
 * that actually reach leads — was governed by nothing. On 2026-08-06 a read of
 * that copy found a wrong phone number in 39 outbound rows, seasonality
 * folklore the data refutes, months-of-supply thresholds contradicting our own
 * formula, and a false Oregon property-tax claim. All of it passed every gate,
 * because no gate was looking.
 *
 * Matt, 2026-08-06: "I just want this voice to be applied to every new bit of
 * copy that we do. It's simple: if we have old copy, then apply the new voice
 * to it." That is a ratchet, not a review queue — so this gate ratchets, and
 * nothing here asks anyone to approve anything.
 *
 * DB-dependent, so it is OFF the secret-less `ci:gates` chain (same posture as
 * G16 / G57 / G63): nightly in quality.yml plus locally, and it SKIPS CLEANLY
 * when Supabase creds are absent.
 *
 *   node scripts/check-voice-db-copy.mjs                    check against baseline
 *   node scripts/check-voice-db-copy.mjs --report           full listing, never exits 1
 *   node scripts/check-voice-db-copy.mjs --write-baseline   snapshot current state
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { createClient } from '@supabase/supabase-js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const BASELINE_PATH = join(ROOT, 'scripts/voice-db-copy-baseline.json')

const require = createRequire(import.meta.url)
const VOCAB = require('./brand-voice-vocabulary.cjs')
const { CONSTRUCTIONS } = require('./voice-constructions.cjs')

const REPORT = process.argv.includes('--report')
const WRITE_BASELINE = process.argv.includes('--write-baseline')

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SB_URL || !SB_KEY) {
  console.log('· ci:voice-db-copy SKIPPED (no Supabase creds — runs locally + nightly, not in the static chain).')
  process.exit(0)
}

/**
 * What a reader actually sees. HTML tags, merge tokens and URLs are machinery,
 * not prose: a `%contact_first_name%` or an href is not something the canon
 * governs, and leaving them in produces false hits on every template.
 */
function readable(value) {
  if (!value) return ''
  return String(value)
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/%[a-zA-Z0-9_]+%/g, ' ')
    .replace(/&[a-z]+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const BANNED_WORDS = VOCAB.BANNED_WORD_STRINGS
const PATTERNS = CONSTRUCTIONS.map((c) => ({ id: c.id, label: c.label, re: new RegExp(c.source, 'i') }))

function violationsIn(text) {
  const hits = []
  const lower = text.toLowerCase()
  for (const word of BANNED_WORDS) {
    if (lower.includes(word)) hits.push({ kind: 'banned-word', detail: word })
  }
  for (const p of PATTERNS) {
    const m = p.re.exec(text)
    if (m) hits.push({ kind: p.id, detail: m[0].slice(0, 80) })
  }
  return hits
}

const sb = createClient(SB_URL, SB_KEY, { auth: { persistSession: false } })

/** Every stored surface the canon governs. Ad copy is deliberately absent. */
async function collect() {
  const items = []

  const { data: posts, error: e1 } = await sb
    .from('blog_posts')
    .select('id, slug, title, content, excerpt, seo_title, seo_description')
    .eq('status', 'published')
  if (e1) throw new Error(`blog_posts read failed: ${e1.message}`)
  for (const p of posts ?? []) {
    for (const field of ['title', 'content', 'excerpt', 'seo_title', 'seo_description']) {
      items.push({ surface: `blog:${p.slug}`, field, text: readable(p[field]) })
    }
  }

  const { data: tpl, error: e2 } = await sb.from('crm_templates').select('id, name, subject, body')
  if (e2) throw new Error(`crm_templates read failed: ${e2.message}`)
  for (const t of tpl ?? []) {
    for (const field of ['subject', 'body']) {
      items.push({ surface: `template:${t.id}`, field, text: readable(t[field]) })
    }
  }

  const { data: seq, error: e3 } = await sb.from('crm_sequences').select('id, name, steps')
  if (e3) throw new Error(`crm_sequences read failed: ${e3.message}`)
  for (const s of seq ?? []) {
    items.push({ surface: `sequence:${s.id}`, field: 'steps', text: readable(JSON.stringify(s.steps ?? '')) })
  }

  return items
}

const items = await collect()
const bySurface = new Map()
let total = 0
for (const item of items) {
  if (!item.text) continue
  const hits = violationsIn(item.text)
  if (!hits.length) continue
  total += hits.length
  const list = bySurface.get(item.surface) ?? []
  for (const h of hits) list.push({ field: item.field, ...h })
  bySurface.set(item.surface, list)
}

const counts = Object.fromEntries([...bySurface].map(([k, v]) => [k, v.length]).sort())

if (WRITE_BASELINE) {
  writeFileSync(
    BASELINE_PATH,
    `${JSON.stringify({ generatedAt: new Date().toISOString(), total, bySurface: counts, note: 'Generated by scripts/check-voice-db-copy.mjs --write-baseline. Total must monotonically decrease toward 0.' }, null, 2)}\n`,
  )
  console.log(`✓ Baseline written: ${total} violation(s) across ${bySurface.size} surface(s) → ${BASELINE_PATH}`)
  process.exit(0)
}

if (REPORT) {
  console.log(`\nvoice in stored copy (ci:voice-db-copy)\n${'='.repeat(39)}`)
  console.log(`Scanned ${items.length} field(s) across blog posts, CRM templates and sequences.\n`)
  for (const [surface, hits] of [...bySurface].sort((a, b) => b[1].length - a[1].length)) {
    console.log(`${surface}  (${hits.length})`)
    for (const h of hits.slice(0, 6)) console.log(`  ${h.field}: [${h.kind}] ${h.detail}`)
  }
  console.log(`\nTotal: ${total}.`)
  process.exit(0)
}

const baseline = existsSync(BASELINE_PATH) ? JSON.parse(readFileSync(BASELINE_PATH, 'utf8')) : { total: 0, bySurface: {} }

if (total > baseline.total) {
  console.error(`\n✖ Voice regression in stored copy: ${total} violation(s) vs baseline ${baseline.total}.\n`)
  for (const [surface, hits] of [...bySurface].sort((a, b) => b[1].length - a[1].length).slice(0, 12)) {
    const was = baseline.bySurface?.[surface] ?? 0
    if (hits.length > was) {
      console.error(`  ${surface}: ${hits.length} (baseline ${was})`)
      for (const h of hits.slice(0, 3)) console.error(`    ${h.field}: [${h.kind}] ${h.detail}`)
    }
  }
  console.error(
    '\n  This copy lives in Supabase, so no file gate sees it. Fix the row, then re-run.' +
      '\n  The canon: marketing_brain_skills/brand-voice/VOICE.md\n',
  )
  process.exit(1)
}

if (total < baseline.total) {
  console.log(`✓ Stored copy improved: ${total} violation(s), down from ${baseline.total}. Re-baseline with --write-baseline.`)
} else {
  console.log(`✓ Stored copy stable: ${total} violation(s) (= baseline) across ${items.length} field(s).`)
}
