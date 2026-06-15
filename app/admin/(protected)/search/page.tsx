import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

type SearchParams = Promise<{ q?: string }>

export default async function AdminSearchPage({ searchParams }: { searchParams: SearchParams }) {
  const { q = '' } = await searchParams
  const term = q.trim()
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  let listingRows: Array<{ ListingKey?: string | null; ListNumber?: string | null; StreetNumber?: string | null; StreetName?: string | null; City?: string | null; State?: string | null }> = []
  let brokerRows: Array<{ id: string; slug: string; display_name: string; email?: string | null }> = []
  let userRows: Array<{ email: string; role: string; broker_id?: string | null }> = []

  if (term && url?.trim() && key?.trim()) {
    const supabase = createClient(url, key)
    void supabase
    const { getListingTiles } = await import('@/lib/data')
    const [listingsRes, brokersRes, usersRes] = await Promise.all([
      getListingTiles({ searchQuery: term, status: 'all', sort: 'newest', limit: 20 }).then((tiles) => ({
        data: tiles.map((t) => ({
          ListingKey: t.listingKey,
          ListNumber: t.listNumber,
          StreetNumber: t.streetNumber,
          StreetName: t.streetName,
          City: t.city,
          State: 'OR',
        })),
      })),
      supabase
        .from('brokers')
        .select('id, slug, display_name, email')
        .or(`display_name.ilike.%${term}%,slug.ilike.%${term}%,email.ilike.%${term}%`)
        .limit(20),
      supabase
        .from('admin_roles')
        .select('email, role, broker_id')
        .or(`email.ilike.%${term}%`)
        .limit(20),
    ])
    listingRows = (listingsRes.data ?? []) as typeof listingRows
    brokerRows = (brokersRes.data ?? []) as typeof brokerRows
    userRows = (usersRes.data ?? []) as typeof userRows
  }

  const CAP = 8
  const hasTerm = term.length > 0

  return (
    <main className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Admin search</h1>
        <p className="text-sm text-muted-foreground">Search listings, brokers, and admin users from one place.</p>
      </header>

      <form action="/admin/search" method="get" className="flex max-w-xl items-center gap-2">
        <Input name="q" type="search" placeholder="Search by address, broker, email, MLS number" defaultValue={term} />
        <Button type="submit">Search</Button>
      </form>

      {!hasTerm ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Type a name, address, email, or MLS number above to search.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card>
            <CardHeader><CardTitle className="text-base">Listings</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              {listingRows.length === 0 ? (
                <p className="text-muted-foreground">No results for &ldquo;{term}&rdquo;. Try a different term.</p>
              ) : (
                <>
                  {listingRows.slice(0, CAP).map((row, index) => {
                    const keyVal = (row.ListingKey ?? row.ListNumber ?? '').toString().trim()
                    const label = [row.StreetNumber, row.StreetName, row.City, row.State].filter(Boolean).join(' ')
                    return (
                      <Link key={keyVal || `listing-${index}`} href={keyVal ? `/admin/listings/${encodeURIComponent(keyVal)}` : '/admin/listings'} className="block text-primary hover:underline">
                        {label || keyVal || 'Listing'}
                      </Link>
                    )
                  })}
                  {listingRows.length > CAP ? (
                    <p className="pt-1 text-xs text-muted-foreground tabular-nums">Showing {CAP} of {listingRows.length}.</p>
                  ) : null}
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Brokers</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              {brokerRows.length === 0 ? (
                <p className="text-muted-foreground">No results for &ldquo;{term}&rdquo;. Try a different term.</p>
              ) : (
                <>
                  {brokerRows.slice(0, CAP).map((row) => (
                    <Link key={row.id} href={`/admin/brokers/edit?id=${encodeURIComponent(row.id)}`} className="block text-primary hover:underline">
                      {row.display_name} {row.email ? `(${row.email})` : ''}
                    </Link>
                  ))}
                  {brokerRows.length > CAP ? (
                    <p className="pt-1 text-xs text-muted-foreground tabular-nums">Showing {CAP} of {brokerRows.length}.</p>
                  ) : null}
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Users</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              {userRows.length === 0 ? (
                <p className="text-muted-foreground">No results for &ldquo;{term}&rdquo;. Try a different term.</p>
              ) : (
                <>
                  {userRows.slice(0, CAP).map((row) => (
                    <p key={`${row.email}-${row.role}`} className="text-foreground">
                      {row.email} <span className="text-muted-foreground">({row.role})</span>
                    </p>
                  ))}
                  {userRows.length > CAP ? (
                    <p className="pt-1 text-xs text-muted-foreground tabular-nums">Showing {CAP} of {userRows.length}.</p>
                  ) : null}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </main>
  )
}
