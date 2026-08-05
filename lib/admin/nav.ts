import type { AdminIconName, AdminNavItem, AdminNavSection } from '@/app/components/admin/admin-nav'
import {
  hasCapability,
  type AdminCapabilityContext,
  type Capability,
} from '@/lib/admin/capabilities'

/**
 * THE one admin nav source — a PROJECTION of the capability map (admin rebuild
 * spec 01 §5, D9 2026-07-17). An item exists iff the caller holds its capability,
 * and every href points at a LIVE page whose access allows every role the
 * capability grants (verified against the per-page gates 2026-07-17) — so nav
 * visibility and page access can never disagree. There is no imperative "second
 * pass" that bypasses role gates (the bug that regressed ≥4 times in the old
 * buildAdminNav).
 *
 * Consumed by EVERY nav surface: the desktop top bar + the mobile sheet (via
 * `toShellSections`), the phone bottom tab bar (via `buildMobileTabs`, reading
 * the inline `tab` annotations — D9.4: Home/Inbox/People/Deals/Activity), and
 * the ⌘K command palette (fed the same shell sections). Enforced by
 * scripts/check-admin-nav-source.mjs (ci:admin-nav-source): no consumer may
 * carry its own /admin href list, and every href here must resolve to a real
 * page under app/admin/(protected)/.
 *
 * Pages not in the nav stay reachable where a live surface links them (FAB
 * quick actions, hub catalogs, settings cards) — the D9.2 budget is ≈35
 * superuser items; this table renders 39 superuser / 22 broker (was 56 / 30).
 */

/** Phone bottom-tab annotation — the D9.4 five carry these. */
export interface MobileTabAnnotation {
  /** Tab order, 1-based left→right. */
  order: number
  /** Tab label override (menu label used when absent). */
  label?: string
  /** Tab icon override (menu icon used when absent). */
  icon?: AdminIconName
  /** Which live badge the tab renders ('inbox' = unread count). */
  badge?: 'inbox'
}

export interface NavChild {
  label: string
  href: string
  icon: AdminIconName
  capability: Capability
  tab?: MobileTabAnnotation
}

export interface NavDestination {
  key: string
  label: string
  /** The destination's landing page (metadata; menus render `children` when present). */
  href: string
  icon: AdminIconName
  capability: Capability
  /** Mobile-sheet section starts expanded. */
  defaultOpen: boolean
  tab?: MobileTabAnnotation
  children?: NavChild[]
}

/** A capability-filtered destination ready for the shell to render. */
export interface NavSection {
  key: string
  label: string
  href: string
  icon: AdminIconName
  capability: Capability
  defaultOpen: boolean
  tab?: MobileTabAnnotation
  children: NavChild[]
}

/** One phone bottom tab, derived from the annotations above. */
export interface MobileTab {
  href: string
  label: string
  icon: AdminIconName
  badge?: 'inbox'
}

/**
 * The 8-destination IA (D9.1: Home · Inbox · People · Prospecting · Transactions ·
 * Performance · Content · Settings — was 56 superuser items across 5 menus).
 * Every entry references the same Capability constant its page's access implies.
 * Canonical §B1 routes that don't exist yet (/admin/inbox, /admin/prospecting,
 * /admin/transactions, /admin/performance) are thin redirect bridges to these
 * live hrefs, so spec-era deep links work while menus skip the redirect hop.
 */
