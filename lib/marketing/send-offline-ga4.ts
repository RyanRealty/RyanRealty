/**
 * Fire one GA4 offline conversion through the same Measurement Protocol
 * helper generate_lead uses (lib/ga4-measurement-protocol.ts).
 *
 * Idempotent per contact+stage via crm_idempotency_keys. A failed send releases
 * the key so the next daily run retries; a success never resends.
 */
import { fireGa4Event } from '@/lib/ga4-measurement-protocol'
import { withSendIdempotency } from '@/lib/crm/idempotency'
import {
  GA4_OFFLINE_SCOPE,
  ga4OfflineIdempotencyKey,
  offlineGa4EventParams,
  type Ga4OfflineEvent,
} from '@/lib/marketing/offline-ga4'

export type OfflineGa4SendResult =
  | { ok: true; eventId: string; dryRun?: boolean }
  | { ok: false; eventId: string; error: string }

export async function sendOfflineGa4Conversion(input: {
  personId: number
  event: Ga4OfflineEvent
  clientId: string
  dryRun?: boolean
}): Promise<OfflineGa4SendResult> {
  const eventId = ga4OfflineIdempotencyKey(input.personId, input.event.stageKey)
  if (input.dryRun) return { ok: true, eventId, dryRun: true }

  const eventParams = offlineGa4EventParams(input.event.leadType)
  return withSendIdempotency(
    { key: eventId, scope: GA4_OFFLINE_SCOPE, onInFlight: { ok: true, eventId } },
    async () => {
      const res = await fireGa4Event({
        eventName: input.event.eventName,
        clientId: input.clientId,
        eventParams,
      })
      if (res.ok) return { ok: true as const, eventId }
      return { ok: false as const, eventId, error: res.error }
    },
  )
}
