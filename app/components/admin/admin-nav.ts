import type { AdminRoleType } from '@/app/actions/admin-roles'

/** Icon names resolved to lucide components in AdminNavIcons.tsx (client). */
export type AdminIconName =
  | 'dashboard' | 'inbox' | 'flame' | 'clipboard-check' | 'pen-line' | 'list-todo' | 'user-plus'
  | 'users' | 'layers' | 'mail' | 'gauge'
  | 'handshake' | 'dollar' | 'wallet' | 'file-text'
  | 'home' | 'clock' | 'file-search' | 'search' | 'calendar'
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
 * Consumed by both admin layouts (protected + console) via ConsoleShell /
 * ConsoleTopNav / AdminNavList.
 */
export function buildAdminNav(role: AdminRoleType, brokerId: string | null): AdminNavSection[] {
  const isSuperuser = role === 'superuser'
  const canBrokers = isSuperuser || role === 'broker'

  // ── Today: the daily loop — what needs attention right now ──
  const today: AdminNavItem[] = [
    item('/admin/broker-dashboard', 'Dashboard', 'dashboard'),
    item('/admin/crm/inbox', 'Inbox', 'inbox'),
    item('/admin/crm/tasks', 'Tasks', 'list-todo'),
  ]
  // Hot leads lives under /admin/analytics, whose layout is superuser-only
  // (Phase 1 decision 2026-05-21). Showing it to brokers produced an
  // access-denied dead end — gate the nav item to match the layout.
  if (isSuperuser) today.push(item('/admin/analytics/action-required', 'Hot leads', 'flame'))
  today.push(item('/admin/crm/approvals', 'Approvals', 'clipboard-check'))
  if (isSuperuser) today.push(item('/admin/sign-off', 'Sign-off queue', 'pen-line'))

  // ── People: leads and clients ──
  const people: AdminNavItem[] = [
    item('/admin/crm', 'Contacts', 'users'),
    item('/admin/crm/new', 'New contact', 'user-plus'),
    item('/admin/crm/deals', 'Pipeline', 'layers'),
    item('/admin/email/compose', 'Compose email', 'mail'),
  ]

  // ── Transactions: contract-to-close ──
  const transactions: AdminNavItem[] = []
  if (canBrokers) {
    transactions.push(
      item('/admin/deals', 'Transactions', 'handshake'),
      item('/admin/signing', 'Signing', 'pen-line'),
      item('/admin/commissions', 'Commissions', 'dollar'),
      item('/admin/financials', 'Financials', 'wallet'),
      item('/admin/forms', 'Forms', 'file-text'),
    )
  }

  // ── Listings ──
  const listings: AdminNavItem[] = [item('/admin/listings', 'Listings', 'home')]
  if (isSuperuser) listings.push(item('/admin/expired-listings', 'Expired listings', 'clock'))
  // Restored to nav 2026-07-14: the consolidated Expireds + FSBOs dashboards
  // (approve-and-send prospecting surfaces) were live pages reachable only by
  // URL — same orphan-route defect the 2026-07-07 consolidation audit fixed
  // for blog + email campaigns. Gate matches the pages' server actions
  // (requireAdmin: any admin role except report_viewer).
  if (canBrokers) listings.push(item('/admin/expireds', 'Expireds', 'clock'))
  if (canBrokers) listings.push(item('/admin/expired-outreach', 'Expired outreach', 'user-plus'))
  if (canBrokers) listings.push(item('/admin/fsbos', 'FSBOs', 'home'))
  if (canBrokers) listings.push(item('/admin/cmas', 'CMAs', 'file-search'))
  if (canBrokers) listings.push(item('/admin/bpo', 'Price opinions', 'gauge'))
  // /admin/search was merged into the listings browser (consolidation 2026-07-07)

  // ── Marketing: performance + channels ──
  // Consolidation 2026-07-07: the Analytics and Reports launchpads merged into
  // ONE Performance hub at /admin/analytics (/admin/reports redirects there).
  // Nav gate matches the analytics layout (superuser) so the item never
  // dead-ends — no report_viewer roles exist (verified against admin_roles).
  const marketing: AdminNavItem[] = []
  if (isSuperuser) marketing.push(item('/admin/analytics', 'Performance', 'bar-chart'))
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
      item('/admin/operations/optimization', 'Optimization', 'gauge'),
    )
  }
  if (canBrokers) marketing.push(item('/admin/newsletters', 'Newsletter', 'mail'))
  // Restored to nav 2026-07-07: blog + email campaigns were live pages reachable
  // only by URL (consolidation audit — orphan routes).
  if (isSuperuser) marketing.push(item('/admin/blog', 'Blog', 'file-text'))
  if (isSuperuser) marketing.push(item('/admin/email/campaigns', 'Email campaigns', 'mail'))
  if (canBrokers) marketing.push(item('/admin/broker-links', 'Ad links', 'megaphone'))

  // ── Content: site surfaces and media ──
  const content: AdminNavItem[] = []
  if (isSuperuser) {
    content.push(
      // Consolidation 2026-07-07: resort-communities is a tab under Geography;
      // photos/banners/stock-photos are tabs under the Media library.
      item('/admin/geo', 'Geography', 'map'),
      item('/admin/site-pages', 'Site pages', 'files'),
      item('/admin/media', 'Media library', 'folder-open'),
    )
  }

  // ── System: plumbing and access ──
  const system: AdminNavItem[] = []
  if (isSuperuser) system.push(item('/admin/operations', 'Operations', 'gauge'))
  if (isSuperuser) system.push(item('/admin/crm/health', 'CRM health', 'activity'))
  if (isSuperuser) system.push(item('/admin/crm/settings', 'CRM settings', 'gauge'))
  // /admin/sync's layout is superuser-only; match the nav gate to it.
  // Consolidation 2026-07-07: Spark is now a tab inside System health (/admin/sync).
  if (isSuperuser) system.push(item('/admin/sync', 'System health', 'refresh'))
  if (canBrokers) {
    system.push(
      item(
        role === 'broker' && brokerId ? `/admin/brokers?highlight=${brokerId}` : '/admin/brokers',
        role === 'broker' ? 'My profile' : 'Brokers',
        'user',
      ),
    )
  }
  // Consolidation 2026-07-07: the query builder folded into the listings
  // browser (CSV export panel at the bottom of /admin/listings).
  if (isSuperuser) {
    system.push(
      item('/admin/users', 'Users', 'user-cog'),
      item('/admin/audit-log', 'Audit log', 'scroll-text'),
    )
  }

  // ── Regroup into the 5 top-level menus (Matt directive 2026-06-26):
  //    Dashboard · CRM · Deals · Reports · Admin. Filter-based remap so every
  //    role gate above is preserved (an item only exists if its role check
  //    passed). The flat per-job arrays are the source; they fan into 5 groups. ──
  const has = (arr: AdminNavItem[], href: string) => arr.filter((i) => i.href === href)
  const exclude = (arr: AdminNavItem[], hrefs: string[]) => arr.filter((i) => !hrefs.includes(i.href))

  const dashboardItems = has(today, '/admin/broker-dashboard')

  // Menu redesign (Matt 2026-07-01 "the menu points to the wrong pages"):
  // the CRM group now carries EVERY CRM surface — the reporting suite,
  // workflows (sequences editor), templates, and CRM settings were missing
  // entirely (reachable only by URL), and "Reports" led to the old marketing
  // analytics instead of the FUB-parity CRM reporting hub.
  const crmItems: AdminNavItem[] = [
    ...has(people, '/admin/crm'), // Contacts
    item('/admin/crm/activity', 'Activity', 'activity'),
    ...has(today, '/admin/crm/inbox'),
    ...has(today, '/admin/crm/tasks'),
    item('/admin/crm/calendar', 'Calendar', 'calendar'),
    ...has(today, '/admin/analytics/action-required'), // Hot leads
    ...has(today, '/admin/crm/approvals'),
    ...has(people, '/admin/crm/new'),
    item('/admin/crm/reporting', 'Reporting', 'bar-chart'),
    item('/admin/crm/sequences', 'Workflows', 'zap'),
    item('/admin/crm/settings/templates', 'Templates', 'file-text'),
    ...has(people, '/admin/email/compose'),
    ...has(marketing, '/admin/newsletters'),
    ...has(marketing, '/admin/email/campaigns'),
    item('/admin/crm/subscriptions', 'Alerts & reports', 'mail'),
    ...has(listings, '/admin/cmas'),
    ...has(listings, '/admin/bpo'),
    ...(isSuperuser ? [item('/admin/crm/settings', 'CRM settings', 'gauge')] : []),
  ]

  const dealsItems: AdminNavItem[] = [
    ...has(people, '/admin/crm/deals'), // Pipeline
    ...transactions, // Transactions, Signing, Commissions, Financials, Forms
    ...has(today, '/admin/sign-off'),
  ]

  const reportsItems = marketing.filter((i) =>
    /\/admin\/(analytics|reports|operations\/optimization|visitors)/.test(i.href),
  )

  const adminItems: AdminNavItem[] = [
    ...exclude(listings, ['/admin/cmas', '/admin/bpo']), // Listings, Expired
    ...has(marketing, '/admin/approval-queue'),
    ...has(marketing, '/admin/blog'),
    ...has(marketing, '/admin/broker-links'),
    ...content,
    ...system,
    item('/admin/crm/import', 'Import contacts', 'database'),
    item('/admin/settings', 'My settings', 'user-cog'),
  ]

  const sections: AdminNavSection[] = [
    { label: 'Dashboard', items: dashboardItems, defaultOpen: true },
    { label: 'CRM', items: crmItems, defaultOpen: true },
    { label: 'Deals', items: dealsItems, defaultOpen: true },
    { label: 'Reports', items: reportsItems, defaultOpen: false },
    { label: 'Admin', items: adminItems, defaultOpen: false },
  ]
  return sections.filter((s) => s.items.length > 0)
}
