'use client'

/**
 * Documents to review — the interactive half of
 * app/admin/(protected)/closings/documents. One fold per deal, one queue row
 * per flagged document. Every write goes through
 * app/actions/tc-document-review.ts; this file owns no Supabase access.
 */
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { toast } from 'sonner'
import { formatDate } from '@/lib/format/date'
import { Button, QueueRow, type AdminState } from '@/components/admin/v2'
import { resolveDocumentReview } from '@/app/actions/tc-document-review'
import type { DocumentReviewGroup, DocumentReviewItem } from '@/lib/data/tc/document-review'

const TONE: Record<string, AdminState> = {
  'Fully executed': 'ok',
  'Signed, countered': 'accent',
  'Partially signed': 'slow',
  'Needs review': 'slow',
  Unsigned: 'waiting',
  Blank: 'waiting',
  'Blank form': 'waiting',
  Rejected: 'waiting',
  Reference: 'accent',
}

function Row({ item, propertyKey }: { item: DocumentReviewItem; propertyKey: string }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const resolve = () =>
    start(async () => {
      const res = await resolveDocumentReview({ documentId: item.documentId })
      if (!res.ok) toast.error(res.error)
      else {
        toast.success('Marked resolved.')
        router.refresh()
      }
    })
  return (
    <QueueRow
      kind={item.verdictLabel ?? 'Unread'}
      kindTone={TONE[item.verdictLabel ?? ''] ?? 'waiting'}
      title={
        <Link href={`/admin/deals/${encodeURIComponent(propertyKey)}`} style={{ color: 'inherit' }}>
          {item.documentName}
          {item.archived ? ' (archived)' : ''}
        </Link>
      }
      context={item.reasons.join(' ')}
      age={formatDate(item.flaggedAt)}
      action={
        <Button variant="quiet" touch disabled={pending} onClick={resolve}>
          Resolved
        </Button>
      }
    />
  )
}

export function DocumentReviewClient({ groups }: { groups: DocumentReviewGroup[] }) {
  return (
    <>
      {groups.map((g) => (
        <details key={g.dealId} className="av2-fold" open={g.stage !== 'closed' && g.stage !== 'dead'} style={{ marginBottom: 12 }}>
          <summary>
            <span>{g.address}</span>
            <span className="av2-fold__hint">
              {g.items.length} document{g.items.length === 1 ? '' : 's'} · {g.stage.replace('_', ' ')}
              {g.brokerName ? ` · ${g.brokerName}` : ''}
            </span>
          </summary>
          <div className="av2-fold__body">
            <ul className="av2-queue" style={{ marginTop: 0 }}>
              {g.items.map((item) => (
                <Row key={item.documentId} item={item} propertyKey={g.propertyKey} />
              ))}
            </ul>
          </div>
        </details>
      ))}
    </>
  )
}
