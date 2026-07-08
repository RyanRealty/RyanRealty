import './console-theme.css'
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
 * Console — the clean, brand-free broker workspace (Matt directive 2026-06-15).
 *
 * Sibling of (protected), so it escapes the brand AdminHeader/AdminSidebar chrome
 * and renders its own neutral shell, while still living under /admin (inherits the
 * page-dal + heading-display gate skips, the HideOnLP public-chrome suppression,
 * and the analytics-off rule, all of which already match /admin/*). Auth is the
 * same gate the protected layout uses.
 */
export const dynamic = 'force-dynamic'

export default async function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  if (!session?.user) redirect('/auth-error?next=/admin/console')
  const adminRole = await getAdminRoleForEmail(session.user.email)
  if (!adminRole) redirect('/admin/access-denied')

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
          fullName:
            session.user.user_metadata?.full_name ?? session.user.user_metadata?.name ?? null,
          avatarUrl:
            session.user.avatar_url ??
            session.user.user_metadata?.avatar_url ??
            session.user.user_metadata?.picture ??
            null,
        }}
        brokerLabel={brokerLabel}
        navSections={buildAdminNav(adminRole.role, adminRole.brokerId)}
      >
        {children}
      </ConsoleShell>
      {/* Persistent Help button — tours + contextual KB links on every console page. */}
      <HelpProvider articles={getHelpArticleIndex()} />
    </div>
  )
}
