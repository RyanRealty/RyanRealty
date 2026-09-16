/**
 * Photographed price-cut houses. Count is a caption beside the Field.
 * The page mounts V3Field so mockup-parity and the hidden-home contract
 * still see the Field import on the route file. Photos live in the
 * client rail (V3Carousel / shadcn carousel job).
 */
import { cn } from '@/lib/utils'
import { V3Heading, V3_ROOT_CLASS } from '@/components/site/v3'
import './price-drops-field.css'

export { PriceDropPhotos } from './PriceDropPhotos.client'

export function PriceDropsOpening({
  heading,
  headline,
  captionValue,
  captionLabel,
  captionDrillHref,
  captionDrillLabel,
  deck,
}: {
  heading: string
  headline?: string
  captionValue: string
  captionLabel: string
  /** When the pull is capped, a door into the drawing that explains the gap. */
  captionDrillHref?: string
  captionDrillLabel?: string
  /**
   * The page's own question answered in crawlable text, not only in the list
   * (the competitiveTarget: Zillow and Redfin put reductions behind a filter
   * state and never say how far the asks came down). Omitted rather than
   * padded when the pull cannot name both figures (§0).
   */
  deck?: string | null
}) {
  const title = headline ?? heading
  return (
    <div className={cn(V3_ROOT_CLASS, 'pd-opening')}>
      <div className="pd-opening__copy">
        <V3Heading level={1}>{title}</V3Heading>
        <p className="pd-opening__caption">
          <span className="pd-opening__count">{captionValue}</span>
          {` ${captionLabel}`}
          {captionDrillHref && captionDrillLabel ? (
            <>
              {' · '}
              <a className="pd-opening__drill" href={captionDrillHref}>
                {captionDrillLabel}
              </a>
            </>
          ) : null}
        </p>
        {deck ? <p className="pd-opening__deck">{deck}</p> : null}
      </div>
    </div>
  )
}

/**
 * The answer sentence: the middle cut and the deepest cut, in words. Null
 * unless BOTH figures came off the pull — a half answer is not published (§0).
 */
export function priceDropsDeck(input: {
  placeLabel: string
  shownCount: number
  medianPct: number | null
  deepestPct: number | null
}): string | null {
  const { medianPct, deepestPct, shownCount } = input
  if (medianPct == null || !Number.isFinite(medianPct) || medianPct <= 0) return null
  if (deepestPct == null || !Number.isFinite(deepestPct) || deepestPct <= 0) return null
  if (shownCount <= 0) return null
  return (
    `Across the ${shownCount.toLocaleString('en-US')} ${input.placeLabel} ` +
    `${shownCount === 1 ? 'cut' : 'cuts'} on this page the middle seller came down ` +
    `${medianPct.toFixed(1)}%, and the deepest came down ${deepestPct.toFixed(1)}%.`
  )
}
