'use server'

import { revalidatePath } from 'next/cache'
import { checkAdminAction } from '@/lib/admin/require-admin'
import { acceptContractValue, confirmTermReading, keepFileValue } from '@/lib/data/tc/deal-terms'
import { TERMS_REVIEW_PATH } from '@/lib/tc/terms/review'
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

/**
 * Matt settles a term a person typed that the executed contract disagrees
 * with (Matt 2026-09-24: "Contract wins, unless a person typed it"): use the
 * contract's value, or keep the file's. Principal broker only.
 */
export async function settleTermConflict(input: { cycleId: string; column: string; choice: 'contract' | 'file' }): Promise<{ ok: boolean; error?: string }> {
  const gate = await checkAdminAction('transactions.signoff')
  if (!gate.ok) return { ok: false, error: gate.error }
  if (!(input.column in TERM_COLUMN_LABEL)) return { ok: false, error: 'Unknown field.' }
  const column = input.column as TermColumn
  const res =
    input.choice === 'contract'
      ? await acceptContractValue(input.cycleId, column, { email: gate.ctx.email, role: gate.ctx.role, brokerSlug: gate.ctx.brokerSlug })
      : input.choice === 'file'
        ? await keepFileValue(input.cycleId, column, { email: gate.ctx.email })
        : { ok: false as const, error: 'Choose the contract or the file.' }
  if (res.ok && res.propertyKey) revalidatePath(`/admin/deals/${encodeURIComponent(res.propertyKey)}`)
  revalidatePath(TERMS_REVIEW_PATH)
  return res.ok ? { ok: true } : { ok: false, error: res.error }
}

/**
 * Matt picks the right reading of a term the readers split on, from the page
 * beside it. The file's terms are written again from it. Principal broker only.
 */
export async function settleTermReading(input: { documentId: string; instrument: number; field: string; value: unknown }): Promise<{ ok: boolean; error?: string }> {
  const gate = await checkAdminAction('transactions.signoff')
  if (!gate.ok) return { ok: false, error: gate.error }
  const res = await confirmTermReading({ ...input, by: gate.ctx.email })
  if (res.ok && res.propertyKey) revalidatePath(`/admin/deals/${encodeURIComponent(res.propertyKey)}`)
  revalidatePath(TERMS_REVIEW_PATH)
  return res.ok ? { ok: true } : { ok: false, error: res.error }
}
