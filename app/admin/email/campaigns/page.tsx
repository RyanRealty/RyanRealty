import type { Metadata } from 'next'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'
import { getAdminRoleForEmail } from '@/app/actions/admin-roles'
import { getSession } from '@/app/actions/auth'
import { redirect } from 'next/navigation'

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
  if (!session?.user) redirect('/admin/login')
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
        <h1 className="text-2xl font-bold text-zinc-900">Email campaigns</h1>
        <Link
          href="/admin/email/compose"
          className="rounded-lg bg-[var(--brand-navy)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--brand-primary-hover)]"
        >
          Compose
        </Link>
      </div>
      <p className="mt-1 text-sm text-zinc-600">
        Sent campaigns. Stats updated via Resend webhooks.
      </p>

      <div className="mt-6 overflow-x-auto rounded-lg border border-zinc-200 bg-white">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50">
              <th className="px-3 py-2 text-left font-medium text-zinc-700">Subject</th>
              <th className="px-3 py-2 text-left font-medium text-zinc-700">Type</th>
              <th className="px-3 py-2 text-left font-medium text-zinc-700">Sent</th>
              <th className="px-3 py-2 text-left font-medium text-zinc-700">Opens</th>
              <th className="px-3 py-2 text-left font-medium text-zinc-700">Clicks</th>
              <th className="px-3 py-2 text-left font-medium text-zinc-700">Date</th>
            </tr>
          </thead>
          <tbody>
            {campaigns.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-zinc-500">
                  No campaigns yet. Compose an email to send.
                </td>
              </tr>
            ) : (
              campaigns.map((c) => (
                <tr key={c.id} className="border-b border-zinc-100">
                  <td className="px-3 py-2">{c.subject ?? '—'}</td>
                  <td className="px-3 py-2">{c.template_type ?? '—'}</td>
                  <td className="px-3 py-2">{c.sent_count}</td>
                  <td className="px-3 py-2">{c.open_count}</td>
                  <td className="px-3 py-2">{c.click_count}</td>
                  <td className="px-3 py-2 text-zinc-500">
                    {c.sent_at ? new Date(c.sent_at).toLocaleDateString() : '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </main>
  )
}
