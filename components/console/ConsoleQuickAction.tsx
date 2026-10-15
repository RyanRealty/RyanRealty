'use client'

/**
 * ConsoleQuickAction — the global "+" quick-action FAB (Matt: "very powerful").
 *
 * docs/MOBILE_CRM_PARITY.md #2. CRM's mobile "+" is a flat create menu. Ours
 * beats it two ways:
 *   1. Context-aware — on a lead it pre-targets that lead and adds actions CRM
 *      has no concept of (Enroll in a workflow, Start a CMA), each deep-linking
 *      into the lead's own tab via a hash that LeadTabs reads.
 *   2. Recommendation-led — on a lead it surfaces the single best next action at
 *      the top, pulled live from our sequence engine (getNextRecommendation).
 *
 * Mounted once in ConsoleShell, so it rides every console surface. Every action
 * points at a route that actually exists (the ci:dead-ui / ci:nav-reachability
 * gates reject dead links), so nothing here is a decorative button.
 */

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useLayoutEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  Plus, Phone, MessageSquare, Mail, StickyNote, CheckSquare, Workflow, Calculator,
  UserPlus, Briefcase, PenSquare, ListChecks, Zap, X,
} from 'lucide-react'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { useIsMobile } from '@/hooks/use-mobile'
import { getNextRecommendation, type CrmNextRec } from '@/app/actions/crm-next-rec'
import { cn } from '@/lib/utils'
import { isLeadPageV3Enabled } from '@/lib/admin/lead-page-v3'
import { ADMIN_FAB_HEADER_SLOT_ID, isConsoleFabSuppressed } from '@/lib/admin/queue-defaults'

const LG_PX = 1024
const FAB_STYLE = { backgroundColor: 'var(--a-btn-bg, var(--console-info))', color: 'var(--a-btn-fg, #fff)' } as const
const FAB_DESKTOP =
  'hidden lg:flex fixed bottom-5 right-5 z-40 h-14 w-14 items-center justify-center rounded-full text-primary-foreground shadow-lg transition-transform hover:scale-105 active:scale-95 [[data-crm-comms]_&]:hidden [[data-kb-open]_&]:hidden'
const FAB_HEADER =
  'flex h-10 w-10 items-center justify-center rounded-full text-primary-foreground shadow-sm transition-transform hover:scale-105 active:scale-95 lg:hidden [[data-crm-comms]_&]:hidden [[data-kb-open]_&]:hidden'

function useBelowLg(): boolean {
  const [below, setBelow] = useState(false)
  useLayoutEffect(() => {
    const mql = window.matchMedia(`(max-width: ${LG_PX - 1}px)`)
    const apply = () => setBelow(mql.matches)
    apply()
    mql.addEventListener('change', apply)
    return () => mql.removeEventListener('change', apply)
  }, [])
  return below
}

function useHeaderSlot(): HTMLElement | null {
  const [slot, setSlot] = useState<HTMLElement | null>(null)
  useLayoutEffect(() => {
    setSlot(document.getElementById(ADMIN_FAB_HEADER_SLOT_ID))
  }, [])
  return slot
}

type Item = { label: string; href: string; icon: React.ComponentType<{ className?: string }> }

// Create surfaces that exist anywhere in the console — always available.
const GLOBAL: Item[] = [
  { label: 'New contact', href: '/admin/crm#add-person', icon: UserPlus },
  { label: 'New task', href: '/admin/crm/tasks', icon: CheckSquare },
  { label: 'View pipeline', href: '/admin/crm/deals', icon: Briefcase },
  { label: 'Compose email', href: '/admin/messages/new?channel=email', icon: PenSquare },
  { label: 'Text', href: '/admin/messages/new', icon: MessageSquare },
  { label: 'Start a CMA', href: '/admin/valuations', icon: Calculator },
  { label: 'Workflows', href: '/admin/crm/sequences', icon: ListChecks },
]

function leadIdFrom(pathname: string): number | null {
  // The person surface lives at /admin/people/:id (11B, 2026-08-06 — with the
  // relocated full workspace at /admin/people/:id/tools). /admin/crm/:id is a
  // redirect bridge, but the client pathname can still show it briefly, so
  // both routes are recognized.
  const m = pathname.match(/^\/admin\/(?:people|crm)\/(\d+)(?:\/tools)?$/)
  return m ? Number(m[1]) : null
}

