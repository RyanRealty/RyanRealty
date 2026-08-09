'use client'

/**
 * ScopeDropdown — the §7 agent/pond scope control ("Me ▾") in the People
 * toolbar (docs/fub-crm-spec/05-people-list-and-bulk-actions.md).
 *
 * A floating dropdown (not a flyout) with a search input and three sections:
 * Everyone / Me · PONDS (View All Ponds + named ponds) · TEAM MEMBERS (the
 * brokers, with avatars). The button label reflects the CURRENT selection.
 *
 * The selection is a VIEW-LEVEL OVERLAY carried in URL params (?broker= /
 * ?pond=), never part of a smart list's saved filter set. RBAC note: a
 * restricted broker's selection is cosmetic — listCrmPeople self-scopes and can
 * never widen past their own book regardless of what the URL passes.
 *
 * The panel is hand-built on the av2-menu classes rather than the v2 `Menu`
 * primitive: Menu takes a flat list of label-only action items, and this
 * control needs a search box, section headings, avatars and a checked state.
 * Open/close/Escape AND the APG keyboard behaviour (Arrow roving focus,
 * Home/End, focus moved into the panel on open) mirror that primitive so the
 * two match — a hand-built panel that only responds to the mouse is the
 * regression this file already shipped once.
 */

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronDown, Check } from 'lucide-react'
import { Button, SearchField } from '@/components/admin/v2'
import { CrmAvatar } from '@/components/admin/shared/mobile/CrmMobileKit'

export type ScopeBrokerOption = { slug: string; label: string; headshot: string | null }
export type ScopePondOption = { id: number; name: string }

export type ScopeSelection =
  | { kind: 'everyone' }
  | { kind: 'me' }
  | { kind: 'broker'; slug: string }
  | { kind: 'pond'; id: number }

export type ScopeDropdownProps = {
  brokers: ScopeBrokerOption[]
  ponds: ScopePondOption[]
  /** The caller's own broker slug (for "Me"), or null (no broker identity). */
  myBrokerSlug: string | null
  /** Current URL scope: ?broker= value ('all' | slug | undefined) + ?pond=. */
  currentBroker: string | undefined
  currentPond: string | undefined
  /** Params to carry when re-scoping (q/stage/tag/view). */
  carry: Record<string, string | undefined>
}

