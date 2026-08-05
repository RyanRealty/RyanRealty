import './console-theme.css'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { getSession } from '@/app/actions/auth'
import { safeRedirectPath } from '@/lib/auth/safeRedirect'
import { getAdminRoleForEmail } from '@/app/actions/admin-roles'
import { getCrmAccess } from '@/app/actions/crm'
import { CRM_BROKER_DISPLAY, type CrmBrokerSlug } from '@/lib/crm/constants'
import { buildAdminNav, buildAdminMobileTabs } from '@/app/components/admin/admin-nav'
import type { AdminCapabilityContext } from '@/lib/admin/capabilities'
import ConsoleShell from '@/components/console/ConsoleShell'
import HelpProvider from '@/components/admin/help/HelpProvider'
import { getHelpArticleIndex } from '@/lib/admin-help'

/**
 * Auth + chrome for every admin dashboard page.
 *
 * 2026-06-15 (Matt directive "migrate all pages"): the whole admin now renders
 * inside the neutral ConsoleShell (the .console-root token scope re-skins the
 * shadcn components used across every page to a Linear/Notion neutral palette
 * via their semantic classes — no per-page change needed). The brand
 * AdminHeader/AdminSidebar/AdminMobileTabBar chrome was retired 2026-06-15 and
 * the component files deleted 2026-07-14 (dead code); the full role-based nav
 * is the same buildAdminNav source they used.
 *
 * Login + setup live outside this group so unauthenticated users reach them
 * without a redirect loop.
 */
export default async function AdminProtectedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getSession()
  if (!session?.user) {
    // Preserve the deep-link destination (the page the broker was trying to reach)
    // through the auth funnel instead of hardcoding /admin — so an SMS/notification
    // link to a lead with an expired session lands back on that lead after sign-in
    // (RC5). x-pathname is stamped by middleware; safeRedirectPath guards it.
    const h = await headers()
    // Append the query string (x-search) so an intent deep link survives the
    // funnel — safeRedirectPath preserves path?query and still blocks
    // absolute/protocol-relative targets (D8).
    const rawSearch = h.get('x-search') ?? ''
    const search = rawSearch.startsWith('?') ? rawSearch : ''
    const next = safeRedirectPath(`${h.get('x-pathname') ?? ''}${search}`, '/admin')
    // Straight to the broker login, which completes back to `next` (RC5).
    // /auth-error is for CALLBACK failures only — sending a signed-out broker
    // there dead-ends an SMS deep link on a "Sign-in issue" page (litmus
    // defect, Matt's phone 2026-08-05: stale session + alert tap = wall).
    redirect(`/admin/login?next=${encodeURIComponent(next)}`)
  }
  const adminRole = await getAdminRoleForEmail(session.user.email)
  if (!adminRole) {
    redirect('/admin/access-denied')
  }

  const access = await getCrmAccess()
  const slug = access?.brokerSlug as CrmBrokerSlug | null
  const brokerLabel = slug
    ? `${CRM_BROKER_DISPLAY[slug]} · ${adminRole.role}`
    : adminRole.role === 'superuser'
      ? 'All brokers · superuser'
      : adminRole.role

  // The capability context the ONE nav source projects (lib/admin/nav.ts). No nav
  // item is flag-gated (people.export has no nav entry), so the flags are static
  // here — resolve the real admin_roles flags when a flag-gated consumer appears.
  const capabilityCtx: AdminCapabilityContext = {
    email: session.user.email ?? '',
    role: adminRole.role,
    brokerId: adminRole.brokerId,
    brokerSlug: slug,
    flags: { canExport: false, pauseLeads: false },
  }

  return (
    <div className="console-root">
      <ConsoleShell
        user={{
          email: session.user.email ?? '',
          fullName: session.user.user_metadata?.full_name ?? session.user.user_metadata?.name ?? null,
          avatarUrl:
            session.user.avatar_url ??
            session.user.user_metadata?.avatar_url ??
            session.user.user_metadata?.picture ??
            null,
        }}
        brokerLabel={brokerLabel}
        brokerSlug={slug}
        navSections={buildAdminNav(capabilityCtx)}
        tabs={buildAdminMobileTabs(capabilityCtx)}
      >
        {children}
      </ConsoleShell>
      {/* Persistent Help button — tours + contextual KB links on every admin page. */}
      <HelpProvider articles={getHelpArticleIndex()} />
    </div>
  )
}