function ActionGrid({ items, onPick }: { items: Item[]; onPick: () => void }) {
  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
      {items.map((it) => {
        const cls =
          'flex flex-col items-center gap-1.5 rounded-xl border border-border bg-card p-3 text-center transition-colors hover:border-foreground/30 hover:bg-accent'
        const inner = (
          <>
            <it.icon className="h-5 w-5 text-muted-foreground" />
            <span className="text-xs font-medium text-foreground">{it.label}</span>
          </>
        )
        // Same-page hash links must be plain anchors: Next's <Link> uses
        // history.pushState, which does NOT fire `hashchange`, so LeadTabs would
        // never see the deep link. A native anchor fires it.
        return it.href.includes('#') ? (
          <a key={it.label} href={it.href} onClick={onPick} className={cls}>{inner}</a>
        ) : (
          <Link key={it.label} href={it.href} onClick={onPick} className={cls}>{inner}</Link>
        )
      })}
    </div>
  )
}

function HeaderFabLink() {
  return (
    <a href="#add-person" aria-label="New contact" className={FAB_HEADER} style={FAB_STYLE}>
      <UserPlus className="h-5 w-5" />
    </a>
  )
}

function HeaderFabButton({ onOpen }: { onOpen: () => void }) {
  return (
    <button type="button" onClick={onOpen} aria-label="Quick actions" className={FAB_HEADER} style={FAB_STYLE}>
      <Plus className="h-5 w-5" />
    </button>
  )
}

