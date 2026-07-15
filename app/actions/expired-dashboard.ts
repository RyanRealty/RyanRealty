'use server'

/**
 * Expireds Dashboard actions — build an expired audit and approve+send it by
 * email, from the dashboard row. Every send is an explicit admin click:
 * the click IS the approval (draft-first: the audit link sits next to the
 * button so the broker reviews before sending; a needs_review audit requires
 * the explicit acknowledgment checkbox in the confirm dialog).
 */

import { revalidatePath } from 'next/cache'
import { getSession } from '@/app/actions/auth'
import { getAdminRoleForEmail } from '@/app/actions/admin-roles'
import { buildCma } from '@/lib/cma/build'
import { sendCmaToLead } from '@/lib/cma/send'
import { getCmaAdminRowBySlug } from '@/lib/data/cma/documents'
import { updateCmaRowFieldsBySlug } from '@/lib/data'
import { getExpiredListingDetail } from '@/lib/data/expired/outreach'
import { slugifyAddress } from '@/lib/cma/address-slug'

async function requireAdmin(): Promise<string | null> {
  const session = await getSession()
  const role = await getAdminRoleForEmail(session?.user?.email ?? null)
  if (!role || role.role === 'report_viewer') return null
  return session?.user?.email ?? 'admin'
}

export async function buildExpiredAuditAction(
  listingKey: string,
): Promise<{ data: { slug: string } | null; error: string | null }> {
  try {
    if (!(await requireAdmin())) return { data: null, error: 'Unauthorized' }
    const e = await getExpiredListingDetail(listingKey)
    if (!e) return { data: null, error: 'Expired listing not found' }
    if (!e.street_address) return { data: null, error: 'No street address on the expired record' }
    const slug = slugifyAddress(e.street_address)
    const res = await buildCma({
      slug,
      mlsNumber: e.listing_key,
      rawAddress: e.street_address,
      city: e.city,
      postalCode: e.postal_code,
      client: { name: e.owner_name, email: e.contact_email, phone: e.contact_phone, notes: 'Expired-listing audit (dashboard build)' },
      requestSource: 'expired-dashboard',
      docType: 'expired-audit',
    })
    if (!res.ok) return { data: null, error: res.error ?? 'Audit build failed' }
    revalidatePath('/admin/expireds')
    return { data: { slug }, error: null }
  } catch (err) {
    console.error('[buildExpiredAuditAction]', err)
    return { data: null, error: 'Audit build failed unexpectedly' }
  }
}

export async function sendExpiredAuditEmailAction(
  listingKey: string,
  opts: { acknowledgeReview?: boolean } = {},
): Promise<{ data: { transport: string } | null; error: string | null }> {
  try {
    if (!(await requireAdmin())) return { data: null, error: 'Unauthorized' }
    const e = await getExpiredListingDetail(listingKey)
    if (!e) return { data: null, error: 'Expired listing not found' }

    // Guards re-run at send time (same posture as the SMS action).
    if (e.relisted) return { data: null, error: 'This property is back on the market. No outreach to a re-listed property.' }
    if (e.hard_stop) return { data: null, error: 'Hard-stop contact (litigator / TCPA / deceased flag). Do not contact.' }
    if (!e.contact_email) return { data: null, error: 'No owner email on file. Skip-trace found no email for this owner.' }
    if (!e.street_address) return { data: null, error: 'No street address on the expired record' }

    const slug = slugifyAddress(e.street_address)
    const row = await getCmaAdminRowBySlug(slug)
    if (!row) return { data: null, error: 'No audit built yet. Build the audit first.' }
    if ((row.doc_type as string | null) !== 'expired-audit') {
      return { data: null, error: 'The document for this address is a plain CMA, not an expired audit. Rebuild it as an audit first.' }
    }

    // needs_review requires the explicit acknowledgment from the confirm dialog.
    const bs = (row.build_summary ?? {}) as Record<string, unknown>
    const needsReview = String(bs.needs_review ?? '') === 'true' || bs.needs_review === true
    if (needsReview && !opts.acknowledgeReview) {
      return { data: null, error: 'This audit is flagged for review. Open it, review the flags, then confirm the acknowledgment to send.' }
    }

    // Make sure the send rail has the owner email on the cmas row.
    const rowEmail = (row.client_email as string | null)?.trim()
    if (!rowEmail) {
      await updateCmaRowFieldsBySlug(slug, { client_email: e.contact_email.toLowerCase() })
    }

    // The admin click is the approval: finalize a draft, then send. The send
    // rail re-checks status, suppression, and renders the tracked PDF email.
    if (String(row.status ?? '') === 'draft') {
      const fin = await updateCmaRowFieldsBySlug(slug, { status: 'finalized', finalized_at: new Date().toISOString() })
      if (!fin.ok) return { data: null, error: fin.error ?? 'Approve failed' }
    }

    const sent = await sendCmaToLead(slug)
    if (!sent.ok) return { data: null, error: sent.error ?? 'Send failed' }
    revalidatePath('/admin/expireds')
    return { data: { transport: sent.transport ?? 'gmail' }, error: null }
  } catch (err) {
    console.error('[sendExpiredAuditEmailAction]', err)
    return { data: null, error: 'Send failed unexpectedly' }
  }
}