export const DESTINATIONS: NavDestination[] = [
  {
    key: 'home',
    // P9 roll:today (IA lock 2026-08-05): the home job is the action queue.
    label: 'Today',
    href: '/admin/today',
    icon: 'dashboard',
    capability: 'today.view',
    defaultOpen: true,
    tab: { order: 1, icon: 'home' },
  },
  {
    key: 'inbox',
    // P9 roll:messages (IA lock 2026-08-05): the job is the thread surface.
    label: 'Messages',
    href: '/admin/messages',
    icon: 'inbox',
    capability: 'inbox.view',
    defaultOpen: true,
    tab: { order: 2, badge: 'inbox' },
  },
  {
    key: 'people',
    label: 'People',
    // P9 roll:people (IA lock 2026-08-05): search-first lookup is the landing.
    href: '/admin/people',
    icon: 'users',
    capability: 'people.view',
    defaultOpen: true,
    children: [
      // Locked phone bar (IA lock 2026-08-05): Today · Messages · Prospecting ·
      // People · Oversight. Deals + Activity lost their tabs to Prospecting and
      // Oversight (menu children remain until their families roll).
      { label: 'Search', href: '/admin/people', icon: 'users', capability: 'people.view', tab: { order: 4, label: 'People' } },
      { label: 'Pipeline', href: '/admin/crm/deals', icon: 'layers', capability: 'people.view' },
      // Activity moved to Oversight (P9 roll:oversight — it is a supervision
      // feed, not a people job; reachable under Oversight's All tools).
      { label: 'Tasks', href: '/admin/crm/tasks', icon: 'list-todo', capability: 'tasks.use' },
      { label: 'Calendar', href: '/admin/crm/calendar', icon: 'calendar', capability: 'calendar.use' },
      { label: 'Approvals', href: '/admin/crm/approvals', icon: 'clipboard-check', capability: 'people.view' },
      { label: 'Referrals', href: '/admin/crm/referrals', icon: 'handshake', capability: 'people.view' },
      { label: 'Reporting', href: '/admin/crm/reporting', icon: 'bar-chart', capability: 'people.view' },
      { label: 'Full list', href: '/admin/crm', icon: 'list-todo', capability: 'people.view' },
      // Cut from the menu, still linked live: New contact (FAB quick action),
      // Compose email (FAB + campaigns page), Alerts & reports (dashboard
      // delivery panel + per-contact panel), Import (CRM settings hub + people list).
    ],
  },
  {
    key: 'prospecting',
    // P9 roll:prospecting (IA lock 2026-08-05): the weekly outbound pass earns
    // its locked primary phone slot (tab 3). Child renamed Worklist — a child
    // never repeats the hub label. CMAs + Price opinions move to the Valuations
    // destination when that family rolls.
    label: 'Prospecting',
    href: '/admin/prospecting',
    icon: 'target',
    capability: 'prospecting.view',
    defaultOpen: true,
    tab: { order: 3 },
    children: [
      { label: 'Worklist', href: '/admin/prospecting', icon: 'clock', capability: 'prospecting.view' },
      { label: 'CMAs', href: '/admin/cmas', icon: 'file-search', capability: 'prospecting.view' },
      { label: 'Price opinions', href: '/admin/bpo', icon: 'gauge', capability: 'prospecting.view' },
    ],
  },
  {
    key: 'transactions',
    label: 'Transactions',
    href: '/admin/deals',
    icon: 'handshake',
    capability: 'transactions.view',
    defaultOpen: true,
    // e-sign Signing + Sign-off are PARKED for v1 (D1) — pages stay live at
    // their URLs, deliberately un-navigated.
    children: [
      { label: 'Deals', href: '/admin/deals', icon: 'handshake', capability: 'transactions.view' },
      { label: 'Commissions', href: '/admin/commissions', icon: 'dollar', capability: 'commissions.view' },
      { label: 'Financials', href: '/admin/financials', icon: 'wallet', capability: 'financials.view' },
      { label: 'DSCR deals', href: '/admin/dscr', icon: 'trending-up', capability: 'financials.view' },
      { label: 'Forms', href: '/admin/forms', icon: 'file-text', capability: 'transactions.edit' },
    ],
  },
  {
    // P9 roll:oversight (IA lock 2026-08-05): supervise without being woken —
    // the verdict + needs-you view. Locked phone tab 5. Absorbs the JOBS of
    // operations / sync / crm-health / activity / weekly reports; that legacy
    // machinery stays reachable from the page's All-tools links until each
    // migrates (their nav children die here — single source, one destination).
    key: 'oversight',
    label: 'Oversight',
    href: '/admin/oversight',
    icon: 'activity',
    capability: 'oversight.view',
    defaultOpen: true,
    tab: { order: 5 },
  },
  {
    key: 'performance',
    label: 'Performance',
    href: '/admin/analytics',
    icon: 'bar-chart',
    capability: 'performance.view',
    defaultOpen: false,
    children: [
      { label: 'Overview', href: '/admin/analytics', icon: 'bar-chart', capability: 'performance.view' },
      { label: 'Marketing approvals', href: '/admin/approval-queue', icon: 'badge-check', capability: 'approvals.act' },
      // Hot leads, Live visitors, and the 9 report children live in the
      // /admin/analytics ReportCatalog hub — hub-and-spoke, not spoke-list (D9.2).
    ],
  },
  {
    key: 'content',
    label: 'Content',
    href: '/admin/listings',
    icon: 'files',
    capability: 'content.view',
    defaultOpen: false,
    children: [
      { label: 'Listings', href: '/admin/listings', icon: 'home', capability: 'content.listings' },
      { label: 'Blog', href: '/admin/blog', icon: 'file-text', capability: 'content.blog' },
      { label: 'Guides', href: '/admin/guides', icon: 'files', capability: 'content.guides' },
      { label: 'Geography', href: '/admin/geo', icon: 'map', capability: 'content.communities' },
      { label: 'Media library', href: '/admin/media', icon: 'folder-open', capability: 'content.media' },
      { label: 'Content library', href: '/admin/content-library', icon: 'folder-open', capability: 'content.view' },
      { label: 'Site pages', href: '/admin/site-pages', icon: 'files', capability: 'content.site' },
      { label: 'Newsletters', href: '/admin/newsletters', icon: 'mail', capability: 'content.marketing' },
      { label: 'Email campaigns', href: '/admin/email/campaigns', icon: 'mail', capability: 'content.marketing' },
      { label: 'Ad links', href: '/admin/broker-links', icon: 'megaphone', capability: 'content.marketing' },
    ],
  },
  {
    key: 'settings',
    label: 'Settings',
    href: '/admin/settings',
    icon: 'user-cog',
    capability: 'settings.view',
    defaultOpen: false,
    children: [
      { label: 'My settings', href: '/admin/settings', icon: 'user-cog', capability: 'settings.account' },
      { label: 'Templates', href: '/admin/crm/settings/templates', icon: 'file-text', capability: 'settings.templates' },
      { label: 'Workflows', href: '/admin/crm/sequences', icon: 'zap', capability: 'settings.automations' },
      { label: 'CRM settings', href: '/admin/crm/settings', icon: 'gauge', capability: 'settings.crm' },
      { label: 'Brokers', href: '/admin/brokers', icon: 'user', capability: 'settings.profile' },
      { label: 'Site users', href: '/admin/users', icon: 'users', capability: 'settings.team' },
      { label: 'Audit log', href: '/admin/audit-log', icon: 'scroll-text', capability: 'audit.view' },
      // Operations / System health / CRM health moved under Oversight
      // (P9 roll:oversight) — supervision surfaces, linked from its All tools.
    ],
  },
]

