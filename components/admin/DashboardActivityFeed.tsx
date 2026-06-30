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
import { CrmAvatar } from '@/components/admin/crm/mobile/CrmMobileKit'
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
  // FUB home order: New Leads · Emails · Website, New Leads first + default.
  const [seg, setSeg] = useState<Segment>('leads')
  const lists: Record<Segment, ActivityRow[]> = { website, emails, leads: newLeads }
  const tabs: { key: Segment; label: string }[] = [
    { key: 'leads', label: 'New Leads' },
    { key: 'emails', label: 'Emails' },
    { key: 'website', label: 'Website' },
  ]
  const rows = lists[seg]

  return (
    <div>
      {/* FUB underline tabs */}
      <div className="flex border-b border-border" role="tablist" aria-label="Activity">
        {tabs.map((t) => (
          <Button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={seg === t.key}
            variant="ghost"
            onClick={() => setSeg(t.key)}
            className={cn(
              'h-auto flex-1 rounded-none border-b-2 py-3 text-sm font-medium hover:bg-transparent',
              seg === t.key ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {t.label}
          </Button>
        ))}
      </div>

      {rows.length === 0 ? (
        <p className="px-4 py-10 text-center text-sm text-muted-foreground">
          {seg === 'website' ? 'No identified visitors yet. Named people show here as soon as a contact clicks a link in your email or text.' : seg === 'emails' ? 'No recent email activity from your contacts.' : 'No new leads yet.'}
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {rows.map((r) => (
            <li key={`${r.personId}-${r.ts}`}>
              <Link href={`/admin/console/leads/${r.personId}`} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/40">
                <CrmAvatar name={r.name} src={r.pictureUrl} size={40} />
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
