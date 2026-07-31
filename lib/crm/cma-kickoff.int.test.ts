/**
 * Real-DB regression for the one-tap CMA kick-off (admin-rebuild v2, D8).
 *
 * The mutation-safety contract under test (the RC2/RC7 class — a repeated or
 * replayed mutation must never duplicate work or clobber state):
 *   1. A double-tap (same idempotency key) enqueues exactly ONE content:cma
 *      action row — the second call replays the stored result.
 *   2. A second kick-off from a DIFFERENT key (another mount / another broker)
 *      while a build is open attaches to it (alreadyQueued) — still one row.
 *   3. Attaching JOINS the row's ready-notify list (payload.notify_broker_sms,
 *      a list appended atomically via the cma_action_append_notify RPC) so the
 *      worker texts every kicker, not just the first enqueuer — and the append
 *      refuses once the build closed, reporting the status so the kick-off
 *      path texts directly instead.
 *
 * Skips without DB creds; self-cleaning (action row + cmas row + timeline +
 * idempotency keys + probe persons all deleted).
 */
import { afterAll, describe, expect, it } from 'vitest'
import { config } from 'dotenv'
import { INT_MARKER, intEmail, intId } from '@/test/int-scope'

config({ path: '.env.local' })

const HAVE_DB = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.NEXT_PUBLIC_SUPABASE_URL)
const run = HAVE_DB ? describe : describe.skip

// The marker rides the ADDRESS and the person names, so the cmas row, the
// marketing_brain_actions row and the crm_people/crm_timeline rows the
// production path derives are all marked for the sweep.
const ADDRESS = `${intId('kickoff')} St, Bend`
const PROBE_NAME = `${INT_MARKER} KickoffProbe`
const PROBE_NAME_B = `${INT_MARKER} KickoffProbeB`
const ORIGINAL_EMAIL = intEmail('kickoff-orig')

