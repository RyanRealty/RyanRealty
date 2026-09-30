'use server'

/**
 * The CRM market-report card's actions (Matt's decisions 2026-09-29): save
 * the subscription (on/off, interval, areas, and a consent note when the
 * contact had stopped the reports herself), send a preview to the acting
 * broker's own inbox, and approve the first send.
 *
 * Every action is session- AND ownership-checked (requireCrmAccess +
 * requirePersonInScope: a scoped broker only touches their own contacts), a
 * report viewer cannot change anything, and every change lands with a
 * crm_timeline row naming the admin (lib/crm/market-report-admin.ts plans it,
 * lib/data writes it). Each action returns to the page it was posted from
 * with a flash or an error.
 */
import { redirect } from 'next/navigation'
import { requireCrmAccess, requirePersonInScope } from '@/app/actions/crm'
import { revalidatePerson } from '@/lib/crm/revalidate-person'
import {
  adminApproveFirstSend,
  adminSendReportPreview,
  adminUpdateReportSubscription,
  type AdminResult,
} from '@/lib/crm/market-report-admin'
import { normalizeReportFrequency } from '@/lib/data/crm/getContactReportSubscriptions'

type Admin = { email: string; brokerSlug: string | null }

async function guard(personId: number): Promise<{ ok: true; pid: number; admin: Admin } | { ok: false; error: string }> {
  const access = await requireCrmAccess()
  if (!access.ok) return access
  if (access.access.role === 'report_viewer') return { ok: false, error: 'Your role can read the CRM but not change it.' }
  const pid = Number(personId)
  if (!Number.isInteger(pid) || pid <= 0) return { ok: false, error: 'Bad person id' }
  const scoped = await requirePersonInScope(pid, access.access)
  if (!scoped.ok) return scoped
  return { ok: true, pid, admin: { email: access.access.email, brokerSlug: access.access.brokerSlug } }
}

/** Only the two pages that mount the card; anything else returns to the person page. */
function returnPath(personId: number, raw: string): string {
  const base = `/admin/people/${personId}`
  return raw === `${base}/tools` ? `${base}/tools` : base
}

function finish(personId: number, returnTo: string, r: AdminResult | { ok: false; error: string }): never {
  const to = returnPath(personId, returnTo)
  if (r.ok) {
    revalidatePerson(personId)
    redirect(`${to}?flash=${encodeURIComponent(r.message)}#market-report`)
  }
  redirect(`${to}?error=${encodeURIComponent(`Market report: ${r.error}`)}#market-report`)
}

/** Save on/off, interval and areas (creating the row on a first setup). */
export async function saveMarketReportForm(personId: number, returnTo: string, formData: FormData): Promise<void> {
  const g = await guard(personId)
  if (!g.ok) finish(Number(personId) || 0, returnTo, g)
  const active = String(formData.get('active') ?? '') === 'on'
  const frequency = normalizeReportFrequency(String(formData.get('frequency') ?? 'monthly'))
  const areas = formData.getAll('areas').map((a) => String(a))
  const consentNote = String(formData.get('consentNote') ?? '').trim() || null
  const r = await adminUpdateReportSubscription({
    personId: g.pid,
    admin: g.admin,
    areas,
    frequency,
    active,
    consentNote,
    createIfMissing: true,
  })
  finish(g.pid, returnTo, r)
}

/** "Send a preview to me": the contact's exact report, to the acting broker's own inbox. */
export async function previewMarketReportForm(personId: number, returnTo: string): Promise<void> {
  const g = await guard(personId)
  if (!g.ok) finish(Number(personId) || 0, returnTo, g)
  const r = await adminSendReportPreview({ personId: g.pid, admin: g.admin })
  finish(g.pid, returnTo, r)
}

/** "Approve first send": only after a preview of the current areas and interval. */
export async function approveMarketReportForm(personId: number, returnTo: string): Promise<void> {
  const g = await guard(personId)
  if (!g.ok) finish(Number(personId) || 0, returnTo, g)
  const r = await adminApproveFirstSend({ personId: g.pid, admin: g.admin })
  finish(g.pid, returnTo, r)
}
