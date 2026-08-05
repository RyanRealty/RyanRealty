'use server'

/**
 * Today (P9 roll:today) — thin wrappers over the existing CRM actions so every
 * mutation made from /admin/today revalidates THIS surface. The underlying
 * actions keep their own auth (requireCrmAccess/scope) — nothing is re-implemented.
 */
import { revalidatePath } from 'next/cache'
import {
  confirmNextStepAction,
  skipNextStepAction,
  dismissTriageItemAction,
  completeCrmTaskAction,
} from '@/app/actions/crm'

export async function confirmParkedStepToday(formData: FormData): Promise<void> {
  const id = Number(formData.get('enrollmentId'))
  await confirmNextStepAction(id)
  revalidatePath('/admin/today')
}

export async function skipParkedStepToday(formData: FormData): Promise<void> {
  const id = Number(formData.get('enrollmentId'))
  await skipNextStepAction(id)
  revalidatePath('/admin/today')
}

export async function dismissTriageToday(formData: FormData): Promise<void> {
  await dismissTriageItemAction({
    personId: Number(formData.get('personId')),
    kind: String(formData.get('kind') ?? ''),
    taskId: formData.get('taskId') ? Number(formData.get('taskId')) : null,
  })
  revalidatePath('/admin/today')
}

export async function completeTaskToday(formData: FormData): Promise<void> {
  await completeCrmTaskAction(formData)
  revalidatePath('/admin/today')
}
