/**
 * About first-viewport faces. Canonical transparent PNGs only
 * (`/images/brokers/*.png`). JPG fallbacks carry a white box and are refused.
 * Remote photo_url values are refused — those are not the locked cutouts.
 */

import { teamPath } from '@/lib/slug'

export type AboutFace = {
  href: string
  src: string
  name: string
  title: string
}

const CANONICAL_HEADSHOT = /^\/images\/brokers\/[a-z0-9-]+\.png$/

export function aboutFaceFromBroker(b: {
  slug: string
  fullName: string | null | undefined
  title?: string | null
  headshotPng?: string | null
}): AboutFace | null {
  const name = b.fullName?.trim()
  const slug = b.slug?.trim()
  const src = b.headshotPng?.trim()
  if (!name || !slug || !src) return null
  if (!CANONICAL_HEADSHOT.test(src)) return null
  const title = b.title?.trim()
  return {
    href: teamPath(slug),
    src,
    name,
    title: title || 'Broker',
  }
}
