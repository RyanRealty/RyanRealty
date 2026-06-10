#!/usr/bin/env node
/**
 * TC SYSTEM MIGRATION — pull every SkySlope transaction into Ryan Realty's own
 * system of record (tc_* tables + Supabase Storage bucket `tc-documents`).
 *
 * Per folder (sale + listing):
 *   1. Fetch detail + documents LIVE from SkySlope (fresh S3 URLs).
 *   2. Download every real binary, sha256 it, upload to Storage at
 *      tc/<source_guid>/<docId>__<sanitized-name>.
 *   3. Upsert tc_deals (property grouping from master.json) / tc_cycles /
 *      tc_documents / tc_checklist_items / tc_checklist_assignments.
 *   4. ARCHIVE-prefixed filenames become archived=true + parsed reason —
 *      the name keeps its original form in `name` for provenance.
 *   5. Append tc_events rows (actor='migration') for the audit spine.
 *
 * Idempotent: re-runs upsert by (cycle_id, source_doc_id); existing Storage
 * objects are kept when the sha256 matches.
 *
 * Usage:
 *   node --env-file=.env.local scripts/tc-migrate-from-skyslope.mjs --guid=<one folder>   # smoke test
 *   node --env-file=.env.local scripts/tc-migrate-from-skyslope.mjs                       # full run
 *   node --env-file=.env.local scripts/tc-migrate-from-skyslope.mjs --verify              # counts only
 */
import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'
import { skyslopeFetchWithRetry, fetchSkyslopeDocumentBinary } from './skyslope-files-api.mjs'

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const ROOT = path.join(REPO, 'tmp/skyslope-master')
const BASE = 'https://api-latest.skyslope.com'
const BUCKET = 'tc-documents'

const onlyGuid = (process.argv.find((a) => a.startsWith('--guid=')) || '').split('=')[1] || null
const verifyOnly = process.argv.includes('--verify')

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

