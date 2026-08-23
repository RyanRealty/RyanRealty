'use server'

import { revalidatePath } from 'next/cache'
import { getCrmAccess, requirePersonInScope } from '@/app/actions/crm'
import { scopeBroker } from '@/lib/crm/scope'
import { checkAdminAction } from '@/lib/admin/require-admin'
import { searchPeopleByName } from '@/lib/data/crm/searchPeople'
import { ensureNativeLead } from '@/lib/data/crm/ensureNativeLead'
import {
  addPersonToDeal,
  createDealWithPeople,
  linkUniqueCycleParties,
  removePersonFromDeal,
} from '@/lib/data/tc/deal-people'
import { isDealPersonRole, type DealPersonRole } from '@/lib/tc/deal-people'
import { fileNameFromBrokerSlug } from '@/lib/tc/deal-scope'
import { fileShapeForRepresentation, type FileRepresentation } from '@/lib/tc/listing-actions'

function revalidateDeal(propertyKey: string, personIds: number[]) {
  revalidatePath('/admin/closings')
  revalidatePath(`/admin/deals/${propertyKey}`)
  for (const id of personIds) revalidatePath(`/admin/people/${id}`)
}

export async function createDealFromPersonAction(formData: FormData): Promise<{
  error: string | null
  propertyKey?: string
}> {
  const auth = await checkAdminAction('transactions.edit')
  if (!auth.ok) return { error: auth.error }
  const access = await getCrmAccess()
  if (!access) return { error: 'Admin sign-in required.' }

  const personId = Number(formData.get('personId'))
  const address = String(formData.get('address') ?? '').trim()
  const roleRaw = String(formData.get('role') ?? '')
  if (!personId || !address) return { error: 'Person and address are required.' }
  if (!isDealPersonRole(roleRaw)) return { error: 'Pick buyer or seller.' }
  const scoped = await requirePersonInScope(personId, access)
  if (!scoped.ok) return scoped

  const parties: Array<{ personId: number; role: DealPersonRole }> = [
    { personId, role: roleRaw },
  ]
  for (const raw of formData.getAll('also')) {
    const [idStr, alsoRole] = String(raw).split(':')
    const alsoId = Number(idStr)
    if (!alsoId || !isDealPersonRole(alsoRole ?? '')) continue
    const alsoScoped = await requirePersonInScope(alsoId, access)
    if (!alsoScoped.ok) continue
    parties.push({ personId: alsoId, role: alsoRole as DealPersonRole })
  }

  const created = await createDealWithPeople({
    address,
    brokerName: fileNameFromBrokerSlug(access.brokerSlug) ?? access.brokerSlug,
    parties,
    actor: auth.ctx.email,
  })
  if (created.error || !created.data) return { error: created.error ?? 'Could not create the deal.' }
  revalidateDeal(created.data.propertyKey, parties.map((p) => p.personId))
  return { error: null, propertyKey: created.data.propertyKey }
}

function isFileRepresentation(v: string): v is FileRepresentation {
  return v === 'seller' || v === 'buyer'
}

