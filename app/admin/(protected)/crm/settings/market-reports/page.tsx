// @no-parity — internal admin surface, no public mockup contract
import { redirect } from 'next/navigation'
import { getCrmAccess } from '@/app/actions/crm'
import { getMarketReportSubscribers } from '@/lib/data/crm/getMarketReportSubscribers'
import { buildMarketReportAreas } from '@/lib/data/crm/getContactReportSubscriptions'
import { SettingsSubpageShell } from '@/components/admin/crm/settings/SettingsSubpageShell'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatDate } from '@/lib/format/date'

export const metadata = { title: 'Market-report subscribers | CRM settings' }
export const dynamic = 'force-dynamic'

/** Resolve area slugs to their registry labels for display. */
function areaLabels(slugs: string[]): string {
  const catalog = buildMarketReportAreas()
  const bySlug = new Map(catalog.map((a) => [a.slug, a.label]))
  return slugs.map((s) => bySlug.get(s) ?? s).join(', ')
}

const FREQUENCY_LABEL: Record<string, string> = {
  weekly: 'Weekly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
}

export default async function CrmMarketReportSubscribersPage() {
  const access = await getCrmAccess()
  if (!access) redirect('/admin/access-denied')

  // Superusers see every subscriber; a broker sees only their own contacts.
  const scope = access.role === 'superuser' ? null : access.brokerSlug
  const subscribers = await getMarketReportSubscribers(scope)

  const activeCount = subscribers.filter((s) => s.isActive).length

  return (
    <SettingsSubpageShell
      title="Market-report subscribers"
      description="Contacts subscribed to recurring market reports. The daily send cron mails each contact on their chosen cadence, with every figure pulled live from the market cache."
    >
      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <span>
          {subscribers.length} {subscribers.length === 1 ? 'subscriber' : 'subscribers'}
        </span>
        <span aria-hidden>&middot;</span>
        <span>{activeCount} active</span>
      </div>

      {subscribers.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          No market-report subscribers yet. A contact subscribes from their CRM record card.
        </Card>
      ) : (
        <div className="overflow-x-auto no-scrollbar rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Contact</TableHead>
                <TableHead>Areas</TableHead>
                <TableHead>Cadence</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last sent</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {subscribers.map((s) => (
                <TableRow key={s.subscriptionId}>
                  <TableCell className="font-medium text-foreground">
                    {s.personName ?? `Contact ${s.personId}`}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {s.areas.length > 0 ? areaLabels(s.areas) : '—'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {FREQUENCY_LABEL[s.frequency] ?? s.frequency}
                  </TableCell>
                  <TableCell>
                    <Badge variant={s.isActive ? 'default' : 'secondary'}>
                      {s.isActive ? 'Active' : 'Paused'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground tabular-nums">
                    {s.lastSentAt ? formatDate(s.lastSentAt) : 'Never'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </SettingsSubpageShell>
  )
}
