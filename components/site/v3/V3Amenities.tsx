/**
 * PATTERN — AMENITIES. The authored on-the-ground list, as a first-class
 * section (SITE-116).
 *
 * WHY NOT QUIET. Chip rows under #belonging made the amenity list supporting
 * copy. A master-planned community is sold on what is on the ground. This
 * primitive is the section chrome: eyebrow, heading, claim, the catalog
 * InsightCards island as children, and the §0 trace. It never invents an
 * amenity. Empty names render nothing.
 *
 * Barrel law honored here:
 *  - Imports only ./atoms, ./tokens.css, @/lib/utils.
 *  - No 'use client'. The interactive board is a child the route supplies
 *    (CommunityAmenities → InsightCards).
 *  - Every color and measure comes from ./tokens.css.
 *  - The section id comes from the caller.
 */

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { V3Eyebrow, V3Heading, V3Lede, V3SourceDisclosure, V3_ROOT_CLASS } from './atoms'
import './tokens.css'
import './V3Amenities.css'

export type V3AmenitiesProps = {
  id: string
  eyebrow?: string
  heading: string
  lede?: string
  source?: string
  children: ReactNode
  className?: string
}

function trimmed(value: string | undefined): string | undefined {
  const t = value?.trim()
  return t ? t : undefined
}

export function V3Amenities({
  id,
  eyebrow,
  heading,
  lede,
  source,
  children,
  className,
}: V3AmenitiesProps) {
  const title = trimmed(heading)
  if (!title) return null

  const headingId = `${id}-heading`
  const contextLine = trimmed(eyebrow)
  const claim = trimmed(lede)
  const trace = trimmed(source)

  return (
    <section
      id={id}
      className={cn(V3_ROOT_CLASS, 'v3-amenities', className)}
      aria-labelledby={headingId}
    >
      {contextLine ? <V3Eyebrow>{contextLine}</V3Eyebrow> : null}
      <V3Heading id={headingId} level={2} size="field">
        {title}
      </V3Heading>
      {claim ? <V3Lede>{claim}</V3Lede> : null}
      <div className="v3-amenities__board">{children}</div>
      {trace ? <V3SourceDisclosure source={trace} className="v3-amenities__source" /> : null}
    </section>
  )
}
