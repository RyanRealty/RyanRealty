/**
 * DashboardActivityTable — the FUB desktop dashboard "Recent Activity" table.
 * Columns, in FUB order: Name · Email · Phone · Last Activity · Time · Stage ·
 * Assigned. Desktop only (the dashboard shows the mobile feed below lg).
 */
import Link from 'next/link'
import { Mail, MessageSquare, Phone, Eye, FileText, CheckSquare, Voicemail, UserPlus } from 'lucide-react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { CRM_BROKER_DISPLAY } from '@/lib/crm/constants'
import { cleanContactName } from '@/lib/crm/display-name'
import type { DashboardActivityRow } from '@/lib/data/crm/getDashboardRecentActivity'

function relativeDays(iso: string | null): string {
  if (!iso) return '—'
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  if (diff <= 0) {
    const hrs = Math.floor((Date.now() - new Date(iso).getTime()) / 3_600_000)
    if (hrs <= 0) return 'Just now'
    return `${hrs}h ago`
  }
  if (diff === 1) return '1 day ago'
  return `${diff} days ago`
}

/** Last-activity icon + label from the timeline event kind/title (FUB phrasing). */
function activity(kind: string | null, title: string | null): { Icon: typeof Mail; label: string } {
  const t = (title ?? '').trim()
  switch (kind) {
    case 'email_open': return { Icon: Mail, label: t ? `Opened Email · ${t}` : 'Opened Email' }
    case 'email_out': return { Icon: Mail, label: t || 'Sent Email' }
    case 'email_in': return { Icon: Mail, label: t || 'Received Email' }
    case 'email_click': return { Icon: Mail, label: t ? `Clicked · ${t}` : 'Clicked Email link' }
    case 'sms_out': return { Icon: MessageSquare, label: 'Text sent' }
    case 'sms_in': return { Icon: MessageSquare, label: 'Text received' }
    case 'call': return { Icon: Phone, label: t || 'Call' }
    case 'voicemail': return { Icon: Voicemail, label: 'Voicemail' }
    case 'web_event': return { Icon: Eye, label: t ? `Viewed ${t}` : 'Website visit' }
    case 'lead_created': return { Icon: UserPlus, label: 'Inquiry' }
    case 'note': return { Icon: FileText, label: t || 'Note' }
    case 'task': return { Icon: CheckSquare, label: t || 'Task' }
    default: return { Icon: FileText, label: t || (kind ? kind.replace(/_/g, ' ') : 'Activity') }
  }
}

function fmtPhone(d: string): string {
  const x = String(d).replace(/\D/g, '').slice(-10)
  return x.length === 10 ? `(${x.slice(0, 3)}) ${x.slice(3, 6)}-${x.slice(6)}` : d
}

export function DashboardActivityTable({ rows }: { rows: DashboardActivityRow[] }) {
  if (rows.length === 0) {
    return <p className="px-4 py-10 text-center text-sm text-muted-foreground">No recent activity.</p>
  }
  return (
    <div className="overflow-x-auto no-scrollbar">
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead>Name</TableHead>
          <TableHead>Email</TableHead>
          <TableHead>Phone</TableHead>
          <TableHead>Last Activity</TableHead>
          <TableHead>Time</TableHead>
          <TableHead>Stage</TableHead>
          <TableHead>Assigned</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => {
          const a = activity(r.lastActivityKind, r.lastActivityTitle)
          const name = cleanContactName(r.name, r.personId)
          return (
            <TableRow key={r.personId}>
              <TableCell>
                <Link href={`/admin/crm/${r.personId}`} className="flex items-center gap-2.5">
                  {r.pictureUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.pictureUrl} alt="" referrerPolicy="no-referrer" className="h-8 w-8 shrink-0 rounded-full object-cover" />
                  ) : (
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                      {name.charAt(0).toUpperCase()}
                    </span>
                  )}
                  <span className="truncate font-medium text-foreground hover:underline">{name}</span>
                </Link>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {r.email ? <a href={`mailto:${r.email}`} className="text-primary hover:underline">{r.email}</a> : '—'}
              </TableCell>
              <TableCell className="tabular-nums text-muted-foreground">
                {r.phone ? (
                  <a href={`tel:+1${String(r.phone).replace(/\D/g, '').slice(-10)}`} className="inline-flex items-center gap-1.5 hover:underline">
                    <Phone className="h-3.5 w-3.5 text-success" aria-hidden />
                    {fmtPhone(r.phone)}
                  </a>
                ) : '—'}
              </TableCell>
              <TableCell>
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <a.Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="truncate">{a.label}</span>
                </span>
              </TableCell>
              <TableCell className="whitespace-nowrap text-muted-foreground">{relativeDays(r.lastActivityAt)}</TableCell>
              <TableCell className="text-muted-foreground">{r.stage ?? '—'}</TableCell>
              <TableCell className="whitespace-nowrap text-muted-foreground">
                {r.assignedBroker ? (CRM_BROKER_DISPLAY[r.assignedBroker as keyof typeof CRM_BROKER_DISPLAY] ?? r.assignedBroker) : '—'}
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
    </div>
  )
}
