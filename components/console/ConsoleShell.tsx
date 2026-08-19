'use client'

/**
 * ConsoleShell — the clean neutral admin chrome (Linear/Notion register) that
 * hosts the WHOLE admin. Matt directive 2026-06-15: "we do not need to enforce
 * the styles from our brand in the admin, it just needs to be ultra intuitive."
 *
 * Renders the full role-based admin nav (the same single nav source everywhere:
 * lib/admin/nav.ts DESTINATIONS via buildAdminNav) inside a neutral shell:
 * the §5 Option A left rail on desktop (lg+), the locked 5-tab bottom bar on
 * phones, a slim phone utility row, and a hamburger sheet.
 *
 * B4 (Matt 2026-08-06): the phone chrome carries NO public brand — the wordmark
 * header was chrome leak (ADMIN_UI.md §5 amnesia rule: no wordmark image, no
 * navy brand bar; the admin is its own product). §5 phone chrome is the locked
 * 5-tab bar (CrmMobileTabBar); the utility row below keeps only the affordances
 * the tab bar cannot carry.
 *
 * B5 (Phase 11B): the CRM-style navy top bar (the last public-brand chrome in
 * the admin — navy bar + white wordmark) is retired. Desktop chrome is the
 * LOCKED §5 Option A left rail (ADMIN_UI.md, Matt 2026-08-05): 216px, the 11
 * destinations in the locked Do / Move / Watch / Reach groups + Settings last,
 * icon-collapsed below 1200px, ⌘K + broker scope at the top, a quiet account
 * footer. Rendered by the v2 RailNav primitive from the SAME capability-
 * filtered sections the old bar consumed.
 */

import { useState, Suspense } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { signOut } from '@/app/actions/auth'
import type { AdminNavSection, MobileTab } from '@/app/components/admin/admin-nav'
import AdminNavList from '@/app/components/admin/AdminNavList'
import { ADMIN_NAV_ICONS } from '@/app/components/admin/AdminNavIcons'
import { bestShellNavHref } from '@/lib/admin/nav'
import { RailNav, type RailGroup, type RailItem } from '@/components/admin/v2/RailNav'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import Link from 'next/link'
import ConsoleCommandPalette, { ConsoleCommandPaletteTrigger } from '@/components/console/ConsoleCommandPalette'
import ConsoleQuickAction from '@/components/console/ConsoleQuickAction'
import CrmMobileTabBar from '@/components/console/CrmMobileTabBar'
import KeyboardInsetSync from '@/components/console/KeyboardInsetSync'
import TopBarScope from '@/components/console/TopBarScope'

function MenuIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px] shrink-0" aria-hidden="true">
      <path d="M3 6h18M3 12h18M3 18h18" />
    </svg>
  )
}

/**
 * The locked §5 presentational groups (ia-lock.md "Desktop nav model", Matt
 * 2026-08-05): Do: Today·Messages·People — Move: Prospecting·Valuations·
 * Closings — Watch: Oversight·Reports — Reach: Audiences·Content — Settings
 * last, ungrouped. Grouping is presentational, not structural — keyed by
 * destination LABEL from the one nav source; a label this map does not know
 * lands in a trailing ungrouped block, so capability filtering or a future
 * destination never silently drops a rail row.
 */
const RAIL_GROUPS: ReadonlyArray<{ label: string; members: readonly string[] }> = [
  { label: 'Do', members: ['Today', 'Messages', 'People'] },
  { label: 'Move', members: ['Prospecting', 'Valuations', 'Closings'] },
  { label: 'Watch', members: ['Oversight', 'Reports'] },
  { label: 'Reach', members: ['Audiences', 'Content'] },
  { label: '', members: ['Settings'] },
]

