// @no-parity
// @data-free
// Internal component gallery (noindex). No mockup contract, no DAL access.
/**
 * /dev/components — component picklist gallery for Matt to critique. The gallery
 * body is a client component (ComponentGalleryClient) so each component can carry
 * a note field + a Submit bar that compiles the notes to paste back into chat.
 * The 142-component inventory is in out/visual-review/component-inventory.html.
 */
import type { Metadata } from 'next'
import ComponentGalleryClient from './ComponentGalleryClient'

export const metadata: Metadata = {
  title: 'Component gallery',
  robots: 'noindex, nofollow',
}

export default function ComponentGalleryPage() {
  return <ComponentGalleryClient />
}
