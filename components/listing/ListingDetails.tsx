'use client'

import { useState } from 'react'
import type { SparkListingResult } from '../../lib/spark'

type Props = { listing: SparkListingResult; /** When false, description is shown elsewhere. */ showRemarks?: boolean }

/** Group MLS fields for accordion sections per listing page audit (Interior, Exterior, Community, Utilities, HOA, Legal). */
const FIELD_GROUPS: { title: string; keys: string[] }[] = [
  { title: 'Interior', keys: ['BedroomsTotal', 'BedsTotal', 'BathroomsTotal', 'BathsTotal', 'BuildingAreaTotal', 'LivingArea', 'RoomsTotal', 'BedroomsPossible', 'FireplaceFeatures', 'Appliances', 'Flooring', 'Cooling', 'Heating'] },
  { title: 'Exterior', keys: ['LotSizeAcres', 'LotSizeSquareFeet', 'GarageSpaces', 'Garage', 'AttachedGarageYN', 'ParkingFeatures', 'PropertySubType', 'View', 'WaterfrontFeatures'] },
  { title: 'Community', keys: ['SubdivisionName', 'Association', 'CommunityFeatures'] },
  { title: 'Utilities', keys: ['Utilities', 'Sewer', 'WaterSource', 'Electric', 'Gas'] },
  { title: 'HOA & fees', keys: ['AssociationFee', 'AssociationFeeFrequency', 'AssociationYN', 'RentalRestrictions'] },
  { title: 'Legal & tax', keys: ['TaxAnnualAmount', 'TaxYear', 'ParcelNumber', 'Zoning', 'YearBuilt', 'ModificationTimestamp'] },
]

type SparkStandardFields = Record<string, unknown>

/** Masked value from MLS (e.g. private phone/email). Treat as missing. */
function isMasked(s: string): boolean {
  return /^\*+$/.test(s) || s === '' || s.trim() === ''
}

/** True if the string looks like a URL; we don't show raw URLs in property details. */
function isUrl(s: string): boolean {
  return /^https?:\/\/\S+/i.test(s.trim())
}

/** Turn a value into a single display string; never return "[object Object]". Returns null for URLs so they aren't shown as raw text. */
function formatValue(v: unknown): string | null {
  if (v == null) return null
  if (typeof v === 'boolean') return v ? 'Yes' : 'No'
  if (typeof v === 'number' && Number.isFinite(v)) return v >= 1000 ? v.toLocaleString() : String(v)
  if (typeof v === 'string') {
    if (isMasked(v) || isUrl(v)) return null
    return v.trim() || null
  }
  if (Array.isArray(v)) {
    const parts = v
      .map((item) => {
        if (item == null) return null
        if (typeof item === 'string') return isMasked(item) || isUrl(item) ? null : item.trim()
        if (typeof item === 'number') return String(item)
        if (typeof item === 'object') return objectToDisplayString(item as Record<string, unknown>)
        return String(item)
      })
      .filter((s): s is string => s != null && s !== '' && !isUrl(s))
    return parts.length > 0 ? parts.join(', ') : null
  }
  if (typeof v === 'object' && v !== null) {
    return objectToDisplayString(v as Record<string, unknown>)
  }
  return String(v)
}

function objectToDisplayString(o: Record<string, unknown>): string | null {
  const desc = o.Description ?? o.Value ?? o['@value'] ?? o.value
  if (desc != null && typeof desc === 'string' && !isMasked(desc) && !isUrl(desc)) return desc.trim()
  const keys = Object.keys(o).filter((k) => !k.startsWith('@') && k !== 'Id' && k !== 'id' && k.toLowerCase() !== 'uri')
  if (keys.length === 1 && (typeof o[keys[0]] === 'string' || typeof o[keys[0]] === 'number')) {
    const val = String(o[keys[0]])
    return isMasked(val) || isUrl(val) ? null : val.trim()
  }
  const allStrings = keys.every((k) => typeof o[k] === 'string')
  if (allStrings && keys.length > 0) {
    const joined = keys.map((k) => o[k]).join(', ')
    return isMasked(joined) || isUrl(joined) ? null : joined
  }
  return null
}

