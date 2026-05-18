import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getAdminRoleForEmail } from '@/app/actions/admin-roles'

/**
 * POST /api/admin/producer-change-requests
 *
 * Writes a row to public.producer_change_requests.
 * Requires an authenticated admin session.
 *
 * Body: { producer_slug, request_type, request_text, requester }
 */
export async function POST(request: NextRequest) {
  try {
    // Auth check
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const adminRole = await getAdminRoleForEmail(user.email)
    if (!adminRole) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json().catch(() => null)
    if (!body) {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const { producer_slug, request_type, request_text, requester } = body as {
      producer_slug?: string
      request_type?: string
      request_text?: string
      requester?: string
    }

    if (!producer_slug?.trim() || !request_text?.trim()) {
      return NextResponse.json(
        { error: 'producer_slug and request_text are required' },
        { status: 400 },
      )
    }

    const VALID_REQUEST_TYPES = [
      'edit_recipe',
      'add_example',
      'duplicate_with_changes',
      'deprecate',
      'other',
    ]
    const resolvedType =
      request_type && VALID_REQUEST_TYPES.includes(request_type) ? request_type : 'edit_recipe'

    const service = createServiceClient()
    const { data, error } = await service
      .from('producer_change_requests')
      .insert({
        producer_slug: producer_slug.trim(),
        request_type: resolvedType,
        request_text: request_text.trim(),
        requester: requester ?? 'matt',
        status: 'pending',
      })
      .select('id')
      .single()

    if (error) {
      console.error('[producer-change-requests] insert error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, id: data.id }, { status: 201 })
  } catch (err) {
    console.error('[producer-change-requests] unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
