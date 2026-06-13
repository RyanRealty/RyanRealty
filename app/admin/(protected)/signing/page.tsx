// @no-parity — internal admin tool (signing dashboard), no public mockup contract
import Link from 'next/link'
import { getEnvelopesOverview } from '@/app/actions/tc-envelopes'
import { ENVELOPE_STATUS_LABEL, type EnvelopeStatus } from '@/lib/tc/signing'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

export const dynamic = 'force-dynamic'

const STATUS_STYLE: Record<EnvelopeStatus, string> = {
  draft: 'bg-muted text-muted-foreground',
  sent: 'bg-primary/15 text-primary',
  partially_signed: 'bg-warning/20 text-warning-foreground',
  completed: 'bg-success/20 text-success-foreground',
  voided: 'bg-destructive/15 text-destructive',
}

export default async function SigningDashboard() {
  const envelopes = await getEnvelopesOverview()
  const counts = envelopes.reduce<Record<string, number>>((acc, e) => {
    acc[e.status] = (acc[e.status] ?? 0) + 1
    return acc
  }, {})
  const active = envelopes.filter((e) => e.status === 'sent' || e.status === 'partially_signed')

  return (
    <main className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold text-foreground">Signing</h1>
        <p className="text-sm text-muted-foreground">
          Every envelope across all deals. Compose new envelopes from a deal&apos;s documents.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(['sent', 'partially_signed', 'completed', 'draft'] as EnvelopeStatus[]).map((s) => (
          <Card key={s}>
            <CardContent className="pt-4">
              <p className="text-2xl font-bold tabular-nums text-foreground">{counts[s] ?? 0}</p>
              <p className="text-xs text-muted-foreground">{ENVELOPE_STATUS_LABEL[s]}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {active.length ? (
        <section>
          <h2 className="mb-2 text-sm font-semibold text-foreground">Out for signature</h2>
          <EnvelopeTable rows={active} />
        </section>
      ) : null}

      <section>
        <h2 className="mb-2 text-sm font-semibold text-foreground">All envelopes</h2>
        {envelopes.length ? (
          <EnvelopeTable rows={envelopes} />
        ) : (
          <p className="text-sm text-muted-foreground">
            No envelopes yet. Open a deal and use “New envelope” on a document to start.
          </p>
        )}
      </section>
    </main>
  )
}

function EnvelopeTable({ rows }: { rows: Awaited<ReturnType<typeof getEnvelopesOverview>> }) {
  return (
    <div className="rounded-lg border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Envelope</TableHead>
            <TableHead>Deal</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Signed</TableHead>
            <TableHead>Sent</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((e) => (
            <TableRow key={e.id}>
              <TableCell>
                <Link href={`/admin/signing/${e.id}`} className="font-medium text-foreground hover:underline">
                  {e.name}
                </Link>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {e.dealKey ? (
                  <Link href={`/admin/deals/${encodeURIComponent(e.dealKey)}`} className="hover:underline">
                    {e.dealAddress ?? e.dealKey}
                  </Link>
                ) : (
                  '—'
                )}
              </TableCell>
              <TableCell>
                <Badge className={STATUS_STYLE[e.status]}>{ENVELOPE_STATUS_LABEL[e.status]}</Badge>
              </TableCell>
              <TableCell className="text-sm tabular-nums text-muted-foreground">
                {e.signedCount}/{e.recipientCount}
              </TableCell>
              <TableCell className="text-xs tabular-nums text-muted-foreground">
                {e.sentAt ? e.sentAt.slice(0, 10) : '—'}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
