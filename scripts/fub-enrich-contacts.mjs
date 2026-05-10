#!/usr/bin/env node
/**
 * Follow Up Boss contact enrichment runner.
 *
 * What this does:
 * 1) Pulls contacts from FUB People API (paginated).
 * 2) Normalizes first/last names when only full name exists.
 * 3) Extracts owned-home vs mailing-address hints from common custom fields.
 * 4) Looks up owned-home address in Supabase listings to infer ownership timing.
 * 5) Writes an enrichment report JSON and (optionally) applies safe updates to FUB.
 *
 * Safe-by-default: dry run unless --apply is passed.
 *
 * Usage examples:
 *   node --env-file=.env.local scripts/fub-enrich-contacts.mjs
 *   node --env-file=.env.local scripts/fub-enrich-contacts.mjs --limit 500 --apply --write-notes
 *   node --env-file=.env.local scripts/fub-enrich-contacts.mjs --person-id 12345 --apply
 */

import { mkdir, writeFile } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const FUB_BASE = 'https://api.followupboss.com/v1'
const DEFAULT_BATCH_SIZE = 100
const BASE_FUB_FIELDS = [
  'id',
  'name',
  'firstName',
  'lastName',
  'emails',
  'phones',
  'addresses',
  'socialData',
  'source',
  'tags',
  'stage',
  'lastActivity',
]
const HUMAN_SUFFIXES = new Set(['jr', 'sr', 'ii', 'iii', 'iv', 'v', 'md', 'phd', 'esq'])
const ENTITY_KEYWORD_REGEX =
  /\b(trust|tr|estate|llc|l\.l\.c|inc|corp|corporation|company|co|lp|ltd|foundation|revocable|irrevocable|family trust|holdings|partners)\b/i
const EXCLUDED_SINGLE_TOKEN_NAMES = new Set(['unknown', 'n/a', 'na', 'none', 'test'])

const PROPERTY_ADDRESS_KEYS = [
  'propertyAddress',
  'propertyStreet',
  'property_address',
  'property_street',
  'ownedPropertyAddress',
  'owned_property_address',
  'homeAddress',
  'home_address',
  'customOpenHouseAddress',
]

const PROPERTY_CITY_KEYS = ['propertyCity', 'property_city', 'ownedPropertyCity', 'owned_property_city']
const PROPERTY_STATE_KEYS = ['propertyState', 'property_state', 'ownedPropertyState', 'owned_property_state']
const PROPERTY_POSTAL_KEYS = ['propertyPostalCode', 'property_postal_code', 'propertyZip', 'property_zip']

const MAILING_ADDRESS_KEYS = [
  'mailingAddress',
  'mailingStreet',
  'mailing_address',
  'mailing_street',
  'mailAddress',
  'mail_address',
]

const MAILING_CITY_KEYS = ['mailingCity', 'mailing_city', 'mailCity', 'mail_city']
const MAILING_STATE_KEYS = ['mailingState', 'mailing_state', 'mailState', 'mail_state']
const MAILING_POSTAL_KEYS = ['mailingPostalCode', 'mailing_postal_code', 'mailingZip', 'mailing_zip']

function parseArgs(argv) {
  const out = { _: [] }
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i]
    if (!token.startsWith('--')) {
      out._.push(token)
      continue
    }
    const eq = token.indexOf('=')
    if (eq > -1) {
      out[token.slice(2, eq)] = token.slice(eq + 1)
      continue
    }
    const next = argv[i + 1]
    if (next && !next.startsWith('--')) {
      out[token.slice(2)] = next
      i += 1
    } else {
      out[token.slice(2)] = true
    }
  }
  return out
}

