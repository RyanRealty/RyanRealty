// @no-parity — internal admin surface, no public mockup contract
/**
 * /admin/content-library — the broker content library (W10.2).
 *
 * Every finished producer deliverable is persisted into the private
 * `marketing-deliverables` bucket under the requesting broker's prefix
 * (app/api/admin/run-producer/[id]/route.ts calls persistDeliverable on the
 * ready transition). This page is where a broker comes back to it.
 *
 * Scoping: the broker slug comes from the SESSION, never the URL — the page
 * lists exactly one broker's prefix and signs each download for that same
 * broker. There is no "all brokers" view to fall into, by construction
 * (ci:deliverable-library-scope).
 *
 * Download URLs are minted at render and expire in 5 minutes, so a copied
 * link does not become a permanent public handle on broker work product.
 *
 * P11D: migrated to the LOCKED admin v2 language (design_system/admin/ADMIN_UI.md).
 * Carried over verbatim: requireAdminPage('content.view'), the resolve-by-EMAIL
 * broker lookup and its superuser reasoning, listBrokerDeliverables(brokerSlug),
 * signDeliverableDownload(brokerSlug, actionId, filename) with the parts-not-path
 * contract, the default-deny isShareableToSocial / captionFor /
 * shareableTypeLabel derivation, formatSize, formatDate, the `download`
 * attribute, and the DeliverableShareBar mount with the same three props.
 *
 * Shape changed, data did not: the shadcn Card + the desktop-only <Table> and
 * its md:hidden card twin collapsed into ONE list of rows that reads the same
 * at 375px and 1280px, the <h1> title chrome is gone (the nav names the page),
 * and a FAILED listing now says so instead of rendering as an empty library.
 * Not ReportGrid: a shareable row carries a full-width DeliverableShareBar,
 * which the grid has no sub-row to hold — the legacy table needed a colSpan=4
 * row for exactly that.
 */

import { requireAdminPage } from '@/lib/admin/require-admin'
import { getBrokerSelfRecordByEmail } from '@/lib/data'
import { formatDate } from '@/lib/format/date'
import { listBrokerDeliverables } from '@/lib/marketing-brain/deliverable-library'
import {
  isShareableToSocial,
  captionFor,
  shareableTypeLabel,
} from '@/lib/marketing-brain/deliverable-share'
import { DeliverableShareBar } from './_components/DeliverableShareBar'
import { DownloadDeliverableButton } from './_components/DownloadDeliverableButton'
import { ReportError, SectionHead, VerdictLine } from '@/components/admin/v2'

export const dynamic = 'force-dynamic'

function formatSize(bytes: number | null): string {
  if (bytes == null) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default async function ContentLibraryPage() {
  // The broker identity comes from the SESSION, never the URL: requireAdminPage
  // returns the signed-in email, and the roster row is read through the DAL
  // (reads never route through server actions — ci:page-action-imports).
  // Resolving by EMAIL rather than admin_roles.broker_id matters: a superuser
  // row carries broker_id = NULL, so Matt — principal broker and superuser —
  // would otherwise render as "no broker record" on his own library.
  const ctx = await requireAdminPage('content.view')
  const broker = (await getBrokerSelfRecordByEmail(ctx.email)) as
    | { slug?: string; display_name?: string }
    | null
  const brokerSlug = broker?.slug ?? null
  const displayName = broker?.display_name ?? null
  // A failed listing returns null, which reads differently from an empty
  // library: an empty list means "no producer run has finished", and the
  // broker acts on that. Rendering a read failure as emptiness is the §0 lie
  // this migration removes.
  const items = brokerSlug ? await listBrokerDeliverables(brokerSlug).catch(() => null) : []

  // P12: do NOT sign every row at render (that was 28–44s on a full library).
  // Download buttons sign on click via signDeliverableForDownload. Share bars
  // still need a URL — only sign shareable rows (usually a small minority).
  //
  // shareable/caption are computed DEFAULT-DENY from the filename (which encodes
  // the action type): a CMA, a BPO, or an internal summary is never shareable,
  // so the share bar cannot expose a client's private pricing document to a
  // public feed (ci:deliverable-share-safety).
  const { signDeliverableDownload } = await import('@/lib/marketing-brain/deliverable-library')
  const rows = await Promise.all(
    (items ?? []).map(async (item) => {
      const shareable = isShareableToSocial(item.filename)
      const shareUrl =
        shareable && brokerSlug
          ? await signDeliverableDownload(brokerSlug, item.actionId, item.filename).catch(() => null)
          : null
      return {
        ...item,
        shareUrl,
        shareable,
        caption: shareable ? captionFor(item.filename) : '',
        typeLabel: shareable ? shareableTypeLabel(item.filename) : '',
      }
    }),
  )

  return (
    <div className="av2-scope" style={{ maxWidth: 860, margin: '0 auto', padding: 16 }}>
      <div style={{ margin: '0 0 14px' }}>
        <VerdictLine tone={items === null || !brokerSlug ? 'attention' : 'ok'}>
          {!brokerSlug ? (
            <b>Your login is not linked to a broker record, so there is no library to show.</b>
          ) : items === null ? (
            <b>The library could not be read. Nothing below is a listing of your work.</b>
          ) : (
            <>
              <b>
                {rows.length} {rows.length === 1 ? 'deliverable' : 'deliverables'} for{' '}
                {displayName ?? brokerSlug}.
              </b>{' '}
              Download signs on click (links expire five minutes after you request them).
            </>
          )}
        </VerdictLine>
      </div>

      {items === null ? <ReportError what="The content library" href="/admin/content-library" /> : null}

      {brokerSlug && items !== null ? (
        <>
          <SectionHead>Finished deliverables</SectionHead>
          {rows.length === 0 ? (
            <p style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)' }}>
              Nothing here yet. A deliverable lands in this library when a producer run finishes.
            </p>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 12 }}>
              {rows.map((row) => (
                <li key={row.path} className="av2-pane">
                  <div>
                    <p style={{ fontWeight: 600, overflowWrap: 'anywhere', margin: 0 }}>
                      {row.filename}
                    </p>
                    <p
                      style={{
                        margin: '2px 0 0',
                        fontSize: 'var(--a-text-sm)',
                        color: 'var(--a-text-2)',
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {formatDate(row.createdAt)} · {formatSize(row.sizeBytes)}
                    </p>
                  </div>

                  <div className="av2-wordrow">
                    {brokerSlug ? (
                      <DownloadDeliverableButton actionId={row.actionId} filename={row.filename} />
                    ) : (
                      <span style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)' }}>
                        Unavailable
                      </span>
                    )}
                  </div>

                  {row.shareable && (
                    <DeliverableShareBar
                      caption={row.caption}
                      typeLabel={row.typeLabel}
                      downloadUrl={row.shareUrl}
                    />
                  )}
                </li>
              ))}
            </ul>
          )}
        </>
      ) : null}
    </div>
  )
}
