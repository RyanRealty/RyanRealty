'use client'

/**
 * CmaBoard — the stateful client container for /admin/cmas (Seller-CMA
 * worklist, sibling of /admin/prospecting). Composes the presentational
 * pieces (filters · card grid · `?id=` detail drawer · send dialog) and
 * wires the server actions passed down from the page, copying the
 * ProspectingBoard container pattern (components/admin/prospecting/
 * ProspectingBoard.client.tsx).
 *
 * ONE responsive tree: the card grid reflows and the detail becomes a bottom
 * Sheet on phones / an in-flow side panel on desktop — no md:hidden twin.
 * Unlike prospecting, the drawer chrome lives inline here rather than in a
 * separate ProspectDetailDrawer-style file (one fewer file for a worklist
 * this size — CmaDetailPanel is still the single shared detail CONTENT tree
 * both breakpoints mount).
 *
 * 11F: on the LOCKED admin v2 language. Card -> av2-pane, the shadcn
 * Pagination kit -> a hand-rolled <nav> of plain <a> page links (matching
 * exactly what PaginationLink rendered under the hood — a real anchor, not a
 * next/link Link, so this keeps the original's full-navigation transport),
 * and the KpiStrip (components/console — a public-brand-token component, not
 * an admin v2 primitive) -> ReportNumbers, the same "numbers strip" the
 * sibling /admin/bpo/page.tsx docblock already names this as.
 *
 * The old shadcn Sheet (Radix) mounted BOTH the bottom-sheet content and the
 * desktop aside whenever `detail` was set, picking the visible one with
 * `lg:hidden` / `hidden lg:block` — safe under Radix, which is
 * CSS-visibility-driven. The v2 Sheet wraps a native <dialog>: calling
 * showModal() while the element (or an ancestor) computes `display:none`
 * throws, so the same trick cannot carry over. This tracks the >=1024px
 * breakpoint in JS (mirrors BpoDetailDrawer.client.tsx) and mounts only the
 * variant that applies.
 */

import { useCallback, useEffect, useState, useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { ReportNumbers, Sheet } from '@/components/admin/v2'
import type { CmaWorklistFilters, CmaWorklistRow, CmaWorklistSummary } from './types'
import { CmaFilters } from './CmaFilters.client'
import { CmaCard } from './CmaCard.client'
import { CmaDetailPanel } from './CmaDetailPanel.client'
import { CmaSendDialog, type CmaSendContext } from './CmaSendDialog.client'

type Actions = {
  approveAction: (
    slug: string,
    opts?: { acknowledgeReview?: boolean },
  ) => Promise<{ error: string | null; needsReviewAck?: boolean }>
  prepareSendAction: (slug: string) => Promise<{ data: CmaSendContext | null; error: string | null }>
  sendAction: (
    slug: string,
    override?: { subject?: string; bodyText?: string },
  ) => Promise<{ data: { transport: 'gmail' | 'resend'; mailbox: string | null } | null; error: string | null }>
  testSendAction: (args: {
    channel: 'email'
    subject: string
    body: string
  }) => Promise<{ ok: boolean; error?: string; message?: string }>
}

const DESKTOP_QUERY = '(min-width: 1024px)'

/** Tracks the lg breakpoint. Defaults to false (mobile) for the first paint
 *  on both server and client, so there is no hydration mismatch — it flips
 *  right after mount via the media query listener. */
function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia(DESKTOP_QUERY)
    const update = () => setIsDesktop(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])
  return isDesktop
}

function skeletonBlock(height: number, width: string) {
  return <div style={{ height, width, borderRadius: 'var(--a-r-sm)', background: 'var(--a-inset)' }} aria-hidden="true" />
}

function DetailSkeleton() {
  return (
    <div className="space-y-3" role="status" aria-label="Loading CMA">
      {skeletonBlock(24, '66%')}
      {skeletonBlock(16, '50%')}
      {skeletonBlock(96, '100%')}
      {skeletonBlock(96, '100%')}
    </div>
  )
}

