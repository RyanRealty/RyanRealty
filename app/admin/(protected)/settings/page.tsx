// @no-parity — internal admin surface, no public mockup contract
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { getSession } from '@/app/actions/auth'
import { getAdminRoleForEmail } from '@/app/actions/admin-roles'
import { createServiceClient } from '@/lib/supabase/service'
import MySettingsForm from './MySettingsForm'

export const metadata = { title: 'My settings | Admin' }
export const dynamic = 'force-dynamic'

/**
 * /admin/settings — §9 My Settings.
 *
 * The signed-in broker edits their own notification preferences and email
 * signature. Superusers see their own row (by email match). Brokers are
 * restricted to their own row. report_viewers have no broker row so the page
 * shows a message.
 */
export default async function MySettingsPage() {
  const session = await getSession()
  const email = session?.user?.email?.trim().toLowerCase()
  if (!email) redirect('/admin/access-denied')

  const roleRow = await getAdminRoleForEmail(email)
  if (!roleRow) redirect('/admin/access-denied')

  // Find the matching broker row by email
  const sb = createServiceClient()
  const { data: broker } = await sb
    .from('brokers')
    .select('id, display_name, email, notify_new_leads, notify_deal_activity, notify_task_due, email_signature')
    .eq('email', email)
    .maybeSingle()

  return (
    <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-bold text-foreground mb-1">My settings</h1>
      <p className="text-sm text-muted-foreground mb-8">
        Notification preferences and email signature for {email}.
      </p>

      {!broker ? (
        <div className="rounded-xl border border-border bg-card px-6 py-8 text-sm text-muted-foreground text-center">
          No broker profile found for {email}. Settings are only available for active brokers.
        </div>
      ) : (
        <MySettingsForm
          brokerId={broker.id}
          displayName={broker.display_name ?? email}
          notifyNewLeads={broker.notify_new_leads ?? true}
          notifyDealActivity={broker.notify_deal_activity ?? true}
          notifyTaskDue={broker.notify_task_due ?? true}
          emailSignature={broker.email_signature ?? ''}
        />
      )}
    </main>
  )
}
