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
 *   7. lay the type over the footage (lib/studio/motion), if the format has a
 *      type layer: verified figures only, or the draft dies. A paper film
 *      (frameSource 'code') skips 3 to 5: the stage draws it whole from
 *      verified data, scored, for nothing but the caption
 *   8. mark ready, with citations, QA verdict, and spend attached
 *
 * The draft lands as `ready` with approval NOT stamped. Nothing here posts,
 * and nothing here can post: publishing needs a human approval on the row
 * (CLAUDE.md §1).
 *
 * A failure at any step kills the row with a reason rather than shipping a
 * degraded version. There is no template fallback anywhere in this file, on
 * purpose: a fallback is how slop reaches a feed. The two honest exceptions
 * are recorded on the row: a film that could only ship one beat, and a type
 * layer that could not run (the footage ships without type and says why).
 * A type layer that tried to show an unverified number is not an exception:
 * that kills the row.
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
import { GRADE_BUDGET, planListingFilm, renderListingFilm, type CutShot, type FilmAdapters, type FilmPlan } from './film'
import type { VisionVerdict } from '@/lib/grok/vision'
import { figureScope, type MotionAgent, type MotionOutline, type MotionSeries } from './motion/cues'
import { aspectValue, imageSize, sameShape } from '@/lib/video/image-size'
import type { ComposeMotionInput, ComposeMotionResult } from './motion/compose'

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
  /** Listing heading for the type layer: city small, street large. */
  heading?: { eyebrow: string; line: string }
  /** The listing agent when the listing is ours; null for another office. */
  agent?: MotionAgent | null
  /** A trend film's verified monthly series. */
  series?: MotionSeries
  /** A map film's recorded outlines. */
  outline?: MotionOutline
  /** For a paper film: what it shows, exactly, for the caption writer. */
  describes?: string
  /** For a paper film: the figures it shows, the only ones its caption may use. */
  captionKeys?: string[]
}

/**
 * The figures a caption may use, each labelled with what it measures. A
 * figure whose trace says segment='detached' is relabelled single-family, so
 * "710 active listings" cannot go out as a claim about the whole market when
 * it counts single-family homes. A paper film's caption keeps to the figures
 * its picture shows.
 */
export function captionFigures(subject: StudioSubject): Record<string, string> {
  const out: Record<string, string> = {}
  for (const key of subject.captionKeys ?? Object.keys(subject.figures)) {
    const value = subject.figures[key]
    if (!value) continue
    const scoped = figureScope(subject, key) && !/single-family/i.test(key) ? `single-family ${key}` : key
    out[scoped] = value
  }
  return out
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
  /**
   * Animate a GENERATED still (market and place formats). Never called with a
   * listing photograph: those are panned (FilmAdapters.panPhoto).
   */
  animate: (input: {
    prompt: string
    imageUrl: string
    aspectRatio: string
    seconds: number
  }) => Promise<{ url: string; model: string; durationSeconds: number; costTicks: number | null }>
  /** Pull a generator's output before its URL expires. */
  downloadUrl: (url: string) => Promise<Buffer>
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
  /**
   * The type layer (lib/studio/motion/compose.ts). Optional so a runtime
   * without it still produces plain footage; formats without a `motion`
   * spec never call it.
   */
  composeMotion?: (input: ComposeMotionInput) => Promise<ComposeMotionResult>
}

type TypeLayerOutcome =
  | { kill: string }
  | { url: string | null; record: Record<string, unknown> | null }

/**
 * Lay the type over finished footage and store the result beside the plate.
 * Returns the final media URL, or null to keep the plate, plus what the row
 * should record either way.
 */
