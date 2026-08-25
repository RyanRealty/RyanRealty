// @no-parity — internal admin surface, no public mockup contract
//
// /admin/settings/account — §9 My Settings.
//
// The signed-in broker edits their own notification preferences and email
// signature. Superusers see their own row (by email match). Brokers are
// restricted to their own row. report_viewers have no broker row, so the page
// says so.
//
// < md this renders the mob-06 Settings modal structure (MobileSettingsScreen —
// full-screen sheet, profile card, icon-circle feature rows, support links).
//
// 11D: migrated to the LOCKED admin v2 language (design_system/admin/ADMIN_UI.md).
// Carried over verbatim: getSession(), the two redirect('/admin/access-denied')
// guards (no email, no admin_roles row), the brokers select and its exact column
// list, `.eq('email', email).maybeSingle()`, the CRM_BROKER_BY_EMAIL →
// BROKER_HEADSHOTS → OAuth-avatar fallback chain, the mobileBroker mapping and
// every one of its defaults, `metadata`, `dynamic = 'force-dynamic'`, and all
// three island mounts (MobileSettingsScreen, MySettingsForm, BrokerPushOptIn)
// with their props unchanged.
//
// Shape changed, data did not: ConsoleShell owns the <main>, so the desktop half
// no longer opens a second one (this page rendered TWO main landmarks on desktop
// before). Page-title chrome is gone — the nav names the page (ADMIN_UI §3
// acceptance bar rule 1) — and the column is the config-form width from pattern 6
// (single column, 640px) instead of max-w-2xl.
//
// One qualifier was CUT, not carried: the empty state said settings are "only
// available for active brokers". The read is `brokers` filtered by email with no
// active/status predicate, so "active" was not something this page checks.
import { getSession } from '@/app/actions/auth'
import { getAdminRoleForEmail } from '@/app/actions/admin-roles'
import { requireAdminPage } from '@/lib/admin/require-admin'
import { createServiceClient } from '@/lib/supabase/service'
import { BROKER_HEADSHOTS } from '@/app/admin/(protected)/crm/inbox/_components/mobile/mobile-data'
import { VerdictLine } from '@/components/admin/v2'
import MySettingsForm from '../MySettingsForm'
import MobileSettingsScreen from '../MobileSettingsScreen'
import BrokerPushOptIn from '@/components/admin/push/BrokerPushOptIn'
import pkg from '@/package.json'

export const metadata = { title: 'My settings | Admin' }
export const dynamic = 'force-dynamic'

export default async function MySettingsPage() {
  const ctx = await requireAdminPage('settings.account')
  const email = ctx.email
  const session = await getSession()
  const roleRow = await getAdminRoleForEmail(email)

  // Find the matching broker row by email
  const sb = createServiceClient()
  const { data: broker } = await sb
    .from('brokers')
    .select('id, display_name, email, notify_new_leads, notify_deal_activity, notify_task_due, notify_return_visit, notify_cma_ready, notify_sms, notify_quiet_start_hour, notify_quiet_end_hour, notify_max_per_day, email_signature, gmail_signature_html, gmail_signature_synced_at, social_instagram, social_facebook, social_linkedin')
    .eq('email', email)
    .maybeSingle()

  // Mobile audit P2-8 (2026-07-02): the profile card wears the same broker
  // headshot the CRM headers use — the real headshot for the three brokers,
  // falling back to the OAuth avatar (then initials) for others.
  const crmSlug = ctx.brokerSlug
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
        notifyReturnVisit: (broker.notify_return_visit as boolean | null) ?? true,
        notifyCmaReady: (broker.notify_cma_ready as boolean | null) ?? true,
        notifySms: (broker.notify_sms as boolean | null) ?? false,
        emailSignature: (broker.email_signature as string | null) ?? '',
      }
    : null

  return (
    <>
      {/* < md — mob-06 Settings modal structure */}
      <MobileSettingsScreen
        broker={mobileBroker}
        role={roleRow?.role ?? ctx.role}
        email={email}
        avatarUrl={avatarUrl}
        appVersion={pkg.version}
      />

      {/* md+ — the desktop My Settings surface */}
      <div
        className="av2-scope hidden md:block"
        style={{ maxWidth: 640, margin: '0 auto', padding: 16 }}
      >
        <div style={{ margin: '0 0 20px' }}>
          <VerdictLine tone={broker ? 'ok' : 'attention'}>
            {broker ? (
              <>
                <b>Your notification channels, email signature, and web push.</b> These settings
                apply to {email} only.
              </>
            ) : (
              <>
                <b>No broker row matches {email}.</b> There are no notification settings to edit.
              </>
            )}
          </VerdictLine>
        </div>

        {broker ? (
          <MySettingsForm
            brokerId={broker.id}
            displayName={broker.display_name ?? email}
            notifyNewLeads={broker.notify_new_leads ?? true}
            notifyDealActivity={broker.notify_deal_activity ?? true}
            notifyTaskDue={broker.notify_task_due ?? true}
            notifyReturnVisit={broker.notify_return_visit ?? true}
            notifyCmaReady={broker.notify_cma_ready ?? true}
            notifySms={broker.notify_sms ?? false}
            notifyQuietStartHour={(broker.notify_quiet_start_hour as number | null) ?? null}
            notifyQuietEndHour={(broker.notify_quiet_end_hour as number | null) ?? null}
            notifyMaxPerDay={(broker.notify_max_per_day as number | null) ?? null}
            emailSignature={broker.email_signature ?? ''}
            gmailSignatureHtml={broker.gmail_signature_html ?? null}
            gmailSignatureSyncedAt={broker.gmail_signature_synced_at ?? null}
            socialInstagram={broker.social_instagram ?? ''}
            socialFacebook={broker.social_facebook ?? ''}
            socialLinkedin={broker.social_linkedin ?? ''}
          />
        ) : null}

        {/* W5.5 leg b — the durable web-push channel opt-in, next to the SMS toggle. */}
        <BrokerPushOptIn />
      </div>
    </>
  )
}
