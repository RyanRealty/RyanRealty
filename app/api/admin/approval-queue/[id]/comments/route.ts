import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getAdminRoleForEmail } from '@/app/actions/admin-roles'

/**
 * POST /api/admin/approval-queue/[id]/comments
 *
 * Appends a comment to the marketing_brain_actions.comments JSONB array.
 * If type is 'change_request', also flips status to 'needs_changes'.
 *
 * Body: { body: string, type: 'change_request' | 'note' | 'approval_note' }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    // Auth
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const adminRole = await getAdminRoleForEmail(user.email)
    if (!adminRole) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { id } = await params
    const body = await request.json().catch(() => null)
    if (!body?.body?.trim()) {
      return NextResponse.json({ error: 'body is required' }, { status: 400 })
    }

    const VALID_TYPES = ['change_request', 'note', 'approval_note']
    const commentType = VALID_TYPES.includes(body.type) ? body.type : 'note'

    const service = createServiceClient()

    // Fetch existing comments
    const { data: existing, error: fetchErr } = await service
      .from('marketing_brain_actions')
      .select('comments, status')
      .eq('id', id)
      .single()
    if (fetchErr) {
      return NextResponse.json({ error: fetchErr.message }, { status: 500 })
    }

    const existingComments = (Array.isArray(existing?.comments) ? existing.comments : []) as unknown[]
    const newComment = {
      id: crypto.randomUUID(),
      author: user.email,
      body: body.body.trim(),
      posted_at: new Date().toISOString(),
      type: commentType,
    }
    const updated = [...existingComments, newComment]

    const updatePayload: Record<string, unknown> = { comments: updated }
    if (commentType === 'change_request') {
      updatePayload['status'] = 'needs_changes'
      updatePayload['needs_changes_at'] = new Date().toISOString()
    }

    const { error: updateErr } = await service
      .from('marketing_brain_actions')
      .update(updatePayload)
      .eq('id', id)
    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, comments: updated })
  } catch (err) {
    console.error('[approval-queue/comments] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