async function typeLayer(args: {
  adapters: StudioAdapters
  draftId: string
  format: StudioFormat
  subject: StudioSubject
  /** The footage; null for a paper film, which the stage draws whole. */
  body: Buffer | null
  beats?: number[]
}): Promise<TypeLayerOutcome> {
  const { adapters, draftId, format, subject } = args
  if (!format.motion || !adapters.composeMotion) return { url: null, record: null }

  const composed = await adapters.composeMotion({
    spec: format.motion,
    subject: {
      label: subject.label,
      figures: subject.figures,
      citations: subject.citations,
      heading: subject.heading,
      agent: subject.agent ?? null,
      series: subject.series,
      outline: subject.outline,
    },
    video: args.body,
    beats: args.beats,
    // The draft id seeds the score, so a re-render of this draft is the same film.
    seed: draftId,
  })
  if (!composed.ok) {
    // §0: a number on screen that is not a verified figure is not shippable,
    // with or without the rest of the film.
    if (composed.reason === 'figure-leak') return { kill: `Type layer refused: ${composed.error}` }
    return {
      url: null,
      record: { applied: false, reason: composed.reason, error: composed.error, notes: composed.notes ?? [] },
    }
  }

  const stored = await adapters.storeMedia({
    draftId,
    filename: 'final.mp4',
    body: composed.body,
    contentType: 'video/mp4',
  })
  if (!stored.ok) {
    return { url: null, record: { applied: false, reason: 'store-failed', error: stored.error, notes: [] } }
  }
  // One still per card, so the reviewer can check every number on screen
  // against its trace without scrubbing the video (CLAUDE.md §0, step 6).
  const stills: Array<{ cueId: string; t: number; url: string }> = []
  const notes = [...composed.record.notes]
  for (const still of composed.stills) {
    const saved = await adapters.storeMedia({
      draftId,
      filename: `still-${still.cueId}.jpg`,
      body: still.jpg,
      contentType: 'image/jpeg',
    })
    if (saved.ok) stills.push({ cueId: still.cueId, t: still.t, url: saved.url })
    else notes.push(`No still for ${still.cueId}: storage refused it (${saved.error}).`)
  }
  return { url: stored.url, record: { applied: true, ...composed.record, notes, stills } }
}

/** The frame a format's clips are made at: 1080 wide, the format's shape. */
export function frameFor(aspect: string): { width: number; height: number } {
  const value = aspectValue(aspect) ?? 9 / 16
  return { width: 1080, height: Math.round(1080 / value / 2) * 2 }
}

