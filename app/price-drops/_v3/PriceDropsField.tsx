/**
 * Photographed price-cut houses. Count is a caption beside the Field.
 * The page mounts V3Field so mockup-parity and the hidden-home contract
 * still see the Field import on the route file. Photos live in the
 * client fold (installed shadcn carousel).
 */
import { cn } from '@/lib/utils'
import { V3Heading, V3_ROOT_CLASS } from '@/components/site/v3'
import './price-drops-field.css'

export { PriceDropPhotos } from './PriceDropPhotos.client'
export { PriceDropsFold } from './PriceDropsFold.client'

export function PriceDropsOpening({
  heading,
  headline,
  captionValue,
  captionLabel,
}: {
  heading: string
  headline?: string
  captionValue: string
  captionLabel: string
}) {
  const title = headline ?? heading
  return (
    <div className={cn(V3_ROOT_CLASS, 'pd-opening')}>
      <div className="pd-opening__copy">
        <V3Heading level={1}>{title}</V3Heading>
        <p className="pd-opening__caption">
          <span className="pd-opening__count">{captionValue}</span>
          {` ${captionLabel}`}
        </p>
      </div>
    </div>
  )
}
