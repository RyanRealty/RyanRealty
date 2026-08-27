// @no-parity — internal admin surface, no public mockup contract
/**
 * /admin/studio/review — the approval queue, built to actually get used.
 *
 * WHY. 477 drafts sat at `ready` and not one had ever been approved or
 * published. Asked why, Matt said: "I've never seen them." /admin/studio listed
 * 40 of them mixed with killed rows and had no way to work through a backlog —
 * a gallery, not a queue. The list function was also hard-capped at 60, so the
 * other 417 were unreachable by any UI.
 *
 * This page does one thing: hand him the next undecided draft, full size, with
 * two buttons. Nothing here publishes. Approve stamps the row that
 * publisher-sweep reads, one draft at a time, which is the §1 human approval —
 * there is deliberately no "approve all".
 */
import { requireAdminPage } from '@/lib/admin/require-admin'
import { SectionHead } from '@/components/admin/v2'
import { listStudioDrafts, countStudioDraftsByStatus } from '@/lib/data/studio/drafts'
import { getStudioFormat } from '@/lib/studio/formats'
import type { DraftCardModel } from '../DraftCard'
import { ReviewQueue } from './ReviewQueue'

export const dynamic = 'force-dynamic'

const BATCH = 25

export default async function StudioReviewPage() {
  await requireAdminPage('content.view')

  const [drafts, remaining] = await Promise.all([
    listStudioDrafts({ status: 'ready', limit: BATCH }),
    countStudioDraftsByStatus('ready'),
  ])

  const cards: DraftCardModel[] = drafts.map((d) => ({
    id: d.id,
    label: d.label,
    formatLabel: getStudioFormat(d.formatId)?.label ?? d.formatId,
    status: d.status,
    caption: d.caption,
    mediaUrl: d.mediaUrl,
    posterUrl: d.posterUrl,
    mediaKind: d.mediaKind,
    platforms: d.platforms,
    qaScore: d.qaScore,
    spendUsd: d.spendUsd,
    citationCount: d.citations.length,
    origin: d.origin,
    createdAt: d.createdAt,
  }))

  return (
    <>
      <SectionHead>Review — {remaining} waiting</SectionHead>
      <p className="av2-note">
        Approving stamps the draft for the publisher sweep. It does not post anything by itself.
      </p>
      <ReviewQueue drafts={cards} remaining={remaining} />
    </>
  )
}
