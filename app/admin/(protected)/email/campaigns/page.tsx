// @no-parity — admin-internal email surface, no public mockup contract.
import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getSession } from '@/app/actions/auth'
import { getAdminRoleForEmail } from '@/app/actions/admin-roles'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { ConsoleSection } from '@/components/console/ConsoleSection'
import { KpiStrip } from '@/components/console/KpiStrip'
import { TableWithMobileCards } from '@/components/admin/TableWithMobileCards'
import { formatDate } from '@/lib/format/date'
import {
  getEmailCampaigns,
  getCampaignEngagement,
  getEmailEngagementSummary,
  formatRate,
  type CampaignEngagement,
} from '@/lib/data/crm/getEmailReporting'

export const metadata: Metadata = {
  title: 'Email campaigns',
  description: 'Sent email campaigns with real engagement from the email-events store.',
}

export const dynamic = 'force-dynamic'

/** A campaign row joined to its real engagement (computed on read). */
type CampaignViewRow = {
  id: string
  templateType: string | null
  subject: string | null
  sentCount: number
  sentAtIso: string | null
  engagement: CampaignEngagement | null
}

export default async function AdminEmailCampaignsPage() {
  const session = await getSession()
  if (!session?.user) redirect('/auth-error?next=/admin')
  const role = await getAdminRoleForEmail(session.user.email)
  if (!role) redirect('/admin/access-denied')

  const { rows: campaigns, unreadable } = await getEmailCampaigns(50)

  // Real engagement, joined by message id (email_campaigns.fub_campaign_id ==
  // email_events.message_id). The stored open_count/click_count columns are never
  // updated by the webhook, so they are ignored — this is the truth from events.
  const messageIds = campaigns.map((c) => c.messageId).filter((m): m is string => !!m)
  const engagementMap = await getCampaignEngagement(messageIds)

  // Brokerage-wide campaign engagement for the KPI strip — all campaign sends.
  const summary = await getEmailEngagementSummary({ sendType: 'campaign' })

  const rows: CampaignViewRow[] = campaigns.map((c) => ({
    id: c.id,
    templateType: c.templateType,
    subject: c.subject,
    sentCount: c.sentCount,
    sentAtIso: c.sentAtIso,
    engagement: c.messageId ? engagementMap.get(c.messageId) ?? null : null,
  }))

  // A campaign has trackable engagement when it carries a message id AND events
  // were found for it. Otherwise it reads "no engagement yet" — never a fake 0%.
  function engagementCell(e: CampaignEngagement | null): React.ReactNode {
    if (!e || !e.tracked) {
      return <span className="text-xs text-muted-foreground">No engagement yet</span>
    }
    return (
      <span className="tabular-nums">
        {e.opened.toLocaleString('en-US')} opens · {e.clicked.toLocaleString('en-US')} clicks
      </span>
    )
  }

  function rateCell(e: CampaignEngagement | null): React.ReactNode {
    if (!e || !e.tracked) return <span className="text-muted-foreground">—</span>
    return <span className="tabular-nums">{formatRate(e.openRate)}</span>
  }

  return (
    <main className="mx-auto max-w-4xl space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-foreground">Email campaigns</h1>
        <p className="text-sm text-muted-foreground">
          Sent campaigns. Engagement is read live from the email-events store, joined to each campaign by its message id. A campaign with no events yet shows no engagement rather than a zero.
        </p>
      </header>

      <KpiStrip
        items={[
          { label: 'Campaigns', value: String(campaigns.length) },
          { label: 'Delivered', value: summary.delivered.toLocaleString('en-US') },
          { label: 'Open rate', value: formatRate(summary.openRate) },
          { label: 'Click rate', value: formatRate(summary.clickRate) },
        ]}
      />

      <ConsoleSection
        title="Campaigns"
        count="(last 50)"
        className="mt-6"
        action={
          <div className="flex items-center gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href="/admin/reports/emails">Email reporting</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/admin/email/compose">Compose</Link>
            </Button>
          </div>
        }
      >
        {unreadable ? (
          <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
            The campaigns table could not be read right now.
          </div>
        ) : (
          <TableWithMobileCards
            rows={rows}
            cap={12}
            getRowKey={(c) => c.id}
            columns={[
              { key: 'subject', header: 'Subject', className: 'font-medium text-foreground', cell: (c) => c.subject ?? '—' },
              { key: 'type', header: 'Type', className: 'text-xs', cell: (c) => c.templateType ?? '—' },
              { key: 'sent', header: 'Sent', className: 'text-right tabular-nums', cell: (c) => c.sentCount.toLocaleString('en-US') },
              { key: 'engagement', header: 'Engagement', className: 'text-xs', cell: (c) => engagementCell(c.engagement) },
              { key: 'openrate', header: 'Open rate', className: 'text-right text-xs', cell: (c) => rateCell(c.engagement) },
              {
                key: 'date',
                header: 'Date',
                className: 'text-xs text-muted-foreground whitespace-nowrap',
                cell: (c) => (c.sentAtIso ? formatDate(c.sentAtIso) : '—'),
              },
            ]}
            renderCard={(c) => (
              <Card>
                <CardContent className="space-y-1">
                  <div className="flex items-start justify-between gap-2">
                    <span className="min-w-0 break-words text-sm font-medium text-foreground">{c.subject ?? '—'}</span>
                    <span className="shrink-0 text-xs text-muted-foreground whitespace-nowrap">
                      {c.sentAtIso ? formatDate(c.sentAtIso) : '—'}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground tabular-nums">
                    <span>{c.templateType ?? '—'}</span>
                    <span>·</span>
                    <span>{c.sentCount.toLocaleString('en-US')} sent</span>
                    <span>·</span>
                    {c.engagement?.tracked ? (
                      <span>{c.engagement.opened.toLocaleString('en-US')} opens · {c.engagement.clicked.toLocaleString('en-US')} clicks</span>
                    ) : (
                      <Badge variant="secondary">No engagement yet</Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
            empty={<>No campaigns yet. Compose an email to send.</>}
          />
        )}
      </ConsoleSection>
    </main>
  )
}
