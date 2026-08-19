/**
 * Real-DB integration test for published CMAs on public listing pages.
 *
 * Proves the two hard constraints against live Supabase:
 *
 *   1. Nothing publishes without the per-document flag. A seeded, finalized,
 *      fully-built CMA is invisible on every surface until `published_to_listing`
 *      is true, and every outstanding delivery link dies the moment it goes back
 *      to false.
 *
 *   2. No sold-comp detail reaches an unregistered visitor. Two independent
 *      proofs: the PUBLIC ANON KEY cannot read `cmas`, `cma_comps`, or
 *      `cma_document_registrations` at all, and the ungated summary payload
 *      contains no comp address, price, or date even when comps exist.
 *
 * Skips without SUPABASE_SERVICE_ROLE_KEY. Self-cleaning: every seeded row is
 * deleted in afterAll even on failure. Identifiers come from @/test/int-scope,
 * so the pre-run / post-run sweep clears them if this run is killed.
 */
import { afterAll, describe, expect, it } from 'vitest'
import { config } from 'dotenv'

config({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'
import { createServiceClient } from '@/lib/supabase/service'
import { INT_MARKER, intEmail, intId } from '@/test/int-scope'
import {
  CMA_DOCUMENT_TERMS_VERSION,
  getPublishedCmaForListing,
  registerForCmaDocument,
  resolveCmaDocumentByToken,
} from '@/lib/data/cma/getPublishedCma'

const hasCreds = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.NEXT_PUBLIC_SUPABASE_URL)
const describeIf = hasCreds ? describe : describe.skip

const SLUG = intId('published-cma-gate')
const LISTING_KEY = intId('pubcma-listing').toUpperCase()
const SUBJECT_ADDRESS = `${SLUG} Way, Bend, OR 97701`
const FULL_DOC_MARKER = `${INT_MARKER.toUpperCase()} FULL DOCUMENT`
const COMP_1_KEY = intId('comp-1').toUpperCase()
const COMP_2_KEY = intId('comp-2').toUpperCase()
const REGISTRANT_NAME = `${INT_MARKER} Registrant`
const REGISTRANT_EMAIL = intEmail('registrant')
const SECRET_ADDRESS = `999 ${INT_MARKER} Secret Comp Lane`
const SECRET_PRICE = 987654

let seededId: string | null = null

async function seed(): Promise<string> {
  const sb = createServiceClient()
  await sb.from('cmas').delete().eq('slug', SLUG)
  const { data, error } = await sb
    .from('cmas')
    .insert({
      slug: SLUG,
      doc_type: 'cma',
      status: 'finalized',
      subject_address: SUBJECT_ADDRESS,
      subject_listing_key: LISTING_KEY,
      subject_city: 'Bend',
      value_low: 900000,
      value_high: 1000000,
      recommended_list: 950000,
      comps_count: 2,
      html_path: `public/cmas/${SLUG}/cma.html`,
      html_content: `<html><body>${FULL_DOC_MARKER} WITH COMPS</body></html>`,
      published_to_listing: false,
      build_summary: {
        pricing: { needs_review: false },
        // The severity-aware publish gate (2026-07-30) refuses any document
        // where no independent audit ran — `audit.used_llm !== true` is the
        // `audit-missing` blocker in publishBlockers(). Without this block the
        // seeded document is unpublishable and the lifecycle assertion below
        // fails on a null summary. Zero findings = nothing critical to block on.
        audit: { used_llm: true, findings: [] },
        site: { acreage: 1.5, zone: 'RR10', in_sfha: false, flood_zone: 'X', permit_count: 3 },
      },
    })
    .select('id')
    .single()
  if (error) throw new Error(`seed failed: ${error.message}`)
  const id = String((data as Record<string, unknown>).id)
  const { error: compErr } = await sb.from('cma_comps').insert([
    {
      cma_id: id,
      comp_listing_key: COMP_1_KEY,
      comp_order: 1,
      comp_address: SECRET_ADDRESS,
      sold_price: SECRET_PRICE,
      sold_date: '2026-02-10',
    },
    {
      cma_id: id,
      comp_listing_key: COMP_2_KEY,
      comp_order: 2,
      comp_address: `998 ${INT_MARKER} Other Comp Rd`,
      sold_price: 912345,
      sold_date: '2026-05-20',
    },
  ])
  if (compErr) throw new Error(`comp seed failed: ${compErr.message}`)
  return id
}

async function setPublished(published: boolean) {
  const sb = createServiceClient()
  const { error } = await sb
    .from('cmas')
    .update({
      published_to_listing: published,
      published_at: published ? new Date().toISOString() : null,
      published_by: published ? 'int-test' : null,
    })
    .eq('slug', SLUG)
  if (error) throw new Error(`publish toggle failed: ${error.message}`)
}

afterAll(async () => {
  if (!hasCreds) return
  const sb = createServiceClient()
  if (seededId) {
    await sb.from('cma_document_registrations').delete().eq('cma_id', seededId)
    await sb.from('cma_comps').delete().eq('cma_id', seededId)
  }
  await sb.from('cmas').delete().eq('slug', SLUG)
})

describeIf('published CMA — the anon key can never reach sold-comp detail', () => {
  it('refuses the public anon key on cmas, cma_comps, and the registration table', async () => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string
    const anonKey =
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? ''
    expect(anonKey, 'anon key must be configured for this probe to mean anything').not.toBe('')
    const anon = createClient(url, anonKey)

    // This is the probe that matters: an unauthenticated caller asking directly
    // for the sold price and address of every comparable in the database.
    const comps = await anon.from('cma_comps').select('comp_address, sold_price, sold_date').limit(5)
    expect(comps.data ?? []).toHaveLength(0)

    const cmas = await anon.from('cmas').select('slug, html_content, recommended_list').limit(5)
    expect(cmas.data ?? []).toHaveLength(0)

    const regs = await anon.from('cma_document_registrations').select('email, token_hash').limit(5)
    expect(regs.data ?? []).toHaveLength(0)
  })
})