function asNumber(value, fallback) {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function normalizeWhitespace(value) {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeStreetLike(value) {
  return normalizeWhitespace(value)
    .toLowerCase()
    .replace(/[.,]/g, '')
}

function safeNameToken(token) {
  return normalizeWhitespace(token).replace(/^[^A-Za-z]+|[^A-Za-z.'-]+$/g, '')
}

function lastActivityTimestamp(person) {
  const v = person?.lastActivity
  if (!v) return null
  if (typeof v === 'string') {
    const ts = new Date(v).getTime()
    return Number.isFinite(ts) ? ts : null
  }
  if (typeof v === 'object') {
    const keys = ['date', 'created', 'updated', 'createdAt', 'updatedAt', 'timestamp']
    for (const key of keys) {
      const value = v[key]
      if (!value) continue
      const ts = new Date(value).getTime()
      if (Number.isFinite(ts)) return ts
    }
  }
  return null
}

function isRecentlyActive(person, days = 30) {
  const ts = lastActivityTimestamp(person)
  if (!ts) return false
  const ageMs = Date.now() - ts
  return ageMs >= 0 && ageMs <= days * 24 * 60 * 60 * 1000
}

function isLikelyEntityContact({ nameValue, person, email }) {
  const normalizedName = normalizeWhitespace(nameValue).toLowerCase()
  if (!normalizedName) return false
  if (ENTITY_KEYWORD_REGEX.test(normalizedName)) return true

  const tagText = Array.isArray(person?.tags) ? person.tags.map((tag) => String(tag)).join(' ').toLowerCase() : ''
  if (ENTITY_KEYWORD_REGEX.test(tagText)) return true

  if (email && ENTITY_KEYWORD_REGEX.test(email)) return true
  return false
}

function suggestNameUpdate({ nameValue, existingFirst, existingLast, person, email }) {
  if (existingFirst || existingLast) {
    return {
      suggestedFirstName: null,
      suggestedLastName: null,
      confidence: 'none',
      reason: 'Name already populated',
      skipAutoUpdate: true,
    }
  }

  const cleaned = normalizeWhitespace(nameValue)
  if (!cleaned) {
    return {
      suggestedFirstName: null,
      suggestedLastName: null,
      confidence: 'none',
      reason: 'Blank name',
      skipAutoUpdate: true,
    }
  }

  if (isLikelyEntityContact({ nameValue: cleaned, person, email })) {
    return {
      suggestedFirstName: null,
      suggestedLastName: null,
      confidence: 'none',
      reason: 'Likely entity or trust contact',
      skipAutoUpdate: true,
    }
  }

  const parts = cleaned
    .split(' ')
    .map((part) => safeNameToken(part))
    .filter(Boolean)

  if (parts.length < 2) {
    if (EXCLUDED_SINGLE_TOKEN_NAMES.has(parts[0]?.toLowerCase() || '')) {
      return {
        suggestedFirstName: null,
        suggestedLastName: null,
        confidence: 'none',
        reason: 'Placeholder-like single token',
        skipAutoUpdate: true,
      }
    }
    return {
      suggestedFirstName: parts[0] || null,
      suggestedLastName: null,
      confidence: 'low',
      reason: 'Single-token name, manual review recommended',
      skipAutoUpdate: true,
    }
  }

  let canonicalParts = [...parts]
  const trailing = canonicalParts[canonicalParts.length - 1]?.replace('.', '').toLowerCase()
  if (HUMAN_SUFFIXES.has(trailing)) canonicalParts = canonicalParts.slice(0, -1)
  if (canonicalParts.length < 2) {
    return {
      suggestedFirstName: null,
      suggestedLastName: null,
      confidence: 'low',
      reason: 'Insufficient human-name tokens',
      skipAutoUpdate: true,
    }
  }

  const suggestedFirstName = canonicalParts[0]
  const suggestedLastName = canonicalParts.slice(1).join(' ')
  if (!suggestedFirstName || !suggestedLastName) {
    return {
      suggestedFirstName: null,
      suggestedLastName: null,
      confidence: 'low',
      reason: 'Unable to confidently split name',
      skipAutoUpdate: true,
    }
  }

  const hasSpecialChars = /[0-9@_/]/.test(cleaned)
  const recentActivity = isRecentlyActive(person, 30)
  if (hasSpecialChars || recentActivity) {
    return {
      suggestedFirstName,
      suggestedLastName,
      confidence: 'medium',
      reason: recentActivity
        ? 'Contact appears recently active, defer to manual review'
        : 'Name has unusual characters, defer to manual review',
      skipAutoUpdate: true,
    }
  }

  return {
    suggestedFirstName,
    suggestedLastName,
    confidence: 'high',
    reason: 'Clear two-part human name',
    skipAutoUpdate: false,
  }
}

function getField(person, keys) {
  for (const key of keys) {
    if (!Object.prototype.hasOwnProperty.call(person, key)) continue
    const value = normalizeWhitespace(person[key])
    if (value) return { key, value }
  }
  return null
}

function parseAddressBlob(address) {
  const raw = normalizeWhitespace(address)
  if (!raw) return null
  const parts = raw.split(',').map((part) => normalizeWhitespace(part)).filter(Boolean)
  if (parts.length === 0) return null

  const street = parts[0] || null
  const city = parts.length > 1 ? parts[1] : null
  const stateZipPart = parts.length > 2 ? parts[2] : null

  let state = null
  let postalCode = null
  if (stateZipPart) {
    const match = stateZipPart.match(/^([A-Za-z]{2})\s*(\d{5}(?:-\d{4})?)?$/)
    if (match) {
      state = match[1].toUpperCase()
      postalCode = match[2] || null
    }
  }

  return { street, city, state, postalCode, raw }
}

function splitStreetNumberAndName(street) {
  const cleaned = normalizeWhitespace(street)
  if (!cleaned) return { streetNumber: null, streetName: null }
  const match = cleaned.match(/^(\d+[A-Za-z\-]*)\s+(.+)$/)
  if (!match) {
    return { streetNumber: null, streetName: cleaned }
  }
  return {
    streetNumber: match[1],
    streetName: match[2],
  }
}

function deriveAddress(person, shape) {
  const full = getField(person, shape.full)
  const city = getField(person, shape.city)
  const state = getField(person, shape.state)
  const postalCode = getField(person, shape.postalCode)

  const parsed = full ? parseAddressBlob(full.value) : null
  const street = parsed?.street ?? full?.value ?? null
  const outCity = city?.value ?? parsed?.city ?? null
  const outState = state?.value?.toUpperCase() ?? parsed?.state ?? null
  const outPostalCode = postalCode?.value ?? parsed?.postalCode ?? null

  const hasAny = [street, outCity, outState, outPostalCode].some(Boolean)
  if (!hasAny) return null

  return {
    street,
    city: outCity,
    state: outState,
    postalCode: outPostalCode,
    sourceKeys: {
      street: full?.key ?? null,
      city: city?.key ?? null,
      state: state?.key ?? null,
      postalCode: postalCode?.key ?? null,
    },
    raw: full?.value ?? null,
  }
}

function formatAddress(address) {
  if (!address) return null
  const parts = [address.street, address.city, address.state, address.postalCode].filter(Boolean)
  return parts.length > 0 ? parts.join(', ') : null
}

function normalizeAddressKey(address) {
  if (!address) return ''
  return normalizeStreetLike(
    `${address.street ?? ''}|${address.city ?? ''}|${address.state ?? ''}|${address.postalCode ?? ''}`
  )
}

function toFubAddressObject(address, type) {
  if (!address?.street) return null
  return {
    type,
    street: normalizeWhitespace(address.street) || null,
    city: normalizeWhitespace(address.city) || null,
    state: normalizeWhitespace(address.state).toUpperCase() || null,
    code: normalizeWhitespace(address.postalCode) || null,
  }
}

function mergeFubAddresses(existingAddresses, ownedAddress, mailingAddress) {
  const existing = Array.isArray(existingAddresses)
    ? existingAddresses
        .filter((entry) => entry && typeof entry === 'object')
        .map((entry) => ({
          ...entry,
          type: normalizeWhitespace(entry.type) || null,
          street: normalizeWhitespace(entry.street || entry.street1 || entry.line1 || entry.address || entry.value) || null,
          city: normalizeWhitespace(entry.city) || null,
          state: normalizeWhitespace(entry.state).toUpperCase() || null,
          code: normalizeWhitespace(entry.code || entry.zip || entry.postalCode) || null,
        }))
    : []

  const ownedObj = toFubAddressObject(ownedAddress, 'home')
  const mailingObj = toFubAddressObject(mailingAddress, 'mailing')
  const out = [...existing]
  let changed = false

  function upsertAddress(candidate) {
    if (!candidate?.street) return
    const existingIndex = out.findIndex((entry) => {
      const byType =
        normalizeWhitespace(entry.type).toLowerCase() === normalizeWhitespace(candidate.type).toLowerCase() &&
        normalizeWhitespace(entry.type) !== ''
      const byAddress = normalizeAddressKey(entry) === normalizeAddressKey(candidate)
      return byType || byAddress
    })

    if (existingIndex === -1) {
      out.push(candidate)
      changed = true
      return
    }

    const current = out[existingIndex]
    const merged = {
      ...current,
      type: current.type || candidate.type,
      street: current.street || candidate.street,
      city: current.city || candidate.city,
      state: current.state || candidate.state,
      code: current.code || candidate.code,
    }
    const currentKey = JSON.stringify(current)
    const mergedKey = JSON.stringify(merged)
    if (currentKey !== mergedKey) {
      out[existingIndex] = merged
      changed = true
    }
  }

  upsertAddress(ownedObj)
  upsertAddress(mailingObj)

  return {
    addresses: out.map((entry) => ({
      type: entry.type || undefined,
      street: entry.street || undefined,
      city: entry.city || undefined,
      state: entry.state || undefined,
      code: entry.code || undefined,
    })),
    changed,
  }
}

function addressFromAddressArray(person, targetType) {
  if (!Array.isArray(person.addresses) || person.addresses.length === 0) return null
  const loweredTarget = targetType.toLowerCase()
  const ranked = person.addresses
    .filter((entry) => entry && typeof entry === 'object')
    .sort((a, b) => {
      const ta = normalizeWhitespace(a.type).toLowerCase()
      const tb = normalizeWhitespace(b.type).toLowerCase()
      const aMatch = ta.includes(loweredTarget) ? 1 : 0
      const bMatch = tb.includes(loweredTarget) ? 1 : 0
      return bMatch - aMatch
    })
  const top = ranked[0]
  if (!top) return null

  const street =
    normalizeWhitespace(top.street || top.street1 || top.line1 || top.address || top.value) || null
  const city = normalizeWhitespace(top.city) || null
  const state = normalizeWhitespace(top.state).toUpperCase() || null
  const postalCode = normalizeWhitespace(top.code || top.zip || top.postalCode) || null
  const hasAny = [street, city, state, postalCode].some(Boolean)
  if (!hasAny) return null
  return {
    street,
    city,
    state,
    postalCode,
    sourceKeys: {
      street: 'addresses[].street',
      city: 'addresses[].city',
      state: 'addresses[].state',
      postalCode: 'addresses[].code',
    },
    raw: street,
  }
}

function primaryEmail(person) {
  if (!Array.isArray(person.emails) || person.emails.length === 0) return null
  const first = person.emails.find((entry) => normalizeWhitespace(entry?.value))
  return first ? normalizeWhitespace(first.value).toLowerCase() : null
}

function primaryPhone(person) {
  if (!Array.isArray(person.phones) || person.phones.length === 0) return null
  const first = person.phones.find((entry) => normalizeWhitespace(entry?.value))
  return first ? normalizeWhitespace(first.value) : null
}

function toYearsOwned(closeDateIso) {
  if (!closeDateIso) return null
  const closeTs = new Date(closeDateIso).getTime()
  if (!Number.isFinite(closeTs)) return null
  const years = (Date.now() - closeTs) / (365.25 * 24 * 60 * 60 * 1000)
  return years >= 0 ? Number(years.toFixed(1)) : null
}

function buildPublicResearchLinks({ fullName, city, address }) {
  const links = {}

  const placeHint = city || 'Central Oregon'
  if (fullName) {
    const fbQuery = encodeURIComponent(`${fullName} ${placeHint} Facebook`)
    links.facebookSearch = `https://www.google.com/search?q=${fbQuery}`

    const recordsQuery = encodeURIComponent(`${fullName} ${placeHint} property records`)
    links.publicRecordsSearch = `https://www.google.com/search?q=${recordsQuery}`
  }

  if (address) {
    const addressQuery = encodeURIComponent(`${address} Deschutes County property records`)
    links.addressRecordsSearch = `https://www.google.com/search?q=${addressQuery}`
  }

  return links
}

function getAuthHeaders(apiKey) {
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Basic ${Buffer.from(`${apiKey}:`).toString('base64')}`,
  }
  const system = normalizeWhitespace(process.env.FOLLOWUPBOSS_SYSTEM)
  const systemKey = normalizeWhitespace(process.env.FOLLOWUPBOSS_SYSTEM_KEY)
  if (system) headers['X-System'] = system
  if (systemKey) headers['X-System-Key'] = systemKey
  return headers
}

async function fetchCustomFieldNames(apiKey) {
  const params = new URLSearchParams({ limit: '200' })
  const res = await fetch(`${FUB_BASE}/customFields?${params.toString()}`, {
    headers: getAuthHeaders(apiKey),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`FUB customFields fetch failed (${res.status}): ${body || res.statusText}`)
  }
  const data = await res.json()
  const customFields = Array.isArray(data.customfields) ? data.customfields : []
  return customFields
    .map((field) => normalizeWhitespace(field?.name))
    .filter(Boolean)
}

async function fetchFubPeoplePage({ apiKey, offset, limit, personId, nextLink, fields }) {
  const fieldsParam = Array.isArray(fields) && fields.length > 0 ? fields.join(',') : null
  if (personId) {
    const personUrl = (() => {
      if (!fieldsParam) return `${FUB_BASE}/people/${personId}`
      const q = new URLSearchParams({ fields: fieldsParam })
      return `${FUB_BASE}/people/${personId}?${q.toString()}`
    })()
    const res = await fetch(personUrl, {
      headers: getAuthHeaders(apiKey),
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(`FUB person fetch failed (${res.status}): ${body || res.statusText}`)
    }
    const person = await res.json()
    return { people: person ? [person] : [], nextOffset: null, nextLink: null }
  }

  const endpoint = (() => {
    if (nextLink) {
      if (/^https?:\/\//i.test(nextLink)) return nextLink
      return `${FUB_BASE}${nextLink.startsWith('/') ? nextLink : `/${nextLink}`}`
    }
    const params = new URLSearchParams({
      offset: String(offset),
      limit: String(limit),
    })
    if (fieldsParam) params.set('fields', fieldsParam)
    return `${FUB_BASE}/people?${params.toString()}`
  })()

  const res = await fetch(endpoint, {
    headers: getAuthHeaders(apiKey),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`FUB people list failed (${res.status}): ${body || res.statusText}`)
  }
  const data = await res.json()
  const people = Array.isArray(data.people) ? data.people : []
  const count = asNumber(data._metadata?.collection?.count, people.length)
  const responseNextLink =
    typeof data?._metadata?.collection?.nextLink === 'string'
      ? data._metadata.collection.nextLink
      : typeof data?._metadata?.nextLink === 'string'
      ? data._metadata.nextLink
      : null
  const nextOffset = people.length === count ? offset + count : null
  return { people, nextOffset, nextLink: responseNextLink }
}

async function updateFubPerson({ apiKey, personId, body }) {
  const res = await fetch(`${FUB_BASE}/people/${personId}?mergeTags=true`, {
    method: 'PUT',
    headers: getAuthHeaders(apiKey),
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`FUB update failed for person ${personId} (${res.status}): ${text || res.statusText}`)
  }
}

async function addFubNote({ apiKey, personId, body }) {
  const res = await fetch(`${FUB_BASE}/notes`, {
    method: 'POST',
    headers: getAuthHeaders(apiKey),
    body: JSON.stringify({ personId, body, isHtml: false }),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`FUB note failed for person ${personId} (${res.status}): ${text || res.statusText}`)
  }
}

async function lookupOwnedHomeFromSupabase({ supabase, address }) {
  if (!supabase || !address?.street || !address?.city) return null

  const { streetNumber, streetName } = splitStreetNumberAndName(address.street)
  if (!streetNumber || !streetName || streetName.length < 3) return null
  let query = supabase
    .from('listings')
    .select(
      'ListingKey,ListNumber,StreetNumber,StreetName,City,State,PostalCode,StandardStatus,CloseDate,ClosePrice,ListPrice,BedroomsTotal,BathroomsTotal,TotalLivingAreaSqFt,year_built'
    )
    .ilike('City', address.city)
    .limit(12)

  if (streetNumber) query = query.eq('StreetNumber', streetNumber)
  if (streetName) query = query.ilike('StreetName', `%${streetName}%`)

  const { data, error } = await query
  if (error || !data || data.length === 0) return null

  const targetStreetNorm = normalizeStreetLike(address.street)
  const filtered = data.filter((row) => {
    const rowStreet = normalizeStreetLike(`${row.StreetNumber ?? ''} ${row.StreetName ?? ''}`.trim())
    if (!rowStreet) return true
    if (targetStreetNorm === rowStreet) return true
    return targetStreetNorm.includes(rowStreet) || rowStreet.includes(targetStreetNorm)
  })

  const candidates = filtered.length > 0 ? filtered : data
  const closed = candidates
    .filter((row) => String(row.StandardStatus ?? '').toLowerCase().includes('closed'))
    .sort((a, b) => {
      const ta = new Date(a.CloseDate ?? 0).getTime()
      const tb = new Date(b.CloseDate ?? 0).getTime()
      return tb - ta
    })

  const bestClosed = closed[0] ?? null
  const bestAny = candidates[0] ?? null
  const best = bestClosed ?? bestAny
  if (!best) return null

  const closeDate = bestClosed?.CloseDate ?? null
  return {
    listingKey: best.ListingKey ?? null,
    listNumber: best.ListNumber ?? null,
    street: normalizeWhitespace(`${best.StreetNumber ?? ''} ${best.StreetName ?? ''}`),
    city: best.City ?? null,
    state: best.State ?? null,
    postalCode: best.PostalCode ?? null,
    status: best.StandardStatus ?? null,
    closeDate,
    closePrice: bestClosed?.ClosePrice ?? null,
    estimatedYearsOwned: toYearsOwned(closeDate),
    beds: best.BedroomsTotal ?? null,
    baths: best.BathroomsTotal ?? null,
    sqft: best.TotalLivingAreaSqFt ?? null,
    yearBuilt: best.year_built ?? null,
  }
}

function buildOwnershipSummary(ownership) {
  if (!ownership) return null
  const parts = []
  if (ownership.street || ownership.city) {
    parts.push(`Home: ${[ownership.street, ownership.city, ownership.state, ownership.postalCode].filter(Boolean).join(', ')}`)
  }
  if (ownership.closeDate) {
    parts.push(`Last close: ${ownership.closeDate}`)
  }
  if (ownership.estimatedYearsOwned != null) {
    parts.push(`Estimated ownership duration: ${ownership.estimatedYearsOwned} years`)
  }
  if (ownership.closePrice != null) {
    parts.push(`Last close price: $${Number(ownership.closePrice).toLocaleString()}`)
  }
  if (ownership.listNumber) {
    parts.push(`MLS: ${ownership.listNumber}`)
  }
  return parts.join(' | ')
}

function ownershipFromCustomFields(person) {
  const purchaseDate = normalizeWhitespace(person.customPurchaseDate) || null
  const purchasePriceRaw = person.customPurchasePrice
  const yearsOwnedRaw = person.customYearsOwned
  const marketValueRaw = person.customMarketValue
  const propertyType = normalizeWhitespace(person.customPropertyType) || null

  const purchasePrice = Number.isFinite(Number(purchasePriceRaw)) ? Number(purchasePriceRaw) : null
  const yearsOwned = Number.isFinite(Number(yearsOwnedRaw)) ? Number(yearsOwnedRaw) : null
  const marketValue = Number.isFinite(Number(marketValueRaw)) ? Number(marketValueRaw) : null

  const hasAny = [purchaseDate, purchasePrice, yearsOwned, marketValue, propertyType].some((value) => value != null)
  if (!hasAny) return null

  return {
    purchaseDate,
    purchasePrice,
    yearsOwned,
    marketValue,
    propertyType,
  }
}

function buildPropertyFieldUpdate({ person, ownedAddress, ownershipCustom, ownershipLookup }) {
  const update = {}
  const existingOpenHouseAddress = normalizeWhitespace(person.customOpenHouseAddress)
  const ownedFormatted = formatAddress(ownedAddress)

  // Keep using configured custom fields in this FUB account for owned-home context.
  if (!existingOpenHouseAddress && ownedFormatted) {
    update.customOpenHouseAddress = ownedFormatted
  }

  if (!ownershipCustom?.purchaseDate && ownershipLookup?.closeDate) {
    update.customPurchaseDate = ownershipLookup.closeDate
  }
  if ((ownershipCustom?.purchasePrice == null) && ownershipLookup?.closePrice != null) {
    update.customPurchasePrice = Math.round(Number(ownershipLookup.closePrice))
  }
  if ((ownershipCustom?.yearsOwned == null) && ownershipLookup?.estimatedYearsOwned != null) {
    update.customYearsOwned = Number(ownershipLookup.estimatedYearsOwned.toFixed(1))
  }
  if (!normalizeWhitespace(person.customMLSNumber) && ownershipLookup?.listNumber) {
    update.customMLSNumber = String(ownershipLookup.listNumber)
  }
  if (!ownershipCustom?.propertyType && ownershipLookup?.status) {
    update.customPropertyType = String(ownershipLookup.status)
  }

  return update
}

function helpText() {
  return `
fub-enrich-contacts.mjs

Options:
  --limit <n>         Total contacts to process (default: 300)
  --offset <n>        Starting offset for FUB pagination (default: 0)
  --batch-size <n>    FUB page size (default: 100, max recommended 100)
  --person-id <id>    Process a single FUB person ID
  --apply             Apply safe updates to FUB (default is dry run)
  --write-notes       Add a profile note to the contact (requires --apply)
  --supabase-ownership-lookup
                      Enable address -> listings ownership lookup (slower)
  --max-ownership-lookups <n>
                      Cap Supabase ownership lookups (default: 800)
  --report <path>     Output JSON path (default: out/fub-contact-enrichment/report-<ts>.json)
  --help              Show help

Env required:
  FOLLOWUPBOSS_API_KEY (or FUB_API_KEY)
  NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (recommended for ownership enrichment)
`.trim()
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args.help) {
    console.log(helpText())
    return
  }

  const apiKey = normalizeWhitespace(process.env.FOLLOWUPBOSS_API_KEY || process.env.FUB_API_KEY)
  if (!apiKey) {
    throw new Error('Missing FOLLOWUPBOSS_API_KEY or FUB_API_KEY')
  }

  const limit = Math.max(1, asNumber(args.limit, 300))
  const offsetStart = Math.max(0, asNumber(args.offset, 0))
  const batchSize = Math.min(100, Math.max(1, asNumber(args['batch-size'], DEFAULT_BATCH_SIZE)))
  const apply = Boolean(args.apply)
  const writeNotes = Boolean(args['write-notes'])
  const enableSupabaseOwnershipLookup = Boolean(args['supabase-ownership-lookup'])
  const maxOwnershipLookups = Math.max(0, asNumber(args['max-ownership-lookups'], 800))
  const personId = args['person-id'] ? asNumber(args['person-id'], NaN) : null
  if (args['person-id'] && !Number.isFinite(personId)) {
    throw new Error(`Invalid --person-id: ${args['person-id']}`)
  }
  if (writeNotes && !apply) {
    throw new Error('--write-notes requires --apply')
  }

  const defaultReportPath = resolve(
    ROOT,
    'out',
    'fub-contact-enrichment',
    `report-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
  )
  const reportPath = args.report ? resolve(ROOT, String(args.report)) : defaultReportPath

  const supabaseUrl = normalizeWhitespace(process.env.NEXT_PUBLIC_SUPABASE_URL)
  const supabaseKey = normalizeWhitespace(process.env.SUPABASE_SERVICE_ROLE_KEY)
  const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null
  const customFieldNames = await fetchCustomFieldNames(apiKey)
  const peopleFields = Array.from(new Set([...BASE_FUB_FIELDS, ...customFieldNames]))

  console.log('[fub-enrich] Starting run...')
  console.log(
    `[fub-enrich] mode=${apply ? 'APPLY' : 'DRY_RUN'} limit=${limit} offset=${offsetStart} batchSize=${batchSize}${personId ? ` personId=${personId}` : ''}`
  )
  if (!supabase) {
    console.log('[fub-enrich] Supabase not configured. Ownership enrichment will be skipped.')
  }

  const processed = []
  const errors = []
  const ownershipLookupCache = new Map()
  let ownershipLookupsExecuted = 0

  let offset = offsetStart
  let nextLink = null
  let remaining = personId ? 1 : limit

  while (remaining > 0) {
    const pageSize = personId ? 1 : Math.min(batchSize, remaining)
    const { people, nextOffset, nextLink: pageNextLink } = await fetchFubPeoplePage({
      apiKey,
      offset,
      limit: pageSize,
      personId,
      nextLink,
      fields: peopleFields,
    })

    if (!people.length) break

    for (const person of people) {
      const nameValue = normalizeWhitespace(person.name)
      const existingFirst = normalizeWhitespace(person.firstName) || null
      const existingLast = normalizeWhitespace(person.lastName) || null
      const email = primaryEmail(person)
      const nameSuggestion = suggestNameUpdate({
        nameValue,
        existingFirst,
        existingLast,
        person,
        email,
      })
      const mergedFirst = existingFirst || nameSuggestion.suggestedFirstName
      const mergedLast = existingLast || nameSuggestion.suggestedLastName
      const fullName = normalizeWhitespace([mergedFirst, mergedLast].filter(Boolean).join(' ')) || nameValue || null

      const ownedAddress = deriveAddress(person, {
        full: PROPERTY_ADDRESS_KEYS,
        city: PROPERTY_CITY_KEYS,
        state: PROPERTY_STATE_KEYS,
        postalCode: PROPERTY_POSTAL_KEYS,
      }) || addressFromAddressArray(person, 'home')
      const mailingAddress = deriveAddress(person, {
        full: MAILING_ADDRESS_KEYS,
        city: MAILING_CITY_KEYS,
        state: MAILING_STATE_KEYS,
        postalCode: MAILING_POSTAL_KEYS,
      }) || addressFromAddressArray(person, 'mail')

      const ownershipCustom = ownershipFromCustomFields(person)
      const hasOwnershipMetadata =
        ownershipCustom != null
      const ownershipCacheKey = ownedAddress
        ? normalizeStreetLike(`${ownedAddress.street ?? ''}|${ownedAddress.city ?? ''}|${ownedAddress.state ?? ''}`)
        : null

      let ownership = null
      const canLookupOwnership =
        enableSupabaseOwnershipLookup &&
        Boolean(supabase) &&
        Boolean(ownedAddress?.street) &&
        Boolean(ownedAddress?.city) &&
        !hasOwnershipMetadata &&
        ownershipLookupsExecuted < maxOwnershipLookups

      if (ownershipCacheKey && ownershipLookupCache.has(ownershipCacheKey)) {
        ownership = ownershipLookupCache.get(ownershipCacheKey)
      } else if (canLookupOwnership) {
        ownership = await lookupOwnedHomeFromSupabase({ supabase, address: ownedAddress })
        ownershipLookupsExecuted += 1
        if (ownershipCacheKey) ownershipLookupCache.set(ownershipCacheKey, ownership)
      }
      const ownershipSummary = buildOwnershipSummary(ownership)
      const ownershipCustomSummary = ownershipCustom
        ? [
            ownershipCustom.purchaseDate ? `Purchase date: ${ownershipCustom.purchaseDate}` : null,
            ownershipCustom.purchasePrice != null
              ? `Purchase price: $${ownershipCustom.purchasePrice.toLocaleString()}`
              : null,
            ownershipCustom.yearsOwned != null ? `Years owned: ${ownershipCustom.yearsOwned}` : null,
            ownershipCustom.marketValue != null
              ? `Market value: $${ownershipCustom.marketValue.toLocaleString()}`
              : null,
            ownershipCustom.propertyType ? `Property type: ${ownershipCustom.propertyType}` : null,
          ]
            .filter(Boolean)
            .join(' | ')
        : null

      const suggestedUpdate = {}
      if (!existingFirst && nameSuggestion.suggestedFirstName) suggestedUpdate.firstName = nameSuggestion.suggestedFirstName
      if (!existingLast && nameSuggestion.suggestedLastName) suggestedUpdate.lastName = nameSuggestion.suggestedLastName

      const nameUpdateAllowed = Object.keys(suggestedUpdate).length > 0 && !nameSuggestion.skipAutoUpdate
      const propertyFieldUpdate = buildPropertyFieldUpdate({
        person,
        ownedAddress,
        ownershipCustom,
        ownershipLookup: ownership,
      })
      const addressMerge = mergeFubAddresses(person.addresses, ownedAddress, mailingAddress)
      const hasPropertyFieldUpdate = Object.keys(propertyFieldUpdate).length > 0
      const hasAddressUpdate = addressMerge.changed
      const hasUpdate = nameUpdateAllowed || hasPropertyFieldUpdate || hasAddressUpdate
      const updateBody = {
        ...(nameUpdateAllowed ? suggestedUpdate : {}),
        ...(hasPropertyFieldUpdate ? propertyFieldUpdate : {}),
        ...(hasAddressUpdate ? { addresses: addressMerge.addresses } : {}),
      }
      let updateApplied = false
      let noteApplied = false
      let applyError = null

      const noteBodyLines = [
        'Ryan Realty profile enrichment snapshot',
        `Name: ${fullName || 'Unknown'}`,
        `Email: ${email || 'Unknown'}`,
        `Phone: ${primaryPhone(person) || 'Unknown'}`,
        `Owned home (from FUB fields): ${formatAddress(ownedAddress) || 'Unknown'}`,
        `Mailing address (from FUB fields): ${formatAddress(mailingAddress) || 'Unknown'}`,
        `Name normalization: ${nameSuggestion.reason} (${nameSuggestion.confidence})`,
      ]
      if (ownershipCustomSummary) noteBodyLines.push(`FUB ownership fields: ${ownershipCustomSummary}`)
      if (ownershipSummary) noteBodyLines.push(`Supabase ownership lookup: ${ownershipSummary}`)
      const publicLinks = buildPublicResearchLinks({
        fullName,
        city: ownedAddress?.city || mailingAddress?.city || null,
        address: formatAddress(ownedAddress),
      })
      if (publicLinks.facebookSearch) noteBodyLines.push(`Facebook search: ${publicLinks.facebookSearch}`)
      if (publicLinks.publicRecordsSearch) noteBodyLines.push(`Public records search: ${publicLinks.publicRecordsSearch}`)
      if (publicLinks.addressRecordsSearch) noteBodyLines.push(`Address records search: ${publicLinks.addressRecordsSearch}`)

      if (apply) {
        try {
          if (hasUpdate) {
            await updateFubPerson({ apiKey, personId: person.id, body: updateBody })
            updateApplied = true
          }
          if (writeNotes && hasUpdate) {
            await addFubNote({
              apiKey,
              personId: person.id,
              body: noteBodyLines.join('\n'),
            })
            noteApplied = true
          }
        } catch (error) {
          applyError = error instanceof Error ? error.message : String(error)
          errors.push({
            personId: person.id,
            error: applyError,
          })
        }
      }

      processed.push({
        personId: person.id,
        name: {
          original: nameValue || null,
          firstName: existingFirst,
          lastName: existingLast,
          suggestedFirstName: !existingFirst ? mergedFirst : null,
          suggestedLastName: !existingLast ? mergedLast : null,
        },
        contact: {
          email,
          phone: primaryPhone(person),
        },
        addresses: {
          ownedHome: ownedAddress ? { ...ownedAddress, formatted: formatAddress(ownedAddress) } : null,
          mailing: mailingAddress ? { ...mailingAddress, formatted: formatAddress(mailingAddress) } : null,
        },
        ownershipLookup: ownership,
        ownershipFromFubCustomFields: ownershipCustom,
        publicResearchLinks: publicLinks,
        suggestedUpdate,
        propertyFieldUpdate,
        addressUpdateApplied: hasAddressUpdate,
        nameSuggestion,
        updateApplied,
        noteApplied,
        error: applyError,
      })

      if (remaining > 0) remaining -= 1
      if (!personId && remaining === 0) break

      if (processed.length % 100 === 0) {
        console.log(
          `[fub-enrich] Progress: processed=${processed.length} ownershipLookups=${ownershipLookupsExecuted}/${maxOwnershipLookups}`
        )
      }
    }

    if (personId) break
    if (pageNextLink) {
      nextLink = pageNextLink
      continue
    }
    if (!nextOffset) break
    offset = nextOffset
    nextLink = null
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    mode: apply ? 'apply' : 'dry_run',
    input: {
      limit,
      offset: offsetStart,
      batchSize,
      personId: personId || null,
      writeNotes,
      maxOwnershipLookups,
      enableSupabaseOwnershipLookup,
    },
    totals: {
      processed: processed.length,
      nameFixesSuggested: processed.filter(
        (row) => (row.suggestedUpdate.firstName || row.suggestedUpdate.lastName) && !row.nameSuggestion.skipAutoUpdate
      ).length,
      nameFixesDeferredForReview: processed.filter(
        (row) => (row.suggestedUpdate.firstName || row.suggestedUpdate.lastName) && row.nameSuggestion.skipAutoUpdate
      ).length,
      propertyFieldUpdatesSuggested: processed.filter((row) => Object.keys(row.propertyFieldUpdate ?? {}).length > 0).length,
      addressUpdatesSuggested: processed.filter((row) => row.addressUpdateApplied).length,
      ownershipMatched: processed.filter((row) => row.ownershipLookup != null).length,
      updatesApplied: processed.filter((row) => row.updateApplied).length,
      notesApplied: processed.filter((row) => row.noteApplied).length,
      ownershipLookupsExecuted,
      errors: errors.length,
    },
    errors,
    contacts: processed,
  }

  await mkdir(dirname(reportPath), { recursive: true })
  await writeFile(reportPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8')

  console.log('[fub-enrich] Complete.')
  console.log(`[fub-enrich] Contacts processed: ${summary.totals.processed}`)
  console.log(`[fub-enrich] Name fixes suggested: ${summary.totals.nameFixesSuggested}`)
  console.log(`[fub-enrich] Name fixes deferred for review: ${summary.totals.nameFixesDeferredForReview}`)
  console.log(`[fub-enrich] Property field updates suggested: ${summary.totals.propertyFieldUpdatesSuggested}`)
  console.log(`[fub-enrich] Address updates suggested: ${summary.totals.addressUpdatesSuggested}`)
  console.log(`[fub-enrich] Ownership matches from Supabase: ${summary.totals.ownershipMatched}`)
  console.log(`[fub-enrich] Updates applied: ${summary.totals.updatesApplied}`)
  console.log(`[fub-enrich] Notes applied: ${summary.totals.notesApplied}`)
  if (summary.totals.errors > 0) {
    console.log(`[fub-enrich] Errors: ${summary.totals.errors}`)
  }
  console.log(`[fub-enrich] Report: ${reportPath}`)
}

main().catch((error) => {
  console.error(`[fub-enrich] Fatal: ${error instanceof Error ? error.message : String(error)}`)
  process.exit(1)
})
