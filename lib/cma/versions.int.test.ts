/**
 * Real-DB regression for the version-chain primitives beyond the CMA intake
 * suite (lib/cma-request.int.test.ts):
 *
 *  1. resolveWritableBpoSlot — the BPO half of the upsert-by-slug clobber
 *     class: a 'final' BPO (live /bpo/[slug] link) is never a writable slot;
 *     drafts (including failed builds, which keep status 'draft' with
 *     build_error set) are rebuilt in place.
 *  2. cma_action_merge_contact RPC — the attach path's contact refresh merges
 *     ONLY the four contact keys (notify_broker_sms survives), and refuses
 *     once the build is closed.
 *
 * Skips without DB creds; self-cleaning. Identifiers come from
 * @/test/int-scope so the pre-run / post-run sweep clears them if this run is
 * killed before afterAll.
 */
import { afterAll, describe, expect, it } from 'vitest'
import { config } from 'dotenv'
import { INT_MARKER, intId } from '@/test/int-scope'

config({ path: '.env.local' })

const HAVE_DB = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.NEXT_PUBLIC_SUPABASE_URL)
const run = HAVE_DB ? describe : describe.skip

run('BPO writable-slot resolution (the clobber class, BPO half)', () => {
  let sb: import('@supabase/supabase-js').SupabaseClient
  const baseSlug = intId('bpo-slot')
  const bpoAddress = `${baseSlug} St, Bend`

  afterAll(async () => {
    if (!sb) return
    await sb
      .from('broker_price_opinions')
      .delete()
      .in('slug', [baseSlug, `${baseSlug}--v2`, `${baseSlug}--v3`])
  })

  it('a FINAL document is protected: the slot steps to --v2; drafts rebuild in place', async () => {
    const { createServiceClient } = await import('@/lib/supabase/service')
    sb = createServiceClient()
    const { resolveWritableBpoSlot } = await import('@/lib/cma/versions')

    // Empty chain → the base slug is the writable slot.
    const fresh = await resolveWritableBpoSlot(baseSlug)
    expect(fresh.ok).toBe(true)
    if (fresh.ok) {
      expect(fresh.slug).toBe(baseSlug)
      expect(fresh.existing).toBeNull()
    }

    // Seed a FINAL document (live /bpo link) — must never be the slot again.
    const { error: seedErr } = await sb.from('broker_price_opinions').insert({
      slug: baseSlug,
      subject_address: bpoAddress,
      status: 'final',
      html_path: `db:broker_price_opinions.html_content:${baseSlug}`,
      html_content: '<html>final opinion</html>',
    })
    expect(seedErr).toBeNull()

    const afterFinal = await resolveWritableBpoSlot(baseSlug)
    expect(afterFinal.ok).toBe(true)
    if (afterFinal.ok) {
      expect(afterFinal.slug).toBe(`${baseSlug}--v2`)
      expect(afterFinal.existing).toBeNull()
      expect(afterFinal.priorStatus).toBe('final')
    }

    // A draft at --v2 (as a failed build would leave: status draft +
    // build_error) is rebuilt in place — the liveness half of the contract.
    const { error: draftErr } = await sb.from('broker_price_opinions').insert({
      slug: `${baseSlug}--v2`,
      subject_address: bpoAddress,
      status: 'draft',
      html_path: `pending:${baseSlug}--v2`,
      build_error: `${INT_MARKER}: simulated failed build`,
    })
    expect(draftErr).toBeNull()

    const afterDraft = await resolveWritableBpoSlot(baseSlug)
    expect(afterDraft.ok).toBe(true)
    if (afterDraft.ok) {
      expect(afterDraft.slug).toBe(`${baseSlug}--v2`)
      expect(afterDraft.existing).not.toBeNull()
      expect(afterDraft.priorStatus).toBe('final')
    }

    // And the FINAL document was never touched.
    const { data: finalRow } = await sb
      .from('broker_price_opinions')
      .select('status, html_content')
      .eq('slug', baseSlug)
      .single()
    expect(finalRow!.status).toBe('final')
    expect(finalRow!.html_content).toBe('<html>final opinion</html>')
  }, 30000)
})

run('cma_action_merge_contact RPC (attach contact refresh)', () => {
  let sb: import('@supabase/supabase-js').SupabaseClient
  const target = `cma:${intId('merge')}`
  let actionId: string

  afterAll(async () => {
    if (!sb) return
    await sb.from('marketing_brain_actions').delete().eq('target', target)
  })

  it('merges only contact keys (notify list survives) and refuses once closed', async () => {
    const { createServiceClient } = await import('@/lib/supabase/service')
    sb = createServiceClient()
    const { mergeCmaActionContact } = await import('@/lib/data')

    const { data: row, error: seedErr } = await sb
      .from('marketing_brain_actions')
      .insert({
        action_type: 'content:cma',
        target,
        assigned_producer: 'marketing_brain_skills/producers/cma',
        payload: {
          client_email: 'first@example.invalid',
          notify_broker_sms: [{ person_id: 1, broker: 'matt' }],
        },
        status: 'pending',
        topic: `${INT_MARKER} merge probe`,
        format: 'cma',
        platforms: ['email'],
        hook: INT_MARKER,
        target_audience: 'seller-lead',
        data_sources: {},
        predicted_outcome: {},
        generated_by: 'int-test',
      })
      .select('id')
      .single()
    expect(seedErr).toBeNull()
    actionId = row!.id as string

    const res = await mergeCmaActionContact(actionId, {
      clientEmail: 'second@example.invalid',
      clientName: 'Second Lead',
    })
    expect(res.merged).toBe(true)
    expect(res.status).toBe('pending')

    const { data: after } = await sb
      .from('marketing_brain_actions')
      .select('payload')
      .eq('id', actionId)
      .single()
    const payload = (after!.payload ?? {}) as Record<string, unknown>
    expect(payload.client_email).toBe('second@example.invalid')
    expect(payload.client_name).toBe('Second Lead')
    // THE invariant vs the old read-modify-write: the notify list is intact.
    expect(payload.notify_broker_sms).toEqual([{ person_id: 1, broker: 'matt' }])

    // Closed build → the merge refuses and reports the status.
    await sb
      .from('marketing_brain_actions')
      .update({ status: 'killed', killed_reason: 'int-test: closing before refusal check' })
      .eq('id', actionId)
    const refused = await mergeCmaActionContact(actionId, { clientEmail: 'third@example.invalid' })
    expect(refused.merged).toBe(false)
    expect(refused.status).toBe('killed')
    const { data: closed } = await sb
      .from('marketing_brain_actions')
      .select('payload')
      .eq('id', actionId)
      .single()
    expect(((closed!.payload ?? {}) as Record<string, unknown>).client_email).toBe('second@example.invalid')
  }, 30000)
})
