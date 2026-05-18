/**
 * Owner-lookup helpers for the expired-listings workflow.
 *
 * Per docs/FUB_AGENT_LINK_AND_EXPIRED_LP_RESEARCH_2026-05-17.md + Matt's
 * 2026-05-17 expired listings directive: when a listing goes
 * Expired/Withdrawn/Canceled, we need to surface the OWNER so Matt can
 * reach out.
 *
 * Three lookup strategies, run in order — first hit wins:
 *
 *   1. FUB internal address match — search FUB people whose mailing or
 *      property address contains the listing's street address. Free,
 *      instant, ~30% hit rate for our service area.
 *
 *   2. Apify Deschutes County DIAL scraper — public records lookup
 *      gives owner name + tax mailing address. ~$0.05/lookup. Coverage:
 *      every parcel in Deschutes County (Bend, Redmond, Sisters, Tumalo,
 *      La Pine). Crook and Jefferson Counties (Prineville, Madras) need
 *      separate scrapers but follow the same pattern.
 *
 *   3. Apify "person email finder" actor — once we have owner name +
 *      city, search for an email. Lower hit rate (~30%) and lower
 *      reliability for individuals, but worth trying.
 *
 * If all three fail, the FUB person is created as a placeholder with the
 * full listing context as a Note, tagged `owner-lookup:pending`. Matt
 * gets the alert + does the manual skiptrace.
 */

import { createClient } from '@supabase/supabase-js'

const APIFY_BASE = 'https://api.apify.com/v2'
const APIFY_DIAL_ACTOR_ID = 'apify/web-scraper'  // generic scraper; can be replaced with a custom actor

export type OwnerLookupResult = {
  status: 'matched-fub' | 'matched-dial' | 'matched-apollo' | 'pending'
  fubPersonId?: number
  ownerName?: string
  ownerMailingAddress?: string
  ownerEmail?: string
  ownerPhone?: string
  source?: string
  notes?: string
}

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase env vars missing')
  return createClient(url, key)
}

/**
 * Strategy 1: search FUB people whose mailing address contains the listing's
 * street. Returns the first match.
 *
 * Match approach: we use the FUB API's `?streetAddress=` filter which does a
 * substring search across the addresses[] array. If that filter isn't
 * supported on our tier, we fall back to scanning fub_person_geo.formatted_address
 * (which we populate from geocoding).
 */
export async function fubAddressMatch(streetAddress: string, city: string): Promise<OwnerLookupResult | null> {
  const key = process.env.FOLLOWUPBOSS_API_KEY?.trim()
  if (!key) return null

  const norm = streetAddress.trim().toLowerCase().replace(/\s+/g, ' ')
  if (norm.length < 5) return null

  // Try FUB's native address filter first
  try {
    const auth = Buffer.from(`${key}:`).toString('base64')
    const url = `https://api.followupboss.com/v1/people?streetAddress=${encodeURIComponent(norm)}&limit=5&fields=id,name,addresses,tags`
    const res = await fetch(url, { headers: { Authorization: `Basic ${auth}` }, cache: 'no-store' })
    if (res.ok) {
      const j = (await res.json()) as { people?: Array<{ id: number; name: string; addresses?: Array<{ street?: string; city?: string }> }> }
      const candidates = j.people ?? []
      const hit = candidates.find((p) =>
        (p.addresses ?? []).some((a) => (a.street ?? '').toLowerCase().includes(norm))
      )
      if (hit) {
        return {
          status: 'matched-fub',
          fubPersonId: hit.id,
          ownerName: hit.name,
          source: 'fub-api-address-filter',
          notes: `Matched existing FUB person ${hit.id} by mailing address.`,
        }
      }
    }
  } catch (err) {
    console.warn('[expired-owner-lookup] FUB address filter failed:', err)
  }

  // Fallback: scan our geo-tagged people in Supabase
  try {
    const sb = getSupabase()
    const { data } = await sb
      .from('fub_person_geo')
      .select('fub_person_id, formatted_address')
      .ilike('formatted_address', `%${norm}%`)
      .limit(5)
    if (data && data.length > 0) {
      const hit = data[0]
      return {
        status: 'matched-fub',
        fubPersonId: hit.fub_person_id,
        source: 'fub-geo-supabase',
        notes: `Matched FUB person ${hit.fub_person_id} via fub_person_geo.formatted_address (${hit.formatted_address ?? '?'}).`,
      }
    }
  } catch (err) {
    console.warn('[expired-owner-lookup] Supabase fallback match failed:', err)
  }

  return null
}

