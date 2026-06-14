import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getSession } from '@/app/actions/auth'
import { getAdminRoleForEmail } from '@/app/actions/admin-roles'
import { getBrokerById, getBrokersForAdmin } from '@/app/actions/brokers'
import { diagnoseBrokerAttribution } from '@/lib/followupboss'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import FubBrokerMapCopyCard from '@/app/components/admin/FubBrokerMapCopyCard'

export const dynamic = 'force-dynamic'

type Row = {
  id: string
  displayName: string
  slug: string
  email: string | null
  assignedUserId: number | null
  source: 'env_map' | 'email_lookup' | 'none'
  mappedUserId: number | null
  emailUsed: string | null
  tag: string
}

export default async function AdminFubAttributionPage() {
  const session = await getSession()
  const adminRole = await getAdminRoleForEmail(session?.user?.email ?? null)
  if (!adminRole) redirect('/admin/access-denied')
  if (adminRole.role === 'report_viewer') redirect('/admin/access-denied')
  if (adminRole.role === 'broker' && !adminRole.brokerId) redirect('/admin/access-denied')

  const ownBroker =
    adminRole.role === 'broker' && adminRole.brokerId ? await getBrokerById(adminRole.brokerId) : null
  const brokers = ownBroker ? [ownBroker] : await getBrokersForAdmin()

  const rows: Row[] = await Promise.all(
    brokers.map(async (broker) => {
      const diag = await diagnoseBrokerAttribution({
        brokerSlug: broker.slug,
        brokerEmail: broker.email,
      })
      return {
        id: broker.id,
        displayName: broker.display_name,
        slug: broker.slug,
        email: broker.email?.trim() || null,
        assignedUserId: diag.resolvedAssignedUserId,
        source: diag.resolutionSource,
        mappedUserId: diag.mappedUserId,
        emailUsed: diag.brokerEmailUsed,
        tag: diag.brokerTag,
      }
    })
  )
  const mapEntries = rows
    .filter((row) => row.assignedUserId != null && row.assignedUserId > 0)
    .map((row) => `${row.slug}:${row.assignedUserId}`)
    .join(',')
  const envLine = `FOLLOWUPBOSS_BROKER_USER_MAP=${mapEntries}`
  const missingSlugs = rows
    .filter((row) => row.assignedUserId == null || row.assignedUserId <= 0)
    .map((row) => row.slug)
  const guardrailEnabled = ['1', 'true', 'yes', 'on'].includes(
    (process.env.FOLLOWUPBOSS_REQUIRE_BROKER_ASSIGNMENT ?? '').trim().toLowerCase()
  )

  return (
    <main className="mx-auto max-w-[1600px] space-y-6 px-4 py-8 sm:px-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">FUB Broker Attribution</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Validation view for broker assignment in Follow Up Boss. Broker CTA and inquiry events apply
          assignment and merge the broker tag after the event is sent.
        </p>
      </div>

      {guardrailEnabled && missingSlugs.length > 0 ? (
        <Alert variant="destructive">
          <AlertTitle>Guardrail active and mapping required</AlertTitle>
          <AlertDescription>
            Guardrail mode is enabled and {missingSlugs.length} broker {missingSlugs.length === 1 ? 'is' : 'are'} unmapped.
            To fix: 1) Use the Copy Env Map card below to copy your line, 2) add missing <code>slug:userId</code> pairs for {missingSlugs.join(', ')}, 3) set it in your env and restart.
          </AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Resolution Rules</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            1) Use <code>FOLLOWUPBOSS_BROKER_USER_MAP</code> when present.
          </p>
          <p>
            2) Otherwise use broker email to resolve a FUB user.
          </p>
          <p>
            3) Always merge tag <code>broker:slug</code>.
          </p>
          <p>
            Guardrail mode:{' '}
            {guardrailEnabled ? (
              <Badge variant="secondary">enabled</Badge>
            ) : (
              <Badge variant="outline">warn only</Badge>
            )}
          </p>
        </CardContent>
      </Card>

      <FubBrokerMapCopyCard envLine={envLine} missingSlugs={missingSlugs} />

      {/* Broker cards — phones (one entity per card, key facts + edit action) */}
      <div className="space-y-2 md:hidden">
        {rows.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">No brokers found.</CardContent>
          </Card>
        ) : (
          rows.map((row) => {
            const hasAssignment = row.assignedUserId != null && row.assignedUserId > 0
            return (
              <Card key={row.id}>
                <CardContent className="space-y-2 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate font-medium text-foreground">{row.displayName}</div>
                      <div className="truncate text-xs text-muted-foreground">{row.slug}</div>
                    </div>
                    {hasAssignment ? (
                      <Badge variant="secondary" className="shrink-0">Ready</Badge>
                    ) : (
                      <Badge variant="outline" className="shrink-0">Needs mapping</Badge>
                    )}
                  </div>
                  <dl className="space-y-1 text-sm">
                    <div className="flex justify-between gap-2">
                      <dt className="text-muted-foreground">Email</dt>
                      <dd className="truncate text-right text-foreground">{row.email ?? '-'}</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-muted-foreground">Assigned user</dt>
                      <dd className="text-right tabular-nums text-foreground">{hasAssignment ? row.assignedUserId : '-'}</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-muted-foreground">Source</dt>
                      <dd className="text-right">
                        {row.source === 'env_map' && <Badge variant="secondary">env map</Badge>}
                        {row.source === 'email_lookup' && <Badge variant="outline">email lookup</Badge>}
                        {row.source === 'none' && <Badge variant="outline">none</Badge>}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-muted-foreground">Tag</dt>
                      <dd className="truncate text-right text-foreground">{row.tag}</dd>
                    </div>
                  </dl>
                  <Link
                    href={`/admin/brokers/edit?id=${encodeURIComponent(row.id)}`}
                    className="inline-flex text-sm text-success hover:underline"
                  >
                    Edit broker
                  </Link>
                </CardContent>
              </Card>
            )
          })
        )}
      </div>

      {/* Broker table — desktop */}
      <div className="hidden overflow-hidden rounded-lg border border-border bg-card md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Broker</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Assigned User</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Tag</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-8 text-center text-sm text-muted-foreground">
                  No brokers found.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => {
                const hasAssignment = row.assignedUserId != null && row.assignedUserId > 0
                return (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium text-foreground">{row.displayName}</TableCell>
                    <TableCell className="text-muted-foreground">{row.slug}</TableCell>
                    <TableCell className="text-muted-foreground">{row.email ?? '-'}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {hasAssignment ? row.assignedUserId : '-'}
                    </TableCell>
                    <TableCell>
                      {row.source === 'env_map' && <Badge variant="secondary">env map</Badge>}
                      {row.source === 'email_lookup' && <Badge variant="outline">email lookup</Badge>}
                      {row.source === 'none' && <Badge variant="outline">none</Badge>}
                      {row.source === 'env_map' && row.mappedUserId ? (
                        <p className="mt-1 text-xs text-muted-foreground">mapped id: {row.mappedUserId}</p>
                      ) : null}
                      {row.source !== 'env_map' && row.emailUsed ? (
                        <p className="mt-1 text-xs text-muted-foreground">email: {row.emailUsed}</p>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{row.tag}</TableCell>
                    <TableCell>
                      {hasAssignment ? (
                        <Badge variant="secondary">Ready</Badge>
                      ) : (
                        <Badge variant="outline">Needs mapping</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Link href={`/admin/brokers/edit?id=${encodeURIComponent(row.id)}`} className="text-sm text-success hover:underline">
                        Edit broker
                      </Link>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>
    </main>
  )
}
