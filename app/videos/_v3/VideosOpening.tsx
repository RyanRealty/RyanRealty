/**
 * Videos browse opening: H1 + caption (the set on screen) + city filters.
 * The Field is HideAwareVideoGrid, mounted by the page.
 */
import { cn } from '@/lib/utils'
import { V3Button, V3Heading, V3_ROOT_CLASS } from '@/components/site/v3'
import { CITY_CHIPS } from './videos-constants'

export function VideosOpening({
  heading,
  city,
  count,
}: {
  heading: string
  city: string | null
  count: number
}) {
  return (
    <div className={cn(V3_ROOT_CLASS, 'mx-auto max-w-6xl px-4 pt-8')}>
      <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <V3Heading level={1}>{heading}</V3Heading>
        {count > 0 ? (
          <p className="text-sm text-muted-foreground">
            <span className="tabular-nums text-foreground">{count.toLocaleString('en-US')}</span>
            {count === 1 ? ' home with a video tour' : ' homes with a video tour'}
          </p>
        ) : null}
      </div>
      <nav aria-label="Filter video tours by city" className="flex flex-wrap items-center gap-2 pb-4">
        <V3Button href="/videos" variant="ghost" ariaCurrent={city ? undefined : 'page'}>
          All Central Oregon
        </V3Button>
        {CITY_CHIPS.map((c) => {
          const active = c === city
          return (
            <V3Button
              key={c}
              href={`/videos?city=${encodeURIComponent(c)}`}
              variant="ghost"
              ariaCurrent={active ? 'page' : undefined}
            >
              {c}
            </V3Button>
          )
        })}
      </nav>
    </div>
  )
}
