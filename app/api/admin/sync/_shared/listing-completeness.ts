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
  context: ListingContext
): Promise<boolean> {
  const details = context.details && typeof context.details === 'object'
    ? (context.details as Record<string, unknown>)
    : {}
  const hasLocalPhotosArray = Array.isArray(details.Photos)
  const hasLocalVideosArray = Array.isArray(details.Videos)
  const hasLocalOpenHousesArray = Array.isArray(details.OpenHouses)
  const hasLocalAgentName = Boolean((context.listAgentName ?? '').trim())
  return !hasLocalPhotosArray || !hasLocalVideosArray || !hasLocalOpenHousesArray || !hasLocalAgentName
}

async function hydrateContextFromSpark(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  context: ListingContext,
  accessToken?: string | null
): Promise<SparkHydrationResult> {
  const token = accessToken?.trim()
  if (!token) return { context, hydratedFromSpark: false }
  const shouldHydrate = await needsSparkHydration(context)
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
  _historyItems: unknown[],
  options?: { accessToken?: string | null }
) {
  const hydrated = await hydrateContextFromSpark(supabase, context, options?.accessToken)
  const listingKey = hydrated.context.listingKey
  if (!listingKey) return { ok: false as const, error: 'Missing listing key' }
  return { ok: true as const, hydratedFromSpark: hydrated.hydratedFromSpark }
}
