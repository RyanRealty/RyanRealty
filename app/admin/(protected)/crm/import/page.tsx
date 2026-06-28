// @no-parity — internal admin surface, no public mockup contract
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import Link from 'next/link'
import { getCrmAccess } from '@/app/actions/crm'
import { listImportJobsAction } from '@/app/actions/crm-import'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

export const metadata = { title: 'Import contacts | CRM' }
export const dynamic = 'force-dynamic'

function statusVariant(s: string): 'default' | 'outline' | 'secondary' | 'destructive' {
  if (s === 'done') return 'default'
  if (s === 'running') return 'secondary'
  if (s === 'error') return 'destructive'
  return 'outline'
}

function fmtDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  })
}

export default async function ImportListPage() {
  const access = await getCrmAccess()
  if (!access) redirect('/admin/access-denied')
  if (access.role !== 'superuser') redirect('/admin/access-denied')

  const result = await listImportJobsAction()
  const jobs = result.ok ? result.data : []

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-3 md:items-end">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Import contacts</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Upload a CSV to add or update contacts in the CRM. Existing contacts matched
            by email are updated; new contacts are inserted.
          </p>
        </div>
        <Link href="/admin/crm/import/new">
          <Button className="shrink-0">Start import</Button>
        </Link>
      </div>

      <div className="mt-8">
        <h2 className="text-sm font-semibold text-foreground mb-3">Past imports</h2>
        {jobs.length === 0 ? (
          <div className="rounded-xl border border-border bg-card px-6 py-10 text-center text-sm text-muted-foreground">
            No imports yet. Upload a CSV to get started.
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="hidden w-12 md:table-cell">#</TableHead>
                  <TableHead>Started</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden text-right md:table-cell">Rows</TableHead>
                  <TableHead className="hidden text-right md:table-cell">Imported</TableHead>
                  <TableHead className="hidden text-right md:table-cell">Skipped</TableHead>
                  <TableHead className="hidden text-right md:table-cell">Errors</TableHead>
                  <TableHead className="hidden md:table-cell">Finished</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs.map((job) => (
                  <TableRow key={job.id}>
                    <TableCell className="hidden font-mono text-xs text-muted-foreground md:table-cell">{job.id}</TableCell>
                    <TableCell className="text-sm">{fmtDate(job.startedAt)}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(job.status)} className="text-xs capitalize">
                        {job.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden text-right text-sm md:table-cell">{job.rowCount ?? '—'}</TableCell>
                    <TableCell className="hidden text-right text-sm text-success md:table-cell">{job.counts.imported}</TableCell>
                    <TableCell className="hidden text-right text-sm text-muted-foreground md:table-cell">{job.counts.skipped}</TableCell>
                    <TableCell className="hidden text-right text-sm text-destructive md:table-cell">{job.counts.errors}</TableCell>
                    <TableCell className="hidden text-sm text-muted-foreground md:table-cell">{fmtDate(job.finishedAt)}</TableCell>
                    <TableCell>
                      <Link href={`/admin/crm/import/${job.id}`}>
                        <Button variant="ghost" size="sm" className="text-xs h-7">
                          Details
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </main>
  )
}
