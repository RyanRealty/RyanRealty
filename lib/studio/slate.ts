/**
 * lib/studio/slate.ts — the editorial layer.
 *
 * This is the piece the old marketing brain never had. There were forty
 * producers and nothing deciding what to make, so nothing got made. The rule
 * here is that content follows a real event: a house came on the market, a
 * community's inventory moved, the region's numbers changed. When nothing
 * happened, we say less rather than manufacturing a reason to post.
 *
 * Pure and deterministic. Same inputs, same slate, which is what makes it
 * testable and what keeps the rotation honest instead of drifting to
 * whichever community the generator finds prettiest.
 */
import type { MarketPulse } from '@/lib/data/types/market'
import type { StudioFormatId } from './formats'

export type StudioTrigger = {
  kind: 'new_listing' | 'community_inventory'
  /** What resolveStudioSubject will be handed. */
  query: string
  label: string
  /** Higher wins. */
  weight: number
}

export type SlateItem = {
  formatId: StudioFormatId
  subjectQuery?: string
  /** Why this is on today's slate, in plain language, for the audit trail. */
  because: string
}

export type SlateInput = {
  pulse: MarketPulse | null
  triggers: StudioTrigger[]
  max: number
  /** Injected so the plan is deterministic in tests. */
  today?: Date
}

function dayIndex(date: Date): number {
  const start = Date.UTC(date.getUTCFullYear(), 0, 0)
  return Math.floor((date.getTime() - start) / 86_400_000)
}

/**
 * Build today's slate.
 *
 * Order of preference:
 *   1. A listing that just came on. It is the most perishable thing we have.
 *   2. A community whose inventory actually moved.
 *   3. The regional pulse, once a week, on the same day each week so it reads
 *      as a habit rather than noise.
 *   4. Answer the room, when there is nothing of our own to say.
 */
export function planSlate(input: SlateInput): SlateItem[] {
  const today = input.today ?? new Date()
  const max = Math.max(0, Math.min(5, input.max))
  if (max === 0) return []

  const slate: SlateItem[] = []
  const sorted = [...input.triggers].sort((a, b) => b.weight - a.weight)

  const newListing = sorted.find((t) => t.kind === 'new_listing')
  if (newListing) {
    slate.push({
      formatId: 'listing_motion',
      subjectQuery: newListing.query,
      because: `${newListing.label} came on the market.`,
    })
  }

  const communities = sorted.filter((t) => t.kind === 'community_inventory')
  if (communities.length > 0 && slate.length < max) {
    // Rotate by day so the same community does not win every morning.
    const pick = communities[dayIndex(today) % communities.length]
    slate.push({
      formatId: 'place_video',
      subjectQuery: pick.query,
      because: `${pick.label} inventory moved.`,
    })
  }

  // Monday is the market day. One habit, not a daily number dump.
  const isMarketDay = today.getUTCDay() === 1
  if (isMarketDay && input.pulse && slate.length < max) {
    slate.push({
      formatId: 'market_pulse',
      because: 'Weekly regional pulse.',
    })
  }

  if (slate.length === 0) {
    slate.push({
      formatId: 'trend_reactive',
      because: 'Nothing of ours moved today, so answer what the market is asking.',
    })
  }

  return slate.slice(0, max)
}
