#!/usr/bin/env node
/**
 * SkySlope Listings/Sales "file folder" master audit.
 * Reads API metadata + optional PDF text (prioritized, capped) and emits Markdown.
 *
 * Usage:
 *   npm run skyslope:forms-audit > docs/skyslope-forms-folder-master-audit.md
 *
 * Requires .env.local with SKYSLOPE_* credentials (not committed).
 */
import fs from 'fs'
import crypto from 'crypto'
import path from 'path'
import { fileURLToPath } from 'url'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const ENV_PATH = path.join(ROOT, '.env.local')

const BASE = 'https://api-latest.skyslope.com'
const MAX_DEEP_READS = 420
/** Large signed offer packages often exceed 3–5 MB. */
const MAX_PDF_BYTES = 9_000_000
const CONCURRENCY = 4

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
  const res = await fetch(`${BASE}/auth/login`, {
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

function apiHeaders(session, extra = {}) {
  return {
    'Content-Type': 'application/json',
    Session: session,
    timestamp: new Date().toISOString(),
    Accept: 'application/json',
    ...extra,
  }
}

async function fetchPaged(session, kind) {
  const all = []
  for (let page = 1; page <= 200; page++) {
    const u = `${BASE}/api/files/${kind}?fromDate=2000-01-01&toDate=2035-12-31&page=${page}&pageSize=50`
    const r = await fetch(u, { headers: apiHeaders(session) })
    if (!r.ok) throw new Error(`${kind} page ${page}: ${r.status}`)
    const j = await r.json()
    const rows = j?.value?.[kind] ?? []
    all.push(...rows)
    if (rows.length < 50) break
  }
  return all
}

async function fetchListingDetail(session, listingGuid) {
  const r = await fetch(`${BASE}/api/files/listings/${listingGuid}`, { headers: apiHeaders(session) })
  if (!r.ok) return null
  return r.json()
}

async function fetchSaleDetail(session, saleGuid) {
  const r = await fetch(`${BASE}/api/files/sales/${saleGuid}`, { headers: apiHeaders(session) })
  if (!r.ok) return null
  return r.json()
}

async function fetchDocuments(session, kind, guid) {
  const r = await fetch(`${BASE}/api/files/${kind}/${guid}/documents`, { headers: apiHeaders(session) })
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

function parseDate(d) {
  if (!d || d === '0001-01-01T00:00:00') return null
  const t = Date.parse(d)
  return Number.isFinite(t) ? t : null
}

function fmtDate(iso) {
  const t = parseDate(iso)
  if (!t) return 'n/a'
  return new Date(t).toISOString().slice(0, 10)
}

function inferKind(fileName, name) {
  const t = `${fileName || ''} ${name || ''}`.toLowerCase()

  const rules = [
    [/termination|terminate|notice of default|notice to|mutual.*rescission|cancellation|withdraw|withdrawn|rescind|release of earnest|release of buyer/i, 'termination_or_release'],
    [/counter|counteroffer/i, 'counter_or_counteroffer'],
    [/addendum/i, 'addendum'],
    [
      /residential sale agreement|sale agreement|rsa\b|oref 101|oref101|oref.?001|residential_real_estate_sale|rrea/i,
      'sale_agreement_or_rsa',
    ],
    [/listing agreement|listing contract|exclusive|oref 015|oref015/i, 'listing_agreement'],
    [/initial agency|042|pamphlet|disclosure pamphlet/i, 'agency_disclosure_pamphlet'],
    [/disclosure|spd|seller.*property|property disclosure/i, 'seller_property_disclosure'],
    [/inspection|repair|request for repair/i, 'inspection_or_repair'],
    [/pre[-\s]?approval|prequal|approval letter|underwrit|loan/i, 'lender_financing'],
    [/earnest|wire|deposit/i, 'earnest_or_wire'],
    [/hoa|ccr|title|preliminary|title report/i, 'title_or_hoa'],
    [/offer|purchase agreement|buyer/i, 'buyer_offer_or_package'],
    [/counteroffer no|seller.?s counter|buyer.?s counter/i, 'numbered_counter'],
    [/amendment|notice/i, 'amendment_or_notice'],
    [/walk|final|verification|signing/i, 'closing_adjacent'],
  ]
  for (const [re, k] of rules) {
    if (re.test(t)) return k
  }
  if (t.includes('.pdf')) return 'other_pdf'
  return 'other'
}

function deepReadPriority(fileName, name, kind) {
  const t = `${fileName || ''} ${name || ''}`
  const s = inferKind(fileName, name)
  const p = (n) => n
  if (/termination|withdraw|rescind|release of|mutual/i.test(t)) return p(100)
  if (/residential sale agreement|sale agreement|RSA|OREF 101|OREF101/i.test(t)) return p(95)
  if (/counter|Counteroffer/i.test(t)) return p(90)
  if (/addendum/i.test(t)) return p(85)
  if (/offer/i.test(t)) return p(75)
  if (/listing agreement|Listing_Contract|015 OREF/i.test(t)) return p(70)
  if (/amendment|notice/i.test(t)) return p(65)
  if (kind === 'sale_agreement_or_rsa') return p(60)
  if (kind === 'buyer_offer_or_package') return p(55)
  if (s === 'other_pdf') return p(10)
  return p(5)
}

function summarizeFolderDocs(documents) {
  const docs = documents || []
  const sorted = [...docs].sort((a, b) => {
    const ta = parseDate(a.uploadDate) ?? parseDate(a.modifiedDate) ?? 0
    const tb = parseDate(b.uploadDate) ?? parseDate(b.modifiedDate) ?? 0
    return ta - tb
  })
  const counts = {}
  for (const d of docs) {
    const k = inferKind(d.fileName, d.name)
    counts[k] = (counts[k] || 0) + 1
  }
  const first = sorted[0]
  const last = sorted[sorted.length - 1]
  return {
    sorted,
    first,
    last,
    counts,
    offerish: counts.buyer_offer_or_package || 0,
    counters:
      (counts.counter_or_counteroffer || 0) +
      (counts.numbered_counter || 0),
    terms: counts.termination_or_release || 0,
    rsa: counts.sale_agreement_or_rsa || 0,
    listingAgr: counts.listing_agreement || 0,
    addenda: counts.addendum || 0,
  }
}

function saleCompletionRead(sale) {
  if (!sale) return 'No sale detail payload returned.'
  const st = String(sale.status || '').toLowerCase()
  const hasClose = Boolean(parseDate(sale.actualClosingDate))
  const hasAccept = Boolean(parseDate(sale.contractAcceptanceDate))
  if (hasClose) return 'API includes an **actual closing date**; treat as a **closed** path unless your office uses a different definition.'
  if (st.includes('closed')) return 'SkySlope **status** text suggests **closed** (verify against escrow).'
  if (st.includes('pending') || st.includes('under'))
    return 'SkySlope **status** suggests **pending / in escrow**; agreement may be ratified even without a populated closing date field.'
  if (hasAccept)
    return '**Contract acceptance date** is populated; that usually means a **ratified** agreement at some point (still confirm current stage in SkySlope UI).'
  return '**No strong closing signal** from acceptance/closing fields; rely on checklist + document review.'
}

function listingPipelineRead(listing) {
  if (!listing) return 'No listing detail payload returned.'
  const st = String(listing.status || '')
  if (st === 'Transaction')
    return 'Listing status is **Transaction**, which in SkySlope typically means the listing has moved into the **purchase / escrow workflow** (not merely "active on MLS").'
  if (st === 'Active') return 'Listing status is **Active** (marketing / pre-contract lane as of this snapshot).'
  if (st.toLowerCase().includes('cancel')) return 'Listing status includes **Canceled**; treat prior offer PDFs as **historical attempts** unless a sale file shows otherwise.'
  return `Listing status is **${st}** (interpret using your brokerage’s SkySlope stage definitions).`
}

/** PDF text-layer hints only — never treated as “fully executed” proof (see report preamble). */
function pdfTextCluesFromExtract(text) {
  const t = (text || '').replace(/\s+/g, ' ')
  const signals = []
  const push = (label) => signals.push(label)

  if (/DigiSign Verified/i.test(t)) push('e_sign_vendor_markers_present')
  if (/Adobe Sign|DocuSign|HelloSign/i.test(t)) push('alt_e_sign_vendor_possible')
  if (/\bACCEPTED\b|\bAccepted\b/i.test(t)) push('word_accepted_present')
  if (/\bREJECTED\b|\bDeclined\b|\bWithdrawn\b|\bTerminated\b/i.test(t)) push('negative_outcome_word_present')
  if (/\bFULLY EXECUTED\b|\bfully executed\b/i.test(t)) push('pdf_contains_fully_executed_phrase_not_proof')
  if (/Seller Initial|Buyer Initial|Signature/i.test(t)) push('signature_labels_present')

  const digi = (t.match(/DigiSign Verified/gi) || []).length
  if (digi >= 6) push('many_digisign_markers_still_not_proof_of_full_execution')

  return { signals, digiSignHits: digi, excerpt: redactContacts(t.slice(0, 900)) }
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
    pdfParse = null
  }

  const env = loadEnvLocal(ENV_PATH)
  const session = await login(env)

  const listingRows = await fetchPaged(session, 'listings')
  const saleRows = await fetchPaged(session, 'sales')

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
    folders.push({
      kind: 'listing',
      guid,
      summaryRow: L,
      listing,
      propertyLine,
      documents,
    })
  }

  for (const S of saleRows) {
    const guid = S.saleGuid
    const [detailJson, documents] = await Promise.all([
      fetchSaleDetail(session, guid),
      fetchDocuments(session, 'sales', guid),
    ])
    const sale = detailJson?.value?.sale ?? null
    const propertyLine = S.propertyAddress || safeAddress(sale?.property) || null
    folders.push({
      kind: 'sale',
      guid,
      summaryRow: S,
      sale,
      propertyLine,
      documents,
    })
  }

  const deepQueue = []
  for (const f of folders) {
    for (const d of f.documents) {
      const ext = (d.extension || '').toLowerCase()
      if (ext !== 'pdf' && d.fileName && !String(d.fileName).toLowerCase().endsWith('.pdf')) continue
      const inferred = inferKind(d.fileName, d.name)
      const pr = deepReadPriority(d.fileName, d.name, inferred)
      deepQueue.push({
        folderKey: `${f.kind}:${f.guid}`,
        folderKind: f.kind,
        folderGuid: f.guid,
        propertyLine: f.propertyLine,
        docId: d.id,
        fileName: d.fileName,
        name: d.name,
        uploadDate: d.uploadDate,
        modifiedDate: d.modifiedDate,
        url: d.url,
        inferred,
        pr,
      })
    }
  }

  deepQueue.sort((a, b) => {
    if (b.pr !== a.pr) return b.pr - a.pr
    const ta = parseDate(a.uploadDate) ?? 0
    const tb = parseDate(b.uploadDate) ?? 0
    return ta - tb
  })

  const selected = deepQueue.slice(0, MAX_DEEP_READS)
  const deepByKey = new Map()

  if (pdfParse) {
    await mapPool(selected, CONCURRENCY, async (job) => {
      try {
        const r = await fetch(job.url)
        const buf = Buffer.from(await r.arrayBuffer())
        if (buf.length > MAX_PDF_BYTES) {
          deepByKey.set(`${job.folderKey}::${job.docId}`, {
            ok: false,
            reason: `pdf too large (${buf.length} bytes)`,
          })
          return
        }
        if (buf.slice(0, 4).toString() !== '%PDF') {
          deepByKey.set(`${job.folderKey}::${job.docId}`, { ok: false, reason: 'not_pdf_bytes' })
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
        const sig = pdfTextCluesFromExtract(data.text || '')
        deepByKey.set(`${job.folderKey}::${job.docId}`, {
          ok: true,
          pages: data.numpages,
          textLen: (data.text || '').length,
          ...sig,
        })
      } catch (err) {
        deepByKey.set(`${job.folderKey}::${job.docId}`, { ok: false, reason: err.message || String(err) })
      }
    })
  }

  const now = new Date().toISOString()
  const totalDocs = folders.reduce((n, f) => n + (f.documents?.length || 0), 0)

  const lines = []
  lines.push(`# SkySlope Forms file folders master audit`)
  lines.push(``)
  lines.push(`Generated (UTC): ${now}`)
  lines.push(``)
  lines.push(
    `This report inventories **every listing file** and **every sale file** returned by the SkySlope **Listings/Sales** API in this account, including checklist activity scaffolding and the flat **Documents** library timeline.`
  )
  lines.push(``)
  lines.push(`## Important limitations (read this once)`)
  lines.push(``)
  lines.push(
    `- **"Folders"** here means **SkySlope file folders**: one row per **listingGuid** (listing file) and one row per **saleGuid** (sale file). This is not the separate **SkySlope Forms Partnership** product API.`
  )
  lines.push(
    `- **${totalDocs} documents** existed at generation time across **${listingRows.length}** listing files + **${saleRows.length}** sale files. Fully OCR-reading every scanned PDF is a batch job; this report uses **API metadata for 100% of documents** and **PDF text extraction for a prioritized subset** (${selected.length} PDFs) focused on offers, counters, RSA/sale agreement language, and termination/release patterns.`
  )
  lines.push(``)
  lines.push(`### What “fully executed” means here (Ryan Realty standard)`)
  lines.push(``)
  lines.push(
    `A document is **fully executed** only when a **qualified human reviewer** (transaction coordinator, principal broker, or compliance) confirms **all** of the following for that specific instrument and property:`
  )
  lines.push(``)
  lines.push(
    `1. **Correct parties** — Buyers and sellers (or entities) are identified and match the deal and the signature blocks.`
  )
  lines.push(
    `2. **Complete signing** — Every required signature, initial, and date on that form (and attached pages) is present for the **right** parties, not placeholders or wrong signers.`
  )
  lines.push(
    `3. **OREF / Oregon / brokerage completeness** — Statutory and contractual requirements for this transaction are satisfied: required advisories, addenda referenced by the RSA, disclosures, and any brokerage-specific checklist items are present and the **correct OREF versions** are used where version matters.`
  )
  lines.push(
    `4. **SkySlope file alignment** — Checklist activities and uploaded PDFs match what escrow and the brokerage expect for this stage.`
  )
  lines.push(``)
  lines.push(
    `**This script does not perform (1)–(4).** The “PDF text clues” column reports **extracted text-layer hints** (e.g. e-sign vendor strings). Those hints are **not** evidence of full execution and are **not** an OREF compliance audit.`
  )
  lines.push(
    `- **PII is redacted** in excerpts (emails/phones). Do not commit live SkySlope session artifacts or presigned URLs.`
  )
  lines.push(``)
  lines.push(`## Proposed naming convention (do not rename yet)`)
  lines.push(``)
  lines.push(
    `Use a single sortable prefix and stable tokens so filenames group chronologically and humans can see the story at a glance:`
  )
  lines.push(``)
  lines.push(
    `1. **Prefix date**: \`YYYY-MM-DD\` from **uploadDate** (or **modifiedDate** if upload is missing).`
  )
  lines.push(`2. **Lane**: \`LIST\` (listing file) or \`SALE\` (sale file).`)
  lines.push(`3. **MLS** (if known) as \`MLS-{number}\` else \`MLS-none\`.`)
  lines.push(`4. **Doc class** (machine token): examples \`OREF-042\`, \`OREF-015\`, \`OREF-101\`, \`OFFER\`, \`CO-SLR-01\`, \`CO-BYR-01\`, \`ADD\`, \`AMD\`, \`SPD\`, \`LENDER\`, \`TITLE\`, \`EMD\`, \`MISC\`. Derive OREF numbers from the filename when present.`)
  lines.push(`5. **Round index** (offers only): \`R01\`, \`R02\`… increment whenever a new buyer offer package begins (heuristic: new "Offer" PDF with later date).`)
  lines.push(
    `6. **Human review token** (suffix, optional): use \`TC-PENDING\`, \`TC-OK\`, or \`UNKNOWN\` **only** after a human applies the “fully executed” standard above. **Do not** derive \`TC-OK\` from e-sign marker counts.`
  )
  lines.push(`7. **Original stem preserved** at the end for traceability: \`__orig-{sanitized}\`.`)
  lines.push(``)
  lines.push(
    `**Example (illustrative):** \`2026-03-17__LIST__MLS-220199105__OREF-015__LISTING-AGREEMENT__TC-OK__orig-Listing-Agreement-Exclusive-015-OREF.pdf\` (TC-OK only if a reviewer signed off).`
  )
  lines.push(``)
  lines.push(`## Folder index`)
  lines.push(``)
  lines.push(`| # | Type | Address / label | MLS | SkySlope status | Docs |`)
  lines.push(`|---:|---|---|---|---|---:|`)
  let idx = 1
  for (const f of folders) {
    const mls = f.kind === 'listing' ? f.listing?.mlsNumber || f.summaryRow?.mlsNumber : f.sale?.mlsNumber || f.summaryRow?.mlsNumber
    const st = f.kind === 'listing' ? f.listing?.status || f.summaryRow?.status : f.sale?.status || f.summaryRow?.status
    const addr = redactContacts(f.propertyLine || 'n/a')
    lines.push(
      `| ${idx} | ${f.kind} | ${addr.replace(/\|/g, '\\|')} | ${mls || ''} | ${st || ''} | ${f.documents.length} |`
    )
    idx += 1
  }

  lines.push(``)
  lines.push(`## Executive summaries (one paragraph per folder)`)
  lines.push(``)
  lines.push(
    `These paragraphs are **machine-assisted** from SkySlope API fields + filename heuristics + (where available) **PDF text clues** (not full execution review). They are an **orientation map** only; OREF completeness and signatory correctness require a **human expert**.`
  )
  lines.push(``)
  for (const f of folders) {
    const addr = redactContacts(f.propertyLine || f.guid)
    const mls = f.kind === 'listing' ? f.listing?.mlsNumber : f.sale?.mlsNumber
    const st = f.kind === 'listing' ? f.listing?.status : f.sale?.status
    const s = summarizeFolderDocs(f.documents)
    const firstD = s.first
    const lastD = s.last
    const firstClass = firstD ? inferKind(firstD.fileName, firstD.name) : 'n/a'
    const lastClass = lastD ? inferKind(lastD.fileName, lastD.name) : 'n/a'
    const fnFirst = redactContacts(firstD?.fileName || firstD?.name || 'n/a')
    const fnLast = redactContacts(lastD?.fileName || lastD?.name || 'n/a')
    const completion = f.kind === 'sale' ? saleCompletionRead(f.sale) : listingPipelineRead(f.listing)
    let linkNote = ''
    if (f.kind === 'sale' && f.sale?.listingGuid) {
      linkNote = ` Linked **listingGuid** \`${f.sale.listingGuid}\` (scroll to the listing file section with the same guid to see pre-contract paperwork).`
    }
    lines.push(
      `- **${f.kind}** (${addr}, MLS **${mls || 'n/a'}**, SkySlope status **${st || 'n/a'}**): **${f.documents.length}** documents from **${fmtDate(firstD?.uploadDate || firstD?.modifiedDate)}** (${fnFirst}, inferred **${firstClass}**) through **${fmtDate(lastD?.uploadDate || lastD?.modifiedDate)}** (${fnLast}, inferred **${lastClass}**). Heuristic counts in this folder: offer-like **${s.offerish}**, counter-like **${s.counters}**, addendum-like **${s.addenda}**, termination/release-like **${s.terms}**, RSA/sale-agreement-like **${s.rsa}**, listing-agreement-like **${s.listingAgr}**. ${completion}${linkNote}`
    )
  }

  for (const f of folders) {
    lines.push(``)
    lines.push(`---`)
    lines.push(``)
    const titleAddr = redactContacts(f.propertyLine || f.guid)
    const mls = f.kind === 'listing' ? f.listing?.mlsNumber : f.sale?.mlsNumber
    const st = f.kind === 'listing' ? f.listing?.status : f.sale?.status
    lines.push(`## ${f.kind === 'listing' ? 'Listing file' : 'Sale file'}: ${titleAddr}`)
    lines.push(``)
    lines.push(`- **Folder id (\`${f.kind}Guid\`)**: \`${f.guid}\``)
    lines.push(`- **MLS**: ${mls || 'n/a'}`)
    lines.push(`- **SkySlope status**: ${st || 'n/a'}`)
    if (f.kind === 'listing' && f.listing) {
      lines.push(`- **Listing price (SkySlope)**: ${f.listing.listingPrice ?? 'n/a'}`)
      lines.push(`- **Expiration**: ${fmtDate(f.listing.expirationDate)}`)
      lines.push(`- **Checklist type**: ${redactContacts(f.listing.checklistType || 'n/a')}`)
      lines.push(`- **Created on**: ${fmtDate(f.listing.createdOn)}`)
    }
    if (f.kind === 'sale' && f.sale) {
      lines.push(`- **Linked listingGuid**: ${f.sale.listingGuid || 'n/a'}`)
      lines.push(`- **Sale price / list price**: ${f.sale.salePrice ?? 'n/a'} / ${f.sale.listingPrice ?? 'n/a'}`)
      lines.push(`- **Contract acceptance**: ${fmtDate(f.sale.contractAcceptanceDate)}`)
      lines.push(`- **Escrow closing**: ${fmtDate(f.sale.escrowClosingDate)}`)
      lines.push(`- **Actual closing**: ${fmtDate(f.sale.actualClosingDate)}`)
      lines.push(`- **Checklist type**: ${f.sale.checklistType || 'n/a'}`)
      lines.push(`- **Created on**: ${fmtDate(f.sale.createdOn)}`)
    }

    lines.push(``)
    lines.push(`### Checklist activities (SkySlope "sections")`)
    lines.push(``)
    const checklist = f.kind === 'listing' ? f.listing?.checklist : f.sale?.checklist
    const activities = Array.isArray(checklist?.activities) ? [...checklist.activities] : []
    activities.sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    if (!activities.length) {
      lines.push(`_No checklist activities returned._`)
    } else {
      lines.push(`| Order | Activity | Type | Status | Assigned | Attached doc names |`)
      lines.push(`|---:|---|---|---|---|---|`)
      for (const a of activities) {
        const names = []
        for (const cd of a.checklistDocs || []) {
          if (cd?.fileName) names.push(cd.fileName)
        }
        const nameStr = redactContacts(names.join('; ') || (a.docs || []).join('; ') || '')
        lines.push(
          `| ${a.order ?? ''} | ${redactContacts(a.activityName || '')} | ${a.typeName || ''} | ${a.status || ''} | ${fmtDate(a.dateAssigned)} | ${nameStr.replace(/\|/g, '\\|')} |`
        )
      }
    }

    lines.push(``)
    lines.push(`### Documents library (chronological)`)
    lines.push(``)
    lines.push(
      `Sorted by **uploadDate** (fallback **modifiedDate**). Each row includes an inferred **doc class** from the filename and optional **PDF text clues** when this document was selected for text extraction (still **not** a full execution review).`
    )
    lines.push(``)
    lines.push(`| # | Upload | Modified | Inferred class | File name | PDF text clues |`)
    lines.push(`|---:|---|---|---|---|---|`)
    const docs = [...f.documents].sort((a, b) => {
      const ta = parseDate(a.uploadDate) ?? parseDate(a.modifiedDate) ?? 0
      const tb = parseDate(b.uploadDate) ?? parseDate(b.modifiedDate) ?? 0
      return ta - tb
    })
    let n = 1
    for (const d of docs) {
      const inferred = inferKind(d.fileName, d.name)
      const k = `${f.kind}:${f.guid}::${d.id}`
      const deep = deepByKey.get(k)
      let deepCell = '_no_text_extract_'
      if (!pdfParse) deepCell = '_pdf-parse not installed; metadata only_'
      else if (deep && deep.ok)
        deepCell = `pages=${deep.pages}, textLen=${deep.textLen}, signals=${(deep.signals || []).join(', ')}`
      else if (deep && !deep.ok) deepCell = `error: ${redactContacts(deep.reason || '')}`

      lines.push(
        `| ${n} | ${fmtDate(d.uploadDate)} | ${fmtDate(d.modifiedDate)} | ${inferred} | ${redactContacts(d.fileName || d.name || '').replace(/\|/g, '\\|')} | ${String(deepCell).replace(/\|/g, '\\|')} |`
      )
      n += 1
    }

    lines.push(``)
    lines.push(`### Narrative timeline (best-effort)`)
    lines.push(``)

    const offerish = docs.filter((d) => inferKind(d.fileName, d.name) === 'buyer_offer_or_package')
    const counters = docs.filter((d) => inferKind(d.fileName, d.name) === 'counter_or_counteroffer')
    const numbered = docs.filter((d) => inferKind(d.fileName, d.name) === 'numbered_counter')
    const terms = docs.filter((d) => inferKind(d.fileName, d.name) === 'termination_or_release')
    const rsa = docs.filter((d) => inferKind(d.fileName, d.name) === 'sale_agreement_or_rsa')

    const bullets = []
    bullets.push(
      `- **Forms inventory**: ${docs.length} documents. Checklist activities: ${activities.length}.`
    )
    if (f.kind === 'sale') {
      bullets.push(
        `- **Sale file interpretation**: treat SkySlope **sale status** + **contract acceptance / closing dates** as the strongest signals for whether a purchase agreement path completed.`
      )
    }
    if (f.kind === 'listing') {
      bullets.push(
        `- **Listing file interpretation**: listing-side PDFs often include **multiple negotiation rounds** even before a sale file exists; use upload ordering + filenames like "Offer", "counter", and OREF counter forms.`
      )
    }
    bullets.push(
      `- **Offer-like PDFs detected by filename heuristics**: ${offerish.length} ("offer" family). **Counter-like**: ${counters.length + numbered.length} (includes OREF counter forms when matched). **Termination/release-like**: ${terms.length}. **RSA / sale agreement-like**: ${rsa.length}.`
    )
    if (!pdfParse) {
      bullets.push(
        `- **PDF text extraction**: skipped because \`pdf-parse\` was not available in this Node environment. Install it locally if you want text-layer clues: \`npm i pdf-parse\` then re-run.`
      )
    } else {
      bullets.push(
        `- **PDF text extraction coverage**: ${selected.filter((j) => j.folderKey === `${f.kind}:${f.guid}`).length} PDFs in this folder were text-extracted (global cap ${MAX_DEEP_READS}).`
      )
    }

    lines.push(...bullets)

    lines.push(``)
    lines.push(`#### Suggested "deal story" paragraph (template)`)
    lines.push(``)
    lines.push(
      `Fill in the bracketed parts after human review of the PDFs: "This ${f.kind} file for **[address]** (MLS **[mls]**) shows SkySlope status **${st || 'n/a'}**. The document timeline begins **[earliest doc date]** with **[earliest doc class]** and ends **[latest doc date]** with **[latest doc class]**. Negotiation PDFs suggest **[N]** offer-like uploads and **[M]** counter-like uploads; termination/release-like uploads = **[T]**. Based on SkySlope dates/status${f.kind === 'sale' ? ' and closing/acceptance fields' : ''}, the purchase agreement path looks **[completed vs not completed]** with confidence **[high/med/low]** because **[reason]**."`
    )
  }

  lines.push(``)
  lines.push(`## Appendix: PDF text extraction selection stats`)
  lines.push(``)
  lines.push(`- **Queued PDFs**: ${deepQueue.length}`)
  lines.push(`- **PDF text extraction attempts**: ${selected.length}`)
  lines.push(`- **pdf-parse installed**: ${Boolean(pdfParse)}`)

  process.stdout.write(lines.join('\n'))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
