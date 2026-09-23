// @no-parity — internal admin surface, no public mockup contract
// Mail queue: the ONE place a broker answers email the auto-filer could not
// place on its own. Everything else (escrow number, MLS number, address,
// thread match) files itself onto a deal via the mail index — this page is
// only what that index left as `ambiguous` (touches several files) or
// `unfiled_transaction` (transaction mail for a property with no file yet).
// Mailbox scope mirrors app/actions/tc-mail.ts ctxForEdit(): superuser reads
// every mailbox, a broker reads only their own, an unmapped broker reads
// nothing (fail closed, never everything).
import { requireAdminPage } from '@/lib/admin/require-admin'
import { listMailQueue } from '@/lib/data/tc/mail-reads'
import { getClosingsBoard } from '@/lib/data/tc/closings'
import { BROKER_FILE_EMAIL, dealVisibleToBroker, fileNameFromBrokerSlug } from '@/lib/tc/deal-scope'
import { VerdictLine } from '@/components/admin/v2'
import { MailQueueClient, type DealOption } from './MailQueueClient'

export const dynamic = 'force-dynamic'

export default async function MailQueuePage() {
  const ctx = await requireAdminPage('transactions.view')
  const mailbox = ctx.role === 'superuser' ? null : BROKER_FILE_EMAIL[fileNameFromBrokerSlug(ctx.brokerSlug) ?? ''] ?? '__none__'
  const nowMs = Date.now()

  const [{ groups }, board] = await Promise.all([listMailQueue({ mailbox }), getClosingsBoard()])

  const dealOptions: DealOption[] = board.unreadable
    ? []
    : board.deals
        .filter((d) => dealVisibleToBroker({ role: ctx.role, brokerSlug: ctx.brokerSlug, dealBrokerName: d.brokerName }))
        .map((d) => ({ dealId: d.id, address: d.address, brokerName: d.brokerName, stage: d.stage }))
        .sort((a, b) => a.address.localeCompare(b.address))

  const totalRows = groups.reduce((n, g) => n + g.rows.length, 0)

  return (
    <div className="av2-scope" style={{ maxWidth: 760, margin: '0 auto', padding: 16 }}>
      <div style={{ margin: '0 0 14px' }}>
        <VerdictLine tone={totalRows > 0 ? 'attention' : 'ok'}>
          {totalRows > 0 ? (
            <>
              <b>
                {totalRows} email{totalRows === 1 ? '' : 's'} need{totalRows === 1 ? 's' : ''} filing.
              </b>{' '}
              {groups.length} group{groups.length === 1 ? '' : 's'} to answer.
            </>
          ) : (
            <>
              <b>Nothing to file.</b> Email about your deals is being filed automatically.
            </>
          )}
        </VerdictLine>
      </div>

      <p style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)', margin: '0 0 18px' }}>
        Every deal email gets filed automatically — matched by escrow number, MLS number, property
        address, or the thread it belongs to. This page only holds what the system could not tell
        apart on its own: email that could belong to more than one file, or transaction email (an
        offer, escrow, or title notice) for a property with no file open yet. Answer it here; every
        other email needs nothing from you.
      </p>

      {groups.length > 0 ? <MailQueueClient groups={groups} dealOptions={dealOptions} nowMs={nowMs} /> : null}
    </div>
  )
}
