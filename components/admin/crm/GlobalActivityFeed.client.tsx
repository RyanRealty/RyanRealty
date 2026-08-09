'use client'

/**
 * GlobalActivityFeed — the CRM-wide activity stream for the Activity tab (FUB
 * "Activity" parity). The user includes/excludes activity TYPES (emails, texts,
 * website visits, calls, notes, new leads, updates) with independent toggle
 * chips; the feed re-fetches the union. Same visual language as
 * ContactActivityFeed, with the contact's name linking to their record, grouped
 * under day dividers, newest first. "Load more" pages through the same selection.
 *
 * 11F: on the LOCKED admin v2 language (design_system/admin/ADMIN_UI.md).
 * PRESENTATION ONLY — same hooks in the same order, same server action, same
 * refetch-on-change data flow, same strings.
 *
 * The two shadcn DropdownMenus became FilterPopover (below) rather than the v2
 * Menu primitive: Menu is an ACTIONS menu and closes on every item click, while
 * a filter set has to stay open while it is being changed — which is exactly
 * why the Radix original called e.preventDefault() in onSelect. The panel
 * reuses the av2-menu / av2-menu__panel token classes and the v2 field
 * primitives for each row, the same idiom already shipped as the tasks
 * "Filters ▾" panel (crm/tasks/_components/TasksView.tsx). Still ONE compact
 * control per filter set (acceptance bar #2) — no chip row was introduced.
 */
