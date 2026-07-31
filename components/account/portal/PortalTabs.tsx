'use client'

/**
 * PortalTabs — the one-surface shell for /account (Phase 4.1,
 * docs/plans/SEARCH_OPTIMIZATION_PLAN_2026-07-29.md).
 *
 * Every section is rendered on the SERVER and handed down as a prop, so this
 * island owns nothing but which panel is showing and keeping that choice in
 * the URL. No data, no fetching, no duplicated managers: the alert manager and
 * the areas manager mounted here are the same components /account/saved-searches
 * and /account/areas mount, so an email deep link and the portal always agree.
 *
 * The tab choice rides ?tab= via history.replaceState rather than a router
 * push: switching panels must not re-run the server render or push a history
 * entry the back button then has to unwind.
 *
 * Design-system primitives only (@/components/ui/*), tokens only, cn() merges.
 */

import { useCallback, useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  PORTAL_TAB_IDS,
  PORTAL_TAB_LABELS,
  resolvePortalTab,
  type PortalTabId,
} from '@/components/account/portal/tabs'

type Props = {
  initialTab: PortalTabId
  /** Server-rendered panel content, one node per tab. */
  panels: Record<PortalTabId, ReactNode>
  /** Small counts shown on the trigger, e.g. alerts with something new. */
  counts?: Partial<Record<PortalTabId, string>>
  className?: string
}

export default function PortalTabs({ initialTab, panels, counts, className }: Props) {
  const [tab, setTab] = useState<PortalTabId>(initialTab)

  const onValueChange = useCallback((next: string) => {
    const id = resolvePortalTab(next)
    setTab(id)
    if (typeof window === 'undefined') return
    const url = new URL(window.location.href)
    if (id === 'overview') url.searchParams.delete('tab')
    else url.searchParams.set('tab', id)
    window.history.replaceState(window.history.state, '', url.toString())
  }, [])

  return (
    <Tabs value={tab} onValueChange={onValueChange} className={cn('gap-6', className)}>
      <TabsList variant="line" className="w-full justify-start gap-2 border-b border-border pb-1">
        {PORTAL_TAB_IDS.map((id) => (
          <TabsTrigger key={id} value={id} className="px-3">
            {PORTAL_TAB_LABELS[id]}
            {counts?.[id] ? (
              <Badge variant="secondary" className="tabular-nums">
                {counts[id]}
              </Badge>
            ) : null}
          </TabsTrigger>
        ))}
      </TabsList>
      {PORTAL_TAB_IDS.map((id) => (
        <TabsContent key={id} value={id} className="space-y-10">
          {panels[id]}
        </TabsContent>
      ))}
    </Tabs>
  )
}
