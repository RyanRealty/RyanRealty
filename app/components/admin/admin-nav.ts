import type { AdminRoleType } from '@/app/actions/admin-roles'

/** Icon names resolved to lucide components in AdminNavIcons.tsx (client). */
export type AdminIconName =
  | 'dashboard' | 'inbox' | 'flame' | 'clipboard-check' | 'pen-line'
  | 'users' | 'layers' | 'mail' | 'gauge'
  | 'handshake' | 'dollar' | 'wallet' | 'file-text'
  | 'home' | 'clock' | 'file-search' | 'search'
  | 'bar-chart' | 'pie-chart' | 'megaphone' | 'filter' | 'trophy' | 'coins'
  | 'trending-up' | 'globe' | 'map-pin' | 'activity' | 'target' | 'badge-check'
  | 'map' | 'building' | 'files' | 'folder-open' | 'images' | 'image' | 'camera'
  | 'refresh' | 'zap' | 'user' | 'user-cog' | 'scroll-text' | 'database'

export type AdminNavItem = { href: string; label: string; icon: AdminIconName }
export type AdminNavSection = {
  label: string
  items: AdminNavItem[]
  /** Collapsible state default — daily-use sections open, archives collapsed. */
  defaultOpen: boolean
}

const item = (href: string, label: string, icon: AdminIconName): AdminNavItem => ({ href, label, icon })

/**
 * Single source of the admin nav: grouped by JOB (what the user is doing),
 * not by data source. Role visibility per href is unchanged from the previous
 * nav; the 2026-06-12 IA rework regrouped items, added daily-use pages that
 * were missing entirely (Approvals, Hot leads, CMAs, Marketing approvals),
 * renamed the two colliding "Deals" surfaces (CRM pipeline vs transaction
 * coordination), and moved plumbing (Sync, Spark) out of Listings into System.
 * Consumed by AdminSidebar, AdminMobileNav, and AdminCommandPalette.
 */
export function buildAdminNav(role: AdminRoleType, brokerId: string | null): AdminNavSection[] {
  const isSuperuser = role === 'superuser'
  const canReports = isSuperuser || role === 'report_viewer'
  const canBrokers = isSuperuser || role === 'broker'

  // ── Today: the daily loop — what needs attention right now ──
  const today: AdminNavItem[] = [
    item('/admin', 'Dashboard', 'dashboard'),
    item('/admin/crm/inbox', 'Inbox', 'inbox'),
  ]
  if (canBrokers) today.push(item('/admin/analytics/action-required', 'Hot leads', 'flame'))
  today.push(item('/admin/crm/approvals', 'Approvals', 'clipboard-check'))
  if (isSuperuser) today.push(item('/admin/sign-off', 'Sign-off queue', 'pen-line'))

  // ── People: leads and clients ──
  const people: AdminNavItem[] = [
    item('/admin/crm', 'Contacts', 'users'),
    item('/admin/crm/deals', 'Pipeline', 'layers'),
    item('/admin/email/compose', 'Compose email', 'mail'),
  ]
  if (canBrokers) people.push(item('/admin/broker-dashboard', 'Broker dashboard', 'gauge'))

  // ── Transactions: contract-to-close ──
  const transactions: AdminNavItem[] = []
  if (canBrokers) {
    transactions.push(
      item('/admin/deals', 'Transactions', 'handshake'),
      item('/admin/commissions', 'Commissions', 'dollar'),
      item('/admin/financials', 'Financials', 'wallet'),
      item('/admin/forms', 'Forms', 'file-text'),
    )
  }

  // ── Listings ──
  const listings: AdminNavItem[] = [item('/admin/listings', 'Listings', 'home')]
  if (isSuperuser) listings.push(item('/admin/expired-listings', 'Expired listings', 'clock'))
  if (canBrokers) listings.push(item('/admin/cmas', 'CMAs', 'file-search'))
  listings.push(item('/admin/search', 'Search', 'search'))

  // ── Marketing: analytics + reports + channels ──
  const marketing: AdminNavItem[] = []
  if (isSuperuser) marketing.push(item('/admin/analytics', 'Analytics', 'bar-chart'))
  if (canReports) marketing.push(item('/admin/reports', 'Reports', 'pie-chart'))
  if (isSuperuser) {
    marketing.push(
      item('/admin/approval-queue', 'Marketing approvals', 'badge-check'),
      item('/admin/analytics/social', 'Social channels', 'megaphone'),
      item('/admin/analytics/demographics', 'Demographics', 'users'),
      item('/admin/analytics/funnel-breakdown', 'Funnel breakdown', 'filter'),
      item('/admin/analytics/lp-leaderboard', 'LP leaderboard', 'trophy'),
      item('/admin/analytics/cost-per-lead', 'Cost per lead', 'coins'),
      item('/admin/analytics/listing-performance', 'Listing performance', 'trending-up'),
      item('/admin/analytics/google-search', 'Google Search (SEO)', 'globe'),
      item('/admin/analytics/google-business-profile', 'Google Business Profile', 'map-pin'),
      item('/admin/visitors/live', 'Live visitors', 'activity'),
      item('/admin/optimization', 'Optimization', 'gauge'),
    )
  }
  if (canBrokers) marketing.push(item('/admin/fub-attribution', 'FUB attribution', 'target'))

  // ── Content: site surfaces and media ──
  const content: AdminNavItem[] = []
  if (isSuperuser) {
    content.push(
      item('/admin/geo', 'Communities & geo', 'map'),
      item('/admin/resort-communities', 'Resort & master plan', 'building'),
      item('/admin/site-pages', 'Site pages', 'files'),
      item('/admin/media', 'Media', 'folder-open'),
      item('/admin/photos', 'Photo curation', 'images'),
      item('/admin/banners', 'Banners', 'image'),
      item('/admin/stock-photos', 'Stock photos', 'camera'),
    )
  }

  // ── System: plumbing and access ──
  const system: AdminNavItem[] = [item('/admin/sync', 'Sync status', 'refresh')]
  if (isSuperuser) system.push(item('/admin/spark-status', 'Spark', 'zap'))
  if (canBrokers) {
    system.push(
      item(
        role === 'broker' && brokerId ? `/admin/brokers?highlight=${brokerId}` : '/admin/brokers',
        role === 'broker' ? 'My profile' : 'Brokers',
        'user',
      ),
    )
  }
  if (isSuperuser) {
    system.push(
      item('/admin/users', 'Users', 'user-cog'),
      item('/admin/audit-log', 'Audit log', 'scroll-text'),
      item('/admin/query-builder', 'Query builder', 'database'),
    )
  }

  const sections: AdminNavSection[] = [
    { label: 'Today', items: today, defaultOpen: true },
    { label: 'People', items: people, defaultOpen: true },
    { label: 'Transactions', items: transactions, defaultOpen: true },
    { label: 'Listings', items: listings, defaultOpen: true },
    { label: 'Marketing', items: marketing, defaultOpen: false },
    { label: 'Content', items: content, defaultOpen: false },
    { label: 'System', items: system, defaultOpen: false },
  ]
  return sections.filter((s) => s.items.length > 0)
}
