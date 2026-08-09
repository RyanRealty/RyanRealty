/**
 * OwnedHomeCard — the compact "home they own" card for the contact landing.
 * A single thumbnail + address + a comp action: "Build CMA" when none exists
 * (opens the ASYNC kick-off sheet — the litmus surface; the old 30–60 s
 * synchronous in-action build is retired from this card), or "Review" +
 * "Send to lead" once a CMA draft is ready. Renders only when the contact has
 * a confirmed owned home (caller gates on that).
 *
 * 11F: on the LOCKED admin v2 language (design_system/admin/ADMIN_UI.md).
 * Card -> av2-pane (padding trimmed back to the original p-3), and the two
 * `asChild` Button anchors -> real <a>s carrying av2-btn so hover, pressed and
 * focus come from the stylesheet rather than being hand-rolled. Every shadcn
 * semantic class -> its var(--a-*) token; text-success -> var(--a-ok).
 */
import '@/components/admin/v2/admin-v2.css'
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
    <div className="av2-pane" style={{ padding: 'var(--a-s3)' }}>
      <div className="flex gap-3">
        {props.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={props.photoUrl} alt="" className="h-24 w-24 shrink-0 rounded-xl object-cover" />
        ) : (
          <div
            className="flex h-24 w-24 shrink-0 items-center justify-center rounded-xl"
            style={{ background: 'var(--a-inset)', fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}
          >
            No photo
          </div>
        )}
        <div className="flex min-w-0 flex-1 flex-col">
          <div
            className="font-semibold uppercase tracking-wide"
            style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}
          >
            Home they own
          </div>
          {props.mapsLink ? (
            <a
              href={props.mapsLink}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-0.5 truncate font-medium hover:underline"
              style={{ color: 'var(--a-text)' }}
            >
              {props.address}
            </a>
          ) : (
            <span className="mt-0.5 truncate font-medium" style={{ color: 'var(--a-text)' }}>{props.address}</span>
          )}
          {props.factsLine ? (
            <div className="truncate" style={{ fontSize: 'var(--a-text-md)', color: 'var(--a-text-2)' }}>
              {props.factsLine}
            </div>
          ) : null}
          {props.onMarket ? (
            <div className="mt-0.5 font-medium" style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-ok)' }}>
              On the market · {props.onMarket}
            </div>
          ) : null}

          <div className="mt-auto flex flex-wrap gap-2 pt-2">
            {props.reviewDeliveryId ? (
              <>
                {/* Broker review = the authed admin CMA page (/admin/cmas/[slug]).
                    The old /cma-drafts/[id] link is the TOKENIZED lead-facing
                    review and 404'd for a broker passing a bare slug (audit
                    dead-end fix). */}
                <a
                  href={`/admin/cmas/${props.reviewDeliveryId}`}
                  className="av2-btn av2-btn--quiet h-9"
                  style={{ textDecoration: 'none' }}
                >
                  Review comp
                </a>
                <form action={props.sendAction}>
                  <input type="hidden" name="deliveryId" value={props.reviewDeliveryId} />
                  <PendingButton pendingLabel="Sending…" className="h-9">Send to lead</PendingButton>
                </form>
              </>
            ) : (
              <a href={props.buildHref} className="av2-btn h-9" style={{ textDecoration: 'none' }}>
                Build CMA
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
