import Link from 'next/link'
import { listSubdivisionsWithFlags } from '@/app/actions/subdivision-flags'
import ResortCommunityToggle from './ResortCommunityToggle'
import SeedResortButton from './SeedResortButton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

export const dynamic = 'force-dynamic'

export default async function AdminResortCommunitiesPage() {
  const rows = await listSubdivisionsWithFlags()

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-bold text-foreground">Resort & master plan communities</h1>
      <p className="mt-2 text-muted-foreground">
        Flag subdivisions as resort or master plan communities. When flagged, the community page shows the full amenities & lifestyle section (attractions, dining) and resort schema. Unflagged subdivisions use the standard community page.
      </p>
      <p className="mt-2 text-sm text-muted-foreground">
        Changes save automatically when you toggle a checkbox. Subdivisions in the built-in Oregon resort & master plan list appear checked until you turn them off.
      </p>
      <p className="mt-2 text-sm text-muted-foreground">
        <Link href="/admin" className="underline">← Admin</Link>
      </p>

      <section className="mt-6 flex flex-wrap items-center gap-3 rounded-lg border border-border bg-muted p-4">
        <span className="text-sm text-muted-foreground">Copy the built-in Oregon resort & master plan list into the database so you can edit it here.</span>
        <SeedResortButton />
      </section>

      <section className="mt-8 rounded-lg border border-border bg-card shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted">
              <TableRow>
                <TableHead className="text-xs font-medium uppercase text-muted-foreground">City</TableHead>
                <TableHead className="text-xs font-medium uppercase text-muted-foreground">Subdivision</TableHead>
                <TableHead className="text-xs font-medium uppercase text-muted-foreground">Resort & master plan</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="bg-card">
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-sm text-muted-foreground py-8">
                    No subdivisions found. Sync listings first so city/subdivision pairs appear.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r) => (
                  <TableRow
                    key={r.entity_key}
                    className={r.is_resort ? 'bg-success/10 hover:bg-success/10' : 'hover:bg-muted'}
                  >
                    <TableCell className="whitespace-nowrap text-sm text-foreground">{r.city}</TableCell>
                    <TableCell className="text-sm text-foreground">{r.subdivision}</TableCell>
                    <TableCell>
                      <ResortCommunityToggle entityKey={r.entity_key} initialResort={r.is_resort} />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </section>
      <p className="mt-4 text-xs text-muted-foreground">
        Rows with a green tint are currently treated as resort & master plan communities on the site. Toggle off to remove that treatment; toggle on to add it (and backfill hero + content if needed).
      </p>
    </main>
  )
}
