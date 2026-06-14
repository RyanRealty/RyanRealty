import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getSession } from '@/app/actions/auth'
import { getAdminRoleForEmail } from '@/app/actions/admin-roles'
import { createServiceClient } from '@/lib/supabase/service'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

export const dynamic = 'force-dynamic'

interface CmaRow {
  id: string
  slug: string
  subject_address: string
  subject_subdivision: string | null
  client_name: string | null
  broker_slug: string | null
  value_low: number | null
  value_high: number | null
  recommended_list: number | null
  comps_count: number | null
  status: 'draft' | 'finalized' | 'delivered' | 'archived'
  created_at: string
  finalized_at: string | null
  html_path: string
}

function formatPrice(n: number | null): string {
  if (n == null) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function statusVariant(status: CmaRow['status']) {
  switch (status) {
    case 'finalized':
      return 'default' as const
    case 'delivered':
      return 'secondary' as const
    case 'archived':
      return 'outline' as const
    case 'draft':
    default:
      return 'outline' as const
  }
}

export default async function AdminCmasPage() {
  const session = await getSession()
  const adminRole = await getAdminRoleForEmail(session?.user?.email ?? null)
  if (!adminRole) redirect('/admin/access-denied')
  if (adminRole.role === 'report_viewer') redirect('/admin/access-denied')

  void createServiceClient
  const { listCmasForAdmin } = await import('@/lib/data')
  const { rows: rawRows } = await listCmasForAdmin({ limit: 5000, offset: 0 })
  const rows = rawRows as unknown as CmaRow[]
  const error: { message: string } | null = null

  return (
    <main className="mx-auto max-w-[1600px] px-4 py-8 sm:px-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-foreground">Comparative Market Analyses</h1>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        Every CMA we&apos;ve built — drafts in progress and finalized deliverables. Click a row to open the PDF.
        New CMAs are created by the brain producer at <code className="rounded bg-muted px-1.5 py-0.5 text-xs">marketing_brain_skills/producers/cma/</code>.
      </p>

      {error ? (
        <div className="mt-6 rounded-lg border border-destructive bg-destructive/10 p-4 text-sm text-destructive">
          Failed to load CMAs
        </div>
      ) : null}

      {/* CMA cards — phones (one thumb-tap per CMA) */}
      <div className="mt-6 space-y-2 md:hidden">
        {rows.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">No CMAs yet.</CardContent>
          </Card>
        ) : (
          rows.map((cma) => (
            <Card key={cma.id} className="transition-colors hover:bg-muted/50">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-foreground">{cma.subject_address}</div>
                    {cma.subject_subdivision ? (
                      <div className="truncate text-xs text-muted-foreground">{cma.subject_subdivision}</div>
                    ) : null}
                  </div>
                  <Badge variant={statusVariant(cma.status)} className="shrink-0">{cma.status}</Badge>
                </div>
                <div className="mt-2 flex items-baseline justify-between gap-2 text-sm">
                  <span className="text-muted-foreground">Rec. list</span>
                  <span className="font-semibold tabular-nums text-foreground">{formatPrice(cma.recommended_list)}</span>
                </div>
                <div className="mt-1 flex items-baseline justify-between gap-2 text-xs text-muted-foreground">
                  <span>Range</span>
                  <span className="tabular-nums">{formatPrice(cma.value_low)} – {formatPrice(cma.value_high)}</span>
                </div>
                <div className="mt-1 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span className="truncate">{cma.client_name ?? '—'}{cma.broker_slug ? ` · ${cma.broker_slug}` : ''}</span>
                  <span className="shrink-0 tabular-nums">{formatDate(cma.created_at)}</span>
                </div>
                <div className="mt-3 flex gap-2">
                  <Button asChild size="sm" variant="outline" className="h-10 flex-1">
                    <Link href={`/api/cma/${cma.slug}/pdf`} target="_blank" rel="noopener noreferrer">
                      PDF
                    </Link>
                  </Button>
                  <Button asChild size="sm" variant="ghost" className="h-10 flex-1">
                    <Link
                      href={cma.status === 'finalized' ? `/cmas/${cma.slug}/cma.html` : `/drafts/${cma.slug}/cma.html`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      HTML
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* CMA table — desktop */}
      <div className="mt-6 hidden overflow-hidden rounded-lg border border-border bg-card md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Subject</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Broker</TableHead>
              <TableHead className="text-right">Rec. List</TableHead>
              <TableHead className="text-right">Range</TableHead>
              <TableHead className="text-right">Comps</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Finalized</TableHead>
              <TableHead className="text-right">Open</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center text-sm text-muted-foreground">
                  No CMAs yet.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((cma) => (
                <TableRow key={cma.id}>
                  <TableCell>
                    <div className="font-medium">{cma.subject_address}</div>
                    {cma.subject_subdivision ? (
                      <div className="text-xs text-muted-foreground">{cma.subject_subdivision}</div>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-sm">{cma.client_name ?? '—'}</TableCell>
                  <TableCell className="text-sm">{cma.broker_slug ?? '—'}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatPrice(cma.recommended_list)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-xs text-muted-foreground">
                    {formatPrice(cma.value_low)} – {formatPrice(cma.value_high)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{cma.comps_count ?? '—'}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(cma.status)}>{cma.status}</Badge>
                  </TableCell>
                  <TableCell className="text-sm">{formatDate(cma.created_at)}</TableCell>
                  <TableCell className="text-sm">{formatDate(cma.finalized_at)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/api/cma/${cma.slug}/pdf`} target="_blank" rel="noopener noreferrer">
                          PDF
                        </Link>
                      </Button>
                      <Button asChild size="sm" variant="ghost">
                        <Link
                          href={cma.status === 'finalized' ? `/cmas/${cma.slug}/cma.html` : `/drafts/${cma.slug}/cma.html`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          HTML
                        </Link>
                      </Button>
                    </div>
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