/**
 * Strategy 2: Apify-driven Deschutes County DIAL lookup.
 *
 * DIAL (Deschutes Information Access Lookup) is the county's public-record
 * property search at https://dial.deschutes.org. We hit it via an Apify
 * actor that does an address search + scrapes the resulting owner record.
 *
 * Returns null if the city isn't in Deschutes County (Bend, Redmond, Sisters,
 * Sunriver, Tumalo, La Pine) — Crook (Prineville) and Jefferson (Madras)
 * counties have separate public-record systems and would need separate
 * actors. v1 of this helper only covers Deschutes.
 *
 * The Apify actor identifier defaults to a generic scraper; replace
 * APIFY_DIAL_ACTOR_ID at the top with a custom actor once we build one.
 */
const DESCHUTES_CITIES = new Set(['Bend', 'Redmond', 'Sisters', 'Sunriver', 'Tumalo', 'La Pine'])

export async function deschutesDialLookup(
  streetAddress: string,
  city: string,
): Promise<OwnerLookupResult | null> {
  const apifyToken = process.env.APIFY_API_TOKEN?.trim()
  if (!apifyToken) {
    console.warn('[deschutes-dial] APIFY_API_TOKEN missing — DIAL lookup unavailable')
    return null
  }
  if (!DESCHUTES_CITIES.has(city)) {
    return null  // out-of-county; need a different scraper
  }

  // Build the search URL on DIAL. The address-search endpoint accepts a
  // free-text query and returns matching parcels. We use Apify's web-scraper
  // actor with a pageFunction that submits the form and extracts:
  //   - Owner Name (from "Owner" row in the property summary table)
  //   - Tax Mailing Address (often different from the property address
  //     when the owner is absentee)
  //
  // The actor input below is the standard "URL list + pageFunction" shape
  // that the apify/web-scraper actor accepts.
  const dialSearchUrl = `https://dial.deschutes.org/Real/SearchResults?address=${encodeURIComponent(streetAddress + ' ' + city)}`
  const pageFunction = `
    async function pageFunction(context) {
      const { request, log, page } = context;
      await page.waitForSelector('table', { timeout: 15000 }).catch(() => null);
      // DIAL displays a results table; first match is typically the right one.
      const firstResultLink = await page.$('table a[href*="Property?"]');
      if (!firstResultLink) {
        return { error: 'no-results', url: request.url };
      }
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }),
        firstResultLink.click(),
      ]);
      const data = await page.evaluate(() => {
        const txt = (sel) => {
          const el = document.querySelector(sel);
          return el ? el.textContent.trim().replace(/\\s+/g, ' ') : null;
        };
        const findRowValue = (label) => {
          const rows = Array.from(document.querySelectorAll('tr'));
          for (const row of rows) {
            const cells = row.querySelectorAll('td, th');
            if (cells.length >= 2 && cells[0].textContent && cells[0].textContent.trim().toLowerCase().startsWith(label.toLowerCase())) {
              return cells[1].textContent.trim().replace(/\\s+/g, ' ');
            }
          }
          return null;
        };
        return {
          ownerName: findRowValue('Owner') || findRowValue('Owner Name'),
          ownerMailing: findRowValue('Mailing Address') || findRowValue('Tax Mailing Address'),
          parcel: findRowValue('Tax Account') || findRowValue('Parcel'),
          propertyAddress: findRowValue('Situs Address') || findRowValue('Property Address'),
        };
      });
      return data;
    }
  `

  try {
    const runRes = await fetch(
      `${APIFY_BASE}/acts/${encodeURIComponent(APIFY_DIAL_ACTOR_ID)}/run-sync-get-dataset-items?token=${apifyToken}&timeout=60`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startUrls: [{ url: dialSearchUrl }],
          pageFunction,
          maxRequestsPerCrawl: 1,
          maxConcurrency: 1,
          waitUntil: ['domcontentloaded'],
        }),
      },
    )
    if (!runRes.ok) {
      console.warn('[deschutes-dial] Apify run failed:', runRes.status)
      return null
    }
    const items = (await runRes.json()) as Array<{
      ownerName?: string
      ownerMailing?: string
      parcel?: string
      error?: string
    }>
    const item = items?.[0]
    if (!item || item.error || !item.ownerName) {
      return null
    }
    return {
      status: 'matched-dial',
      ownerName: item.ownerName,
      ownerMailingAddress: item.ownerMailing,
      source: `deschutes-dial${item.parcel ? `:${item.parcel}` : ''}`,
      notes: `Resolved via Deschutes DIAL public records. Parcel ${item.parcel ?? 'unknown'}. Mailing: ${item.ownerMailing ?? 'unknown'}.`,
    }
  } catch (err) {
    console.warn('[deschutes-dial] lookup error:', err)
    return null
  }
}

