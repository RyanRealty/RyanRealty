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
 */

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'

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

  const Row = ({ sel, children }: { sel: ScopeSelection; children: React.ReactNode }) => (
    <DropdownMenuItem
      onSelect={() => navigate(sel)}
      className={cn('flex items-center gap-2', isActive(sel) ? 'bg-primary/10 font-medium' : '')}
    >
      {children}
      {isActive(sel) ? <Check className="ml-auto h-3.5 w-3.5 text-primary" aria-hidden /> : null}
    </DropdownMenuItem>
  )

  return (
    <DropdownMenu onOpenChange={(o) => { if (!o) setQuery('') }}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-1 px-2.5 text-xs" data-testid="scope-dropdown">
          {label}
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <div className="p-1.5" onKeyDown={(e) => e.stopPropagation()}>
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search"
            className="h-8 text-sm"
            aria-label="Search scope options"
          />
        </div>
        <DropdownMenuSeparator />
        {matches('everyone') ? <Row sel={{ kind: 'everyone' }}>Everyone</Row> : null}
        {myBrokerSlug && matches('me') ? <Row sel={{ kind: 'me' }}>Me</Row> : null}

        {ponds.length > 0 ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-[11px] uppercase tracking-widest text-muted-foreground">Ponds</DropdownMenuLabel>
            <DropdownMenuItem asChild>
              <a href="/admin/crm/settings/ponds">View All Ponds</a>
            </DropdownMenuItem>
            {ponds.filter((p) => matches(p.name)).map((p) => (
              <Row key={p.id} sel={{ kind: 'pond', id: p.id }}>{p.name}</Row>
            ))}
          </>
        ) : null}

        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-[11px] uppercase tracking-widest text-muted-foreground">Team members</DropdownMenuLabel>
        {brokers.filter((b) => matches(b.label)).map((b) => (
          <Row key={b.slug} sel={b.slug === myBrokerSlug ? { kind: 'me' } : { kind: 'broker', slug: b.slug }}>
            <Avatar className="h-5 w-5">
              {b.headshot ? <AvatarImage src={b.headshot} alt="" /> : null}
              <AvatarFallback className="text-[9px]">{b.label.split(' ').map((w) => w[0]).join('')}</AvatarFallback>
            </Avatar>
            {b.label}
          </Row>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
