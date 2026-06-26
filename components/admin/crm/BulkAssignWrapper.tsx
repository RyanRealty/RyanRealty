'use client'

/**
 * Selectable contacts list + bulk-assign bar.
 *
 * Owns the selection state for the page. Receives the already-fetched rows
 * (server-queried with the page's filters/search/pagination intact) and renders
 * the whole list itself — mobile cards + desktop table — adding a checkbox per
 * row and a "select all on page" checkbox in the table header. The sticky
 * BulkActions bar appears whenever there is a selection or a non-empty filtered
 * list (so "select all matching" is always reachable).
 *
 * Keeping the list inside one client island is the simplest path to shared
 * selection state without server/client row coordination.
 */
import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { CrmList, CrmListRow } from '@/components/admin/crm/mobile/CrmMobileKit'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import StageBadge from '@/components/admin/crm/StageBadge'
import BulkActions, {
  type BulkPickerOption, type BulkTemplateOption, type BulkSequenceOption,
} from '@/components/admin/crm/BulkActions'
import type { LegacyFilters } from '@/lib/crm/segment-ast'

export type BulkAssignRow = {
  id: number
  name: string | null
  stage: string
  source: string | null
  picture_url: string | null
  email: string | null
  phone: string | null
  tags: string[]
  assigned_broker: string | null
  last_activity_label: string
  created_label: string
}

