// @no-parity — internal admin tool, no public mockup contract.
/**
 * /admin/bpo — Broker Price Opinion index. Every BPO built for any property,
 * newest first, with its opinion of value, confidence, subject status, and
 * lifecycle status. "New broker price opinion" opens the build form.
 */

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getSession } from '@/app/actions/auth'
import { getAdminRoleForEmail } from '@/app/actions/admin-roles'
import { listBposForAdmin } from '@/lib/data/bpo/reads'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ConsoleSection } from '@/components/console/ConsoleSection'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatPriceExact } from '@/lib/format/money'
import { formatDate } from '@/lib/format/date'
import { cn } from '@/lib/utils'

export const dynamic = 'force-dynamic'

const usd = formatPriceExact

function statusVariant(status: string) {
  return status === 'final' ? ('default' as const) : ('outline' as const)
}

export default async function AdminBpoIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  const session = await getSession()
  const adminRole = await getAdminRoleForEmail(session?.user?.email ?? null)
  if (!adminRole) redirect('/admin/access-denied')
  if (adminRole.role === 'report_viewer') redirect('/admin/access-denied')

  const sp = await searchParams
  const page = Math.max(1, Number(sp.page) || 1)
  const limit = 25
  const { rows, total } = await listBposForAdmin({ limit, offset: (page - 1) * limit })
  const pageCount = Math.max(1, Math.ceil(total / limit))

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-foreground">Broker price opinions</h1>
          <p className="text-sm text-muted-foreground">
            Our opinion of value for any home, weighing comps, market conditions, and the property&rsquo;s full listing
            history. {total} on file.
          </p>
        </div>
        <Button asChild className="min-h-11">
          <Link href="/admin/bpo/new">New broker price opinion</Link>
        </Button>
      </header>

      <ConsoleSection title="Opinions" count={`${total} total`}>
        {rows.length === 0 ? (
          <p className="px-2 py-8 text-center text-sm text-muted-foreground">
            No broker price opinions yet. Build the first one.
          </p>
        ) : (
          <div className="no-scrollbar overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Property</TableHead>
                  <TableHead className="text-right">Opinion</TableHead>
                  <TableHead className="text-right">Range</TableHead>
                  <TableHead>Confidence</TableHead>
                  <TableHead>Listing</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Built</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => {
                  const slug = String(r.slug)
                  const status = String(r.status ?? 'draft')
                  const buildError = (r.build_error as string | null) ?? null
                  return (
                    <TableRow key={slug} className="cursor-default">
                      <TableCell>
                        <Link href={`/admin/bpo/${slug}`} className="font-medium text-foreground hover:underline">
                          {String(r.subject_address ?? slug)}
                        </Link>
                        <div className="text-xs text-muted-foreground">
                          {r.subject_subdivision ? `${String(r.subject_subdivision)} · ` : ''}
                          {String(r.subject_city ?? '')}
                          {r.purpose ? ` · ${String(r.purpose)}` : ''}
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {usd((r.opinion_value as number | null) ?? null)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {usd((r.value_low as number | null) ?? null)} – {usd((r.value_high as number | null) ?? null)}
                      </TableCell>
                      <TableCell className="text-sm">{String(r.confidence ?? '—')}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{String(r.subject_status ?? '—')}</TableCell>
                      <TableCell>
                        {buildError ? (
                          <Badge variant="outline" className="border-destructive text-destructive">
                            Build error
                          </Badge>
                        ) : (
                          <Badge variant={statusVariant(status)} className="capitalize">
                            {status}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground tabular-nums">
                        {formatDate((r.built_at as string | null) ?? (r.created_at as string | null))}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}

        {pageCount > 1 ? (
          <div className="mt-4 flex items-center justify-between gap-2">
            <Button asChild variant="outline" size="sm" disabled={page <= 1} className={cn(page <= 1 && 'pointer-events-none opacity-50')}>
              <Link href={`/admin/bpo?page=${page - 1}`}>Previous</Link>
            </Button>
            <span className="text-xs text-muted-foreground">
              Page {page} of {pageCount}
            </span>
            <Button asChild variant="outline" size="sm" disabled={page >= pageCount} className={cn(page >= pageCount && 'pointer-events-none opacity-50')}>
              <Link href={`/admin/bpo?page=${page + 1}`}>Next</Link>
            </Button>
          </div>
        ) : null}
      </ConsoleSection>
    </div>
  )
}
