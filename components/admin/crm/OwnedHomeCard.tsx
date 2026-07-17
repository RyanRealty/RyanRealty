/**
 * OwnedHomeCard — the compact "home they own" card for the contact landing.
 * A single thumbnail + address + a comp action: "Build CMA" when none exists
 * (opens the ASYNC kick-off sheet — the litmus surface; the old 30–60 s
 * synchronous in-action build is retired from this card), or "Review" +
 * "Send to lead" once a CMA draft is ready. Renders only when the contact has
 * a confirmed owned home (caller gates on that).
 */
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { PendingButton } from '@/components/admin/PendingButton'

export function OwnedHomeCard(props: {
  address: string
  photoUrl: string | null
  factsLine: string | null
  mapsLink: string | null
  onMarket: string | null
  /** Set when a CMA draft is built + awaiting review/send. */
  reviewDeliveryId: string | null
  /** Opens the async CMA kick-off sheet pre-filled for this home ("?intent=cma"). */
  buildHref: string
  /** server action: send the reviewed CMA to the lead (form action, needs deliveryId). */
  sendAction: (formData: FormData) => Promise<void>
}) {
  return (
    <Card>
      <CardContent className="p-3">
        <div className="flex gap-3">
          {props.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={props.photoUrl} alt="" className="h-24 w-24 shrink-0 rounded-xl object-cover" />
          ) : (
            <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-xl bg-muted text-xs text-muted-foreground">No photo</div>
          )}
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Home they own</div>
            {props.mapsLink ? (
              <a href={props.mapsLink} target="_blank" rel="noopener noreferrer" className="mt-0.5 truncate font-medium text-foreground hover:underline">{props.address}</a>
            ) : (
              <span className="mt-0.5 truncate font-medium text-foreground">{props.address}</span>
            )}
            {props.factsLine ? <div className="truncate text-sm text-muted-foreground">{props.factsLine}</div> : null}
            {props.onMarket ? <div className="mt-0.5 text-xs font-medium text-success">On the market · {props.onMarket}</div> : null}

            <div className="mt-auto flex flex-wrap gap-2 pt-2">
              {props.reviewDeliveryId ? (
                <>
                  {/* Broker review = the authed admin CMA page (/admin/cmas/[slug]).
                      The old /cma-drafts/[id] link is the TOKENIZED lead-facing
                      review and 404'd for a broker passing a bare slug (audit
                      dead-end fix). */}
                  <Button asChild variant="outline" size="sm" className="h-9">
                    <a href={`/admin/cmas/${props.reviewDeliveryId}`}>Review comp</a>
                  </Button>
                  <form action={props.sendAction}>
                    <input type="hidden" name="deliveryId" value={props.reviewDeliveryId} />
                    <PendingButton pendingLabel="Sending…" className="h-9">Send to lead</PendingButton>
                  </form>
                </>
              ) : (
                <Button asChild size="sm" className="h-9">
                  <a href={props.buildHref}>Build CMA</a>
                </Button>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
