/**
 * G2 Imagine produce: listing i2v or GBP still, then a draft on Today.
 *
 * D10: Grok Imagine only (lib/grok-image.ts / lib/grok-video.ts). Listing
 * motion is i2v of the real MLS photo. Temp xAI URLs are downloaded into
 * our storage before the row flips to ready. humanApprovedAt stays null.
 * This module writes a draft. It does not post.
 */
import { checkBrandVoice } from '@/lib/voice/check'
import type { ImageToVideoOptions } from '@/lib/grok-video'
import type { GrokImageOptions } from '@/lib/grok-image'
import type { MarketPulse } from '@/lib/data/types/market'

export type LiveListingForImagine = {
  listingKey: string
  listNumber: string | null
  address: string
  city: string
  listPrice: number | null
  photoUrl: string
  bedrooms: number | null
  bathrooms: number | null
}

export const LISTING_I2V_PROMPT =
  'Slow push on this exact photograph. Do not add objects, people, text, or a logo. Do not change the house.'

export const GBP_STILL_PROMPT =
  'Central Oregon high desert and Cascade foothills. Landscape only. No text. No houses. No people. No logo.'

const TEMP_HOST = /(?:^|\.)x\.ai(?:\/|$)|fal\.ai|replicate\.com|kling|hailuo|synthesia/i

export function isTempImagineUrl(url: string): boolean {
  return TEMP_HOST.test(url)
}

function usd(n: number): string {
  return `$${Math.round(n).toLocaleString('en-US')}`
}

export function listingDraftCaption(listing: {
  address: string
  city: string
  listPrice: number | null
}): string {
  const place = [listing.address, listing.city].filter(Boolean).join(', ')
  if (listing.listPrice != null && Number.isFinite(listing.listPrice)) {
    return `${place}. Listed at ${usd(listing.listPrice)}.`
  }
  return `${place}.`
}

export function gbpDraftCaption(pulse: {
  activeCount: number | null
  medianListPrice: number | null
  closedLast30Days: number
  monthsOfSupply: number | null
}): string {
  const parts =
    pulse.activeCount != null
      ? [`Central Oregon. ${pulse.activeCount} active listings.`]
      : ['Central Oregon.']
  if (pulse.medianListPrice != null && Number.isFinite(pulse.medianListPrice)) {
    parts.push(`Median list ${usd(pulse.medianListPrice)}.`)
  }
  parts.push(`${pulse.closedLast30Days} closed in 30 days.`)
  if (pulse.monthsOfSupply != null && Number.isFinite(pulse.monthsOfSupply)) {
    parts.push(`${pulse.monthsOfSupply} months of supply.`)
  }
  parts.push('Value my home.')
  return parts.join(' ')
}

export type ImagineProduceKind = 'listing' | 'gbp'

export type ProduceImagineInput = {
  kind: ImagineProduceKind
  query?: string
  brokerSlug: string
  requestedBy: string
}

export type ProduceImagineResult =
  | { ok: true; draftId: string; storedMediaUrl: string; caption: string }
  | { ok: false; error: string }

export type ImagineProduceAdapters = {
  generateImageToVideo: (options: ImageToVideoOptions) => Promise<string>
  generateBannerImage: (options: GrokImageOptions) => Promise<Buffer>
  downloadUrl: (url: string) => Promise<Buffer>
  storeMedia: (input: {
    actionId: string
    filename: string
    body: Buffer
    contentType: string
  }) => Promise<{ ok: true; url: string } | { ok: false; error: string }>
  findLiveListing: (query: string) => Promise<LiveListingForImagine | null>
  getPulse: () => Promise<MarketPulse | null>
  insertPending: (input: {
    actionType: string
    target: string
    topic: string
    format: string
    brokerSlug: string
    requestedBy: string
    payload: Record<string, unknown>
  }) => Promise<{ ok: true; id: string } | { ok: false; error: string }>
  markReady: (input: {
    id: string
    executorResponse: Record<string, unknown>
    payloadPatch?: Record<string, unknown>
  }) => Promise<{ ok: true } | { ok: false; error: string }>
  killDraft: (id: string, reason: string) => Promise<unknown>
}

function voiceOrError(caption: string): string | null {
  const voice = checkBrandVoice(caption)
  if (voice.ok) return null
  const terms = voice.violations.map((v) => v.term).join(', ')
  return `Caption failed voice: ${terms}`
}

function publishPayload(opts: {
  platforms: string[]
  mediaType: 'reel' | 'image'
  mediaUrl: string
  caption: string
}): Record<string, unknown> {
  return {
    approved: false,
    platforms: opts.platforms,
    mediaType: opts.mediaType,
    mediaUrl: opts.mediaUrl,
    caption: opts.caption,
    gate: { humanApprovedAt: null },
  }
}

