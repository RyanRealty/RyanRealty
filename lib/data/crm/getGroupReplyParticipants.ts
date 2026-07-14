/**
 * getGroupReplyParticipants — reconstruct the people who belong in a group text
 * reply. Every group message on this contact's timeline stored the full member
 * list (payload.groupMembers for FUB-imported threads, payload.groupTo for
 * native Twilio-Conversations sends). A reply must go back to those same people,
 * not just the primary — so this returns each participant as a recipient the
 * composer can pre-select and the send can reach:
 *
 *   { personId: number | null, name, phone }
 *
 * A number resolves to a contact via crm_contact_points → personId + name; an
 * unresolved number is still returned (personId null, name = formatted phone) so
 * the group reply includes it as a RAW recipient (Matt's rule: nobody dropped).
 *
 * Excluded: the broker's own Twilio lines (always in the group as the sender) and
 * the primary contact's own numbers (they are the thread owner, added separately).
 *
 * DAL boundary (G1): the raw .from() reads live here, inside lib/data/.
 */
import { createServiceClient } from '@/lib/supabase/service'

export type GroupParticipant = { personId: number | null; name: string; phone: string }

const ten = (s: string | null | undefined): string | null => {
  const d = String(s ?? '').replace(/\D/g, '')
  return d.length >= 10 ? d.slice(-10) : null
}

/** Ryan Realty's own Twilio lines — always present in a group as the sender leg. */
const BROKER_LINES = new Set(['5417033095', '5412503380', '5415023436', '5412245025'])

function fmt(tenDigits: string): string {
  return `(${tenDigits.slice(0, 3)}) ${tenDigits.slice(3, 6)}-${tenDigits.slice(6)}`
}

export async function getGroupReplyParticipants(personId: number): Promise<GroupParticipant[]> {
  if (!Number.isFinite(personId) || personId <= 0) return []
  const sb = createServiceClient()

  // Group messages on this contact's timeline carry the member list.
  const { data: rows } = await sb
    .from('crm_timeline')
    .select('payload')
    .eq('person_id', personId)
    .in('kind', ['sms_in', 'sms_out'])
    .contains('payload', { group: true })
  if (!rows || rows.length === 0) return []

  // The primary's own numbers (exclude — they are added as the thread owner).
  const { data: self } = await sb.from('crm_people').select('phones').eq('id', personId).maybeSingle()
  const ownTens = new Set(
    (Array.isArray(self?.phones) ? self!.phones : [])
      .map((p: { value?: string }) => ten(p.value))
      .filter((v): v is string => v !== null),
  )

  // Collect every participant number across the contact's group threads.
  const memberTens = new Set<string>()
  for (const r of rows) {
    const pl = (r.payload ?? {}) as { groupMembers?: unknown[]; groupTo?: unknown[] }
    for (const list of [pl.groupMembers, pl.groupTo]) {
      if (!Array.isArray(list)) continue
      for (const m of list) {
        const t = ten(String(m))
        if (t && !BROKER_LINES.has(t) && !ownTens.has(t)) memberTens.add(t)
      }
    }
  }
  if (memberTens.size === 0) return []

  // Resolve numbers → contacts in one round trip.
  const tens = [...memberTens]
  const { data: cps } = await sb.from('crm_contact_points').select('person_id, value').eq('kind', 'phone').in('value', tens)
  const personByTen = new Map<string, number>()
  for (const c of cps ?? []) if (!personByTen.has(c.value)) personByTen.set(c.value, c.person_id as number)

  const nameByPerson = new Map<number, string>()
  const pids = [...new Set([...personByTen.values()])]
  if (pids.length > 0) {
    const { data: ppl } = await sb.from('crm_people').select('id, name').in('id', pids)
    for (const p of ppl ?? []) nameByPerson.set(p.id as number, String(p.name ?? '').trim())
  }

  const out: GroupParticipant[] = []
  const seen = new Set<string>()
  for (const t of tens) {
    if (seen.has(t)) continue
    seen.add(t)
    const pid = personByTen.get(t) ?? null
    // skip if it resolved back to the primary (own number on another record)
    if (pid === personId) continue
    out.push({ personId: pid, name: pid ? (nameByPerson.get(pid) || fmt(t)) : fmt(t), phone: fmt(t) })
  }
  // named contacts first, then raw numbers, stable by name/phone
  out.sort((a, b) => Number(b.personId != null) - Number(a.personId != null) || a.name.localeCompare(b.name))
  return out
}
