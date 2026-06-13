// @no-parity — internal admin tool (envelope composer), no public mockup contract
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getEnvelopeDetail } from '@/app/actions/tc-envelopes'
import { EnvelopeComposer } from '@/components/tc/pdf-sign/EnvelopeComposer'
import { ENVELOPE_STATUS_LABEL } from '@/lib/tc/signing'
import { Badge } from '@/components/ui/badge'

export const dynamic = 'force-dynamic'

export default async function EnvelopePage({ params }: { params: Promise<{ envelopeId: string }> }) {
  const { envelopeId } = await params
  const detail = await getEnvelopeDetail(envelopeId)
  if (!detail) notFound()

  return (
    <main className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/admin/signing" className="text-xs text-muted-foreground underline underline-offset-2">
            ← All envelopes
          </Link>
          <h1 className="mt-1 text-2xl font-bold text-foreground">{detail.name}</h1>
          <p className="text-sm text-muted-foreground">
            {detail.documents.length} document{detail.documents.length === 1 ? '' : 's'} ·{' '}
            {detail.recipientCount} signer{detail.recipientCount === 1 ? '' : 's'}
          </p>
        </div>
        <Badge className="bg-primary text-primary-foreground hover:bg-primary">
          {ENVELOPE_STATUS_LABEL[detail.status]}
        </Badge>
      </header>

      <EnvelopeComposer detail={detail} />
    </main>
  )
}
