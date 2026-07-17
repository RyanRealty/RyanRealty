import type { AdminCapabilityContext } from '@/lib/admin/capabilities'
import { buildNav, toShellSections, buildMobileTabs, type MobileTab } from '@/lib/admin/nav'

export type { MobileTab }

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

/**
 * The shell's nav entry point — a thin adapter over the ONE capability-projected
 * source (`lib/admin/nav.ts` DESTINATIONS + buildNav). The 200-line two-pass
 * regroup that used to live here (and bypassed role gating, producing the 6
 * audited broker dead-end classes) is deleted; this file carries NO route list.
 * Enforced by scripts/check-admin-nav-source.mjs.
 */
export function buildAdminNav(ctx: AdminCapabilityContext): AdminNavSection[] {
  return toShellSections(buildNav(ctx))
}

/** The phone bottom tab bar from the same one source (D9.4 annotations). */
export function buildAdminMobileTabs(ctx: AdminCapabilityContext): MobileTab[] {
  return buildMobileTabs(buildNav(ctx))
}
