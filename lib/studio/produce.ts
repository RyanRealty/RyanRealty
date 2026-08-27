/**
 * lib/studio/produce.ts — one pipeline, every format.
 *
 * Pure and adapter-injected so the whole thing is testable without touching
 * xAI or Supabase. The order of operations is the product:
 *
 *   1. resolve the subject and its VERIFIED figures, with citations
 *   2. open a pending row, so every byte and every dollar has an audit home
 *   3. build a hero still and inspect it, regenerating once on a fail
 *   4. store the still in our bucket (never an expiring generator URL)
 *   5. animate the approved still, if the format wants motion
 *   6. write the caption against the verified figures only
 *   7. mark ready, with citations, QA verdict, and spend attached
 *
 * The draft lands as `ready` with approval NOT stamped. Nothing here posts,
 * and nothing here can post: publishing needs a human approval on the row
 * (CLAUDE.md §1).
 *
 * A failure at any step kills the row with a reason rather than shipping a
 * degraded version. There is no template fallback anywhere in this file, on
 * purpose: a fallback is how slop reaches a feed.
 */
import type { StudioFormat, StudioFormatId } from './formats'
import { getStudioFormat, centralOregonPlate, listingShot } from './formats'
import { assertCraftClean, buildMotionPrompt, buildStillPrompt, type ShotSpec } from './craft'
import {
  addSpend,
  assertBudget,
  capForFormat,
  imageCost,
  newLedger,
  videoCost,
  SpendCapError,
  TEXT_CALL_USD,
  VISION_CALL_USD,
  type SpendLedger,
} from './spend'
import { writeCaption, type CaptionRequest } from './caption'
import { GRADE_BUDGET, planListingFilm, renderListingFilm, type FilmAdapters, type FilmPlan } from './film'
import type { PlannedShot } from './shotlist'
import type { VisionVerdict } from '@/lib/grok/vision'

/** How many candidate stills we generate per attempt. */
const CANDIDATES = 2
/** One regeneration after a failed inspection, then we stop. */
const MAX_FRAME_ATTEMPTS = 2

export type StudioSubject = {
  /** Human label for the draft row. */
  label: string
  /** Figures the caption may use, already formatted. */
  figures: Record<string, string>
  /** §0 trace, one entry per figure. */
  citations: Array<Record<string, unknown>>
  /** Place name for the shot spec, when the format has one. */
  place?: string
  /** Real photograph to animate, for listing formats. */
  sourcePhotoUrl?: string
  /** Listing key, when the format builds a sequence from the whole photo set. */
  photoSetKey?: string
  /** Live context for tone. Never a figure source. */
  context?: string
  /** Where a click should land. */
  ctaUrl?: string
}

export type StudioProduceInput = {
  formatId: StudioFormatId
  subjectQuery?: string
  brokerSlug: string
  requestedBy: string
  /** 'slate' for the morning cron, 'console' when Matt asked for it. */
  origin: 'slate' | 'console'
}

export type StudioProduceResult =
  | {
      ok: true
      draftId: string
      mediaUrl: string
      posterUrl: string
      caption: string
      spendUsd: number
      qa: VisionVerdict | null
    }
  | { ok: false; error: string; draftId?: string }

