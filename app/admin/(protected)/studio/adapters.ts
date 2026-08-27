/**
 * lib/studio bindings for the real world.
 *
 * Deliberately NOT a 'use server' module: that directive restricts a file to
 * async exports only, and this factory is synchronous. Keeping it separate
 * also lets the slate cron import the exact same wiring Matt's button uses,
 * so there is one code path to trust rather than two that can drift.
 */
import 'server-only'
import { generateGrokImages } from '@/lib/grok/image'
import { generateGrokVideo } from '@/lib/grok/video'
import { inspectFrame } from '@/lib/grok/vision'
import { gradePhoto } from '@/lib/grok/classify'
import { concatMp4 } from '@/lib/video/concat'
import { getListingPhotos } from '@/lib/data/studio/listing-photos'
import { GROK_MODELS } from '@/lib/grok/client'
import type { GrokAspect } from '@/lib/grok/image'
import type { GrokVideoAspect } from '@/lib/grok/video'
import { writeCaption } from '@/lib/studio/caption'
import type { StudioAdapters } from '@/lib/studio/produce'
import {
  insertStudioDraft,
  killStudioDraft,
  markStudioDraftReady,
  storeStudioMedia,
} from '@/lib/data/studio/drafts'
import { resolveStudioSubject } from '@/lib/data/studio/subjects'

/** Generator output URLs expire, so every byte is pulled through here. */
async function downloadUrl(url: string): Promise<Buffer> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Could not download generated media: ${res.status}`)
  return Buffer.from(await res.arrayBuffer())
}

/** The one place the real Grok and the real DAL are bound to the pipeline. */
export function studioAdapters(): StudioAdapters {
  return {
    resolveSubject: resolveStudioSubject,
    getPhotos: (listingKey) => getListingPhotos(listingKey, { limit: 24 }),
    gradePhoto: ({ imageUrl }) => gradePhoto({ imageUrl }),
    concat: concatMp4,
    generateStills: async ({ prompt, aspectRatio, n }) => {
      const result = await generateGrokImages({
        prompt,
        aspectRatio: aspectRatio as GrokAspect,
        resolution: '2k',
        n,
      })
      return { images: result.images, model: result.model, costTicks: null }
    },
    inspectFrame: ({ image, intent, alsoReject }) => inspectFrame({ image, intent, alsoReject }),
    animate: async ({ prompt, imageUrl, aspectRatio, seconds }) => {
      const clip = await generateGrokVideo({
        prompt,
        image: { url: imageUrl },
        aspectRatio: aspectRatio as GrokVideoAspect,
        resolution: '1080p',
        duration: seconds,
        // Never on for a brokerage feed unless a human chose the bed.
        generateAudio: false,
        model: GROK_MODELS.video,
      })
      return {
        url: clip.url,
        model: clip.model,
        durationSeconds: clip.durationSeconds,
        costTicks: null,
      }
    },
    writeCaption,
    downloadUrl,
    storeMedia: storeStudioMedia,
    insertPending: insertStudioDraft,
    markReady: markStudioDraftReady,
    killDraft: killStudioDraft,
  }
}
