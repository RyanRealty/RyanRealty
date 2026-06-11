#!/usr/bin/env node
/**
 * One-off lookup for the 228 SE Soft Tail Dr CMA build.
 * Uses service role client to bypass RLS and query the listings table.
 */
import { resolve, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { config as loadEnv } from 'dotenv'
import { createClient } from '@supabase/supabase-js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(__dirname, '..')
loadEnv({ path: join(REPO_ROOT, '.env.local') })

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(url, key, { auth: { persistSession: false } })

const cols = [
  'ListingKey',
  'ListNumber',
  'StreetNumber',
  'StreetDirPrefix',
  'StreetName',
  'StreetSuffix',
  'City',
  'PostalCode',
  'SubdivisionName',
  'BedroomsTotal',
  'BathroomsTotal',
  'TotalLivingAreaSqFt',
  'year_built',
  'lot_size_acres',
  'garage_spaces',
  'Latitude',
  'Longitude',
  'ListPrice',
  'ClosePrice',
  'CloseDate',
  'OnMarketDate',
  'StandardStatus',
  'PropertyType',
  'ListAgentFullName',
  'ListAgentEmail',
  'PhotoURL',
  'PublicRemarks',
  'pending_timestamp',
].join(',')

console.log('--- Pass 1: address match by ILIKE Soft Tail ---')
{
  const { data, error } = await supabase
    .from('listings')
    .select(cols)
    .ilike('StreetName', '%Soft Tail%')
    .limit(50)
  if (error) {
    console.error('Error:', error)
  } else {
    console.log(`Found ${data?.length ?? 0} rows`)
    for (const r of data ?? []) {
      console.log(
        `  ${r.StreetNumber} ${r.StreetDirPrefix ?? ''} ${r.StreetName} ${r.StreetSuffix ?? ''}, ${r.City} ${r.PostalCode} | ${r.StandardStatus} | List $${r.ListPrice} | Close $${r.ClosePrice} (${r.CloseDate}) | Sub=${r.SubdivisionName} | Key=${r.ListingKey}`
      )
    }
  }
}

console.log('\n--- Pass 2: 228 + Soft Tail exact ---')
{
  const { data, error } = await supabase
    .from('listings')
    .select(cols)
    .eq('StreetNumber', '228')
    .ilike('StreetName', '%Soft Tail%')
  if (error) {
    console.error('Error:', error)
  } else {
    console.log(JSON.stringify(data, null, 2))
  }
}

console.log('\n--- Pass 3: SoftTail no-space variant ---')
{
  const { data, error } = await supabase
    .from('listings')
    .select(cols)
    .ilike('StreetName', '%SoftTail%')
    .limit(20)
  if (error) {
    console.error('Error:', error)
  } else {
    console.log(`Found ${data?.length ?? 0} rows`)
    for (const r of data ?? []) {
      console.log(
        `  ${r.StreetNumber} ${r.StreetDirPrefix ?? ''} ${r.StreetName} ${r.StreetSuffix ?? ''}, ${r.City} ${r.PostalCode} | ${r.StandardStatus} | Key=${r.ListingKey}`
      )
    }
  }
}
