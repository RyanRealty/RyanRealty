'use client'

/**
 * ContactSidebar — the condensed contact card on the right edge of the reading
 * pane (spec §08 §6). Sections: name + last communication, DETAILS (Stage /
 * Agent / Lender per §6.2), clickable phone + email (§6.3), person fields
 * (Source / Price / Timeframe / Tags per shot-28), RECENT CONVERSATIONS (§6.4),
 * ACTIVITY (§6.5). Collapsible via the toggle on its left edge, persisted in
 * localStorage (AC-32). The unknown-caller Add Person panel renders in the
 * children slot (inline, never a Dialog — AC-35).
 */

import { useEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { PanelRightClose, PanelRightOpen } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'

const LS_KEY = 'crm-inbox-sidebar-collapsed'

export type SidebarRecentItem = { id: number; label: string; tsLabel: string; snippet: string | null }
export type SidebarActivityItem = { id: number; label: string; tsLabel: string }

function SectionHeading({ children }: { children: ReactNode }) {
  return (
    <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{children}</div>
  )
}

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-2 py-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="min-w-0 truncate text-right text-sm text-foreground">{value ?? '—'}</span>
    </div>
  )
}

export default function ContactSidebar({
  personId,
  name,
  lastCommunicationLabel,
  stage,
  agentName,
  lenderName,
  phone,
  phoneOptedOut = false,
  email,
  source,
  priceLabel,
  timeframe,
  tags,
  recent,
  activity,
  children,
}: {
  personId: number
  name: string
  lastCommunicationLabel: string | null
  stage: string
  agentName: string | null
  lenderName: string | null
  phone: string | null
  /** Orange display when the number has opted out (spec §15.2). */
  phoneOptedOut?: boolean
  email: string | null
  source: string | null
  priceLabel: string | null
  timeframe: string | null
  tags: string[]
  recent: SidebarRecentItem[]
  activity: SidebarActivityItem[]
  /** Unknown-caller Add Person panel slot (inline, AC-35). */
  children?: ReactNode
}) {
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem(LS_KEY) === '1')
    } catch {
      /* storage unavailable — stay expanded */
    }
  }, [])

  const toggle = () => {
    setCollapsed((prev) => {
      const next = !prev
      try {
        window.localStorage.setItem(LS_KEY, next ? '1' : '0')
      } catch {
        /* ignore */
      }
      return next
    })
  }

  if (collapsed) {
    return (
      <div className="flex h-full w-8 shrink-0 flex-col items-center border-l border-border py-3">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={toggle} aria-label="Expand contact sidebar">
          <PanelRightOpen className="h-4 w-4" aria-hidden />
        </Button>
      </div>
    )
  }

  return (
    <div className="relative flex h-full w-64 shrink-0 flex-col overflow-y-auto border-l border-border">
      <div className="flex items-start justify-between gap-1 px-4 pt-3">
        <div className="min-w-0">
          <Link href={`/admin/crm/${personId}`} className="block truncate text-sm font-semibold text-foreground hover:underline">
            {name}
          </Link>
          {lastCommunicationLabel ? (
            <p className="mt-0.5 text-xs text-muted-foreground">Last Communication {lastCommunicationLabel}</p>
          ) : null}
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={toggle} aria-label="Collapse contact sidebar">
          <PanelRightClose className="h-4 w-4" aria-hidden />
        </Button>
      </div>

      <div className="space-y-4 px-4 py-3">
        {children}

        {/* Clickable contact points (§6.3) */}
        {(phone || email) ? (
          <div className="space-y-0.5">
            {phone ? (
              <a
                href={`tel:${phone}`}
                className={`block truncate text-sm hover:underline ${phoneOptedOut ? 'text-warning' : 'text-primary'}`}
                title={phoneOptedOut ? 'This number opted out of texting' : undefined}
              >
                {phone}
              </a>
            ) : null}
            {email ? (
              <a href={`mailto:${email}`} className="block truncate text-sm text-primary hover:underline">
                {email}
              </a>
            ) : null}
          </div>
        ) : null}

        <Separator />

        <div>
          <SectionHeading>Details</SectionHeading>
          <div className="mt-1.5">
            <DetailRow label="Stage" value={stage} />
            <DetailRow label="Agent" value={agentName} />
            <DetailRow label="Lender" value={lenderName} />
            <DetailRow label="Source" value={source} />
            <DetailRow label="Price" value={priceLabel} />
            <DetailRow label="Timeframe" value={timeframe} />
          </div>
          {tags.length > 0 ? (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {tags.slice(0, 8).map((t) => (
                <Badge key={t} variant="secondary" className="px-1.5 py-0 text-xs font-normal">
                  {t}
                </Badge>
              ))}
              {tags.length > 8 ? (
                <span className="text-xs text-muted-foreground">+{tags.length - 8} more</span>
              ) : null}
            </div>
          ) : null}
        </div>

        <Separator />

        <div>
          <SectionHeading>Recent Conversations</SectionHeading>
          <div className="mt-1.5 space-y-1.5">
            {recent.length === 0 ? (
              <p className="text-xs text-muted-foreground">No prior conversations.</p>
            ) : (
              recent.map((r) => (
                <div key={r.id} className="text-xs">
                  <span className="font-medium text-foreground">{r.label}</span>
                  <span className="text-muted-foreground tabular-nums"> · {r.tsLabel}</span>
                  {r.snippet ? (
                    <p className="truncate text-muted-foreground">{r.snippet}</p>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </div>

        <Separator />

        <div>
          <SectionHeading>Activity</SectionHeading>
          <div className="mt-1.5 space-y-1">
            {activity.length === 0 ? (
              <p className="text-xs text-muted-foreground">No recent activity.</p>
            ) : (
              activity.map((a) => (
                <div key={a.id} className="flex items-baseline justify-between gap-2 text-xs">
                  <span className="min-w-0 truncate text-foreground">{a.label}</span>
                  <span className="shrink-0 text-muted-foreground tabular-nums">{a.tsLabel}</span>
                </div>
              ))
            )}
          </div>
        </div>

        <Separator />

        <Link href={`/admin/crm/${personId}`} className="block text-xs text-primary hover:underline">
          Open full contact record →
        </Link>
      </div>
    </div>
  )
}
