/**
 * Real-DB integration test for the one-off bulk send compliance path (S-10).
 *
 * Runs the ACTUAL enqueueNewsletterToEmails against live Supabase and proves the
 * two invariants that protect Ryan Realty's license:
 *
 *   1. A brand-new address is enrolled (active subscriber row + unsubscribe_token)
 *      and queued as a recipient — so the drain can render its one-click unsubscribe.
 *   2. A previously-unsubscribed address is NEVER resurrected: it stays status
 *      'unsubscribed' and is NOT queued. Re-sending to an opt-out is a CAN-SPAM
 *      violation (CLAUDE.md §0).
 *
 * Skips itself (no failure) when SUPABASE_SERVICE_ROLE_KEY is absent so CI without
 * DB creds stays green. Self-cleaning: every row it writes is deleted in afterAll,
 * even on assertion failure. Uses .invalid addresses (RFC 6761 — can never route).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { config } from 'dotenv'

config({ path: '.env.local' })

const HAVE_DB = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.NEXT_PUBLIC_SUPABASE_URL)
const run = HAVE_DB ? describe : describe.skip

const STAMP = process.env.VITEST_WORKER_ID ?? '0'
const NEW_EMAIL = `nl-oneoff-new-${STAMP}@test.invalid`
const OPTOUT_EMAIL = `nl-oneoff-optout-${STAMP}@test.invalid`

run('one-off bulk send — S-10 opt-out protection (real DB)', () => {
  let newsletterId = ''
  let sb: import('@supabase/supabase-js').SupabaseClient

  beforeAll(async () => {
    const { createServiceClient } = await import('@/lib/supabase/service')
    sb = createServiceClient()

    // Clean any leftovers from a previously-crashed run.
    await sb.from('newsletter_subscribers').delete().in('email', [NEW_EMAIL, OPTOUT_EMAIL])

    // A pre-existing OPT-OUT the one-off must NOT resurrect.
    const { error: subErr } = await sb
      .from('newsletter_subscribers')
      .insert({ email: OPTOUT_EMAIL, status: 'unsubscribed', source: 'test', segment: 'general' })
    if (subErr) throw new Error(`seed optout failed: ${subErr.message}`)

    // A draft issue with a body (empty body would abort before the compliance path).
    const { data: nl, error: nlErr } = await sb
      .from('newsletters')
      .insert({
        subject: 'S-10 integration probe',
        body_html: '<p>Probe body for the one-off compliance test.</p>',
        body_text: 'Probe body for the one-off compliance test.',
        status: 'draft',
        audience: 'all',
      })
      .select('id')
      .single()
    if (nlErr || !nl) throw new Error(`seed newsletter failed: ${nlErr?.message}`)
    newsletterId = nl.id as string
  })

  afterAll(async () => {
    if (!sb) return
    if (newsletterId) {
      await sb.from('newsletter_recipients').delete().eq('newsletter_id', newsletterId)
      await sb.from('newsletter_send_schedule').delete().eq('newsletter_id', newsletterId)
      await sb.from('newsletters').delete().eq('id', newsletterId)
    }
    await sb.from('newsletter_subscribers').delete().in('email', [NEW_EMAIL, OPTOUT_EMAIL])
  })

  it('enrolls + queues a new address but skips a prior opt-out', async () => {
    const { enqueueNewsletterToEmails } = await import('@/lib/newsletter/send-queue')
    const res = await enqueueNewsletterToEmails(newsletterId, [NEW_EMAIL, OPTOUT_EMAIL])

    expect(res.ok).toBe(true)
    // Only the new address is queued — the opt-out is filtered out.
    expect(res.queued).toBe(1)

    // The new address: active subscriber + a real unsubscribe token.
    const { data: newSub } = await sb
      .from('newsletter_subscribers')
      .select('status, unsubscribe_token')
      .eq('email', NEW_EMAIL)
      .single()
    expect(newSub?.status).toBe('active')
    expect(typeof newSub?.unsubscribe_token).toBe('string')
    expect((newSub?.unsubscribe_token as string)?.length ?? 0).toBeGreaterThan(10)

    // The opt-out stayed unsubscribed — NOT resurrected.
    const { data: optSub } = await sb
      .from('newsletter_subscribers')
      .select('status')
      .eq('email', OPTOUT_EMAIL)
      .single()
    expect(optSub?.status).toBe('unsubscribed')

    // Recipient rows: new address queued, opt-out absent.
    const { data: recips } = await sb
      .from('newsletter_recipients')
      .select('email')
      .eq('newsletter_id', newsletterId)
    const emails = (recips ?? []).map((r) => (r.email as string).toLowerCase())
    expect(emails).toContain(NEW_EMAIL)
    expect(emails).not.toContain(OPTOUT_EMAIL)
  })

  it('returns all_opted_out when every address previously unsubscribed', async () => {
    // The newsletter is now status 'sending' from the first send; a fresh draft is
    // needed for a clean CAS lock. Reuse the seeded opt-out as the sole recipient.
    const { data: nl2, error } = await sb
      .from('newsletters')
      .insert({
        subject: 'S-10 all-optout probe',
        body_html: '<p>x</p>',
        body_text: 'x',
        status: 'draft',
        audience: 'all',
      })
      .select('id')
      .single()
    if (error || !nl2) throw new Error(`seed nl2 failed: ${error?.message}`)
    const id2 = nl2.id as string
    try {
      const { enqueueNewsletterToEmails } = await import('@/lib/newsletter/send-queue')
      const res = await enqueueNewsletterToEmails(id2, [OPTOUT_EMAIL])
      expect(res.ok).toBe(false)
      expect(res.error).toBe('all_opted_out')
      // The lock was rolled back to draft (S-14) — nothing stranded.
      const { data } = await sb.from('newsletters').select('status').eq('id', id2).single()
      expect(data?.status).toBe('draft')
    } finally {
      await sb.from('newsletter_recipients').delete().eq('newsletter_id', id2)
      await sb.from('newsletter_send_schedule').delete().eq('newsletter_id', id2)
      await sb.from('newsletters').delete().eq('id', id2)
    }
  })
})
