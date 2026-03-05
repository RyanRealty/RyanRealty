'use client'

import type { SparkListingResult } from '../../lib/spark'

type Props = { listing: SparkListingResult }

export default function ListingDetails({ listing }: Props) {
  const f = listing.StandardFields ?? {}
  const remarks = f.PublicRemarks ?? f.PrivateRemarks ?? ''

  const agentBlock = [
    f.ListAgentFirstName || f.ListAgentLastName
      ? [f.ListAgentFirstName, f.ListAgentLastName].filter(Boolean).join(' ')
      : null,
    f.ListAgentEmail,
    f.ListAgentPreferredPhone,
    f.ListOfficeName,
    f.ListOfficePhone,
  ].filter(Boolean)

  const openHouses = f.OpenHouses ?? []

  return (
    <div className="space-y-8">
      {remarks && (
        <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="mb-3 text-lg font-semibold">Description</h2>
          <p className="whitespace-pre-wrap text-zinc-700">{remarks}</p>
        </section>
      )}

      {agentBlock.length > 0 && (
        <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="mb-3 text-lg font-semibold">Listing agent & office</h2>
          <ul className="space-y-1 text-zinc-700">
            {agentBlock.map((line, i) => (
              <li key={i}>{line}</li>
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
        <dl className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
          {[
            ['Listing ID', f.ListingId],
            ['Status', f.StandardStatus ?? f.ListStatus],
            ['Property type', f.PropertyType ?? f.PropertySubType],
            ['List price', f.ListPrice != null ? `$${Number(f.ListPrice).toLocaleString()}` : null],
            ['Beds', f.BedsTotal],
            ['Baths', f.BathsTotal],
            ['Sq ft', f.BuildingAreaTotal != null ? f.BuildingAreaTotal.toLocaleString() : null],
            ['Lot acres', f.LotSizeAcres],
            ['Year built', f.YearBuilt],
            ['Address', [f.StreetNumber, f.StreetName, f.City, f.StateOrProvince, f.PostalCode].filter(Boolean).join(', ')],
            ['Subdivision', f.SubdivisionName],
            ['Modified', f.ModificationTimestamp],
          ].map(([label, value]) =>
            value != null && value !== '' ? (
              <div key={String(label)}>
                <dt className="text-sm text-zinc-500">{label}</dt>
                <dd className="font-medium text-zinc-900">{String(value)}</dd>
              </div>
            ) : null
          )}
        </dl>
      </section>
    </div>
  )
}