/**
 * Project the destination table through the caller's capabilities. A destination
 * shows iff its top capability passes; its children are independently filtered (so
 * a broker sees Transactions with only the children they hold, never an empty
 * dropdown, and never a child that dead-ends).
 */
export function buildNav(ctx: AdminCapabilityContext): NavSection[] {
  return DESTINATIONS.filter((d) => hasCapability(ctx, d.capability)).map((d) => ({
    key: d.key,
    label: d.label,
    href: d.href,
    icon: d.icon,
    capability: d.capability,
    defaultOpen: d.defaultOpen,
    tab: d.tab,
    children: (d.children ?? []).filter((c) => hasCapability(ctx, c.capability)),
  }))
}

/**
 * The shell render shape: one AdminNavSection per destination. A destination
 * with children renders them as its items (the hub is its own first child where
 * it belongs in the menu); a leaf destination renders itself as the single item
 * (the top bar shows it as a direct link, the sheet as a plain row).
 */
export function toShellSections(sections: NavSection[]): AdminNavSection[] {
  return sections
    .map((s) => ({
      label: s.label,
      defaultOpen: s.defaultOpen,
      items:
        s.children.length > 0
          ? s.children.map(({ label, href, icon }): AdminNavItem => ({ label, href, icon }))
          : [{ label: s.label, href: s.href, icon: s.icon }],
    }))
    .filter((s) => s.items.length > 0)
}

/**
 * The phone bottom tab bar, derived from the `tab` annotations (D9.4:
 * Home/Inbox/People/Deals/Activity) — capability-filtered because it walks the
 * ALREADY-projected sections, so a role lacking a surface never gets its tab.
 */
/**
 * Longest-match active resolution across the WHOLE shell nav. With Inbox
 * (/admin/crm/inbox) and several Settings children (/admin/crm/settings…) split
 * into their own destinations while People keeps the bare /admin/crm, a naive
 * per-section prefix test double-highlights two menus on every /admin/crm/*
 * route — only the section owning the LONGEST matching item href may light.
 */
export function bestShellNavHref(pathname: string, sections: AdminNavSection[]): string {
  let best = ''
  for (const s of sections) {
    for (const i of s.items) {
      const base = i.href.split('?')[0]
      if ((pathname === base || pathname.startsWith(base + '/')) && base.length > best.length) best = base
    }
  }
  return best
}

export function buildMobileTabs(sections: NavSection[]): MobileTab[] {
  const tabs: Array<MobileTab & { order: number }> = []
  for (const s of sections) {
    if (s.tab) tabs.push({ href: s.href, label: s.tab.label ?? s.label, icon: s.tab.icon ?? s.icon, badge: s.tab.badge, order: s.tab.order })
    for (const c of s.children) {
      if (c.tab) tabs.push({ href: c.href, label: c.tab.label ?? c.label, icon: c.tab.icon ?? c.icon, badge: c.tab.badge, order: c.tab.order })
    }
  }
  return tabs
    .sort((a, b) => a.order - b.order)
    .slice(0, 5)
    .map(({ href, label, icon, badge }) => ({ href, label, icon, badge }))
}
