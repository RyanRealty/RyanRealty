'use client'

/**
 * The client-only mount for the ZIP map.
 *
 * @react-google-maps/api's <GoogleMap> does not instantiate when it is
 * server-rendered and then hydrated under StrictMode: the container mounts and
 * the map never paints. Every working Google Maps surface in this app avoids
 * that with a next/dynamic ssr:false wrapper, so this file is the import target
 * and defers the real component. Same shape as the KB map it replaces.
 *
 * The placeholder holds the frame at its aspect ratio without claiming anything:
 * the list beside it is the complete, accessible representation of the same set.
 */

import dynamic from 'next/dynamic'

const Impl = dynamic(() => import('./ZipFieldMapImpl').then((m) => m.ZipFieldMapImpl), {
  ssr: false,
  loading: () => <div style={{ position: 'absolute', inset: 0 }} aria-hidden />,
})

export function ZipFieldMap() {
  return <Impl />
}
