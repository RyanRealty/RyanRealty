'use client'

/**
 * MobileContactDetail — §25 (docs/crm-spec/25-mobile-contact-detail.md)
 *
 * The mobile Contact Detail / Lead Profile rendered at < md (~390 px).
 * Matches the CRM iOS reference structure:
 *   - Header surface continuous through the sub-tab strip (§25.3, §25.4)
 *   - Sub-tab strip: Info · Comms · Homes · Notes · Calendar (horizontally scrollable)
 *   - Active tab: 600 weight + 2.5 px accent bottom underline
 *   - Inactive: secondary text
 *   - Tab content swap in-place (no navigation push for tab changes)
 *   - FAB per-tab at bottom-right
 *
 * Desktop layout is UNCHANGED — this component is wrapped in `md:hidden` at
 * the call site; the existing LeadTabs remains visible on md+.
 *
 * §25.1 token map, on the LOCKED admin v2 language (design_system/admin/ADMIN_UI.md):
 *   header block → var(--a-surface); content area → var(--a-bg);
 *   primary text → var(--a-text); secondary text → var(--a-text-2);
 *   active underline + inline actions → var(--a-accent); hairlines → var(--a-border).
 */

import { useEffect, useRef, useState } from 'react'
import { ChevronLeft } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { CrmAvatar } from '@/components/admin/shared/mobile/CrmMobileKit'
import MobileEditSheet, { type MobileEditData } from '@/components/admin/shared/mobile/MobileEditSheet'

/* ── §25.4 Tab definitions ─────────────────────────────────────────────────── */

export type MobileTabKey = 'info' | 'comms' | 'activity' | 'homes' | 'notes' | 'calendar'

const TABS: { key: MobileTabKey; label: string }[] = [
  { key: 'info', label: 'Info' },
  { key: 'comms', label: 'Comms' },
  // Matt punch list #5 (2026-07-02): "I need to be able to see lead activity
  // on the lead detail" — the desktop center column's Activity filter, as a tab.
  { key: 'activity', label: 'Activity' },
  { key: 'homes', label: 'Homes' },
  { key: 'notes', label: 'Notes' },
  { key: 'calendar', label: 'Calendar' },
]

/* ── Types ─────────────────────────────────────────────────────────────────── */

export interface MobileContactDetailProps {
  /** §25.3.6 — crm_people.id */
  personId: number
  /** §25.3.4 — first_name + last_name */
  displayName: string
  /** §25.3.3 — crm_people.picture_url (null → initials) */
  pictureUrl: string | null
  /** §25.3.4 — "Last communication <date>" or null for "No communication yet" */
  lastCommLabel: string | null
  /** §25.3.4 — price pill value (crm_people.price), null hides it */
  priceTarget: number | null
  /** href for back chevron */
  backHref: string
  /** Per-tab default: which tab to show first */
  defaultTab?: MobileTabKey

  /** §25.3.2 header Edit mode — first/last name + phones + emails (punch #2). */
  editData: MobileEditData

  /* §25.5–25.9 tab slot content — server-rendered nodes */
  infoTab: React.ReactNode
  commsTab: React.ReactNode
  activityTab: React.ReactNode
  homesTab: React.ReactNode
  notesTab: React.ReactNode
  calendarTab: React.ReactNode
}

/* ── Price pill ─────────────────────────────────────────────────────────────── */

function formatPrice(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
  if (n >= 1_000) return `$${Math.round(n / 1_000)}K`
  return `$${Math.round(n).toLocaleString('en-US')}`
}

/* ── Main component ─────────────────────────────────────────────────────────── */

