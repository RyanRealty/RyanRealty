'use client'

/**
 * V3Stage. PATTERN 4 of the six locked in design_system/public/PUBLIC_UI.md:
 * "full-bleed media (owned video/photo) carrying one line of type and one
 * action; the only pattern allowed to be primarily emotional, and only where an
 * owned asset exists. Never over a number."
 *
 * Proven in the moving prototype at app/dev/public-v3 (the home Stage and the
 * Sell opening). This generalizes exactly what is proven there and nothing
 * else: the same cover media, the same navy scrim ramp, white type carrying the
 * media shadow, one primary action earned by the line above it.
 *
 * WHY 'use client', and it is the only reason: the video may autoplay only when
 * the visitor has NOT asked for reduced motion, and prefers-reduced-motion is a
 * matchMedia read no server render can answer. Nothing else in this file needs
 * the client. Before hydration and under reduced motion the video element is
 * never mounted at all, so the poster stands alone and not one video byte is
 * fetched. Server render and first client render agree, so hydration is safe.
 *
 * Barrel law honored here:
 *  - Nothing is imported from the deleted KB register, components/site (flat),
 *    components/site/primitives, components/site/explore, or components/ui.
 *  - The accessible name is IN THE TYPE, and the type is backed by a runtime
 *    invariant because a type alone cannot finish the job. `headline` renders as
 *    the section heading and the section names itself with aria-labelledby
 *    pointing at it; `action.label` is the action's name. Precisely what is
 *    enforced, and by what:
 *      · REQUIRED — the compiler. Both are non-optional strings, so a Stage
 *        with no name at all does not compile.
 *      · NON-EMPTY LITERAL — the compiler. headline="" and label: '' are
 *        rejected by V3Named below. This is the one blank the type CAN see.
 *      · NON-BLANK VALUE — the runtime invariant in assertNamed(), which throws
 *        in development on a blank or whitespace-only name. A headline arriving
 *        from data is typed `string`, and no TypeScript type can know whether a
 *        `string` is empty, so this is the only mechanism that can catch it.
 *    A nameless region and a nameless control are what the barrel law exists to
 *    prevent, so the claim above is stated as what actually holds, not more.
 *  - Every color resolves from ./tokens.css via ./V3Stage.css. No raw hex here.
 *  - Data arrives as props. This primitive never fetches and never formats.
 *
 * MOUNTING: the section carries V3_ROOT_CLASS itself, so the token scope always
 * resolves and a Stage mounted outside a .v3 ancestor renders correctly rather
 * than dropping its ground, its scrim, and its padding (see the SCOPE note in
 * ./V3Stage.css). Place it outside any width container: the pattern is full
 * bleed by definition. Mounting a wider .v3 surface around it stays correct —
 * the duplicate class re-declares the same tokens with the same values.
 */
import { useEffect, useId, useState } from 'react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import {
  V3_ROOT_CLASS,
  V3Button,
  V3Eyebrow,
  V3Heading,
  type V3NonEmpty,
} from './atoms'
import './tokens.css'
import './V3Stage.css'

export type V3StageAction = {
  /** The visible label, and therefore the action's accessible name. */
  label: string
  /** Where it goes. A Stage action is always a destination, never a toggle. */
  href: string
  /**
   * Defaults to primary. Ghost when the filled primary in this viewport is
   * already another control (the capture Sheet on /sell).
   */
  variant?: 'primary' | 'ghost'
}

/**
 * Scrim depth over the media, named rather than numeric so every stop is one
 * whose contrast we can vouch for. 'standard' is the ramp the prototype proved
 * (navy 0.78 at the base, 0.42 at mid, 0.16 at the top). 'deep' is for bright
 * or busy footage. 'light' is for footage that is already dark, and it is the
 * only stop that leans on the text shadow to hold the line.
 */
export type V3StageOverlay = 'light' | 'standard' | 'deep'

/**
 * Rejects the empty string LITERAL while leaving a plain `string` alone. Used
 * on the two props that are accessible names. A caller passing "" is a compile
 * error; a caller passing a `string` variable is not, because no type can see
 * inside it — that case is the runtime invariant's job.
 *
 * The helper itself is `V3NonEmpty` in ./atoms.tsx: this file spelled it
 * `V3Named` while V3Instrument and V3Ledger spelled the same conditional inline
 * inside `v3Text`, which is one idea under three spellings. The local alias
 * stays so the prose above and the signature below still read the same.
 */
type V3Named<T extends string> = V3NonEmpty<T>

