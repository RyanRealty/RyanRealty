import { V3Instrument, v3Text } from '@/components/site/v3'
import type { ListingAskClaim } from './listing-ask'

export function ListingAskInstrument({ claim }: { claim: ListingAskClaim }) {
  return (
    <V3Instrument
      id="ask"
      level={2}
      eyebrow={v3Text(claim.eyebrow)}
      headline={v3Text(claim.headline)}
      figures={claim.figures}
      foldAfter={3}
      source={v3Text(claim.source)}
      updated={claim.updated ? v3Text(claim.updated) : undefined}
      action={
        claim.action
          ? { label: v3Text(claim.action.label), href: claim.action.href, variant: 'ghost' }
          : undefined
      }
    />
  )
}
