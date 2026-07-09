/**
 * Admin-only proxy for STORED outbound CRM attachments (crm-files bucket:
 * email/person-<id>/* + mms/person-<id>/*). The thread renders sent files
 * forever from the storage paths recorded on the crm_timeline payload — the
 * short-lived signed URLs used at send time expire in minutes.
 *
 * Session + role gated, ownership-scoped like the MMS/recording proxies: a
 * per-broker role only fetches attachments on contacts in their scope.
 */

import { NextResponse } from 'next/server'
import { getCrmAccess } from '@/app/actions/crm'
import { parseAttachmentPath } from '@/lib/crm/attachment-limits'
import { signAttachmentReadUrl } from '@/lib/crm/attachments'
import { isPersonInScope } from '@/lib/crm/scope'
import { createServiceClient } from '@/lib/supabase/service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const access = await getCrmAccess()
  if (!access) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const path = new URL(request.url).searchParams.get('path') ?? ''
  const parsed = parseAttachmentPath(path)
  if (!parsed) return NextResponse.json({ error: 'bad path' }, { status: 400 })

  // Fail closed: superusers see all; any other role only contacts in scope
  // (isPersonInScope — same rule as requirePersonInScope on the send actions);
  // a non-superuser with no broker identity is denied outright.
  if (access.role !== 'superuser') {
    if (!access.brokerSlug) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    const sb = createServiceClient()
    const { data } = await sb
      .from('crm_people')
      .select('assigned_broker')
      .eq('id', parsed.personId)
      .maybeSingle()
    if (!data || !isPersonInScope(access.brokerSlug, (data.assigned_broker as string | null) ?? null)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  const signedUrl = await signAttachmentReadUrl(path)
  if (!signedUrl) return NextResponse.json({ error: 'attachment not found' }, { status: 404 })

  // Stream through (rather than redirect) so the browser caches under our URL
  // and the signed URL never lands in the client's address bar / history.
  const res = await fetch(signedUrl)
  if (!res.ok) return NextResponse.json({ error: 'attachment not found' }, { status: 404 })
  return new NextResponse(res.body, {
    status: 200,
    headers: {
      'Content-Type': res.headers.get('content-type') ?? 'application/octet-stream',
      'Cache-Control': 'private, max-age=3600',
    },
  })
}
