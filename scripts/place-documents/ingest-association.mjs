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

/**
 * Eagle Crest is TWO PEER MASTER ASSOCIATIONS, not one hierarchy.
 *
 *   ECMA — Eagle Crest Master Association, east of Cline Falls Highway. Its own
 *   page states it: "ECMA is the master association for properties at Eagle
 *   Crest that are on the east side of Cline Falls Highway. Sub-associations of
 *   ECMA include RVVE, EHOA, FVE, the Eagle Crest Hotel Condominiums, and
 *   VROA." (https://eaglecrestowners.com/hoas/, read from raw bytes.) RECOA is
 *   listed on that same page as a separate association, not a sub-association.
 *
 *   RECOA — The Ridge at Eagle Crest Owners Association, west of it, itself a
 *   master ("(MASTER ASSOCIATION)" on the title page of its Policies and
 *   Procedures). The two share amenities by joint-use easement; RECOA's
 *   declaration Recital E contemplates joint use, never subordination.
 *
 * THE PLAT NAME DOES NOT DETERMINE THE ASSOCIATION. The plat recorded as
 * "Eagle Crest II, Phase I" is RECOA's Initial Development, not ECMA's or
 * EHOA's — RECOA CC&Rs section 2.1 describes it by name, drawer and date, and
 * the 2023 recorded Forest Greens and Creekside amendments repeat it as "Plat
 * of Eagle Crest II-Phase I recorded March 28, 1996 as Document No. 96-11403".
 * Any rule keying association off subdivision name gets that one wrong.
 *
 * EVERY SLUG BELOW WAS READ OUT OF A DOCUMENT, not inferred from its name.
 * The recorded neighborhood/annexation declarations RECOA publishes each name
 * the plat they annex, in Exhibit A ("Additional Property") or in the section 4
 * land classifications. Those PDFs are county scans with no text layer, so each
 * was read with the on-device Vision OCR in this directory (ocr.swift) and the
 * plat name taken from the scan itself:
 *
 *   eagle-crest-ii-phase-i  RECOA CC&Rs 2.1 (Initial Development, 64 lots)
 *   ii  Eagle Creek Ph 1      iii Forest Greens Ph 1     7   Eagle Creek Ph 2
 *   8   Eagle Creek Ph 3      9   Eagle Creek Ph 4       10  Eagle Creek Ph 6
 *   11  Forest Greens Ph 2+2A 12  Forest Greens Ph 3 replat
 *   13  Forest Greens Ph 4    14  Forest Greens Ph 5+5A  18  The Falls Ph 1
 *   25  The Falls Ph 2 + clubhouse                       26  The Falls Ph 3
 *   27  The Falls Ph 5+6      28  The Falls Ph 8+9       29  The Falls Ph 10
 *   31  Eagle Creek Ph 5      32  Eagle Creek Ph 7       33  Eagle Springs
 *   35  Forest Greens Ph 6    37  Scenic Ridge           43  Highland Parks Ph 2-5
 *   44  Eagle Creek Ph 8      45-49 Desert Sky Ph 1-5    53  Creekside Ph 1
 *   54  Creekside Ph 2        55  Creekside Ph 3         56  Creekside Ph 4
 *   57  Creekside Ph 5        58  Vista Rim Ph 1         59  Vista Rim Ph 2+2A
 *   60  Creekside Ph 6
 *
 * NOT LISTED, ON PURPOSE:
 *   `eagle-crest` (the 1985 plat) carries three regimes at once — ECMA common
 *   property, EHOA homesites in Blocks 6/7/8/9/11, VROA timeshare in Block 5 —
 *   so one plat-level attachment is wrong for some owners whichever you pick.
 *   `eagle-crest-viii` … `-xii`, `eagle-crest-phase-ii`, and the ~20 remaining
 *   ridge-at-eagle-crest-N plats: no declaration read here names them. Unknown
 *   is the correct answer, and they are left alone.
 */
const RECOA_PLATS = [
  'eagle-crest-ii-phase-i',
  'ridge-at-eagle-crest-ii', 'ridge-at-eagle-crest-iii',
  'ridge-at-eagle-crest-7', 'ridge-at-eagle-crest-8', 'ridge-at-eagle-crest-9',
  'ridge-at-eagle-crest-10', 'ridge-at-eagle-crest-11', 'ridge-at-eagle-crest-12',
  'ridge-at-eagle-crest-13', 'ridge-at-eagle-crest-14', 'ridge-at-eagle-crest-18',
  'ridge-at-eagle-crest-25', 'ridge-at-eagle-crest-26', 'ridge-at-eagle-crest-27',
  'ridge-at-eagle-crest-28', 'ridge-at-eagle-crest-29', 'ridge-at-eagle-crest-31',
  'ridge-at-eagle-crest-32', 'ridge-at-eagle-crest-33', 'ridge-at-eagle-crest-35',
  'ridge-at-eagle-crest-37', 'ridge-at-eagle-crest-43', 'ridge-at-eagle-crest-44',
  'ridge-at-eagle-crest-45', 'ridge-at-eagle-crest-46', 'ridge-at-eagle-crest-47',
  'ridge-at-eagle-crest-48', 'ridge-at-eagle-crest-49', 'ridge-at-eagle-crest-53',
  'ridge-at-eagle-crest-54', 'ridge-at-eagle-crest-55', 'ridge-at-eagle-crest-56',
  'ridge-at-eagle-crest-57', 'ridge-at-eagle-crest-58', 'ridge-at-eagle-crest-59',
  'ridge-at-eagle-crest-60',
]

