import 'server-only'
import { revalidatePath } from 'next/cache'

/**
 * revalidatePerson — invalidate every live surface that renders one person.
 *
 * P11B relocated the person workspace: `/admin/people/[id]` is the v2 page and
 * `/admin/people/[id]/tools` is the full legacy workspace. `/admin/crm/[id]` is
 * now a pure redirect bridge — a redirect has no cached payload, so it is
 * deliberately NOT revalidated here.
 *
 * One call site per mutation keeps the pair in sync; a later route change is a
 * one-line edit instead of a sweep across a dozen action files.
 */
export function revalidatePerson(personId: number | string | null | undefined): void {
  if (personId == null || personId === '') return
  revalidatePath(`/admin/people/${personId}`)
  revalidatePath(`/admin/people/${personId}/tools`)
}