function fmtPhone(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(-10)
  if (d.length !== 10) return raw
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`
}

export type BulkAssignWrapperProps = {
  rows: BulkAssignRow[]
  /** Active list filter, so "select all matching" carries it to the server. */
  activeFilters: LegacyFilters
  /** Active saved view id (from ?view=), or null — targets the whole view as audience. */
  activeViewId?: number | null
  /** Total contacts matching the active filter (server count). */
  matchingTotal: number
  /** Whether the caller may reassign brokers (superuser only). */
  canAssignBroker: boolean
  brokers: BulkPickerOption[]
  stages: BulkPickerOption[]
  tags: BulkPickerOption[]
  reportAreas: BulkPickerOption[]
  emailTemplates: BulkTemplateOption[]
  sequences: BulkSequenceOption[]
}

export default function BulkAssignWrapper({
  rows, activeFilters, activeViewId, matchingTotal, canAssignBroker,
  brokers, stages, tags, reportAreas, emailTemplates, sequences,
}: BulkAssignWrapperProps) {
  const [selected, setSelected] = useState<Set<number>>(new Set())
  // FUB-style: the phone list is tap-to-open by default; bulk selection is a
  // mode you opt into (keeps the clutter — and the bulk bar — off the daily view).
  const [selectMode, setSelectMode] = useState(false)

  const toggle = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const allOnPageSelected = rows.length > 0 && rows.every((r) => selected.has(r.id))
  const someOnPageSelected = rows.some((r) => selected.has(r.id))

  const toggleAllOnPage = () => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (allOnPageSelected) rows.forEach((r) => next.delete(r.id))
      else rows.forEach((r) => next.add(r.id))
      return next
    })
  }

  const selectedIds = useMemo(() => Array.from(selected), [selected])
  const clear = () => setSelected(new Set())

  return (
    <>
      {/* People list — phones (FUB-style: tap a row to open; "Select" for bulk) */}
      <div className="-mx-4 mt-2 border-y border-border bg-card md:hidden">
        <div className="flex items-center justify-between px-4 py-2">
          <span className="text-xs text-muted-foreground tabular-nums">
            {selectMode && selected.size > 0 ? `${selected.size} selected` : `${rows.length} shown`}
          </span>
          {rows.length > 0 ? (
            selectMode ? (
              <div className="flex items-center gap-3">
                <Label className="flex items-center gap-1.5 text-xs font-normal text-muted-foreground">
                  <Checkbox
                    checked={allOnPageSelected ? true : someOnPageSelected ? 'indeterminate' : false}
                    onCheckedChange={toggleAllOnPage}
                    aria-label="Select all on page"
                  />
                  All
                </Label>
                <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={() => { setSelectMode(false); clear() }}>
                  Done
                </Button>
              </div>
            ) : (
              <Button variant="ghost" size="sm" className="h-8 px-2 text-xs text-primary" onClick={() => setSelectMode(true)}>
                Select
              </Button>
            )
          ) : null}
        </div>
        {rows.length === 0 ? (
          <p className="px-4 py-12 text-center text-sm text-muted-foreground">No contacts match this filter.</p>
        ) : (
          <CrmList className="border-t border-border">
            {rows.map((p) => {
              const name = p.name ?? `Contact #${p.id}`
              const subtitle = p.source ?? [p.email, p.phone ? fmtPhone(p.phone) : null].filter(Boolean).join(' · ') ?? null
              if (selectMode) {
                return (
                  <div
                    key={p.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => toggle(p.id)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(p.id) } }}
                    className="flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left active:bg-accent/60"
                  >
                    <Checkbox checked={selected.has(p.id)} aria-label={`Select ${name}`} className="shrink-0" />
                    <CrmListRow name={name} src={p.picture_url} title={name} subtitle={subtitle} className="min-w-0 flex-1 gap-3 px-0 py-0" trailing={<StageBadge stage={p.stage} />} />
                  </div>
                )
              }
              return (
                <CrmListRow
                  key={p.id}
                  href={`/admin/crm/${p.id}`}
                  name={name}
                  src={p.picture_url}
                  title={name}
                  subtitle={subtitle}
                  meta={p.last_activity_label}
                  badge={<StageBadge stage={p.stage} className="shrink-0" />}
                />
              )
            })}
          </CrmList>
        )}
      </div>

      {/* People table — desktop (FUB column order: Name+source, Agent, Last Visit, Phone, Email, Last Activity) */}
      <div className="mt-4 hidden overflow-x-auto no-scrollbar rounded-lg border border-border bg-card md:block">
        <Table>
          <TableHeader>
            <TableRow className="border-b border-border">
              <TableHead className="w-10 pl-3">
                <Checkbox
                  checked={allOnPageSelected ? true : someOnPageSelected ? 'indeterminate' : false}
                  onCheckedChange={toggleAllOnPage}
                  aria-label="Select all on page"
                />
              </TableHead>
              <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Name</TableHead>
              <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Agent</TableHead>
              <TableHead className="whitespace-nowrap text-xs font-medium uppercase tracking-wide text-muted-foreground">Last Visit</TableHead>
              <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Phone</TableHead>
              <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Email</TableHead>
              <TableHead className="whitespace-nowrap text-xs font-medium uppercase tracking-wide text-muted-foreground">Last Activity</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                  No contacts match this filter.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((p) => {
                const displayPhone = p.phone ? fmtPhone(p.phone) : null
                return (
                  <TableRow key={p.id} data-state={selected.has(p.id) ? 'selected' : undefined} className="group/row">
                    <TableCell className="pl-3">
                      <Checkbox
                        checked={selected.has(p.id)}
                        onCheckedChange={() => toggle(p.id)}
                        aria-label={`Select ${p.name ?? `contact ${p.id}`}`}
                      />
                    </TableCell>

                    {/* Name + source beneath */}
                    <TableCell className="min-w-40">
                      <Link href={`/admin/crm/${p.id}`} className="flex items-center gap-2.5 hover:underline">
                        {p.picture_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={p.picture_url} alt="" className="h-8 w-8 shrink-0 rounded-full border border-border object-cover" referrerPolicy="no-referrer" loading="lazy" />
                        ) : (
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
                            {(p.name ?? '?').charAt(0).toUpperCase()}
                          </span>
                        )}
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium text-foreground">
                            {p.name ?? `Contact #${p.id}`}
                          </span>
                          {p.source ? (
                            <span className="block truncate text-xs text-muted-foreground">{p.source}</span>
                          ) : null}
                        </span>
                      </Link>
                    </TableCell>

                    {/* Agent (assigned broker) */}
                    <TableCell className="text-sm text-muted-foreground">
                      {p.assigned_broker ?? <span className="text-muted-foreground/40">—</span>}
                    </TableCell>

                    {/* Last Visit — we use last_activity_label as the closest proxy */}
                    <TableCell className="whitespace-nowrap text-xs tabular-nums text-muted-foreground">
                      {p.last_activity_label || <span className="text-muted-foreground/40">—</span>}
                    </TableCell>

                    {/* Phone with click-to-call + click-to-text icon buttons */}
                    <TableCell className="min-w-32">
                      {displayPhone ? (
                        <span className="flex items-center gap-1.5">
                          <span className="text-xs tabular-nums text-foreground">{displayPhone}</span>
                          <a
                            href={`tel:${p.phone}`}
                            aria-label={`Call ${p.name ?? 'contact'}`}
                            className="shrink-0 rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover/row:opacity-100 focus:opacity-100"
                          >
                            {/* phone handset icon */}
                            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.62 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 8.91a16 16 0 0 0 5.61 5.61l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                          </a>
                          <a
                            href={`sms:${p.phone}`}
                            aria-label={`Text ${p.name ?? 'contact'}`}
                            className="shrink-0 rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover/row:opacity-100 focus:opacity-100"
                          >
                            {/* message bubble icon */}
                            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                          </a>
                        </span>
                      ) : (
                        <span className="text-muted-foreground/40 text-xs">—</span>
                      )}
                    </TableCell>

                    {/* Email */}
                    <TableCell className="max-w-44 truncate text-xs text-muted-foreground">
                      {p.email ? (
                        <a href={`mailto:${p.email}`} className="hover:underline">{p.email}</a>
                      ) : (
                        <span className="text-muted-foreground/40">—</span>
                      )}
                    </TableCell>

                    {/* Last Activity */}
                    <TableCell className="whitespace-nowrap text-xs tabular-nums text-muted-foreground">
                      {p.last_activity_label || <span className="text-muted-foreground/40">—</span>}
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      <BulkActions
        selectedIds={selectedIds}
        onClear={clear}
        barClassName={`bottom-16 lg:bottom-0${selectMode ? '' : ' max-md:hidden'}`}
        activeFilters={activeFilters}
        activeViewId={activeViewId}
        matchingTotal={matchingTotal}
        canAssignBroker={canAssignBroker}
        brokers={brokers}
        stages={stages}
        tags={tags}
        reportAreas={reportAreas}
        emailTemplates={emailTemplates}
        sequences={sequences}
      />
    </>
  )
}
