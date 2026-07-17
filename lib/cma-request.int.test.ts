/**
 * Real-DB regression for createCmaRequest — the intake clobber guard.
 *
 * The contract under test (adversarial review 2026-07-17 HIGH — the
 * upsert-by-slug clobber class): a NEW request for an address whose cmas row
 * is already finalized/delivered must NEVER flip that document back to draft,
 * reassign its client, or break its public /cma/[slug] link. The intake lands
 * on a versioned slot (-vN) instead, and repeat intakes refresh the open
 * draft's contact fields without touching status/html_path/built content.
 *
 * Covers every non-CRM intake path (seller LP, expired cron, FSBO, Meta
 * webhook) at their shared chokepoint. The CRM kick-off path has its own
 * guard + test (lib/crm/cma-kickoff.int.test.ts).
 *
 * Outbound side effects (broker email, lead confirmation, GA4) are mocked —
 * this test exercises the DB contract only. Skips without DB creds;
 * self-cleaning.
 */
import { afterAll, describe, expect, it, vi } from 'vitest'
import { config } from 'dotenv'

config({ path: '.env.local' })

vi.mock('@/lib/resend', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  sendEmail: vi.fn(async () => ({ ok: true })),
}))
vi.mock('@/lib/gmail-draft', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  sendGmailMessage: vi.fn(async () => ({ ok: true })),
}))
vi.mock('@/lib/ga4-measurement-protocol', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  fireGa4Event: vi.fn(async () => undefined),
}))

const HAVE_DB = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.NEXT_PUBLIC_SUPABASE_URL)
const run = HAVE_DB ? describe : describe.skip

const STAMP = `${Date.now() % 1000000}`
const ADDRESS = `${STAMP} Zztest Clobber Guard St, Bend`

