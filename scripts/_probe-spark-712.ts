/**
 * Probe Spark MLS API for 712 SW 1st St (MLS# 220179688).
 */
import { fetchSparkListingsPage } from '../lib/spark'

const token = process.env.SPARK_API_KEY
if (!token) {
  console.error('Missing SPARK_API_KEY')
  process.exit(1)
}

async function main() {
  const filters = [
    `ListingId Eq '220179688'`,
    `ListNumber Eq '220179688'`,
    `MlsNumber Eq '220179688'`,
    `(StreetNumber Eq '712') And (StreetName Eq '1st') And (City Eq 'Madras')`,
  ]
  for (const filter of filters) {
    console.log(`\n--- filter: ${filter} ---`)
    const r = await fetchSparkListingsPage(token, { page: 1, limit: 5, filter })
    const tot = r.D?.Pagination?.TotalRows ?? 0
    console.log(`  TotalRows: ${tot}`)
    for (const l of (r.D?.Results || []).slice(0, 3)) {
      const f: any = l.StandardFields || {}
      console.log(JSON.stringify({
        ListingId: f.ListingId,
        ListingKey: f.ListingKey,
        address: [f.StreetNumber, f.StreetDirPrefix, f.StreetName, f.StreetSuffix, f.City, f.StateOrProvince].filter(Boolean).join(' '),
        OriginalListPrice: f.OriginalListPrice,
        ListPrice: f.ListPrice,
        ClosePrice: f.ClosePrice,
        CloseDate: f.CloseDate,
        ListAgentName: f.ListAgentFullName || f.ListAgentName,
        ListOfficeName: f.ListOfficeName,
        BuyerAgentName: f.BuyerAgentFullName || f.BuyerAgentName,
        BuyerOfficeName: f.BuyerOfficeName,
        SubdivisionName: f.SubdivisionName,
        YearBuilt: f.YearBuilt,
        BedroomsTotal: f.BedroomsTotal,
        BathroomsTotal: f.BathroomsTotalDecimal || f.BathroomsTotal,
        LivingArea: f.LivingArea || f.BuildingAreaTotal || f.TotalLivingAreaSqFt,
      }, null, 2))
    }
    if (tot > 0) break
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
