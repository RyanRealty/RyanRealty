// @no-parity — internal admin surface, no public mockup contract
/**
 * /admin/studio — the content console.
 *
 * One page: make something, look at what came back, approve or kill. The
 * daily slate cron drops its drafts here too, so the morning routine is the
 * same routine as the on-demand one.
 *
 * Nothing on this page can publish by itself. Approve stamps the row that
 * publisher-sweep already knows how to read (CLAUDE.md §1).
 */
import { requireAdminPage } from '@/lib/admin/require-admin'
import { SectionHead, VerdictLine } from '@/components/admin/v2'
import { listStudioDrafts } from '@/lib/data/studio/drafts'
import { studioPlaceOptions } from '@/lib/data/studio/subjects'
import { STUDIO_FORMAT_LIST, getStudioFormat } from '@/lib/studio/formats'
import { StudioProducer } from './StudioProducer'
import { DraftCard, type DraftCardModel } from './DraftCard'

export const dynamic = 'force-dynamic'

export default async function StudioPage() {
  await requireAdminPage('content.view')

  const [drafts, places] = await Promise.all([listStudioDrafts({ limit: 40 }), studioPlaceOptions()])
  const waiting = drafts.filter((d) => d.status === 'ready')
  // Killed drafts are noise on a console whose job is "decide the ones that
  // survived". They stay counted, and their reasons stay on the row, but they
  // do not each take a card.
  const live = drafts.filter((d) => d.status !== 'killed')
  const killed = drafts.filter((d) => d.status === 'killed')

  const spentToday = drafts
    .filter((d) => d.createdAt.slice(0, 10) === new Date().toISOString().slice(0, 10))
    .reduce((sum, d) => sum + (d.spendUsd ?? 0), 0)

  const cards: DraftCardModel[] = live.map((d) => ({
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
    <div className="av2-scope" style={{ maxWidth: 760, margin: '0 auto', padding: 16 }}>
      <div style={{ margin: '0 0 16px' }}>
        <VerdictLine tone={waiting.length > 0 ? 'attention' : 'ok'}>
          {waiting.length > 0 ? (
            <>
              <b>
                {waiting.length} draft{waiting.length === 1 ? '' : 's'} waiting on you.
              </b>{' '}
              Approve sends it to the publisher. Kill ends it.
            </>
          ) : (
            <>
              <b>Nothing waiting.</b> Make something, or wait for the morning slate.
            </>
          )}
        </VerdictLine>
      </div>

      <StudioProducer
        formats={STUDIO_FORMAT_LIST.map((f) => ({
          id: f.id,
          label: f.label,
          what: f.what,
          subject: f.subject,
        }))}
        places={places}
      />

      <SectionHead>Drafts</SectionHead>
      {cards.length === 0 ? (
        <p style={{ color: 'var(--a-text-2)', fontSize: 'var(--a-text-sm)' }}>
          No drafts yet.
        </p>
      ) : (
        cards.map((draft) => <DraftCard key={draft.id} draft={draft} />)
      )}

      <p style={{ marginTop: 18, fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)' }}>
        Spent today: ${spentToday.toFixed(2)}. Every figure in a caption traces to a named source.
        {killed.length > 0
          ? ` ${killed.length} draft${killed.length === 1 ? '' : 's'} did not pass and were killed.`
          : ''}
      </p>
    </div>
  )
}