run('createCmaRequest never clobbers a protected CMA (upsert-by-slug class)', () => {
  let sb: import('@supabase/supabase-js').SupabaseClient
  let baseSlug: string

  const allSlugs = () => [baseSlug, `${baseSlug}--v2`, `${baseSlug}--v3`]

  afterAll(async () => {
    if (!sb || !baseSlug) return
    await sb
      .from('marketing_brain_actions')
      .delete()
      .in('target', allSlugs().map((s) => `cma:${s}`))
    await sb.from('cmas').delete().in('slug', allSlugs())
  })

  it('a new intake for a DELIVERED address opens --v2 and leaves the delivered document untouched', async () => {
    const { createServiceClient } = await import('@/lib/supabase/service')
    const { slugifyAddress } = await import('@/lib/cma/address-slug')
    sb = createServiceClient()
    baseSlug = slugifyAddress(ADDRESS)

    // Seed: a delivered CMA for the ORIGINAL client with a live public link.
    const { error: seedErr } = await sb.from('cmas').insert({
      slug: baseSlug,
      subject_address: ADDRESS,
      subject_city: 'Bend',
      client_name: 'Original Client',
      client_email: 'original@example.invalid',
      status: 'delivered',
      html_path: `db:cmas.html_content:${baseSlug}`,
      html_content: '<html>original delivered document</html>',
      generation_reason: 'int-test seed',
    })
    expect(seedErr).toBeNull()

    const { createCmaRequest } = await import('@/lib/cma-request')
    const res = await createCmaRequest({
      rawAddress: ADDRESS,
      parsedStreet: `${STAMP} Zztest Clobber Guard St`,
      parsedCity: 'Bend',
      parsedState: 'OR',
      parsedPostalCode: null,
      leadEmail: 'new-lead@example.invalid',
      leadName: 'New Lead',
      requestSource: 'seller-lp',
      notifyLead: false,
    })
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.slug).toBe(`${baseSlug}--v2`)

    // THE invariant: the delivered document is byte-for-byte untouched.
    const { data: original } = await sb
      .from('cmas')
      .select('status, client_name, client_email, html_path, html_content')
      .eq('slug', baseSlug)
      .single()
    expect(original!.status).toBe('delivered')
    expect(original!.client_name).toBe('Original Client')
    expect(original!.client_email).toBe('original@example.invalid')
    expect(original!.html_path).toBe(`db:cmas.html_content:${baseSlug}`)
    expect(original!.html_content).toBe('<html>original delivered document</html>')

    // The new lead got their own fresh draft at --v2, queued for the worker.
    const { data: v2 } = await sb
      .from('cmas')
      .select('status, client_email, html_path')
      .eq('slug', `${baseSlug}--v2`)
      .single()
    expect(v2!.status).toBe('draft')
    expect(v2!.client_email).toBe('new-lead@example.invalid')
    expect(v2!.html_path).toBe(`pending:${baseSlug}--v2`)

    const { data: actions } = await sb
      .from('marketing_brain_actions')
      .select('id, target')
      .eq('target', `cma:${baseSlug}--v2`)
    expect((actions ?? []).length).toBeGreaterThanOrEqual(1)
  }, 30000)

  it('a repeat intake refreshes the open --v2 draft (no --v3) and never resets a built draft', async () => {
    expect(baseSlug).toBeTruthy()
    const v2Slug = `${baseSlug}--v2`

    // Simulate the worker having built the draft: content + db html_path.
    const { error: paintErr } = await sb
      .from('cmas')
      .update({ html_path: `db:cmas.html_content:${v2Slug}`, html_content: '<html>built draft</html>' })
      .eq('slug', v2Slug)
    expect(paintErr).toBeNull()

    const { createCmaRequest } = await import('@/lib/cma-request')
    const res = await createCmaRequest({
      rawAddress: ADDRESS,
      parsedStreet: `${STAMP} Zztest Clobber Guard St`,
      parsedCity: 'Bend',
      parsedState: 'OR',
      parsedPostalCode: null,
      leadEmail: 'second-lead@example.invalid',
      leadName: 'Second Lead',
      requestSource: 'seller-lp',
      notifyLead: false,
    })
    expect(res.ok).toBe(true)
    if (!res.ok) return
    // Merged into the open draft — same slot, no third document.
    expect(res.slug).toBe(v2Slug)
    const { data: v3 } = await sb.from('cmas').select('slug').eq('slug', `${baseSlug}--v3`)
    expect((v3 ?? []).length).toBe(0)

    // Contact fields refreshed; status/html_path/built content untouched (the
    // old blind upsert reset html_path to pending:<slug> here — the bug).
    const { data: v2 } = await sb
      .from('cmas')
      .select('status, client_email, html_path, html_content')
      .eq('slug', v2Slug)
      .single()
    expect(v2!.status).toBe('draft')
    expect(v2!.client_email).toBe('second-lead@example.invalid')
    expect(v2!.html_path).toBe(`db:cmas.html_content:${v2Slug}`)
    expect(v2!.html_content).toBe('<html>built draft</html>')

    // And the delivered original is STILL untouched after the second pass.
    const { data: original } = await sb
      .from('cmas')
      .select('status, client_email')
      .eq('slug', baseSlug)
      .single()
    expect(original!.status).toBe('delivered')
    expect(original!.client_email).toBe('original@example.invalid')

    // The build must run for the NEWEST requester: whether the second intake
    // attached to the open action (23505 path, payload refreshed) or inserted
    // its own row (no unique index yet), some open action for this slug must
    // carry the second lead's contact — the worker builds from payload, and a
    // stale payload would revert the contact refresh (review MED 2026-07-17).
    const { data: openActions } = await sb
      .from('marketing_brain_actions')
      .select('payload, status')
      .eq('target', `cma:${v2Slug}`)
      .in('status', ['pending', 'in_production'])
    const carriesSecondLead = (openActions ?? []).some(
      (a) => ((a.payload ?? {}) as Record<string, unknown>).client_email === 'second-lead@example.invalid',
    )
    expect(carriesSecondLead).toBe(true)
  }, 30000)

  it('an ARCHIVED document is protected the same way (fail-safe: any non-draft status)', async () => {
    expect(baseSlug).toBeTruthy()
    const v2Slug = `${baseSlug}--v2`
    // Archive the v2 draft — the next intake must step to --v3, not resurrect it.
    const { error } = await sb.from('cmas').update({ status: 'archived' }).eq('slug', v2Slug)
    expect(error).toBeNull()
    // Close the open action row so the attach path doesn't intercept.
    await sb
      .from('marketing_brain_actions')
      .update({ status: 'killed', killed_reason: 'int-test: closing before the --v3 assertion' })
      .eq('target', `cma:${v2Slug}`)

    const { createCmaRequest } = await import('@/lib/cma-request')
    const res = await createCmaRequest({
      rawAddress: ADDRESS,
      parsedStreet: `${STAMP} Zztest Clobber Guard St`,
      parsedCity: 'Bend',
      parsedState: 'OR',
      parsedPostalCode: null,
      leadEmail: 'third-lead@example.invalid',
      leadName: 'Third Lead',
      requestSource: 'seller-lp',
      notifyLead: false,
    })
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.slug).toBe(`${baseSlug}--v3`)

    const { data: v2 } = await sb.from('cmas').select('status, client_email').eq('slug', v2Slug).single()
    expect(v2!.status).toBe('archived')
    expect(v2!.client_email).toBe('second-lead@example.invalid')
  }, 30000)
})
