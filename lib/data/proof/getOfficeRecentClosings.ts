/**
 * The office's own recent closings, one row per home, for the /sell strip.
 *
 * Same read shape as getProofBlock's closings (list side, Ryan Realty office,
 * StandardStatus Closed, ClosePrice present), so the strip and the proof block
 * cannot disagree about which homes the office closed. The CloseDate bound goes
 * FIRST: without it the office ILIKE scans the whole listings table (see the
 * header of getProofBlock.ts, 23.5s against 109ms).
 *
 * Shaping (what prints, and what never prints) lives in ./office-closings.
 */
import 'server-only'
import { createServiceClient } from '@/lib/data/client'
import { makeResilientCached } from '@/lib/data/cache/resilient'
import { proofWindow } from '@/lib/data/proof/getProofBlock'
import {
  OFFICE_CLOSINGS_LIMIT,
  OFFICE_CLOSINGS_WINDOW_MONTHS,
  shapeOfficeClosings,
  type OfficeClosing,
} from '@/lib/data/proof/office-closings'

export type OfficeRecentClosings = {
  rows: OfficeClosing[]
  /** CloseDate window, ISO days, inclusive. */
  window: { start: string; end: string }
  /** Section 0 trace for the strip. */
  trace: string
  fetchedAt: string
}

const COLUMNS =
  'ListNumber, City, property_sub_type, BedroomsTotal, ListPrice, ClosePrice, OnMarketDate, purchase_contract_date, CloseDate'

function num(v: unknown): number | null {
  if (v == null) return null
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

function str(v: unknown): string | null {
  return typeof v === 'string' && v.trim().length > 0 ? v.trim() : null
}

export function officeClosingsTrace(window: { start: string; end: string }): string {
  return (
    `Oregon Data Share MLS, listings table: "ListOfficeName" ILIKE '%ryan realty%' AND "StandardStatus" = 'Closed' ` +
    `AND "ClosePrice" IS NOT NULL, CloseDate ${window.start} to ${window.end}, list side only, newest first, up to ${OFFICE_CLOSINGS_LIMIT}. ` +
    'Days to contract = purchase_contract_date minus OnMarketDate, kept when zero or more. ' +
    'Sale to list = ClosePrice / ListPrice (final list price).'
  )
}

const EMPTY: OfficeRecentClosings = {
  rows: [],
  window: { start: '', end: '' },
  trace: '',
  fetchedAt: '',
}

async function fetchOfficeRecentClosings(): Promise<OfficeRecentClosings> {
  const now = new Date()
  const window = proofWindow(now, OFFICE_CLOSINGS_WINDOW_MONTHS)
  const sb = createServiceClient()
  const res = await sb
    .from('listings')
    .select(COLUMNS)
    .gte('CloseDate', `${window.start}T00:00:00Z`)
    .ilike('ListOfficeName', '%ryan realty%')
    .eq('StandardStatus', 'Closed')
    .not('ClosePrice', 'is', null)
    .order('CloseDate', { ascending: false })
    .limit(OFFICE_CLOSINGS_LIMIT * 4)
  // Throw so the resilient cache never stores an empty strip off a blip.
  if (res.error) {
    throw new Error(`[getOfficeRecentClosings] ${res.error.message ?? JSON.stringify(res.error)}`)
  }
  const raw = (res.data ?? []) as Array<Record<string, unknown>>
  const rows = shapeOfficeClosings(
    raw.map((r) => ({
      listNumber: str(r['ListNumber']),
      city: str(r['City']),
      propertySubType: str(r['property_sub_type']),
      bedrooms: num(r['BedroomsTotal']),
      listPrice: num(r['ListPrice']),
      closePrice: num(r['ClosePrice']),
      onMarketDate: str(r['OnMarketDate']),
      contractDate: str(r['purchase_contract_date']),
      closeDate: str(r['CloseDate']),
    })),
  )
  return { rows, window, trace: officeClosingsTrace(window), fetchedAt: now.toISOString() }
}

const cached = makeResilientCached(
  fetchOfficeRecentClosings,
  ['office-recent-closings-v1'],
  { revalidate: 6 * 60 * 60, tags: ['listings'] },
  EMPTY,
)

export async function getOfficeRecentClosings(): Promise<OfficeRecentClosings> {
  return cached()
}
