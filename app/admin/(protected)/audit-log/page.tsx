import { getAdminActions, type AdminActionRow } from '@/app/actions/admin-audit'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 25

/** Pure presentational helpers — no data access, no business logic. */
function relativeTime(iso: string): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return '—'
  const diffSec = Math.round((Date.now() - then) / 1000)
  if (diffSec < 60) return 'just now'
  const diffMin = Math.round(diffSec / 60)
  if (diffMin < 60) return `${diffMin} min ago`
  const diffHr = Math.round(diffMin / 60)
  if (diffHr < 24) return `${diffHr} hr ago`
  const diffDay = Math.round(diffHr / 24)
  if (diffDay < 30) return `${diffDay} days ago`
  return new Date(iso).toLocaleDateString()
}

function exactTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString()
}

/** Map an action verb to a color-as-signal badge variant. */
function actionVariant(
  actionType: string
): 'success' | 'default' | 'destructive' | 'soft-neutral' {
  const a = actionType.toLowerCase()
  if (a.includes('delete') || a.includes('remove') || a.includes('revoke'))
    return 'destructive'
  if (a.includes('create') || a.includes('add') || a.includes('approve'))
    return 'success'
  if (a.includes('update') || a.includes('edit') || a.includes('change'))
    return 'default'
  return 'soft-neutral'
}

function SummaryStat({ label, value }: { label: string; value: number | string }) {
  return (
    <Card size="sm" className="shrink-0">
      <CardContent className="px-4 py-3">
        <div className="text-xl font-bold tabular-nums text-foreground">{value}</div>
        <div className="text-xs text-muted-foreground">{label}</div>
      </CardContent>
    </Card>
  )
}

function EmptyState({ filtered }: { filtered: boolean }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
        <p className="text-base font-medium text-foreground">
          {filtered ? 'No matching actions' : 'No actions recorded yet'}
        </p>
        <p className="max-w-sm text-sm text-muted-foreground">
          {filtered
            ? 'Try a different admin email or action type, or clear the filters.'
            : 'Admin changes (create, update, delete) appear here as your team works. Nothing has been logged so far.'}
        </p>
        {filtered && (
          <Button asChild variant="outline" size="sm" className="mt-2">
            <Link href="/admin/audit-log">Clear filters</Link>
          </Button>
        )}
      </CardContent>
    </Card>
  )
}

