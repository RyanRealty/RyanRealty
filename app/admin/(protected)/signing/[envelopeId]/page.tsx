// @no-parity — internal admin tool (envelope composer), no public mockup contract
//
// /admin/signing/[envelopeId] — the envelope ENTITY page (ADMIN_UI.md pattern
// 5: identity header, then the surface). P11E: migrated to the LOCKED admin v2
// language (design_system/admin/ADMIN_UI.md). PRESENTATION ONLY.
//
// This is a legally binding e-signature surface. EnvelopeComposer is MOUNTED
// UNCHANGED with the identical `detail` prop — every signer, signing order,
// field placement, token and audit-trail value still comes from and goes to it,
// untouched by this change.
//
// Carried over verbatim: the `params: Promise<{envelopeId}>` signature and
// `await params`, getEnvelopeDetail(envelopeId), `if (!detail) notFound()`,
// `dynamic = 'force-dynamic'`, the /admin/signing back href, the status word
// from ENVELOPE_STATUS_LABEL[detail.status] (not re-worded), and the
// "N document(s) · N signer(s)" line with both singular/plural rules.
//
// Shape changed, data did not: the page's own <main> is gone (ConsoleShell owns
// the landmark), the raw <h1> became the EntityTitle primitive (an entity
// page's own name is the one sanctioned h1), and the shadcn Badge became a
// state word carrying the same status text — draft/voided read quiet, sent
// reads as the accent, partially signed reads as in-progress, completed reads
// as done, where the Badge painted every status the same primary blue.
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireAdminPage } from '@/lib/admin/require-admin'
import { getEnvelopeDetail } from '@/app/actions/tc-envelopes'
import { EnvelopeComposer } from '@/components/tc/pdf-sign/EnvelopeComposer'
import { ENVELOPE_STATUS_LABEL, type EnvelopeStatus } from '@/lib/tc/signing'
import { EntityTitle, StateWord, type AdminState } from '@/components/admin/v2'

export const dynamic = 'force-dynamic'

/** Same map the dashboard uses; the status word itself is unchanged. */
const STATUS_STATE: Record<EnvelopeStatus, AdminState> = {
  draft: 'waiting',
  sent: 'accent',
  partially_signed: 'slow',
  completed: 'ok',
  voided: 'down',
}

export default async function EnvelopePage({ params }: { params: Promise<{ envelopeId: string }> }) {
  // CAPABILITY GUARD. Neither this page nor the signing list ran ANY auth of its
  // own — only the (protected) layout's "signed in with SOME admin role". This
  // page renders e-signature envelopes and mints 900-second signed URLs for the
  // underlying PDFs, which are legally binding documents.
  //
  // A JUDGMENT CALL, stated: unlike deals/[key], this family declares no
  // capability anywhere, so there was no sibling policy to copy. I applied
  // 'transactions.view' because tc_envelopes is the same tc_* data domain that
  // capability already governs on /admin/closings. No live user changes access —
  // it is ['broker'], superuser always passes, and admin_roles holds one
  // superuser and two brokers — so this only excludes a report_viewer, which
  // should not open legal documents. Say so if you disagree; it is one line.
  await requireAdminPage('transactions.view')

  const { envelopeId } = await params
  const detail = await getEnvelopeDetail(envelopeId)
  if (!detail) notFound()

  return (
    <div className="av2-scope" style={{ padding: 16 }}>
      <Link
        href="/admin/signing"
        style={{ color: 'var(--a-accent)', fontSize: 'var(--a-text-xs)' }}
      >
        ← All envelopes
      </Link>

      <div style={{ margin: '6px 0 4px' }}>
        <EntityTitle>{detail.name}</EntityTitle>
      </div>

      <p
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          flexWrap: 'wrap',
          fontSize: 'var(--a-text-sm)',
          color: 'var(--a-text-2)',
          margin: '0 0 20px',
        }}
      >
        <StateWord state={STATUS_STATE[detail.status] ?? 'waiting'}>
          {ENVELOPE_STATUS_LABEL[detail.status]}
        </StateWord>
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>
          {detail.documents.length} document{detail.documents.length === 1 ? '' : 's'} ·{' '}
          {detail.recipientCount} signer{detail.recipientCount === 1 ? '' : 's'}
        </span>
      </p>

      <EnvelopeComposer detail={detail} />
    </div>
  )
}
