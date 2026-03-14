/**
 * Spark API (RESO OData) client for data sync.
 * Section 7.1–7.2, Appendix A. Base URL from SPARK_API_BASE_URL, Bearer token from SPARK_API_KEY.
 */

import * as Sentry from '@sentry/nextjs'

const BASE = (process.env.SPARK_API_BASE_URL ?? '').replace(/\/$/, '') || 'https://sparkapi.com/Reso/OData'
const PROPERTY_PATH = '/Property'

function getApiKey(): string {
  const key = process.env.SPARK_API_KEY?.trim()
  if (!key) throw new Error('SPARK_API_KEY is not set')
  return key
}

/** Appendix A: Spark API field names (IDX + non-IDX). Used for $select and typing. */
export interface SparkListing {
  ListingKey?: string
  ListingId?: string
  OriginatingSystemKey?: string
  OriginatingSystemName?: string
  SourceSystemKey?: string
  SourceSystemName?: string
  StandardStatus?: string
  MlsStatus?: string
  StatusChangeTimestamp?: string
  ListingContractDate?: string
  OnMarketDate?: string
  CloseDate?: string
  PriceChangeTimestamp?: string
  ListPrice?: number
  OriginalListPrice?: number
  ClosePrice?: number
  PropertyType?: string
  PropertyTypeLabel?: string
  PropertySubType?: string
  BedsTotal?: number
  BathsFull?: number
  BathsHalf?: number
  BathroomsTotalInteger?: number
  LivingArea?: number
  BuildingAreaTotal?: number
  LotSizeAcres?: number
  LotSizeSquareFeet?: number
  LotSizeArea?: number
  LotSizeUnits?: string
  YearBuilt?: number
  Levels?: number
  GarageSpaces?: number
  AttachedGarageYN?: boolean
  NewConstructionYN?: boolean
  StreetNumber?: string
  StreetName?: string
  StreetSuffix?: string
  StreetDirPrefix?: string
  StreetDirSuffix?: string
  UnitNumber?: string
  UnparsedAddress?: string
  City?: string
  StateOrProvince?: string
  PostalCode?: string
  PostalCodePlus4?: string
  CountyOrParish?: string
  SubdivisionName?: string
  Latitude?: number
  Longitude?: number
  ParcelNumber?: string
  PublicRemarks?: string
  Directions?: string
  ArchitecturalStyle?: string
  ConstructionMaterials?: string
  Roof?: string
  FoundationDetails?: string
  Flooring?: string
  Heating?: string
  HeatingYN?: boolean
  Cooling?: string
  CoolingYN?: boolean
  FireplaceFeatures?: string
  FireplaceYN?: boolean
  InteriorFeatures?: string
  ExteriorFeatures?: string
  KitchenAppliances?: string
  PatioAndPorchFeatures?: string
  ParkingFeatures?: string
  LotFeatures?: string
  PoolFeatures?: string
  View?: string
  WaterFrontYN?: boolean
  WaterfrontFeatures?: string
  WaterSource?: string
  Sewer?: string
  WindowFeatures?: string
  AccessibilityFeatures?: string
  SeniorCommunityYN?: boolean
  AssociationYN?: boolean
  AssociationFee?: number
  AssociationFeeFrequency?: string
  AssociationAmenities?: string
  TaxAmount?: number
  TaxYear?: number
  ElementarySchool?: string
  MiddleOrJuniorSchool?: string
  HighSchool?: string
  PhotosCount?: number
  PhotosChangeTimestamp?: string
  VirtualTourURLUnbranded?: string
  ListAgentName?: string
  ListAgentFirstName?: string
  ListAgentLastName?: string
  ListAgentMlsId?: string
  ListAgentStateLicense?: string
  ListAgentEmail?: string
  ListOfficeName?: string
  ListOfficeMlsId?: string
  ListOfficePhone?: string
  CoListAgentName?: string
  CoListAgentMlsId?: string
  CoListOfficeName?: string
  CoListOfficeMlsId?: string
  BuyerAgentName?: string
  BuyerAgentFirstName?: string
  BuyerAgentLastName?: string
  BuyerAgentMlsId?: string
  BuyerOfficeName?: string
  BuyerOfficeMlsId?: string
  CoBuyerAgentName?: string
  CoBuyerAgentMlsId?: string
  ModificationTimestamp?: string
  ListingUpdateTimestamp?: string
  OriginalEntryTimestamp?: string
  PermitInternetYN?: boolean
  VOWAddressDisplayYN?: boolean
  VOWAutomatedValuationDisplayYN?: boolean
  VOWConsumerCommentYN?: boolean
  DaysOnMarket?: number
  CumulativeDaysOnMarket?: number
  Media?: SparkMediaItem[]
  [key: string]: unknown
}

export interface SparkMediaItem {
  MediaCategory?: string
  Order?: number
  MediaURL?: string
  ResourceRecordKey?: string
  [key: string]: unknown
}

