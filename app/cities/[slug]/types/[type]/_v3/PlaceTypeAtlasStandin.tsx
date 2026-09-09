/**
 * PlaceTypeAtlasStandin — the place-type Atlas section when the map is not
 * (yet) drawable.
 *
 * WHY IT EXISTS. The Atlas is this page class's differentiator, and until
 * 2026-09-09 it was gated on `atlasRegions.length > 0` with nothing on the
 * other side of the ternary. The boundary read behind it is a guarded read
 * with a timeout, so on any load where that read did not come back in budget
 * the whole section vanished and the desktop fold resolved to eight identical
 * listing rows — the taste table's own banned tell, arrived at by a race
 * rather than by a decision. The evaluator caught exactly that: the Atlas
 * present in the 375 capture of /communities/tetherow/types/single-family and
 * ENTIRELY ABSENT from the 1440 capture of the same URL (taste table
 * 2026-09-08, place-type-community, "Missing states").
 *
 * So the section is now unconditional and this component is the other branch.
 * It keeps the section's id, its heading, and its footprint, and it says which
 * of the two things is true — the map is still arriving, or it could not be
 * read this time. Neither is silence.
 *
 * No client JS: it is a paragraph and a box.
 */
import Link from 'next/link'
import { V3_ROOT_CLASS, V3Heading } from '@/components/site/v3'
import { cn } from '@/lib/utils'
import './place-type-page.css'

export type PlaceTypeAtlasStandinProps = {
  id: string
  /** The Atlas's own eyebrow, so the section reads the same either way. */
  eyebrow: string
  placeName: string
  /** `loading` streams while the boundary resolves; `unavailable` is the miss. */
  state: 'loading' | 'unavailable'
  /** Where the reader can still see this place on a map. */
  placeHref: string
}

export function PlaceTypeAtlasStandin({
  id,
  eyebrow,
  placeName,
  state,
  placeHref,
}: PlaceTypeAtlasStandinProps) {
  const loading = state === 'loading'
  return (
    <section
      id={id}
      className={cn(V3_ROOT_CLASS, 'place-atlas-standin', loading && 'is-loading')}
      aria-label={`${eyebrow}, ${placeName}`}
      aria-busy={loading || undefined}
    >
      <div className="place-atlas-standin__head">
        <V3Heading level={2} className="place-atlas-standin__eyebrow">
          {eyebrow}
        </V3Heading>
        <p className="place-atlas-standin__note">
          {loading
            ? `Drawing the map of ${placeName}.`
            : `The map of ${placeName} could not be read on this refresh. Every listing below is still live.`}
        </p>
      </div>
      <div className="place-atlas-standin__field" aria-hidden="true" />
      {loading ? null : (
        <p className="place-atlas-standin__out">
          <Link href={placeHref}>See {placeName} on the map</Link>
        </p>
      )}
    </section>
  )
}
