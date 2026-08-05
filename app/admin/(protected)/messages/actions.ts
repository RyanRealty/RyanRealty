'use server'

/**
 * Messages (P9 roll:messages) — send wrapper so the composer revalidates THIS
 * surface. The underlying action is the ONE governed SMS path (auth, scope,
 * suppression, quiet-hours override semantics all live there).
 */
import { revalidatePath } from 'next/cache'
import { sendCrmSmsAction } from '@/app/actions/crm'

export async function sendMessagesSms(formData: FormData): Promise<void> {
  await sendCrmSmsAction(formData)
  revalidatePath('/admin/messages')
}
