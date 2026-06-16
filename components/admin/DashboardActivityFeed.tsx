'use client'

/**
 * DashboardActivityFeed — the segmented "Right now" feed on the broker dashboard
 * (docs/MOBILE_CRM_FUB_PARITY.md #3).
 *
 * Matt 2026-06-16: show WHO — the latest named person on the site, who opened or
 * sent email, the newest leads — NOT a wall of anonymous session IDs and
 * engagement scores. Every row is a real contact (resolved server-side from
 * crm_timeline → crm_people) and links to that lead. Identity coverage grows as
 * the email-click `_fuid` stitch (lib/crm/merge attributeSiteLinks) names more
 * browsers.
 */

import Link from 'next/link'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export type ActivityRow = { personId: number; name: string; pictureUrl: string | null; ts: string; label: string }

type Segment = 'website' | 'emails' | 'leads'

function ago(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 1) return 'now'
  if (mins < 60) return `${mins}m`
  if (mins < 1440) return `${Math.round(mins / 60)}h`
  return `${Math.round(mins / 1440)}d`
}

export default function DashboardActivityFeed({
  website,
  emails,
  newLeads,
}: {
  website: ActivityRow[]
  emails: ActivityRow[]
  newLeads: ActivityRow[]
}) {
  const [seg, setSeg] = useState<Segment>('website')
  const lists: Record<Segment, ActivityRow[]> = { website, emails, leads: newLeads }
  const tabs: { key: Segment; label: string; count: number }[] = [
    { key: 'website', label: 'On the site', count: website.length },
    { key: 'emails', label: 'Email', count: emails.length },
    { key: 'leads', label: 'New leads', count: newLeads.length },
  ]
  const rows = lists[seg]

  return (
    <div className="border-t border-border">
      <div className="no-scrollbar flex gap-1 overflow-x-auto px-3 py-2.5" role="tablist" aria-label="Activity">
        {tabs.map((t) => (
          <Button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={seg === t.key}
            variant={seg === t.key ? 'default' : 'secondary'}
            size="sm"
            onClick={() => setSeg(t.key)}
            className="shrink-0 gap-1.5 whitespace-nowrap rounded-full"
          >
            {t.label}
            <span className={cn('tabular-nums', seg === t.key ? 'text-primary-foreground/80' : 'text-muted-foreground/70')}>{t.count}</span>
          </Button>
        ))}
      </div>

      {rows.length === 0 ? (
        <p className="border-t border-border px-4 py-6 text-center text-sm text-muted-foreground">
          {seg === 'website' ? 'No identified visitors yet. Named people show here as soon as a contact clicks a link in your email or text.' : seg === 'emails' ? 'No recent email activity from your contacts.' : 'No new leads yet.'}
        </p>
      ) : (
        <ul className="divide-y divide-border border-t border-border">
          {rows.map((r) => (
            <li key={`${r.personId}-${r.ts}`}>
              <Link href={`/admin/console/leads/${r.personId}`} className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-muted/40">
                {r.pictureUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={r.pictureUrl} alt="" referrerPolicy="no-referrer" className="h-9 w-9 shrink-0 rounded-full border border-border object-cover" />
                ) : (
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-semibold text-secondary-foreground">{(r.name ?? '?').charAt(0).toUpperCase()}</span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-foreground">{r.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">{r.label}</span>
                </span>
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{ago(r.ts)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
