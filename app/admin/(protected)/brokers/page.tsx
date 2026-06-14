import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getSession } from '@/app/actions/auth'
import { getAdminRoleForEmail } from '@/app/actions/admin-roles'
import { getBrokerById, getBrokersForAdmin } from '@/app/actions/brokers'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

export const dynamic = 'force-dynamic'

export default async function AdminBrokersPage() {
  const session = await getSession()
  const adminRole = await getAdminRoleForEmail(session?.user?.email ?? null)
  if (!adminRole) redirect('/admin/access-denied')
  if (adminRole.role === 'report_viewer') redirect('/admin/access-denied')
  if (adminRole.role === 'broker' && !adminRole.brokerId) redirect('/admin/access-denied')

  const ownBroker = adminRole.role === 'broker' && adminRole.brokerId
    ? await getBrokerById(adminRole.brokerId)
    : null
  const brokers = ownBroker ? [ownBroker] : await getBrokersForAdmin()

  return (
    <main className="mx-auto max-w-[1600px] px-4 py-8 sm:px-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-foreground">Brokers</h1>
        {adminRole.role === 'superuser' && (
          <Button asChild>
            <Link href="/admin/brokers/new">Add broker</Link>
          </Button>
        )}
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        Team members appear on the public <Link href="/team" className="text-success hover:underline">/team</Link> page. Required: display name, title, Oregon license number.
      </p>
      {/* Broker cards — phones (one card per broker) */}
      <div className="mt-6 space-y-2 md:hidden">
        {brokers.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              No brokers yet. Tap &quot;Add broker&quot; to create one (required: display name, slug, title, Oregon license number).
            </CardContent>
          </Card>
        ) : (
          brokers.map((b) => (
            <Card key={b.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-foreground">{b.display_name}</div>
                    <div className="mt-0.5 truncate text-xs text-muted-foreground">{b.title}</div>
                    <div className="mt-0.5 truncate text-xs text-muted-foreground">{b.slug}</div>
                  </div>
                  {b.is_active ? (
                    <Badge variant="secondary" className="shrink-0">Active</Badge>
                  ) : (
                    <Badge variant="outline" className="shrink-0">Inactive</Badge>
                  )}
                </div>
                <div className="mt-3 flex items-center gap-4">
                  <Link href={`/admin/brokers/edit?id=${encodeURIComponent(b.id)}`} className="text-sm font-medium text-success hover:underline">
                    Edit
                  </Link>
                  {b.is_active && (
                    <Link href={`/team/${b.slug}`} className="text-sm font-medium text-muted-foreground hover:text-foreground" target="_blank" rel="noopener">
                      View profile
                    </Link>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Broker table — desktop */}
      <div className="mt-6 hidden overflow-hidden rounded-lg border border-border bg-card md:block">
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
                    <Link href={`/admin/brokers/edit?id=${encodeURIComponent(b.id)}`} className="text-sm font-medium text-muted-foreground hover:text-foreground">
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
