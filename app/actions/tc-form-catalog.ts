'use server'

import { revalidatePath } from 'next/cache'
import { checkAdminAction } from '@/lib/admin/require-admin'
import { applyFormCatalogSnapshots, getTcFormLibraryBoard } from '@/lib/data/tc/form-catalog'
import type { CatalogApplyResult, TcFormLibraryBoard } from '@/lib/data/tc/form-catalog'

export type { CatalogApplyResult, TcFormLibraryBoard }

export async function loadFormLibraryBoard(search?: string): Promise<TcFormLibraryBoard[]> {
  const gate = await checkAdminAction('transactions.edit')
  if (!gate.ok) return []
  try {
    return await getTcFormLibraryBoard(search)
  } catch (err) {
    console.error('[loadFormLibraryBoard]', err)
    return []
  }
}

export async function applyFormCatalogJson(
  jsonText: string,
): Promise<{ data: CatalogApplyResult | null; error: string | null }> {
  const gate = await checkAdminAction('transactions.edit')
  if (!gate.ok) return { data: null, error: gate.error }

  let raw: unknown
  try {
    raw = JSON.parse(jsonText)
  } catch {
    return { data: null, error: 'That is not valid JSON. Run the check script and paste its output.' }
  }

  try {
    const result = await applyFormCatalogSnapshots(raw, gate.ctx.email)
    if (result.error || !result.data) return { data: null, error: result.error ?? 'Could not apply the catalog.' }
    revalidatePath('/admin/forms')
    return { data: result.data, error: null }
  } catch (err) {
    console.error('[applyFormCatalogJson]', err)
    return { data: null, error: 'Could not apply the catalog. If this is the first run, the catalog tables may not be migrated yet.' }
  }
}
