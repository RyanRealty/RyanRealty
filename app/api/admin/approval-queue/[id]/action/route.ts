import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getAdminRoleForEmail } from '@/app/actions/admin-roles'

type ActionBody =
  | { action: 'approve_now' }
  | { action: 'approve_schedule'; scheduled_for: string }
  | { action: 'request_changes'; change_body: string }
  | { action: 'reject'; killed_reason: string }
  | { action: 'duplicate'; mode: 'same_producer' | 'new_producer'; producer_slug: string; notes: string }

/**
 * POST /api/admin/approval-queue/[id]/action
 *
 * Accepts one of five action verbs and mutates the marketing_brain_actions row.
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
    const body = (await request.json().catch(() => null)) as ActionBody | null
    if (!body?.action) return NextResponse.json({ error: 'action is required' }, { status: 400 })

    const service = createServiceClient()

    switch (body.action) {
      case 'approve_now': {
        const { error } = await service
          .from('marketing_brain_actions')
          .update({
            status: 'approved',
            approved_at: new Date().toISOString(),
            approved_by: 'matt',
          })
          .eq('id', id)
        if (error) throw error
        return NextResponse.json({ ok: true, status: 'approved' })
      }

      case 'approve_schedule': {
        if (!body.scheduled_for) {
          return NextResponse.json({ error: 'scheduled_for is required' }, { status: 400 })
        }
        const { error } = await service
          .from('marketing_brain_actions')
          .update({
            status: 'approved',
            approved_at: new Date().toISOString(),
            approved_by: 'matt',
            scheduled_for: new Date(body.scheduled_for).toISOString(),
          })
          .eq('id', id)
        if (error) throw error
        return NextResponse.json({ ok: true, status: 'approved' })
      }

      case 'request_changes': {
        if (!body.change_body?.trim()) {
          return NextResponse.json({ error: 'change_body is required' }, { status: 400 })
        }
        // Append to comments JSONB and flip status
        const { data: existing, error: fetchErr } = await service
          .from('marketing_brain_actions')
          .select('comments')
          .eq('id', id)
          .single()
        if (fetchErr) throw fetchErr

        const existingComments = (Array.isArray(existing?.comments) ? existing.comments : []) as unknown[]
        const newComment = {
          id: crypto.randomUUID(),
          author: 'matt',
          body: body.change_body.trim(),
          posted_at: new Date().toISOString(),
          type: 'change_request',
        }
        const updated = [...existingComments, newComment]

        const { error } = await service
          .from('marketing_brain_actions')
          .update({
            status: 'needs_changes',
            needs_changes_at: new Date().toISOString(),
            comments: updated,
          })
          .eq('id', id)
        if (error) throw error
        return NextResponse.json({ ok: true, status: 'needs_changes', comments: updated })
      }

      case 'reject': {
        if (!body.killed_reason?.trim()) {
          return NextResponse.json({ error: 'killed_reason is required' }, { status: 400 })
        }
        const { error } = await service
          .from('marketing_brain_actions')
          .update({
            status: 'killed',
            killed_reason: body.killed_reason.trim(),
          })
          .eq('id', id)
        if (error) throw error
        return NextResponse.json({ ok: true, status: 'killed' })
      }

      case 'duplicate': {
        if (body.mode === 'new_producer') {
          // Create a producer_change_requests row of type duplicate_with_changes
          const { data: original, error: fetchErr } = await service
            .from('marketing_brain_actions')
            .select('action_type, assigned_producer, payload')
            .eq('id', id)
            .single()
          if (fetchErr) throw fetchErr

          const slug =
            original?.assigned_producer?.split('/').at(-2) ??
            original?.assigned_producer ??
            body.producer_slug

          const { error } = await service.from('producer_change_requests').insert({
            producer_slug: slug,
            request_type: 'duplicate_with_changes',
            request_text: body.notes?.trim() ?? 'Duplicate with changes requested from approval queue.',
            requester: 'matt',
            status: 'pending',
          })
          if (error) throw error
          return NextResponse.json({ ok: true, mode: 'new_producer' })
        } else {
          // Same producer: create a new pending action row cloned from original
          const { data: original, error: fetchErr } = await service
            .from('marketing_brain_actions')
            .select('action_type, target, assigned_producer, payload, generation_reason')
            .eq('id', id)
            .single()
          if (fetchErr) throw fetchErr

          const { error } = await service.from('marketing_brain_actions').insert({
            action_type: original?.action_type,
            target: original?.target,
            assigned_producer: original?.assigned_producer,
            payload: {
              ...(original?.payload ?? {}),
              duplicate_notes: body.notes?.trim() ?? '',
              duplicated_from: id,
            },
            generation_reason: `Duplicated from ${id}. Notes: ${body.notes?.trim() ?? '(none)'}`,
            status: 'pending',
          })
          if (error) throw error
          return NextResponse.json({ ok: true, mode: 'same_producer' })
        }
      }

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    }
  } catch (err) {
    console.error('[approval-queue/action] error:', err)
    const msg = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
