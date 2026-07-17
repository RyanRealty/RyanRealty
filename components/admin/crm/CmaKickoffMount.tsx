/**
 * Server-side mount for the one-tap CMA kick-off (D8 litmus).
 *
 * Resolves the best subject-address suggestion — the owned home on file,
 * else the address parsed from the lead's latest inbound text — and mounts
 * the dialog, auto-opened by the `?intent=cma` notification deep link.
 * Extracted from app/admin/(protected)/crm/[id]/page.tsx (file-size budget).
 */

import { CmaKickoffSheet } from './CmaKickoffSheet'
import { extractAddressCandidate } from '@/lib/crm/seller-intent'

export function CmaKickoffMount({
  personId,
  personName,
  personPhone,
  personEmail,
  homeAddress,
  timeline,
  intent,
}: {
  personId: number
  personName: string | null
  personPhone: string | null
  personEmail: string | null
  homeAddress: string | null
  timeline: Array<{ kind: string; body: string | null }>
  intent: string | undefined
}) {
  const latestInboundText = timeline.find((t) => t.kind === 'sms_in')?.body ?? null
  return (
    <CmaKickoffSheet
      personId={personId}
      personName={personName}
      personPhone={personPhone}
      personEmail={personEmail}
      suggestedAddress={homeAddress ?? extractAddressCandidate(latestInboundText)}
      autoOpen={intent === 'cma'}
    />
  )
}