/** Closings Write A Listing / new sale file. Does not write SkySlope. */
export async function createFileFromClosingsAction(formData: FormData): Promise<{
  error: string | null
  propertyKey?: string
}> {
  const auth = await checkAdminAction('transactions.edit')
  if (!auth.ok) return { error: auth.error }

  const address = String(formData.get('address') ?? '').trim()
  const clientName = String(formData.get('clientName') ?? '').trim()
  const clientEmail = String(formData.get('clientEmail') ?? '').trim().toLowerCase()
  const mlsNumber = String(formData.get('mlsNumber') ?? '').trim()
  const representationRaw = String(formData.get('representation') ?? 'seller')
  if (!isFileRepresentation(representationRaw)) return { error: 'Pick seller or buyer.' }
  if (!address) return { error: 'Address is required.' }
  if (!clientName) return { error: 'Client name is required.' }
  if (!clientEmail.includes('@')) return { error: 'Client email is required so mail can file onto this file.' }

  const shape = fileShapeForRepresentation(representationRaw)
  const slug = auth.ctx.brokerSlug
  const brokerName = fileNameFromBrokerSlug(slug) ?? 'Matt Ryan'
  const native = await ensureNativeLead({
    name: clientName,
    email: clientEmail,
    source: 'vault-file',
    assignedBroker: slug ?? 'matt',
    tags: ['source:vault-file'],
  })
  if (!native.personId) return { error: 'Could not create or find that client. Use a unique email.' }

  const created = await createDealWithPeople({
    address,
    brokerName,
    parties: [{ personId: native.personId, role: shape.partyRole }],
    actor: auth.ctx.email,
    representation: representationRaw,
    mlsNumber: mlsNumber || null,
  })
  if (created.error || !created.data) return { error: created.error ?? 'Could not create the file.' }
  revalidateDeal(created.data.propertyKey, [native.personId])
  return { error: null, propertyKey: created.data.propertyKey }
}

export async function linkUniqueCyclePartiesAction(formData: FormData): Promise<{
  error: string | null
  linked?: number
  skipped?: string[]
}> {
  const auth = await checkAdminAction('transactions.edit')
  if (!auth.ok) return { error: auth.error }
  const dealId = String(formData.get('dealId') ?? '').trim()
  const propertyKey = String(formData.get('propertyKey') ?? '').trim()
  if (!dealId || !propertyKey) return { error: 'Deal is required.' }
  const result = await linkUniqueCycleParties({ dealId, actor: auth.ctx.email })
  if (result.error) return { error: result.error }
  revalidateDeal(propertyKey, [])
  return { error: null, linked: result.linked, skipped: result.skipped }
}

export async function addPersonToDealAction(formData: FormData): Promise<{ error: string | null }> {
  const auth = await checkAdminAction('transactions.edit')
  if (!auth.ok) return { error: auth.error }
  const access = await getCrmAccess()
  if (!access) return { error: 'Admin sign-in required.' }

  const dealId = String(formData.get('dealId') ?? '').trim()
  const propertyKey = String(formData.get('propertyKey') ?? '').trim()
  const personId = Number(formData.get('personId'))
  const roleRaw = String(formData.get('role') ?? '')
  if (!dealId || !propertyKey || !personId) return { error: 'Deal and person are required.' }
  if (!isDealPersonRole(roleRaw)) return { error: 'Pick a role.' }
  const scoped = await requirePersonInScope(personId, access)
  if (!scoped.ok) return scoped

  const result = await addPersonToDeal({
    dealId,
    personId,
    role: roleRaw,
    actor: auth.ctx.email,
  })
  if (result.error) return result
  revalidateDeal(propertyKey, [personId])
  return { error: null }
}

export async function removePersonFromDealAction(formData: FormData): Promise<{ error: string | null }> {
  const auth = await checkAdminAction('transactions.edit')
  if (!auth.ok) return { error: auth.error }

  const dealId = String(formData.get('dealId') ?? '').trim()
  const propertyKey = String(formData.get('propertyKey') ?? '').trim()
  const linkId = String(formData.get('linkId') ?? '').trim()
  const personId = Number(formData.get('personId'))
  if (!dealId || !propertyKey || !linkId) return { error: 'Missing party.' }

  const result = await removePersonFromDeal({
    dealId,
    linkId,
    actor: auth.ctx.email,
  })
  if (result.error) return result
  revalidateDeal(propertyKey, Number.isFinite(personId) ? [personId] : [])
  return { error: null }
}

export async function searchPeopleForDealAction(query: string): Promise<{
  data: Array<{ id: number; name: string | null; email: string | null }>
  error: string | null
}> {
  const auth = await checkAdminAction('transactions.edit')
  if (!auth.ok) return { data: [], error: auth.error }
  const access = await getCrmAccess()
  const brokerScope = access ? scopeBroker(access) : null
  const data = await searchPeopleByName({ query, brokerScope })
  return { data, error: null }
}
