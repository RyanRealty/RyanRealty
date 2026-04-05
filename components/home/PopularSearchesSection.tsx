import Link from 'next/link'
import { getPopularPublicSearches } from '@/app/actions/saved-searches'
import TilesSlider, { TilesSliderItem } from '@/components/TilesSlider'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default async function PopularSearchesSection() {
  const searches = await getPopularPublicSearches(12)
  if (searches.length === 0) return null

  return (
    <section className="px-4 py-12 sm:px-6 sm:py-14">
      <TilesSlider
        title="Popular searches"
        subtitle="See what buyers are looking for right now."
      >
        {searches.map((search) => (
          <TilesSliderItem key={search.id}>
            <Card className="h-full border-border bg-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold text-foreground">
                  {search.title}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm text-muted-foreground">{search.summary}</p>
                <p className="text-xs text-muted-foreground">
                  {search.resultCount.toLocaleString()} homes
                </p>
                <Link
                  href={`/api/public-search/click?searchId=${encodeURIComponent(search.id)}&to=${encodeURIComponent(search.href)}`}
                  className="inline-flex text-sm font-medium text-primary hover:underline"
                >
                  View search
                </Link>
              </CardContent>
            </Card>
          </TilesSliderItem>
        ))}
      </TilesSlider>
    </section>
  )
}
