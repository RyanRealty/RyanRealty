import type { SparkListingHistoryItem } from '@/lib/spark'
import { fetchSparkListingByKey } from '@/lib/spark'

type ListingContext = {
  listingKey: string
  photoUrl?: string | null
  details?: unknown
  listAgentName?: string | null
  listAgentFirstName?: string | null
  listAgentLastName?: string | null
  listOfficeName?: string | null
}

type SparkHydrationResult = {
  context: ListingContext
  hydratedFromSpark: boolean
}

function parseNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const n = Number(value.replace(/[^0-9.-]/g, ''))
    return Number.isFinite(n) ? n : null
  }
  return null
}

function normalizeTime(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const raw = value.trim()
  if (!raw) return null

  if (/^\d{2}:\d{2}(:\d{2})?$/.test(raw)) {
    return raw.length === 5 ? `${raw}:00` : raw
  }

  const match = raw.match(/^(\d{1,2}):(\d{2})\s*([AaPp][Mm])$/)
  if (!match) return null

  const hour12 = Number(match[1])
  const minute = Number(match[2])
  const meridiem = match[3].toLowerCase()
  if (!Number.isFinite(hour12) || !Number.isFinite(minute) || hour12 < 1 || hour12 > 12) return null
  let hour24 = hour12 % 12
  if (meridiem === 'pm') hour24 += 12
  return `${String(hour24).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`
}

function toIsoDate(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString()
}

type HistoryTables = {
  statusRows: Array<{ old_status: string | null; new_status: string | null; changed_at: string }>
  priceRows: Array<{ old_price: number | null; new_price: number | null; change_pct: number | null; changed_at: string }>
}

function buildHistoryTables(items: SparkListingHistoryItem[]): HistoryTables {
  const statusRows: HistoryTables['statusRows'] = []
  const priceRows: HistoryTables['priceRows'] = []

  for (const item of items) {
    const changedAt = toIsoDate(item.ModificationTimestamp ?? item.Date) ?? new Date().toISOString()
    const field = String(item.Field ?? '').toLowerCase()
    const oldValue = item.PreviousValue
    const newValue = item.NewValue

    if (field.includes('status')) {
      const oldStatus = oldValue == null ? null : String(oldValue)
      const newStatus = newValue == null ? null : String(newValue)
      if (oldStatus || newStatus) {
        statusRows.push({ old_status: oldStatus, new_status: newStatus, changed_at: changedAt })
      }
    }

    const explicitPriceField = field.includes('price')
    const oldPriceFromField = parseNumber(oldValue)
    const newPriceFromField = parseNumber(newValue)
    const priceAtEvent = parseNumber(item.PriceAtEvent ?? item.Price)
    const priceChange = parseNumber(item.PriceChange)

    let oldPrice: number | null = null
    let newPrice: number | null = null

    if (explicitPriceField && (oldPriceFromField != null || newPriceFromField != null)) {
      oldPrice = oldPriceFromField
      newPrice = newPriceFromField
    } else if (priceAtEvent != null && priceChange != null) {
      newPrice = priceAtEvent
      oldPrice = priceAtEvent - priceChange
    } else if (priceAtEvent != null) {
      newPrice = priceAtEvent
    }

    if (oldPrice != null || newPrice != null || priceChange != null) {
      const changePct =
        oldPrice != null && newPrice != null && oldPrice !== 0
          ? Math.round((((newPrice - oldPrice) / oldPrice) * 100) * 100) / 100
          : null
      priceRows.push({
        old_price: oldPrice,
        new_price: newPrice,
        change_pct: changePct,
        changed_at: changedAt,
      })
    }
  }

  return { statusRows, priceRows }
}

