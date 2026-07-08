import '../console/console-theme.css'
import { redirect } from 'next/navigation'
import { getSession } from '@/app/actions/auth'
import { getAdminRoleForEmail } from '@/app/actions/admin-roles'
import { getCrmAccess } from '@/app/actions/crm'
import { CRM_BROKER_DISPLAY, type CrmBrokerSlug } from '@/lib/crm/constants'
import { buildAdminNav } from '@/app/components/admin/admin-nav'
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
 * AdminHeader/AdminSidebar/AdminMobileTabBar are retired from the layout (the
 * component files remain for the mobile-shell gate); the full role-based nav is
 * the same buildAdminNav source they used.
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
    redirect('/auth-error?next=/admin')
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
        navSections={buildAdminNav(adminRole.role, adminRole.brokerId)}
      >
        {children}
      </ConsoleShell>
      {/* Persistent Help button — tours + contextual KB links on every admin page. */}
      <HelpProvider articles={getHelpArticleIndex()} />
    </div>
  )
}
