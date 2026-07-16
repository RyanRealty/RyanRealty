import type { AdminIconName } from '@/app/components/admin/admin-nav'
import {
  hasCapability,
  type AdminCapabilityContext,
  type Capability,
} from '@/lib/admin/capabilities'

/**
 * The nav generator — a PROJECTION of the capability map (admin rebuild
 * Foundation, spec 01 §5). Kills the 6 dead-end classes of RC5: an item exists iff
 * the caller holds its capability, and that is the SAME capability symbol the
 * destination page guards on (`requireAdminPage`). Nav visibility and access can
 * therefore never disagree — there is no imperative "second pass" that bypasses
 * role gates (the bug that regressed ≥4 times in the old buildAdminNav).
 *
 * Routes are the canonical, flat set from
 * docs/plans/ADMIN_REBUILD/01-DECISIONS-AND-RECONCILIATION §B1 (lowest blast
 * radius). Some destinations are built by later specs; this generator is pure data
 * + a filter, consumed by the shell — pointing at a not-yet-built route is inert
 * until the shell wires it, and ci:admin-authz (advisory first) flags orphans.
 */

export interface NavChild {
  label: string
  href: string
  capability: Capability
}

export interface NavDestination {
  key: string
  label: string
  href: string
  icon: AdminIconName
  capability: Capability
  children?: NavChild[]
}

/** A capability-filtered destination ready for the shell to render. */
export interface NavSection {
  key: string
  label: string
  href: string
  icon: AdminIconName
  children: NavChild[]
}

/**
 * The 8-destination IA (was 56 superuser / 30 broker / 17 report_viewer across 5
 * menus). Every entry references the same Capability constant its page guards on.
 */
export const DESTINATIONS: NavDestination[] = [
  { key: 'today', label: 'Today', href: '/admin', icon: 'dashboard', capability: 'today.view' },
  { key: 'inbox', label: 'Inbox', href: '/admin/inbox', icon: 'inbox', capability: 'inbox.view' },
  {
    key: 'people',
    label: 'People',
    href: '/admin/crm',
    icon: 'users',
    capability: 'people.view',
    children: [
      { label: 'Contacts', href: '/admin/crm', capability: 'people.view' },
      { label: 'Pipeline', href: '/admin/crm/deals', capability: 'people.view' },
      { label: 'Tasks', href: '/admin/crm/tasks', capability: 'tasks.use' },
      { label: 'Calendar', href: '/admin/crm/calendar', capability: 'calendar.use' },
    ],
  },
  {
    key: 'prospecting',
    label: 'Prospecting',
    href: '/admin/prospecting',
    icon: 'target',
    capability: 'prospecting.view',
  },
  {
    key: 'transactions',
    label: 'Transactions',
    href: '/admin/transactions',
    icon: 'handshake',
    capability: 'transactions.view',
    // e-sign Signing + Sign-off are PARKED for v1 (D1) — not in the nav.
    children: [
      { label: 'Deals', href: '/admin/transactions', capability: 'transactions.view' },
      { label: 'Commissions', href: '/admin/transactions/commissions', capability: 'commissions.view' },
      { label: 'Financials', href: '/admin/transactions/financials', capability: 'financials.view' },
      { label: 'Forms', href: '/admin/transactions/forms', capability: 'transactions.edit' },
    ],
  },
  {
    key: 'performance',
    label: 'Performance',
    href: '/admin/performance',
    icon: 'bar-chart',
    capability: 'performance.view',
  },
  {
    key: 'content',
    label: 'Content',
    href: '/admin/listings',
    icon: 'files',
    capability: 'content.view',
    children: [
      { label: 'Listings', href: '/admin/listings', capability: 'content.listings' },
      { label: 'Blog', href: '/admin/blog', capability: 'content.blog' },
      { label: 'Guides', href: '/admin/guides', capability: 'content.guides' },
      { label: 'Communities', href: '/admin/communities', capability: 'content.communities' },
      { label: 'Media', href: '/admin/media', capability: 'content.media' },
      { label: 'Site pages', href: '/admin/site', capability: 'content.site' },
      { label: 'Marketing', href: '/admin/newsletters', capability: 'content.marketing' },
      { label: 'Data health', href: '/admin/content/data-health', capability: 'content.datahealth' },
    ],
  },
  {
    key: 'settings',
    label: 'Settings',
    href: '/admin/settings',
    icon: 'user-cog',
    capability: 'settings.view',
    children: [
      { label: 'My account', href: '/admin/settings', capability: 'settings.account' },
      { label: 'Brokers', href: '/admin/settings/brokers', capability: 'settings.team' },
      { label: 'Routing', href: '/admin/settings/routing', capability: 'settings.routing' },
      { label: 'Automations', href: '/admin/settings/automations', capability: 'settings.automations' },
      { label: 'Templates', href: '/admin/settings/templates', capability: 'settings.templates' },
      { label: 'Stages', href: '/admin/settings/stages', capability: 'settings.stages' },
      { label: 'Appointments', href: '/admin/settings/appointments', capability: 'settings.appointments' },
      { label: 'Compliance', href: '/admin/settings/compliance', capability: 'settings.compliance' },
      { label: 'Company', href: '/admin/settings/company', capability: 'settings.company' },
      { label: 'Reports', href: '/admin/settings/reports', capability: 'settings.reports' },
      { label: 'Audit log', href: '/admin/settings/audit', capability: 'audit.view' },
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
    children: (d.children ?? []).filter((c) => hasCapability(ctx, c.capability)),
  }))
}

/** The first N destinations for the phone bottom tab bar (derived, not hardcoded). */
export function tabBarDestinations(sections: NavSection[], n = 5): NavSection[] {
  return sections.slice(0, n)
}
