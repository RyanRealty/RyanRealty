/**
 * MobilePeopleRoot — §24 People tab at < md (mob-09 / mob-10).
 *
 * Two URL-driven modes (server component, no client state):
 *
 *  DIRECTORY (no filter params) — mob-09 "All Lists": light sub-tab strip
 *  (All Lists | Stages, 2pt primary indicator), then 58pt smart-list rows
 *  (name + live scoped count right-aligned in text-primary, no chevron) or
 *  stage rows on the Stages tab. Counts ≥1000 abbreviate to "1.2k"; 0 renders.
 *
 *  LIST (?view= / ?stage= / ?q= / explicit broker) — mob-10 smart-list detail:
 *  back row to All Lists, 24pt count bar "{N} people", 72pt contact rows
 *  (44pt avatar · name 17pt · source sub-label 13pt · trailing ›), paginated.
 *
 * Desktop (md+) is untouched — the page renders this inside md:hidden.
 */

import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CrmList, CrmListRow } from '@/components/admin/crm/mobile/CrmMobileKit'

export interface MobileViewRow {
  id: number
  name: string
  count: number | null
}

export interface MobileStageRow {
  key: string
  label: string
}

export interface MobilePersonRow {
  id: number
  name: string
  picture_url: string | null
  source: string | null
  stage: string
}

/** §24 §4.6: ≥1000 → "1.2k"; 0 renders as "0". */
function formatCount(n: number | null): string {
  if (n == null) return ''
  return n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k` : String(n)
}

function SubTabStrip({ active, carryBroker }: { active: 'lists' | 'stages'; carryBroker?: string }) {
  const base = carryBroker ? `?broker=${encodeURIComponent(carryBroker)}&` : '?'
  const tabs = [
    { key: 'lists' as const, label: 'All Lists', href: carryBroker ? `/admin/crm?broker=${encodeURIComponent(carryBroker)}` : '/admin/crm' },
    { key: 'stages' as const, label: 'Stages', href: `/admin/crm${base}ptab=stages` },
  ]
  return (
    <div className="flex border-b border-border bg-muted">
      {tabs.map((t) => {
        const isActive = active === t.key
        return (
          <Link
            key={t.key}
            href={t.href}
            className={cn(
              'relative flex-1 py-2.5 text-center text-[14px]',
              isActive ? 'font-semibold text-foreground' : 'font-normal text-muted-foreground',
            )}
          >
            {t.label}
            {isActive ? <span className="absolute inset-x-0 bottom-0 h-[2px] bg-primary" /> : null}
          </Link>
        )
      })}
    </div>
  )
}

export function MobilePeopleRoot({
  mode,
  ptab,
  views,
  stages,
  rows,
  total,
  listTitle,
  page,
  lastPage,
  pageHrefPrev,
  pageHrefNext,
  carryBroker,
}: {
  mode: 'directory' | 'list'
  ptab: 'lists' | 'stages'
  views: MobileViewRow[]
  stages: MobileStageRow[]
  rows: MobilePersonRow[]
  total: number
  /** LIST mode header title — the applied view name, stage, or search label. */
  listTitle: string
  page: number
  lastPage: number
  pageHrefPrev: string | null
  pageHrefNext: string | null
  /** Non-default broker scope to carry through directory links. */
  carryBroker?: string
}) {
  if (mode === 'directory') {
    return (
      <div className="-mx-4 bg-card">
        <SubTabStrip active={ptab} carryBroker={carryBroker} />
        {ptab === 'lists' ? (
          <div>
            {views.map((v) => (
              <Link
                key={v.id}
                href={`/admin/crm?view=${v.id}`}
                className="flex h-[58px] items-center justify-between border-b border-border px-4 active:bg-secondary"
              >
                <span className="min-w-0 truncate text-[16px] text-foreground">{v.name}</span>
                <span className="shrink-0 pl-3 text-[16px] tabular-nums text-primary">{formatCount(v.count)}</span>
              </Link>
            ))}
            {views.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">No smart lists yet.</p>
            ) : null}
          </div>
        ) : (
          <div>
            {stages.map((s) => (
              <Link
                key={s.key}
                href={`/admin/crm?stage=${encodeURIComponent(s.key)}`}
                className="flex h-[58px] items-center justify-between border-b border-border px-4 active:bg-secondary"
              >
                <span className="min-w-0 truncate text-[16px] text-foreground">{s.label}</span>
                <span className="shrink-0 pl-3 text-muted-foreground">›</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    )
  }

  /* ── LIST mode (mob-10) ────────────────────────────────────────────────── */
  return (
    <div className="-mx-4 bg-card">
      {/* Back row + title (stands in for the pushed-screen nav bar) */}
      <div className="flex items-center gap-1 border-b border-border px-2 py-2.5">
        <Link href="/admin/crm" aria-label="All lists" className="flex items-center p-1 text-foreground">
          <ChevronLeft size={20} />
        </Link>
        <span className="min-w-0 flex-1 truncate text-center text-[17px] font-semibold text-foreground">{listTitle}</span>
        <span className="w-7" />
      </div>

      {/* §24 §5.4 count bar */}
      <div className="flex h-6 items-center bg-muted px-4">
        <span className="text-[13px] tabular-nums text-muted-foreground">
          {total.toLocaleString('en-US')} people
        </span>
      </div>

      <CrmList>
        {rows.map((p) => (
          <CrmListRow
            key={p.id}
            href={`/admin/console/leads/${p.id}`}
            name={p.name}
            src={p.picture_url}
            title={p.name}
            subtitle={p.source ?? p.stage}
          />
        ))}
      </CrmList>
      {rows.length === 0 ? (
        <p className="px-4 py-10 text-center text-sm text-muted-foreground">No people found.</p>
      ) : null}

      {/* Pagination */}
      {lastPage > 1 ? (
        <div className="flex items-center justify-between border-t border-border px-4 py-3 text-sm text-muted-foreground">
          <span className="tabular-nums">Page {page} of {lastPage}</span>
          <div className="flex gap-4">
            {pageHrefPrev ? <Link href={pageHrefPrev} className="font-medium text-foreground">Previous</Link> : null}
            {pageHrefNext ? <Link href={pageHrefNext} className="font-medium text-foreground">Next</Link> : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}