export default function ScopeDropdown({
  brokers, ponds, myBrokerSlug, currentBroker, currentPond, carry,
}: ScopeDropdownProps) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const pondsLabelId = useId()
  const teamLabelId = useId()

  // Same contract the Radix trigger carried via onOpenChange: closing clears
  // the typed query so the panel reopens unfiltered.
  useEffect(() => {
    if (!open) setQuery('')
  }, [open])

  // Radix moved focus into the content on open; a hand-built panel has to do it
  // itself or the keyboard user is left on the trigger with an open menu they
  // cannot reach. The search box is this panel's first control, so it is where
  // focus lands — Arrow keys walk from there into the items.
  useEffect(() => {
    if (!open) return
    panelRef.current?.querySelector<HTMLInputElement>('input')?.focus()
  }, [open])

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

  const current: ScopeSelection = currentPond
    ? { kind: 'pond', id: Number(currentPond) }
    : currentBroker && currentBroker !== 'all'
      ? currentBroker === myBrokerSlug
        ? { kind: 'me' }
        : { kind: 'broker', slug: currentBroker }
      : { kind: 'everyone' }

  const label = useMemo(() => {
    if (current.kind === 'me') return 'Me'
    if (current.kind === 'everyone') return 'Everyone'
    if (current.kind === 'broker') return brokers.find((b) => b.slug === current.slug)?.label ?? current.slug
    const pond = ponds.find((p) => p.id === current.id)
    const name = pond?.name ?? `Pond ${current.id}`
    return name.length > 18 ? `${name.slice(0, 18)}…` : name
  }, [current, brokers, ponds])

  const navigate = (sel: ScopeSelection) => {
    const p = new URLSearchParams()
    for (const [k, v] of Object.entries(carry)) if (v) p.set(k, v)
    if (sel.kind === 'everyone') p.set('broker', 'all')
    else if (sel.kind === 'me' && myBrokerSlug) p.set('broker', myBrokerSlug)
    else if (sel.kind === 'broker') p.set('broker', sel.slug)
    else if (sel.kind === 'pond') p.set('pond', String(sel.id))
    const qs = p.toString()
    router.push(qs ? `/admin/crm?${qs}` : '/admin/crm')
  }

  const ql = query.trim().toLowerCase()
  const matches = (s: string) => !ql || s.toLowerCase().includes(ql)

  const isActive = (sel: ScopeSelection): boolean => {
    if (sel.kind !== current.kind) return false
    if (sel.kind === 'broker' && current.kind === 'broker') return sel.slug === current.slug
    if (sel.kind === 'pond' && current.kind === 'pond') return sel.id === current.id
    return true
  }

  // Roving focus over the panel's items — the ArrowUp/ArrowDown/Home/End set
  // Radix implemented for us. Items are a mix of <button> and <a>, so query the
  // shared role rather than a tag (same rule the v2 Menu primitive follows).
  const menuItems = () =>
    Array.from(panelRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])

  const moveFocus = (dir: 1 | -1) => {
    const items = menuItems()
    if (!items.length) return
    const i = items.indexOf(document.activeElement as HTMLElement)
    // From the search box (i === -1) ArrowDown enters at the top, ArrowUp at the end.
    const next = i === -1 ? (dir === 1 ? 0 : items.length - 1) : (i + dir + items.length) % items.length
    items[next]?.focus()
  }

  const onPanelKeyDown = (e: React.KeyboardEvent) => {
    // Home/End belong to the caret while the search box has focus; everywhere
    // else in the panel they jump the item list.
    const inSearch = e.target instanceof HTMLInputElement
    if (e.key === 'ArrowDown') { e.preventDefault(); moveFocus(1) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); moveFocus(-1) }
    else if (!inSearch && e.key === 'Home') { e.preventDefault(); menuItems()[0]?.focus() }
    else if (!inSearch && e.key === 'End') { e.preventDefault(); const it = menuItems(); it[it.length - 1]?.focus() }
    // NOTE: no stopPropagation here. Escape is handled by a document-level
    // listener, and swallowing keydown inside the panel is what made the panel
    // impossible to close from the keyboard.
  }

  const Row = ({ sel, children }: { sel: ScopeSelection; children: React.ReactNode }) => {
    const active = isActive(sel)
    return (
      // The selected wash sits on a PRESENTATIONAL wrapper, not on the button.
      // Un-layered `.av2-menu__item { background:none }` outranks the whole
      // Tailwind utilities layer, and an inline background would in turn outrank
      // `.av2-menu__item:hover` — either way the row under the pointer stops
      // lighting up. role="none" keeps the button owned by the role="menu".
      <div role="none" className={active ? 'rounded-[var(--a-r-sm)] bg-[var(--a-accent-wash)]' : undefined}>
        <button
          type="button"
          role="menuitem"
          className={active ? 'av2-menu__item font-medium' : 'av2-menu__item'}
          onClick={() => {
            setOpen(false)
            navigate(sel)
          }}
        >
          {children}
          {active ? <Check className="ml-auto h-3.5 w-3.5" style={{ color: 'var(--a-accent)' }} aria-hidden /> : null}
        </button>
      </div>
    )
  }

  const sectionLabelStyle: React.CSSProperties = {
    fontSize: 'var(--a-text-xs)',
    color: 'var(--a-text-2)',
    padding: 'var(--a-s1) var(--a-s3)',
  }
  const separatorStyle: React.CSSProperties = {
    height: 1,
    background: 'var(--a-border)',
    margin: 'var(--a-s1) 0',
  }

  return (
    <div ref={wrapRef} className="av2-menu">
      <Button
        ref={triggerRef}
        variant="quiet"
        className="gap-1"
        style={{ minHeight: 32, padding: '0 10px', fontSize: 'var(--a-text-xs)' }}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          // APG menu button: Arrow keys open the panel (and stop the page scroll).
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault()
            setOpen(true)
          }
        }}
        data-testid="scope-dropdown"
      >
        {label}
        <ChevronDown className="h-3.5 w-3.5" style={{ color: 'var(--a-text-2)' }} aria-hidden />
      </Button>
      {open ? (
        <div
          ref={panelRef}
          className="av2-menu__panel"
          data-align="start"
          role="menu"
          aria-label="Scope"
          style={{ width: '16rem' }}
          onKeyDown={onPanelKeyDown}
        >
          <div className="p-1.5">
            <SearchField
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search"
              // type=text, not SearchField's default type=search: the browser's
              // own clear affordance was never part of this control.
              type="text"
              aria-label="Search scope options"
              style={{ width: '100%', maxWidth: 'none' }}
            />
          </div>
          {/* role="separator" — a role="menu" owns menuitems, groups and
              separators; a bare styled div is none of the three. */}
          <div role="separator" aria-orientation="horizontal" style={separatorStyle} />
          {matches('everyone') ? <Row sel={{ kind: 'everyone' }}>Everyone</Row> : null}
          {myBrokerSlug && matches('me') ? <Row sel={{ kind: 'me' }}>Me</Row> : null}

          {ponds.length > 0 ? (
            <>
              <div role="separator" aria-orientation="horizontal" style={separatorStyle} />
              {/* The section heading names a GROUP of items — that is what the
                  Radix menu label carried and what makes it announceable. */}
              <div role="group" aria-labelledby={pondsLabelId}>
                <div id={pondsLabelId} className="uppercase tracking-widest" style={sectionLabelStyle}>Ponds</div>
                <Link
                  href="/admin/crm/settings/ponds"
                  role="menuitem"
                  className="av2-menu__item"
                  onClick={() => setOpen(false)}
                >
                  View All Ponds
                </Link>
                {ponds.filter((p) => matches(p.name)).map((p) => (
                  <Row key={p.id} sel={{ kind: 'pond', id: p.id }}>{p.name}</Row>
                ))}
              </div>
            </>
          ) : null}

          <div role="separator" aria-orientation="horizontal" style={separatorStyle} />
          <div role="group" aria-labelledby={teamLabelId}>
            <div id={teamLabelId} className="uppercase tracking-widest" style={sectionLabelStyle}>Team members</div>
            {brokers.filter((b) => matches(b.label)).map((b) => (
              <Row key={b.slug} sel={b.slug === myBrokerSlug ? { kind: 'me' } : { kind: 'broker', slug: b.slug }}>
                <CrmAvatar name={b.label} src={b.headshot} size={20} />
                {b.label}
              </Row>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}