export default function ConsoleShell({
  user,
  brokerLabel,
  brokerSlug,
  navSections,
  tabs,
  inboxUnread = 0,
  children,
}: {
  user: { email: string; fullName: string | null; avatarUrl: string | null }
  brokerLabel: string
  brokerSlug?: string | null
  navSections: AdminNavSection[]
  /** Phone bottom tabs, derived from the same one nav source (buildAdminMobileTabs). */
  tabs: MobileTab[]
  inboxUnread?: number
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  // The ONE command-palette instance (audit §9.2: the old per-header mounts
  // registered two ⌘K listeners and stacked two dialogs).
  const [paletteOpen, setPaletteOpen] = useState(false)
  const initials = (user.fullName ?? user.email ?? '?').trim().charAt(0).toUpperCase()
  const pathname = usePathname() ?? ''
  const router = useRouter()
  async function handleSignOut() {
    setOpen(false)
    await signOut()
    router.push('/admin/login')
    router.refresh()
  }
  // The CRM scope switcher is meaningful only on the contacts list, where the
  // ?broker= param drives the feed.
  const onContactsList = pathname === '/admin/crm'

  // Rail projection — the SAME capability-filtered sections + the SAME
  // longest-match active logic the old desktop bar used (bestShellNavHref:
  // only the section owning the most specific matching item lights).
  const bestHref = bestShellNavHref(pathname, navSections)
  const base = (h: string) => h.split('?')[0]
  const toRailItem = (s: AdminNavSection): RailItem => {
    const active = bestHref !== '' && s.items.some((i) => base(i.href) === bestHref)
    const leaf = s.items.length === 1
    // The first item is the destination's landing page in every grouped
    // destination (toShellSections puts the hub first), so its icon IS the
    // destination icon and its href IS the destination door.
    const Icon = ADMIN_NAV_ICONS[s.items[0].icon]
    return {
      label: s.label,
      href: s.items[0].href,
      icon: <Icon aria-hidden />,
      active,
      current: leaf && active,
      children: leaf
        ? undefined
        : s.items.map((i) => ({ label: i.label, href: i.href, current: base(i.href) === bestHref })),
    }
  }
  const knownLabels = new Set(RAIL_GROUPS.flatMap((g) => [...g.members]))
  const railGroups: RailGroup[] = RAIL_GROUPS.map((g) => ({
    label: g.label,
    items: navSections.filter((s) => g.members.includes(s.label)).map(toRailItem),
  })).filter((g) => g.items.length > 0)
  const leftovers = navSections.filter((s) => !knownLabels.has(s.label)).map(toRailItem)
  if (leftovers.length > 0) railGroups.push({ label: '', items: leftovers })

  const avatar = user.avatarUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={user.avatarUrl} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover object-top" referrerPolicy="no-referrer" />
  ) : (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-secondary-foreground">
      {initials}
    </span>
  )

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* Desktop: the §5 Option A left rail (lg+). Sticky full-height column
          with its own scroll; the rail auto-collapses to icons at <1200px
          (admin-v2.css). NO wordmark, NO navy brand bar — the admin is its own
          product (ADMIN_UI.md §5 amnesia rule). */}
      <aside className="sticky top-0 hidden h-screen shrink-0 overflow-y-auto lg:flex">
        <RailNav
          groups={railGroups}
          top={
            <>
              {/* §5: top of rail = global search (⌘K) + broker scope switch. */}
              <div className="av2-rail__search">
                <ConsoleCommandPaletteTrigger onOpen={() => setPaletteOpen(true)} />
              </div>
              {onContactsList ? (
                <div className="av2-rail__scope">
                  <Suspense fallback={null}>
                    <TopBarScope myBrokerSlug={brokerSlug ?? null} />
                  </Suspense>
                </div>
              ) : null}
            </>
          }
          footer={
            /* §5 is silent on account chrome — a quiet rail footer: avatar +
               identity opens the account menu (My settings · View site · Sign
               out; the audited no-sign-out class stays fixed). */
            <DropdownMenu>
              <DropdownMenuTrigger
                aria-label="Account menu"
                title={brokerLabel}
                className="flex w-full items-center gap-2.5 rounded-lg p-1.5 text-left hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {avatar}
                <span className="av2-rail__id min-w-0">
                  <span className="block truncate text-sm font-medium text-foreground">{user.fullName ?? 'Signed in'}</span>
                  <span className="block truncate text-xs text-muted-foreground">{user.email}</span>
                </span>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="start" className="w-56">
                <DropdownMenuLabel className="truncate font-normal">
                  <span className="block text-sm font-medium text-foreground">{user.fullName ?? 'Signed in'}</span>
                  <span className="block truncate text-xs text-muted-foreground">{user.email}</span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  {/* The personal account page (P9 Settings roll). */}
                  <Link href="/admin/settings/account">My settings</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/">View site</Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={(e) => { e.preventDefault(); void handleSignOut() }} className="text-destructive focus:text-destructive">
                  <LogOut className="mr-2 h-4 w-4" aria-hidden />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          }
        />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Phone utility row (< lg) — B4 2026-08-06: the wordmark header was
            public-brand chrome leak (ADMIN_UI.md §5 amnesia rule — no wordmark,
            no navy brand bar). §5 phone chrome is the locked 5-tab bar; this row
            carries only what the tab bar cannot: the full-nav sheet trigger
            (non-tab destinations), the shared ⌘K palette trigger, the account
            identity, and the broker scope switch on the contacts list. Height
            stays h-14: crm/** sticky sub-headers offset by top-14 below it. */}
        <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-border bg-background/90 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/75 sm:px-5 lg:hidden">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setOpen(true)}
            className="h-10 w-10 p-0 text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label="Open navigation"
          >
            <MenuIcon />
          </Button>
          {/* Center slot: the contacts list pins the scope picker; everywhere
              else the row stays quiet (no wordmark — the admin is its own product). */}
          <div className="flex min-w-0 flex-1 items-center justify-center">
            {onContactsList ? (
              <Suspense fallback={null}>
                <TopBarScope myBrokerSlug={brokerSlug ?? null} />
              </Suspense>
            ) : null}
          </div>
          <div className="flex items-center gap-1.5">
            <ConsoleCommandPaletteTrigger onOpen={() => setPaletteOpen(true)} />
            {user.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.avatarUrl} alt="" title={brokerLabel} className="h-8 w-8 rounded-full object-cover object-top" referrerPolicy="no-referrer" />
            ) : (
              <span title={brokerLabel} className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-secondary-foreground">{initials}</span>
            )}
          </div>
        </header>

        <main className="min-w-0 flex-1 px-4 pt-5 pb-24 sm:px-6 sm:pt-7 lg:px-8 lg:pb-8">{children}</main>
      </div>

      {/* Global "+" quick-action FAB — rides every console surface, context-aware on a lead.
          Lifted above the mobile tab bar on phones. */}
      <ConsoleQuickAction />

      {/* CRM-style bottom tab bar — phones only (the desktop rail covers lg+).
          Tabs derive from the one nav source (D9.4). */}
      <CrmMobileTabBar tabs={tabs} inboxUnread={inboxUnread} />

      {/* THE command palette — one instance, one ⌘K listener, full nav coverage. */}
      <ConsoleCommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} sections={navSections} />

      {/* Soft-keyboard tracking (--kb-inset / [data-kb-open]) — the tab bar,
          FABs, and bottom-docked composers all key off it. */}
      <KeyboardInsetSync />

      {/* Mobile sheet */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-72 overflow-y-auto bg-sidebar p-0">
          {/* B4: no wordmark in the sheet either (amnesia rule) — the title is
              plain product chrome, made visible instead of sr-only. */}
          <SheetTitle className="flex h-14 items-center border-b border-sidebar-border px-4 text-sm font-semibold text-sidebar-foreground">
            Navigation
          </SheetTitle>
          <AdminNavList sections={navSections} onNavigate={() => setOpen(false)} />
          {/* Account footer — the mobile shell had no sign-out either (audited).
              Signed-in identity + a sign-out action at the bottom of the sheet. */}
          <div className="mt-2 border-t border-sidebar-border p-3">
            <div className="truncate px-3 pb-2 text-xs text-muted-foreground">{user.email}</div>
            <Button
              type="button"
              variant="ghost"
              onClick={handleSignOut}
              className="h-10 w-full justify-start gap-2 rounded-lg px-3 text-sm font-medium text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              <LogOut className="h-4 w-4" aria-hidden />
              Sign out
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
