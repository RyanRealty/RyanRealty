/**
 * Real-DB regression for the case-sensitive suppression bypass (C3, 2026-07-04).
 *
 * crm_people.emails stores mixed-case addresses; the old jsonb `@>` lookup was
 * byte-exact, so a person suppressed by a compliance tag whose email is stored
 * "Jane@X.com" was silently NOT found and could be emailed. isSuppressedByEmail now
 * resolves people via crm_person_ids_by_email_ci (matches over lower(value)).
 *
 * This seeds a person with an UPPERCASE-bearing email + a contact:do-not-call tag,
 * then asserts isSuppressedByEmail(<lowercased email>) reports suppressed. Skips
 * without DB creds; self-cleaning.
 */
import { afterAll, describe, expect, it } from 'vitest'
import { config } from 'dotenv'

config({ path: '.env.local' })

const HAVE_DB = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.NEXT_PUBLIC_SUPABASE_URL)
const run = HAVE_DB ? describe : describe.skip

const STAMP = process.env.VITEST_WORKER_ID ?? '0'
const MIXED = `Case.Probe.${STAMP}@Example.Invalid` // stored with uppercase
const LOWER = MIXED.toLowerCase()

run('suppression is case-insensitive (C3)', () => {
  let sb: import('@supabase/supabase-js').SupabaseClient
  let personId: number | null = null

  afterAll(async () => {
    if (sb && personId) await sb.from('crm_people').delete().eq('id', personId)
  })

  it('finds a hard-stop tag on a mixed-case stored email queried in lowercase', async () => {
    const { createServiceClient } = await import('@/lib/supabase/service')
    sb = createServiceClient()

    const { data, error } = await sb
      .from('crm_people')
      .insert({
        first_name: 'Case',
        last_name: 'Probe',
        emails: [{ value: MIXED, isPrimary: true }],
        tags: ['compliance:hard-stop'],
        deleted: false,
      })
      .select('id')
      .single()
    if (error || !data) throw new Error(`seed failed: ${error?.message}`)
    personId = data.id as number

    const { isSuppressedByEmail } = await import('@/lib/crm/suppressions')

    // The exact newsletter scenario: a hard-stop person with a mixed-case stored
    // email, checked on the email channel, must be suppressed when queried lowercase.
    const res = await isSuppressedByEmail(LOWER, 'email')
    expect(res.suppressed).toBe(true)
    expect(res.reasons.join(',')).toMatch(/hard-stop/)
  }, 30000)
})
