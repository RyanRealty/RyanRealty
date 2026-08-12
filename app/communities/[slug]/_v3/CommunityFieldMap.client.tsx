'use client'
// brand-voice:exempt — map chrome only, no user-facing prose beyond the two
// status lines below, which state a failure rather than sell anything.

/**
 * The real map that fills V3Field's `mapSlot` on the community node.
 *
 * WHY IT IS ROUTE-LOCAL. The Field pattern's whole claim is "map + list in one
 * frame, hover/tap bound both ways" (design_system/public/PUBLIC_UI.md pattern 2).
 * Every existing map in the repo either carries its own section chrome (heading,
 * eyebrow, subtitle) or holds no binding, so dropping one into the slot would put
 * a second heading inside a section that already has one, or would leave the list
 * and the pins unlinked. This file is the smallest thing that is neither: one
 * element that fills the frame it is given, drawing pins for the same items the
 * list renders and reading/writing the SAME highlight through
 * `useV3FieldBinding()`.
 *
 * The dynamic ssr:false split is not optional. `@react-google-maps/api` touches
 * `window` at module scope, so a server-rendered import crashes the build; every
 * working Google Maps surface in this app loads through one clean client-only
 * mount. The skeleton is the same 100%-of-the-frame box the map becomes, so the
 * slot does not resize on hydration.
 */

import dynamic from 'next/dynamic'
import type { ComponentProps } from 'react'
import type { CommunityFieldMapImpl } from './CommunityFieldMapImpl'

const Impl = dynamic(
  () => import('./CommunityFieldMapImpl').then((m) => m.CommunityFieldMapImpl),
  {
    ssr: false,
    loading: () => <div style={{ width: '100%', height: '100%' }} aria-hidden="true" />,
  },
)

export function CommunityFieldMap(props: ComponentProps<typeof CommunityFieldMapImpl>) {
  return <Impl {...props} />
}
