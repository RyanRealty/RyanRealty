import Image from 'next/image'
import {
  Body,
  Eyebrow,
  H3,
  Stack,
} from '@/components/site/primitives'
import type { Broker } from '@/lib/data/types/broker'
import type { ReviewsSummary } from '@/lib/data/reviews/getReviews'

/**
 * Listing-detail broker contact card — the ONE sticky sidebar CTA. Shows the
 * contact broker's FULL contact info (click-to-call phone + email, name, title,
 * license, headshot), the primary "Schedule a tour" + Call/Text actions, and —
 * on large screens only — a short verified-Google-review social-proof block.
 *
 * The phone is the broker's Twilio business line (broker.phoneDirect): inbound is
 * recorded, logged to the CRM timeline, and forwarded to their cell.
 *
 * Reviews are brokerage-level (verified Google Business Profile) and exempt from
 * the brand-voice gate (real customer words, not our copy). Renders the rating +
 * count badge and one recent quote; the block is hidden entirely when there are
 * no reviews or none with text.
 *
 * Per CLAUDE.md brand voice: direct + specific, no marketing slop, no banned
 * tokens, no em-dash.
 */

type Props = {
  broker: Broker
  listingKey: string
  /** Brokerage Google reviews for the lg-only social-proof block. */
  reviews?: ReviewsSummary | null
  headline?: string
  body?: string
  primaryCta?: { href: string; label: string }
  className?: string
}

function digits(phone: string): string {
  return phone.replace(/[^\d]/g, '')
}

export function TextMattCTA({
  broker,
  listingKey,
  reviews,
  headline,
  body,
  primaryCta,
  className,
}: Props) {
  const tourHref = primaryCta?.href ?? `/contact?listingKey=${encodeURIComponent(listingKey)}`
  const tourLabel = primaryCta?.label ?? 'Schedule a tour'
  const phone = broker.phoneDirect ?? broker.phoneFub ?? null
  const firstName = broker.fullName.split(/\s+/)[0]

  const quote = reviews?.reviews?.[0] ?? null
  const showProof = !!reviews && reviews.count > 0 && reviews.averageRating > 0

  return (
    <div
      className={className ?? undefined}
      style={{
        border: '3px solid var(--navy)',
        background: 'var(--cream)',
        padding: 'clamp(20px,3vw,26px)',
      }}
    >
      <Stack gap="default">
        <Eyebrow>Talk to a broker</Eyebrow>
        <H3>{headline ?? 'Questions about this home?'}</H3>
        <Body size="small" tone="muted" className="leading-[1.55]">
          {body ?? 'Tour requests usually get a same-day reply. No pressure, no obligation.'}
        </Body>

        {/* Broker identity */}
        <div className="flex items-center gap-3 pt-1">
          <Image
            src={broker.headshotPng}
            alt={broker.fullName}
            width={56}
            height={56}
            className="shrink-0"
            style={{ width: 56, height: 56, objectFit: 'contain', objectPosition: 'top' }}
          />
          <div className="min-w-0">
            <div className="text-[15px] font-semibold leading-tight" style={{ color: 'var(--navy)' }}>
              {broker.fullName}
            </div>
            <div className="text-[12px] leading-snug" style={{ color: 'rgba(16,39,66,0.66)' }}>
              {broker.title}
              {broker.licenseNumber ? (
                <>
                  {' '}
                  <span className="tabular-nums">#{broker.licenseNumber}</span>
                </>
              ) : null}
            </div>
          </div>
        </div>

        {/* Full contact — click-to-call + email */}
        {phone || broker.email ? (
          <div className="flex flex-col" style={{ borderTop: '1px solid rgba(16,39,66,0.14)', paddingTop: 12 }}>
            {phone ? (
              <a
                href={`tel:${digits(phone)}`}
                className="flex items-center gap-2.5 py-1.5 text-[15px] font-semibold tabular-nums"
                style={{ color: 'var(--navy)' }}
              >
                <PhoneIcon />
                {phone}
              </a>
            ) : null}
            {broker.email ? (
              <a
                href={`mailto:${broker.email}`}
                className="flex items-center gap-2.5 py-1.5 text-[13px] break-all"
                style={{ color: 'rgba(16,39,66,0.78)' }}
              >
                <MailIcon />
                {broker.email}
              </a>
            ) : null}
          </div>
        ) : null}

        {/* Actions */}
        <div className="flex flex-col gap-2.5 pt-1">
          <a href={tourHref} className="btn alt" style={{ justifyContent: 'center' }}>
            {tourLabel}
          </a>
          <div className="grid grid-cols-2 gap-2.5">
            {phone ? (
              <a href={`tel:${digits(phone)}`} className="btn" style={OUTLINE_BTN}>
                Call
              </a>
            ) : null}
            {phone ? (
              <a href={`sms:${digits(phone)}`} className="btn" style={OUTLINE_BTN}>
                Text {firstName}
              </a>
            ) : null}
          </div>
        </div>

        {/* Social proof — large screens only (verified Google reviews) */}
        {showProof ? (
          <div
            className="hidden lg:block"
            style={{ borderTop: '1px solid rgba(16,39,66,0.14)', paddingTop: 14, marginTop: 2 }}
          >
            <div className="flex items-center gap-2">
              <span aria-hidden style={{ color: 'var(--navy)', letterSpacing: '0.04em', fontSize: '0.95rem' }}>
                {'★'.repeat(Math.round(reviews!.averageRating))}
              </span>
              <span className="text-[12px] font-semibold tabular-nums" style={{ color: 'var(--navy)' }}>
                {reviews!.averageRating.toFixed(1)}
              </span>
              <span className="text-[12px]" style={{ color: 'var(--navy-70)' }}>
                {reviews!.count} Google reviews
              </span>
            </div>
            {quote ? (
              <blockquote
                className="mt-2 text-[12.5px] leading-[1.5]"
                style={{ color: 'rgba(16,39,66,0.78)' }}
              >
                {truncate(quote.text, 150)}
                {quote.reviewerName ? (
                  <cite className="mt-1 block not-italic text-[11px]" style={{ color: 'var(--navy-70)' }}>
                    {quote.reviewerName}
                  </cite>
                ) : null}
              </blockquote>
            ) : null}
          </div>
        ) : null}
      </Stack>
    </div>
  )
}

const OUTLINE_BTN: React.CSSProperties = {
  background: 'transparent',
  color: 'var(--navy)',
  borderColor: 'var(--navy)',
  justifyContent: 'center',
}

/** Trim to the last word boundary under `max` and add an ellipsis. */
function truncate(s: string, max: number): string {
  const t = s.trim()
  if (t.length <= max) return `“${t}”`
  const cut = t.slice(0, max)
  const lastSpace = cut.lastIndexOf(' ')
  return `“${(lastSpace > 40 ? cut.slice(0, lastSpace) : cut).trim()}…”`
}

function PhoneIcon() {
  return (
    <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="shrink-0">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  )
}

function MailIcon() {
  return (
    <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="shrink-0">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 7-10 6L2 7" />
    </svg>
  )
}