async function finishReady(
  adapters: ImagineProduceAdapters,
  draftId: string,
  opts: {
    storedUrl: string
    caption: string
    mediaType: 'video' | 'image'
    platforms: string[]
    publishMediaType: 'reel' | 'image'
    sourcePhotoUrl?: string
    headline: string
  },
): Promise<ProduceImagineResult> {
  if (isTempImagineUrl(opts.storedUrl)) {
    await adapters.killDraft(draftId, 'stored media was still a temp Imagine URL')
    return { ok: false, error: 'Stored media is still a temp Imagine URL.' }
  }
  const executorResponse = {
    preview_url: opts.storedUrl,
    draft_path: opts.storedUrl,
    media_type: opts.mediaType,
    caption_map: { default: opts.caption },
    source_photo_url: opts.sourcePhotoUrl ?? null,
    publish_payload: publishPayload({
      platforms: opts.platforms,
      mediaType: opts.publishMediaType,
      mediaUrl: opts.storedUrl,
      caption: opts.caption,
    }),
  }
  const marked = await adapters.markReady({
    id: draftId,
    executorResponse,
    payloadPatch: {
      headline: opts.headline,
      captions: { default: opts.caption },
      stored_media_url: opts.storedUrl,
      humanApprovedAt: null,
    },
  })
  if (!marked.ok) {
    await adapters.killDraft(draftId, marked.error)
    return { ok: false, error: marked.error }
  }
  return { ok: true, draftId, storedMediaUrl: opts.storedUrl, caption: opts.caption }
}

async function produceListing(
  input: ProduceImagineInput,
  adapters: ImagineProduceAdapters,
): Promise<ProduceImagineResult> {
  const query = input.query?.trim() ?? ''
  if (!query) return { ok: false, error: 'Name a live listing (MLS number or street address).' }
  const listing = await adapters.findLiveListing(query)
  if (!listing) return { ok: false, error: 'No live listing with a photo matched that name.' }

  const caption = listingDraftCaption(listing)
  const voiceErr = voiceOrError(caption)
  if (voiceErr) return { ok: false, error: voiceErr }

  const target = listing.listNumber ? `mls:${listing.listNumber}` : `key:${listing.listingKey}`
  const inserted = await adapters.insertPending({
    actionType: 'content:imagine_listing',
    target,
    topic: listing.address || target,
    format: 'imagine_listing',
    brokerSlug: input.brokerSlug,
    requestedBy: input.requestedBy,
    payload: {
      kind: 'listing',
      listing_key: listing.listingKey,
      source_photo_url: listing.photoUrl,
      generation_reason: 'Broker named a listing on Today',
      humanApprovedAt: null,
    },
  })
  if (!inserted.ok) return { ok: false, error: inserted.error }

  try {
    const tempUrl = await adapters.generateImageToVideo({
      image_url: listing.photoUrl,
      prompt: LISTING_I2V_PROMPT,
      duration: 5,
      resolution: '480p',
    })
    const body = await adapters.downloadUrl(tempUrl)
    const stored = await adapters.storeMedia({
      actionId: inserted.id,
      filename: 'clip.mp4',
      body,
      contentType: 'video/mp4',
    })
    if (!stored.ok) {
      await adapters.killDraft(inserted.id, stored.error)
      return { ok: false, error: stored.error }
    }
    return finishReady(adapters, inserted.id, {
      storedUrl: stored.url,
      caption,
      mediaType: 'video',
      platforms: ['instagram'],
      publishMediaType: 'reel',
      sourcePhotoUrl: listing.photoUrl,
      headline: listingDraftCaption(listing).replace(/\.$/, ''),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Imagine listing produce failed'
    await adapters.killDraft(inserted.id, message)
    return { ok: false, error: message }
  }
}

async function produceGbp(
  input: ProduceImagineInput,
  adapters: ImagineProduceAdapters,
): Promise<ProduceImagineResult> {
  const pulse = await adapters.getPulse()
  if (!pulse) return { ok: false, error: 'No live market pulse for Central Oregon.' }

  const caption = gbpDraftCaption(pulse)
  const voiceErr = voiceOrError(caption)
  if (voiceErr) return { ok: false, error: voiceErr }

  const inserted = await adapters.insertPending({
    actionType: 'content:imagine_gbp',
    target: 'gbp:central-oregon',
    topic: 'GBP market update',
    format: 'imagine_gbp',
    brokerSlug: input.brokerSlug,
    requestedBy: input.requestedBy,
    payload: {
      kind: 'gbp',
      geo_type: pulse.geoType,
      geo_slug: pulse.geoSlug,
      generation_reason: 'Broker asked for a GBP market update on Today',
      humanApprovedAt: null,
    },
  })
  if (!inserted.ok) return { ok: false, error: inserted.error }

  try {
    const still = await adapters.generateBannerImage({
      prompt: GBP_STILL_PROMPT,
      aspect_ratio: '16:9',
    })
    const stored = await adapters.storeMedia({
      actionId: inserted.id,
      filename: 'still.jpg',
      body: still,
      contentType: 'image/jpeg',
    })
    if (!stored.ok) {
      await adapters.killDraft(inserted.id, stored.error)
      return { ok: false, error: stored.error }
    }
    return finishReady(adapters, inserted.id, {
      storedUrl: stored.url,
      caption,
      mediaType: 'image',
      platforms: ['google_business_profile'],
      publishMediaType: 'image',
      headline: 'GBP market update',
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Imagine GBP produce failed'
    await adapters.killDraft(inserted.id, message)
    return { ok: false, error: message }
  }
}

/** Name a listing or request a GBP market update. Writes a ready draft. Does not post. */
export async function produceImagineDraft(
  input: ProduceImagineInput,
  adapters: ImagineProduceAdapters,
): Promise<ProduceImagineResult> {
  if (input.kind === 'gbp') return produceGbp(input, adapters)
  return produceListing(input, adapters)
}
