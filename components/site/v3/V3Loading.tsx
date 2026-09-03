/**
 * The shape a v3 route reserves while it streams.
 *
 * WHY IT IS ONE COMPONENT. Ten public routes shipped a `loading.tsx` that drew
 * a Tailwind card stack against an undeclared `.skeleton` class: invisible, and
 * had it been visible it would have been wrong — a max-w-lg or max-w-7xl
 * measure that matched no element on the page it fronted, and rounded corners
 * the public site does not have. Ten bespoke fallbacks is also ten places for
 * the register to drift. This is the v3 section rhythm, once.
 *
 * It reserves the measure, the gutter and the section pad, which is what a
 * fallback can honestly promise about a page it has not loaded. It does not
 * pretend to know how many cards or which grid.
 *
 * Server component, and it must stay one: a fallback that needs hydration is a
 * fallback that is not ready when it is needed.
 */
import { cn } from '@/lib/utils'
import { V3_ROOT_CLASS } from './atoms'
import { V3Placeholder } from './V3Placeholder'
import './tokens.css'
import './V3Loading.css'

export type V3LoadingProps = {
  /** How many text lines to reserve under the heading. Default 3. */
  lines?: number
  /** Reserve form controls instead of text lines, at the 44px control height. */
  fields?: number
  /** The route's own accessible label, e.g. "Loading the contact page". */
  label: string
  className?: string
}

export function V3Loading({ lines = 3, fields, label, className }: V3LoadingProps) {
  return (
    <div
      className={cn(V3_ROOT_CLASS, 'v3-loading', className)}
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <V3Placeholder className="v3-loading__eyebrow" />
      <V3Placeholder className="v3-loading__heading" />
      {fields ? (
        <div className="v3-loading__fields">
          {Array.from({ length: fields }, (_, i) => (
            <V3Placeholder key={i} className="v3-loading__field" />
          ))}
        </div>
      ) : (
        <div className="v3-loading__lines">
          {Array.from({ length: lines }, (_, i) => (
            <V3Placeholder key={i} className="v3-loading__line" />
          ))}
        </div>
      )}
    </div>
  )
}
