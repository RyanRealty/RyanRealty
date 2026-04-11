#!/usr/bin/env node
/**
 * SkySlope Forms — comprehensive per-file log (every document, PDF read,
 * categorization, offer timeline, suggested filenames). Matt is final say on
 * execution and renames.
 *
 *   npm run skyslope:forms-comprehensive-log > docs/skyslope-forms-comprehensive-file-log.md
 *   Multi-sheet Excel (parties, docs, checklist, dates): npm run skyslope:forms-workbook
 *   (add npm --silent if your npm prints lifecycle lines into the redirected file)
 *
 * Requires .env.local SKYSLOPE_* and devDependency pdf-parse.
 * Optional: SKYSLOPE_INCLUDE_ARCHIVED=1, SKYSLOPE_LOG_CONCURRENCY=6,
 * SKYSLOPE_PAGE_PACE_MS (default 250) between folder-list pages to reduce 429s.
 */
import fs from 'fs'
import crypto from 'crypto'
import path from 'path'
import { fileURLToPath } from 'url'
import { createRequire } from 'module'
import { fetchSkyslopeFileFolderRows, skyslopeFetchWithRetry } from './skyslope-files-api.mjs'
import {
  fmtDate,
  inferKind,
  parseDate,
  suggestStandardName,
} from './skyslope-forms-document-taxonomy.mjs'

const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const ENV_PATH = path.join(ROOT, '.env.local')

const BASE = 'https://api-latest.skyslope.com'
const INCLUDE_ARCHIVED = process.env.SKYSLOPE_INCLUDE_ARCHIVED === '1'
const MAX_PDF_BYTES = Number(process.env.SKYSLOPE_MAX_PDF_BYTES || 9_000_000)
const CONCURRENCY = Math.min(
  12,
  Math.max(1, Number.parseInt(String(process.env.SKYSLOPE_LOG_CONCURRENCY || '6'), 10) || 6)
)

function loadEnvLocal(envPath) {
  const raw = fs.readFileSync(envPath, 'utf8')
  const env = {}
  for (const line of raw.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq <= 0) continue
    const key = trimmed.slice(0, eq).trim()
    let val = trimmed.slice(eq + 1).trim()
    if (val.startsWith('"') && val.endsWith('"'))
      val = val.slice(1, -1).replace(/\\n/g, '\n')
    else if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1)
    env[key] = val
  }
  return env
}

