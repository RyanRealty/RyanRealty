import { redirect } from 'next/navigation'
import { getSession } from '@/app/actions/auth'
import { getAdminRoleForEmail } from '@/app/actions/admin-roles'
import { listExpiredListings } from '@/app/actions/expired-listings'
import { ExpiredListingsClient } from './ExpiredListingsClient'
import { ExpiredListingRow } from './ExpiredListingRow'
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

export const dynamic = 'force-dynamic'

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
  const pageSize = 50
  const { rows, total } = await listExpiredListings({
    limit: pageSize,
    offset: pageNum * pageSize,
    city: city?.trim() || undefined,
  })
  const totalPages = Math.ceil(total / pageSize)

  return (
    <main className="mx-auto max-w-[1600px]">
      <h1 className="text-2xl font-bold text-foreground">Expired listings</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        All expired/withdrawn listings for prospecting. Use owner name (or list agent) + address to search online or on Facebook for phone and email, then save contact info below.
      </p>

      <div className="mt-4">
        <ExpiredListingsClient />
      </div>

      <form method="get" className="mt-4 flex flex-wrap gap-2">
        <Input
          type="text"
          name="city"
          defaultValue={city}
          placeholder="Filter by city"
        />
        <Button type="submit" variant="outline">
          Filter
        </Button>
      </form>

      <p className="mt-2 text-sm text-muted-foreground">
        {total} total. Page {pageNum + 1} of {totalPages || 1}.
      </p>

      <div className="mt-4 overflow-x-auto rounded-lg border border-border bg-card">
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
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={11} className="text-center text-muted-foreground py-6">
                  No expired listings yet. Run &quot;Backfill last 6 months from Spark&quot; to load historical data.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => <ExpiredListingRow key={row.id} row={row} />)
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <nav className="mt-4 flex gap-2">
          {pageNum > 0 && (
            <a
              href={`?page=${pageNum - 1}${city ? `&city=${encodeURIComponent(city)}` : ''}`}
              className="rounded bg-border px-3 py-1 text-sm text-foreground hover:bg-border"
            >
              Previous
            </a>
          )}
          {pageNum < totalPages - 1 && (
            <a
              href={`?page=${pageNum + 1}${city ? `&city=${encodeURIComponent(city)}` : ''}`}
              className="rounded bg-border px-3 py-1 text-sm text-foreground hover:bg-border"
            >
              Next
            </a>
          )}
        </nav>
      )}
    </main>
  )
}