function DetailsAccordion({ title, entries }: { title: string; entries: [string, string][] }) {
  const [open, setOpen] = useState(true)
  if (entries.length === 0) return null
  return (
    <div className="border-b border-zinc-100 last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between py-3 text-left font-semibold text-zinc-900"
        aria-expanded={open}
      >
        {title}
        <svg className={`h-4 w-4 text-zinc-500 transition ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <dl className="grid gap-x-4 gap-y-2 pb-3 sm:grid-cols-2">
          {entries.map(([label, value]) => (
            <div key={label}>
              <dt className="text-sm text-zinc-500">{label}</dt>
              <dd className="font-medium text-zinc-900">{value}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  )
}

export default function ListingDetails({ listing, showRemarks = true }: Props) {
  const f = (listing.StandardFields ?? {}) as SparkStandardFields
  const remarks = showRemarks ? (f.PublicRemarks ?? f.PrivateRemarks ?? '') : ''

  const agentBlock = [
    f.ListAgentFirstName || f.ListAgentLastName ? [f.ListAgentFirstName, f.ListAgentLastName].filter(Boolean).join(' ') : null,
    f.ListAgentEmail,
    f.ListAgentPreferredPhone,
    f.ListOfficeName,
    f.ListOfficePhone,
  ]
    .filter(Boolean)
    .map((line) => (typeof line === 'string' && isMasked(line) ? null : line))
    .filter((line): line is string => line != null && (typeof line !== 'string' || !isMasked(line)))

  const openHouses = Array.isArray(f.OpenHouses) ? f.OpenHouses : []

  const labelMap: Record<string, string> = {
    BedroomsTotal: 'Beds', BedsTotal: 'Beds', BathroomsTotal: 'Baths', BathsTotal: 'Baths',
    BuildingAreaTotal: 'Sq ft', LivingArea: 'Living area', LotSizeAcres: 'Lot (acres)', LotSizeSquareFeet: 'Lot (sq ft)',
    YearBuilt: 'Year built', SubdivisionName: 'Subdivision', StandardStatus: 'Status', ListStatus: 'Status',
    PropertyType: 'Property type', PropertySubType: 'Property sub-type', ModificationTimestamp: 'Last modified',
    AssociationFee: 'HOA dues', AssociationFeeFrequency: 'HOA frequency', AssociationYN: 'HOA', Association: 'Association',
    GarageSpaces: 'Garage spaces', Garage: 'Garage', AttachedGarageYN: 'Attached garage',
    TaxAnnualAmount: 'Tax (annual)', TaxYear: 'Tax year', ParcelNumber: 'Parcel', Zoning: 'Zoning',
    RentalRestrictions: 'Rental policy', ListPrice: 'List price', ListingId: 'Listing ID',
  }

  const usedKeys = new Set(FIELD_GROUPS.flatMap((g) => g.keys))
  const reservedKeys = new Set([
    'FloorPlans', 'FloorPlan', 'Floor Plans', 'Floor Plan', 'Documents', 'Document', 'Photos', 'Videos', 'VirtualTours', 'OpenHouses',
    'ListAgentFirstName', 'ListAgentLastName', 'ListAgentEmail', 'ListAgentPreferredPhone', 'ListOfficeName', 'ListOfficePhone',
    'PublicRemarks', 'PrivateRemarks',
  ])
  const reservedNormalized = new Set(
    ['floorplans', 'floorplan', 'documents', 'document', 'photos', 'videos', 'virtualtours', 'openhouses']
  )
  function isReservedKey(key: string): boolean {
    if (reservedKeys.has(key)) return true
    const norm = key.replace(/\s+/g, '').toLowerCase()
    return reservedNormalized.has(norm)
  }
  function looksLikeUrlOrSerialized(value: string): boolean {
    if (isUrl(value)) return true
    if (value.includes('https://') || value.includes('http://')) return true
    if (value.length > 200 && value.includes(',')) return true
    return false
  }
  const subdivisionDisplay = formatValue(f.SubdivisionName)
  const generalEntries: [string, string][] = []
  for (const [k, v] of Object.entries(f)) {
    if (usedKeys.has(k) || isReservedKey(k) || v == null) continue
    const val = formatValue(v)
    if (val != null && val !== '' && !val.startsWith('[') && !looksLikeUrlOrSerialized(val)) {
      const label = labelMap[k] ?? k.replace(/([A-Z])/g, ' $1').trim()
      if (subdivisionDisplay && label.toLowerCase().includes('subdivision') && val === subdivisionDisplay) continue
      generalEntries.push([label, val])
    }
  }

  const hoaFee = f.AssociationFee != null ? formatValue(f.AssociationFee) : null
  const hoaFreq = (f.AssociationFeeFrequency ?? '') as string
  const rentalNote = f.RentalRestrictions as string | undefined

  return (
    <div className="space-y-8">
      {remarks && (
        <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="mb-3 text-lg font-semibold">Description</h2>
          <p className="whitespace-pre-wrap text-zinc-700">{typeof remarks === 'string' ? remarks : String(remarks ?? '')}</p>
        </section>
      )}

      {hoaFee != null && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="font-semibold text-amber-900">HOA dues: ${hoaFee}{hoaFreq ? ` ${hoaFreq}` : ''}</p>
          {rentalNote && <p className="mt-1 text-sm text-amber-800">Rental: {String(rentalNote)}</p>}
        </div>
      )}

      {agentBlock.length > 0 && (
        <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="mb-3 text-lg font-semibold">Listing agent & office</h2>
          <ul className="space-y-1 text-zinc-700">
            {agentBlock.map((line, i) => (
              <li key={i}>{typeof line === 'string' ? line : String(line ?? '')}</li>
            ))}
          </ul>
        </section>
      )}

      {openHouses.length > 0 && (
        <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="mb-3 text-lg font-semibold">Open houses</h2>
          <ul className="space-y-2">
            {openHouses.map((oh, i) => (
              <li key={i} className="text-zinc-700">
                {oh.Date}
                {oh.StartTime && oh.EndTime && ` ${oh.StartTime} – ${oh.EndTime}`}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold">Property details</h2>
        <div className="divide-y divide-zinc-100">
          {FIELD_GROUPS.map((group) => {
            const entries: [string, string][] = []
            for (const key of group.keys) {
              const raw = f[key]
              const value = formatValue(raw)
              if (value != null && value !== '') {
                const label = labelMap[key] ?? key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase())
                let display = key === 'AssociationFee' ? `$${value}` : value
                if (key === 'ModificationTimestamp' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
                  try {
                    display = new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
                  } catch {
                    /* keep raw */
                  }
                }
                entries.push([label, display])
              }
            }
            return <DetailsAccordion key={group.title} title={group.title} entries={entries} />
          })}
          {generalEntries.length > 0 && <DetailsAccordion title="More details" entries={generalEntries.slice(0, 20)} />}
        </div>
      </section>
    </div>
  )
}
