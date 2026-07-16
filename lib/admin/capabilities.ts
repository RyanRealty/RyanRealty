import type { AdminRoleType } from '@/app/actions/admin-roles'
import type { CrmBrokerSlug } from '@/lib/crm/constants'

/**
 * The ONE capability model — the single source of admin access truth.
 *
 * Admin rebuild Foundation (docs/plans/ADMIN_REBUILD, spec 01 §2 +
 * 01-DECISIONS-AND-RECONCILIATION §A1). Kills RC5: access rules used to live in
 * three disagreeing places (nav conditionals, 8 copy-pasted gate layouts, per-page
 * checks), producing broker dead-ends and unauthenticated action holes. This file
 * is the ONE map, consumed by BOTH the in-body guard (lib/admin/require-admin.ts)
 * AND the nav generator — so nav and access can never disagree.
 *
 * Capabilities are verbs-on-resources, deliberately code-defined (not a DB table)
 * so `ci:admin-authz` can statically verify that a page and its nav item reference
 * the SAME capability symbol.
 *
 * The enum is append-only and co-located: each domain spec adds its capabilities
 * here as it lands. This v1 set reflects Matt's locked decisions (2026-07-16):
 *  - D1 e-sign PARKED → no `transactions.signoff` / `esign.send` in v1.
 *  - D3 scoped brokers → brokers hold a scoped `performance.view`; the money caps
 *    (`performance.financials`, `financials.view`, `commissions.view`) are
 *    superuser-only, and brokers reach Content via blog/guides/listings only.
 *  - D4 one commission ledger → `commissions.view` is superuser (brokers see own
 *    rows via row scope, not the capability).
 *  - D5 drop ponds/claim → routing is one superuser `settings.routing` cap.
 */
export type Capability =
  // ── Destinations (top-level nav — one per the 8-destination IA) ──
  | 'today.view'
  | 'inbox.view'
  | 'people.view'
  | 'prospecting.view'
  | 'transactions.view'
  | 'performance.view'
  | 'content.view'
  | 'settings.view'
  // ── Inbox / messaging ──
  | 'inbox.send'
  // ── People / pipeline ──
  | 'people.edit'
  | 'people.import'
  | 'people.export' // flag-gated (can_export)
  | 'send.deliverable' // CMA / BPO / newsletter / saved-search from the PERSON workspace
  | 'tasks.use'
  | 'calendar.use'
  // ── Transactions (e-sign + sign-off PARKED for v1, D1) ──
  | 'transactions.edit'
  | 'commissions.view'
  | 'financials.view'
  // ── Performance ──
  | 'performance.financials' // spend / CPL / ROI / P&L — superuser only (D3)
  // ── Content (granular per D3: brokers author blog/guides — blog_posts.author_broker_id
  //    is a real column — and read listings; site/media/communities stay superuser) ──
  | 'content.listings' // broker: read-only enforced at the page; superuser: edit
  | 'content.blog'
  | 'content.guides'
  | 'content.datahealth'
  | 'content.site'
  | 'content.media'
  | 'content.communities'
  | 'content.marketing' // newsletters / campaigns / broker-links
  // ── Settings ──
  | 'settings.account' // my settings + sign-out (everyone)
  | 'settings.team'
  | 'settings.routing'
  | 'settings.automations'
  | 'settings.templates'
  | 'settings.compliance' // suppression list / block list
  | 'settings.company'
  | 'settings.stages'
  | 'settings.appointments'
  | 'settings.reports'
  | 'import.run'
  | 'approvals.act'
  | 'audit.view'

export type AdminFlag = 'can_export'

/**
 * The ONE map: capability → the NON-superuser roles that hold it. Superuser is
 * omitted here and granted EVERY capability by construction in hasCapability, so a
 * newly-added capability is automatically superuser-held and can never dead-end
 * Matt. An empty array = superuser-only.
 */
export const CAPABILITY_ROLES: Record<Capability, AdminRoleType[]> = {
  // Destinations
  'today.view': ['broker', 'report_viewer'],
  'inbox.view': ['broker'],
  'people.view': ['broker'],
  'prospecting.view': ['broker'],
  'transactions.view': ['broker'],
  'performance.view': ['broker', 'report_viewer'], // broker = scoped own-book (D3)
  'content.view': ['broker'], // broker sees Content (blog/guides/listings); tabs gated below
  'settings.view': ['broker', 'report_viewer'],
  // Inbox
  'inbox.send': ['broker'],
  // People
  'people.edit': ['broker'],
  'people.import': [], // superuser only
  'people.export': ['broker'], // AND requires can_export flag
  'send.deliverable': ['broker'],
  'tasks.use': ['broker'],
  'calendar.use': ['broker'],
  // Transactions
  'transactions.edit': ['broker'],
  'commissions.view': [], // superuser only; brokers see own rows via row scope (D4)
  'financials.view': [], // superuser only
  // Performance
  'performance.financials': [], // superuser only (D3)
  // Content
  'content.listings': ['broker'], // broker read-only at the page
  'content.blog': ['broker'],
  'content.guides': ['broker'],
  'content.datahealth': ['broker'],
  'content.site': [], // superuser only (RC5 public-site write security)
  'content.media': [],
  'content.communities': [],
  'content.marketing': [],
  // Settings
  'settings.account': ['broker', 'report_viewer'],
  'settings.team': [],
  'settings.routing': [],
  'settings.automations': [],
  'settings.templates': [],
  'settings.compliance': [],
  'settings.company': [],
  'settings.stages': [],
  'settings.appointments': ['broker'],
  'settings.reports': [],
  'import.run': [],
  'approvals.act': [],
  'audit.view': [],
}

/** Capabilities that additionally require a per-user flag on admin_roles. */
export const CAPABILITY_FLAG: Partial<Record<Capability, AdminFlag>> = {
  'people.export': 'can_export',
}

/** Every capability symbol, for the ci:admin-authz gate to enumerate. */
export const ALL_CAPABILITIES = Object.keys(CAPABILITY_ROLES) as Capability[]

/**
 * The resolved caller. Extends lib/auth/guards.ts AdminContext with the CRM broker
 * slug (own-book scope) and the per-user flags the capability check consults.
 */
export interface AdminCapabilityContext {
  email: string
  role: AdminRoleType
  brokerId: string | null
  brokerSlug: CrmBrokerSlug | null
  flags: { canExport: boolean; pauseLeads: boolean }
}

/**
 * THE check. Superuser holds every capability (no dead-ends, ever). Otherwise the
 * role must be listed for the capability, and any required per-user flag must be
 * set. Pure and synchronous so both the guard and the nav generator call it.
 */
export function hasCapability(ctx: AdminCapabilityContext, cap: Capability): boolean {
  if (ctx.role === 'superuser') return true
  if (!CAPABILITY_ROLES[cap].includes(ctx.role)) return false
  const flag = CAPABILITY_FLAG[cap]
  if (flag === 'can_export' && !ctx.flags.canExport) return false
  return true
}

/** All capabilities the caller holds — the nav generator's filter predicate. */
export function capabilitiesFor(ctx: AdminCapabilityContext): Set<Capability> {
  return new Set(ALL_CAPABILITIES.filter((cap) => hasCapability(ctx, cap)))
}
