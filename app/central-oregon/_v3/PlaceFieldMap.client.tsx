'use client'
// brand-voice:exempt — map chrome only, no user-facing prose beyond the two
// status lines in the impl, which state a failure rather than sell anything.

/**
 * Real Google map for V3Field's mapSlot on lifestyle place details.
 *
 * Route-local (lease E-PLACES-REST). Same reason the community node has its own:
 * existing maps carry their own section chrome or hold no binding. This fills
 * the frame, draws the same homes the list renders, and reads/writes highlight
 * through useV3FieldBinding().
 *
 * Dynamic ssr:false is required: @react-google-maps/api touches window at
 * module scope.
 */

import dynamic from 'next/dynamic'
import type { ComponentProps } from 'react'
import type { PlaceFieldMapImpl } from './PlaceFieldMapImpl'

const Impl = dynamic(
  () => import('./PlaceFieldMapImpl').then((m) => m.PlaceFieldMapImpl),
  {
    ssr: false,
    loading: () => <div className="v3-field__map-loading" aria-hidden="true" />,
  },
)

export function PlaceFieldMap(props: ComponentProps<typeof PlaceFieldMapImpl>) {
  return (
    <div className="v3-field__map-frame">
      {props.posterSrc ? (
        <img
          className="v3-field__map-poster"
          src={props.posterSrc}
          alt=""
          width={800}
          height={600}
          aria-hidden="true"
        />
      ) : (
        <div className="v3-field__map-pending" aria-hidden="true" />
      )}
      <Impl {...props} />
    </div>
  )
}
