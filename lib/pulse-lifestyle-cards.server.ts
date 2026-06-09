/**
 * SERVER-ONLY resolution of the /pulse lifestyle cards.
 *
 * This module imports the full asset-library manifest (multi-MB JSON) via
 * lib/pulse-asset-library — it must NEVER be imported from a 'use client'
 * file or anything under components/. The manifest once shipped inside the
 * client bundle this way (+1.5 MB, caught by the bundle-budget gate). The
 * server page resolves LIFESTYLE_CARDS here and passes the small resolved
 * array to PulseFeed as a prop. Enforced by ci:server-only-imports.
 *
 * Adding a new card is two steps: register the photo in the asset library,
 * then add a seed entry here referencing the new ID. We never hardcode URLs —
 * a card without a matching library asset stays in the backlog.
 */

import { findAssetById, buildCreditLine } from './pulse-asset-library'
import type { LifestyleCard, LifestyleCardSeed } from './pulse-lifestyle-cards'

const SEEDS: LifestyleCardSeed[] = [
  {
    id: 'smith-rock',
    category: 'outdoor',
    kicker: 'Day trip',
    headline: 'Climb at Smith Rock',
    body: 'World-class climbing twenty-five minutes north. Pack water.',
    asset_id: 'bbca6dec',
    href: '/blog?tag=outdoors',
    ctaLabel: 'Day trip guide',
  },
  {
    id: 'old-mill-summer',
    category: 'event',
    kicker: 'Bend events',
    headline: 'Summer at the Old Mill',
    body: 'Concerts, floaters, and the river footbridge. Bend in three smokestacks.',
    asset_id: '113232e1',
    href: 'https://www.oldmilldistrict.com/events/',
    ctaLabel: 'See what is on',
  },
  {
    id: 'mt-bachelor-season',
    category: 'outdoor',
    kicker: 'In the Cascades',
    headline: 'Bachelor opens in November',
    body: 'Lift tickets and season passes go on sale every fall.',
    asset_id: 'a2341149',
    href: '/blog?tag=outdoors',
    ctaLabel: 'See the season',
  },
  {
    id: 'cascade-lakes-drive',
    category: 'outdoor',
    kicker: 'Sunday drive',
    headline: 'Cascade Lakes Scenic Byway',
    body: 'Sixty-six miles of alpine lakes west of Bend. Open through October.',
    asset_id: '1f868da9',
    href: '/blog?tag=outdoors',
    ctaLabel: 'Route + stops',
  },
  {
    id: 'three-sisters-sunrise',
    category: 'outdoor',
    kicker: 'Postcard',
    headline: 'The Three Sisters at sunrise',
    body: "South, Middle, and North — Bend's western horizon, lit pink.",
    asset_id: 'a718f230',
    href: '/blog?tag=outdoors',
    ctaLabel: 'Where to watch',
  },
  {
    id: 'sparks-lake-sunrise',
    category: 'outdoor',
    kicker: 'Cascade Lakes',
    headline: 'Sparks Lake at sunrise',
    body: 'Twenty-eight miles from downtown. Quietest water in Central Oregon.',
    asset_id: 'face42ef',
    href: '/blog?tag=outdoors',
    ctaLabel: 'How to get there',
  },
  {
    id: 'still-vibrato',
    category: 'dining',
    kicker: 'Where to start the day',
    headline: 'Still Vibrato',
    body: 'Downtown Bend coffee bar. Drip and a quiet morning crowd.',
    asset_id: '4a8123ab',
    href: '/blog?tag=dining',
    ctaLabel: 'See more spots',
  },
  {
    id: 'downtown-bend-walk',
    category: 'culture',
    kicker: 'Walk it',
    headline: 'Downtown Bend',
    body: 'Wall, Minnesota, Bond. Locally owned shops on every block.',
    asset_id: '0a37e880',
    href: '/communities/downtown-bend',
    ctaLabel: 'Walk the district',
  },
]

function resolveCard(seed: LifestyleCardSeed): LifestyleCard | null {
  const asset = findAssetById(seed.asset_id)
  if (!asset?.public_url) return null
  const altGuess = asset.search_query || asset.subject_tags.join(', ') || seed.headline
  return {
    ...seed,
    asset,
    backgroundImage: asset.public_url,
    backgroundAlt: altGuess,
    credit: buildCreditLine(asset),
  }
}

export const LIFESTYLE_CARDS: LifestyleCard[] = SEEDS
  .map(resolveCard)
  .filter((c): c is LifestyleCard => c !== null)

/**
 * Backlog — content we want to ship but don't yet have a content-matching
 * asset for. Register the photo in the asset library, then move the seed up
 * into the main list. Do NOT ship a card without a matching photo.
 */
export const _BACKLOG: Array<{ id: string; reason: string }> = [
  { id: 'phils-trail', reason: 'Need a first-party Phil\'s Trail or Bend MTB shot' },
  { id: 'bend-farmers-market', reason: 'Need a real Wednesday-market photo' },
  { id: 'nwx-walkable', reason: 'Need a real NWX district shot' },
  { id: 'first-friday', reason: 'Need a real downtown gallery night shot' },
  { id: 'mortgage-rates', reason: 'Text-only card needs a thoughtful design' },
]

export function pickLifestyleCard(index: number): LifestyleCard | null {
  const list = LIFESTYLE_CARDS
  if (list.length === 0) return null
  const safe = ((index % list.length) + list.length) % list.length
  return list[safe]
}
