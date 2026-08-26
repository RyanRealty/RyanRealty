#!/usr/bin/env node
/**
 * Ingest governing documents an association publishes itself.
 *
 * Second source class alongside the county title index. These copies are more
 * current (the association posts the operative version) and machine-readable
 * (real text layer, unlike every county scan), but they carry no clerk's stamp,
 * so their provenance line is publisher + document date + retrieval date rather
 * than an instrument number. See the 20260826130000 migration.
 *
 * WHY THE MANIFEST IS HAND-WRITTEN. A crawler cannot tell which documents bind
 * which plats, and getting that wrong is the exact failure the title index
 * caused: Caldera's CCOA declaration binds only the cabin sub-association, so
 * attaching it to all 15 Caldera plats would put another association's CC&Rs on
 * twelve pages. Master documents that bind every lot owner are listed with
 * their plats; sub-association documents go to review.
 *
 * usage: node --env-file=.env.local scripts/place-documents/ingest-association.mjs [--apply]
 */

import crypto from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

const APPLY = process.argv.includes('--apply')
const BUCKET = 'place-documents'
const UA = 'RyanRealty-Research/1.0 (+https://ryan-realty.com; matt@ryan-realty.com)'

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

/**
 * Caldera Springs. Every lot owner is automatically a CSOA member — the
 * association's own 2025 Facts and Figures states it — so the master documents
 * bind all 15 recorded plats. The CCOA documents bind only the cabins, and
 * which plats those are cannot be determined from the association's site, so
 * they land in review rather than being spread across the community.
 */
const CALDERA_PLATS = [
  'caldera-springs-phase-a', 'caldera-springs-phase-b', 'caldera-springs-phase-c-2',
  'caldera-springs-phase-one', 'caldera-springs-phase-two', 'caldera-springs-phase-three',
  'caldera-springs-phase-c1-sfr-247-22-000183-tp', 'caldera-springs-phase-d-247-24-000360-tp',
  'caldera-springs-phase-e1-247-25-00291-tp',
  'caldera-springs-olu-phase-a', 'caldera-springs-olu-phase-b', 'caldera-springs-olu-phase-c-2',
  'caldera-springs-olu-phase-c1-247-22-000182-tp', 'caldera-springs-olu-phase-d-247-24-000360-tp',
  'caldera-springs-olu-phase-e1-247-25-00292-tp',
]

const MANIFEST = [
  {
    publisher: "Caldera Springs Owners' Association",
    source: 'caldera_springs_hoa',
    indexUrl: 'https://calderasprings.com/owners-association/',
    county: 'Deschutes',
    publishedName: 'Caldera Springs',
    docs: [
      { kind: 'ccr', date: '2026-02-04', label: 'CSOA Master CC&Rs',
        url: 'https://calderasprings.com/wp-content/uploads/2026/02/2026-02-04-CSOA-Master-CCRs.pdf', binds: CALDERA_PLATS },
      { kind: 'bylaws', date: '2023-01-01', label: 'CSOA Master Bylaws',
        url: 'https://calderasprings.com/wp-content/uploads/2024/09/CSOA-Bylaws-Complete-2023.pdf', binds: CALDERA_PLATS },
      { kind: 'articles', date: '2006-01-31', label: 'CSOA Articles of Incorporation',
        url: 'https://calderasprings.com/wp-content/uploads/2022/07/CSOA-Articles-of-Incorporation-January-31-2006.pdf', binds: CALDERA_PLATS },
      { kind: 'design_guidelines', date: '2026-01-01', label: 'Caldera Springs Design Guidelines 2026',
        url: 'https://calderasprings.com/wp-content/uploads/2026/06/Caldera-Springs-Design-Guidelines-2026.pdf', binds: CALDERA_PLATS },
      { kind: 'rules', date: '2022-01-01', label: 'CSOA Code of Conduct',
        url: 'https://calderasprings.com/wp-content/uploads/2023/09/2022-SIGNED-Code-of-Conduct.pdf', binds: CALDERA_PLATS },
      { kind: 'rules', date: '2022-08-18', label: 'CSOA Enforcement Procedure and Schedule of Fines',
        url: 'https://calderasprings.com/wp-content/uploads/2022/11/2022-08-18-Final-Resolution-Enforcement-and-Schedule-of-Fines-signed.pdf', binds: CALDERA_PLATS },
      // Cabin sub-association: binds the cabins only. Which plats those are is
      // not published, so these go to review rather than to every Caldera page.
      { kind: 'ccr', date: '2023-01-01', label: 'CCOA (cabin sub-association) CC&Rs',
        url: 'https://calderasprings.com/wp-content/uploads/2023/02/2023-Cabin-CCRs-complete-combined.pdf', binds: CALDERA_PLATS, review: true },
      { kind: 'bylaws', date: '2020-01-01', label: 'CCOA (cabin sub-association) Bylaws',
        url: 'https://calderasprings.com/wp-content/uploads/2022/12/2020-Cabin-Bylaws-complete.pdf', binds: CALDERA_PLATS, review: true },
    ],
  },
]

