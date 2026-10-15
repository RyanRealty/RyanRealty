'use server'

import { revalidatePerson } from '@/lib/crm/revalidate-person'
import { applyPersonChannelConsent } from '@/lib/data/crm/applyPersonChannelConsent'
import { getCrmAccess, requirePersonInScope } from '@/app/actions/crm'
import type { ConsentChannel } from '@/lib/crm/person-channel-consent'

export type SetPersonChannelConsentResult =
  | { ok: true; applied: boolean; timelineId: number | null }
  | { ok: false; error: string }

export async function setPersonChannelConsentAction(input: {
  personId: number
  channel: ConsentChannel
  allowed: boolean
}): Promise<SetPersonChannelConsentResult> {
  const access = await getCrmAccess()
  if (!access) return { ok: false, error: 'Unauthorized' }
  const personId = Number(input.personId)
  if (!Number.isInteger(personId) || personId <= 0) return { ok: false, error: 'A contact is required' }
  const scoped = await requirePersonInScope(personId, access)
  if (!scoped.ok) return { ok: false, error: 'Not found' }

  const out = await applyPersonChannelConsent({
    personId,
    channel: input.channel,
    allowed: input.allowed === true,
    broker: access.brokerSlug ?? null,
  })
  revalidatePerson(personId)
  if (!out.ok) return { ok: false, error: out.reason ?? 'Could not update consent' }
  if (out.skipped === 'refuse') {
    return { ok: false, error: `Cannot set ${input.channel} to allowed (${out.reason ?? 'locked'})` }
  }
  return { ok: true, applied: out.applied, timelineId: out.timelineId }
}
