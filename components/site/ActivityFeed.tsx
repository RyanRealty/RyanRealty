import Link from 'next/link'
import { getActivityFeedWithFallbackMulti } from '@/app/actions/activity-feed'
import { ACTIVITY_FEED_DEFAULT_CITIES, type ActivityFeedItem } from '@/app/actions/activity-feed-shared'
import {
  Container,
  Eyebrow,
  Grid,
  H2,
  MiddleDot,
  Price,
  Section,
  Stack,
  TextLink,
} from '@/components/site/primitives'

/**
 * Site v2 activity feed — 4 to 8 recent activity rows (new listing / price drop /
 * open house / pending / closed) on the homepage. Static for now; realtime
 * subscription is a follow-up. Mirrors design_system/ryan-realty/ui_kits/website/
 * index.html §activity.
 *
 * Data accuracy: every row traces to activity_events via getActivityFeedWithFallbackMulti().
 *
 * Lifted onto Wave 2 Layer 1 primitives 2026-05-27. fmtPrice() helper retired
 * in favor of <Price compact={false}>. Separators moved to <MiddleDot>.
 */

function HomeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  )
}
function DollarIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 2v20M17 7H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  )
}
function CheckIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  )
}
function ClockIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  )
}

function iconFor(event: ActivityFeedItem['event_type']) {
  switch (event) {
    case 'new_listing':
    case 'back_on_market':
      return <HomeIcon />
    case 'price_drop':
      return <DollarIcon />
    case 'status_pending':
    case 'status_closed':
      return <CheckIcon />
    default:
      return <ClockIcon />
  }
}

function leadFor(event: ActivityFeedItem['event_type']): string {
  switch (event) {
    case 'new_listing': return 'New listing'
    case 'price_drop': return 'Price drop'
    case 'status_pending': return 'Pending'
    case 'status_closed': return 'Closed'
    case 'status_expired': return 'Expired'
    case 'back_on_market': return 'Back on market'
  }
}

function buildAddress(item: ActivityFeedItem): string {
  const street = [item.StreetNumber, item.StreetName].filter(Boolean).join(' ').trim()
  const city = item.City
  if (street && city) return `${street}, ${city}`
  return street || city || 'Central Oregon'
}

function relTime(iso: string): string {
  const then = new Date(iso).getTime()
  const now = Date.now()
  const diffMs = Math.max(0, now - then)
  const m = Math.round(diffMs / 60_000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.round(h / 24)
  return `${d}d ago`
}

function ActivityRow({ item }: { item: ActivityFeedItem }) {
  return (
    <Link
      href={`/listing/${item.listing_key}`}
      className="flex items-center gap-3.5 p-3.5 bg-card border border-border rounded-xl hover:border-primary/25 transition"
    >
      <span className="shrink-0 w-9 h-9 rounded-full bg-primary/8 text-primary flex items-center justify-center">
        {iconFor(item.event_type)}
      </span>
      <span className="flex-1 text-[13px] leading-[1.45] text-foreground">
        <b className="font-semibold">{leadFor(item.event_type)}</b>
        {' '}
        <MiddleDot className="text-muted-foreground/60" />
        {' '}
        {buildAddress(item)}
        {item.ListPrice ? (
          <span className="text-muted-foreground">
            {' '}
            <MiddleDot className="text-muted-foreground/60" />
            {' '}
            <Price value={item.ListPrice} />
          </span>
        ) : null}
      </span>
      <span className="text-[11px] text-muted-foreground whitespace-nowrap tabular-nums">
        {relTime(item.event_at)}
      </span>
    </Link>
  )
}

export default async function ActivityFeed() {
  const items = await getActivityFeedWithFallbackMulti({
    cities: [...ACTIVITY_FEED_DEFAULT_CITIES],
    limit: 8,
  }).catch(() => [])

  if (items.length === 0) return null

  return (
    <Section padding="default" divider>
      <Container>
        <div className="flex items-end justify-between gap-6 flex-wrap mb-6">
          <Stack gap="tight">
            <Eyebrow>Live activity</Eyebrow>
            <H2>What&apos;s happening right now</H2>
          </Stack>
          <TextLink
            href="/housing-market"
            underline="on-hover"
            className="whitespace-nowrap text-sm"
          >
            Full market pulse →
          </TextLink>
        </div>

        <Grid cols={2} gap="tight">
          {items.slice(0, 8).map((item) => (
            <ActivityRow key={item.id} item={item} />
          ))}
        </Grid>
      </Container>
    </Section>
  )
}
