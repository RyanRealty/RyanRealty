#!/usr/bin/env node
/**
 * scripts/ingest-legal-corpus.mjs — Phase 4 (R4.1) of the broker SMS agent.
 * docs/plans/BROKER_SMS_AGENT_2026-07-31.md
 *
 * Ingests three sources into public.legal_corpus so law_lookup
 * (lib/agent/tools/law.ts) can answer Oregon real-estate-law questions with a
 * primary-source citation instead of model memory:
 *
 *   - source='ors'    ORS chapter 696 (real estate licensing/agency statutes),
 *                      crawled from https://oregon.public.law/statutes/ors_chapter_696
 *   - source='oar'    OAR chapter 863 (Real Estate Agency administrative rules),
 *                      crawled from https://oregon.public.law/rules/oar_chapter_863
 *                      (index -> division pages -> individual rule pages)
 *   - source='matrix' docs/TC_OREGON_COMPLIANCE.md's markdown tables +
 *                      lib/tc/required-documents.ts's DOC_RULES citation strings
 *                      (no network — these are already-verified in-repo sources)
 *
 * Table (supabase/migrations/20260801051000_broker_sms_agent_tables.sql):
 *   legal_corpus(id, source, citation, heading, body, url, effective_date,
 *   corpus_version, checksum, fetched_at, created_at)
 *   UNIQUE (source, citation, corpus_version); GIN FTS index on
 *   to_tsvector('english', coalesce(heading,'') || ' ' || body).
 *
 * corpus_version defaults to today's date (e.g. '2026-07-31'). Running the
 * script again the SAME day (e.g. after a crash, or the smoke-test-then-full
 * sequence) shares that corpus_version, so the "already ingested" check below
 * makes reruns resumable: a citation already present for (source,
 * corpus_version) is skipped WITHOUT being re-fetched. A rule that changed
 * upstream on the SAME calendar day would not be picked up by this run — that
 * is deliberately how "one version per day" works; a genuine same-day
 * re-ingest can pass --version to force a new corpus_version bucket.
 *
 * Politeness: single-threaded, sequential fetches, 350ms sleep after every
 * network call, honest User-Agent identifying the requester.
 *
 * USAGE:
 *   node scripts/ingest-legal-corpus.mjs                       # all 3 sources, no cap
 *   node scripts/ingest-legal-corpus.mjs --source matrix       # matrix only (no network)
 *   node scripts/ingest-legal-corpus.mjs --source ors --limit 25
 *   node scripts/ingest-legal-corpus.mjs --source oar,ors --limit 10
 *   node scripts/ingest-legal-corpus.mjs --version 2026-08-01  # force a new bucket
 *
 * ENV: reads .env.local for NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
 * (same pattern as scripts/render-worker.mjs).
 */

