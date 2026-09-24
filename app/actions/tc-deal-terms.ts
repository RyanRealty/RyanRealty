'use server'

import { revalidatePath } from 'next/cache'
import { checkAdminAction } from '@/lib/admin/require-admin'
import { acceptContractValue } from '@/lib/data/tc/deal-terms'
import { TERM_COLUMN_LABEL, type TermColumn } from '@/lib/tc/terms/plan'

/**
 * One click on the file: the executed agreement's value replaces the one on
 * file for this field (lib/data/tc/deal-terms.ts records who and from where).
 * The only way the deal terms reader's reading overwrites anything.
 */
export async function acceptContractTerm(input: { cycleId: string; column: string }): Promise<{ ok: boolean; error?: string }> {
  const gate = await checkAdminAction('transactions.edit')
  if (!gate.ok) return { ok: false, error: gate.error }
  if (!(input.column in TERM_COLUMN_LABEL)) return { ok: false, error: 'Unknown field.' }
  const res = await acceptContractValue(input.cycleId, input.column as TermColumn, { email: gate.ctx.email, role: gate.ctx.role, brokerSlug: gate.ctx.brokerSlug })
  if (res.ok && res.propertyKey) revalidatePath(`/admin/deals/${encodeURIComponent(res.propertyKey)}`)
  return res.ok ? { ok: true } : { ok: false, error: res.error }
}
