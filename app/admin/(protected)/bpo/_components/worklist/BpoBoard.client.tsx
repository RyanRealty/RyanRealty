'use client'

/**
 * BpoBoard — the stateful client container for /admin/bpo (mirrors
 * components/admin/prospecting/ProspectingBoard.client.tsx).
 *
 * Composes the presentational pieces (filters · card worklist · ?id= detail
 * drawer · send dialog) and wires the server actions passed down from the
 * page. The detail drawer is URL-driven (`?id=`, the DealDetailModal pattern)
 * so it is shareable + back-button-closable; the send dialog is client state
 * fed by the `prepareSendAction` server call so the preview always matches
 * what the server would actually compose.
 *
 * ONE responsive tree: the card grid reflows and the detail becomes a bottom
 * Sheet on phones / an in-flow side panel on desktop — no md:hidden twin.
 *
 * 11F: on the LOCKED admin v2 language. Card -> av2-pane, the shadcn
 * Pagination kit -> a hand-rolled <nav> of plain <a> page links (matching
 * exactly what PaginationLink rendered under the hood — a real anchor, not a
 * next/link Link, so this keeps the original's full-navigation transport),
 * and the KpiStrip (components/console — a public-brand-token component, not
 * an admin v2 primitive) -> ReportNumbers, the same "numbers strip" the
 * sibling /admin/bpo/page.tsx docblock already names this as.
 */

import { useCallback, useState, useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { ReportNumbers } from '@/components/admin/v2'
import type { BpoWorklistFilters, BpoWorklistRow, BpoWorklistSummary } from '@/lib/data/bpo/reads'
import type { BpoSendContext } from '@/app/actions/contact-bpo'
import { BpoFilters } from './BpoFilters.client'
import { BpoCard } from './BpoCard.client'
import { BpoDetailDrawer } from './BpoDetailDrawer.client'
import { BpoSendDialog } from './BpoSendDialog.client'

type SendResult = { ok: true; transport: 'gmail' | 'resend' } | { ok: false; error: string }
type TestResult = { ok: boolean; error?: string }
type FinalizeResult = { error: string | null; needsReviewAck?: boolean }

type Actions = {
  prepareSendAction: (slug: string) => Promise<{ ok: true; context: BpoSendContext } | { ok: false; error: string }>
  sendAction: (
    personId: number,
    slug: string,
    includeOfferStrategy: boolean,
    override?: { subject?: string | null; bodyText?: string | null },
  ) => Promise<SendResult>
  sendTestAction: (args: { channel: 'sms' | 'email'; subject?: string; body: string }) => Promise<TestResult>
  finalizeAction: (slug: string, opts?: { acknowledgeReview?: boolean }) => Promise<FinalizeResult>
}

export function BpoBoard({
  filters,
  basePath,
  rows,
  summary,
  cities,
  page,
  totalPages,
  detail,
  prepareSendAction,
  sendAction,
  sendTestAction,
  finalizeAction,
}: Actions & {
  filters: BpoWorklistFilters
  basePath: string
  rows: BpoWorklistRow[]
  summary: BpoWorklistSummary
  cities: string[]
  page: number
  totalPages: number
  detail: BpoWorklistRow | null
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [dialog, setDialog] = useState<{ open: boolean; slug: string | null; context: BpoSendContext | null }>({
    open: false,
    slug: null,
    context: null,
  })
  const [busySend, setBusySend] = useState<string | null>(null)
  const [busyFinalize, setBusyFinalize] = useState<string | null>(null)
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

  const handleFinalize = useCallback(
    (slug: string) => {
      if (busyFinalize) return
      setBusyFinalize(slug)
      startTransition(async () => {
        try {
          const res = await finalizeAction(slug)
          if (res.error && res.needsReviewAck) {
            // Accuracy gate: the build carries review findings. Finalizing is
            // the broker's call, but only with the findings explicitly
            // acknowledged (mirrors BpoReviewActions on the canonical page).
            const ack = confirm(
              `${res.error}\n\nReview the findings on the full review page. Finalize anyway, acknowledging the recorded findings?`,
            )
            if (!ack) return
            const retry = await finalizeAction(slug, { acknowledgeReview: true })
            if (retry.error) toast.error(retry.error)
            else {
              toast.success('Finalized with review findings acknowledged.')
              router.refresh()
            }
            return
          }
          if (res.error) toast.error(res.error)
          else {
            toast.success('Finalized.')
            router.refresh()
          }
        } finally {
          setBusyFinalize(null)
        }
      })
    },
    [busyFinalize, finalizeAction, router],
  )

  const openSend = useCallback(
    (slug: string) => {
      if (busySend) return
      setBusySend(slug)
      startTransition(async () => {
        try {
          const res = await prepareSendAction(slug)
          if (res.ok) {
            setDialog({ open: true, slug, context: res.context })
          } else {
            toast.error(res.error ?? 'Could not open the send dialog.')
          }
        } finally {
          setBusySend(null)
        }
      })
    },
    [busySend, prepareSendAction],
  )

  const closeSend = useCallback(() => {
    setDialog({ open: false, slug: null, context: null })
    router.refresh()
  }, [router])

  const postureLabel = filters.posture === 'seller' ? 'seller' : 'buyer'

  return (
    <div className="space-y-4">
      <ReportNumbers
        items={[
          { key: 'total', label: 'Total', value: String(summary.total) },
          { key: 'drafts', label: 'Drafts', value: String(summary.drafts) },
          { key: 'final', label: 'Final', value: String(summary.final) },
          { key: 'sent', label: 'Sent', value: String(summary.sent) },
        ]}
      />

      <BpoFilters filters={filters} cities={cities} basePath={basePath} />

      <div className="lg:flex lg:items-start lg:gap-4">
        <div className="min-w-0 flex-1">
          {rows.length === 0 ? (
            <div
              style={{
                border: '1px dashed var(--a-border)',
                borderRadius: 'var(--a-r-lg)',
                padding: '48px 16px',
                textAlign: 'center',
              }}
            >
              <p style={{ margin: 0, fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)' }}>
                No {postureLabel} opinions match these filters.
              </p>
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {rows.map((row) => (
                <BpoCard
                  key={row.id}
                  row={row}
                  onOpenDetail={openDetail}
                  onSend={openSend}
                  onFinalize={handleFinalize}
                  pendingSend={busySend === row.slug}
                  pendingFinalize={busyFinalize === row.slug}
                />
              ))}
            </div>
          )}

          {totalPages > 1 ? (
            <nav
              aria-label="Pages"
              style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', marginTop: 16 }}
            >
              {page > 1 ? (
                <a
                  href={pageHref(pathname, searchParams, page - 1)}
                  className="av2-btn av2-btn--quiet"
                  style={{ textDecoration: 'none' }}
                >
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
                <a
                  href={pageHref(pathname, searchParams, page + 1)}
                  className="av2-btn av2-btn--quiet"
                  style={{ textDecoration: 'none' }}
                >
                  Next
                </a>
              ) : null}
            </nav>
          ) : null}
        </div>

        <BpoDetailDrawer
          detail={detail}
          open={Boolean(detail)}
          onClose={closeDetail}
          onFinalize={handleFinalize}
          onOpenSend={openSend}
          pendingFinalize={detail ? busyFinalize === detail.slug : false}
          pendingSend={detail ? busySend === detail.slug : false}
        />
      </div>

      <BpoSendDialog
        open={dialog.open}
        onClose={closeSend}
        slug={dialog.slug}
        context={dialog.context}
        sendAction={sendAction}
        sendTestAction={sendTestAction}
      />
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
