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
 * "NEVER OVER A NUMBER", AND THE INVENTORY VARIANT (SITE-46, 2026-09-09). The
 * locked definition above ends with that clause, and it is kept, not bent: the
 * variant's figures do not sit on the photograph. The media still carries one
 * line of type and one action and nothing else; the figures sit BELOW it on a
 * solid navy band at the base of the section, which is a ground, not media.
 * That distinction is the whole reason the band exists rather than an overlay —
 * the first build did float the figures on the photo, and it read as a stat
 * overlay on a hero, which is the pattern's own prohibition (and, separately,
 * put 0.74rem type over whatever the photographer pointed at). See
 * V3StageInventory below and section 3 of ./V3Stage.css.
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
import Link from 'next/link'
import { cn } from '@/lib/utils'
import {
  V3_ROOT_CLASS,
  V3Button,
  V3Eyebrow,
  V3Heading,
  V3SourceLine,
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
 * ONE FIGURE IN THE INVENTORY STRIP. The value arrives already formatted, like
 * every other figure in this register (V3Figure's contract): the caller keeps
 * the rounding rule and the source trace beside the number that came from them,
 * and this pattern never invents, derives, or re-rounds a figure.
 */
export type V3StageFigure = {
  /** Already formatted by lib/format: "1,813", "$725,000", "28 days". */
  value: string
  /**
   * What the number means, in plain words a buyer uses — "homes for sale right
   * now", not "active count" and not "median to pending · 90 days". A figure
   * with no plain sentence beside it is the KPI grid TASTE.md bans.
   */
  label: string
  /**
   * Optional destination. A figure that has a surface behind it (the search
   * that holds those homes, the report that plots that median) becomes the door
   * to it, so the strip rewards a click with more of the same data rather than
   * sitting there as decoration. Omit it and the figure renders as plain text.
   */
  href?: string
}

/**
 * THE INVENTORY VARIANT (SITE-46, taste table 2026-09-08: /buy scored 42,
 * "competent, on-brand and inert" — a full-bleed photo, an eyebrow, a headline
 * and one button on the one page whose job is helping someone buy a house).
 *
 * Passing this prop is what opts a Stage in. It is a PROP, NOT A FORK: a Stage
 * with no inventory behind it renders byte-identically to the quiet photo form
 * it always had, because every element and every rule this variant adds is
 * mounted only when `inventory` is present, and every rule is scoped to
 * `.v3-stage--inventory` in ./V3Stage.css.
 *
 * What it changes, and only this:
 *  1. a strip of live figures inside the hero, each with its plain label and
 *     each optionally a door,
 *  2. one section 0 trace under them carrying the as-of stamp — one row read,
 *     one refresh time, so one line covers every figure in the strip,
 *  3. a shorter vertical footprint, so the section under the Stage (on /buy the
 *     live listing Field) breaks the fold instead of showing 60px of photo,
 *  4. the navy primary action treatment (see the CTA block in ./V3Stage.css).
 */
export type V3StageInventory = {
  /**
   * Two or more. Two is the floor because a single number in a hero is a
   * headline statistic, not a market: the reader cannot tell whether it is a
   * lot or a little. A caller that can only source one figure honestly ships no
   * strip (§0: the deliverable goes out with fewer numbers, never a wrong one).
   */
  figures: V3StageFigure[]
  /** The trace, without the word "Source" — V3SourceLine renders that prefix. */
  source: string
  /** When the row behind these figures was last refreshed. */
  updatedAt?: string | number | Date | null
}

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
  /**
   * The one destination action. Optional when `children` is that action
   * (homepage search). Do not pass both a destination button and a search
   * slot — one action per viewport.
   */
  action?: V3StageAction
  /** Scrim depth. Defaults to the ramp the prototype proved. */
  overlayStrength?: V3StageOverlay
  /** The context line above the headline. One line, never a sentence. */
  eyebrow?: string
  /**
   * The copy for the Stage's OTHER mode, when the slot carries a switch (the
   * homepage Buy | Sell tabs). Both lines ship in the server HTML; the slot's
   * own stylesheet decides which pair is on screen, exactly as it already does
   * for the two panels. Rendered as a paragraph, never a second h1 — one page,
   * one heading, and the section keeps naming itself with the real one.
   *
   * Pass both or neither: an alternate headline with the original eyebrow above
   * it is the mismatch this prop exists to remove.
   */
  altHeadline?: string
  altEyebrow?: string
  /**
   * 1 when the Stage opens the page and carries its answer (the Sell opening),
   * 2 when it sits inside a page that already has its h1. Defaults to 2.
   */
  headingLevel?: 1 | 2
  /** 'tall' when the next section should peek under the fold on 390. 'compact' when the next section (the ask) must fit in the first 390 viewport. */
  height?: 'standard' | 'tall' | 'compact'
  /**
   * Live inventory behind this page, carried INSIDE the hero. Opt-in: omit it
   * and this pattern is exactly the Stage it has always been. See
   * V3StageInventory for what it changes and why.
   */
  inventory?: V3StageInventory
  /**
   * Optional working control in the copy stack (homepage search). When this
   * is the Stage action, omit `action` so a second button does not ship.
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
function assertNamed(headline: string, label?: string): void {
  if (process.env.NODE_ENV === 'production') return

  if (isBlank(headline)) {
    throw new Error(
      'V3Stage: `headline` is blank. It is the accessible name of the section, the heading that aria-labelledby points at, so a blank one ships a region with no name. Pass the one line of type, or use a pattern that does not need one.',
    )
  }

  if (label != null && isBlank(label)) {
    throw new Error(
      'V3Stage: `action.label` is blank. It is the action\'s accessible name, so a blank one ships a link no screen reader, voice control, or search-in-page can name. Pass the label the visitor reads.',
    )
  }
}

/**
 * The strip's own run-time invariants, in the same register as assertNamed:
 * loud in development, silent in production, because crashing a visitor's page
 * is worse than the fault being reported.
 *
 * A blank value or a blank label is the failure this catches. Both arrive as
 * `string` from a query, so no type can see inside them — the same hole the
 * headline has, and the same mechanism closes it. A figure whose value came
 * back empty would render a label with nothing over it; a figure with no label
 * is a number with no meaning, which is the KPI tell.
 */
function assertInventory(inventory: V3StageInventory | undefined): void {
  if (process.env.NODE_ENV === 'production' || inventory == null) return

  if (inventory.figures.length < 2) {
    throw new Error(
      `V3Stage: \`inventory.figures\` has ${inventory.figures.length}. Two is the floor — a single number in a hero is a headline statistic, not a market. If only one figure can be sourced honestly, pass no \`inventory\` at all.`,
    )
  }

  for (const figure of inventory.figures) {
    if (isBlank(figure.value) || isBlank(figure.label)) {
      throw new Error(
        'V3Stage: an `inventory.figures` entry has a blank value or a blank label. A figure renders as its number over what the number means; either one blank ships half a claim. Withhold the figure instead (§0).',
      )
    }
  }

  if (isBlank(inventory.source)) {
    throw new Error(
      'V3Stage: `inventory.source` is blank. Every figure on a public page renders with the trace that says where it came from (CLAUDE.md §0). A strip with no trace does not ship.',
    )
  }
}

export function V3Stage<H extends string, L extends string>({
  headline,
  posterSrc,
  videoSrc,
  action,
  overlayStrength = 'standard',
  eyebrow,
  altHeadline,
  altEyebrow,
  headingLevel = 2,
  height = 'standard',
  inventory,
  children,
  id,
  className,
}: V3StageProps & {
  headline: H & V3Named<H>
  action?: V3StageAction & { label: L & V3Named<L> }
}) {
  const headingId = useId()
  const motionAllowed = useMotionAllowed()
  const showVideo = Boolean(videoSrc) && motionAllowed
  /* Both or neither: a switched eyebrow over an unswitched line is the exact
     mismatch the prop pair exists to remove. */
  const altCopy =
    altHeadline != null && altHeadline.trim() && altEyebrow != null && altEyebrow.trim()
      ? { headline: altHeadline, eyebrow: altEyebrow }
      : null

  assertNamed(headline, action?.label)
  assertInventory(inventory)
  /* Production never throws, so the floor is enforced here as well: one figure
     renders no strip rather than a lone number under a headline. */
  const strip = inventory && inventory.figures.length >= 2 ? inventory : null

  return (
    <section
      id={id}
      className={cn(
        V3_ROOT_CLASS,
        'v3-stage',
        `v3-stage--${overlayStrength}`,
        height === 'tall' && 'v3-stage--tall',
        height === 'compact' && 'v3-stage--compact',
        Boolean(children) && 'v3-stage--with-slot',
        strip && 'v3-stage--inventory',
        className,
      )}
      aria-labelledby={headingId}
    >
      {/* The media carries no information the headline does not, and it has no
          audio and no controls, so it stays out of the accessibility tree. */}
      <div className="v3-stage-media" aria-hidden="true">
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
        {eyebrow ? (
          <V3Eyebrow onMedia className="v3-stage-eyebrow">
            {eyebrow}
          </V3Eyebrow>
        ) : null}
        {altCopy ? (
          <V3Eyebrow onMedia className="v3-stage-eyebrow v3-stage-eyebrow--alt">
            {altCopy.eyebrow}
          </V3Eyebrow>
        ) : null}
        <V3Heading
          level={headingLevel}
          id={headingId}
          onMedia
          className="v3-stage-line"
        >
          {headline}
        </V3Heading>
        {/* The other mode's line. A paragraph wearing the heading's face, not a
            second heading: the page keeps one h1, and the section keeps naming
            itself with it even while the switch has this line on screen —
            aria-labelledby resolves a directly referenced hidden element. */}
        {altCopy ? (
          <p
            className={cn(
              'v3-heading',
              headingLevel === 1 ? 'v3-heading--1' : 'v3-heading--2',
              'v3-heading--on-media',
              'v3-stage-line',
              'v3-stage-line--alt',
            )}
          >
            {altCopy.headline}
          </p>
        ) : null}
        {children}
        {action ? (
          <V3Button href={action.href} variant={action.variant ?? 'primary'} onMedia>
            {action.label}
          </V3Button>
        ) : null}
      </div>

      {/* THE BAND. Outside the copy stack and full bleed, because it is a
          different material from the photograph above it: solid navy, a cream
          hairline at its top edge, the live market across the base of the hero.
          The first build floated these figures on the photograph itself, and a
          separate evaluator scored that fold as "one hero moment, not a
          composed page" — a full-bleed photo followed immediately by the
          Field's full-bleed photo, two adjacent sections wearing one shape.
          A band ends the hero on its own material and gives small type a
          ground instead of a gradient.

          SITE-77: three equal figure cells were a KPI grid (TASTE.md). The
          same sourced facts now read as one sentence, still doors, still
          one trace. The short inventory frame stays so the Field breaks
          the fold. */}
      {strip ? (
        <div className="v3-stage-band">
          <div className="v3-stage-band__inner">
            <p className="v3-stage-strip__claim">
              {strip.figures.map((figure, i) => (
                <span key={`${figure.label}·${figure.value}`}>
                  {i > 0 ? <span aria-hidden="true"> · </span> : null}
                  {figure.href ? (
                    <Link href={figure.href} className="v3-stage-strip__door">
                      <strong className="v3-stage-strip__value">{figure.value}</strong>
                      <span>{figure.label}</span>
                    </Link>
                  ) : (
                    <>
                      <strong className="v3-stage-strip__value">{figure.value}</strong>
                      <span>{figure.label}</span>
                    </>
                  )}
                </span>
              ))}
            </p>
            {/* One trace for the whole band: one row read at one moment, so a
                per-figure line would be the same sentence three times. */}
            <V3SourceLine
              onMedia
              source={strip.source}
              updatedAt={strip.updatedAt}
              className="v3-stage-strip__source"
            />
          </div>
        </div>
      ) : null}
    </section>
  )
}
