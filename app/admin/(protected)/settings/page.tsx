// @no-parity — internal admin surface, no public mockup contract
import { redirect } from 'next/navigation'
import { getSession } from '@/app/actions/auth'
import { getAdminRoleForEmail } from '@/app/actions/admin-roles'
import { createServiceClient } from '@/lib/supabase/service'
import { CRM_BROKER_BY_EMAIL } from '@/lib/crm/constants'
import { BROKER_HEADSHOTS } from '@/components/admin/crm/inbox/mobile/mobile-data'
import MySettingsForm from './MySettingsForm'
import MobileSettingsScreen from './MobileSettingsScreen'
import pkg from '@/package.json'

export const metadata = { title: 'My settings | Admin' }
export const dynamic = 'force-dynamic'

/**
 * /admin/settings — §9 My Settings.
 *
 * The signed-in broker edits their own notification preferences and email
 * signature. Superusers see their own row (by email match). Brokers are
 * restricted to their own row. report_viewers have no broker row so the page
 * shows a message.
 *
 * < md this renders the mob-06 FUB-iOS Settings modal structure
 * (MobileSettingsScreen — full-screen sheet, navy header, profile card,
 * icon-circle feature rows, support links) re-skinned to Ryan Realty tokens.
 * Desktop keeps the MySettingsForm surface unchanged.
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
    .select('id, display_name, email, notify_new_leads, notify_deal_activity, notify_task_due, notify_sms, email_signature')
    .eq('email', email)
    .maybeSingle()

  // Mobile audit P2-8 (2026-07-02): the profile card wears the same broker
  // headshot the navy CRM headers use — the real headshot for the three
  // brokers, falling back to the OAuth avatar (then initials) for others.
  const crmSlug = CRM_BROKER_BY_EMAIL[email] ?? null
  const avatarUrl: string | null =
    (crmSlug ? BROKER_HEADSHOTS[crmSlug] : null) ??
    session?.user?.user_metadata?.avatar_url ??
    session?.user?.user_metadata?.picture ??
    null

  const mobileBroker = broker
    ? {
        id: broker.id as string,
        displayName: (broker.display_name as string | null) ?? email,
        notifyNewLeads: (broker.notify_new_leads as boolean | null) ?? true,
        notifyDealActivity: (broker.notify_deal_activity as boolean | null) ?? true,
        notifyTaskDue: (broker.notify_task_due as boolean | null) ?? true,
        notifySms: (broker.notify_sms as boolean | null) ?? false,
        emailSignature: (broker.email_signature as string | null) ?? '',
      }
    : null

  return (
    <>
      {/* < md — mob-06 Settings modal structure */}
      <MobileSettingsScreen
        broker={mobileBroker}
        role={roleRow.role}
        email={email}
        avatarUrl={avatarUrl}
        appVersion={pkg.version}
      />

      {/* md+ — the desktop My Settings surface, unchanged */}
      <main className="mx-auto hidden max-w-2xl px-4 py-8 sm:px-6 md:block">
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
            notifySms={broker.notify_sms ?? false}
            emailSignature={broker.email_signature ?? ''}
          />
        )}
      </main>
    </>
  )
}