/**
 * Both masters also bind at community grain, and both have to.
 *
 * `data/resort-communities.json` scopes the `eagle-crest` community by the MLS
 * aliases "Eagle Crest" AND "Ridge At Eagle Crest", so that one page serves
 * owners on both sides of Cline Falls Highway. Publishing only ECMA's
 * declaration there would tell 1,700 Ridge homesites that ECMA governs them,
 * which is the same error in the opposite direction. Each row carries its
 * publisher, so the page shows two masters, correctly named.
 */
const EAGLE_CREST_COMMUNITY = [{ geoType: 'community', slug: 'eagle-crest' }]

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
  {
    // robots.txt permits: the only Disallow lines are Yoast's calendar query
    // strings (/*?*ical=1, /*?*outlook-ical=1, /*?*tribe-bar-date=*). No
    // per-bot block, and neither /wp-content/uploads/ nor /editor_upload/ is
    // restricted. Every file below returned HTTP 200, Content-Type
    // application/pdf, and %PDF- magic bytes with no login.
    publisher: 'The Ridge at Eagle Crest Owners Association',
    source: 'recoa_hoa',
    indexUrl: 'https://ridgeowners.org/association-info/governing-documents/',
    county: 'Deschutes',
    publishedName: 'The Ridge at Eagle Crest',
    docs: [
      // The published file is the January 2005 Amendment (clerk stamp
      // 01/28/2005, type code D-CCR) with the Amended and Restated Declaration
      // it adopts. It supersedes the 1996 original, Document No. 96-20423.
      { kind: 'ccr', date: '2005-01-28', label: 'RECOA Amended and Restated Declaration of CC&Rs',
        url: 'https://ridgeowners.org/wp-content/uploads/2026/04/RECOA-CCRs.pdf',
        binds: RECOA_PLATS, bindPlaces: EAGLE_CREST_COMMUNITY },
      { kind: 'bylaws', date: '2005-01-28', label: 'RECOA Amended and Restated Bylaws',
        url: 'https://ridgeowners.org/wp-content/uploads/2023/09/RECOA-Bylaws.pdf',
        binds: RECOA_PLATS, bindPlaces: EAGLE_CREST_COMMUNITY },
      // Cover page: "Architectural Review Committee / Policies and Guidelines /
      // March 2020".
      { kind: 'design_guidelines', date: '2020-03-01', label: 'RECOA Architectural Review Committee Policies and Guidelines',
        url: 'https://www.ridgeowners.org/editor_upload/File/Committee%20-%20ARC/RECOA%20ARC%20Guidelines_March%202020.pdf',
        binds: RECOA_PLATS, bindPlaces: EAGLE_CREST_COMMUNITY },
      // The date is the association's own revision stamp, carried in the file
      // name it publishes (Revised 07.31.26) and corroborated inside by the
      // enforcement schedule "Amended July 23, 2026". The cover page's revision
      // list stops at September 2025 and was not updated.
      { kind: 'rules', date: '2026-07-31', label: 'RECOA Policies and Procedures (rev. 07.31.2026)',
        url: 'https://ridgeowners.org/wp-content/uploads/2026/08/RECOA-Policies-and-Procedures-Revised-07.31.26.pdf',
        binds: RECOA_PLATS, bindPlaces: EAGLE_CREST_COMMUNITY },
    ],
  },
  {
    // robots.txt is "User-agent: * / Disallow:" — a blank Disallow, which
    // restricts nothing. All four files returned 200 / application/pdf /
    // %PDF- with no login.
    //
    // COMMUNITY GRAIN ONLY, NO PLAT. ECMA's Initial Property is described
    // entirely as lots and blocks on the 1985 Eagle Crest plat, and that one
    // plat also carries EHOA homesites and VROA timeshare. Every later phase
    // reached ECMA by a separately recorded annexation, and those instruments
    // are not published. So the master documents go where they are true for
    // everyone — the community — and to no individual plat.
    publisher: 'Eagle Crest Master Association',
    source: 'ecma_hoa',
    indexUrl: 'https://eaglecrestowners.com/hoas/ecma/',
    county: 'Deschutes',
    publishedName: 'Eagle Crest',
    docs: [
      // The 1985-06-24 Declaration, with the 1987-10-17 First Amended
      // Declaration attached as its Exhibit C.
      { kind: 'ccr', date: '1985-06-24', label: 'ECMA Declaration of CC&Rs for the Eagle Crest Planned Community',
        url: 'https://eaglecrestowners.com/__static/cd23fbfb4f79621522e1d6181f53e0ad/ecma_ccrs.pdf?dl=1',
        binds: [], bindPlaces: EAGLE_CREST_COMMUNITY },
      // Certificate of Secretary: adopted by unanimous written consent
      // dated June 24, 1985.
      { kind: 'bylaws', date: '1985-06-24', label: 'ECMA Bylaws',
        url: 'https://eaglecrestowners.com/__static/a3f3a3e64379e06e78cf94c6f9b6cbed/ecma_bylaws.pdf?dl=1',
        binds: [], bindPlaces: EAGLE_CREST_COMMUNITY },
      // Header: "Revised 9-13-02 Revised 11-11-11 Revised 11-14-14".
      { kind: 'rules', date: '2014-11-14', label: 'ECMA Master Association Policies and Procedures',
        url: 'https://eaglecrestowners.com/__static/bc03ea2d5bc758afe82de4111f6ec64b/ecma-policies.pdf?dl=1',
        binds: [], bindPlaces: EAGLE_CREST_COMMUNITY },
      // Running footer on every page: "FINAL Approved 3.25.2024".
      { kind: 'design_guidelines', date: '2024-03-25', label: 'ECMA Environmental Control Committee Policies and Guidelines',
        url: 'https://eaglecrestowners.com/__static/335f2c60ec240345f58dfe3269ed94a2/ecc-policies-and-guidelines-revised-and-approved-3-29-2024.pdf?dl=1',
        binds: [], bindPlaces: EAGLE_CREST_COMMUNITY },
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
    // A document can bind at more than one grain: the plats it governs, and the
    // community page those plats sit under. Both are written explicitly here
    // rather than rolled up, for the reason link-place-grains.mjs gives — a
    // community page assembled from whatever its plats happen to hold is a pile,
    // not an answer.
    const targets = [
      ...(d.binds ?? []).map((slug) => ({ geoType: 'subdivision', slug })),
      ...(d.bindPlaces ?? []),
    ]
    const rows = targets.map(({ geoType, slug }) => ({
      document_id: docId,
      geo_type: geoType,
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

// --- contradicted links ----------------------------------------------------
//
// Knowing which association governs a plat is also knowing which does NOT, and
// that second half has to be written down or it does nothing.
//
// eagle-crest-ii-phase-i is the case. Its name starts with "Eagle Crest", so
// match-plats resolved it to the county index's "Eagle Crest" bucket and hung
// twenty ECMA and EHOA instruments on it as pending parent matches. The plat is
// RECOA's Initial Development. Left pending, one of them (2004-29699, a
// year-instrument recording) is a stamp match away from two-signal-publish
// clearing it onto the page automatically — a different master association's
// declaration, in front of a buyer, as this plat's governing documents.
//
// So a manifest entry may name the published_name values whose documents
// contradict it on its own plats. Those links are rejected, which is terminal:
// regate only moves published <-> pending, and two-signal-publish reads only
// pending. Nothing walks it back.
const CONTRADICTED = [
  {
    plats: RECOA_PLATS,
    // The county index files ECMA's and EHOA's instruments under this one name.
    publishedNames: ['Eagle Crest'],
    note: 'rejected: this plat is governed by The Ridge at Eagle Crest Owners Association (RECOA CC&Rs section 2.1 and the annexation declaration naming the plat). ECMA and EHOA instruments filed under the county index name "Eagle Crest" do not govern it.',
  },
]

let rejected = 0
for (const c of CONTRADICTED) {
  const { data, error } = await sb
    .from('place_document_link')
    .select('id, geo_slug, status, place_document!inner(published_name, recording_ref, doc_kind)')
    .eq('geo_type', 'subdivision')
    .in('geo_slug', c.plats)
    .neq('status', 'rejected')
  if (error) { console.error(`  CONTRADICTION READ FAIL: ${error.message}`); break }

  const hits = data.filter((l) => c.publishedNames.includes(l.place_document.published_name))
  if (!hits.length) continue
  console.log(`\ncontradicted links on ${new Set(hits.map((h) => h.geo_slug)).size} plat(s): ${hits.length}`)
  for (const h of hits.slice(0, 5)) {
    console.log(`  ${APPLY ? 'REJECT' : 'would reject'}  ${h.geo_slug} <- ${h.place_document.recording_ref} [${h.place_document.doc_kind}] "${h.place_document.published_name}" (${h.status})`)
  }
  if (hits.length > 5) console.log(`  … and ${hits.length - 5} more`)
  if (!APPLY) continue

  for (let i = 0; i < hits.length; i += 200) {
    const chunk = hits.slice(i, i + 200)
    const { error: uErr } = await sb.from('place_document_link')
      .update({ status: 'rejected', reviewed_by: 'ryan-realty:association-source', reviewed_at: new Date().toISOString(), review_note: c.note })
      .in('id', chunk.map((h) => h.id))
    if (uErr) console.error(`  REJECT chunk @${i} FAIL: ${uErr.message}`)
    else rejected += chunk.length
  }
}
if (APPLY) console.log(`\nrejected ${rejected} contradicted links`)
if (!APPLY) console.log('(dry run — pass --apply)')
