/**
 * getLeadSmsRecipients — the people a broker can quick-add to a group text from a
 * lead: the lead itself (primary), plus each linked relationship (spouse,
 * co-buyer, …) that has a phone on file. Only people WITH a phone are returned.
 *
 * Phone resolution reuses getSendTarget so it matches BOTH the page's phone
 * detection and the actual send path (crm_people.phones → crm_contact_points
 * fallback) — a recipient shown here is one the send can actually reach.
 */
import { getSendTarget } from '@/lib/data/crm/getSendTarget'

export type SmsRecipientOption = {
  personId: number
  name: string
  phone: string
  /** 'Primary' for the lead, else the relationship label (Spouse, Co-buyer, …). */
  relation: string
}

export async function getLeadSmsRecipients(
  personId: number,
  related: Array<{ relatedPersonId: number; label: string }>,
): Promise<SmsRecipientOption[]> {
  if (!Number.isFinite(personId) || personId <= 0) return []

  const relById = new Map(related.map((r) => [r.relatedPersonId, r.label]))
  const ids = [personId, ...Array.from(new Set(related.map((r) => r.relatedPersonId))).filter((id) => id !== personId)]

  const out: SmsRecipientOption[] = []
  for (const id of ids) {
    const target = await getSendTarget(id)
    if (!target || !target.phone) continue
    const p = target.person as { name?: string | null; first_name?: string | null }
    const name = (p.name ?? '').trim() || (p.first_name ?? '').trim() || `Contact #${id}`
    out.push({ personId: id, name, phone: target.phone, relation: id === personId ? 'Primary' : (relById.get(id) ?? 'Linked') })
  }
  return out
}
