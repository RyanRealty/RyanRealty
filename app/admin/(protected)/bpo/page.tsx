// @no-parity — internal admin surface, no public mockup contract.
//
// /admin/bpo — the Broker Price Opinion worklist. P11C: migrated to the LOCKED
// admin v2 language (design_system/admin/ADMIN_UI.md) through the shared
// presentation kit (@/components/admin/v2). Presentation only — this file is
// the shell around BpoBoard, and the board is mounted unchanged.
//
// Carried over verbatim: requireAdminPage('prospecting.view'), the STATUSES
// set, str(), the posture default ('buyer' unless ?posture=seller), the status
// default ('all' unless the param is in STATUSES), page (min 1) and the
// pageSize of 24, the BpoWorklistFilters object, listBposForAdmin(filters),
// the `?id=` → getBpoWorklistRowById detail read, the totalPages ceiling, and
// every BpoBoard prop and action (prepareBpoSendPreviewAction, sendBpoDeliverable,
// sendBpoTestAction, finalizeBpoAction) with basePath '/admin/bpo'.
//
// Shape changed, data did not: the page title and its paragraph are gone (the
// nav names this page — acceptance bar rule 1), replaced by the family's
// verdict line, whose three figures are summary.drafts / summary.final /
// summary.sent — the same posture-scoped, non-archived counts the board's own
// numbers strip prints directly beneath it. The Tailwind width wrapper became
// the scope div at the same 1152px clamp.
import { requireAdminPage } from '@/lib/admin/require-admin'
import { listBposForAdmin, getBpoWorklistRowById } from '@/lib/data/bpo/reads'
import type { BpoPosture, BpoStatusFilter, BpoWorklistFilters } from '@/lib/data/bpo/reads'
import { finalizeBpoAction } from '@/app/actions/bpo-admin'
import { prepareBpoSendPreviewAction, sendBpoTestAction } from '@/app/actions/contact-bpo'
import { sendBpoDeliverable } from '@/app/actions/send-deliverable'
import { VerdictLine } from '@/components/admin/v2'
import { BpoBoard } from '@/app/admin/(protected)/bpo/_components/worklist/BpoBoard.client'

export const dynamic = 'force-dynamic'

const STATUSES: BpoStatusFilter[] = ['all', 'draft', 'final', 'archived']

function str(v: string | string[] | undefined): string | undefined {
  const s = Array.isArray(v) ? v[0] : v
  const t = s?.trim()
  return t || undefined
}

export default async function AdminBpoWorklistPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await requireAdminPage('prospecting.view')

  const sp = await searchParams

  const posture: BpoPosture = str(sp.posture) === 'seller' ? 'seller' : 'buyer'
  const statusRaw = str(sp.status)
  const status: BpoStatusFilter = STATUSES.includes(statusRaw as BpoStatusFilter) ? (statusRaw as BpoStatusFilter) : 'all'
  const page = Math.max(1, Number(str(sp.page) ?? '1') || 1)
  const pageSize = 24

  const filters: BpoWorklistFilters = {
    q: str(sp.q) ?? null,
    status,
    posture,
    city: str(sp.city) ?? null,
    page,
    pageSize,
  }

  const result = await listBposForAdmin(filters)
  const openId = str(sp.id)
  const detail = openId ? await getBpoWorklistRowById(openId) : null
  const totalPages = Math.max(1, Math.ceil(result.total / pageSize))

  const { drafts, final, sent, total } = result.summary

  return (
    <div className="av2-scope" style={{ maxWidth: 1152, margin: '0 auto' }}>
      <div style={{ margin: '0 0 14px' }}>
        <VerdictLine tone={drafts > 0 ? 'attention' : 'ok'}>
          {drafts > 0 ? (
            <>
              <b>
                {drafts} {posture} draft{drafts === 1 ? '' : 's'} waiting for your review.
              </b>{' '}
              {final} final · {sent} sent.
            </>
          ) : total > 0 ? (
            <>
              <b>No {posture} drafts waiting.</b> {final} final · {sent} sent.
            </>
          ) : (
            <>
              <b>No {posture} opinions on the board.</b> Archived opinions sit behind the status
              filter.
            </>
          )}
        </VerdictLine>
      </div>

      <BpoBoard
        filters={filters}
        basePath="/admin/bpo"
        rows={result.rows}
        summary={result.summary}
        cities={result.cities}
        page={result.page}
        totalPages={totalPages}
        detail={detail}
        prepareSendAction={prepareBpoSendPreviewAction}
        sendAction={sendBpoDeliverable}
        sendTestAction={sendBpoTestAction}
        finalizeAction={finalizeBpoAction}
      />
    </div>
  )
}