function contextFromSparkFields(listingKey: string, fields: Record<string, unknown>): ListingContext {
  const firstPhoto = Array.isArray(fields.Photos)
    ? (fields.Photos as Array<Record<string, unknown>>).find((p) => p.Primary === true) ??
      (fields.Photos as Array<Record<string, unknown>>)[0]
    : null
  const photoUrl =
    (typeof firstPhoto?.Uri1600 === 'string' && firstPhoto.Uri1600) ||
    (typeof firstPhoto?.Uri1280 === 'string' && firstPhoto.Uri1280) ||
    (typeof firstPhoto?.Uri1024 === 'string' && firstPhoto.Uri1024) ||
    (typeof firstPhoto?.Uri800 === 'string' && firstPhoto.Uri800) ||
    (typeof firstPhoto?.Uri640 === 'string' && firstPhoto.Uri640) ||
    (typeof firstPhoto?.Uri300 === 'string' && firstPhoto.Uri300) ||
    null
  const agentFirstName = typeof fields.ListAgentFirstName === 'string' ? fields.ListAgentFirstName : null
  const agentLastName = typeof fields.ListAgentLastName === 'string' ? fields.ListAgentLastName : null
  const fullAgentName = [agentFirstName, agentLastName].filter(Boolean).join(' ').trim()
  const listAgentName =
    fullAgentName ||
    (typeof fields.ListAgentName === 'string' ? fields.ListAgentName : null)

  return {
    listingKey,
    photoUrl,
    details: {
      ...fields,
      Photos: Array.isArray(fields.Photos) ? fields.Photos : [],
      FloorPlans: Array.isArray(fields.FloorPlans) ? fields.FloorPlans : [],
      Videos: Array.isArray(fields.Videos) ? fields.Videos : [],
      VirtualTours: Array.isArray(fields.VirtualTours) ? fields.VirtualTours : [],
      OpenHouses: Array.isArray(fields.OpenHouses) ? fields.OpenHouses : [],
      Documents: Array.isArray(fields.Documents) ? fields.Documents : [],
    },
    listAgentName,
    listAgentFirstName: agentFirstName,
    listAgentLastName: agentLastName,
    listOfficeName: typeof fields.ListOfficeName === 'string' ? fields.ListOfficeName : null,
  }
}

async function needsSparkHydration(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  context: ListingContext
): Promise<boolean> {
  const details = context.details && typeof context.details === 'object'
    ? (context.details as Record<string, unknown>)
    : {}
  const hasLocalPhotosArray = Array.isArray(details.Photos)
  const hasLocalVideosArray = Array.isArray(details.Videos)
  const hasLocalOpenHousesArray = Array.isArray(details.OpenHouses)
  const hasLocalAgentName = Boolean((context.listAgentName ?? '').trim())

  const [photosCount, videosCount, agentsCount, openHousesCount] = await Promise.all([
    supabase.from('listing_photos').select('id', { count: 'exact', head: true }).eq('listing_key', context.listingKey),
    supabase.from('listing_videos').select('id', { count: 'exact', head: true }).eq('listing_key', context.listingKey),
    supabase.from('listing_agents').select('id', { count: 'exact', head: true }).eq('listing_key', context.listingKey),
    supabase.from('open_houses').select('id', { count: 'exact', head: true }).eq('listing_key', context.listingKey),
  ])

  const existingPhotos = photosCount.count ?? 0
  const existingVideos = videosCount.count ?? 0
  const existingAgents = agentsCount.count ?? 0
  const existingOpenHouses = openHousesCount.count ?? 0

  const detailsMissingAnyArrays = !hasLocalPhotosArray || !hasLocalVideosArray || !hasLocalOpenHousesArray
  const listingMissingExistingAuxRows =
    existingPhotos === 0 ||
    existingVideos === 0 ||
    existingAgents === 0 ||
    existingOpenHouses === 0

  return detailsMissingAnyArrays || !hasLocalAgentName || listingMissingExistingAuxRows
}

