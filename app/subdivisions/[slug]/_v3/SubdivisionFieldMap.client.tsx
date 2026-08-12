'use client'
// brand-voice:exempt — map chrome only, no user-facing prose.

/**
 * The real map that fills V3Field's `mapSlot` on the plat node.
 *
 * WHY IT IS ROUTE-LOCAL. The Field pattern's claim is "map + list in one frame,
 * hover/tap bound both ways" (design_system/public/PUBLIC_UI.md pattern 2). Every
 * existing map in this repo either carries its own section chrome (heading,
 * eyebrow, subtitle) or holds no binding, so dropping one into the slot would put
 * a second heading inside a section that already has one, or would leave the list
 * and the pins unlinked. This is the smallest thing that is neither.
 *
 * The dynamic ssr:false split is not optional. `@react-google-maps/api` touches
 * `window` at module scope, so a server-rendered import crashes; every working
 * Google Maps surface in this app loads through one clean client-only mount. The
 * skeleton is the same full-frame box the map becomes, so the slot does not
 * resize on hydration.
 */

import dynamic from 'next/dynamic'
import type { ComponentProps } from 'react'
import type { SubdivisionFieldMapImpl } from './SubdivisionFieldMapImpl'

export type { SubdivisionFieldPin } from './SubdivisionFieldMapImpl'

const Impl = dynamic(
  () => import('./SubdivisionFieldMapImpl').then((m) => m.SubdivisionFieldMapImpl),
  {
    ssr: false,
    loading: () => <div style={{ width: '100%', height: '100%' }} aria-hidden="true" />,
  },
)

export function SubdivisionFieldMap(props: ComponentProps<typeof SubdivisionFieldMapImpl>) {
  return <Impl {...props} />
}
