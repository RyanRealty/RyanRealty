import { Button } from '@/components/ui/button'

/**
 * Desktop sticky tour card. Starts below the mosaic. Actions only —
 * no second price.
 */
export function ListingTourCard({
  tourHref,
  askHref,
  tel,
  sms,
}: {
  tourHref: string
  askHref: string
  tel?: string | null
  sms?: string | null
}) {
  return (
    <div className="listing-tour-card">
      <Button asChild className="w-full">
        <a href={tourHref}>Schedule a tour</a>
      </Button>
      <Button asChild variant="outline" className="w-full">
        <a href={askHref}>Ask</a>
      </Button>
      {tel ? (
        <Button asChild variant="outline" className="w-full">
          <a href={`tel:${tel}`}>Call</a>
        </Button>
      ) : null}
      {sms ? (
        <Button asChild variant="outline" className="w-full">
          <a href={`sms:${sms}`}>Text</a>
        </Button>
      ) : null}
    </div>
  )
}