export type V3StageProps = {
  /**
   * The one line of type. Required, and it IS the accessible name: it renders
   * as the heading and the section references it with aria-labelledby.
   */
  headline: string
  /**
   * The still frame. Required, because it is what the visitor sees whenever the
   * video must not play (reduced motion), cannot play (autoplay policy, slow
   * network), or was never supplied. A Stage with only a poster is complete.
   */
  posterSrc: string
  /** Owned video. Optional. Autoplays muted, looping, inline, motion allowing. */
  videoSrc?: string
  /** The one action, earned by the line above it. One primary per viewport. */
  action: V3StageAction
  /** Scrim depth. Defaults to the ramp the prototype proved. */
  overlayStrength?: V3StageOverlay
  /** The context line above the headline. One line, never a sentence. */
  eyebrow?: string
  /**
   * 1 when the Stage opens the page and carries its answer (the Sell opening),
   * 2 when it sits inside a page that already has its h1. Defaults to 2.
   */
  headingLevel?: 1 | 2
  /**
   * 'tall' when the next section should peek under the fold on 390.
   * 'compact' when the next section (the ask) must fit in the first 390 viewport.
   * 'frame' is a 16:9 media frame (listing opening). Default Stage stays 62vh.
   */
  height?: 'standard' | 'tall' | 'compact' | 'frame'
  /**
   * Optional media click. Does not add a second visible Stage action.
   * Listing uses this to open photos. Homepage does not pass it.
   */
  onMediaClick?: () => void
  /**
   * Optional working control in the copy stack (homepage search). Renders
   * after the headline and before the destination action so the typed query
   * is the first thumb target. The Stage still requires `action`.
   */
  children?: ReactNode
  id?: string
  className?: string
}

/**
 * Reads prefers-reduced-motion and keeps reading it, so a visitor who flips the
 * system setting mid-session gets the change without a reload. Starts false so
 * the server HTML and the first client render agree: no video until we know the
 * visitor allows it.
 */
function useMotionAllowed(): boolean {
  const [allowed, setAllowed] = useState(false)

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const sync = () => setAllowed(!query.matches)
    sync()
    query.addEventListener('change', sync)
    return () => query.removeEventListener('change', sync)
  }, [])

  return allowed
}

function isBlank(value: string): boolean {
  return typeof value !== 'string' || value.trim().length === 0
}

/**
 * The name check no type can make: a `string` that arrives from data is empty
 * or not at runtime, and only at runtime. Throws in development so the failure
 * is loud where it can still be fixed, and stays out of the way in production,
 * where crashing a visitor's page is worse than the fault it is reporting.
 */
function assertNamed(headline: string, label: string): void {
  if (process.env.NODE_ENV === 'production') return

  if (isBlank(headline)) {
    throw new Error(
      'V3Stage: `headline` is blank. It is the accessible name of the section, the heading that aria-labelledby points at, so a blank one ships a region with no name. Pass the one line of type, or use a pattern that does not need one.',
    )
  }

  if (isBlank(label)) {
    throw new Error(
      'V3Stage: `action.label` is blank. It is the action\'s accessible name, so a blank one ships a link no screen reader, voice control, or search-in-page can name. Pass the label the visitor reads.',
    )
  }
}

export function V3Stage<H extends string, L extends string>({
  headline,
  posterSrc,
  videoSrc,
  onMediaClick,
  action,
  overlayStrength = 'standard',
  eyebrow,
  headingLevel = 2,
  height = 'standard',
  children,
  id,
  className,
}: V3StageProps & {
  headline: H & V3Named<H>
  action: V3StageAction & { label: L & V3Named<L> }
}) {
  const headingId = useId()
  const motionAllowed = useMotionAllowed()
  const showVideo = Boolean(videoSrc) && motionAllowed

  assertNamed(headline, action.label)

  return (
    <section
      id={id}
      className={cn(
        V3_ROOT_CLASS,
        'v3-stage',
        `v3-stage--${overlayStrength}`,
        height === 'tall' && 'v3-stage--tall',
        height === 'compact' && 'v3-stage--compact',
        height === 'frame' && 'v3-stage--frame',
        Boolean(children) && 'v3-stage--with-slot',
        className,
      )}
      aria-labelledby={headingId}
    >
      {/* The media carries no information the headline does not, and it has no
          audio and no controls, so it stays out of the accessibility tree. */}
      <div
        className="v3-stage-media"
        aria-hidden="true"
        onClick={onMediaClick}
      >
        {/* Plain img, not next/image: the poster must be byte-identical to the
            video's own poster frame and must render for any owned asset path
            without depending on image-host configuration. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className="v3-stage-poster"
          src={posterSrc}
          alt=""
          decoding="async"
          fetchPriority="high"
        />
        {showVideo && videoSrc ? (
          <video
            key={videoSrc}
            className="v3-stage-video"
            src={videoSrc}
            poster={posterSrc}
            autoPlay
            muted
            loop
            playsInline
            tabIndex={-1}
          />
        ) : null}
      </div>

      <div className="v3-stage-scrim" aria-hidden="true" />

      <div className="v3-stage-copy">
        {eyebrow ? <V3Eyebrow onMedia>{eyebrow}</V3Eyebrow> : null}
        <V3Heading
          level={headingLevel}
          id={headingId}
          onMedia
          className="v3-stage-line"
        >
          {headline}
        </V3Heading>
        {children}
        {/* onMedia is not decoration here: it is what makes the control
            identifiable on footage at all (see the on-media primary in
            ./V3Stage.css). A Stage action is always on media by definition. */}
        <V3Button href={action.href} variant={action.variant ?? 'primary'} onMedia>
          {action.label}
        </V3Button>
      </div>
    </section>
  )
}
