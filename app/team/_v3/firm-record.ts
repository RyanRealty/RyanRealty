/**
 * The firm's closing record across every broker, counted once per sale.
 *
 * WHY THIS EXISTS (about upgrade, 2026-10-08). /about printed 25 closings and
 * /team printed 26. Both were "true": /about counted the Central Oregon rail
 * (977 zips only) and /team added each broker's own closings together without
 * de-duplicating, so a sale shared by two of our brokers would have counted
 * twice. Answer engines read both pages, so the firm has ONE headline count,
 * built here and used by both pages:
 *
 *   every closed sale on the regional MLS (Oregon Data Share) where a Ryan
 *   Realty broker was the listing broker or the buyer's broker, with a recorded
 *   sold price and a close date, counted once per ListingKey, wherever the home
 *   stands.
 *
 * "In Central Oregon" is the subset with a 977 postal code, the same test the
 * closings rail uses (app/team/[slug]/_v3/sale-rows.ts inServiceArea).
 *
 * The trailing twelve months use the roster's window (ROSTER_WINDOW_DAYS, the
 * cutoff the /team cards print), so the firm's "last 12 months" equals the sum
 * of the brokers' cards whenever no sale is shared.
 *
 * Pure: every figure comes off the rows passed in (CLAUDE.md section 0).
 */
import type { BrokerSaleTile } from '@/lib/data/brokers/getBrokerSales'
import { classifyType } from '@/app/_v3/home-field-items'
import { displaySubdivision } from '@/lib/slug'
import { ROSTER_WINDOW_DAYS } from './broker-roster-record'

export type FirmRecordBroker = {
  slug: string
  /** The display name the page prints for this broker. */
  name: string
  sales: readonly BrokerSaleTile[]
}

export type FirmRecordSale = {
  key: string
  /** Close date as a calendar day, YYYY-MM-DD. */
  day: string
  price: number
  city: string
  subdivision: string | null
  centralOregon: boolean
  /** Atlas type key: house, condo, townhouse, manufactured, land, multi, commercial. */
  type: string
}

export type FirmTally = { name: string; n: number }

export type FirmAllAreaRecord = {
  /** Unique closings, every area. */
  count: number
  /** Oldest and newest close date, YYYY-MM-DD. */
  firstClose: string | null
  lastClose: string | null
  /** Unique closings with a 977 postal code. */
  centralOregon: number
  /** Per broker, in the order passed: their own unique closings and the trailing-window count. */
  brokers: Array<{ slug: string; name: string; count: number; recent: number }>
  /** Trailing window, firm-wide, counted once per sale. */
  recent: { count: number; cutoff: string; cities: FirmTally[] }
  /** Central Oregon closings by MLS city, most first. */
  cities: FirmTally[]
  /** Closings outside Central Oregon (no 977 postal code). */
  outside: number
  /** Closings by atlas type key, most first. */
  types: FirmTally[]
  lowest: FirmRecordSale | null
  highest: FirmRecordSale | null
}

function dayKey(iso: string | null | undefined): string {
  return String(iso ?? '').slice(0, 10)
}

function isClosed(s: BrokerSaleTile): boolean {
  return !!s.CloseDate && s.ClosePrice != null && Number(s.ClosePrice) > 0 && !!(s.ListingKey ?? '').trim()
}

function tally(values: readonly string[]): FirmTally[] {
  const counts = new Map<string, number>()
  for (const raw of values) {
    const name = raw.trim()
    if (!name) continue
    counts.set(name, (counts.get(name) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([name, n]) => ({ name, n }))
    .sort((a, b) => b.n - a.n || a.name.localeCompare(b.name))
}

function toSale(s: BrokerSaleTile): FirmRecordSale {
  const { typeKey } = classifyType({ propertyType: s.PropertyType ?? null, propertySubType: s.property_sub_type ?? null })
  return {
    key: (s.ListingKey ?? '').trim(),
    day: dayKey(s.CloseDate),
    price: Number(s.ClosePrice),
    city: (s.City ?? '').trim(),
    subdivision: displaySubdivision(s.SubdivisionName),
    centralOregon: (s.PostalCode ?? '').trim().startsWith('977'),
    type: typeKey,
  }
}

/** The trailing-window cutoff the /team roster cards use, as YYYY-MM-DD. */
export function firmRecentCutoff(now: Date): string {
  return dayKey(new Date(now.getTime() - ROSTER_WINDOW_DAYS * 86_400_000).toISOString())
}

export function firmAllAreaRecord(brokers: readonly FirmRecordBroker[], now: Date = new Date()): FirmAllAreaRecord {
  const cutoff = firmRecentCutoff(now)
  const byKey = new Map<string, FirmRecordSale>()
  const perBroker = brokers.map((broker) => {
    const own = new Map<string, FirmRecordSale>()
    for (const tile of broker.sales) {
      if (!isClosed(tile)) continue
      const sale = toSale(tile)
      if (!own.has(sale.key)) own.set(sale.key, sale)
      if (!byKey.has(sale.key)) byKey.set(sale.key, sale)
    }
    const mine = [...own.values()]
    return {
      slug: broker.slug,
      name: broker.name,
      count: mine.length,
      recent: mine.filter((s) => s.day >= cutoff).length,
    }
  })

  const sales = [...byKey.values()].sort((a, b) => a.day.localeCompare(b.day))
  const dated = sales.filter((s) => /^\d{4}-\d{2}-\d{2}$/.test(s.day))
  const recent = sales.filter((s) => s.day >= cutoff)
  const central = sales.filter((s) => s.centralOregon)
  const byPrice = [...sales].sort((a, b) => a.price - b.price)

  return {
    count: sales.length,
    firstClose: dated[0]?.day ?? null,
    lastClose: dated[dated.length - 1]?.day ?? null,
    centralOregon: central.length,
    brokers: perBroker,
    recent: { count: recent.length, cutoff, cities: tally(recent.map((s) => s.city)) },
    cities: tally(central.map((s) => s.city)),
    outside: sales.length - central.length,
    types: tally(sales.map((s) => s.type)),
    lowest: byPrice[0] ?? null,
    highest: byPrice[byPrice.length - 1] ?? null,
  }
}
