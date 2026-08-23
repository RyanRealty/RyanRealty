import { requireAdminPage } from '@/lib/admin/require-admin'
import { ReportGrid, ReportNumbers, VerdictLine } from '@/components/admin/v2'
import { getProductionReport } from '@/lib/data/tc/production'

export const dynamic = 'force-dynamic'

export default async function ProductionReportPage() {
  await requireAdminPage('transactions.view')
  const { brokers, deals } = await getProductionReport()
  const inReview = brokers.reduce((n, b) => n + b.inReview, 0)
  const incomplete = brokers.reduce((n, b) => n + b.incompleteRequired, 0)

  return (
    <div className="av2-scope" style={{ maxWidth: 860, margin: '0 auto', padding: 16 }}>
      <div style={{ margin: '0 0 14px' }}>
        <VerdictLine tone={inReview > 0 ? 'attention' : 'ok'}>
          <b>{deals} files on the board.</b> {inReview} item{inReview === 1 ? '' : 's'} in review ·{' '}
          {incomplete} required still open on in-flight deals.
        </VerdictLine>
      </div>
      <ReportNumbers
        items={brokers.map((b) => ({
          key: b.broker,
          label: b.broker,
          value: String(b.pending + b.listings),
        }))}
      />
      <ReportGrid
        label="Production by broker"
        columns={[
          { key: 'b', label: 'Broker' },
          { key: 'l', label: 'Listings', numeric: true },
          { key: 'p', label: 'Pending', numeric: true },
          { key: 'c', label: 'Closed', numeric: true },
          { key: 'd', label: 'Dead', numeric: true },
          { key: 'r', label: 'Required open', numeric: true },
          { key: 'i', label: 'In review', numeric: true },
        ]}
        template="minmax(140px, 1.4fr) repeat(6, minmax(72px, 0.7fr))"
        minWidth={720}
        rows={brokers.map((b) => ({
          key: b.broker,
          cells: [b.broker, b.listings, b.pending, b.closed, b.dead, b.incompleteRequired, b.inReview],
        }))}
        empty={<>No deals on the board.</>}
      />
    </div>
  )
}
