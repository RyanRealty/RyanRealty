/**
 * Real-DB checks for what the unit tests can only mock, READ-ONLY: nothing
 * here writes a row.
 *
 *   1. PostgREST parses the JSON path the monthly report email is keyed by
 *      (citations->0->>fetched_at), as a select alias and as a filter
 *      (current-issue.ts and restampNewsletterCitations): mis-parsed, a
 *      same-figures rebuild could never re-stamp a draft.
 *   2. replace_newsletter_draft (migration 20260930180000) is callable with the
 *      argument names replaceNewsletterDraft sends, and a row it cannot find
 *      comes back { ok: false }. Its swap was exercised in a rolled-back
 *      transaction on 2026-09-30 (canceled under the retired marker, the new
 *      draft under the live one with the old audience, a stale status refused).
 *   3. editionEmailFiguresCurrent reads the August 2026 edition: a trace on
 *      its build is current, an older one is not.
 *
 * Skips itself when SUPABASE_SERVICE_ROLE_KEY is absent.
 */
import { beforeAll, describe, expect, it } from 'vitest'
import { config } from 'dotenv'

config({ path: '.env.local' })

const HAVE_DB = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.NEXT_PUBLIC_SUPABASE_URL)
const run = HAVE_DB ? describe : describe.skip

run('monthly report email keys against the real DB (read-only)', () => {
  let sb: import('@supabase/supabase-js').SupabaseClient

  beforeAll(async () => {
    const { createServiceClient } = await import('@/lib/supabase/service')
    sb = createServiceClient()
  })

  it('parses the build-stamp JSON path as an alias and as a filter', async () => {
    const aliased = await sb
      .from('newsletters')
      .select('id,stamp:citations->0->>fetched_at')
      .like('created_by', 'cron:market-report-edition:%')
      .limit(3)
    expect(aliased.error).toBeNull()
    for (const row of (aliased.data ?? []) as Array<Record<string, unknown>>) expect(row).toHaveProperty('stamp')

    const filtered = await sb.from('newsletters').select('id').eq('citations->0->>fetched_at', 'never-a-build').limit(1)
    expect(filtered.error).toBeNull()
    expect(filtered.data).toEqual([])
  })

  it('calls replace_newsletter_draft by the names the DAL sends, and a missing row changes nothing', async () => {
    const { data, error } = await sb.rpc('replace_newsletter_draft', {
      p_id: '00000000-0000-0000-0000-000000000000',
      p_expected_status: 'draft',
      p_retired_created_by: 'cron:market-report-edition:1999-01:replaced:int-probe',
      p_subject: 'int probe',
      p_preview_text: null,
      p_body_html: null,
      p_body_text: null,
      p_citations: [],
    })
    expect(error).toBeNull()
    expect(data).toEqual({ ok: false, status: null })
  })

  it('reads an email on its edition\'s build as current, and one from an older build as not', async () => {
    const { editionEmailFiguresCurrent } = await import('./current-issue')
    const { data } = await sb.from('market_report_editions').select('status,generated_at').eq('edition_month', '2026-08-01').maybeSingle()
    const edition = data as { status: string; generated_at: string } | null
    expect(edition?.status).toBe('published')
    const build = new Date(edition!.generated_at).toISOString()
    expect(await editionEmailFiguresCurrent('cron:market-report-edition:2026-08', build)).toBe(true)
    expect(await editionEmailFiguresCurrent('cron:market-report-edition:2026-08', '2000-01-01T00:00:00.000Z')).toBe(false)
    expect(await editionEmailFiguresCurrent('matt@ryan-realty.com', null)).toBe(true)
  })
})