export interface FetchListingsParams {
  top?: number
  filter?: string
  select?: string
  expand?: string
  orderby?: string
  nextUrl?: string
}

export interface FetchListingsResult {
  records: SparkListing[]
  nextUrl: string | null
  totalCount: number | null
}

const RATE_LIMIT_RETRY_MS = 60_000

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  retried = false
): Promise<Response> {
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
      Accept: 'application/json',
      ...options.headers,
    },
    next: { revalidate: 0 },
  })
  if (res.status === 429 && !retried) {
    console.warn('[spark-odata] HTTP 429 rate limited; waiting 60s then retrying once')
    await new Promise((r) => setTimeout(r, RATE_LIMIT_RETRY_MS))
    return fetchWithRetry(url, options, true)
  }
  return res
}

/**
 * Fetch a page of listings from Spark OData Property endpoint.
 * If nextUrl is provided, fetches that URL directly; otherwise builds query with $top, $filter, $select, $expand.
 */
export async function fetchListings(params: FetchListingsParams): Promise<FetchListingsResult> {
  const { top = 1000, filter, select, expand, orderby, nextUrl } = params
  let url: string
  if (nextUrl) {
    url = nextUrl
  } else {
    const search = new URLSearchParams()
    search.set('$top', String(top))
    if (filter) search.set('$filter', filter)
    if (select) search.set('$select', select)
    if (expand) search.set('$expand', expand)
    if (orderby) search.set('$orderby', orderby)
    search.set('$count', 'true')
    url = `${BASE}${PROPERTY_PATH}?${search.toString()}`
  }

  try {
    const res = await fetchWithRetry(url, { method: 'GET' })
    if (res.status === 404) {
      return { records: [], nextUrl: null, totalCount: 0 }
    }
    if (!res.ok) {
      const text = await res.text()
      const err = new Error(`Spark API error ${res.status}: ${text.slice(0, 500)}`)
      Sentry.captureException(err, { extra: { url: url.slice(0, 200), status: res.status } })
      throw err
    }
    const data = (await res.json()) as {
      value?: SparkListing[]
      '@odata.nextLink'?: string
      '@odata.count'?: number
    }
    const records = Array.isArray(data.value) ? data.value : []
    const next = data['@odata.nextLink'] ?? null
    const totalCount = data['@odata.count'] ?? null
    return { records, nextUrl: next, totalCount }
  } catch (e) {
    Sentry.captureException(e, { extra: { url: url.slice(0, 200) } })
    throw e
  }
}

/**
 * Fetch a single listing by ListingKey with ALL fields (including non-IDX).
 * No $select so response includes ClosePrice, CloseDate, OriginalListPrice, etc.
 */
export async function fetchSingleListing(listingKey: string): Promise<SparkListing | null> {
  const key = encodeURIComponent(listingKey)
  const url = `${BASE}${PROPERTY_PATH}(${key})?$expand=Media`
  try {
    const res = await fetchWithRetry(url, { method: 'GET' })
    if (res.status === 404) return null
    if (!res.ok) {
      const text = await res.text()
      Sentry.captureException(new Error(`Spark single listing ${res.status}: ${text.slice(0, 300)}`), {
        extra: { listingKey },
      })
      throw new Error(`Spark API error ${res.status}: ${text.slice(0, 300)}`)
    }
    const data = (await res.json()) as SparkListing
    return data
  } catch (e) {
    Sentry.captureException(e, { extra: { listingKey } })
    throw e
  }
}

/** Default $select for initial sync: all 121 IDX fields from Appendix A (comma-separated). */
export const SPARK_SELECT_FIELDS =
  'ListingKey,ListingId,StandardStatus,MlsStatus,ListPrice,ClosePrice,BedsTotal,BathsFull,BathsHalf,BathroomsTotalInteger,LivingArea,LotSizeAcres,LotSizeSquareFeet,YearBuilt,SubdivisionName,PublicRemarks,UnparsedAddress,City,StateOrProvince,PostalCode,StreetNumber,StreetName,StreetSuffix,Latitude,Longitude,ModificationTimestamp,StatusChangeTimestamp,PriceChangeTimestamp,ListingContractDate,OnMarketDate,CloseDate,ListAgentName,ListAgentMlsId,ListOfficeName,ListOfficeMlsId,PhotosCount,VirtualTourURLUnbranded,VOWAutomatedValuationDisplayYN,ElementarySchool,MiddleOrJuniorSchool,HighSchool,PropertyType,PropertySubType,Levels,GarageSpaces,NewConstructionYN,SeniorCommunityYN,AssociationYN,AssociationFee,AssociationFeeFrequency,TaxAmount,View,WaterFrontYN,WaterSource,Sewer,FireplaceYN,FireplaceFeatures,PoolFeatures'
