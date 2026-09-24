// @no-parity — internal admin surface, no public mockup contract
// Forms: every form the Vault document reader has met and who must sign it
// (lib/tc/doc-read/registry.ts, docs/TC_DOCUMENT_READER.md "The form
// registry"). OREF and Oregon REALTORS® change their forms every year; the
// registry learns each new form or release from the copies it reads, decided
// by the law that names its signers, the kind of instrument, or the signature
// blocks it prints. Read-only.
import Link from 'next/link'
import { requireAdminPage } from '@/lib/admin/require-admin'
import { listFormRegistry, type FormRegistryObligation, type FormRegistryRow } from '@/lib/data/tc/form-registry'
import { formatDate } from '@/lib/format/date'
import { QueueRow, QuietRow, SectionHead, VerdictLine, type AdminState } from '@/components/admin/v2'

export const dynamic = 'force-dynamic'

const PARTY: Record<string, string> = {
  buyer: 'buyer',
  seller: 'seller',
  buyer_agent: "buyer's agent",
  seller_agent: "seller's agent",
  escrow: 'escrow',
  title: 'title',
  lender: 'lender',
  vendor: 'vendor',
}

function list(parties: readonly string[], joiner: string): string {
  const names = parties.map((p) => PARTY[p] ?? p)
  if (names.length <= 1) return names[0] ?? ''
  return `${names.slice(0, -1).join(', ')} ${joiner} ${names[names.length - 1]}`
}

function whoSigns(o: FormRegistryObligation): string {
  if (o.kind === 'reference') return 'Kept on the file, not signed'
  if (o.kind === 'one_side') return `One side signs: the ${list(o.parties, 'or')}`
  const req = `Signed by the ${list(o.parties, 'and')}`
  return o.optional?.length ? `${req} (${list(o.optional, 'and')} optional)` : req
}

const BASIS: Record<FormRegistryRow['basis'], { word: string; tone: AdminState }> = {
  library: { word: 'Library', tone: 'ok' },
  law: { word: 'Law', tone: 'ok' },
  category: { word: 'Kind', tone: 'accent' },
  blocks: { word: 'Printed', tone: 'accent' },
  person: { word: 'Set', tone: 'ok' },
}

function counts(m: Record<string, number>): string {
  return Object.entries(m)
    .sort((a, b) => b[1] - a[1])
    .map(([k, n]) => (n > 1 ? `${k} (${n})` : k))
    .join(', ')
}

function Row({ f }: { f: FormRegistryRow }) {
  const b = BASIS[f.basis]
  const numbers = counts(f.numbers)
  const releases = counts(f.releases)
  return (
    <QueueRow
      kind={f.confidence === 'new' ? 'New' : b.word}
      kindTone={f.confidence === 'new' || f.libraryDisagrees ? 'slow' : b.tone}
      title={f.title}
      context={
        <>
          <b>{whoSigns(f.obligation)}.</b> {f.rule}
          <br />
          {f.copies} cop{f.copies === 1 ? 'y' : 'ies'}
          {numbers ? ` · ${numbers}` : ''}
          {releases ? ` · released ${releases}` : ''} · last seen {formatDate(f.lastSeenAt)}
          {f.libraryDisagrees ? ' · the newest copies print principal signature lines the library does not expect' : ''}
        </>
      }
    />
  )
}

export default async function FormsPage() {
  await requireAdminPage('transactions.view')
  const forms = await listFormRegistry()
  const signed = forms.filter((f) => f.obligation.kind !== 'reference')
  const kept = forms.filter((f) => f.obligation.kind === 'reference')
  const changed = signed.filter((f) => f.libraryDisagrees)
  const fresh = signed.filter((f) => f.confidence === 'new')
  const settled = signed.filter((f) => !f.libraryDisagrees && f.confidence !== 'new')
  const by = (basis: FormRegistryRow['basis']) => forms.filter((f) => f.basis === basis).length
  const attention = changed.length + fresh.length

  return (
    <div className="av2-scope" style={{ maxWidth: 820, margin: '0 auto', padding: 16 }}>
      <div style={{ margin: '0 0 14px' }}>
        <VerdictLine tone={attention > 0 ? 'attention' : 'ok'}>
          <b>
            {forms.length} form{forms.length === 1 ? '' : 's'} known.
          </b>{' '}
          Who signs: {by('library')} from the curated library, {by('law')} fixed by law, {by('category')} by the kind of instrument,{' '}
          {by('blocks')} from the lines the form prints{by('person') ? `, ${by('person')} set by a person` : ''}.
          {attention > 0 ? ` ${fresh.length} new, ${changed.length} changed in a new release.` : ''}
        </VerdictLine>
      </div>

      <p style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)', margin: '0 0 18px' }}>
        OREF and Oregon REALTORS® change their forms every year. The Vault learns each form from the copies it reads and
        decides who has to sign it: first by the law that names the signers, then by what kind of instrument it is (an
        agreement, a notice, an advisory, a receipt), then by the signature lines the form prints across every copy. A form
        seen fewer than three times is shown here but not acted on alone. Documents it would not decide are on{' '}
        <Link href="/admin/closings/documents" style={{ color: 'var(--a-accent)' }}>
          Documents to review
        </Link>
        .
      </p>

      {changed.length > 0 ? (
        <>
          <SectionHead>Changed in a new release</SectionHead>
          <ul style={{ listStyle: 'none', margin: '0 0 18px', padding: 0 }}>
            {changed.map((f) => (
              <Row key={f.identity} f={f} />
            ))}
          </ul>
        </>
      ) : null}

      {fresh.length > 0 ? (
        <>
          <SectionHead>New: seen on fewer than three copies</SectionHead>
          <ul style={{ listStyle: 'none', margin: '0 0 18px', padding: 0 }}>
            {fresh.map((f) => (
              <Row key={f.identity} f={f} />
            ))}
          </ul>
        </>
      ) : null}

      <SectionHead>Signed forms</SectionHead>
      <ul style={{ listStyle: 'none', margin: '0 0 18px', padding: 0 }}>
        {settled.map((f) => (
          <Row key={f.identity} f={f} />
        ))}
      </ul>

      {kept.length > 0 ? (
        <>
          <SectionHead>Kept, not signed</SectionHead>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {kept.map((f) => (
              <QuietRow key={f.identity} name={f.title} state="Kept" figure={`${f.copies}`} />
            ))}
          </ul>
        </>
      ) : null}
    </div>
  )
}
