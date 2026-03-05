'use client'

import { AGENT_PHONE_DISPLAY, AGENT_PHONE_TEL } from '../../lib/listing-cta'

type Props = {
  /** Full street address for showing request */
  address: string
  /** City, state zip for context */
  cityStateZip?: string
  /** Listing URL for email body */
  listingUrl: string
  /** List price for display */
  listPrice: number | null
  /** MLS number */
  listingId?: string | null
}

function buildScheduleShowingMailto(listingUrl: string, address: string, cityStateZip?: string): string {
  const subject = encodeURIComponent(`Showing request: ${address}${cityStateZip ? `, ${cityStateZip}` : ''}`)
  const body = encodeURIComponent(
    `I'd like to schedule a showing for this property.\n\nListing: ${listingUrl}\n\nAddress: ${address}${cityStateZip ? `\n${cityStateZip}` : ''}`
  )
  return `mailto:?subject=${subject}&body=${body}`
}

export default function ListingCtaSidebar({
  address,
  cityStateZip,
  listingUrl,
  listPrice,
  listingId,
}: Props) {
  const mailto = buildScheduleShowingMailto(listingUrl, address, cityStateZip ?? '')

  return (
    <aside
      className="sticky top-[4.25rem] shrink-0 lg:w-80"
      aria-label="Contact and schedule"
    >
      <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        {listPrice != null && listPrice > 0 && (
          <p className="text-2xl font-semibold text-zinc-900">
            ${listPrice.toLocaleString()}
          </p>
        )}
        {listingId && (
          <p className="mt-0.5 text-sm text-zinc-500">MLS# {listingId}</p>
        )}
        <div className="mt-4 flex flex-col gap-3">
          <a
            href={mailto}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-3 text-base font-semibold text-white shadow-sm hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
          >
            <span aria-hidden>📅</span>
            Schedule a showing
          </a>
          <a
            href={`tel:${AGENT_PHONE_TEL}`}
            className="inline-flex items-center justify-center gap-2 rounded-lg border-2 border-zinc-200 bg-white px-4 py-3 text-base font-semibold text-zinc-800 hover:border-zinc-300 hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-400 focus:ring-offset-2"
          >
            <span aria-hidden>📞</span>
            Contact agent
            <span className="font-medium text-zinc-600">{AGENT_PHONE_DISPLAY}</span>
          </a>
        </div>
        <p className="mt-3 text-xs text-zinc-500">
          Calls and showings are handled by Ryan Realty. This number connects you with our team.
        </p>
      </div>
    </aside>
  )
}
