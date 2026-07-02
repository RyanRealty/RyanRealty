'use client'

/**
 * FUB-clone agent-scope picker. Opens a bottom sheet listing Everyone · Me ·
 * Team members (each with a headshot avatar) plus a search box — matching the
 * Follow Up Boss "Filter Deals" scope sheet (screen ui1_5831). Selecting a scope
 * navigates the contacts list with the broker param (carrying the active
 * search/stage/tag/view filters). The trigger shows the current scope.
 *
 * Reused by the people-list filter and the mobile top-bar "Everyone ▾" switcher.
 */
import { useState } from 'react'
import Link from 'next/link'
import { ChevronDown, Check, Users } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetClose, SheetTrigger } from '@/components/ui/sheet'
import { Input } from '@/components/ui/input'
import { CrmAvatar } from '@/components/admin/crm/mobile/CrmMobileKit'
import { cn } from '@/lib/utils'

export type ScopeBroker = { slug: string; label: string; headshot: string | null }

export default function BrokerScopeSheet({
  brokers,
  current,
  myBrokerSlug,
  carry,
  basePath = '/admin/crm',
  className,
  variant = 'input',
}: {
  brokers: ScopeBroker[]
  /** 'all' or a broker slug */
  current: string
  myBrokerSlug: string | null
  /** filters to preserve in the href (q, stage, tag, view) */
  carry: Record<string, string | undefined>
  basePath?: string
  className?: string
  /** 'input' = bordered field trigger (list toolbars); 'header' = the §24 §1.3
      centered "Everyone ▾" white-on-navy control inside the mobile navy header. */
  variant?: 'input' | 'header'
}) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')

  const isEveryone = !current || current === 'all'
  const currentLabel = isEveryone ? 'Everyone' : brokers.find((b) => b.slug === current)?.label ?? 'Everyone'

  function href(brokerSlug: string) {
    const p = new URLSearchParams()
    for (const [k, v] of Object.entries(carry)) if (v) p.set(k, v)
    p.set('broker', brokerSlug)
    return `${basePath}?${p.toString()}`
  }

  const ql = q.trim().toLowerCase()
  const me = myBrokerSlug ? brokers.find((b) => b.slug === myBrokerSlug) ?? null : null
  const team = brokers.filter((b) => !ql || b.label.toLowerCase().includes(ql))

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      {variant === 'header' ? (
        <SheetTrigger
          className={cn('flex items-center gap-1 text-lg font-medium text-primary-foreground', className)}
          aria-label="Filter by agent"
        >
          <span className="truncate">{currentLabel}</span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0" aria-hidden />
        </SheetTrigger>
      ) : (
        <SheetTrigger
          className={cn(
            'flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 text-sm text-foreground',
            className,
          )}
        >
          <span className="flex min-w-0 items-center gap-2">
            <Users className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            <span className="truncate">{currentLabel}</span>
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        </SheetTrigger>
      )}

      <SheetContent side="bottom" className="gap-0 rounded-t-xl px-0 pb-6">
        <SheetHeader className="px-4">
          <SheetTitle>Filter by agent</SheetTitle>
        </SheetHeader>

        <div className="px-4 pb-2 pt-1">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search agents"
            className="h-10"
            aria-label="Search agents"
          />
        </div>

        <ul className="max-h-96 overflow-y-auto">
          {/* Everyone */}
          <ScopeRow
            href={href('all')}
            selected={isEveryone}
            onPick={() => setOpen(false)}
            leading={
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <Users className="h-4 w-4" aria-hidden />
              </span>
            }
            label="Everyone"
          />

          {/* Me */}
          {me ? (
            <ScopeRow
              href={href(me.slug)}
              selected={current === me.slug}
              onPick={() => setOpen(false)}
              leading={<CrmAvatar name={me.label} src={me.headshot} size={36} />}
              label="Me"
            />
          ) : null}

          {team.length > 0 ? (
            <li className="px-4 pb-1 pt-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Team members
            </li>
          ) : null}
          {team.map((b) => (
            <ScopeRow
              key={b.slug}
              href={href(b.slug)}
              selected={current === b.slug}
              onPick={() => setOpen(false)}
              leading={<CrmAvatar name={b.label} src={b.headshot} size={36} />}
              label={b.label}
            />
          ))}
        </ul>
      </SheetContent>
    </Sheet>
  )
}

function ScopeRow({
  href,
  selected,
  onPick,
  leading,
  label,
}: {
  href: string
  selected: boolean
  onPick: () => void
  leading: React.ReactNode
  label: string
}) {
  return (
    <li>
      <SheetClose asChild>
        <Link
          href={href}
          onClick={onPick}
          className="flex items-center gap-3 border-b border-border px-4 py-3 text-sm text-foreground hover:bg-muted/40"
        >
          {leading}
          <span className="min-w-0 flex-1 truncate font-medium">{label}</span>
          {selected ? <Check className="h-4 w-4 shrink-0 text-primary" aria-hidden /> : null}
        </Link>
      </SheetClose>
    </li>
  )
}
