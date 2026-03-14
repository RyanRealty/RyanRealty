import Link from 'next/link'
import { getBrokersForAdmin } from '@/app/actions/brokers'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

export const dynamic = 'force-dynamic'

export default async function AdminBrokersPage() {
  const brokers = await getBrokersForAdmin()

  return (
    <main className="mx-auto max-w-[1600px] px-4 py-8 sm:px-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-foreground">Brokers</h1>
        <Button asChild>
          <Link href="/admin/brokers/new">Add broker</Link>
        </Button>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        Team members appear on the public <Link href="/team" className="text-success hover:underline">/team</Link> page. Required: display name, title, Oregon license number.
      </p>
      <div className="mt-6 overflow-hidden rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs font-medium uppercase text-muted-foreground">Name</TableHead>
              <TableHead className="text-xs font-medium uppercase text-muted-foreground">Title</TableHead>
              <TableHead className="text-xs font-medium uppercase text-muted-foreground">Slug</TableHead>
              <TableHead className="text-xs font-medium uppercase text-muted-foreground">Status</TableHead>
              <TableHead className="text-xs font-medium uppercase text-muted-foreground">Profile</TableHead>
              <TableHead className="text-xs font-medium uppercase text-muted-foreground">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {brokers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">
                  No brokers yet. Click &quot;Add broker&quot; to create one (required: display name, slug, title, Oregon license number).
                </TableCell>
              </TableRow>
            ) : (
              brokers.map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="text-sm font-medium text-foreground">{b.display_name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{b.title}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{b.slug}</TableCell>
                  <TableCell>
                    {b.is_active ? (
                      <Badge variant="secondary">Active</Badge>
                    ) : (
                      <Badge variant="outline">Inactive</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {b.is_active && (
                      <Link href={`/team/${b.slug}`} className="text-sm text-success hover:underline" target="_blank" rel="noopener">
                        View
                      </Link>
                    )}
                  </TableCell>
                  <TableCell>
                    <Link href={`/admin/brokers/${b.id}`} className="text-sm font-medium text-muted-foreground hover:text-foreground">
                      Edit
                    </Link>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </main>
  )
}