/** Start time of each beat in a cut film. */
function beatStarts(shots: Array<{ seconds: number }>): number[] {
  const starts: number[] = []
  let at = 0
  for (const shot of shots) {
    starts.push(at)
    at += shot.seconds
  }
  return starts
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
      // Shape first, for free: a still that is not the clip's shape would be
      // squeezed by the animator, so it never reaches the paid inspection.
      const size = imageSize(image)
      if (format.media === 'video' && (!size || !sameShape(size, format.videoAspect))) continue
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
    // A paper film has no hero frame; its poster is its own finished chart or
    // map, set once the film is drawn.
    let posterUrl = ''
    let qa: VisionVerdict | null = null
    // The generated still's bytes, kept for the shape gate before animation.
    let heroImage: Buffer | null = null

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
    } else if (format.frameSource === 'code') {
      // Drawn whole from verified data below; nothing to generate or inspect.
    } else {
      const hero = await buildHeroFrame(format, spec, adapters, ledger)
      if (!hero) {
        await adapters.killDraft(draftId, 'No generated frame passed inspection after two attempts.')
        return { ok: false, error: 'No frame passed inspection. Nothing shipped.', draftId }
      }
      qa = hero.verdict
      heroImage = hero.image
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

    // The shape gate, before a cent more is spent. A generator handed a still
    // of a different shape than the clip it is asked for squeezes the still
    // to fit; that is how every listing film came out tall and thin (Matt
    // 2026-10-07). A generated still must already be the clip's shape.
    if (heroImage && format.media === 'video') {
      const still = imageSize(heroImage)
      if (!still || !sameShape(still, format.videoAspect)) {
        const reason = still
          ? `Refusing to animate: the still is ${still.width}x${still.height} and the clip is ${format.videoAspect}, so the generator would distort it.`
          : 'Refusing to animate: could not read the still size to confirm its shape.'
        await adapters.killDraft(draftId, reason)
        return { ok: false, error: reason, draftId }
      }
    }

    // ── caption ────────────────────────────────────────────────────────────
    // Before motion, deliberately. The caption gate kills roughly as often as
    // the frame gate does, and a caption failure after animating throws away
    // a finished $0.48 clip. The frame has already passed inspection, so its
    // description is available; nothing here needs the video to exist.
    const captionRequest: CaptionRequest = {
      subject: subject.label,
      figures: captionFigures(subject),
      // A listing's price after its address needs no label; a market figure does.
      labelEveryFigure: format.subject !== 'listing',
      context: subject.context,
      platforms: format.platforms,
      cta: subject.ctaUrl ? `Details at ${subject.ctaUrl}` : undefined,
      mediaDescription:
        filmPlan?.describes ||
        qa?.describes ||
        (format.frameSource === 'mls_photo'
          ? `A photograph of the home at ${subject.label}, panned across in its true shape.`
          : format.frameSource === 'code'
            ? (subject.describes ?? format.what)
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
    // Each source only makes the footage; storing it and laying the type over
    // it is one shared tail below, so the three paths cannot drift.
    let mediaUrl = posterUrl
    let mediaKind: 'image' | 'video' = 'image'
    let filmShots: CutShot[] | null = null
    let motion: Record<string, unknown> | null = null
    let footage: { body: Buffer; filename: string; beats?: number[] } | null = null
    const frame = frameFor(format.videoAspect)

    if (filmPlan) {
      const film = await renderListingFilm(filmPlan, frame, adapters, ledger)
      if (!film.ok) {
        await adapters.killDraft(draftId, film.error)
        return { ok: false, error: film.error, draftId }
      }
      filmShots = film.shots
      footage = { body: film.body, filename: 'film.mp4', beats: beatStarts(film.shots) }
    } else if (format.media === 'video' && format.frameSource === 'mls_photo') {
      // A real listing photograph is never animated by a generator (Matt
      // 2026-10-07: Grok squeezed every landscape photo into 9:16). It is
      // panned across at its true shape instead, for nothing.
      try {
        const pan = await adapters.panPhoto({ url: posterUrl, seconds: format.seconds, direction: 'forward', ...frame })
        addSpend(ledger, { step: `${pan.label} across the real photo`, usd: 0, ticks: null })
        footage = { body: pan.body, filename: 'clip.mp4' }
      } catch (err) {
        const reason = `Could not move across the listing photo: ${err instanceof Error ? err.message : 'pan failed'}`
        await adapters.killDraft(draftId, reason)
        return { ok: false, error: reason, draftId }
      }
    } else if (format.media === 'video' && format.frameSource === 'generated') {
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
      footage = { body: await adapters.downloadUrl(clip.url), filename: 'clip.mp4' }
    }

    if (format.frameSource === 'code') {
      // The whole film is the motion stage's drawing. With no footage under
      // it there is nothing to fall back to: any failure kills the draft.
      const typed = await typeLayer({ adapters, draftId, format, subject, body: null })
      if ('kill' in typed) {
        await adapters.killDraft(draftId, typed.kill)
        return { ok: false, error: typed.kill, draftId }
      }
      if (!typed.url || !typed.record) {
        const why = typed.record ? String(typed.record.error ?? typed.record.reason ?? 'unknown') : 'no motion stage in this runtime'
        const reason = `${format.label} could not be drawn: ${why}`
        await adapters.killDraft(draftId, reason)
        return { ok: false, error: reason, draftId }
      }
      addSpend(ledger, { step: 'drawn from verified data', usd: 0, ticks: null })
      motion = typed.record
      mediaUrl = typed.url
      mediaKind = 'video'
      // The poster is the first card's finished picture: the landed line, the
      // filled outline. With no still stored there is no cover to post and no
      // still to check the numbers against (§0 step 6), so the draft dies.
      const stills = (typed.record.stills as Array<{ cueId: string; url: string }> | undefined) ?? []
      const poster = stills.find((still) => still.cueId === 'lead1') ?? stills[0]
      if (!poster) {
        const reason = `${format.label} has no stored still for its cover; nothing to review the figures against.`
        await adapters.killDraft(draftId, reason)
        return { ok: false, error: reason, draftId }
      }
      posterUrl = poster.url
    }

    if (footage) {
      const stored = await adapters.storeMedia({
        draftId,
        filename: footage.filename,
        body: footage.body,
        contentType: 'video/mp4',
      })
      if (!stored.ok) {
        await adapters.killDraft(draftId, `Could not store ${footage.filename}: ${stored.error}`)
        return { ok: false, error: stored.error, draftId }
      }
      mediaUrl = stored.url
      mediaKind = 'video'

      const typed = await typeLayer({ adapters, draftId, format, subject, body: footage.body, beats: footage.beats })
      if ('kill' in typed) {
        await adapters.killDraft(draftId, typed.kill)
        return { ok: false, error: typed.kill, draftId }
      }
      if (typed.record) motion = { ...typed.record, plateUrl: stored.url }
      if (typed.url) mediaUrl = typed.url
    }

    // ── ready ──────────────────────────────────────────────────────────────
    const ready = await adapters.markReady({
      id: draftId,
      executorResponse: {
        // §0: the publish route refuses a row without these.
        citations: subject.citations,
        qa: qa
          ? { score: qa.score, defects: qa.defects, describes: qa.describes, gate: 'grok-vision' }
          : format.frameSource === 'code'
            ? { gate: 'drawn-from-data', describes: format.what }
            : {
                gate: 'source-photograph',
                describes: filmPlan?.describes ?? 'Real MLS photograph, not generated.',
              },
        ...(filmShots
          ? {
              sequence: {
                beats: filmShots.map((shot) => ({
                  subject: shot.subject,
                  // How the window moved across the real photograph.
                  pan: shot.pan,
                  seconds: shot.seconds,
                  quality: shot.quality,
                  because: shot.because,
                })),
              },
            }
          : {}),
        // The type layer: what it drew, a still of every card, and the plain
        // footage underneath; or why it could not run.
        ...(motion ? { motion } : {}),
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