export function CmaBoard({
  filters,
  basePath,
  rows,
  summary,
  cities,
  page,
  totalPages,
  detail,
  approveAction,
  prepareSendAction,
  sendAction,
  testSendAction,
}: Actions & {
  filters: CmaWorklistFilters
  basePath: string
  rows: CmaWorklistRow[]
  summary: CmaWorklistSummary
  cities: string[]
  page: number
  totalPages: number
  detail: CmaWorklistRow | null
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const isDesktop = useIsDesktop()

  const [dialog, setDialog] = useState<{ open: boolean; context: CmaSendContext | null }>({ open: false, context: null })
  const [busyApprove, setBusyApprove] = useState<string | null>(null)
  const [busySendPrep, setBusySendPrep] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  const withParam = useCallback(
    (mutate: (p: URLSearchParams) => void) => {
      const p = new URLSearchParams(searchParams.toString())
      mutate(p)
      const qs = p.toString()
      router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    },
    [pathname, router, searchParams],
  )

  const openDetail = useCallback((id: string) => withParam((p) => p.set('id', id)), [withParam])
  const closeDetail = useCallback(() => withParam((p) => p.delete('id')), [withParam])

  const handleApprove = useCallback(
    (slug: string) => {
      if (busyApprove) return
      setBusyApprove(slug)
      startTransition(async () => {
        try {
          const res = await approveAction(slug)
          if (res.error && res.needsReviewAck) {
            // Accuracy gate: the build carries review findings. Approving is
            // the broker's call, but only with the findings explicitly
            // acknowledged (mirrors BpoBoard's handleFinalize).
            const ack = confirm(
              `${res.error}\n\nReview the findings on the full review page. Approve anyway, acknowledging the recorded findings?`,
            )
            if (!ack) return
            const retry = await approveAction(slug, { acknowledgeReview: true })
            if (retry.error) toast.error(retry.error)
            else {
              toast.success('Approved with review findings acknowledged. Ready to send.')
              router.refresh()
            }
            return
          }
          if (!res.error) {
            toast.success('Approved. Ready to send.')
            router.refresh()
          } else {
            toast.error(res.error)
          }
        } finally {
          setBusyApprove(null)
        }
      })
    },
    [busyApprove, approveAction, router],
  )

  const openSend = useCallback(
    (slug: string) => {
      if (busySendPrep) return
      setBusySendPrep(slug)
      startTransition(async () => {
        try {
          const res = await prepareSendAction(slug)
          if (res.data) {
            setDialog({ open: true, context: res.data })
          } else {
            toast.error(res.error ?? 'Could not open the send dialog.')
          }
        } finally {
          setBusySendPrep(null)
        }
      })
    },
    [busySendPrep, prepareSendAction],
  )

  const closeSend = useCallback(() => {
    setDialog({ open: false, context: null })
    router.refresh()
  }, [router])

  // `open` mirrors BpoDetailDrawer.client.tsx: derived from `detail` itself
  // (the page resolves `?id=` server-side before this component ever
  // mounts), so the sheet/aside and the panel-vs-skeleton choice share one
  // source of truth.
  const open = Boolean(detail)
  const panel = detail ? (
    <CmaDetailPanel
      detail={detail}
      onApprove={handleApprove}
      onSend={openSend}
      pendingApprove={busyApprove === detail.slug}
      pendingSend={busySendPrep === detail.slug}
    />
  ) : open ? (
    <DetailSkeleton />
  ) : null

  return (
    <div className="space-y-4">
      <ReportNumbers
        items={[
          { key: 'total', label: 'Total', value: String(summary.total) },
          { key: 'drafts', label: 'Drafts', value: String(summary.drafts) },
          { key: 'finalized', label: 'Finalized', value: String(summary.finalized) },
          { key: 'delivered', label: 'Delivered', value: String(summary.delivered) },
          { key: 'sent', label: 'Sent', value: String(summary.sent) },
          { key: 'published', label: 'Live on listings', value: String(summary.published) },
        ]}
      />

      <CmaFilters filters={filters} cities={cities} basePath={basePath} />

      <div className="lg:flex lg:items-start lg:gap-4">
        <div className="min-w-0 flex-1">
          {rows.length === 0 ? (
            <div style={{ border: '1px dashed var(--a-border)', borderRadius: 'var(--a-r-lg)', padding: '48px 16px', textAlign: 'center' }}>
              <p style={{ margin: 0, fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)' }}>No CMAs match these filters.</p>
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {rows.map((row) => (
                <CmaCard
                  key={row.id}
                  row={row}
                  onOpenDetail={openDetail}
                  onApprove={handleApprove}
                  onSend={openSend}
                  pendingApprove={busyApprove === row.slug}
                  pendingSend={busySendPrep === row.slug}
                />
              ))}
            </div>
          )}

          {totalPages > 1 ? (
            <nav aria-label="Pages" style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', marginTop: 16 }}>
              {page > 1 ? (
                <a href={pageHref(pathname, searchParams, page - 1)} className="av2-btn av2-btn--quiet" style={{ textDecoration: 'none' }}>
                  Previous
                </a>
              ) : null}
              {pageWindow(page, totalPages).map((n) => (
                <a
                  key={n}
                  href={pageHref(pathname, searchParams, n)}
                  aria-current={n === page ? 'page' : undefined}
                  className="a-num"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minWidth: 32,
                    height: 32,
                    borderRadius: 'var(--a-r-md)',
                    fontSize: 'var(--a-text-sm)',
                    textDecoration: 'none',
                    color: n === page ? 'var(--a-accent)' : 'var(--a-text-2)',
                    background: n === page ? 'var(--a-accent-wash)' : 'transparent',
                    fontWeight: n === page ? 600 : 400,
                  }}
                >
                  {n}
                </a>
              ))}
              {page < totalPages ? (
                <a href={pageHref(pathname, searchParams, page + 1)} className="av2-btn av2-btn--quiet" style={{ textDecoration: 'none' }}>
                  Next
                </a>
              ) : null}
            </nav>
          ) : null}
        </div>

        {/* < lg — bottom sheet */}
        {!isDesktop ? (
          <Sheet open={open} onClose={closeDetail} title={detail?.subjectAddress ?? (open ? 'Loading…' : 'CMA')}>
            {panel}
          </Sheet>
        ) : null}

        {/* >= lg — non-modal in-flow aside; sits beside the worklist grid. */}
        {isDesktop && open ? (
          <aside className="w-[380px] shrink-0" style={{ position: 'sticky', top: 24, maxHeight: 'calc(100vh - 3rem)', overflowY: 'auto' }}>
            <div className="av2-pane">{panel}</div>
          </aside>
        ) : null}
      </div>

      <CmaSendDialog open={dialog.open} onClose={closeSend} context={dialog.context} sendAction={sendAction} testSendAction={testSendAction} />
    </div>
  )
}

function pageHref(pathname: string, searchParams: URLSearchParams, n: number): string {
  const p = new URLSearchParams(searchParams.toString())
  p.set('page', String(n))
  return `${pathname}?${p.toString()}`
}

function pageWindow(page: number, total: number): number[] {
  const out: number[] = []
  const start = Math.max(1, Math.min(page - 2, total - 4))
  const end = Math.min(total, start + 4)
  for (let n = start; n <= end; n++) out.push(n)
  return out
}
