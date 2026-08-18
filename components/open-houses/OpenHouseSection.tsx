import Link from 'next/link'
import Image from 'next/image'
import TilesSlider, { TilesSliderItem } from '@/components/TilesSlider'
import { Card, CardContent } from '@/components/ui/card'
import type { OpenHouseWithListing } from '@/app/actions/open-houses'
import { listingDetailPath } from '@/lib/slug'
import { publishCalendarDay } from '@/lib/listing/publish-calendar-day'

type Props = {
  title: string
  items: OpenHouseWithListing[]
  viewAllHref: string
  viewAllLabel?: string
}

function formatDate(date: string): string {
  return publishCalendarDay(date, { weekday: 'short', month: 'short', day: 'numeric', year: undefined })
}

function formatTime(t: string | null): string {
  if (!t) return ''
  const [h, m] = t.split(':')
  const hour = Number(h ?? 0)
  const minute = Number((m ?? '0').slice(0, 2))
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return ''
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const h12 = hour % 12 || 12
  return `${h12}:${String(minute).padStart(2, '0')} ${ampm}`
}

function formatAddress(item: OpenHouseWithListing): string {
  return (
    item.unparsed_address ||
    [item.street_number, item.street_name, item.city, item.state, item.postal_code].filter(Boolean).join(', ')
  )
}

export default function OpenHouseSection({ title, items, viewAllHref, viewAllLabel = 'See all open houses' }: Props) {
  if (items.length === 0) return null

  return (
    <TilesSlider
      title={title}
      headerRight={
        <Link href={viewAllHref} className="text-sm font-medium text-primary hover:underline">
          {viewAllLabel}
        </Link>
      }
    >
      {items.slice(0, 12).map((item) => (
        <TilesSliderItem key={item.id}>
          <Link
            href={listingDetailPath(
              item.listing_key,
              {
                streetNumber: item.street_number,
                streetName: item.street_name,
                city: item.city,
                state: item.state,
                postalCode: item.postal_code,
              },
              { city: item.city, subdivision: item.subdivision_name },
              { mlsNumber: item.list_number }
            )}
            className="block h-full rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <Card className="h-full overflow-hidden">
              <div className="relative aspect-[4/3] bg-muted">
                {item.photo_url ? (
                  <Image src={item.photo_url} alt="" fill className="object-cover" sizes="(max-width: 640px) 85vw, 320px" />
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-muted-foreground">No photo</div>
                )}
              </div>
              <CardContent className="space-y-1 p-3">
                <p className="line-clamp-2 text-sm font-medium text-foreground">{formatAddress(item)}</p>
                <p className="text-xs text-muted-foreground">
                  {formatDate(item.event_date)}
                  {item.start_time ? ` • ${formatTime(item.start_time)}` : ''}
                  {item.end_time ? ` - ${formatTime(item.end_time)}` : ''}
                </p>
                <p className="text-sm font-semibold text-primary">
                  {item.list_price != null ? `$${item.list_price.toLocaleString()}` : 'Price unavailable'}
                </p>
              </CardContent>
            </Card>
          </Link>
        </TilesSliderItem>
      ))}
    </TilesSlider>
  )
}
