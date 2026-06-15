import type { Metadata } from 'next'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'
import { getAdminRoleForEmail } from '@/app/actions/admin-roles'
import { getSession } from '@/app/actions/auth'
import { redirect } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import DashboardSummaryStrip from '@/components/admin/DashboardSummaryStrip'
import { TableWithMobileCards } from '@/components/admin/TableWithMobileCards'

export const metadata: Metadata = {
  title: 'Email campaigns',
  description: 'Sent email campaigns and stats.',
}

export const dynamic = 'force-dynamic'

type CampaignRow = {
  id: string
  template_type: string | null
  subject: string | null
  sent_count: number
  open_count: number
  click_count: number
  sent_at: string | null
  created_at: string
}

export default async function AdminEmailCampaignsPage() {
  const session = await getSession()
  if (!session?.user) redirect('/auth-error?next=/admin')
  const role = await getAdminRoleForEmail(session.user.email)
  if (!role) redirect('/admin/access-denied')

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  let campaigns: CampaignRow[] = []
  if (url?.trim() && key?.trim()) {
    const supabase = createClient(url, key)
    const { data } = await supabase
      .from('email_campaigns')
      .select('id, template_type, subject, sent_count, open_count, click_count, sent_at, created_at')
      .order('created_at', { ascending: false })
      .limit(50)
    campaigns = (data ?? []) as CampaignRow[]
  }

  const totalSent = campaigns.reduce((sum, c) => sum + (c.sent_count || 0), 0)
  const totalOpens = campaigns.reduce((sum, c) => sum + (c.open_count || 0), 0)
  const totalClicks = campaigns.reduce((sum, c) => sum + (c.click_count || 0), 0)
  const openRate = totalSent > 0 ? `${((totalOpens / totalSent) * 100).toFixed(1)}%` : '—'

  return (
    <main className="mx-auto max-w-4xl space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-foreground">Email campaigns</h1>
          <p className="text-sm text-muted-foreground">
            Sent campaigns. Stats updated via Resend webhooks.
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/email/compose">Compose</Link>
        </Button>
      </header>

      <DashboardSummaryStrip
        stats={[
          { label: 'Campaigns', value: String(campaigns.length), caption: 'last 50' },
          { label: 'Emails sent', value: totalSent.toLocaleString() },
          { label: 'Opens', value: totalOpens.toLocaleString(), caption: `${openRate} open rate` },
          { label: 'Clicks', value: totalClicks.toLocaleString() },
        ]}
      />

      <TableWithMobileCards
        rows={campaigns}
        cap={12}
        getRowKey={(c) => c.id}
        columns={[
          { key: 'subject', header: 'Subject', className: 'font-medium text-foreground', cell: (c) => c.subject ?? '—' },
          { key: 'type', header: 'Type', className: 'text-xs', cell: (c) => c.template_type ?? '—' },
          { key: 'sent', header: 'Sent', className: 'text-right tabular-nums', cell: (c) => c.sent_count },
          { key: 'opens', header: 'Opens', className: 'text-right tabular-nums', cell: (c) => c.open_count },
          { key: 'clicks', header: 'Clicks', className: 'text-right tabular-nums', cell: (c) => c.click_count },
          { key: 'date', header: 'Date', className: 'text-xs text-muted-foreground whitespace-nowrap', cell: (c) => c.sent_at ? new Date(c.sent_at).toLocaleDateString() : '—' },
        ]}
        renderCard={(c) => (
          <Card>
            <CardContent className="space-y-1">
              <div className="flex items-start justify-between gap-2">
                <span className="min-w-0 break-words text-sm font-medium text-foreground">{c.subject ?? '—'}</span>
                <span className="shrink-0 text-xs text-muted-foreground whitespace-nowrap">{c.sent_at ? new Date(c.sent_at).toLocaleDateString() : '—'}</span>
              </div>
              <p className="text-xs text-muted-foreground tabular-nums">
                {c.template_type ?? '—'} · {c.sent_count} sent · {c.open_count} opens · {c.click_count} clicks
              </p>
            </CardContent>
          </Card>
        )}
        empty={<>No campaigns yet. Compose an email to send.</>}
      />
    </main>
  )
}