const slugify = (s) => String(s).toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

let added = 0, linked = 0, skipped = 0, failed = 0

for (const assoc of MANIFEST) {
  for (const d of assoc.docs) {
    const existing = await sb.from('place_document').select('id').eq('source_url', d.url).maybeSingle()
    let docId = existing.data?.id ?? null

    if (!docId) {
      const res = await fetch(d.url, { headers: { 'User-Agent': UA, Accept: 'application/pdf' } })
      if (!res.ok) { console.error(`  FETCH FAIL ${d.label}: HTTP ${res.status}`); failed++; continue }
      const buf = Buffer.from(await res.arrayBuffer())
      // Same magic-byte guard as the county downloader: a 200 with
      // Content-Type: application/pdf is not proof of a PDF.
      if (buf.subarray(0, 5).toString() !== '%PDF-') { console.error(`  NOT A PDF ${d.label}`); failed++; continue }

      const sha = crypto.createHash('sha256').update(buf).digest('hex')
      const storagePath = `${slugify(assoc.county)}/${slugify(assoc.publishedName)}/assoc-${d.date}-${slugify(d.label)}.pdf`
      console.log(`  ${APPLY ? 'INGEST' : 'would ingest'}  ${d.label}  ${(buf.length / 1048576).toFixed(1)}MB  [${d.kind}]`)
      if (!APPLY) { skipped++; continue }

      const up = await sb.storage.from(BUCKET).upload(storagePath, buf, {
        contentType: 'application/pdf', upsert: true, cacheControl: '31536000',
      })
      if (up.error) { console.error(`  UPLOAD FAIL ${d.label}: ${up.error.message}`); failed++; continue }

      const ins = await sb.from('place_document').insert({
        source: assoc.source,
        source_url: d.url,
        county: assoc.county,
        published_name: assoc.publishedName,
        recording_type: 'association-published',
        recording_ref: d.date,
        doc_kind: d.kind,
        publisher: assoc.publisher,
        document_date: d.date,
        retrieved_at: new Date().toISOString(),
        storage_path: storagePath,
        file_bytes: buf.length,
        sha256: sha,
        fetched_at: new Date().toISOString(),
        // The document came from the association's OWN domain for this
        // community. That is stronger evidence of subject than any OCR scan of
        // a title-plant copy, so the name check is satisfied at the source.
        name_confirmed: true,
      }).select('id').single()
      if (ins.error) { console.error(`  INSERT FAIL ${d.label}: ${ins.error.message}`); failed++; continue }
      docId = ins.data.id
      added++
    } else {
      skipped++
    }

    if (!APPLY || !docId) continue
    const rows = d.binds.map((slug) => ({
      document_id: docId,
      geo_type: 'subdivision',
      geo_slug: slug,
      match_method: 'manual',
      status: d.review ? 'pending_review' : 'published',
      ...(d.review ? {} : { reviewed_by: 'ryan-realty:association-source', reviewed_at: new Date().toISOString(),
        review_note: `Published by ${assoc.publisher} at ${assoc.indexUrl}` }),
    }))
    const lk = await sb.from('place_document_link').upsert(rows, {
      onConflict: 'document_id,geo_type,geo_slug', ignoreDuplicates: true,
    })
    if (lk.error) { console.error(`  LINK FAIL ${d.label}: ${lk.error.message}`); failed++ }
    else linked += rows.length
  }
}

console.log(`\ndocuments added=${added} skipped=${skipped} failed=${failed}  links=${linked}`)
if (!APPLY) console.log('(dry run — pass --apply)')
