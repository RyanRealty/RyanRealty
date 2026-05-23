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

  return (
    <main className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-foreground">Admin search</h1>
        <p className="text-sm text-muted-foreground">Search listings, brokers, and admin users from one place.</p>
      </header>

      <form action="/admin/search" method="get" className="flex max-w-xl items-center gap-2">
        <Input name="q" type="search" placeholder="Search by address, broker, email, MLS number" defaultValue={term} />
        <Button type="submit">Search</Button>
      </form>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader><CardTitle className="text-base">Listings</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {listingRows.length === 0 ? <p className="text-muted-foreground">No listing matches.</p> : listingRows.map((row, index) => {
              const keyVal = (row.ListingKey ?? row.ListNumber ?? '').toString().trim()
              const label = [row.StreetNumber, row.StreetName, row.City, row.State].filter(Boolean).join(' ')
              return (
                <Link key={keyVal || `listing-${index}`} href={keyVal ? `/admin/listings/${encodeURIComponent(keyVal)}` : '/admin/listings'} className="block text-primary hover:underline">
                  {label || keyVal || 'Listing'}
                </Link>
              )
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Brokers</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {brokerRows.length === 0 ? <p className="text-muted-foreground">No broker matches.</p> : brokerRows.map((row) => (
              <Link key={row.id} href={`/admin/brokers/edit?id=${encodeURIComponent(row.id)}`} className="block text-primary hover:underline">
                {row.display_name} {row.email ? `(${row.email})` : ''}
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Users</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {userRows.length === 0 ? <p className="text-muted-foreground">No user matches.</p> : userRows.map((row) => (
              <p key={`${row.email}-${row.role}`} className="text-foreground">
                {row.email} <span className="text-muted-foreground">({row.role})</span>
              </p>
            ))}
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
