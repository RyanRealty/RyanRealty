/**
 * OwnedHomeCard — the compact "home they own" card for the contact landing.
 * A single thumbnail + address + a comp action: "Build CMA" when none exists
 * (opens the ASYNC kick-off sheet — the litmus surface), or "Review" +
 * "Send from CRM" once a CMA document is ready. Send opens compose.
 *
 * 11F: on the LOCKED admin v2 language (design_system/admin/ADMIN_UI.md).
 * Card -> av2-pane (padding trimmed back to the original p-3), and the two
 * action anchors -> real <a>s carrying av2-btn so hover, pressed and
 * focus come from the stylesheet rather than being hand-rolled. Every shadcn
 * semantic class -> its var(--a-*) token; text-success -> var(--a-ok).
 */
import '@/components/admin/v2/admin-v2.css'
import { OwnedHomeMapClient } from '@/components/admin/crm/OwnedHomeMap.client'

export function OwnedHomeCard(props: {
  address: string
  photoUrl: string | null
  factsLine: string | null
  mapsLink: string | null
  mapUrl: string | null
  lat: number | null
  lng: number | null
  placeLabel: string | null
  boundary: { type: string; coordinates: unknown } | null
  onMarket: string | null
  /** Set when a CMA draft is built + awaiting review/send. */
  reviewDeliveryId: string | null
  /** Opens the async CMA kick-off sheet pre-filled for this home ("?intent=cma"). */
  buildHref: string
  /** CRM compose for this CMA — attach PDF / text-me / email draft. */
  composeHref: string | null
}) {
  return (
    <div id="home" className="av2-pane" style={{ padding: 'var(--a-s3)' }}>
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

          {props.placeLabel ? (
            <div className="truncate" style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>
              {props.placeLabel}
            </div>
          ) : null}

          <div className="mt-auto flex flex-wrap gap-2 pt-2">
            {props.reviewDeliveryId ? (
              <>
                <a
                  href={`/admin/cmas/${props.reviewDeliveryId}`}
                  className="av2-btn av2-btn--quiet h-9"
                  style={{ textDecoration: 'none' }}
                >
                  Review comp
                </a>
                {props.composeHref ? (
                  <a href={props.composeHref} className="av2-btn h-9" style={{ textDecoration: 'none' }}>
                    Send from CRM
                  </a>
                ) : null}
              </>
            ) : (
              <a href={props.buildHref} className="av2-btn h-9" style={{ textDecoration: 'none' }}>
                Build CMA
              </a>
            )}
          </div>
        </div>
      </div>
      {props.lat != null && props.lng != null && props.mapsLink ? (
        <OwnedHomeMapClient
          lat={props.lat}
          lng={props.lng}
          boundary={props.boundary}
          fallbackMapUrl={props.mapUrl}
          mapsLink={props.mapsLink}
          placeLabel={null}
        />
      ) : props.mapUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={props.mapUrl} alt="" className="mt-2 w-full rounded-lg object-cover" style={{ height: 180 }} />
      ) : null}
    </div>
  )
}
