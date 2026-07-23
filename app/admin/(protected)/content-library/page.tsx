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
 */

import { requireAdminPage } from '@/lib/admin/require-admin'
import { getBrokerSelfRecordByEmail } from '@/lib/data'
import { formatDate } from '@/lib/format/date'
import { listBrokerDeliverables, signDeliverableDownload } from '@/lib/marketing-brain/deliverable-library'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

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
  const items = brokerSlug ? await listBrokerDeliverables(brokerSlug) : []

  // Sign each row for THIS broker. The action takes the PARTS, never a path —
  // the object key is rebuilt server-side from the session's broker slug, so
  // there is no path string in play for a caller to tamper with.
  const rows = await Promise.all(
    items.map(async (item) => ({
      ...item,
      url: brokerSlug ? await signDeliverableDownload(brokerSlug, item.actionId, item.filename) : null,
    })),
  )

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="font-display text-2xl text-foreground">Content library</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {brokerSlug
            ? `Finished deliverables produced for ${displayName ?? brokerSlug}. Download links expire after five minutes.`
            : 'Your login is not linked to a broker record, so there is no library to show.'}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            {rows.length} {rows.length === 1 ? 'deliverable' : 'deliverables'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nothing here yet. A deliverable lands in this library when a producer run finishes.
            </p>
          ) : (
            <>
            {/* Mobile: a card per deliverable. The table below is desktop-only. */}
            <ul className="space-y-3 md:hidden">
              {rows.map((row) => (
                <li key={row.path} className="rounded-lg border border-border p-3">
                  <p className="font-medium break-all">{row.filename}</p>
                  <p className="mt-1 text-sm tabular-nums text-muted-foreground">
                    {formatDate(row.createdAt)} · {formatSize(row.sizeBytes)}
                  </p>
                  <div className="mt-3">
                    {row.url ? (
                      <Button asChild variant="outline" size="sm">
                        <a href={row.url} download>
                          Download
                        </a>
                      </Button>
                    ) : (
                      <span className="text-sm text-muted-foreground">Unavailable</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
            <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>File</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead className="text-right">Download</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.path}>
                    <TableCell className="font-medium">{row.filename}</TableCell>
                    <TableCell className="tabular-nums text-muted-foreground">
                      {formatDate(row.createdAt)}
                    </TableCell>
                    <TableCell className="tabular-nums text-muted-foreground">
                      {formatSize(row.sizeBytes)}
                    </TableCell>
                    <TableCell className="text-right">
                      {row.url ? (
                        <Button asChild variant="outline" size="sm">
                          <a href={row.url} download>
                            Download
                          </a>
                        </Button>
                      ) : (
                        <span className="text-sm text-muted-foreground">Unavailable</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
