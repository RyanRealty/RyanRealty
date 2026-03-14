import type { DashboardLeadData } from '@/app/actions/dashboard'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

function formatTime(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  } catch {
    return iso
  }
}

type Props = { data: DashboardLeadData }

export default function DashboardLeadPanel({ data }: Props) {
  const rate = data.totalVisits > 0 ? ((data.visitsWithUser / data.totalVisits) * 100).toFixed(1) : '0'
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg bg-muted p-3">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Total visits</p>
          <p className="mt-1 text-xl font-semibold text-foreground">{data.totalVisits.toLocaleString()}</p>
        </div>
        <div className="rounded-lg bg-muted p-3">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Identified sessions</p>
          <p className="mt-1 text-xl font-semibold text-success">{data.visitsWithUser.toLocaleString()}</p>
        </div>
        <div className="rounded-lg bg-muted p-3">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Identification rate</p>
          <p className="mt-1 text-xl font-semibold text-foreground">{rate}%</p>
        </div>
        <div className="rounded-lg bg-muted p-3">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Visits (24h)</p>
          <p className="mt-1 text-xl font-semibold text-foreground">{data.visitsLast24h.toLocaleString()}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{data.visitsWithUserLast24h} identified</p>
        </div>
      </div>
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground">Recent activity (last 50)</h3>
        {data.recentVisits.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No visits yet.</p>
        ) : (
          <div className="mt-2 max-h-64 overflow-y-auto">
            <Table className="min-w-full border-collapse text-sm">
              <TableHeader className="sticky top-0 bg-muted">
                <TableRow className="border-b border-border">
                  <TableHead className="py-1.5 pr-3 text-left font-medium text-muted-foreground">Time</TableHead>
                  <TableHead className="py-1.5 pr-3 text-left font-medium text-muted-foreground">Path</TableHead>
                  <TableHead className="py-1.5 pl-3 text-left font-medium text-muted-foreground">User</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.recentVisits.map((v) => (
                  <TableRow key={v.visit_id + v.created_at} className="border-b border-border">
                    <TableCell className="py-1.5 pr-3 text-muted-foreground whitespace-nowrap">{formatTime(v.created_at)}</TableCell>
                    <TableCell className="py-1.5 pr-3 font-mono text-foreground truncate max-w-[200px]" title={v.path}>{v.path}</TableCell>
                    <TableCell className="py-1.5 pl-3 text-muted-foreground">{v.user_id ? 'Yes' : '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
      <p className="text-sm text-muted-foreground">Hot leads and engagement scoring require FUB API or a contacts table. GA4 panel will show acquisition and conversion funnel.</p>
    </div>
  )
}
