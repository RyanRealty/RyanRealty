// @no-parity — internal admin surface, no public mockup contract
// Documents to review: what the Vault document reader (lib/tc/doc-read,
// docs/TC_DOCUMENT_READER.md) would not decide on its own. The reader
// archives superseded and duplicate copies and keeps only fully executed
// copies on the checklist by itself; it flags a closed file with no fully
// executed copy of a form, copies it cannot tell apart, copies that disagree
// (one executed, one rejected), and removals a second model did not confirm.
// Brokers see their own deals; the principal sees every deal.
import { requireAdminPage } from '@/lib/admin/require-admin'
import { listDocumentReview } from '@/lib/data/tc/document-review'
import { dealVisibleToBroker } from '@/lib/tc/deal-scope'
import { VerdictLine } from '@/components/admin/v2'
import { DocumentReviewClient } from './DocumentReviewClient'

export const dynamic = 'force-dynamic'

export default async function DocumentReviewPage() {
  const ctx = await requireAdminPage('transactions.view')
  const groups = await listDocumentReview((brokerName) =>
    dealVisibleToBroker({ role: ctx.role, brokerSlug: ctx.brokerSlug, dealBrokerName: brokerName }),
  )
  const total = groups.reduce((n, g) => n + g.items.length, 0)
  const live = groups.filter((g) => g.stage !== 'closed' && g.stage !== 'dead').reduce((n, g) => n + g.items.length, 0)

  return (
    <div className="av2-scope" style={{ maxWidth: 760, margin: '0 auto', padding: 16 }}>
      <div style={{ margin: '0 0 14px' }}>
        <VerdictLine tone={total > 0 ? 'attention' : 'ok'}>
          {total > 0 ? (
            <>
              <b>
                {total} document{total === 1 ? '' : 's'} to review.
              </b>{' '}
              {live} on live deals, {total - live} on closed files.
            </>
          ) : (
            <>
              <b>Nothing to review.</b> Every document the Vault read was settled on its own.
            </>
          )}
        </VerdictLine>
      </div>

      <p style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)', margin: '0 0 18px' }}>
        The Vault reads every document on a deal: which form it is, who has to sign it, and who did.
        It keeps one copy of each form, archives the rest, and puts only fully executed copies on the
        checklist. This list is what it would not decide alone: a closed file missing a fully executed
        copy of a form, two copies it cannot tell apart, or copies that disagree. Open the deal to fix
        the file, then mark the flag resolved.
      </p>

      {groups.length > 0 ? <DocumentReviewClient groups={groups} /> : null}
    </div>
  )
}
