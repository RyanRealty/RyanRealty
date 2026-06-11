#!/usr/bin/env node
/**
 * Prepare a single consolidated data file with everything needed to render
 * the CMA HTML for 228 SE Soft Tail Dr.
 *
 * Reads:
 *   out/cma-228-soft-tail/raw/subject_full.json
 *   out/cma-228-soft-tail/raw/subject_full_photos.json
 *   out/cma-228-soft-tail/raw/comps_detailed.json
 *   out/cma-228-soft-tail/raw/active.json
 *
 * Writes:
 *   out/cma-228-soft-tail/raw/render_data.json
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(__dirname, '..')
const RAW = resolve(REPO_ROOT, 'out/cma-228-soft-tail/raw')

const subj = JSON.parse(readFileSync(resolve(RAW, 'subject_full.json'), 'utf8'))
const subjPhotos = JSON.parse(readFileSync(resolve(RAW, 'subject_full_photos.json'), 'utf8'))
const comps = JSON.parse(readFileSync(resolve(RAW, 'comps_detailed.json'), 'utf8'))
const actives = JSON.parse(readFileSync(resolve(RAW, 'active.json'), 'utf8'))

// Convert 800x600 photo URLs to 320x240 (Spark CDN supports both)
function to320(uri800) {
  if (!uri800) return null
  return uri800.replace('/800x600/', '/320x240/')
}

function compactComp(c) {
  const sf = c.StandardFields
  return {
    id: c.id,
    address: `${sf.StreetNumber} ${sf.StreetDirPrefix ?? ''} ${sf.StreetName} ${sf.StreetSuffix ?? ''}`.replace(/\s+/g, ' ').trim(),
    streetNumber: sf.StreetNumber,
    streetName: `${sf.StreetDirPrefix ?? ''} ${sf.StreetName} ${sf.StreetSuffix ?? ''}`.replace(/\s+/g, ' ').trim(),
    city: sf.City,
    zip: sf.PostalCode,
    subdivision: sf.SubdivisionName,
    beds: sf.BedsTotal,
    baths: sf.BathsTotal,
    bathsFull: sf.BathsFull,
    bathsHalf: sf.BathsHalf,
    sqft: sf.BuildingAreaTotal,
    lotAcres: sf.LotSizeAcres,
    yearBuilt: sf.YearBuilt,
    garage: sf.GarageSpaces,
    listPrice: sf.ListPrice,
    closePrice: sf.ClosePrice,
    closeDate: sf.CloseDate,
    onMarketDate: sf.OnMarketDate,
    pendingTimestamp: sf.PendingTimestamp,
    daysOnMarket: sf.DaysOnMarket,
    status: sf.StandardStatus,
    mlsId: sf.ListingId,
    mlsNumber: sf.ListingNumber || sf.MLSNumber,
    publicRemarks: sf.PublicRemarks,
    lat: sf.Latitude,
    lng: sf.Longitude,
    pricePerSqft: sf.ClosePrice && sf.BuildingAreaTotal ? Math.round(sf.ClosePrice / sf.BuildingAreaTotal) : null,
    photos: c.photos.map(p => ({
      uri800: p.Uri800,
      uri320: to320(p.Uri800),
      caption: p.Caption,
    })),
  }
}

const subjSf = subj.StandardFields
const data = {
  pullDate: new Date().toISOString().slice(0, 10),
  subject: {
    id: subj.Id,
    address: `${subjSf.StreetNumber} ${subjSf.StreetDirPrefix ?? ''} ${subjSf.StreetName} ${subjSf.StreetSuffix ?? ''}`.replace(/\s+/g, ' ').trim(),
    city: subjSf.City,
    zip: subjSf.PostalCode,
    subdivision: subjSf.SubdivisionName,
    beds: subjSf.BedsTotal,
    baths: subjSf.BathsTotal,
    bathsFull: subjSf.BathsFull,
    sqft: subjSf.BuildingAreaTotal,
    lotAcres: subjSf.LotSizeAcres,
    yearBuilt: subjSf.YearBuilt,
    garage: subjSf.GarageSpaces,
    lat: subjSf.Latitude,
    lng: subjSf.Longitude,
    lastListPrice: subjSf.ListPrice,
    lastClosePrice: subjSf.ClosePrice,
    lastCloseDate: subjSf.CloseDate,
    lastOnMarketDate: subjSf.OnMarketDate,
    lastPendingDate: subjSf.PendingDate,
    lastMlsNumber: subjSf.ListingNumber || subjSf.MLSNumber,
    publicRemarks: subjSf.PublicRemarks,
    photos: subjPhotos.slice(0, 12).map(p => ({
      uri800: p.Uri800,
      uri320: to320(p.Uri800),
      caption: p.Caption,
    })),
  },
  // Order: best/closest comps first per pricing analysis
  // (most recent + closest plan match)
  comps: comps.map(compactComp),
  actives: actives.map(a => {
    const sf = a.StandardFields || a
    return {
      address: `${sf.StreetNumber} ${sf.StreetDirPrefix ?? ''} ${sf.StreetName} ${sf.StreetSuffix ?? ''}`.replace(/\s+/g, ' ').trim(),
      status: `${sf.StandardStatus}/${sf.MlsStatus}`,
      listPrice: sf.ListPrice,
      beds: sf.BedsTotal,
      baths: sf.BathsTotal,
      sqft: sf.BuildingAreaTotal,
      lotAcres: sf.LotSizeAcres,
      yearBuilt: sf.YearBuilt,
      pricePerSqft: sf.ListPrice && sf.BuildingAreaTotal ? Math.round(sf.ListPrice / sf.BuildingAreaTotal) : null,
      onMarketDate: sf.OnMarketDate,
    }
  }),
}

writeFileSync(resolve(RAW, 'render_data.json'), JSON.stringify(data, null, 2))
console.log(`Wrote render_data.json — subject + ${data.comps.length} comps + ${data.actives.length} actives`)

// Print pricing summary
console.log('\n=== Pricing analysis ===')
console.log(`Subject: ${data.subject.beds}bd/${data.subject.baths}ba/${data.subject.sqft}sf, ${data.subject.lotAcres}ac, built ${data.subject.yearBuilt}, ${data.subject.garage}-car`)
console.log(`Last close: $${data.subject.lastClosePrice} (${data.subject.lastCloseDate})`)
console.log('\nComps sorted by close date desc:')
data.comps
  .slice()
  .sort((a, b) => (b.closeDate || '').localeCompare(a.closeDate || ''))
  .forEach((c, i) => {
    console.log(
      `  ${i + 1}. ${c.address} | ${c.closeDate} | $${c.closePrice} | ${c.sqft}sf @ $${c.pricePerSqft}/sf | ${c.beds}/${c.baths}, ${c.lotAcres}ac, ${c.yearBuilt}, ${c.garage}-car`,
    )
  })

console.log('\nActives:')
data.actives.forEach(a => {
  console.log(`  ${a.address} | ${a.status} | $${a.listPrice} | ${a.sqft}sf @ $${a.pricePerSqft}/sf`)
})
