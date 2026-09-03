/**
 * The fill a route's loading.tsx shows where text is about to land.
 *
 * PAINT ONLY, ON PURPOSE. It contributes a background and a breathe and NO
 * geometry: no width, no height, no margin, no radius. The caller sizes every
 * box in its own stylesheet, so the space the fallback reserves is the space
 * the real content lands in and the page does not jump when it arrives. That is
 * the load-bearing lesson of app/about/_v3/about-loading.css, and this is that
 * file's fill generalized so there is one definition rather than two.
 *
 * WHAT IT REPLACES. Thirteen loading.tsx files wrote `className="skeleton …"`
 * against a class defined in no stylesheet in the repo — 0 selector hits across
 * 48 CSS files, 0 of 3,956 runtime rules on a served route. The boxes laid out
 * at the right size and painted nothing.
 *
 * Server component. A fallback that needs hydration is a fallback that is not
 * ready when it is needed.
 */
import { cn } from '@/lib/utils'
import './tokens.css'
import './V3Placeholder.css'

export type V3PlaceholderProps = {
  /** The caller's own size and position classes. This adds only the fill. */
  className?: string
}

export function V3Placeholder({ className }: V3PlaceholderProps) {
  // aria-hidden: a fallback is not content, and the route's own loading state
  // is announced by the framework, not by every bar inside it.
  return <div aria-hidden="true" className={cn('v3-placeholder', className)} />
}
