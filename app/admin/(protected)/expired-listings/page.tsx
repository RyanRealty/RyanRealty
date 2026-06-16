import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getSession } from '@/app/actions/auth'
import { getAdminRoleForEmail } from '@/app/actions/admin-roles'
import { listExpiredListings } from '@/app/actions/expired-listings'
import { ExpiredListingsClient } from './ExpiredListingsClient'
import { ExpiredListingCard, ExpiredListingTableRow } from './ExpiredListingRow'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ConsoleSection } from '@/components/console/ConsoleSection'
import { KpiStrip } from '@/components/console/KpiStrip'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 25

export default async function ExpiredListingsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; city?: string }>
}) {
  const session = await getSession()
  const adminRole = await getAdminRoleForEmail(session?.user?.email ?? null)
  if (adminRole?.role !== 'superuser') {
    redirect('/admin/access-denied')
  }

  const { page, city } = await searchParams
  const pageNum = Math.max(0, parseInt(String(page), 10) || 0)
  const { rows, total } = await listExpiredListings({
    limit: PAGE_SIZE,
    offset: pageNum * PAGE_SIZE,
    city: city?.trim() || undefined,
  })
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const withContact = rows.filter(
    (r) => r.contact_phone || r.contact_email || r.contact_source,
  ).length

  const pageHref = (n: number) =>
    `?page=${n}${city ? `&city=${encodeURIComponent(city)}` : ''}`

  return (
    <main className="space-y-4 sm:space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold text-foreground">Expired listings</h1>
        <p className="text-sm text-muted-foreground">
          Expired and withdrawn listings for prospecting. Use the owner or list-agent name plus the
          address to search online, then save the phone and email you find.
        </p>
      </header>

      {/* Glanceable summary */}
      <ConsoleSection title="Summary">
        <KpiStrip
          items={[
            { label: city ? `in ${city}` : 'total expired', value: total },
            { label: 'contact found (this page)', value: withContact },
            { label: 'page', value: `${pageNum + 1} / ${totalPages}` },
          ]}
        />
      </ConsoleSection>

      {/* Data refresh actions */}
      <ConsoleSection title="Data refresh">
        <ExpiredListingsClient />
      </ConsoleSection>

      {/* Filter */}
      <form method="get" className="flex flex-col gap-2 sm:flex-row sm:max-w-md">
        <Input
          type="text"
          name="city"
          defaultValue={city}
          placeholder="Filter by city"
          aria-label="Filter by city"
          className="h-11"
        />
        <Button type="submit" variant="secondary" className="h-11 px-5">
          Filter
        </Button>
      </form>

      {rows.length === 0 ? (
        <ConsoleSection title="Listings">
          <div className="flex flex-col items-center gap-2 p-6 text-center">
            <p className="text-base font-medium text-foreground">
              {city ? `No expired listings in ${city}` : 'No expired listings yet'}
            </p>
            <p className="max-w-sm text-sm text-muted-foreground">
              {city
                ? 'Try a different city, or clear the filter to see every market.'
                : 'Run “Backfill last 6 months from Spark” above to load historical data.'}
            </p>
            {city ? (
              <Button asChild variant="secondary" className="mt-1 h-11 px-5">
                <Link href="?">Clear filter</Link>
              </Button>
            ) : null}
          </div>
        </ConsoleSection>
      ) : (
        <ConsoleSection title="Listings" count={`(${rows.length})`}>
          {/* Cards — phones */}
          <div className="space-y-3 md:hidden">
            {rows.map((row) => (
              <ExpiredListingCard key={row.id} row={row} />
            ))}
          </div>

          {/* Table — desktop (unchanged dense view) */}
          <div className="hidden overflow-x-auto rounded-xl border border-border bg-card md:block">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted">
                  <TableHead className="text-muted-foreground">Address</TableHead>
                  <TableHead className="text-muted-foreground">City</TableHead>
                  <TableHead className="text-muted-foreground">Owner name</TableHead>
                  <TableHead className="text-muted-foreground">List agent</TableHead>
                  <TableHead className="text-muted-foreground">List office</TableHead>
                  <TableHead className="text-muted-foreground">List price</TableHead>
                  <TableHead className="text-muted-foreground">DOM</TableHead>
                  <TableHead className="text-muted-foreground">Expired</TableHead>
                  <TableHead className="text-muted-foreground">Status</TableHead>
                  <TableHead className="text-muted-foreground">Contact / notes</TableHead>
                  <TableHead className="text-muted-foreground">Search / Edit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <ExpiredListingTableRow key={row.id} row={row} />
                ))}
              </TableBody>
            </Table>
          </div>
        </ConsoleSection>
      )}

      {totalPages > 1 ? (
        <nav className="flex items-center justify-between gap-3" aria-label="Pagination">
          <Button
            asChild={pageNum > 0}
            variant="outline"
            className="h-11 flex-1 sm:flex-none sm:px-6"
            disabled={pageNum === 0}
          >
            {pageNum > 0 ? <Link href={pageHref(pageNum - 1)}>Previous</Link> : <span>Previous</span>}
          </Button>
          <p className="shrink-0 text-sm tabular-nums text-muted-foreground">
            Page {pageNum + 1} of {totalPages}
          </p>
          <Button
            asChild={pageNum < totalPages - 1}
            variant="outline"
            className="h-11 flex-1 sm:flex-none sm:px-6"
            disabled={pageNum >= totalPages - 1}
          >
            {pageNum < totalPages - 1 ? (
              <Link href={pageHref(pageNum + 1)}>Next</Link>
            ) : (
              <span>Next</span>
            )}
          </Button>
        </nav>
      ) : null}
    </main>
  )
}