import { readFileSync, existsSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { dirname, resolve, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(__dirname, '..')

// ── args ────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2)
function argVal(name) {
  const i = argv.indexOf(name)
  return i !== -1 ? argv[i + 1] : undefined
}
const limitRaw = argVal('--limit')
const LIMIT = limitRaw ? Math.max(1, parseInt(limitRaw, 10) || Number.POSITIVE_INFINITY) : Number.POSITIVE_INFINITY
const sourceRaw = argVal('--source')
const SOURCES = sourceRaw
  ? sourceRaw
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
  : ['matrix', 'ors', 'oar']
const CORPUS_VERSION = (argVal('--version') || new Date().toISOString().slice(0, 10)).trim()

for (const s of SOURCES) {
  if (!['ors', 'oar', 'matrix'].includes(s)) {
    console.error(`ingest-legal-corpus: unknown --source "${s}" — must be one of ors|oar|matrix`)
    process.exit(2)
  }
}

// ── env + supabase (pattern: scripts/render-worker.mjs) ─────────────────────
function loadEnvLocal() {
  const p = join(REPO_ROOT, '.env.local')
  if (!existsSync(p)) return {}
  const out = {}
  for (const line of readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
  return out
}

const env = loadEnvLocal()
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('ingest-legal-corpus: missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(2)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } })

// ── polite fetch ─────────────────────────────────────────────────────────────
const USER_AGENT = 'RyanRealty-legal-corpus/1.0 (compliance research; matt@ryan-realty.com)'
const SLEEP_MS = 350

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

async function politeFetch(url, attempt = 1) {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const text = await res.text()
    await sleep(SLEEP_MS)
    return text
  } catch (err) {
    if (attempt < 3) {
      await sleep(SLEEP_MS * attempt)
      return politeFetch(url, attempt + 1)
    }
    throw new Error(`fetch failed for ${url}: ${err.message}`)
  }
}

// ── HTML helpers ─────────────────────────────────────────────────────────────
function decodeEntities(s) {
  return s
    .replace(/&shy;/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
}

/** Strip all tags/scripts/styles down to plain readable text. */
function stripTags(html) {
  const noScripts = html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ')
  const noTags = noScripts.replace(/<[^>]+>/g, ' ')
  return decodeEntities(noTags)
    .replace(/[ \t]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .replace(/\n{2,}/g, '\n')
    .trim()
}

/**
 * oregon.public.law renders every ORS section AND every OAR rule with the
 * identical shape: an h1 carrying "<span class=meta-name-and-number>ORS/OAR
 * NNN</span><br><span id=name>Heading</span>", then the substantive text in
 * <div id="leaf-statute-body"> ... </div>, followed by a footer citation block
 * inside <div class="d-print-none mt-5"> (a "Source: ... (accessed <date>)"
 * cite we deliberately exclude — boilerplate, not statutory text). One
 * extractor serves both ORS and OAR pages.
 */
function extractStatuteFields(html) {
  const nameNumMatch = html.match(
    /<span class="meta-name-and-number">([\s\S]*?)<\/span>\s*<br>\s*<span id="name">([\s\S]*?)<\/span>/
  )
  let citation = null
  let heading = null
  if (nameNumMatch) {
    citation = stripTags(nameNumMatch[1]).replace(/\s+/g, ' ').trim()
    heading = stripTags(nameNumMatch[2]).replace(/\s+/g, ' ').trim()
  }

  const bodyMarker = '<div id="leaf-statute-body">'
  const markerIdx = html.indexOf(bodyMarker)
  if (markerIdx === -1) return { citation, heading, body: null }
  const bodyStartIdx = markerIdx + bodyMarker.length
  let bodyEndIdx = html.indexOf('<div class="d-print-none mt-5">', bodyStartIdx)
  if (bodyEndIdx === -1) bodyEndIdx = html.indexOf('</article>', bodyStartIdx)
  if (bodyEndIdx === -1) bodyEndIdx = html.length

  const body = stripTags(html.slice(bodyStartIdx, bodyEndIdx)).replace(/\n+/g, ' ').trim()
  return { citation, heading, body: body || null }
}

function sha256(text) {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex')
}

// ── DB helpers ───────────────────────────────────────────────────────────────

/** All citations already ingested for (source, corpus_version) — the resumability set. */
async function existingCitations(source, corpusVersion) {
  const out = new Set()
  const pageSize = 1000
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from('legal_corpus')
      .select('citation')
      .eq('source', source)
      .eq('corpus_version', corpusVersion)
      .range(from, from + pageSize - 1)
    if (error) throw new Error(`existingCitations(${source}): ${error.message}`)
    for (const row of data ?? []) out.add(row.citation)
    if (!data || data.length < pageSize) break
  }
  return out
}

async function upsertRow(row) {
  const { error } = await supabase.from('legal_corpus').upsert(row, { onConflict: 'source,citation,corpus_version' })
  return error
}

// ── ORS chapter 696 crawl ────────────────────────────────────────────────────
const ORS_INDEX_URL = 'https://oregon.public.law/statutes/ors_chapter_696'

async function crawlOrsSectionSlugs() {
  const html = await politeFetch(ORS_INDEX_URL)
  const slugs = new Set()
  for (const m of html.matchAll(/href="(ors_696[a-zA-Z]?\.\d+[a-zA-Z]?)"/g)) slugs.add(m[1])
  return [...slugs].sort()
}

async function ingestOrs(limit) {
  console.log('[ors] crawling index...')
  const slugs = await crawlOrsSectionSlugs()
  console.log(`[ors] found ${slugs.length} sections`)
  const already = await existingCitations('ors', CORPUS_VERSION)
  let fetched = 0
  let inserted = 0
  let skippedExisting = 0
  let errors = 0
  for (const slug of slugs) {
    if (fetched >= limit) break
    const expectedCitation = `ORS ${slug.replace(/^ors_/, '')}`
    if (already.has(expectedCitation)) {
      skippedExisting++
      continue
    }
    fetched++
    const url = `https://oregon.public.law/statutes/${slug}`
    try {
      const html = await politeFetch(url)
      const { citation, heading, body } = extractStatuteFields(html)
      if (!citation || !body) {
        console.warn(`[ors] SKIP ${url} — no extractable body`)
        continue
      }
      const row = {
        source: 'ors',
        citation,
        heading,
        body,
        url,
        effective_date: null,
        corpus_version: CORPUS_VERSION,
        checksum: sha256(body),
      }
      const error = await upsertRow(row)
      if (error) {
        errors++
        console.warn(`[ors] ERROR upserting ${citation}: ${error.message}`)
      } else {
        inserted++
        console.log(`[ors] + ${citation} — ${heading}`)
      }
    } catch (err) {
      errors++
      console.warn(`[ors] ERROR fetching ${url}: ${err.message}`)
    }
  }
  console.log(`[ors] done: inserted ${inserted}, skipped-existing ${skippedExisting}, errors ${errors}`)
  return { inserted, skippedExisting, errors }
}

// ── OAR chapter 863 crawl (index -> divisions -> rules) ─────────────────────
const OAR_INDEX_URL = 'https://oregon.public.law/rules/oar_chapter_863'

async function crawlOarDivisionSlugs() {
  const html = await politeFetch(OAR_INDEX_URL)
  const divs = new Set()
  for (const m of html.matchAll(/href="(oar_chapter_863_division_\d+)"/g)) divs.add(m[1])
  return [...divs].sort((a, b) => {
    const na = parseInt(a.match(/division_(\d+)/)[1], 10)
    const nb = parseInt(b.match(/division_(\d+)/)[1], 10)
    return na - nb
  })
}

async function crawlOarRuleSlugs(divisionSlug) {
  const html = await politeFetch(`https://oregon.public.law/rules/${divisionSlug}`)
  const rules = new Set()
  for (const m of html.matchAll(/href="(oar_863-\d+-\d+)"/g)) rules.add(m[1])
  return [...rules].sort()
}

async function ingestOar(limit) {
  console.log('[oar] crawling division index...')
  const divisions = await crawlOarDivisionSlugs()
  console.log(`[oar] found ${divisions.length} divisions`)
  const already = await existingCitations('oar', CORPUS_VERSION)
  let fetched = 0
  let inserted = 0
  let skippedExisting = 0
  let errors = 0

  outer: for (const div of divisions) {
    const ruleSlugs = await crawlOarRuleSlugs(div)
    console.log(`[oar]   ${div}: ${ruleSlugs.length} rules`)
    for (const slug of ruleSlugs) {
      if (fetched >= limit) break outer
      const expectedCitation = `OAR ${slug.replace(/^oar_/, '')}`
      if (already.has(expectedCitation)) {
        skippedExisting++
        continue
      }
      fetched++
      const url = `https://oregon.public.law/rules/${slug}`
      try {
        const html = await politeFetch(url)
        const { citation, heading, body } = extractStatuteFields(html)
        if (!citation || !body) {
          console.warn(`[oar] SKIP ${url} — no extractable body`)
          continue
        }
        const row = {
          source: 'oar',
          citation,
          heading,
          body,
          url,
          effective_date: null,
          corpus_version: CORPUS_VERSION,
          checksum: sha256(body),
        }
        const error = await upsertRow(row)
        if (error) {
          errors++
          console.warn(`[oar] ERROR upserting ${citation}: ${error.message}`)
        } else {
          inserted++
          console.log(`[oar] + ${citation} — ${heading}`)
        }
      } catch (err) {
        errors++
        console.warn(`[oar] ERROR fetching ${url}: ${err.message}`)
      }
    }
  }
  console.log(`[oar] done: inserted ${inserted}, skipped-existing ${skippedExisting}, errors ${errors}`)
  return { inserted, skippedExisting, errors }
}

// ── matrix source: docs/TC_OREGON_COMPLIANCE.md + lib/tc/required-documents.ts ──

/** [label](url) -> label; strip bold markers and code ticks; collapse whitespace. */
function stripMdInline(s) {
  return s
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
    .replace(/\*\*/g, '')
    .replace(/`/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** The numeric/dash part of a citation used to match it against a URL slug. */
function citationSlugPart(citation) {
  if (/^OAR\s/.test(citation)) {
    return citation.replace(/^OAR\s+/, '').replace(/\(\d+\)$/, '')
  }
  const rest = citation.replace(/^ORS\s+(?:ch\.\s*)?/, '')
  return rest.split(/[-–]/)[0].trim()
}

/**
 * Parse the three markdown tables in docs/TC_OREGON_COMPLIANCE.md (each row:
 * | Trigger | Required | OREF # | Citation + why |). Every ORS/OAR citation
 * token found in the "Citation + why" cell becomes one matrix row; the URL is
 * resolved from that cell's markdown links when the numeric/dash portion
 * matches.
 */
function parseComplianceMarkdown(mdText, sourceLabel) {
  const rows = []
  const skipFirstCell = new Set(['Trigger', 'Broker role', 'Property fact', 'Property fact` ', ''])
  const citeRe = /\b(?:ORS|OAR)\s+(?:ch\.\s*)?[0-9][0-9.\-–]*(?:\(\d+\))?/g

  for (const line of mdText.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed.startsWith('|')) continue
    const cells = trimmed
      .replace(/^\|/, '')
      .replace(/\|$/, '')
      .split('|')
      .map((c) => c.trim())
    if (cells.length < 4) continue
    if (/^:?-{2,}:?$/.test(cells[1])) continue // separator row
    if (skipFirstCell.has(cells[0])) continue

    const [trigger, required, oref, citationWhy] = cells
    const links = [...citationWhy.matchAll(/\[([^\]]+)\]\(([^)]+)\)/g)].map((m) => ({ label: m[1], url: m[2] }))
    const plain = stripMdInline(citationWhy)

    const seen = new Set()
    for (const m of plain.matchAll(citeRe)) {
      const citation = m[0].replace(/\s+/g, ' ').trim().replace(/[.,;]$/, '')
      if (seen.has(citation)) continue
      seen.add(citation)

      const slugPart = citationSlugPart(citation).toLowerCase()
      let url = null
      for (const l of links) {
        if (slugPart && l.url.toLowerCase().includes(slugPart)) {
          url = l.url
          break
        }
      }
      if (!url && links.length === 1) url = links[0].url

      rows.push({
        citation,
        heading: stripMdInline(`${trigger}: ${required}`).slice(0, 300),
        body: `${plain} [${sourceLabel}, OREF ${oref || 'n/a'}]`,
        url,
      })
    }
  }
  return rows
}

/**
 * Parse DOC_RULES out of lib/tc/required-documents.ts as TEXT (no TS
 * compile/execute) — every entry is `{ id: '...', label: '...'|"...",
 * orefForm: '...'|null, severity: '...', citation: '...'|"...", ... }` in that
 * fixed field order, so a bracket-free field scan per entry is reliable.
 */
function parseDocRules(tsText, sourceLabel) {
  const arrayMatch = tsText.match(/export const DOC_RULES:\s*DocRule\[\]\s*=\s*\[([\s\S]*?)\n\]/)
  if (!arrayMatch) return []
  const chunks = arrayMatch[1].split(/(?=\{\s*\n\s*id:\s*['"])/).filter((c) => /id:\s*['"]/.test(c))

  function field(chunk, name) {
    const re = new RegExp(`${name}:\\s*(?:'([^']*)'|"([^"]*)"|null)`)
    const m = chunk.match(re)
    if (!m) return null
    if (m[1] !== undefined) return m[1]
    if (m[2] !== undefined) return m[2]
    return null // literal `null`
  }

  const rows = []
  for (const chunk of chunks) {
    const id = field(chunk, 'id')
    const label = field(chunk, 'label')
    const orefForm = field(chunk, 'orefForm')
    const severity = field(chunk, 'severity')
    const citation = field(chunk, 'citation')
    if (!citation || !label) continue
    rows.push({
      citation,
      heading: label,
      body: `${label}. OREF form ${orefForm ?? 'n/a'}, severity: ${severity ?? 'unknown'} (rule id: ${id}). ${sourceLabel}. ${citation}`,
      url: null,
    })
  }
  return rows
}

async function ingestMatrix(limit) {
  const mdPath = join(REPO_ROOT, 'docs/TC_OREGON_COMPLIANCE.md')
  const tsPath = join(REPO_ROOT, 'lib/tc/required-documents.ts')
  const mdRows = existsSync(mdPath) ? parseComplianceMarkdown(readFileSync(mdPath, 'utf8'), 'docs/TC_OREGON_COMPLIANCE.md') : []
  const tsRows = existsSync(tsPath) ? parseDocRules(readFileSync(tsPath, 'utf8'), 'lib/tc/required-documents.ts DOC_RULES') : []

  console.log(`[matrix] parsed ${mdRows.length} citation rows from TC_OREGON_COMPLIANCE.md, ${tsRows.length} from required-documents.ts`)

  // Merge: the compliance doc's rows (real URLs) win; DOC_RULES fills gaps.
  const merged = new Map()
  for (const r of mdRows) merged.set(r.citation, r)
  for (const r of tsRows) if (!merged.has(r.citation)) merged.set(r.citation, r)

  const already = await existingCitations('matrix', CORPUS_VERSION)
  let fetched = 0
  let inserted = 0
  let skippedExisting = 0
  let errors = 0

  for (const row of merged.values()) {
    if (fetched >= limit) break
    if (already.has(row.citation)) {
      skippedExisting++
      continue
    }
    fetched++
    const dbRow = {
      source: 'matrix',
      citation: row.citation,
      heading: row.heading,
      body: row.body,
      url: row.url ?? null,
      effective_date: null,
      corpus_version: CORPUS_VERSION,
      checksum: sha256(row.body),
    }
    const error = await upsertRow(dbRow)
    if (error) {
      errors++
      console.warn(`[matrix] ERROR upserting ${row.citation}: ${error.message}`)
    } else {
      inserted++
      console.log(`[matrix] + ${row.citation}`)
    }
  }
  console.log(`[matrix] done: inserted ${inserted}, skipped-existing ${skippedExisting}, errors ${errors}`)
  return { inserted, skippedExisting, errors }
}

// ── summary ──────────────────────────────────────────────────────────────────
async function printTotals() {
  console.log('\n=== legal_corpus totals (all corpus_versions) ===')
  let total = 0
  for (const s of ['ors', 'oar', 'matrix']) {
    const { count, error } = await supabase.from('legal_corpus').select('id', { count: 'exact', head: true }).eq('source', s)
    if (error) {
      console.warn(`  ${s}: count error — ${error.message}`)
      continue
    }
    console.log(`  ${s}: ${count ?? 0} rows`)
    total += count ?? 0
  }
  console.log(`  TOTAL: ${total} rows`)
}

async function main() {
  console.log(
    `legal-corpus ingest — corpus_version=${CORPUS_VERSION} sources=${SOURCES.join(',')} limit=${
      Number.isFinite(LIMIT) ? LIMIT : 'none'
    }`
  )
  const results = {}
  if (SOURCES.includes('matrix')) results.matrix = await ingestMatrix(LIMIT)
  if (SOURCES.includes('ors')) results.ors = await ingestOrs(LIMIT)
  if (SOURCES.includes('oar')) results.oar = await ingestOar(LIMIT)

  console.log('\n=== this run ===')
  for (const [k, v] of Object.entries(results)) {
    console.log(`  ${k}: inserted ${v.inserted}, skipped-existing ${v.skippedExisting}, errors ${v.errors}`)
  }
  await printTotals()
}

main().catch((err) => {
  console.error('ingest-legal-corpus: fatal error:', err)
  process.exit(1)
})