export function MobileContactDetail({
  personId,
  displayName,
  pictureUrl,
  lastCommLabel,
  priceTarget,
  backHref,
  defaultTab = 'info',
  editData,
  infoTab,
  commsTab,
  activityTab,
  homesTab,
  notesTab,
  calendarTab,
}: MobileContactDetailProps) {
  const [active, setActive] = useState<MobileTabKey>(defaultTab)
  const [editOpen, setEditOpen] = useState(false)
  const router = useRouter()
  const stripRef = useRef<HTMLDivElement | null>(null)

  // P2-3 (2026-07-02 mobile audit): keep the active tab visible — at 390 the
  // 6-tab strip overflows and a deep-linked Calendar/Notes tab (FAB hash, ?tab=)
  // left its underline off-screen. Center the active button in the strip.
  useEffect(() => {
    const strip = stripRef.current
    if (!strip) return
    const btn = strip.querySelector<HTMLButtonElement>(`[data-tab-key="${active}"]`)
    if (!btn) return
    const target = btn.offsetLeft - (strip.clientWidth - btn.clientWidth) / 2
    strip.scrollTo({ left: Math.max(0, target), behavior: 'smooth' })
  }, [active])

  // Phones only: flag the root while Comms is the active tab so the shell's
  // floating controls ("+" quick action, "?" help — both bottom-20) hide
  // instead of covering the pinned SMS composer (2026-07-15 mobile audit).
  // This component stays MOUNTED at md+ (the wrapper is only CSS-hidden), so
  // gate on the same breakpoint or the desktop FAB would vanish too.
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    const apply = () =>
      document.documentElement.toggleAttribute('data-crm-comms', active === 'comms' && mq.matches)
    apply()
    mq.addEventListener('change', apply)
    return () => {
      mq.removeEventListener('change', apply)
      document.documentElement.removeAttribute('data-crm-comms')
    }
  }, [active])

  // The shell FAB's lead actions deep-link via hash (#comms / #tasks /
  // #overview) — the desktop LeadTabs reads them, and so must this component,
  // or the FAB actions are dead at < md (punch #6, 2026-07-02).
  useEffect(() => {
    const HASH_TO_TAB: Record<string, MobileTabKey> = {
      overview: 'info',
      comms: 'comms',
      activity: 'activity',
      homes: 'homes',
      notes: 'notes',
      tasks: 'calendar',
      calendar: 'calendar',
    }
    const sync = () => {
      const key = HASH_TO_TAB[window.location.hash.replace(/^#/, '')]
      if (key) setActive(key)
    }
    sync()
    window.addEventListener('hashchange', sync)
    return () => window.removeEventListener('hashchange', sync)
  }, [])

  const tabContent: Record<MobileTabKey, React.ReactNode> = {
    info: infoTab,
    comms: commsTab,
    activity: activityTab,
    homes: homesTab,
    notes: notesTab,
    calendar: calendarTab,
  }

  return (
    // min-h-dvh, not min-h-screen: 100vh on iOS is the LARGEST viewport (URL
    // bar collapsed), which over-stretches the page and pushes bottom-docked
    // content below the visible edge when the bar is expanded.
    <div className="relative flex min-h-dvh flex-col">
      {/* ── §25.3 Header — one surface continuous through the tab strip ────── */}
      <div
        style={{
          paddingTop: 'env(safe-area-inset-top)',
          background: 'var(--a-surface)',
          color: 'var(--a-text)',
          borderBottom: '1px solid var(--a-border)',
        }}
      >
        {/* §25.3.2 Back row (44 pt / h-11) */}
        <div className="flex h-11 items-center justify-between px-4">
          <button
            type="button"
            onClick={() => router.push(backHref)}
            className="-ml-1 flex items-center p-1"
            style={{ color: 'var(--a-text)' }}
            aria-label="Back"
          >
            <ChevronLeft size={22} strokeWidth={2.5} />
          </button>
          {/* §25.3.2 — "Edit" appears only on Info tab (punch #2: opens the
              real edit sheet — name + phones + emails) */}
          {active === 'info' && (
            <button
              type="button"
              className="text-sm"
              style={{ color: 'var(--a-accent)' }}
              onClick={() => setEditOpen(true)}
            >
              Edit
            </button>
          )}
        </div>

        {/* §25.3.3/25.3.4 Avatar + name + subtitle block */}
        <div className="flex items-center gap-3 px-4 pb-3">
          {/* §25.3.3: 56 pt circular avatar */}
          <CrmAvatar name={displayName} src={pictureUrl} size={56} className="shrink-0" />

          <div className="min-w-0 flex-1">
            {/* §25.3.4 Name: 600 weight, ~20 pt, primary text */}
            <p
              className="truncate text-xl font-semibold leading-tight"
              style={{ color: 'var(--a-text)' }}
            >
              {displayName}
            </p>
            {/* §25.3.4 Subtitle row */}
            <div className="mt-0.5 flex items-center gap-2">
              <p className="text-[13px]" style={{ color: 'var(--a-text-2)' }}>
                {lastCommLabel ? `Last communication ${lastCommLabel}` : 'No communication yet'}
              </p>
              {/* §25.3.4 Price pill — renders only when priceTarget non-null (AC-H-6) */}
              {priceTarget != null && (
                <span
                  className="rounded-full px-2 py-0.5 text-xs font-semibold"
                  style={{ background: 'var(--a-ok-wash)', color: 'var(--a-ok)' }}
                >
                  {formatPrice(priceTarget)}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* §25.4 Sub-tab strip — 44 pt, same surface, horizontally scrollable */}
        <div
          ref={stripRef}
          className="no-scrollbar flex overflow-x-auto"
          role="tablist"
          aria-label="Contact sections"
        >
          {TABS.map((tab) => {
            const isActive = active === tab.key
            return (
              <button
                key={tab.key}
                data-tab-key={tab.key}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActive(tab.key)}
                className={cn(
                  'relative h-11 shrink-0 whitespace-nowrap px-4 text-sm transition-colors',
                  isActive ? 'font-semibold' : 'font-normal',
                )}
                style={{ color: isActive ? 'var(--a-text)' : 'var(--a-text-2)' }}
              >
                {tab.label}
                {/* §25.4.3 Active underline: 2.5 px accent bar, flush to strip
                    bottom. The admin language keeps ONE action accent, so the
                    CRM teal translates to it. */}
                {isActive && (
                  <span
                    className="absolute bottom-0 left-0 right-0 h-[2.5px] rounded-t"
                    style={{ backgroundColor: 'var(--a-accent)' }}
                  />
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Tab content area (page background) ──────────────────────────────── */}
      <div className="flex-1" style={{ background: 'var(--a-bg)' }}>
        {TABS.map((tab) => (
          <div
            key={tab.key}
            role="tabpanel"
            className={tab.key === active ? 'block' : 'hidden'}
          >
            {tabContent[tab.key]}
          </div>
        ))}
      </div>

      {/* §25.12 FAB — provided by the shell's ConsoleQuickAction (single FAB
          rule). Rendering a second one here produced two stacked + buttons. */}

      {/* §25.3.2 Edit mode (punch #2) — full-screen z-50 sheet */}
      {editOpen ? (
        <MobileEditSheet personId={personId} initial={editData} onClose={() => setEditOpen(false)} />
      ) : null}
    </div>
  )
}
