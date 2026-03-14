import type { Metadata } from 'next'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'
import { getAdminRoleForEmail } from '@/app/actions/admin-roles'
import { getSession } from '@/app/actions/auth'
import { redirect } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

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

  return (
    <main className="mx-auto max-w-4xl">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-foreground">Email campaigns</h1>
        <Button asChild>
          <Link href="/admin/email/compose">Compose</Link>
        </Button>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Sent campaigns. Stats updated via Resend webhooks.
      </p>

      <div className="mt-6 overflow-x-auto rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted">
              <TableHead className="text-muted-foreground">Subject</TableHead>
              <TableHead className="text-muted-foreground">Type</TableHead>
              <TableHead className="text-muted-foreground">Sent</TableHead>
              <TableHead className="text-muted-foreground">Opens</TableHead>
              <TableHead className="text-muted-foreground">Clicks</TableHead>
              <TableHead className="text-muted-foreground">Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {campaigns.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-6">
                  No campaigns yet. Compose an email to send.
                </TableCell>
              </TableRow>
            ) : (
              campaigns.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>{c.subject ?? '—'}</TableCell>
                  <TableCell>{c.template_type ?? '—'}</TableCell>
                  <TableCell>{c.sent_count}</TableCell>
                  <TableCell>{c.open_count}</TableCell>
                  <TableCell>{c.click_count}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {c.sent_at ? new Date(c.sent_at).toLocaleDateString() : '—'}
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