async function ssLogin() {
  const ts = new Date().toISOString()
  const e = process.env
  const hmac = crypto
    .createHmac('sha256', e.SKYSLOPE_ACCESS_SECRET.trim())
    .update(`${e.SKYSLOPE_CLIENT_ID.trim()}:${e.SKYSLOPE_CLIENT_SECRET.trim()}:${ts}`)
    .digest('base64')
  const r = await skyslopeFetchWithRetry(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `ss ${e.SKYSLOPE_ACCESS_KEY.trim()}:${hmac}`, Timestamp: ts },
    body: JSON.stringify({ ClientId: e.SKYSLOPE_CLIENT_ID.trim(), ClientSecret: e.SKYSLOPE_CLIENT_SECRET.trim() }),
  })
  return (await r.json()).Session
}
const H = (s) => ({ Session: s, timestamp: new Date().toISOString(), Accept: 'application/json' })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const sanitize = (s) => String(s).replace(/[\/\\:*?"<>|#%{}]/g, '_').slice(0, 180)
const d = (v) => (v && !String(v).startsWith('0001') ? String(v).slice(0, 10) : null)
const STATUS_MAP = { Required: 'required', Optional: 'optional', 'In Review': 'in_review', Completed: 'completed', 'N/A': 'na' }

function parseArchive(name) {
  if (!/^ARCHIVE/i.test(name || '')) return { archived: false, reason: null }
  // "ARCHIVE - <original> - <reason>.pdf" | "ARCHIVE_<original>" — keep tail as reason
  const m = name.match(/^ARCHIVE[\s_-]*(.*)$/i)
  return { archived: true, reason: m?.[1]?.trim()?.slice(0, 500) || 'archived in SkySlope' }
}

async function ensureBucket() {
  const { data } = await supabase.storage.getBucket(BUCKET)
  if (!data) {
    const { error } = await supabase.storage.createBucket(BUCKET, { public: false })
    if (error && !/already exists/i.test(error.message)) throw new Error(`createBucket: ${error.message}`)
  }
}

async function verify() {
  for (const t of ['tc_deals', 'tc_cycles', 'tc_documents', 'tc_checklist_items', 'tc_checklist_assignments', 'tc_events']) {
    const { count, error } = await supabase.from(t).select('*', { count: 'exact', head: true })
    console.log(`${t.padEnd(28)} ${error ? 'ERR ' + error.message : count}`)
  }
  const { data: missing } = await supabase.from('tc_documents').select('id', { count: 'exact', head: false }).is('storage_path', null).limit(5)
  const { count: missingCount } = await supabase.from('tc_documents').select('*', { count: 'exact', head: true }).is('storage_path', null)
  console.log(`docs without binary: ${missingCount}${missing?.length ? ' (sample ids: ' + missing.map((m) => m.id).join(', ') + ')' : ''}`)
}

async function main() {
  if (verifyOnly) return verify()
  await ensureBucket()

  const master = JSON.parse(await fs.readFile(path.join(ROOT, 'master.json'), 'utf8'))
  const session = await ssLogin()

  let dealCount = 0
  let docCount = 0
  let byteTotal = 0
  let failures = []

  for (const prop of master.properties) {
    const wantedCycles = prop.cycles.filter((c) => !onlyGuid || c.guid === onlyGuid)
    if (!wantedCycles.length) continue

    // upsert deal
    const addrParts = (prop.address || '').split(',').map((s) => s.trim())
    const { data: dealRow, error: dealErr } = await supabase
      .from('tc_deals')
      .upsert(
        {
          property_key: prop.key,
          address: prop.address,
          city: addrParts[1] ?? null,
          state: addrParts[2] ?? null,
          zip: addrParts[3] ?? null,
          broker_name: prop.broker,
          stage: prop.stage,
          stage_detail: prop.stageDetail,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'property_key' }
      )
      .select('id')
      .single()
    if (dealErr) throw new Error(`tc_deals upsert ${prop.key}: ${dealErr.message}`)
    dealCount++

    for (const cyc of wantedCycles) {
      const kindPath = cyc.kind === 'listings' ? 'listings' : 'sales'
      const detailKey = cyc.kind === 'listings' ? 'listing' : 'sale'

      const detailJ = await (await skyslopeFetchWithRetry(`${BASE}/api/files/${kindPath}/${cyc.guid}`, { headers: H(session) })).json()
      const detail = detailJ?.value?.[detailKey] ?? {}
      const docsJ = await (await skyslopeFetchWithRetry(`${BASE}/api/files/${kindPath}/${cyc.guid}/documents`, { headers: H(session) })).json()
      const docs = docsJ?.value?.documents || []

      const { data: cycleRow, error: cycErr } = await supabase
        .from('tc_cycles')
        .upsert(
          {
            deal_id: dealRow.id,
            kind: cyc.kind === 'listings' ? 'listing' : 'sale',
            source: 'skyslope',
            source_guid: cyc.guid,
            status: cyc.status,
            mls_number: cyc.mlsNumber,
            escrow_number: cyc.escrowNumber,
            escrow_company: cyc.escrowCompany,
            sellers: cyc.sellers ?? [],
            buyers: cyc.buyers ?? [],
            listing_price: cyc.listingPrice,
            sale_price: cyc.salePrice,
            office_gross: cyc.officeGross,
            commission_percent: cyc.commissionPercent,
            earnest_money: cyc.earnestMoney ?? null,
            listing_date: d(cyc.listingDate),
            contract_acceptance_date: d(cyc.contractAcceptanceDate),
            escrow_closing_date: d(cyc.escrowClosingDate),
            actual_closing_date: d(cyc.actualClosingDate),
            expiration_date: d(cyc.expirationDate),
            dead_date: d(cyc.deadDate),
            source_created_on: cyc.createdOn,
            portal_email: cyc.portalEmail,
            checklist_type: cyc.checklistType,
            broker_name: cyc.broker,
            raw: detail,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'source_guid' }
        )
        .select('id')
        .single()
      if (cycErr) throw new Error(`tc_cycles upsert ${cyc.guid}: ${cycErr.message}`)

      // checklist items
      const activities = detail?.checklist?.activities || []
      const itemIdByActivity = new Map()
      for (const a of activities) {
        const { data: item, error: itemErr } = await supabase
          .from('tc_checklist_items')
          .upsert(
            {
              cycle_id: cycleRow.id,
              source_activity_id: a.activityId,
              name: (a.activityName || '').trim(),
              type_name: a.typeName ?? null,
              status: STATUS_MAP[a.status] ?? 'optional',
              sort_order: a.order ?? null,
            },
            { onConflict: 'cycle_id,source_activity_id' }
          )
          .select('id')
          .single()
        if (itemErr) throw new Error(`tc_checklist_items ${cyc.guid}/${a.activityId}: ${itemErr.message}`)
        itemIdByActivity.set(a.activityId, item.id)
      }

      // documents (dedup mirror entries by docId)
      const seen = new Set()
      const real = docs.filter((doc) => {
        if (!doc || doc.fileSize === -1) return false
        const id = (doc.id || doc.documentGuid || '').toLowerCase()
        if (!id || seen.has(id)) return false
        seen.add(id)
        return true
      })

      // cheap resume: docs already migrated WITH a stored binary get skipped
      // (no re-download). Makes kill/re-run and future delta syncs fast.
      const { data: existingDocs } = await supabase
        .from('tc_documents')
        .select('id, source_doc_id, storage_path, name')
        .eq('cycle_id', cycleRow.id)
      const existingByDocId = new Map(
        (existingDocs || []).map((r) => [(r.source_doc_id || '').toLowerCase(), r])
      )

      const docIdToRow = new Map()
      for (const doc of real) {
        const docId = doc.id || doc.documentGuid
        const fileName = doc.fileName || doc.name || `doc_${docId}`
        const { archived, reason } = parseArchive(fileName)

        const prior = existingByDocId.get((docId || '').toLowerCase())
        if (prior?.storage_path && prior.name === fileName) {
          docIdToRow.set((docId || '').toLowerCase(), prior.id)
          docCount++
          continue
        }

        // download binary with fresh URL
        let buf = null
        let sha = null
        let contentType = null
        try {
          const url = doc.url || `${BASE}/api/files/${kindPath}/${cyc.guid}/documents/${docId}/binary`
          const fetched = await fetchSkyslopeDocumentBinary(url, () => H(session))
          if (fetched.ok && fetched.buf?.length) {
            buf = fetched.buf
            sha = crypto.createHash('sha256').update(buf).digest('hex')
            contentType = fetched.contentType || 'application/pdf'
          } else {
            failures.push({ guid: cyc.guid, docId, name: fileName, error: `HTTP ${fetched.status}` })
          }
        } catch (e) {
          failures.push({ guid: cyc.guid, docId, name: fileName, error: e?.message || String(e) })
        }

        let storagePath = null
        if (buf) {
          storagePath = `tc/${cyc.guid}/${docId.slice(0, 8)}__${sanitize(fileName)}`
          const { error: upErr } = await supabase.storage.from(BUCKET).upload(storagePath, buf, {
            contentType,
            upsert: true,
          })
          if (upErr) {
            failures.push({ guid: cyc.guid, docId, name: fileName, error: `storage: ${upErr.message}` })
            storagePath = null
          } else {
            byteTotal += buf.length
          }
        }

        const { data: docRow, error: docErr } = await supabase
          .from('tc_documents')
          .upsert(
            {
              cycle_id: cycleRow.id,
              source_doc_id: docId,
              name: fileName,
              original_name: fileName,
              storage_path: storagePath,
              sha256: sha,
              bytes: buf?.length ?? null,
              content_type: contentType,
              page_count: doc.pages ?? null,
              source_uploaded_at: doc.uploadDate || null,
              archived,
              archived_reason: reason,
              archived_at: archived ? new Date().toISOString() : null,
              is_broker_notes: /broker.?notes/i.test(fileName),
            },
            { onConflict: 'cycle_id,source_doc_id' }
          )
          .select('id')
          .single()
        if (docErr) throw new Error(`tc_documents ${cyc.guid}/${docId}: ${docErr.message}`)
        docIdToRow.set((docId || '').toLowerCase(), docRow.id)
        docCount++
        await sleep(60)
      }

      // checklist assignments
      const assignments = []
      for (const a of activities) {
        for (const cd of a.checklistDocs || []) {
          const docRowId = docIdToRow.get((cd.id || '').toLowerCase())
          const itemId = itemIdByActivity.get(a.activityId)
          if (docRowId && itemId) assignments.push({ item_id: itemId, document_id: docRowId })
        }
      }
      if (assignments.length) {
        const { error: asgErr } = await supabase.from('tc_checklist_assignments').upsert(assignments)
        if (asgErr) throw new Error(`assignments ${cyc.guid}: ${asgErr.message}`)
      }

      await supabase.from('tc_events').insert({
        deal_id: dealRow.id,
        cycle_id: cycleRow.id,
        actor: 'migration',
        action: 'cycle_imported_from_skyslope',
        detail: {
          source_guid: cyc.guid,
          docs: real.length,
          activities: activities.length,
          assignments: assignments.length,
        },
      })

      console.log(
        `✓ ${String(prop.address).slice(0, 40).padEnd(42)} ${cyc.kind === 'listings' ? 'LST' : 'SALE'} ${cyc.guid.slice(0, 8)} docs=${real.length} items=${activities.length} asg=${assignments.length}`
      )
    }
  }

  console.log(`\nDeals: ${dealCount} | docs: ${docCount} | bytes: ${(byteTotal / 1024 / 1024).toFixed(1)} MB | failures: ${failures.length}`)
  if (failures.length) {
    await fs.writeFile(path.join(ROOT, 'tc-migration-failures.json'), JSON.stringify(failures, null, 2))
    console.log(`Failure detail: tmp/skyslope-master/tc-migration-failures.json`)
  }
  await verify()
}

main().catch((e) => {
  console.error('Fatal:', e?.message || e)
  process.exit(1)
})