describeIf('published CMA — the per-document flag is the gate', () => {
  it('walks the whole lifecycle: invisible, published, registered, revoked', async () => {
    seededId = await seed()

    // --- unpublished -------------------------------------------------------
    // A finished document with a full HTML body and real comps. The ONLY thing
    // standing between it and the public web is the flag.
    const registerBefore = await registerForCmaDocument({
      listingKey: LISTING_KEY,
      fullName: REGISTRANT_NAME,
      email: REGISTRANT_EMAIL,
      termsVersion: CMA_DOCUMENT_TERMS_VERSION,
    })
    expect(registerBefore.ok, 'registration must refuse an unpublished document').toBe(false)

    // --- published ---------------------------------------------------------
    await setPublished(true)

    const summary = await getPublishedCmaForListing(LISTING_KEY)
    expect(summary, 'the summary should resolve once published').not.toBeNull()
    expect(summary?.valueLow).toBe(900000)
    expect(summary?.valueHigh).toBe(1000000)
    // Aggregate evidence only: a count and a window.
    expect(summary?.evidence.closedSales).toBe(2)
    expect(summary?.evidence.windowStart).toBe('2026-02-10')
    expect(summary?.evidence.windowEnd).toBe('2026-05-20')

    // THE constraint. Serialise the entire ungated payload and prove no comp
    // address, price, listing key, or the seller-facing recommendation is
    // anywhere in it.
    const wire = JSON.stringify(summary)
    expect(wire).not.toContain(SECRET_ADDRESS)
    expect(wire).not.toContain(String(SECRET_PRICE))
    expect(wire).not.toContain(COMP_1_KEY)
    expect(wire).not.toContain(FULL_DOC_MARKER)
    // recommended_list is our pricing advice TO THE SELLER and never renders.
    expect(wire).not.toContain('950000')

    // --- registered --------------------------------------------------------
    const registered = await registerForCmaDocument({
      listingKey: LISTING_KEY,
      fullName: REGISTRANT_NAME,
      email: REGISTRANT_EMAIL,
      termsVersion: CMA_DOCUMENT_TERMS_VERSION,
    })
    expect(registered.ok, registered.ok ? 'registered' : registered.error).toBe(true)
    if (!registered.ok) return

    // The delivered document is a NORMAL CMA. ODS §7-5 D. Nothing is redacted.
    const delivered = await resolveCmaDocumentByToken(registered.token)
    expect(delivered).not.toBeNull()
    expect(delivered?.html).toContain(FULL_DOC_MARKER)

    // A wrong token gets nothing.
    expect(await resolveCmaDocumentByToken('x'.repeat(43))).toBeNull()

    // --- revoked -----------------------------------------------------------
    // Unpublishing is the client-confidentiality control, so it must kill links
    // that were already handed out, not just stop new ones.
    await setPublished(false)
    expect(
      await resolveCmaDocumentByToken(registered.token),
      'an outstanding link must die the moment the document is unpublished',
    ).toBeNull()

    // Stale terms are refused outright.
    await setPublished(true)
    const staleTerms = await registerForCmaDocument({
      listingKey: LISTING_KEY,
      fullName: REGISTRANT_NAME,
      email: REGISTRANT_EMAIL,
      termsVersion: 'cma-doc-terms-1999-01-01',
    })
    expect(staleTerms.ok).toBe(false)
  })

  it('refuses to publish an expired-audit even with the flag set (DB constraint)', async () => {
    const sb = createServiceClient()
    const { error } = await sb
      .from('cmas')
      .update({ doc_type: 'expired-audit', published_to_listing: true })
      .eq('slug', SLUG)
    // The check constraint cmas_publish_requires_cma_doc_type must reject this.
    expect(error, 'the database must refuse a published expired-audit').not.toBeNull()
  })
})