import { useEffect, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { cleanContactName } from '@/lib/crm/display-name'
import {
  Activity, ArrowDownLeft, ArrowUpRight, ChevronDown, EyeOff, FileText, Globe, Mail, MailOpen,
  MessageSquare, Milestone, Phone, SlidersHorizontal, UserPlus, Users, Voicemail, type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button, ToolbarCheck, ToolbarRadio } from '@/components/admin/v2'
import type { ActivityCategory } from '@/lib/data/crm/getContactActivityFeed'
import type { GlobalActivityItem } from '@/lib/data/crm/getGlobalActivityFeed'
import { groupByDay, relativeTime } from '@/lib/format/activity-feed'
import { loadGlobalActivity } from '@/app/actions/crm-activity'

type TypeChip = { key: string; label: string }

/** Secondary text + icon tint — the one colour the old semantic utility carried. */
const QUIET: React.CSSProperties = { color: 'var(--a-text-2)' }
/** The panel's section caption (was DropdownMenuLabel). */
const PANEL_LABEL: React.CSSProperties = {
  padding: '4px 8px',
  fontSize: 'var(--a-text-xs)',
  fontWeight: 600,
  color: 'var(--a-text-2)',
}
/** One option row inside a panel. */
const PANEL_ROW: React.CSSProperties = { padding: '4px 8px' }
/** Option captions read as primary content, as they did in the Radix menu. */
const PANEL_ROW_LABEL: React.CSSProperties = { color: 'var(--a-text)' }
/** Was DropdownMenuSeparator. */
const PANEL_RULE: React.CSSProperties = { borderTop: '1px solid var(--a-border)', margin: '4px 0' }

function iconFor(item: GlobalActivityItem): LucideIcon {
  if (item.kind === 'lead_created') return UserPlus
  if (item.kind === 'voicemail') return Voicemail
  if (item.kind === 'email_open') return MailOpen
  const byCategory: Record<ActivityCategory, LucideIcon> = {
    message: MessageSquare, email: Mail, call: Phone, note: FileText,
    system: Activity, milestone: Milestone, web: Globe, other: Activity,
  }
  return byCategory[item.category]
}

/**
 * The direction dot's tint. A style rather than a class list: the admin tokens
 * carry no alpha variants, so the old success/10 + success/30 pairing becomes
 * the status wash plus its full-strength ring — the same substitution already
 * shipped on /admin/analytics.
 */
function chipStyle(direction: GlobalActivityItem['direction']): React.CSSProperties {
  if (direction === 'in') return { borderColor: 'var(--a-ok)', background: 'var(--a-ok-wash)', color: 'var(--a-ok)' }
  if (direction === 'out') return { borderColor: 'var(--a-accent)', background: 'var(--a-accent-wash)', color: 'var(--a-accent)' }
  // --a-surface, not --a-inset: the row it sits in paints --a-inset on hover,
  // and an identical fill made the neutral chip dissolve into the row with only
  // its hairline left. The old pairing did not collide (bg-muted chip vs a 40%
  // wash of the same colour on the row).
  return { borderColor: 'var(--a-border)', background: 'var(--a-surface)', color: 'var(--a-text-2)' }
}

function DirectionTag({ direction }: { direction: GlobalActivityItem['direction'] }) {
  if (direction === 'in') return <span className="inline-flex items-center gap-0.5" style={{ color: 'var(--a-ok)' }}><ArrowDownLeft className="h-3 w-3" aria-hidden />In</span>
  if (direction === 'out') return <span className="inline-flex items-center gap-0.5" style={{ color: 'var(--a-accent)' }}><ArrowUpRight className="h-3 w-3" aria-hidden />Out</span>
  return null
}

/**
 * A filter set in one compact control: a v2 Button trigger plus a panel drawn
 * with the av2-menu token classes. Click-outside closes; Escape closes and
 * returns focus to the trigger (what Radix did).
 *
 * `closeOnChange` reproduces the difference between the two Radix menus this
 * replaced: the checkbox items called e.preventDefault() in onSelect and left
 * the menu open, the radio items did not and closed it. React's change event
 * bubbles, so the panel can honour that itself rather than handing a closer
 * down to every row.
 */
function FilterPopover({
  label,
  panelLabel,
  icon,
  disabled,
  minWidth,
  closeOnChange = false,
  children,
}: {
  /** Trigger caption — the current selection. */
  label: string
  /** Accessible name for the panel, and its visible caption at the call site. */
  panelLabel: string
  icon: React.ReactNode
  disabled?: boolean
  minWidth: number
  /** Dismiss the panel when a control inside it commits a value. */
  closeOnChange?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  // Escape and an in-panel selection hand focus BACK to the trigger (Radix
  // did); an outside click does not, because focus belongs to whatever was
  // clicked.
  function close() {
    setOpen(false)
    triggerRef.current?.focus()
  }

  useEffect(() => {
    if (!open) return
    function onDocDown(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false)
        triggerRef.current?.focus()
      }
    }
    document.addEventListener('mousedown', onDocDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={wrapRef} className="av2-menu">
      <Button
        ref={triggerRef}
        type="button"
        variant="quiet"
        disabled={disabled}
        className="gap-2"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {icon}
        {label}
        <ChevronDown className="h-4 w-4" style={QUIET} aria-hidden />
      </Button>
      {open ? (
        <div
          className="av2-menu__panel"
          // NOT role="menu". Its children are ToolbarCheck / ToolbarRadio, which
          // render bare <input type=checkbox|radio> — the Radix originals were
          // menuitemcheckbox/menuitemradio, so the role had matching children.
          // Declaring "menu" over plain inputs tells a screen reader to expect
          // menu items and then offers none. role="group" describes what this
          // actually is: a labelled set of form controls.
          role="group"
          aria-label={panelLabel}
          data-align="start"
          style={{ minWidth }}
          onChange={closeOnChange ? close : undefined}
        >
          {children}
        </div>
      ) : null}
    </div>
  )
}

type BrokerOption = { value: string; label: string }

export default function GlobalActivityFeed({
  initialItems,
  initialCursor,
  allTypes,
  initialSelected,
  brokerOptions = [],
  initialBroker = 'all',
}: {
  initialItems: GlobalActivityItem[]
  initialCursor: string | null
  allTypes: TypeChip[]
  initialSelected: string[]
  /** Broker scope options — empty for a restricted broker (locked to their leads). */
  brokerOptions?: BrokerOption[]
  initialBroker?: string
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set(initialSelected))
  const [broker, setBroker] = useState<string>(initialBroker)
  const [items, setItems] = useState<GlobalActivityItem[]>(initialItems)
  const [cursor, setCursor] = useState<string | null>(initialCursor)
  const [pending, startTransition] = useTransition()

  function refetch(nextTypes: Set<string>, nextBroker: string) {
    startTransition(async () => {
      const res = await loadGlobalActivity({ types: [...nextTypes], broker: nextBroker })
      setItems(res.items)
      setCursor(res.nextCursor)
    })
  }

  function toggle(key: string) {
    const next = new Set(selected)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    setSelected(next)
    refetch(next, broker)
  }

  function setAll(on: boolean) {
    const next = on ? new Set(allTypes.map((t) => t.key)) : new Set<string>()
    setSelected(next)
    refetch(next, broker)
  }

  function pickBroker(value: string) {
    setBroker(value)
    refetch(selected, value)
  }

  function loadMore() {
    if (!cursor) return
    startTransition(async () => {
      const res = await loadGlobalActivity({ types: [...selected], broker, before: cursor })
      setItems((prev) => [...prev, ...res.items])
      setCursor(res.nextCursor)
    })
  }

  const allOn = selected.size === allTypes.length
  const noneOn = selected.size === 0
  const typesLabel = noneOn ? 'No types' : allOn ? 'All types' : `${selected.size} type${selected.size === 1 ? '' : 's'}`
  const brokerLabel = brokerOptions.find((b) => b.value === broker)?.label ?? 'Everyone'
  const now = Date.now()
  const groups = groupByDay(items, now)

  // §24 mobile sub-tabs (mob-01/32/05): New Leads · Emails · Website, plus an
  // "All" tab for the mixed feed (the desktop default). Each tab pins `selected`
  // to that type; the strip only renders < md.
  const MOBILE_TABS: { key: string | null; label: string }[] = [
    { key: null, label: 'All' },
    { key: 'new_leads', label: 'New Leads' },
    { key: 'email', label: 'Emails' },
    { key: 'website', label: 'Website' },
  ]
  const activeMobileTab = selected.size === allTypes.length ? null : selected.size === 1 ? [...selected][0] : undefined

  return (
    <div>
      {/* Mobile sub-tab strip (§24 §1.4) */}
      <div
        className="-mx-4 mb-3 flex md:hidden"
        style={{ background: 'var(--a-inset)', borderBottom: '1px solid var(--a-border)' }}
      >
        {MOBILE_TABS.map((t) => {
          const isActive = activeMobileTab === t.key
          return (
            <button
              key={t.label}
              type="button"
              disabled={pending}
              onClick={() => {
                const next = t.key === null ? new Set(allTypes.map((x) => x.key)) : new Set([t.key])
                setSelected(next)
                refetch(next, broker)
              }}
              className={cn(
                'relative flex-1 py-2.5 text-center text-[14px]',
                isActive ? 'font-semibold' : 'font-normal',
              )}
              style={{ color: isActive ? 'var(--a-text)' : 'var(--a-text-2)' }}
            >
              {t.label}
              {isActive ? <span className="absolute inset-x-0 bottom-0 h-[2px]" style={{ background: 'var(--a-accent)' }} /> : null}
            </button>
          )
        })}
      </div>

      {/* Compact filter row: a multi-select Types dropdown + (owner only) a broker
          scope dropdown. Replaces the old chip sprawl. */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <FilterPopover
          label={typesLabel}
          panelLabel="Activity types"
          disabled={pending}
          minWidth={208}
          icon={<SlidersHorizontal className="h-4 w-4" style={QUIET} aria-hidden />}
        >
          <div style={PANEL_LABEL}>Activity types</div>
          {allTypes.map((t) => (
            <div key={t.key} style={PANEL_ROW}>
              <ToolbarCheck
                label={t.label}
                labelStyle={PANEL_ROW_LABEL}
                checked={selected.has(t.key)}
                onChange={() => toggle(t.key)}
              />
            </div>
          ))}
          <div style={PANEL_RULE} />
          <button type="button" className="av2-menu__item" onClick={() => setAll(!allOn)}>
            {allOn ? 'Clear all' : 'Select all'}
          </button>
        </FilterPopover>

        {brokerOptions.length > 0 ? (
          <FilterPopover
            label={brokerLabel}
            panelLabel="Show activity for"
            disabled={pending}
            minWidth={192}
            /* NOT closeOnChange. These are native radios sharing a name, and a
               native radio group COMMITS on arrow keys — ArrowDown checks the
               next broker, which fired pickBroker() AND dismissed the panel, so
               the panel could not be traversed by keyboard at all. Radix's radio
               items moved a roving highlight and only committed on Enter/Space.
               The panel now stays open; Escape and outside-click close it, and
               the scope applies as it is picked either way. */
            icon={<Users className="h-4 w-4" style={QUIET} aria-hidden />}
          >
            <div style={PANEL_LABEL}>Show activity for</div>
            {brokerOptions.map((b) => (
              <div key={b.value} style={PANEL_ROW}>
                <ToolbarRadio
                  name="global-activity-broker"
                  value={b.value}
                  label={b.label}
                  labelStyle={PANEL_ROW_LABEL}
                  checked={broker === b.value}
                  onChange={() => pickBroker(b.value)}
                />
              </div>
            ))}
          </FilterPopover>
        ) : null}
      </div>

      {noneOn ? (
        <p className="py-12 text-center text-sm" style={QUIET}>Select at least one activity type above.</p>
      ) : items.length === 0 ? (
        <p className="py-12 text-center text-sm" style={QUIET}>{pending ? 'Loading…' : 'No activity for the selected types.'}</p>
      ) : (
        <div className={cn('space-y-5 transition-opacity', pending && 'opacity-60')}>
          {groups.map((group) => (
            <section key={group.key}>
              <div className="mb-2.5 flex items-center gap-3">
                <span className="text-xs font-semibold uppercase tracking-wide" style={QUIET}>{group.label}</span>
                <span className="h-px flex-1" style={{ background: 'var(--a-border)' }} aria-hidden />
                <span className="text-xs tabular-nums" style={QUIET}>
                  {group.items.length} {group.items.length === 1 ? 'event' : 'events'}
                </span>
              </div>

              <ol className="space-y-1">
                {(group.items as GlobalActivityItem[]).map((item) => {
                  const Icon = iconFor(item)
                  const stamp = relativeTime(item.ts, now)
                  return (
                    <li key={`${item.kind}-${item.id}`} className="flex min-h-11 gap-3 rounded-lg px-1 py-1.5 transition hover:bg-[var(--a-inset)]">
                      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border" style={chipStyle(item.direction)}>
                        <Icon className="h-4 w-4" aria-hidden />
                      </span>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                          <Link href={item.href} className="text-sm font-semibold underline-offset-2 hover:underline" style={{ color: 'var(--a-text)' }}>
                            {cleanContactName(item.personName)}
                          </Link>
                          <span className="text-sm" style={QUIET}>{item.label}</span>
                          <span className="text-xs tabular-nums" style={QUIET}>{stamp}</span>
                        </div>

                        {item.snippet ? (
                          <p className="mt-0.5 line-clamp-2 break-words text-sm" style={QUIET}>{item.snippet}</p>
                        ) : item.contentHidden ? (
                          <p className="mt-0.5 inline-flex items-center gap-1 text-xs italic" style={QUIET}>
                            <EyeOff className="h-3 w-3" aria-hidden />
                            Content not synced from Follow Up Boss
                          </p>
                        ) : null}

                        {item.recordingSid ? (
                          <audio controls preload="none" src={`/api/admin/crm/recording/${item.recordingSid}`} className="mt-1.5 h-8 w-full max-w-xs">
                            <track kind="captions" />
                          </audio>
                        ) : null}

                        {/* No per-row broker label: the feed is already scoped to the
                            selected agent's leads, and item.broker is who PERFORMED the
                            action (a teammate / blast), which reads as "everyone's
                            activity" on a scoped view. */}
                        <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs" style={QUIET}>
                          {item.direction ? <DirectionTag direction={item.direction} /> : null}
                          {item.direction ? <span aria-hidden>·</span> : null}
                          <span className="capitalize">{item.category}</span>
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ol>
            </section>
          ))}

          {cursor ? (
            <div className="pt-2 text-center">
              <Button variant="quiet" onClick={loadMore} disabled={pending}>
                {pending ? 'Loading…' : 'Load more'}
              </Button>
            </div>
          ) : (
            <p className="pt-2 text-center text-xs" style={QUIET}>End of activity</p>
          )}
        </div>
      )}
    </div>
  )
}
