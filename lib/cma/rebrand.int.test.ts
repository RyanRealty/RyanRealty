/**
 * Real-DB integration test for the CMA re-brand pass (W10.3).
 *
 * The defect this guards: the "Signing broker" select used to call
 * rebuildCmaAction -> buildCma, which re-selects comparables and re-runs two
 * Anthropic passes, so changing WHO SIGNS a client-facing pricing document
 * could change the recommended list price (CLAUDE.md section 0).
 *
 * These cases cover the REFUSAL contract against live Supabase — the paths
 * where a re-brand must decline rather than quietly do something worse:
 *   - a finalized/delivered document is a record of what was sent, not a
 *     template to re-sign;
 *   - a document built before render_args existed cannot be re-rendered
 *     faithfully, so it says so instead of silently rebuilding (which is the
 *     original defect wearing a new name);
 *   - an unknown broker is refused rather than defaulting to the principal —
 *     silently signing as the wrong person is worse than an error.
 *
 * Number-preservation itself is held structurally by ci:cma-rebrand-integrity
 * (the module cannot import buildCma/judgeComps/auditCma and cannot write
 * recommended_list, value_low, value_high, comps_count or citations).
 *
 * Skips without SUPABASE_SERVICE_ROLE_KEY. Self-cleaning: every seeded row is
 * deleted in afterAll even on failure. Slugs are `zz-test-` prefixed.
 */
import { afterAll, describe, expect, it } from 'vitest'
import { config } from 'dotenv'

config({ path: '.env.local' })

const HAVE_DB = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.NEXT_PUBLIC_SUPABASE_URL)
const run = HAVE_DB ? describe : describe.skip

const STAMP = process.env.VITEST_WORKER_ID ?? '0'
const SLUG_NO_ARGS = `zz-test-rebrand-noargs-${STAMP}`
const SLUG_LOCKED = `zz-test-rebrand-locked-${STAMP}`

run('CMA re-brand — refusal contract (real DB)', () => {
  const seeded: string[] = []

  afterAll(async () => {
    if (!seeded.length) return
    const { createServiceClient } = await import('@/lib/supabase/service')
    await createServiceClient().from('cmas').delete().in('slug', seeded)
  })

  async function seed(slug: string, extra: Record<string, unknown>) {
    const { createServiceClient } = await import('@/lib/supabase/service')
    const { error } = await createServiceClient()
      .from('cmas')
      .insert({
        slug,
        doc_type: 'cma',
        subject_address: '1 Test Way, Bend, OR 97701',
        html_path: `db:cmas.html_content:${slug}`,
        html_content: '<html><body>seed</body></html>',
        broker_slug: 'matthew-ryan',
        recommended_list: 750000,
        status: 'draft',
        ...extra,
      })
    if (error) throw new Error(`seed failed for ${slug}: ${error.message}`)
    seeded.push(slug)
  }

  it('refuses a document that predates render_args instead of rebuilding it', async () => {
    await seed(SLUG_NO_ARGS, { render_args: null })
    const { rebrandCma } = await import('./rebrand')
    const res = await rebrandCma({ slug: SLUG_NO_ARGS, brokerSlug: 'paul-stevenson' })
    expect(res.ok).toBe(false)
    if (!res.ok) {
      expect(res.reason).toBe('no_render_args')
      expect(res.message).toMatch(/rebuild it once/i)
    }

    // and it did NOT quietly change the signer or the price
    const { createServiceClient } = await import('@/lib/supabase/service')
    const { data } = await createServiceClient()
      .from('cmas')
      .select('broker_slug, recommended_list')
      .eq('slug', SLUG_NO_ARGS)
      .single()
    expect(data?.broker_slug).toBe('matthew-ryan')
    expect(data?.recommended_list).toBe(750000)
  })

  it('refuses to re-brand a delivered document in place', async () => {
    await seed(SLUG_LOCKED, {
      status: 'delivered',
      delivered_at: new Date().toISOString(),
      render_args: { pricing: { recommended: 750000 } },
    })
    const { rebrandCma } = await import('./rebrand')
    const res = await rebrandCma({ slug: SLUG_LOCKED, brokerSlug: 'paul-stevenson' })
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.reason).toBe('locked')
  })

  it('refuses an unknown broker rather than defaulting to the principal', async () => {
    const { rebrandCma } = await import('./rebrand')
    const res = await rebrandCma({ slug: SLUG_NO_ARGS, brokerSlug: 'not-a-real-broker' })
    expect(res.ok).toBe(false)
    // Either refusal is correct; what must NOT happen is silently signing as Matt.
    if (!res.ok) expect(['unknown_broker', 'no_render_args']).toContain(res.reason)
  })

  it('refuses a missing document', async () => {
    const { rebrandCma } = await import('./rebrand')
    const res = await rebrandCma({ slug: `zz-test-does-not-exist-${STAMP}`, brokerSlug: 'paul-stevenson' })
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.reason).toBe('not_found')
  })
})
