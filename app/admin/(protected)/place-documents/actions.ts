'use server'

/**
 * The two review verbs for the recorded-document queue (PLACE_CONTENT_RULES R7).
 *
 * A Next server action compiles to an independently-invocable POST, so the
 * capability is checked IN BODY here rather than left to the (protected)
 * layout. `content.communities` is superuser-only: approving a link puts a
 * recorded instrument in front of a buyer as their subdivision's governing
 * documents.
 *
 * EVERY export in this file is async. A synchronous export type-checks and
 * passes vitest, then fails `next build` — the whole module is a server-action
 * boundary, not an ordinary module.
 *
 * Both verbs end in a redirect carrying the outcome, because a form action
 * cannot hand a result back to a server component. The queue page reads it and
 * says what happened, including when the database refused the write.
 */

import { revalidateTag } from 'next/cache'
import { redirect } from 'next/navigation'
import { logAdminAction } from '@/app/actions/log-admin-action'
import { checkAdminAction } from '@/lib/admin/require-admin'
import { cacheTag } from '@/lib/data/cache/unstable-cache'
import {
  publishPlaceDocumentGroup,
  rejectPlaceDocumentGroup,
} from '@/lib/data/places/reviewPlaceDocumentLinks'

const QUEUE = '/admin/place-documents'

interface Outcome {
  ok: boolean
  note: string
}

/** Rebuild the queue URL with the outcome attached. */
function backTo(page: string, outcome: Outcome): string {
  const params = new URLSearchParams()
  if (page) params.set('page', page)
  params.set(outcome.ok ? 'done' : 'err', outcome.note)
  return `${QUEUE}?${params.toString()}`
}

/**
 * Run one verb and describe what happened. Returns rather than redirects, so
 * the redirect stays outside every try/catch — `redirect()` signals by throwing,
 * and a catch that swallowed it would silently strand the reviewer on the POST.
 */
async function runVerb(
  verb: 'approve' | 'reject',
  publishedName: string,
  reviewer: { email: string; role: string | null },
): Promise<Outcome> {
  const note = `${verb}d in the place-document review queue`
  try {
    const result =
      verb === 'approve'
        ? await publishPlaceDocumentGroup(publishedName, reviewer.email, note)
        : await rejectPlaceDocumentGroup(publishedName, reviewer.email, note)

    if (!result.ok) {
      // The publish trigger names the document and the reason in its own
      // message. It is surfaced rather than flattened to "something went
      // wrong": a refusal here is a data finding, and the reviewer is the one
      // who can act on it.
      console.error(`[place-documents] ${verb} "${publishedName}":`, result.error)
      return {
        ok: false,
        note:
          result.changed > 0
            ? `${result.changed} links changed, then the database refused the rest: ${result.error}`
            : result.error,
      }
    }

    revalidateTag(cacheTag.market, 'max')

    const logged = await logAdminAction({
      adminEmail: reviewer.email,
      role: reviewer.role,
      actionType:
        verb === 'approve' ? 'place_document_group_publish' : 'place_document_group_reject',
      resourceType: 'place_document_link',
      resourceId: publishedName,
      details: { publishedName, changed: result.changed, skipped: result.skipped },
    })
    if (!logged.ok) console.error('[place-documents] audit log failed:', logged.error)

    const stayed =
      verb === 'approve' && result.skipped > 0
        ? ` ${result.skipped} document${result.skipped === 1 ? '' : 's'} stayed pending — not governing instruments.`
        : ''
    return {
      ok: true,
      note: `${publishedName}: ${result.changed} link${result.changed === 1 ? '' : 's'} ${
        verb === 'approve' ? 'published' : 'rejected'
      }.${stayed}`,
    }
  } catch (err) {
    console.error(`[place-documents] ${verb} "${publishedName}" threw:`, err)
    return { ok: false, note: `The ${verb} did not run, and nothing changed.` }
  }
}

async function reviewGroup(formData: FormData, verb: 'approve' | 'reject'): Promise<never> {
  const page = String(formData.get('page') ?? '').trim()
  const publishedName = String(formData.get('publishedName') ?? '').trim()

  const auth = await checkAdminAction('content.communities')
  if (!auth.ok) redirect(backTo(page, { ok: false, note: auth.error }))
  if (!publishedName) redirect(backTo(page, { ok: false, note: 'No group was named.' }))

  const outcome = await runVerb(verb, publishedName, {
    email: auth.ctx.email,
    role: auth.ctx.role,
  })
  redirect(backTo(page, outcome))
}

/** Publish every pending link in the group whose document may legally publish. */
export async function approvePlaceDocumentGroupAction(formData: FormData): Promise<void> {
  await reviewGroup(formData, 'approve')
}

/** Reject every pending link in the group, governing or not. */
export async function rejectPlaceDocumentGroupAction(formData: FormData): Promise<void> {
  await reviewGroup(formData, 'reject')
}
