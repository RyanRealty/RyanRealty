#!/usr/bin/env node
/**
 * check-ai-query-battery.mjs — F1: named queries (and GSC extras) resolve to
 * a citable Ryan Realty URL in /llms.txt + JSON-LD, never a 308 hop.
 *
 * Source of truth: lib/seo/ai-query-map.json
 * Live production fetch is evidence-only (never fails CI if prod is one SHA behind).
 *
 * Run: node scripts/check-ai-query-battery.mjs   (wired into ci:gates)
 */
import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { CI_PROBE_HEADERS } from './lib/ci-probe-ua.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const MAP_FILE = join(ROOT, 'lib/seo/ai-query-map.json')
const LLMS = join(ROOT, 'app/llms.txt/route.ts')
const NEXT_CONFIG = join(ROOT, 'next.config.ts')
const REGISTRY = join(ROOT, 'data/resort-communities.json')

const errors = []
const notes = []

function pathnameOf(pathWithMaybeQuery) {
  return String(pathWithMaybeQuery).split('?')[0]
}

function isPermanentHop(pathname, configSrc) {
  const needles = [`source: '${pathname}'`, `source: "${pathname}"`, `source: \`${pathname}\``]
  let idx = -1
  for (const n of needles) {
    idx = configSrc.indexOf(n)
    if (idx >= 0) break
  }
  if (idx < 0) return false
  return /permanent:\s*true/.test(configSrc.slice(idx, idx + 500))
}

if (!existsSync(MAP_FILE)) {
  console.error('AI-query-battery FAILED: lib/seo/ai-query-map.json is missing.')
  process.exit(1)
}
if (!existsSync(LLMS)) {
  console.error('AI-query-battery FAILED: app/llms.txt/route.ts is missing.')
  process.exit(1)
}

const map = JSON.parse(readFileSync(MAP_FILE, 'utf8'))
const llmsSrc = readFileSync(LLMS, 'utf8')
const configSrc = existsSync(NEXT_CONFIG) ? readFileSync(NEXT_CONFIG, 'utf8') : ''
const registry = existsSync(REGISTRY) ? JSON.parse(readFileSync(REGISTRY, 'utf8')) : { communities: [] }
const communitySlugs = new Set((registry.communities ?? []).map((c) => c.slug))
const haystack = `${llmsSrc}\n${readFileSync(MAP_FILE, 'utf8')}`

if (!llmsSrc.includes('ai-query-map.json')) {
  errors.push('app/llms.txt/route.ts no longer imports ai-query-map.json — pillars can drift from the battery.')
}

const strippedLlms = llmsSrc.replaceAll('${SITE_URL}/housing-market/reports', '')
if (strippedLlms.includes('${SITE_URL}/reports')) {
  errors.push('llms.txt still cites ${SITE_URL}/reports (308 hop). Citation target is /housing-market/reports.')
}

const f1 = (map.queries ?? []).filter((q) => q.source === 'f1')
if (f1.length < 3) {
  errors.push(`ai-query-map.json must keep the three F1 queries (found ${f1.length}).`)
}

function llmsCovers(path) {
  const pathname = pathnameOf(path)
  const pillars = map.pillars ?? []
  if (pillars.some((p) => p.path === path || pathnameOf(p.path) === pathname)) return true
  if (llmsSrc.includes(path) || llmsSrc.includes(pathname)) return true
  if (pathname.startsWith('/communities/') && llmsSrc.includes('getAllResortCommunities')) {
    const slug = pathname.slice('/communities/'.length)
    if (communitySlugs.has(slug)) return true
  }
  return false
}

for (const hop of map.hopForbiddenPathnames ?? []) {
  for (const q of map.queries ?? []) {
    for (const p of q.citablePaths ?? []) {
      if (pathnameOf(p) === hop) {
        errors.push(`${q.id}: citable path ${p} is a forbidden hop (${hop}).`)
      }
    }
  }
}

for (const q of map.queries ?? []) {
  for (const p of q.citablePaths ?? []) {
    const pn = pathnameOf(p)
    if (isPermanentHop(pn, configSrc)) {
      errors.push(`${q.id}: citable path ${p} matches a permanent redirect source in next.config.ts. Cite the survivor.`)
    }
    if (!llmsCovers(p)) {
      errors.push(`${q.id}: llms.txt does not cover citable path ${p}.`)
    }
  }
  for (const sub of q.llmsSubstrings ?? []) {
    if (!haystack.includes(sub)) {
      errors.push(`${q.id}: missing llms.txt substring "${sub}".`)
    }
  }
  for (const check of q.jsonLd ?? []) {
    const abs = join(ROOT, check.file)
    if (!existsSync(abs)) {
      errors.push(`${q.id}: JSON-LD file missing ${check.file}`)
      continue
    }
    const src = readFileSync(abs, 'utf8')
    for (const m of check.all ?? []) {
      if (!src.includes(m)) {
        errors.push(`${q.id}: ${check.file} missing JSON-LD marker \`${m}\`.`)
      }
    }
    for (const m of check.forbidden ?? []) {
      // Quoted object-key emission only. A policy comment that names the
      // banned field (reviews-jsonld.ts) is not a schema node.
      const emitted =
        m === 'aggregateRating'
          ? /['"]aggregateRating['"]\s*:/.test(src)
          : src.includes(m)
      if (emitted) {
        errors.push(`${q.id}: ${check.file} must not emit \`${m}\`.`)
      }
    }
  }
}

if (errors.length === 0) {
  console.log(
    `AI-query-battery passed — ${map.queries.length} queries, ${map.pillars.length} llms.txt pillars, hop URLs excluded.`,
  )
} else {
  console.error('\nAI-query-battery FAILED:')
  for (const e of errors) console.error('  - ' + e)
  process.exitCode = 1
}

const liveUrl = 'https://ryan-realty.com/llms.txt'
try {
  const res = await fetch(liveUrl, { headers: { ...CI_PROBE_HEADERS }, redirect: 'manual' })
  const body = res.ok ? await res.text() : ''
  if (!res.ok) {
    notes.push(`LIVE ${res.status} ${liveUrl} (not a CI fail — prod may lag this SHA)`)
  } else {
    const missing = (map.pillars ?? [])
      .map((p) => p.path)
      .filter((p) => !body.includes(p))
    if (missing.length) {
      notes.push(`LIVE /llms.txt missing ${missing.length} pillar path(s) (prod SHA lag): ${missing.slice(0, 4).join(', ')}`)
    } else {
      notes.push('LIVE /llms.txt contains every pillar path.')
    }
  }
} catch (err) {
  notes.push(`LIVE fetch skipped: ${err instanceof Error ? err.message : String(err)}`)
}
for (const n of notes) console.log(`  ${n}`)
if (errors.length) process.exit(1)
