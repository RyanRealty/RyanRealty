'use client'

/**
 * ConsoleQuickAction — the global "+" quick-action FAB (Matt: "very powerful").
 *
 * docs/MOBILE_CRM_FUB_PARITY.md #2. FUB's mobile "+" is a flat create menu. Ours
 * beats it two ways:
 *   1. Context-aware — on a lead it pre-targets that lead and adds actions FUB
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
import { useEffect, useState } from 'react'
import {
  Plus, Phone, MessageSquare, Mail, StickyNote, CheckSquare, Workflow, Calculator,
  UserPlus, Briefcase, PenSquare, ListChecks, Zap, X,
} from 'lucide-react'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { getNextRecommendation, type CrmNextRec } from '@/app/actions/crm'
import { cn } from '@/lib/utils'
import { isPushedDetailPath } from '@/components/console/pushed-detail'

type Item = { label: string; href: string; icon: React.ComponentType<{ className?: string }> }

// Create surfaces that exist anywhere in the console — always available.
const GLOBAL: Item[] = [
  { label: 'New contact', href: '/admin/crm/new', icon: UserPlus },
  { label: 'New task', href: '/admin/crm/tasks', icon: CheckSquare },
  { label: 'View pipeline', href: '/admin/crm/deals', icon: Briefcase },
  { label: 'Compose email', href: '/admin/email/compose', icon: PenSquare },
  { label: 'Start a CMA', href: '/admin/cmas', icon: Calculator },
  { label: 'Workflows', href: '/admin/crm/sequences', icon: ListChecks },
]

function leadIdFrom(pathname: string): number | null {
  // Match both the console shell (/admin/console/leads/:id) and the CRM shell
  // (/admin/crm/:id) so the FAB shows lead-scoped actions regardless of which
  // route the broker arrived from (dashboard action-queue links use /admin/crm/:id).
  const m = pathname.match(/^\/admin\/(?:console\/leads|crm)\/(\d+)$/)
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
        return it.href.startsWith('#') ? (
          <a key={it.label} href={it.href} onClick={onPick} className={cls}>{inner}</a>
        ) : (
          <Link key={it.label} href={it.href} onClick={onPick} className={cls}>{inner}</Link>
        )
      })}
    </div>
  )
}

export default function ConsoleQuickAction() {
  const pathname = usePathname() ?? ''
  const leadId = leadIdFrom(pathname)
  // §26: the mobile inbox owns its own FAB (compose sheet) — a second generic
  // FAB there violates the single-FAB rule (§25.12 / mob-02). Hooks above run
  // unconditionally; bail before render only.
  const suppressed = pathname.startsWith('/admin/crm/inbox')
  // §29: the mobile Calendar (Screen A) + Tasks (Screen C) own their FABs at
  // < md; the desktop layouts keep this quick action (they have no §29 FAB).
  const mobileSuppressed =
    pathname.startsWith('/admin/crm/calendar') || pathname.startsWith('/admin/crm/tasks')
  const [open, setOpen] = useState(false)
  const [rec, setRec] = useState<CrmNextRec | null>(null)
  const [recLoading, setRecLoading] = useState(false)

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
  const leadActions: Item[] = leadId
    ? [
        { label: 'Call', href: '#overview', icon: Phone },
        { label: 'Send text', href: '#comms', icon: MessageSquare },
        { label: 'Send email', href: '#comms', icon: Mail },
        { label: 'Add note', href: '#comms', icon: StickyNote },
        { label: 'Add task', href: '#tasks', icon: CheckSquare },
        { label: 'Enroll in workflow', href: '#overview', icon: Workflow },
        { label: 'Start a CMA', href: '/admin/cmas', icon: Calculator },
      ]
    : []

  if (suppressed) return null

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Quick actions"
        className={cn(
          'fixed right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full text-primary-foreground shadow-lg transition-transform hover:scale-105 active:scale-95 lg:bottom-5',
          // §23 §9c: the tab bar is suppressed on pushed detail views, so the
          // FAB drops to the corner there (single FAB per §25.12 / mob-02).
          isPushedDetailPath(pathname) ? 'bottom-6' : 'bottom-20',
          // §29 single-FAB rule: hidden at < md on calendar/tasks (their own FAB).
          mobileSuppressed ? 'hidden md:flex' : 'flex',
        )}
        style={{ backgroundColor: 'var(--console-info)' }}
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
