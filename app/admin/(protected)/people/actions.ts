'use server'

/**
 * People (P9 roll:people) — CMA kickoff wrapper for the v2 entity page. The
 * underlying action is the litmus-proven idempotent kickoff core (auth + scope
 * + attach-to-open-build + no-clobber all live there). On success we land back
 * on the person with the confirmation state in the URL.
 */
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { kickoffCmaForContactAction } from '@/app/actions/crm-cma-kickoff'

export async function kickoffCmaFromPerson(formData: FormData): Promise<void> {
  const personId = Number(formData.get('personId'))
  const address = String(formData.get('address') ?? '').trim()
  const idempotencyKey = String(formData.get('idempotencyKey') ?? '')
  const res = await kickoffCmaForContactAction({ personId, address, idempotencyKey })
  revalidatePath(`/admin/people/${personId}`)
  if (res.ok) redirect(`/admin/people/${personId}?kicked=1`)
  redirect(`/admin/people/${personId}?intent=cma&err=${encodeURIComponent(res.error ?? 'Kickoff failed')}`)
}
