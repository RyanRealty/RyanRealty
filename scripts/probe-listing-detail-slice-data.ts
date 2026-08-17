/**
 * §0 data pull for the served listing-detail punch slice.
 * Per docs/DATABASE_FOR_AI_AGENTS.md §4 + lookup rows for ask / HOA / listing detail.
 *
 *   npx tsx scripts/probe-listing-detail-slice-data.ts
 */
import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url?.trim() || !key?.trim()) {
  console.error('UNREADABLE: Supabase env missing')
  process.exit(2)
}

const sb = createClient(url, key)

const SELECT =
  'ListingKey, ListNumber, StreetNumber, StreetName, City, ListPrice, OriginalListPrice, StandardStatus, PropertyType, property_sub_type, BedroomsTotal, BathroomsTotal, TotalLivingAreaSqFt, lot_size_sqft, lot_size_acres, hoa_monthly, association_fee, association_fee_frequency, tax_annual_amount'

async function byListNumber(n: string) {
  const { data, error } = await sb.from('listings').select(SELECT).eq('ListNumber', n).limit(3)
  return { n, error: error?.message ?? null, rows: data }
}

async function byAddress(city: string, number: string, street: string) {
  const { data, error } = await sb
    .from('listings')
    .select(SELECT)
    .ilike('City', city)
    .eq('StreetNumber', number)
    .ilike('StreetName', `%${street}%`)
    .in('StandardStatus', ['Active', 'Coming Soon', 'Active Under Contract'])
    .limit(8)
  return { city, number, street, error: error?.message ?? null, rows: data }
}

async function main() {
  const [bryant, agness, empire, foley, broadway, american, carmen] = await Promise.all([
    byListNumber('220224428'),
    byListNumber('220208750'),
    byListNumber('220226741'),
    byListNumber('220221409'),
    byAddress('Bend', '725', 'Broadway'),
    byAddress('Bend', '61400', 'American'),
    byAddress('Bend', '20748', 'Carmen'),
  ])
  console.log(
    JSON.stringify(
      { fetchedAt: new Date().toISOString(), bryant, agness, empire, foley, broadway, american, carmen },
      null,
      2,
    ),
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
