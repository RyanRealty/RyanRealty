import { describe, it, expect } from 'vitest'
import { recordConversationMessage } from './record-message'

/**
 * Regression lock for the conversation-model chokepoint. Pins the RESOLUTION
 * decisions (group-vs-1:1 keying, provider_sid dedup short-circuit, participant
 * role assignment) against a scripted Supabase builder — no DB creds needed. The
 * live DB behavior (triggers advancing counts/clocks) is proven by the migration
 * verification; this locks the branching in the helper itself.
 */

type Canned = { data?: unknown; error?: unknown }

// Minimal chainable stub. Terminal reads (maybeSingle/single) resolve to the
// next canned response in `reads`; inserts push onto `inserts` and resolve to the
// next canned response in `writes`. Every filter is recorded for assertions.
function makeSb(opts: { reads: Canned[]; writes?: Canned[] }) {
  const reads = [...opts.reads]
  const writes = [...(opts.writes ?? [])]
  const calls: Array<{ table: string; op: string; payload?: unknown; filters: Record<string, unknown> }> = []
  function builder(table: string, op: string, payload?: unknown) {
    const rec = { table, op, payload, filters: {} as Record<string, unknown> }
    calls.push(rec)
    const chain: Record<string, unknown> = {}
    for (const m of ['select', 'order', 'limit', 'upsert']) chain[m] = () => chain
    for (const f of ['eq', 'is']) chain[f] = (col: string, val: unknown) => { rec.filters[col] = val; return chain }
    chain.maybeSingle = async () => reads.shift() ?? { data: null }
    chain.single = async () => (op === 'insert' ? writes.shift() : reads.shift()) ?? { data: null }
    return chain
  }
  const sb = {
    from(table: string) {
      return {
        select: (_c?: unknown, _o?: unknown) => builder(table, 'select'),
        insert: (payload: unknown) => builder(table, 'insert', payload),
        upsert: (payload: unknown) => builder(table, 'upsert', payload),
        delete: () => builder(table, 'delete'),
      }
    },
  }
  return { sb: sb as never, calls }
}

describe('recordConversationMessage — resolution logic', () => {
  it('dedups on an already-recorded provider_sid without resolving a conversation', async () => {
    const { sb, calls } = makeSb({ reads: [{ data: { id: 'm1', conversation_id: 'c1' } }] })
    const r = await recordConversationMessage({
      sb, direction: 'out', channel: 'sms', providerSid: 'SID-dupe', primaryPersonId: 7,
      participants: [{ personId: 7, address: '+1' }],
    })
    expect(r.ok).toBe(true)
    if (r.ok) { expect(r.deduped).toBe(true); expect(r.messageId).toBe('m1') }
    // only the dedup probe ran — no conversation select/insert
    expect(calls.every((c) => c.table === 'crm_message')).toBe(true)
  })

  it('reuses the existing 1:1 conversation for the primary contact', async () => {
    const { sb, calls } = makeSb({
      reads: [
        { data: null },                 // provider_sid dedup probe → miss
        { data: { id: 'existing-1to1' } }, // 1:1 conversation lookup → hit
      ],
      writes: [{ data: { id: 'msg-new' } }], // message insert
    })
    const r = await recordConversationMessage({
      sb, direction: 'out', channel: 'sms', providerSid: 'SID-a', primaryPersonId: 7,
      participants: [{ personId: 7, address: '+1' }],
    })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.conversationId).toBe('existing-1to1')
    // the 1:1 lookup filtered by primary_person_id + is_group=false
    const convLookup = calls.find((c) => c.table === 'crm_conversation' && c.op === 'select')
    expect(convLookup?.filters.primary_person_id).toBe(7)
    expect(convLookup?.filters.is_group).toBe(false)
    // no conversation was inserted (reused)
    expect(calls.some((c) => c.table === 'crm_conversation' && c.op === 'insert')).toBe(false)
    // participant upserted with role contact
    const partUpsert = calls.find((c) => c.table === 'crm_conversation_participant')
    expect((partUpsert?.payload as Array<{ role: string }>)[0].role).toBe('contact')
  })

  it('keys a group conversation on the Twilio Conversation SID and marks raw members', async () => {
    const { sb, calls } = makeSb({
      reads: [
        { data: null },                    // provider_sid dedup → miss
        { data: null },                    // group lookup by sid → miss
      ],
      writes: [
        { data: { id: 'grp-conv' } },      // conversation insert
        { data: { id: 'grp-msg' } },       // message insert
      ],
    })
    const r = await recordConversationMessage({
      sb, direction: 'out', channel: 'mms', providerSid: 'SID-g', primaryPersonId: 7,
      twilioConversationSid: 'CH-123',
      participants: [
        { personId: 7, address: '+1' },
        { rawPhone: '+2', address: '+2' },
      ],
    })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.conversationId).toBe('grp-conv')
    const grpLookup = calls.find((c) => c.table === 'crm_conversation' && c.op === 'select')
    expect(grpLookup?.filters.twilio_conversation_sid).toBe('CH-123')
    // participant roles: contact for the person, raw for the bare number
    const partUpsert = calls.find((c) => c.table === 'crm_conversation_participant')
    const rows = partUpsert?.payload as Array<{ role: string; person_id: number | null }>
    expect(rows.find((x) => x.person_id === 7)?.role).toBe('contact')
    expect(rows.find((x) => x.person_id === null)?.role).toBe('raw')
  })

  it('returns an error result (never throws) when a 1:1 has no primary contact', async () => {
    const { sb } = makeSb({ reads: [{ data: null }] })
    const r = await recordConversationMessage({
      sb, direction: 'in', channel: 'sms', participants: [{ rawPhone: '+9', address: '+9' }],
    })
    expect(r.ok).toBe(false)
  })
})