/**
 * Strategy 3: Tracerfy skip-trace (real-estate-focused).
 *
 * Per docs/FAIRST_AMERICAN_IGNITE_AND_SKIPTRACE_RESEARCH_2026-05-17.md §2.1:
 * Tracerfy is the API-first leader at our volume. $0.05/hit (free on miss),
 * returns up to 8 phones + 5 emails + mailing + owner name + litigator flag.
 * Bearer-token REST. No monthly minimum.
 *
 * Note on First American Ignite: Matt has an Ignite account but Ignite
 * itself has NO public API (it's a web portal). The Farming module is
 * powered by Benutech's ReboConnect API, which DOES have programmatic
 * access via a "Scholarship" subsidy program for affiliated brokers —
 * multi-week sales cycle. Contact: Eric Bryant, 562.374.3226. Until that
 * lands, Tracerfy is the primary phone+email enrichment provider.
 */
export type TracerfyEnrichment = {
  email?: string
  phone?: string
  allPhones?: Array<{ value: string; type?: string; isLitigator?: boolean }>
  allEmails?: string[]
  litigator?: boolean
  notes: string
}

export async function tracerfySkipTrace(params: {
  streetAddress: string
  city: string
  state?: string
  postalCode?: string | null
  ownerName?: string
}): Promise<TracerfyEnrichment | null> {
  const key = process.env.TRACERFY_API_KEY?.trim()
  const base = process.env.TRACERFY_API_BASE?.trim() ?? 'https://tracerfy.com/v1/api'
  if (!key) {
    console.warn('[tracerfy] TRACERFY_API_KEY missing — skiptrace unavailable')
    return null
  }

  const body: Record<string, unknown> = {
    address: params.streetAddress,
    city: params.city,
    state: params.state ?? 'OR',
  }
  if (params.postalCode) body.zip = params.postalCode
  if (params.ownerName) body.full_name = params.ownerName

  try {
    const res = await fetch(`${base}/trace/lookup/`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(body),
      cache: 'no-store',
    })
    if (res.status === 404 || res.status === 204) return null  // no match — free
    if (!res.ok) {
      console.warn(`[tracerfy] non-OK: ${res.status}`, await res.text().catch(() => ''))
      return null
    }
    const j = (await res.json()) as {
      status?: string
      phone_numbers?: Array<{ value?: string; phone?: string; type?: string; is_litigator?: boolean }>
      emails?: Array<string | { email?: string; value?: string }>
      litigator?: boolean
      deceased?: boolean
    }

    const phonesRaw = (j.phone_numbers ?? [])
      .map((p) => ({
        value: (p.value ?? p.phone ?? '').toString().replace(/\D/g, ''),
        type: p.type,
        isLitigator: p.is_litigator ?? false,
      }))
      .filter((p) => p.value.length === 10 || p.value.length === 11)

    const emailsRaw = (j.emails ?? [])
      .map((e) => (typeof e === 'string' ? e : (e.email ?? e.value ?? '')))
      .filter((e) => /@/.test(e))

    if (phonesRaw.length === 0 && emailsRaw.length === 0) return null

    const bestPhone =
      phonesRaw.find((p) => !p.isLitigator && /mobile|cell/i.test(p.type ?? ''))?.value ??
      phonesRaw.find((p) => !p.isLitigator)?.value ??
      phonesRaw[0]?.value

    return {
      phone: bestPhone,
      email: emailsRaw[0],
      allPhones: phonesRaw,
      allEmails: emailsRaw,
      litigator: j.litigator ?? phonesRaw.some((p) => p.isLitigator),
      notes: `Tracerfy returned ${phonesRaw.length} phones + ${emailsRaw.length} emails${j.litigator || phonesRaw.some((p) => p.isLitigator) ? ' (LITIGATOR FLAG — handle with care)' : ''}${j.deceased ? ' (DECEASED FLAG)' : ''}.`,
    }
  } catch (err) {
    console.warn('[tracerfy] error:', err)
    return null
  }
}

/**
 * DNC scrub via Tracerfy. Returns true if the number is on the National DNC
 * registry — DO NOT cold-call. Matt's broker license is at risk on a TCPA
 * violation. SMS + direct mail + door-knocking are still allowed; voice
 * calls require prior consent if DNC-registered.
 */
export async function isPhoneOnDNC(phone: string): Promise<boolean | null> {
  const key = process.env.TRACERFY_API_KEY?.trim()
  const base = process.env.TRACERFY_API_BASE?.trim() ?? 'https://tracerfy.com/v1/api'
  if (!key) return null
  const digits = phone.replace(/\D/g, '')
  if (digits.length !== 10 && digits.length !== 11) return null

  try {
    const res = await fetch(`${base}/dnc/lookup/`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: digits }),
      cache: 'no-store',
    })
    if (!res.ok) return null
    const j = (await res.json()) as { on_dnc?: boolean; registered?: boolean; dnc?: boolean }
    return Boolean(j.on_dnc ?? j.registered ?? j.dnc)
  } catch {
    return null
  }
}

