/**
 * V3 BREADCRUMB. Where the visitor is standing in the graph.
 *
 * Replaces a deleted KB component Visual language:
 * design_system/public/PUBLIC_UI.md (locked 2026-08-11). Tokens: ./tokens.css.
 *
 * The trail is REQUIRED. A breadcrumb with no trail is a strip that says
 * nothing, and the ancestors it names are the continuity the IA lock asks the
 * chrome to carry (place context follows the visitor; a node has to show the
 * ladder it sits on). The last crumb is the page itself and is never a link:
 * a link to the page you are on is a dead edge, and `aria-current="page"` is
 * what tells a screen reader the trail has ended.
 *
 * WHY THE TYPE IS AN ARRAY AND NOT A NON-EMPTY TUPLE. V3Quiet states this in
 * full: this repo's tsconfig sets `strict` without `noUncheckedIndexedAccess`,
 * so a tuple type accepts `[crumbs[0], ...crumbs.slice(1)]` built from an empty
 * array, hands the tuple an undefined head, and throws on the first property
 * read during the server render. A 500 is strictly worse than the empty strip
 * the tuple was meant to prevent, and the tuple also refuses an ordinary
 * `.filter()` result, so the remaining caller path is a cast that erases the
 * guarantee. The guarantee therefore sits where it holds, at render: a crumb
 * with no label is dropped rather than rendered nameless, and a trail with
 * nothing left renders nothing at all.
 *
 * NO JSON-LD HERE. The BreadcrumbList structured data is emitted by the page's
 * metadata block, where the canonical URL already lives. Emitting it here too
 * would put the same list on the page twice, from two derivations that can
 * disagree, which is the defect the P9 notes recorded on the first migration
 * attempt: one derivation, one answer.
 *
 * MOUNTING: puts V3_ROOT_CLASS on its own outermost element, so ./tokens.css
 * resolves with no wrapper.
 *
 * Server component. No state, no effects, no hooks, no fetch, no formatting.
 */
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { V3_ROOT_CLASS } from './atoms'
import './tokens.css'
import './V3Breadcrumb.css'

export type V3Crumb = {
  /** The visible text. Required: a crumb with no name names nothing. */
  label: string
  /**
   * The ancestor's page. Omit for a rung that has no page of its own (a
   * grouping level the graph has no node for). The last crumb's href is
   * ignored, since it would point at the page the visitor is already on.
   */
  href?: string
}

export type V3BreadcrumbProps = {
  /**
   * The ladder, ancestors first, the current page last. Required.
   */
  trail: readonly V3Crumb[]
  /**
   * 'on-media' inverts the strip for use over a Stage's photo or video, where
   * the scrim behind it carries the contrast.
   */
  tone?: 'surface' | 'on-media'
  /**
   * Clears the fixed public header (app/layout.tsx mounts V3Chrome, whose bar
   * is `position: fixed; top: 0`). DEFAULTS TO TRUE on the surface tone, which
   * is the only honest default: a surface-tone trail is the first flow element
   * of <main>, a fixed bar is out of flow, and the trail therefore renders
   * behind the wordmark unless something pushes it down. Making the caller
   * opt IN is how the other register shipped this defect twice — KbBreadcrumb's
   * `belowNav` prop fixed it for no-hero pages on 2026-07-15 and its ten
   * `overlay` callers never got it (the deleted KB stylesheet, C-14).
   *
   * The 'on-media' tone defaults to false: that trail sits inside a Stage, over
   * the Stage's media, and the Stage owns its own top space.
   *
   * Pass `false` explicitly for a surface trail that is NOT at the top of the
   * document, or on a route that hides the public header.
   */
  belowNav?: boolean
  /**
   * The accessible name of the navigation landmark. Defaults to "Breadcrumb",
   * which is what a screen reader user expects to hear; override only when a
   * page shows two trails, which is a sign the page is doing two jobs.
   */
  ariaLabel?: string
  id?: string
  className?: string
}

/** What one rung renders as, decided before the markup rather than inside it. */
type Rung = {
  label: string
  /** Present only when the rung is a real door. */
  href?: string
  isCurrent: boolean
}

/** Trimmed text, or nothing. An empty string is not a label. */
function text(value: string | undefined): string | undefined {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

export function V3Breadcrumb({
  trail,
  tone = 'surface',
  belowNav,
  ariaLabel,
  id,
  className,
}: V3BreadcrumbProps) {
  const clearsFixedHeader = belowNav ?? tone !== 'on-media'
  const named: V3Crumb[] = []
  for (const crumb of trail) {
    // A hole is dropped, never dereferenced: without noUncheckedIndexedAccess
    // an expression like `trail={[ancestors[0]]}` type-checks against an empty
    // array and arrives here as undefined.
    const label = text(crumb?.label)
    if (label === undefined) continue
    named.push({ label, href: text(crumb?.href) })
  }

  if (process.env.NODE_ENV !== 'production') {
    const dropped = trail.length - named.length
    if (dropped > 0) {
      console.warn(`V3Breadcrumb: dropped ${dropped} crumb(s) with no label.`)
    }
  }

  if (named.length === 0) return null

  const lastIndex = named.length - 1
  const rungs: Rung[] = named.map((crumb, index) => {
    const isCurrent = index === lastIndex
    const linkable = isCurrent === false && typeof crumb.href === 'string'
    return linkable
      ? { label: crumb.label, href: crumb.href, isCurrent }
      : { label: crumb.label, isCurrent }
  })

  const name = text(ariaLabel) ?? 'Breadcrumb'

  return (
    <nav
      id={id}
      aria-label={name}
      className={cn(
        V3_ROOT_CLASS,
        'v3-breadcrumb',
        tone === 'on-media' && 'v3-breadcrumb--on-media',
        clearsFixedHeader && 'v3-breadcrumb--below-nav',
        className,
      )}
    >
      <ol className="v3-breadcrumb__list">
        {rungs.map((rung, index) => (
          <li className="v3-breadcrumb__item" key={`${index}-${rung.label}`}>
            {typeof rung.href === 'string' ? (
              <Link href={rung.href} className="v3-breadcrumb__link">
                {rung.label}
              </Link>
            ) : (
              <span
                className={cn(
                  'v3-breadcrumb__text',
                  rung.isCurrent && 'v3-breadcrumb__text--current',
                )}
                aria-current={rung.isCurrent ? 'page' : undefined}
              >
                {rung.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}