export default function ConsoleQuickAction() {
  const pathname = usePathname() ?? ''
  const leadId = leadIdFrom(pathname)
  const isMobile = useIsMobile()
  // §26: the mobile inbox owns its own FAB (compose sheet) — a second generic
  // FAB there violates the single-FAB rule (§25.12 / mob-02). Hooks above run
  // unconditionally; bail before render only.
  const suppressed = isConsoleFabSuppressed(pathname)
  // §29: the mobile Calendar (Screen A) + Tasks (Screen C) own their FABs at
  // < md; the desktop layouts keep this quick action (they have no §29 FAB).
  const mobileSuppressed =
    pathname.startsWith('/admin/crm/calendar') || pathname.startsWith('/admin/crm/tasks')
  const [open, setOpen] = useState(false)
  const [rec, setRec] = useState<CrmNextRec | null>(null)
  const [recLoading, setRecLoading] = useState(false)
  const [hideOnLeadV3, setHideOnLeadV3] = useState(false)
  const belowLg = useBelowLg()
  const headerSlot = useHeaderSlot()

  useEffect(() => {
    const personOnly = /^\/admin\/(?:people|crm)\/\d+$/.test(pathname)
    if (!personOnly || typeof document === 'undefined') {
      setHideOnLeadV3(false)
      return
    }
    const q = new URLSearchParams(window.location.search)
    const cookie = document.cookie
      .split(';')
      .map((part) => part.trim())
      .find((part) => part.startsWith('rr_lead_page_v3='))
    setHideOnLeadV3(
      isLeadPageV3Enabled({
        searchParams: { v: q.get('v'), 'lead-page-v3': q.get('lead-page-v3') },
        cookie: cookie ? cookie.slice('rr_lead_page_v3='.length) : null,
      }),
    )
  }, [pathname])

  // Lazy-load the recommended next action only when the sheet opens on a lead.
  useEffect(() => {
    if (!open || !leadId) { setRec(null); return }
    let live = true
    setRecLoading(true)
    getNextRecommendation(leadId)
      .then((r) => { if (live) setRec(r) })
      .catch(() => { if (live) setRec(null) })
      .finally(() => { if (live) setRecLoading(false) })
    return () => { live = false }
  }, [open, leadId])

  const close = () => setOpen(false)

  // Lead-scoped actions deep-link into that lead's own tab (LeadTabs reads the hash).
  // At < md, Send text / Send email go to the IN-APP inbox composers instead —
  // the mobile Comms tab is a read-only feed, so the hash deep-link left phone
  // users with nothing to type into (2026-07-02 mobile audit; same ?m= deep
  // links the lead-detail SMS/Email circles use, punch #4).
  const leadActions: Item[] = leadId
    ? [
        { label: 'Call', href: '#overview', icon: Phone },
        {
          label: 'Send text',
          href: isMobile ? `/admin/messages?c=${leadId}&m=sms` : '#comms',
          icon: MessageSquare,
        },
        {
          label: 'Send email',
          href: isMobile ? `/admin/messages?c=${leadId}&m=email` : '#comms',
          icon: Mail,
        },
        // #notes: the mobile detail has a dedicated Notes tab (the mobile map
        // sends notes→notes); desktop aliases notes→comms where its note
        // composer lives (2026-07-02 mobile audit — was #comms, which dropped
        // phone users on a read-only feed with no note affordance).
        { label: 'Add note', href: '#notes', icon: StickyNote },
        { label: 'Add task', href: '#tasks', icon: CheckSquare },
        { label: 'Enroll in workflow', href: '#overview', icon: Workflow },
        { label: 'Start a CMA', href: '/admin/valuations', icon: Calculator },
      ]
    : []

  if (suppressed || hideOnLeadV3) return null
  // Mobile person detail: phone/text live on Info rows + Comms composer. The
  // global + FAB stacked on those circles (overlapping +/chat/phone). Hide at
  // < md on a lead; desktop keeps the sheet.
  if (leadId && isMobile) return null

  const addPersonSurface =
    !leadId && (pathname === '/admin/people' || pathname === '/admin/crm')
  const hideHeaderFab = Boolean(mobileSuppressed && isMobile)
  const portalHeader =
    belowLg && headerSlot && !hideHeaderFab
      ? createPortal(
          addPersonSurface ? (
            <HeaderFabLink />
          ) : (
            <HeaderFabButton onOpen={() => setOpen(true)} />
          ),
          headerSlot,
        )
      : null

  if (addPersonSurface) {
    return (
      <>
        {portalHeader}
        <a
          href="#add-person"
          aria-label="New contact"
          className={cn(FAB_DESKTOP, mobileSuppressed && 'max-md:hidden')}
          style={FAB_STYLE}
        >
          <UserPlus className="h-6 w-6" />
        </a>
      </>
    )
  }

  return (
    <>
      {portalHeader}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Quick actions"
        className={cn(
          // Desktop only: phones portal this into ADMIN_FAB_HEADER_SLOT_ID so
          // the + cannot cover Today's Open, People chevrons, or Listings rows.
          FAB_DESKTOP,
          // §29 single-FAB rule: hidden at < md on calendar/tasks (their own FAB).
          mobileSuppressed && 'max-md:hidden',
        )}
        style={FAB_STYLE}
      >
        <Plus className="h-6 w-6" />
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="max-h-[85vh] gap-0 overflow-y-auto rounded-t-2xl px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4">
          <SheetTitle className="text-base">Quick actions</SheetTitle>

          {leadId ? (
            <div className="mt-3 space-y-3">
              {/* Recommendation engine — the single best next move on this lead */}
              {recLoading ? (
                <div className="rounded-xl border border-border bg-secondary px-3 py-2.5 text-sm text-muted-foreground">Checking the best next step…</div>
              ) : rec ? (
                <a
                  href="#overview"
                  onClick={close}
                  className="flex items-start gap-2.5 rounded-xl border px-3 py-2.5"
                  style={{ borderColor: 'var(--console-info)', backgroundColor: 'var(--console-info-soft)' }}
                >
                  <Zap className="mt-0.5 h-4 w-4 shrink-0" style={{ color: 'var(--console-info-strong)' }} />
                  <span className="min-w-0">
                    <span className="block text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--console-info-strong)' }}>Recommended next</span>
                    <span className="block truncate text-sm font-medium text-foreground">
                      {rec.channel === 'sms' ? 'Send a text' : rec.channel === 'email' ? 'Send an email' : 'Next step'} · {rec.sequenceName}
                    </span>
                  </span>
                </a>
              ) : null}

              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">On this lead</div>
              <ActionGrid items={leadActions} onPick={close} />
            </div>
          ) : null}

          <div className={cn('space-y-3', leadId ? 'mt-5 border-t border-border pt-4' : 'mt-3')}>
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Create</div>
            <ActionGrid items={GLOBAL} onPick={close} />
          </div>

          <button
            type="button"
            onClick={close}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl border border-border py-2.5 text-sm font-medium text-foreground hover:bg-accent"
          >
            <X className="h-4 w-4" /> Cancel
          </button>
        </SheetContent>
      </Sheet>
    </>
  )
}
