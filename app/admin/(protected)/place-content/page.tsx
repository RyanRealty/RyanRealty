import Link from 'next/link'
import { listPlaceContent, getContentCompletionStats, type PlaceContentListItem } from '@/app/actions/place-content'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'

export const dynamic = 'force-dynamic'

export default async function PlaceContentAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>
}) {
  const params = await searchParams
  const typeFilter = (params.type ?? 'all') as 'all' | 'city' | 'community' | 'neighborhood'

  const [allContent, stats] = await Promise.all([
    typeFilter === 'all' ? listPlaceContent() : listPlaceContent(typeFilter as 'city' | 'community' | 'neighborhood'),
    getContentCompletionStats(),
  ])

  const completionPct = stats.total > 0 ? Math.round((stats.withOverview / stats.total) * 100) : 0

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Place Content Manager</h1>
          <p className="mt-1 text-muted-foreground">
            Manage rich landing page content for cities, communities, and neighborhoods.
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Total places</p>
            <p className="text-2xl font-bold text-foreground">{stats.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">With overview</p>
            <p className="text-2xl font-bold text-foreground">{stats.withOverview}</p>
            <Progress value={completionPct} className="mt-2" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Cities</p>
            <p className="text-2xl font-bold text-foreground">{stats.byType['city'] ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Communities</p>
            <p className="text-2xl font-bold text-foreground">{stats.byType['community'] ?? 0}</p>
          </CardContent>
        </Card>
      </div>

      <Separator className="my-6" />

      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-muted-foreground">Filter:</span>
        {(['all', 'city', 'community', 'neighborhood'] as const).map((t) => (
          <Link key={t} href={`/admin/place-content${t === 'all' ? '' : `?type=${t}`}`}>
            <Badge variant={typeFilter === t ? 'default' : 'outline'}>
              {t === 'all' ? 'All' : t.charAt(0).toUpperCase() + t.slice(1)}
            </Badge>
          </Link>
        ))}
      </div>

      <div className="mt-6">
        {allContent.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-muted-foreground">
                No place content found. Run the content generator to populate:
              </p>
              <code className="mt-2 block rounded bg-muted p-2 text-sm">
                npx tsx scripts/generate-place-content.ts
              </code>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {allContent.map((item) => {
              const sectionCount = [
                item.overview,
                item.history,
                item.lifestyle,
                item.schools,
                item.outdoor_recreation,
                item.dining,
                item.shopping,
                item.arts_culture,
                item.transportation,
                item.healthcare,
                item.events_festivals,
                item.family_life,
                item.real_estate_overview,
              ].filter((s) => s?.trim()).length

              return (
                <Link
                  key={item.id}
                  href={`/admin/place-content/${item.place_type}/${encodeURIComponent(item.place_key)}`}
                  className="block"
                >
                  <Card className="transition-colors hover:bg-muted/50">
                    <CardContent className="flex items-center justify-between p-4">
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className="shrink-0">
                          {item.place_type}
                        </Badge>
                        <div>
                          <p className="font-medium text-foreground">
                            {item.place_name}
                            {item.city_name && (
                              <span className="ml-1 text-muted-foreground">
                                ({item.city_name})
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {sectionCount}/13 sections filled
                            {item.generated_at && (
                              <> · Generated {new Date(item.generated_at).toLocaleDateString()}</>
                            )}
                            {item.last_edited_at && (
                              <> · Edited {new Date(item.last_edited_at).toLocaleDateString()}</>
                            )}
                          </p>
                        </div>
                      </div>
                      <Badge variant={sectionCount >= 10 ? 'default' : sectionCount >= 5 ? 'secondary' : 'outline'}>
                        {sectionCount >= 10 ? 'Complete' : sectionCount >= 5 ? 'Partial' : 'Minimal'}
                      </Badge>
                    </CardContent>
                  </Card>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