export default async function AdminAuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; admin?: string; action?: string }>
}) {
  const { page, admin, action } = await searchParams
  const pageNum = Math.max(0, parseInt(String(page), 10) || 0)
  const adminEmail = admin?.trim() || null
  const actionType = action?.trim() || null
  const filtered = Boolean(adminEmail || actionType)

  // Fetch one extra row to know whether a next page exists, without a count query.
  const fetched = await getAdminActions({
    limit: PAGE_SIZE + 1,
    offset: pageNum * PAGE_SIZE,
    adminEmail,
    actionType,
  })
  const hasNext = fetched.length > PAGE_SIZE
  const rows: AdminActionRow[] = fetched.slice(0, PAGE_SIZE)

  // Glanceable summary, derived from the current page only (presentational).
  const distinctAdmins = new Set(rows.map((r) => r.admin_email)).size
  const createCount = rows.filter((r) => actionVariant(r.action_type) === 'success').length
  const deleteCount = rows.filter((r) => actionVariant(r.action_type) === 'destructive').length

  const filterQuery = (overrides: Record<string, string | number | undefined>) => {
    const params = new URLSearchParams()
    const merged = { admin: adminEmail ?? undefined, action: actionType ?? undefined, ...overrides }
    for (const [k, v] of Object.entries(merged)) {
      if (v !== undefined && v !== '' && v !== null) params.set(k, String(v))
    }
    const qs = params.toString()
    return qs ? `?${qs}` : ''
  }

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-2xl font-bold text-foreground">Audit log</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Recent admin actions across the team — create, update, and delete events.
      </p>

      {/* Glanceable summary */}
      {rows.length > 0 && (
        <div className="mt-5 flex gap-3 overflow-x-auto pb-1">
          <SummaryStat label="On this page" value={rows.length} />
          <SummaryStat label="Admins" value={distinctAdmins} />
          <SummaryStat label="Creates / approvals" value={createCount} />
          <SummaryStat label="Deletes / revokes" value={deleteCount} />
        </div>
      )}

      {/* Filter affordance */}
      <form method="get" className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <Input
          type="text"
          name="admin"
          defaultValue={adminEmail ?? ''}
          placeholder="Filter by admin email"
          aria-label="Filter by admin email"
          className="h-11 sm:w-64"
        />
        <Input
          type="text"
          name="action"
          defaultValue={actionType ?? ''}
          placeholder="Filter by action type"
          aria-label="Filter by action type"
          className="h-11 sm:w-56"
        />
        <div className="flex gap-2">
          <Button type="submit" variant="outline" className="h-11 flex-1 sm:flex-none">
            Filter
          </Button>
          {filtered && (
            <Button asChild variant="ghost" className="h-11 flex-1 sm:flex-none">
              <Link href="/admin/audit-log">Clear</Link>
            </Button>
          )}
        </div>
      </form>

      {rows.length === 0 ? (
        <div className="mt-5">
          <EmptyState filtered={filtered} />
        </div>
      ) : (
        <>
          {/* Mobile: stacked entry cards (no horizontal table on phones) */}
          <ul className="mt-5 space-y-3 md:hidden">
            {rows.map((row) => (
              <li key={row.id}>
                <Card size="sm">
                  <CardContent className="flex flex-col gap-2 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <Badge variant={actionVariant(row.action_type)} className="max-w-full truncate">
                        {row.action_type}
                      </Badge>
                      <time
                        className="shrink-0 text-xs tabular-nums text-muted-foreground"
                        dateTime={row.created_at}
                        title={exactTime(row.created_at)}
                      >
                        {relativeTime(row.created_at)}
                      </time>
                    </div>
                    <div className="text-sm font-medium text-foreground">
                      {row.resource_type ?? 'Resource'}
                      {row.resource_id ? (
                        <span className="ml-1 font-normal text-muted-foreground">
                          · {row.resource_id}
                        </span>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="truncate">{row.admin_email}</span>
                      {row.role ? (
                        <Badge variant="soft-neutral" className="shrink-0">
                          {row.role}
                        </Badge>
                      ) : null}
                    </div>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>

          {/* Desktop: full table (unchanged register) */}
          <div className="mt-5 hidden overflow-x-auto rounded-xl border border-border bg-card md:block">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted">
                  <TableHead className="text-foreground">Time</TableHead>
                  <TableHead className="text-foreground">Admin</TableHead>
                  <TableHead className="text-foreground">Role</TableHead>
                  <TableHead className="text-foreground">Action</TableHead>
                  <TableHead className="text-foreground">Resource</TableHead>
                  <TableHead className="text-foreground">ID</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="whitespace-nowrap tabular-nums text-muted-foreground">
                      {exactTime(row.created_at)}
                    </TableCell>
                    <TableCell className="font-medium text-foreground">{row.admin_email}</TableCell>
                    <TableCell className="text-muted-foreground">{row.role ?? '—'}</TableCell>
                    <TableCell>
                      <Badge variant={actionVariant(row.action_type)}>{row.action_type}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{row.resource_type ?? '—'}</TableCell>
                    <TableCell className="text-muted-foreground">{row.resource_id ?? '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          <nav className="mt-5 flex items-center justify-between gap-3">
            {pageNum > 0 ? (
              <Button asChild variant="outline" className="h-11">
                <Link href={`/admin/audit-log${filterQuery({ page: pageNum - 1 || undefined })}`}>
                  Previous
                </Link>
              </Button>
            ) : (
              <Button variant="outline" className="h-11" disabled>
                Previous
              </Button>
            )}
            <span className="text-sm tabular-nums text-muted-foreground">Page {pageNum + 1}</span>
            {hasNext ? (
              <Button asChild variant="outline" className="h-11">
                <Link href={`/admin/audit-log${filterQuery({ page: pageNum + 1 })}`}>Next</Link>
              </Button>
            ) : (
              <Button variant="outline" className="h-11" disabled>
                Next
              </Button>
            )}
          </nav>
        </>
      )}

      <p className="mt-6 text-sm">
        <Link
          href="/admin"
          className="text-muted-foreground underline-offset-4 hover:underline"
        >
          Back to Dashboard
        </Link>
      </p>
    </div>
  )
}