async function login(env) {
  const timestamp = new Date().toISOString()
  const hmac = crypto
    .createHmac('sha256', env.SKYSLOPE_ACCESS_SECRET.trim())
    .update(`${env.SKYSLOPE_CLIENT_ID.trim()}:${env.SKYSLOPE_CLIENT_SECRET.trim()}:${timestamp}`)
    .digest('base64')
  const res = await skyslopeFetchWithRetry(`${BASE}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `ss ${env.SKYSLOPE_ACCESS_KEY.trim()}:${hmac}`,
      Timestamp: timestamp,
    },
    body: JSON.stringify({
      ClientId: env.SKYSLOPE_CLIENT_ID.trim(),
      ClientSecret: env.SKYSLOPE_CLIENT_SECRET.trim(),
    }),
  })
  const j = await res.json()
  if (!j.Session) throw new Error(`Login failed: ${JSON.stringify(j).slice(0, 400)}`)
  return j.Session
}

function apiHeaders(session) {
  return {
    'Content-Type': 'application/json',
    Session: session,
    timestamp: new Date().toISOString(),
    Accept: 'application/json',
  }
}

async function fetchListingDetail(session, listingGuid) {
  const r = await skyslopeFetchWithRetry(`${BASE}/api/files/listings/${listingGuid}`, {
    headers: apiHeaders(session),
  })
  if (!r.ok) return null
  return r.json()
}

async function fetchSaleDetail(session, saleGuid) {
  const r = await skyslopeFetchWithRetry(`${BASE}/api/files/sales/${saleGuid}`, {
    headers: apiHeaders(session),
  })
  if (!r.ok) return null
  return r.json()
}

async function fetchDocuments(session, kind, guid) {
  const r = await skyslopeFetchWithRetry(`${BASE}/api/files/${kind}/${guid}/documents`, {
    headers: apiHeaders(session),
  })
  if (!r.ok) return []
  const j = await r.json()
  return j?.value?.documents ?? []
}

function redactContacts(s) {
  if (!s || typeof s !== 'string') return s
  return s
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[email redacted]')
    .replace(/\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/g, '[phone redacted]')
}

function safeAddress(prop) {
  if (!prop) return null
  const n = prop.streetNumber || ''
  const s = prop.streetAddress || ''
  const u = prop.unit || ''
  const c = prop.city || ''
  const st = prop.state || ''
  const z = prop.zip || ''
  const line = [n, s, u].filter(Boolean).join(' ').trim()
  const tail = [c, st, z].filter(Boolean).join(', ')
  return [line, tail].filter(Boolean).join(', ')
}

function negotiationOutcomeHint(text, fileName) {
  const t = `${text || ''} ${fileName || ''}`.replace(/\s+/g, ' ')
  if (/termination|terminated|withdrawn|withdraw|rescind|mutual/i.test(t)) return 'termination_or_withdrawal_language'
  if (/\breject|\bdeclin/i.test(t)) return 'rejection_or_decline_language'
  if (/\baccept|\bratif/i.test(t)) return 'acceptance_or_ratification_language'
  if (/DigiSign Verified/i.test(t)) return 'e_sign_present'
  return 'no_strong_outcome_keyword'
}

function extractSignatoryHints(text, max = 12) {
  const t = redactContacts(String(text || '').replace(/\s+/g, ' '))
  const names = new Set()
  const reDigi = /DigiSign Verified[^\n]{0,80}?([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/g
  let m
  while ((m = reDigi.exec(t)) !== null) {
    const n = m[1]?.trim()
    if (n && n.length < 50 && !/Verified|DigiSign/i.test(n)) names.add(n)
    if (names.size >= max) break
  }
  return [...names].slice(0, max)
}

function executionFirstPass(kind, text, fileName) {
  const t = `${text || ''} ${fileName || ''}`
  const digi = (t.match(/DigiSign Verified/gi) || []).length
  const hasSigLabels = /Seller Initial|Buyer Initial|Signature|By:/i.test(t)
  const thin = String(text || '').replace(/\s+/g, '').length < 80

  if (kind === 'listing_agreement' || kind === 'agency_disclosure_pamphlet') {
    if (thin) return { label: 'partial_or_scanned', detail: 'Little extractable text; seller-side completeness needs visual.' }
    if (digi >= 2 || hasSigLabels) return { label: 'likely_seller_executed', detail: 'E-sign or signature labels present; confirm seller/firm lines visually.' }
    return { label: 'unknown', detail: 'Confirm seller and firm signatures on PDF.' }
  }
  if (kind === 'buyer_offer_or_package' || kind === 'sale_agreement_or_rsa' || kind === 'numbered_counter' || kind === 'counter_or_counteroffer' || kind === 'addendum') {
    if (thin) return { label: 'partial_or_scanned', detail: 'Offer stack often image-heavy; mutual execution needs visual.' }
    if (digi >= 4 && hasSigLabels) return { label: 'likely_mutual_or_in_progress', detail: 'Multiple e-sign markers; map to buyer vs seller blocks in PDF.' }
    if (digi >= 1) return { label: 'partial_e_sign', detail: 'Some e-sign markers; check all required initials.' }
    return { label: 'unknown', detail: 'Open PDF for mutual vs single-party obligations.' }
  }
  if (kind === 'lender_financing') {
    return { label: 'buyer_side_doc', detail: 'Expect buyer/lender execution only if applicable.' }
  }
  return { label: 'see_pdf', detail: 'Classify obligations by form type; verify in viewer.' }
}

function contentDigest(text, maxLen = 900) {
  const raw = redactContacts(String(text || '').replace(/\s+/g, ' ').trim())
  if (!raw) return '_no extractable text (likely image PDF or empty layer)_'
  return raw.length > maxLen ? `${raw.slice(0, maxLen)}…` : raw
}

function offerNumberFromFilename(fn) {
  const s = String(fn || '')
  const m =
    s.match(/offer\s*[_\s]*(\d+)/i) ||
    s.match(/Offer\s*(\d+)/i) ||
    s.match(/Offer_(\d+)/i)
  return m ? Number(m[1]) : null
}

function estimateOfferCount(docsSorted) {
  const nums = new Set()
  let offerFiles = 0
  for (const d of docsSorted) {
    const fn = d.fileName || d.name || ''
    const k = inferKind(fn, d.name)
    const n = offerNumberFromFilename(fn)
    if (n !== null) nums.add(n)
    if (k === 'buyer_offer_or_package' && /\boffer\b/i.test(fn) && !/counter/i.test(fn)) offerFiles += 1
    const rsaKey = fn.toLowerCase()
    if (
      /sale_agreement\.pdf$/i.test(fn) ||
      /rrea|oref_001|residential_real_estate_sale|residential sale agreement/i.test(rsaKey)
    ) {
      offerFiles += 1
    }
  }
  const fromNums = nums.size ? Math.max(...nums) : 0
  return Math.max(fromNums, offerFiles)
}

function buildNegotiationLog(docsSorted) {
  const lines = []
  for (const d of docsSorted) {
    const fn = d.fileName || d.name || ''
    const k = inferKind(fn, d.name)
    const isNeg =
      k === 'buyer_offer_or_package' ||
      k === 'sale_agreement_or_rsa' ||
      k === 'counter_or_counteroffer' ||
      k === 'numbered_counter' ||
      k === 'termination_or_release' ||
      k === 'addendum'
    if (!isNeg && !/offer|counter|sale.?agreement|rsa|termination|withdraw/i.test(fn)) continue
    const hint = d._outcomeHint || negotiationOutcomeHint(d._text || '', fn)
    lines.push(
      `| ${fmtDate(d.uploadDate || d.modifiedDate)} | ${k} | ${String(fn).replace(/\|/g, '\\|')} | ${hint.replace(/\|/g, '\\|')} |`
    )
  }
  return lines
}

async function mapPool(items, concurrency, fn) {
  const ret = new Array(items.length)
  let i = 0
  async function worker() {
    while (true) {
      const idx = i++
      if (idx >= items.length) break
      ret[idx] = await fn(items[idx], idx)
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()))
  return ret
}

async function main() {
  let pdfParse = null
  try {
    pdfParse = require('pdf-parse')
  } catch {
    console.error('Install pdf-parse: npm i pdf-parse')
    process.exit(1)
  }

  const env = loadEnvLocal(ENV_PATH)
  const session = await login(env)

  const listingRows = await fetchSkyslopeFileFolderRows(
    session,
    BASE,
    'listings',
    () => apiHeaders(session),
    INCLUDE_ARCHIVED
  )
  const saleRows = await fetchSkyslopeFileFolderRows(
    session,
    BASE,
    'sales',
    () => apiHeaders(session),
    INCLUDE_ARCHIVED
  )

  const folders = []
  for (const L of listingRows) {
    const guid = L.listingGuid
    const [detailJson, documents] = await Promise.all([
      fetchListingDetail(session, guid),
      fetchDocuments(session, 'listings', guid),
    ])
    const listing = detailJson?.value?.listing ?? null
    const propertyLine =
      L.propertyAddress ||
      safeAddress(listing?.property) ||
      [listing?.property?.streetNumber, listing?.property?.streetAddress].filter(Boolean).join(' ')
    folders.push({ kind: 'listing', guid, listing, propertyLine, documents })
  }
  for (const S of saleRows) {
    const guid = S.saleGuid
    const [detailJson, documents] = await Promise.all([
      fetchSaleDetail(session, guid),
      fetchDocuments(session, 'sales', guid),
    ])
    const sale = detailJson?.value?.sale ?? null
    const propertyLine = S.propertyAddress || safeAddress(sale?.property) || null
    folders.push({ kind: 'sale', guid, sale, propertyLine, documents })
  }

  const jobs = []
  for (const f of folders) {
    const mls =
      f.kind === 'listing' ? f.listing?.mlsNumber || '' : f.sale?.mlsNumber || ''
    const lane = f.kind === 'listing' ? 'LIST' : 'SALE'
    let seq = 0
    const sorted = [...f.documents].sort((a, b) => {
      const ta = parseDate(a.uploadDate) ?? parseDate(a.modifiedDate) ?? 0
      const tb = parseDate(b.uploadDate) ?? parseDate(b.modifiedDate) ?? 0
      return ta - tb
    })
    for (const d of sorted) {
      seq += 1
      jobs.push({ folder: f, doc: d, mls, lane, seq })
    }
  }

  await mapPool(jobs, CONCURRENCY, async ({ folder, doc, mls, lane, seq }) => {
    const fn = doc.fileName || doc.name || ''
    const ext = (doc.extension || '').toLowerCase()
    const isPdf = ext === 'pdf' || String(fn).toLowerCase().endsWith('.pdf')
    doc._seq = seq
    doc._kind = inferKind(fn, doc.name)
    doc._suggestedName = suggestStandardName({
      lane,
      uploadIso: doc.uploadDate || doc.modifiedDate,
      mls,
      category: doc._kind,
      seq,
      origName: fn,
    })
    if (!isPdf || !doc.url) {
      doc._parseOk = false
      doc._parseReason = !isPdf ? 'not_pdf' : 'no_url'
      doc._text = ''
      doc._pages = 0
      return
    }
    try {
      const r = await fetch(doc.url)
      const buf = Buffer.from(await r.arrayBuffer())
      if (buf.length > MAX_PDF_BYTES) {
        doc._parseOk = false
        doc._parseReason = `oversize_${buf.length}`
        doc._text = ''
        doc._pages = 0
        return
      }
      if (buf.slice(0, 4).toString() !== '%PDF') {
        doc._parseOk = false
        doc._parseReason = 'not_pdf_bytes'
        doc._text = ''
        doc._pages = 0
        return
      }
      const log = console.log
      const err = console.error
      console.log = () => {}
      console.error = () => {}
      let data
      try {
        data = await pdfParse(buf)
      } finally {
        console.log = log
        console.error = err
      }
      doc._parseOk = true
      doc._text = data.text || ''
      doc._pages = data.numpages || 0
    } catch (e) {
      doc._parseOk = false
      doc._parseReason = e.message || String(e)
      doc._text = ''
      doc._pages = 0
    }
  })

  const now = new Date().toISOString()
  const lines = []
  lines.push(`# SkySlope Forms — comprehensive file log`)
  lines.push(``)
  lines.push(`Generated (UTC): ${now}`)
  lines.push(``)
  lines.push(
    `**Scope:** SkySlope **Forms** transaction files via \`${BASE}\` (\`GET /api/files/listings\` and \`GET /api/files/sales\`). This is the **Forms file cabinet** integration surface, **not** SkySlope Suite (different product). Archived folder rows excluded unless \`SKYSLOPE_INCLUDE_ARCHIVED=1\`.`
  )
  lines.push(
    `**Inventory accuracy:** Folder lists use swagger-correct query params (\`earliestDate\` / \`latestDate\` as Unix seconds, \`pageNumber\`, **10 rows per page**). Older scripts that used \`fromDate\` / \`page\` / \`pageSize\` stopped after the first page and under-counted folders.`
  )
  lines.push(
    `**You are the final say** on whether a document is fully executed and on any rename. This log is an **educated first pass** from PDF text plus filenames.`
  )
  lines.push(``)
  lines.push(`## Standardized naming (for the upcoming rename pass)`)
  lines.push(``)
  lines.push(
    `Pattern: \`YYYY-MM-DD__LIST|sale__MLS-{mls|none}__{category}__{seq}__{sanitized-original-stem}.pdf\` where **seq** is chronological order within that folder (001, 002, …). **category** uses the inferred type below (e.g. \`buyer-offer-or-package\`, \`numbered-counter\`, \`listing-agreement\`). After you review, you can shorten categories or add a human token like \`WAVE-02\` between MLS and category for offer rounds.`
  )
  lines.push(``)
  lines.push(`## Table of contents`)
  lines.push(``)
  let tocIdx = 1
  for (const f of folders) {
    const addr = redactContacts(f.propertyLine || f.guid).replace(/\]/g, '')
    const slug = `f${tocIdx}-${f.kind}-${f.guid.slice(0, 8)}`
    lines.push(`${tocIdx}. [${f.kind}: ${addr}](#${slug})`)
    f._slug = slug
    tocIdx += 1
  }

  let totalDocs = 0
  for (const f of folders) {
    totalDocs += f.documents.length
  }
  lines.push(``)
  lines.push(`**Total folders:** ${folders.length} · **Total documents:** ${totalDocs}`)

  for (const f of folders) {
    const sorted = [...f.documents].sort((a, b) => {
      const ta = parseDate(a.uploadDate) ?? parseDate(a.modifiedDate) ?? 0
      const tb = parseDate(b.uploadDate) ?? parseDate(b.modifiedDate) ?? 0
      return ta - tb
    })
    for (const d of sorted) {
      d._outcomeHint = negotiationOutcomeHint(d._text || '', d.fileName)
    }

    const mls = f.kind === 'listing' ? f.listing?.mlsNumber || 'n/a' : f.sale?.mlsNumber || 'n/a'
    const st = f.kind === 'listing' ? f.listing?.status || '' : f.sale?.status || ''
    const addr = redactContacts(f.propertyLine || f.guid)
    const offerCount = estimateOfferCount(sorted)

    lines.push(``)
    lines.push(`---`)
    lines.push(``)
    lines.push(`<a id="${f._slug}"></a>`)
    lines.push(`## ${f.kind === 'listing' ? 'Listing file' : 'Sale file'}: ${addr}`)
    lines.push(``)
    lines.push(`- **Guid:** \`${f.guid}\` · **MLS:** ${mls} · **SkySlope status:** ${st || 'n/a'}`)
    if (f.kind === 'sale' && f.sale?.listingGuid) {
      lines.push(`- **Linked listingGuid:** \`${f.sale.listingGuid}\``)
    }
    lines.push(`- **Document count:** ${sorted.length}`)
    lines.push(
      `- **Estimated distinct offer / RSA packages (first-pass heuristic):** **${offerCount}** (from filenames like Offer 1/2 and sale agreement stems; confirm in viewer.)`
    )

    lines.push(``)
    lines.push(`### Negotiation and contract timeline (first pass)`)
    lines.push(``)
    const logRows = buildNegotiationLog(sorted)
    if (logRows.length) {
      lines.push(`| Date | Type | File | Text hint |`)
      lines.push(`|---|---|---|---|`)
      lines.push(...logRows)
    } else {
      lines.push(`_No negotiation-shaped rows detected by filename/heuristics._`)
    }

    lines.push(``)
    lines.push(`### Full document register`)
    lines.push(``)
    lines.push(
      `| # | Upload | Category | Suggested filename | Pages | Execution (first pass) | Signatory hints | Parse | Content digest |`
    )
    lines.push(`|---:|---|---|---|---:|---|---|---|---|`)
    let n = 1
    for (const d of sorted) {
      const fn = redactContacts(d.fileName || d.name || '')
      const ex = executionFirstPass(d._kind, d._text, fn)
      const hints = extractSignatoryHints(d._text).join('; ') || '—'
      const parseCell = d._parseOk
        ? 'ok'
        : redactContacts(String(d._parseReason || 'fail')).replace(/\|/g, '\\|')
      const digest = redactContacts(contentDigest(d._text, 700)).replace(/\|/g, '\\|')
      lines.push(
        `| ${n} | ${fmtDate(d.uploadDate || d.modifiedDate)} | ${d._kind} | \`${redactContacts(d._suggestedName).replace(/`/g, "'")}\` | ${d._pages || '—'} | **${ex.label}** — ${redactContacts(ex.detail).replace(/\|/g, '\\|')} | ${hints.replace(/\|/g, '\\|')} | ${parseCell} | ${digest} |`
      )
      n += 1
    }
  }

  lines.push(``)
  lines.push(`## Next step (rename and reorganize)`)
  lines.push(``)
  lines.push(
    `1. Skim **Negotiation timeline** per folder, then **Full document register** execution column.`
  )
  lines.push(`2. Adjust suggested names (wave IDs, counter indices) where the heuristic missed nuance.`)
  lines.push(
    `3. Apply renames in SkySlope (or via API if you add PATCH automation) using the final convention you lock.`
  )

  process.stdout.write(lines.join('\n'))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