run('CMA kick-off is idempotent and dedupes open builds (D8)', () => {
  let sb: import('@supabase/supabase-js').SupabaseClient
  let personId: number | null = null
  let personBId: number | null = null
  let slug: string | null = null

  afterAll(async () => {
    if (!sb) return
    if (slug) {
      await sb
        .from('marketing_brain_actions')
        .delete()
        .in('target', [`cma:${slug}`, `cma:${slug}--v2`])
      await sb.from('cmas').delete().in('slug', [slug, `${slug}--v2`])
    }
    for (const pid of [personId, personBId]) {
      if (!pid) continue
      await sb.from('crm_timeline').delete().eq('person_id', pid)
      await sb.from('crm_idempotency_keys').delete().like('key', `cma-kickoff:${pid}:%`)
      await sb.from('crm_people').delete().eq('id', pid)
    }
  })

  it('double-tap (same key) enqueues exactly one build; a new key attaches to the open build', async () => {
    const { createServiceClient } = await import('@/lib/supabase/service')
    sb = createServiceClient()

    const { data: person, error: seedErr } = await sb
      .from('crm_people')
      .insert({
        first_name: INT_MARKER,
        last_name: 'KickoffProbe',
        name: PROBE_NAME,
        stage: 'Lead',
        assigned_broker: 'matt',
        phones: [{ value: '+15005550006', isPrimary: 1 }],
        emails: [],
      })
      .select('id')
      .single()
    expect(seedErr).toBeNull()
    personId = person!.id as number

    const { kickoffCmaCore } = await import('@/lib/crm/cma-kickoff')
    const key = intId('kickoff-a')

    // 1st call — enqueues.
    const first = await kickoffCmaCore({
      personId,
      address: ADDRESS,
      idempotencyKey: key,
      actorBroker: 'matt',
    })
    expect(first.ok).toBe(true)
    if (!first.ok) return
    slug = first.slug
    expect(first.alreadyQueued).toBe(false)

    // 2nd call, SAME key — must replay, not enqueue.
    const second = await kickoffCmaCore({
      personId,
      address: ADDRESS,
      idempotencyKey: key,
      actorBroker: 'matt',
    })
    expect(second.ok).toBe(true)

    // 3rd call, DIFFERENT key — must attach to the open build, not enqueue.
    const third = await kickoffCmaCore({
      personId,
      address: ADDRESS,
      idempotencyKey: intId('kickoff-b'),
      actorBroker: 'matt',
    })
    expect(third.ok).toBe(true)
    if (third.ok) expect(third.alreadyQueued).toBe(true)

    // THE invariant: exactly one open content:cma action row for this slug.
    const { data: rows } = await sb
      .from('marketing_brain_actions')
      .select('id, status')
      .eq('target', `cma:${slug}`)
    expect((rows ?? []).length).toBe(1)

    // The payload carries the notify contract for the worker: a LIST of
    // {person_id, broker} entries. Exactly ONE here — the double-tap replayed
    // and the same-person attach hit the RPC's exact-duplicate guard.
    const { data: actionRow } = await sb
      .from('marketing_brain_actions')
      .select('payload, data_evidence')
      .eq('target', `cma:${slug}`)
      .single()
    const payload = (actionRow?.payload ?? {}) as Record<string, unknown>
    expect(payload.notify_broker_sms).toEqual([{ person_id: personId, broker: 'matt' }])
    expect(((actionRow?.data_evidence ?? {}) as Record<string, unknown>).request_source).toBe('crm-kickoff')

    // One cmas draft row, linked to the client we resolved (phone-only lead → null email is fine).
    const { data: cmaRows } = await sb.from('cmas').select('id, status').eq('slug', slug)
    expect((cmaRows ?? []).length).toBe(1)
    expect(cmaRows![0]!.status).toBe('draft')
  }, 30000)

  it('an attaching kicker joins the ready-notify list; the append refuses once the build closed (review MED)', async () => {
    expect(personId).not.toBeNull()
    expect(slug).not.toBeNull()
    const { kickoffCmaCore } = await import('@/lib/crm/cma-kickoff')

    // Second kicker: a DIFFERENT lead person asking about the same address,
    // kicked by another broker. Must attach AND land on the notify list.
    const { data: personB, error: seedErr } = await sb
      .from('crm_people')
      .insert({
        first_name: INT_MARKER,
        last_name: 'KickoffProbeB',
        name: PROBE_NAME_B,
        stage: 'Lead',
        assigned_broker: 'rebecca',
        phones: [{ value: '+15005550007', isPrimary: 1 }],
        emails: [],
      })
      .select('id')
      .single()
    expect(seedErr).toBeNull()
    personBId = personB!.id as number

    const res = await kickoffCmaCore({
      personId: personBId,
      address: ADDRESS,
      idempotencyKey: intId('kickoff-c'),
      actorBroker: 'rebecca',
    })
    expect(res.ok).toBe(true)
    if (res.ok) expect(res.alreadyQueued).toBe(true)

    // Both kickers now sit on the notify list — the worker texts each on ready.
    const { data: actionRow } = await sb
      .from('marketing_brain_actions')
      .select('id, payload')
      .eq('target', `cma:${slug}`)
      .single()
    const actionId = actionRow!.id as string
    const list = ((actionRow?.payload ?? {}) as Record<string, unknown>).notify_broker_sms
    expect(list).toEqual([
      { person_id: personId, broker: 'matt' },
      { person_id: personBId, broker: 'rebecca' },
    ])

    // Race guard: once the worker closes the row, the append refuses and
    // reports the status so the kick-off attach path texts directly instead
    // of appending an entry the worker's notify pass will never read.
    await sb.from('marketing_brain_actions').update({ status: 'ready' }).eq('id', actionId)
    const { appendCmaActionNotify } = await import('@/lib/data')
    const refused = await appendCmaActionNotify(actionId, { personId: personBId, broker: 'matt' })
    expect(refused.appended).toBe(false)
    expect(refused.status).toBe('ready')
    const { data: after } = await sb
      .from('marketing_brain_actions')
      .select('payload')
      .eq('id', actionId)
      .single()
    expect(((after?.payload ?? {}) as Record<string, unknown>).notify_broker_sms).toEqual(list)

    // Restore the open status the remaining cases expect.
    await sb.from('marketing_brain_actions').update({ status: 'pending' }).eq('id', actionId)
  }, 30000)

  it('never clobbers an existing cmas row (review HIGH): a kick-off against a finalized CMA returns alreadyBuilt and touches nothing', async () => {
    expect(personId).not.toBeNull()
    expect(slug).not.toBeNull()
    const { kickoffCmaCore } = await import('@/lib/crm/cma-kickoff')

    // Make the fixture row look like a delivered document for a DIFFERENT client.
    await sb
      .from('cmas')
      .update({ status: 'finalized', client_name: 'Original Client', client_email: ORIGINAL_EMAIL })
      .eq('slug', slug!)
    // Clear the open action + idem keys so neither dedupe layer intercepts first.
    await sb.from('marketing_brain_actions').delete().eq('target', `cma:${slug}`)
    await sb.from('crm_idempotency_keys').delete().like('key', `cma-kickoff:${personId}:%`)

    const res = await kickoffCmaCore({
      personId: personId!,
      address: ADDRESS,
      idempotencyKey: intId('kickoff-d'),
      actorBroker: 'matt',
    })
    expect(res.ok).toBe(true)
    if (res.ok) expect(res.alreadyBuilt).toBe(true)

    // THE invariant: the existing document is untouched — status/client did NOT
    // reset to a fresh draft for the new kicker, and nothing was enqueued.
    const { data: after } = await sb
      .from('cmas')
      .select('status, client_name, client_email')
      .eq('slug', slug!)
      .single()
    expect(after!.status).toBe('finalized')
    expect(after!.client_name).toBe('Original Client')
    expect(after!.client_email).toBe(ORIGINAL_EMAIL)
    const { data: actions } = await sb.from('marketing_brain_actions').select('id').eq('target', `cma:${slug}`)
    expect((actions ?? []).length).toBe(0)
  }, 30000)

  it('a never-built stub (killed build) is re-kickable, not a dead-end (review LOW)', async () => {
    expect(personId).not.toBeNull()
    expect(slug).not.toBeNull()
    const { kickoffCmaCore } = await import('@/lib/crm/cma-kickoff')

    // Make the fixture row look like a killed build's leftover: pending
    // html_path, no content, draft status. Clear actions + idem keys.
    await sb
      .from('cmas')
      .update({ status: 'draft', html_path: `pending:${slug}`, html_content: null })
      .eq('slug', slug!)
    await sb.from('marketing_brain_actions').delete().eq('target', `cma:${slug}`)
    await sb.from('crm_idempotency_keys').delete().like('key', `cma-kickoff:${personId}:%`)

    const res = await kickoffCmaCore({
      personId: personId!,
      address: ADDRESS,
      idempotencyKey: intId('kickoff-e'),
      actorBroker: 'matt',
    })
    expect(res.ok).toBe(true)
    if (res.ok) {
      expect(res.alreadyBuilt ?? false).toBe(false) // NOT treated as an existing document
      expect(res.alreadyQueued).toBe(false) // a fresh build was enqueued
    }
    const { data: actions } = await sb.from('marketing_brain_actions').select('id').eq('target', `cma:${slug}`)
    expect((actions ?? []).length).toBe(1)
  }, 30000)

  it('an explicit fresh build on a protected document opens --v2 and preserves the original (Matt decision 2026-07-17)', async () => {
    expect(personId).not.toBeNull()
    expect(slug).not.toBeNull()
    const { kickoffCmaCore } = await import('@/lib/crm/cma-kickoff')

    // Reset the fixture to a protected document for the ORIGINAL client, with
    // no open builds and no idempotency interference.
    await sb
      .from('cmas')
      .update({
        status: 'finalized',
        client_name: 'Original Client',
        client_email: ORIGINAL_EMAIL,
        html_path: `db:cmas.html_content:${slug}`,
        html_content: '<html>original finalized document</html>',
      })
      .eq('slug', slug!)
    await sb
      .from('marketing_brain_actions')
      .delete()
      .in('target', [`cma:${slug}`, `cma:${slug}--v2`])
    await sb.from('crm_idempotency_keys').delete().like('key', `cma-kickoff:${personId}:%`)

    // Without the opt-in: the guard surfaces the existing document + status.
    const guarded = await kickoffCmaCore({
      personId: personId!,
      address: ADDRESS,
      idempotencyKey: intId('kickoff-c'),
      actorBroker: 'matt',
    })
    expect(guarded.ok).toBe(true)
    if (guarded.ok) {
      expect(guarded.alreadyBuilt).toBe(true)
      expect(guarded.existingStatus).toBe('finalized')
    }

    // With the opt-in (a NEW key — the sheet's confirmation tap): fresh --v2.
    const fresh = await kickoffCmaCore({
      personId: personId!,
      address: ADDRESS,
      idempotencyKey: intId('kickoff-f'),
      actorBroker: 'matt',
      buildNewVersion: true,
    })
    expect(fresh.ok).toBe(true)
    if (!fresh.ok) return
    expect(fresh.alreadyQueued).toBe(false)
    expect(fresh.alreadyBuilt ?? false).toBe(false)
    expect(fresh.slug).toBe(`${slug}--v2`)

    // THE invariant: the original document is byte-for-byte untouched.
    const { data: original } = await sb
      .from('cmas')
      .select('status, client_name, client_email, html_content')
      .eq('slug', slug!)
      .single()
    expect(original!.status).toBe('finalized')
    expect(original!.client_name).toBe('Original Client')
    expect(original!.html_content).toBe('<html>original finalized document</html>')

    // The fresh draft exists at --v2 with a queued build carrying the notify seed.
    const { data: v2 } = await sb.from('cmas').select('status').eq('slug', `${slug}--v2`).single()
    expect(v2!.status).toBe('draft')
    const { data: action } = await sb
      .from('marketing_brain_actions')
      .select('payload, status')
      .eq('target', `cma:${slug}--v2`)
      .single()
    expect(['pending', 'in_production']).toContain(String(action!.status))
    expect((action!.payload as Record<string, unknown>).notify_broker_sms).toEqual([
      { person_id: personId, broker: 'matt' },
    ])
  }, 30000)

  it('the DB backstop holds (review MED): a second OPEN content:cma row for one target is rejected by the partial unique index', async () => {
    const target = `cma:${intId('race')}`
    const base = {
      action_type: 'content:cma',
      target,
      assigned_producer: 'marketing_brain_skills/producers/cma',
      payload: {},
      status: 'pending',
      topic: `${INT_MARKER} race probe`,
      format: 'cma',
      platforms: ['email'],
      hook: INT_MARKER,
      target_audience: 'seller-lead',
      data_sources: {},
      predicted_outcome: {},
      generated_by: 'int-test',
    }
    const first = await sb.from('marketing_brain_actions').insert(base).select('id').single()
    expect(first.error).toBeNull()
    const second = await sb.from('marketing_brain_actions').insert(base).select('id').single()
    expect(second.error?.code).toBe('23505')
    await sb.from('marketing_brain_actions').delete().eq('target', target)
  }, 30000)
})