/**
 * Strategy 4 (fallback): Apify property-owner-skip-trace actor.
 *
 * $0.12 per hit (free on miss). Lower hit rate than Tracerfy but uses a
 * different data source — sometimes succeeds where Tracerfy missed.
 * Reuses the APIFY_API_TOKEN we already have.
 */
export async function apifyPropertyOwnerSkipTrace(params: {
  streetAddress: string
  city: string
  state?: string
}): Promise<TracerfyEnrichment | null> {
  const apifyToken = process.env.APIFY_API_TOKEN?.trim()
  if (!apifyToken) return null
  const actor = 'khadinakbar~skip-trace-property-owner'
  try {
    const res = await fetch(
      `${APIFY_BASE}/acts/${actor}/run-sync-get-dataset-items?token=${apifyToken}&timeout=120`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          addresses: [{
            address: params.streetAddress,
            city: params.city,
            state: params.state ?? 'OR',
          }],
        }),
      },
    )
    if (!res.ok) return null
    const items = (await res.json()) as Array<{ phones?: string[]; emails?: string[]; owner?: string }>
    const item = items?.[0]
    if (!item || (!item.phones?.length && !item.emails?.length)) return null
    const phones = (item.phones ?? []).map((p) => ({
      value: p.replace(/\D/g, ''),
      type: undefined as string | undefined,
      isLitigator: false,
    }))
    return {
      phone: phones[0]?.value,
      email: item.emails?.[0],
      allPhones: phones,
      allEmails: item.emails ?? [],
      litigator: false,
      notes: `Apify property-owner skip-trace returned ${phones.length} phones + ${(item.emails ?? []).length} emails.`,
    }
  } catch (err) {
    console.warn('[apify-skiptrace] error:', err)
    return null
  }
}

/**
 * Combined enrichment — Tracerfy first, Apify fallback. DNC-scrubs the
 * best phone. Returns the first hit.
 */
export async function enrichOwnerContact(params: {
  streetAddress: string
  city: string
  state?: string
  postalCode?: string | null
  ownerName?: string
}): Promise<TracerfyEnrichment | null> {
  let res = await tracerfySkipTrace(params)
  if (!res) res = await apifyPropertyOwnerSkipTrace(params)
  if (!res) return null

  if (res.phone) {
    const onDnc = await isPhoneOnDNC(res.phone)
    if (onDnc === true) {
      res.notes += ' Best phone is on DNC registry. DO NOT cold-call (TCPA risk). SMS / direct mail / door-knock allowed.'
    } else if (onDnc === false) {
      res.notes += ' Best phone passed DNC scrub.'
    }
  }
  return res
}

/**
 * Run all four strategies in order, return the first useful result.
 *
 * Updates the expired_listings.owner_lookup_status + last_owner_lookup_at
 * via the caller (the cron writes the row).
 */
export async function lookupOwnerForExpiredListing(params: {
  streetAddress: string
  city: string
}): Promise<OwnerLookupResult> {
  // Strategy 1: FUB internal match
  const fubMatch = await fubAddressMatch(params.streetAddress, params.city)
  if (fubMatch) {
    // Even with a FUB match, try to enrich the phone/email if the existing
    // FUB record is light (no email/phone). Skip for now to save credits.
    return fubMatch
  }

  // Strategy 2: Deschutes DIAL (gives owner name + mailing)
  const dialMatch = await deschutesDialLookup(params.streetAddress, params.city)
  if (dialMatch) {
    // Strategy 3+4: enrich with phone/email
    const enrichment = await enrichOwnerContact({
      streetAddress: params.streetAddress,
      city: params.city,
      state: 'OR',
      ownerName: dialMatch.ownerName,
    })
    if (enrichment?.email || enrichment?.phone) {
      return {
        ...dialMatch,
        ownerEmail: enrichment.email,
        ownerPhone: enrichment.phone,
        notes: `${dialMatch.notes ?? ''} ${enrichment.notes}`.trim(),
      }
    }
    return dialMatch
  }

  // Strategy 3+4 standalone: try skiptrace by address even without DIAL owner name
  const directEnrichment = await enrichOwnerContact({
    streetAddress: params.streetAddress,
    city: params.city,
    state: 'OR',
  })
  if (directEnrichment?.email || directEnrichment?.phone) {
    return {
      status: 'matched-apollo',
      ownerEmail: directEnrichment.email,
      ownerPhone: directEnrichment.phone,
      source: 'tracerfy-direct',
      notes: directEnrichment.notes,
    }
  }

  // No match — placeholder pending manual lookup
  return {
    status: 'pending',
    notes: 'No FUB address match. DIAL lookup returned no result or city not in Deschutes County (Crook/Jefferson need separate scrapers). Manual skiptrace required.',
  }
}
