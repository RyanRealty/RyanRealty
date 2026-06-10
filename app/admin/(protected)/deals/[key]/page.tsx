// @no-parity — internal admin tool (deal detail: documents, archive, checklist, audit)
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card'
import { getTcDeal, type TcCycle, type TcDocument } from '@/app/actions/tc'
import { getAnticipatedDocuments, type AnticipatedDocsResult } from '@/app/actions/tc-required-docs'
import { cn } from '@/lib/utils'
import { getDealContacts } from '@/app/actions/tc-contacts'
import { ArchiveToggle, DownloadButton } from './DocumentRowActions'
import { ChecklistStatusControl } from './ChecklistControls'
import { DealContacts } from './DealContacts'

export const dynamic = 'force-dynamic'

type Props = {
  params: Promise<{ key: string }>
  searchParams: Promise<{ archived?: string }>
}

const money = (v: number | null | undefined) =>
  v == null ? '—' : `$${Math.round(v).toLocaleString('en-US')}`
const d10 = (v: string | null | undefined) => (v ? String(v).slice(0, 10) : '—')
const kb = (n: number | null | undefined) =>
  n == null ? '—' : n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.round(n / 1024)} KB`

/** Mouse-over preview: first page + last page (signature blocks live on the
 *  last page of most OREF forms) so signature state is visible without a click. */
function DocNameWithPreview({ doc }: { doc: TcDocument }) {
  const name = (
    <p className="truncate font-medium text-foreground" title={doc.name}>
      {doc.name}
    </p>
  )
  if (!doc.thumbFirstUrl) return name
  const single = !doc.thumbLastUrl
  return (
    <HoverCard openDelay={150} closeDelay={80}>
      <HoverCardTrigger asChild>
        <p className="cursor-zoom-in truncate font-medium text-foreground underline decoration-dotted decoration-border underline-offset-4">
          {doc.name}
        </p>
      </HoverCardTrigger>
      <HoverCardContent side="right" align="start" className="w-auto max-w-[680px] p-3">
        <div className="flex gap-3">
          <figure className="m-0">
            {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL, remote loader not configured for storage host */}
            <img
              src={doc.thumbFirstUrl}
              alt={`First page of ${doc.name}`}
              className="max-h-[420px] w-auto rounded-md border border-border bg-white"
            />
            <figcaption className="mt-1 text-center text-[10px] text-muted-foreground">
              page 1{single ? ' (only page)' : ''}
            </figcaption>
          </figure>
          {doc.thumbLastUrl ? (
            <figure className="m-0">
              {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL */}
              <img
                src={doc.thumbLastUrl}
                alt={`Last page of ${doc.name}`}
                className="max-h-[420px] w-auto rounded-md border border-border bg-white"
              />
              <figcaption className="mt-1 text-center text-[10px] text-muted-foreground">
                last page · signatures
              </figcaption>
            </figure>
          ) : null}
        </div>
      </HoverCardContent>
    </HoverCard>
  )
}

const ROLE_LABEL: Record<string, string> = {
  listing: 'Listing side',
  buyer: 'Buyer side',
  dual: 'Disclosed dual agency',
  unknown: 'Role not set',
}

/** Anticipated-documents view — the Oregon-law required-doc predictor. */
function AnticipatedDocs({ data }: { data: AnticipatedDocsResult | null }) {
  if (!data || data.documents.length === 0) return null
  const missing = data.documents.filter((d) => !d.present)
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-medium text-foreground">
          Documents anticipated{' '}
          <span className="font-normal text-muted-foreground">
            ({ROLE_LABEL[data.role] ?? data.role})
          </span>
        </p>
        <p className="text-xs tabular-nums text-muted-foreground">
          {data.documents.filter((d) => d.present).length}/{data.documents.length} present
          {data.missingRequired > 0 ? ` · ${data.missingRequired} required missing` : ''}
        </p>
      </div>
      <ul className="space-y-1.5">
        {data.documents.map((d) => (
          <li key={d.id} className="flex items-start gap-2 text-sm">
            <span
              className={cn(
                'mt-0.5 inline-flex size-4 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold',
                d.present
                  ? 'bg-success text-success-foreground'
                  : d.severity === 'required'
                    ? 'bg-destructive text-destructive-foreground'
                    : 'bg-warning/30 text-foreground'
              )}
              aria-hidden
            >
              {d.present ? '✓' : '!'}
            </span>
            <span className="min-w-0">
              <span className={cn('text-foreground', d.present && 'text-muted-foreground line-through')}>
                {d.label}
              </span>
              {d.orefForm ? <span className="ml-1 text-xs text-muted-foreground">OREF {d.orefForm}</span> : null}
              <span className="ml-2 text-xs text-muted-foreground" title={d.citation}>
                {d.severity === 'verify' ? '⚑ verify · ' : ''}
                {d.citation}
              </span>
            </span>
          </li>
        ))}
      </ul>
      {missing.length > 0 ? (
        <p className="mt-3 text-xs text-muted-foreground">
          {missing.length} not yet on file. {data.unknown.length > 0
            ? `Confirm to refine: ${data.unknown.slice(0, 4).join(', ')}${data.unknown.length > 4 ? '…' : ''}`
            : ''}
        </p>
      ) : null}
    </div>
  )
}

function CycleSection({
  cycle,
  showArchived,
  anticipated,
}: {
  cycle: TcCycle
  showArchived: boolean
  anticipated: AnticipatedDocsResult | null
}) {
  const docs = cycle.documents.filter((doc) => (showArchived ? true : !doc.archived))
  const archivedCount = cycle.documents.filter((doc) => doc.archived).length
  const docNameById = new Map(cycle.documents.map((doc) => [doc.id, doc.name]))

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm tabular-nums text-foreground">
        {cycle.sale_price ? <span>{money(cycle.sale_price)}</span> : null}
        {cycle.office_gross ? <span className="text-muted-foreground">gross {money(cycle.office_gross)}</span> : null}
        {cycle.escrow_number ? <span className="text-muted-foreground">escrow {cycle.escrow_number}</span> : null}
        {cycle.mls_number ? <span className="text-muted-foreground">MLS {cycle.mls_number}</span> : null}
        {cycle.actual_closing_date ? (
          <span className="text-muted-foreground">closed {d10(cycle.actual_closing_date)}</span>
        ) : cycle.escrow_closing_date ? (
          <span className="text-muted-foreground">closes {d10(cycle.escrow_closing_date)}</span>
        ) : null}
        {cycle.dead_date ? <span className="text-muted-foreground">dead {d10(cycle.dead_date)}</span> : null}
      </div>
      {(cycle.sellers.length || cycle.buyers.length) ? (
        <p className="text-xs text-muted-foreground">
          {cycle.sellers.length ? `Sellers: ${cycle.sellers.join(', ')}` : ''}
          {cycle.sellers.length && cycle.buyers.length ? ' · ' : ''}
          {cycle.buyers.length ? `Buyers: ${cycle.buyers.join(', ')}` : ''}
        </p>
      ) : null}

      {/* Anticipated documents (Oregon-law required-doc predictor) */}
      <AnticipatedDocs data={anticipated} />

      {/* Documents */}
      <div className="rounded-lg border border-border bg-card">
        <div className="flex items-center justify-between px-4 py-2">
          <p className="text-sm font-medium text-foreground">
            Documents <span className="tabular-nums text-muted-foreground">({docs.length}{!showArchived && archivedCount ? ` live · ${archivedCount} archived hidden` : ''})</span>
          </p>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead className="w-20">Pages</TableHead>
              <TableHead className="w-24">Size</TableHead>
              <TableHead className="w-28">Uploaded</TableHead>
              <TableHead className="w-40">State</TableHead>
              <TableHead className="w-44 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {docs.map((doc) => (
              <TableRow key={doc.id} className={cn(doc.archived && 'opacity-60')}>
                <TableCell className="max-w-md">
                  <DocNameWithPreview doc={doc} />
                  {doc.archived && doc.archived_reason ? (
                    <p className="truncate text-xs text-muted-foreground" title={doc.archived_reason}>
                      {doc.archived_reason}
                    </p>
                  ) : null}
                </TableCell>
                <TableCell className="tabular-nums">{doc.page_count ?? '—'}</TableCell>
                <TableCell className="tabular-nums">{kb(doc.bytes)}</TableCell>
                <TableCell className="tabular-nums">{d10(doc.source_uploaded_at)}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {doc.is_broker_notes ? (
                      <Badge className="bg-primary text-primary-foreground hover:bg-primary">Broker notes</Badge>
                    ) : null}
                    {doc.archived ? (
                      <Badge variant="secondary">Archived</Badge>
                    ) : (
                      <Badge className="bg-success/15 text-success hover:bg-success/15">Live</Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <DownloadButton documentId={doc.id} disabled={!doc.storage_path} />
                    <ArchiveToggle documentId={doc.id} archived={doc.archived} docName={doc.name} />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Checklist */}
      <div className="rounded-lg border border-border bg-card p-4">
        <p className="mb-3 text-sm font-medium text-foreground">Checklist</p>
        <div className="grid gap-2 lg:grid-cols-2">
          {cycle.checklist.map((item) => (
            <div key={item.id} className="flex items-start justify-between gap-2 rounded-md bg-muted/50 px-3 py-2">
              <div className="min-w-0">
                <p className="text-sm text-foreground">{item.name}</p>
                {item.documentIds.length ? (
                  <p className="truncate text-xs text-muted-foreground">
                    {item.documentIds
                      .map((id) => docNameById.get(id))
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                ) : null}
              </div>
              <ChecklistStatusControl
                itemId={item.id}
                status={item.status}
                docCount={item.documentIds.length}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default async function TcDealPage({ params, searchParams }: Props) {
  const { key } = await params
  const { archived } = await searchParams
  const showArchived = archived === '1'
  const deal = await getTcDeal(decodeURIComponent(key))
  if (!deal) notFound()

  const contacts = await getDealContacts(deal.id)

  const anticipatedByCycle = new Map<string, AnticipatedDocsResult | null>(
    await Promise.all(
      deal.cycles.map(
        async (c) => [c.id, await getAnticipatedDocuments(c.id)] as [string, AnticipatedDocsResult | null]
      )
    )
  )

  const stageLabel: Record<string, string> = {
    pending: 'Under contract',
    active_listing: 'Active listing',
    pre_contract: 'Pre-contract',
    closed: 'Closed',
    dead: 'Canceled',
  }

  return (
    <main className="space-y-6">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <Link href="/admin/deals" className="text-sm text-muted-foreground hover:underline">
            ← Deals
          </Link>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{deal.address}</h1>
            <p className="text-sm text-muted-foreground">
              {deal.broker_name ?? '—'} · {deal.stage_detail ?? stageLabel[deal.stage] ?? deal.stage}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge className="bg-primary text-primary-foreground hover:bg-primary">
              {stageLabel[deal.stage] ?? deal.stage}
            </Badge>
            <Link
              href={showArchived ? `/admin/deals/${encodeURIComponent(deal.property_key)}` : `/admin/deals/${encodeURIComponent(deal.property_key)}?archived=1`}
              className="text-xs text-muted-foreground underline underline-offset-2"
            >
              {showArchived ? 'Hide archived' : 'Show archived'}
            </Link>
          </div>
        </div>
      </header>

      <Accordion
        type="multiple"
        defaultValue={deal.cycles.length ? [deal.cycles[0].id] : []}
        className="space-y-3"
      >
        {deal.cycles.map((cycle) => (
          <AccordionItem key={cycle.id} value={cycle.id} className="rounded-lg border border-border bg-card px-4">
            <AccordionTrigger className="text-sm font-semibold text-foreground">
              <span>
                {cycle.kind === 'listing' ? 'Listing folder' : 'Sale cycle'} · {cycle.status ?? '—'}
                <span className="ml-2 font-normal text-muted-foreground">
                  {cycle.documents.filter((doc) => !doc.archived).length} live docs · {cycle.source_guid.slice(0, 8)}
                </span>
              </span>
            </AccordionTrigger>
            <AccordionContent>
              <CycleSection
                cycle={cycle}
                showArchived={showArchived}
                anticipated={anticipatedByCycle.get(cycle.id) ?? null}
              />
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>

      {/* Deal team & contacts (co-agents + lender/title/escrow/appraiser/TC) */}
      <DealContacts dealId={deal.id} contacts={contacts} />

      {/* Forms & signing placeholder (Phase 2b) */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Forms & signing</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">
            Envelope composer (OREF / ODS / OR form fill, signature fields, signer assignment) ships in
            Phase 2b — schema is in place. See docs/TC_SYSTEM.md.
          </p>
        </CardContent>
      </Card>

      {/* Audit trail */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Recent activity</CardTitle>
        </CardHeader>
        <CardContent>
          {deal.events.length === 0 ? (
            <p className="text-xs text-muted-foreground">No events yet.</p>
          ) : (
            <ul className="space-y-1.5 text-xs">
              {deal.events.map((e) => (
                <li key={e.id} className="flex flex-wrap gap-2 text-muted-foreground">
                  <span className="tabular-nums">{String(e.created_at).slice(0, 16).replace('T', ' ')}</span>
                  <span className="font-medium text-foreground">{e.action}</span>
                  <span>{e.actor}</span>
                  {e.detail && Object.keys(e.detail).length ? (
                    <span className="truncate">{JSON.stringify(e.detail).slice(0, 120)}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </main>
  )
}
