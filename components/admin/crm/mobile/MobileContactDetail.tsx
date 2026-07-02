'use client'

/**
 * MobileContactDetail — §25 (docs/fub-crm-spec/25-mobile-contact-detail.md)
 *
 * The mobile Contact Detail / Lead Profile rendered at < md (~390 px).
 * Matches the FUB iOS reference exactly:
 *   - Navy bg-primary header continuous through the sub-tab strip (§25.3, §25.4)
 *   - Sub-tab strip: Info · Comms · Homes · Notes · Calendar (horizontally scrollable)
 *   - Active tab: white Geist 600 + 2.5 px bg-accent bottom underline
 *   - Inactive: white/60
 *   - Tab content swap in-place (no navigation push for tab changes)
 *   - FAB (bg-primary circle, white +) per-tab at bottom-right
 *
 * Desktop layout is UNCHANGED — this component is wrapped in `md:hidden` at
 * the call site; the existing LeadTabs remains visible on md+.
 *
 * §25.1 token map: navy #102742 → bg-primary; cream #faf8f4 → bg-background;
 *   content area ~#EEF1F5 → bg-secondary; card white → bg-card;
 *   accent underline → bg-accent; inactive tabs → text-primary-foreground/60
 */

import { useEffect, useRef, useState } from 'react'
import { ChevronLeft } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { CrmAvatar } from '@/components/admin/crm/mobile/CrmMobileKit'
import MobileEditSheet, { type MobileEditData } from '@/components/admin/crm/mobile/MobileEditSheet'

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
    <div className="relative flex min-h-screen flex-col">
      {/* ── §25.3 Header — bg-primary continuous through tab strip ─────────── */}
      <div
        className="bg-primary text-primary-foreground"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        {/* §25.3.2 Back row (44 pt / h-11) */}
        <div className="flex h-11 items-center justify-between px-4">
          <button
            type="button"
            onClick={() => router.push(backHref)}
            className="-ml-1 flex items-center p-1 text-primary-foreground"
            aria-label="Back"
          >
            <ChevronLeft size={22} strokeWidth={2.5} />
          </button>
          {/* §25.3.2 — "Edit" appears only on Info tab (punch #2: opens the
              real edit sheet — name + phones + emails) */}
          {active === 'info' && (
            <button
              type="button"
              className="text-sm text-primary-foreground"
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
            {/* §25.3.4 Name: Geist 600 ~20 pt white */}
            <p className="truncate text-xl font-semibold leading-tight text-primary-foreground">
              {displayName}
            </p>
            {/* §25.3.4 Subtitle row */}
            <div className="mt-0.5 flex items-center gap-2">
              <p className="text-[13px] text-primary-foreground/70">
                {lastCommLabel ? `Last communication ${lastCommLabel}` : 'No communication yet'}
              </p>
              {/* §25.3.4 Price pill — renders only when priceTarget non-null (AC-H-6) */}
              {priceTarget != null && (
                <span className="rounded-full bg-success px-2 py-0.5 text-xs font-semibold text-success-foreground">
                  {formatPrice(priceTarget)}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* §25.4 Sub-tab strip — 44 pt, bg-primary, horizontally scrollable */}
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
                  isActive
                    ? 'font-semibold text-primary-foreground'
                    : 'font-normal text-primary-foreground/60',
                )}
              >
                {tab.label}
                {/* §25.4.3 Active underline: 2.5 px accent bar, flush to strip
                    bottom. console-root's --accent is a near-white neutral, so
                    the FUB teal translates to the console link accent instead. */}
                {isActive && (
                  <span
                    className="absolute bottom-0 left-0 right-0 h-[2.5px] rounded-t"
                    style={{ backgroundColor: 'var(--console-info)' }}
                  />
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Tab content area (bg-secondary) ─────────────────────────────────── */}
      <div className="flex-1 bg-secondary">
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
