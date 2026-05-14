import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getSession } from '@/app/actions/auth'
import { getAdminRoleForEmail } from '@/app/actions/admin-roles'
import { createServiceClient } from '@/lib/supabase/service'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('cmas')
    .select('id, slug, subject_address, subject_subdivision, client_name, broker_slug, value_low, value_high, recommended_list, comps_count, status, created_at, finalized_at, html_path')
    .order('created_at', { ascending: false })

  const rows = (data ?? []) as CmaRow[]

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
          Failed to load: {error.message}
        </div>
      ) : null}

      <div className="mt-6 overflow-hidden rounded-lg border border-border bg-card">
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
