/**
 * Central Oregon lifestyle cards interleaved into the /pulse feed —
 * CLIENT-SAFE types and presentation tokens only.
 *
 * The seed list and the asset-library resolution live in
 * lib/pulse-lifestyle-cards.server.ts, because resolving cards imports the
 * full asset-library manifest (multi-MB JSON) which must never reach the
 * client bundle. The server page resolves LIFESTYLE_CARDS and passes them to
 * PulseFeed as a prop. Only `import type` from pulse-asset-library is allowed
 * here — a value import would drag the manifest back into the client graph
 * (enforced by ci:server-only-imports + the bundle-budget gate).
 */

import type { LibraryAsset } from './pulse-asset-library'

export type LifestyleCategory =
  | 'event'
  | 'outdoor'
  | 'neighborhood'
  | 'culture'
  | 'dining'

export type LifestyleCardSeed = {
  id: string
  category: LifestyleCategory
  kicker: string
  headline: string
  body: string
  /** Asset library ID (full or prefix). Required — we never invent URLs. */
  asset_id: string
  href: string
  ctaLabel: string
}

export type LifestyleCard = LifestyleCardSeed & {
  backgroundImage: string
  backgroundAlt: string
  credit: string | null
  asset: LibraryAsset
}

export const CATEGORY_TONE: Record<LifestyleCategory, { chip: string; gradient: string }> = {
  event: {
    chip: 'bg-amber-500/95 text-white',
    gradient: 'from-transparent via-foreground/30 to-foreground',
  },
  outdoor: {
    chip: 'bg-emerald-600/95 text-white',
    gradient: 'from-transparent via-foreground/30 to-foreground',
  },
  neighborhood: {
    chip: 'bg-primary text-primary-foreground',
    gradient: 'from-transparent via-foreground/30 to-foreground',
  },
  culture: {
    chip: 'bg-violet-600/95 text-white',
    gradient: 'from-transparent via-foreground/30 to-foreground',
  },
  dining: {
    chip: 'bg-rose-600/95 text-white',
    gradient: 'from-transparent via-foreground/30 to-foreground',
  },
}
