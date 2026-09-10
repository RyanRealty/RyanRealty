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
}: {
  heading: string
  headline?: string
  captionValue: string
  captionLabel: string
  /** When the pull is capped, a door into the drawing that explains the gap. */
  captionDrillHref?: string
  captionDrillLabel?: string
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
      </div>
    </div>
  )
}