async function hydrateContextFromSpark(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  context: ListingContext,
  accessToken?: string | null
): Promise<SparkHydrationResult> {
  const token = accessToken?.trim()
  if (!token) return { context, hydratedFromSpark: false }
  const shouldHydrate = await needsSparkHydration(supabase, context)
  if (!shouldHydrate) return { context, hydratedFromSpark: false }

  try {
    const response = await fetchSparkListingByKey(
      token,
      context.listingKey,
      'Photos,FloorPlans,Videos,VirtualTours,OpenHouses,Documents'
    )
    const fields = response?.D?.Results?.[0]?.StandardFields as Record<string, unknown> | undefined
    if (!fields) return { context, hydratedFromSpark: false }
    const hydratedContext = contextFromSparkFields(context.listingKey, fields)
    await supabase
      .from('listings')
      .update({
        details: hydratedContext.details ?? null,
        PhotoURL: hydratedContext.photoUrl ?? null,
        ListAgentName: hydratedContext.listAgentName ?? null,
        ListOfficeName: hydratedContext.listOfficeName ?? null,
      })
      .eq('ListingKey', context.listingKey)
    return {
      context: hydratedContext,
      hydratedFromSpark: true,
    }
  } catch {
    return { context, hydratedFromSpark: false }
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function syncAuxiliaryTablesForFinalization(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  context: ListingContext,
  historyItems: SparkListingHistoryItem[],
  options?: { accessToken?: string | null }
) {
  const hydrated = await hydrateContextFromSpark(supabase, context, options?.accessToken)
  const effectiveContext = hydrated.context
  const listingKey = effectiveContext.listingKey
  if (!listingKey) return { ok: false as const, error: 'Missing listing key' }

  const details = effectiveContext.details && typeof effectiveContext.details === 'object'
    ? (effectiveContext.details as Record<string, unknown>)
    : {}
  const photosRaw = Array.isArray(details.Photos) ? details.Photos : []
  const videosRaw = Array.isArray(details.Videos) ? details.Videos : []
  const openHousesRaw = Array.isArray(details.OpenHouses) ? details.OpenHouses : []

  const photos = photosRaw
    .map((item, index) => {
      const row = item as Record<string, unknown>
      const url =
        (typeof row.Uri1600 === 'string' && row.Uri1600) ||
        (typeof row.Uri1280 === 'string' && row.Uri1280) ||
        (typeof row.Uri1024 === 'string' && row.Uri1024) ||
        (typeof row.Uri800 === 'string' && row.Uri800) ||
        (typeof row.Uri640 === 'string' && row.Uri640) ||
        (typeof row.Uri300 === 'string' && row.Uri300) ||
        ''
      if (!url.trim()) return null
      return {
        listing_key: listingKey,
        photo_url: url.trim(),
        sort_order: Number.isFinite(Number(row.Order)) ? Number(row.Order) : index,
        is_hero: row.Primary === true || index === 0,
        source: 'spark',
      }
    })
    .filter((row) => row != null)

  if (photos.length === 0 && effectiveContext.photoUrl?.trim()) {
    photos.push({
      listing_key: listingKey,
      photo_url: effectiveContext.photoUrl.trim(),
      sort_order: 0,
      is_hero: true,
      source: 'spark',
    })
  }

  const videos = videosRaw
    .map((item, index) => {
      const row = item as Record<string, unknown>
      const url =
        (typeof row.Uri === 'string' && row.Uri) ||
        (typeof row.URL === 'string' && row.URL) ||
        (typeof row.Url === 'string' && row.Url) ||
        ''
      if (!url.trim()) return null
      return {
        listing_key: listingKey,
        video_url: url.trim(),
        sort_order: Number.isFinite(Number(row.Order)) ? Number(row.Order) : index,
        source: 'spark',
      }
    })
    .filter((row) => row != null)

  const openHouses = openHousesRaw
    .map((item, index) => {
      const row = item as Record<string, unknown>
      const dateIso = toIsoDate(row.Date)
      if (!dateIso) return null
      const eventDate = dateIso.slice(0, 10)
      const startTime = normalizeTime(row.StartTime)
      const endTime = normalizeTime(row.EndTime)
      const key = `${listingKey}:${eventDate}:${startTime ?? 'na'}:${index}`
      return {
        listing_key: listingKey,
        open_house_key: key,
        event_date: eventDate,
        start_time: startTime,
        end_time: endTime,
        host_agent_name: typeof row.AgentName === 'string' ? row.AgentName : null,
        remarks: typeof row.Remarks === 'string' ? row.Remarks : null,
      }
    })
    .filter((row) => row != null)

  const listAgentName = effectiveContext.listAgentName?.trim()
    || [effectiveContext.listAgentFirstName, effectiveContext.listAgentLastName].filter(Boolean).join(' ').trim()
  const agents = listAgentName
    ? [{
        listing_key: listingKey,
        agent_role: 'list',
        agent_name: listAgentName,
        agent_first_name: effectiveContext.listAgentFirstName ?? null,
        agent_last_name: effectiveContext.listAgentLastName ?? null,
        office_name: effectiveContext.listOfficeName ?? null,
      }]
    : []

  const { statusRows, priceRows } = buildHistoryTables(historyItems)

  try {
    const photosDelete = await supabase.from('listing_photos').delete().eq('listing_key', listingKey)
    if (photosDelete.error) return { ok: false as const, error: photosDelete.error.message }
    if (photos.length > 0) {
      const photosInsert = await supabase.from('listing_photos').insert(photos)
      if (photosInsert.error) return { ok: false as const, error: photosInsert.error.message }
    }

    const videosDelete = await supabase.from('listing_videos').delete().eq('listing_key', listingKey)
    if (videosDelete.error) return { ok: false as const, error: videosDelete.error.message }
    if (videos.length > 0) {
      const videosInsert = await supabase.from('listing_videos').insert(videos)
      if (videosInsert.error) return { ok: false as const, error: videosInsert.error.message }
    }

    const agentsDelete = await supabase.from('listing_agents').delete().eq('listing_key', listingKey)
    if (agentsDelete.error) return { ok: false as const, error: agentsDelete.error.message }
    if (agents.length > 0) {
      const agentsInsert = await supabase.from('listing_agents').insert(agents)
      if (agentsInsert.error) return { ok: false as const, error: agentsInsert.error.message }
    }

    const openHousesDelete = await supabase.from('open_houses').delete().eq('listing_key', listingKey)
    if (openHousesDelete.error) return { ok: false as const, error: openHousesDelete.error.message }
    if (openHouses.length > 0) {
      const openHousesInsert = await supabase.from('open_houses').insert(openHouses)
      if (openHousesInsert.error) return { ok: false as const, error: openHousesInsert.error.message }
    }

    const statusDelete = await supabase.from('status_history').delete().eq('listing_key', listingKey)
    if (statusDelete.error) return { ok: false as const, error: statusDelete.error.message }
    if (statusRows.length > 0) {
      const statusInsert = await supabase.from('status_history').insert(
        statusRows.map((row) => ({ listing_key: listingKey, ...row }))
      )
      if (statusInsert.error) return { ok: false as const, error: statusInsert.error.message }
    }

    const priceDelete = await supabase.from('price_history').delete().eq('listing_key', listingKey)
    if (priceDelete.error) return { ok: false as const, error: priceDelete.error.message }
    if (priceRows.length > 0) {
      const priceInsert = await supabase.from('price_history').insert(
        priceRows.map((row) => ({ listing_key: listingKey, ...row }))
      )
      if (priceInsert.error) return { ok: false as const, error: priceInsert.error.message }
    }

    return { ok: true as const, hydratedFromSpark: hydrated.hydratedFromSpark }
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : String(error),
      hydratedFromSpark: hydrated.hydratedFromSpark,
    }
  }
}
