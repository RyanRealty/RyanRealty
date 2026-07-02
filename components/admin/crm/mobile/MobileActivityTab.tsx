/**
 * MobileActivityTab — the lead's Activity feed on the mobile contact detail
 * (Matt punch list #5, 2026-07-02: "I need to be able to see lead activity on
 * the lead detail so we need to create an activity tab").
 *
 * Same data the desktop center column's Activity filter shows: the
 * web_event / stage_change / system / lead_created / task rows from
 * crm_timeline (incl. the visitor-events merge getCrmPersonFull already does),
 * newest first. Server component — rows arrive pre-formatted.
 */

import { Activity, CheckSquare, Eye, Flag, UserPlus } from 'lucide-react'

export interface MobileActivityRow {
  id: number | string
  kind: string
  title: string
  body: string | null
  dateLabel: string
}

const KIND_ICON: Record<string, { icon: typeof Activity; color: string }> = {
  web_event: { icon: Eye, color: '#4ab8e8' },
  stage_change: { icon: Flag, color: '#7595e8' },
  lead_created: { icon: UserPlus, color: '#4ad09f' },
  task: { icon: CheckSquare, color: '#f0a52e' },
  system: { icon: Activity, color: '#8a94a6' },
}

export function MobileActivityTab({ rows }: { rows: MobileActivityRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center px-8 py-20 text-center">
        <p className="text-[16px] font-medium text-muted-foreground">No activity yet</p>
        <p className="mt-1 text-[14px] text-muted-foreground">
          Website visits, stage changes, and system events show up here.
        </p>
      </div>
    )
  }

  return (
    <div className="bg-card pb-24 shadow-sm">
      {rows.map((r) => {
        const meta = KIND_ICON[r.kind] ?? KIND_ICON.system
        const Icon = meta.icon
        return (
          <div key={r.id} className="flex items-start gap-3 border-b border-border px-4 py-3">
            <span
              className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
              style={{ backgroundColor: `${meta.color}1f` }}
            >
              <Icon size={15} strokeWidth={2} style={{ color: meta.color }} aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[14px] leading-5 text-foreground">{r.title}</p>
              {r.body ? (
                <p className="mt-0.5 line-clamp-2 text-[13px] text-muted-foreground">{r.body}</p>
              ) : null}
            </div>
            <span className="shrink-0 pt-0.5 text-[12px] text-muted-foreground">{r.dateLabel}</span>
          </div>
        )
      })}
    </div>
  )
}