export type StudioAdapters = FilmAdapters & {
  /** Resolve the subject and its verified figures. Null when nothing qualifies. */
  resolveSubject: (format: StudioFormat, query: string | undefined) => Promise<StudioSubject | null>
  generateStills: (input: {
    prompt: string
    aspectRatio: string
    n: number
  }) => Promise<{ images: Buffer[]; model: string; costTicks: number | null }>
  inspectFrame: (input: {
    image: Buffer
    intent: string
    alsoReject: string[]
  }) => Promise<VisionVerdict>
  writeCaption: typeof writeCaption
  storeMedia: (input: {
    draftId: string
    filename: string
    body: Buffer
    contentType: string
  }) => Promise<{ ok: true; url: string } | { ok: false; error: string }>
  insertPending: (input: {
    formatId: StudioFormatId
    label: string
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

function shotFor(format: StudioFormat, subject: StudioSubject): ShotSpec {
  if (format.frameSource === 'mls_photo') return listingShot()
  return centralOregonPlate({
    timeOfDay: 'golden hour',
    place: subject.place,
  })
}

/**
 * Generate candidates, inspect each, return the best passing frame.
 * Regenerates once using the inspector's own fix hint. Returns null when
 * nothing passes, which kills the draft.
 */
async function buildHeroFrame(
  format: StudioFormat,
  spec: ShotSpec,
  adapters: StudioAdapters,
  ledger: SpendLedger,
): Promise<{ image: Buffer; verdict: VisionVerdict } | null> {
  let prompt = buildStillPrompt(spec)
  assertCraftClean(prompt, `${format.id} still prompt`)
  const intent = `${format.label}: ${spec.subject}`
  let best: { image: Buffer; verdict: VisionVerdict } | null = null

  for (let attempt = 1; attempt <= MAX_FRAME_ATTEMPTS; attempt += 1) {
    assertBudget(ledger, imageCost('grok-imagine-image-2.0', CANDIDATES), 'still generation')
    const stills = await adapters.generateStills({
      prompt,
      aspectRatio: format.stillAspect,
      n: CANDIDATES,
    })
    addSpend(ledger, {
      step: `stills x${stills.images.length} (attempt ${attempt})`,
      usd: imageCost(stills.model, stills.images.length),
      ticks: stills.costTicks,
    })

    for (const image of stills.images) {
      assertBudget(ledger, VISION_CALL_USD, 'frame inspection')
      const verdict = await adapters.inspectFrame({
        image,
        intent,
        alsoReject: format.alsoReject,
      })
      addSpend(ledger, { step: 'vision QA', usd: VISION_CALL_USD, ticks: null })
      if (verdict.pass) return { image, verdict }
      if (!best || verdict.score > best.verdict.score) best = { image, verdict }
    }

    if (best?.verdict.fixHint) {
      // The inspector's own note becomes the next prompt's correction. This
      // is the only place a prompt is modified after being built.
      prompt = `${buildStillPrompt(spec)} ${best.verdict.fixHint}`
      assertCraftClean(prompt, `${format.id} still prompt (retry)`)
    }
  }

  return null
}

/** Produce one draft. Never posts. Never falls back to a template. */
export async function produceStudioDraft(
  input: StudioProduceInput,
  adapters: StudioAdapters,
): Promise<StudioProduceResult> {
  const format = getStudioFormat(input.formatId)
  if (!format) return { ok: false, error: `Unknown format: ${input.formatId}` }
  if (format.subject !== 'none' && !input.subjectQuery?.trim()) {
    return { ok: false, error: `${format.label} needs a ${format.subject}.` }
  }

  const shots = format.shots ?? 1
  const ledger = newLedger(
    capForFormat({
      shots,
      seconds: format.seconds,
      gradedPhotos: shots > 1 ? GRADE_BUDGET : 0,
    }),
  )
  let draftId: string | undefined

  try {
    const subject = await adapters.resolveSubject(format, input.subjectQuery)
    if (!subject) {
      return { ok: false, error: `Nothing matched "${input.subjectQuery ?? ''}" for ${format.label}.` }
    }
    if (format.carriesFigures && subject.citations.length === 0) {
      return { ok: false, error: `${format.label} carries figures but produced no citations. No trace, no ship.` }
    }
    if (format.frameSource === 'mls_photo' && !subject.sourcePhotoUrl) {
      return { ok: false, error: 'That listing has no usable photo.' }
    }

    const pending = await adapters.insertPending({
      formatId: format.id,
      label: subject.label,
      brokerSlug: input.brokerSlug,
      requestedBy: input.requestedBy,
      payload: {
        origin: input.origin,
        subject_query: input.subjectQuery ?? null,
        figures: subject.figures,
        platforms: format.platforms,
      },
    })
    if (!pending.ok) return { ok: false, error: pending.error }
    draftId = pending.id

    const spec = shotFor(format, subject)

    // ── hero frame ─────────────────────────────────────────────────────────
    let posterUrl: string
    let qa: VisionVerdict | null = null

    // A film plans its sequence here, in place of a single hero frame. The
    // plan is cheap (grading only) and its description feeds the caption, so
    // the expensive beats are not rendered until the words have passed.
    let filmPlan: FilmPlan | null = null
    const wantsFilm = (format.shots ?? 1) > 1 && Boolean(subject.photoSetKey)

    if (wantsFilm) {
      const planned = await planListingFilm(
        {
          listingKey: subject.photoSetKey as string,
          maxShots: format.shots ?? 4,
          secondsPerShot: format.seconds,
        },
        adapters,
        ledger,
      )
      if (!planned.ok) {
        await adapters.killDraft(draftId, planned.error)
        return { ok: false, error: planned.error, draftId }
      }
      filmPlan = planned.plan
      posterUrl = planned.plan.posterUrl
    } else if (format.frameSource === 'mls_photo') {
      // A real photograph of a real property. Nothing to generate, nothing
      // to inspect, and nothing we are allowed to restyle.
      posterUrl = subject.sourcePhotoUrl as string
    } else {
      const hero = await buildHeroFrame(format, spec, adapters, ledger)
      if (!hero) {
        await adapters.killDraft(draftId, 'No generated frame passed inspection after two attempts.')
        return { ok: false, error: 'No frame passed inspection. Nothing shipped.', draftId }
      }
      qa = hero.verdict
      const stored = await adapters.storeMedia({
        draftId,
        filename: 'hero.jpg',
        body: hero.image,
        contentType: 'image/jpeg',
      })
      if (!stored.ok) {
        await adapters.killDraft(draftId, `Could not store hero frame: ${stored.error}`)
        return { ok: false, error: stored.error, draftId }
      }
      posterUrl = stored.url
    }

    // ── caption ────────────────────────────────────────────────────────────
    // Before motion, deliberately. The caption gate kills roughly as often as
    // the frame gate does, and a caption failure after animating throws away
    // a finished $0.48 clip. The frame has already passed inspection, so its
    // description is available; nothing here needs the video to exist.
    const captionRequest: CaptionRequest = {
      subject: subject.label,
      figures: subject.figures,
      context: subject.context,
      platforms: format.platforms,
      cta: subject.ctaUrl ? `Details at ${subject.ctaUrl}` : undefined,
      mediaDescription:
        filmPlan?.describes ||
        qa?.describes ||
        (format.frameSource === 'mls_photo'
          ? `A photograph of the home at ${subject.label}, with a slow push in.`
          : undefined),
    }
    assertBudget(ledger, TEXT_CALL_USD, 'caption')
    const caption = await adapters.writeCaption(captionRequest)
    addSpend(ledger, { step: 'caption', usd: TEXT_CALL_USD, ticks: null })

    if (!caption.ok) {
      await adapters.killDraft(draftId, caption.error)
      return { ok: false, error: caption.error, draftId }
    }

    // ── motion ─────────────────────────────────────────────────────────────
    let mediaUrl = posterUrl
    let mediaKind: 'image' | 'video' = 'image'
    let filmShots: FilmPlan['shots'] | null = null
    let degradedToSingleBeat = false

    if (filmPlan) {
      const film = await renderListingFilm(
        filmPlan,
        { aspectRatio: format.videoAspect },
        adapters,
        ledger,
      )
      if (!film.ok) {
        await adapters.killDraft(draftId, film.error)
        return { ok: false, error: film.error, draftId }
      }
      const storedFilm = await adapters.storeMedia({
        draftId,
        filename: 'film.mp4',
        body: film.body,
        contentType: 'video/mp4',
      })
      if (!storedFilm.ok) {
        await adapters.killDraft(draftId, `Could not store film: ${storedFilm.error}`)
        return { ok: false, error: storedFilm.error, draftId }
      }
      mediaUrl = storedFilm.url
      mediaKind = 'video'
      filmShots = film.shots
      degradedToSingleBeat = film.degradedToSingleBeat
    } else if (format.media === 'video') {
      const motionPrompt = buildMotionPrompt(spec)
      assertCraftClean(motionPrompt, `${format.id} motion prompt`)
      assertBudget(ledger, videoCost('grok-imagine-video-1.5', format.seconds), 'animation')

      const clip = await adapters.animate({
        prompt: motionPrompt,
        imageUrl: posterUrl,
        aspectRatio: format.videoAspect,
        seconds: format.seconds,
      })
      addSpend(ledger, {
        step: `video ${clip.durationSeconds}s`,
        usd: videoCost(clip.model, clip.durationSeconds),
        ticks: clip.costTicks,
      })

      // The generator URL expires. Store our own copy before the row points at it.
      const bytes = await adapters.downloadUrl(clip.url)
      const storedClip = await adapters.storeMedia({
        draftId,
        filename: 'clip.mp4',
        body: bytes,
        contentType: 'video/mp4',
      })
      if (!storedClip.ok) {
        await adapters.killDraft(draftId, `Could not store clip: ${storedClip.error}`)
        return { ok: false, error: storedClip.error, draftId }
      }
      mediaUrl = storedClip.url
      mediaKind = 'video'
    }

    // ── ready ──────────────────────────────────────────────────────────────
    const ready = await adapters.markReady({
      id: draftId,
      executorResponse: {
        // §0: the publish route refuses a row without these.
        citations: subject.citations,
        qa: qa
          ? { score: qa.score, defects: qa.defects, describes: qa.describes, gate: 'grok-vision' }
          : {
              gate: 'source-photograph',
              describes: filmPlan?.describes ?? 'Real MLS photograph, not generated.',
            },
        ...(filmShots
          ? {
              sequence: {
                beats: filmShots.map((shot) => ({
                  subject: shot.subject,
                  move: shot.move,
                  seconds: shot.seconds,
                  quality: shot.quality,
                  because: shot.because,
                })),
                // A film that quietly became one shot must say so on the row.
                degradedToSingleBeat,
              },
            }
          : {}),
        spend: ledger,
        media: { kind: mediaKind, url: mediaUrl, posterUrl },
        publish_payload: {
          approved: true,
          contentType: format.id,
          platforms: format.platforms,
          mediaType: mediaKind === 'video' ? 'reel' : 'image',
          mediaUrl,
          coverUrl: posterUrl,
          captionDefault: caption.result.caption,
          approvalRef: { actionId: draftId },
        },
      },
      payloadPatch: {
        caption: caption.result.caption,
        alt_text: caption.result.altText,
        media_url: mediaUrl,
        poster_url: posterUrl,
        spend_usd: ledger.totalUsd,
      },
    })
    if (!ready.ok) return { ok: false, error: ready.error, draftId }

    return {
      ok: true,
      draftId,
      mediaUrl,
      posterUrl,
      caption: caption.result.caption,
      spendUsd: ledger.totalUsd,
      qa,
    }
  } catch (err) {
    const message =
      err instanceof SpendCapError
        ? err.message
        : err instanceof Error
          ? err.message
          : 'Studio produce failed'
    if (draftId) await adapters.killDraft(draftId, message).catch(() => undefined)
    return { ok: false, error: message, draftId }
  }
}
