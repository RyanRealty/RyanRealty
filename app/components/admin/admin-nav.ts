import type { AdminRoleType } from '@/app/actions/admin-roles'

export type AdminNavItem = { href: string; label: string; icon: string }
export type AdminNavSection = { label: string; items: AdminNavItem[] }

const item = (href: string, label: string, icon: string): AdminNavItem => ({ href, label, icon })

/**
 * Single source of the admin nav: grouped sections, role-gated.
 * Consumed by AdminSidebar (desktop aside) and AdminMobileNav (phone sheet) so
 * the two can never drift. Role visibility here is identical to the pre-2026-06-10
 * flat list — grouping changed, access did not.
 */
export function buildAdminNav(role: AdminRoleType, brokerId: string | null): AdminNavSection[] {
  const isSuperuser = role === 'superuser'
  const canReports = isSuperuser || role === 'report_viewer'
  const canBrokers = isSuperuser || role === 'broker'
  const canFullAdmin = isSuperuser

  const overview: AdminNavItem[] = [item('/admin', 'Dashboard', '◉')]
  if (canBrokers) overview.push(item('/admin/broker-dashboard', 'Broker dashboard', '📉'))
  if (canReports) overview.push(item('/admin/reports', 'Reports', '📊'))

  const crm: AdminNavItem[] = [
    item('/admin/crm', 'CRM', '🗃'),
    item('/admin/crm/inbox', 'CRM inbox', '📥'),
  ]
  crm.push(item('/admin/email/compose', 'Email', '✉'))

  const transactions: AdminNavItem[] = []
  if (canBrokers) transactions.push(item('/admin/deals', 'Deals', '🤝'))
  if (canBrokers) transactions.push(item('/admin/commissions', 'Commissions', '💰'))
  if (canBrokers) transactions.push(item('/admin/forms', 'Forms', '📝'))
  if (isSuperuser) transactions.push(item('/admin/sign-off', 'Sign-off queue', '✍'))

  const listings: AdminNavItem[] = [
    item('/admin/search', 'Search', '🔎'),
    item('/admin/listings', 'Listings', '🏠'),
    item('/admin/sync', 'Sync status', '🔄'),
  ]
  if (isSuperuser) listings.push(item('/admin/expired-listings', 'Expired listings', '🏚'))
  if (canFullAdmin) listings.push(item('/admin/spark-status', 'Spark', '⚡'))

  const analytics: AdminNavItem[] = []
  if (isSuperuser) {
    analytics.push(
      item('/admin/analytics', 'Analytics', '📊'),
      item('/admin/analytics/social', 'Social channels', '📣'),
      item('/admin/analytics/demographics', 'Demographics', '👥'),
      item('/admin/analytics/funnel-breakdown', 'Funnel breakdown', '🔻'),
      item('/admin/analytics/lp-leaderboard', 'LP leaderboard', '🏁'),
      item('/admin/analytics/cost-per-lead', 'Cost per lead', '💸'),
      item('/admin/analytics/listing-performance', 'Listing performance', '🏠'),
      item('/admin/analytics/google-search', 'Google Search (SEO)', '🔍'),
      item('/admin/analytics/google-business-profile', 'Google Business Profile', '📍'),
      item('/admin/visitors/live', 'Live visitors', '🟢'),
      item('/admin/optimization', 'Optimization', '📈'),
    )
  }
  if (canBrokers) analytics.push(item('/admin/fub-attribution', 'FUB attribution', '🎯'))

  const content: AdminNavItem[] = []
  if (canFullAdmin) {
    content.push(
      item('/admin/geo', 'Communities & geo', '📍'),
      item('/admin/resort-communities', 'Resort & master plan', '🏘'),
      item('/admin/site-pages', 'Site pages', '📄'),
      item('/admin/media', 'Media', '🗂'),
      item('/admin/photos', 'Photo curation', '🌄'),
      item('/admin/banners', 'Banners', '🖼'),
      item('/admin/stock-photos', 'Stock photos', '📷'),
    )
  }

  const system: AdminNavItem[] = []
  if (canBrokers) {
    system.push(
      item(
        role === 'broker' && brokerId ? `/admin/brokers?highlight=${brokerId}` : '/admin/brokers',
        role === 'broker' ? 'My profile' : 'Brokers',
        '👔',
      ),
    )
  }
  if (isSuperuser) {
    system.push(item('/admin/users', 'Users', '👤'))
    system.push(item('/admin/audit-log', 'Audit log', '📋'))
  }
  if (canFullAdmin) system.push(item('/admin/query-builder', 'Query builder', '🔍'))

  const sections: AdminNavSection[] = [
    { label: 'Overview', items: overview },
    { label: 'CRM', items: crm },
    { label: 'Transactions', items: transactions },
    { label: 'Listings & market', items: listings },
    { label: 'Analytics', items: analytics },
    { label: 'Content & site', items: content },
    { label: 'System', items: system },
  ]
  return sections.filter((s) => s.items.length > 0)
}
