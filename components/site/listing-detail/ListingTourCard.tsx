import { V3Button } from '@/components/site/v3'

/**
 * Desktop sticky tour card. Ledger-register buttons — no 3px uppercase slabs.
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
      <V3Button href={tourHref} variant="primary">
        Request a showing
      </V3Button>
      <V3Button href={askHref} variant="ghost">
        Ask a question
      </V3Button>
      {tel ? (
        <V3Button href={`tel:${tel}`} variant="text">
          Call
        </V3Button>
      ) : null}
      {sms ? (
        <V3Button href={`sms:${sms}`} variant="text">
          Text
        </V3Button>
      ) : null}
    </div>
  )
}
