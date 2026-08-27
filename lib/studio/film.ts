/**
 * lib/studio/film.ts — a multi-beat film from our own photographs.
 *
 * The single-beat path animates one frame. This one does what the people
 * making the best work on Grok Imagine actually do: grade the available
 * frames, choose a small sequence with a reason for each beat, move the
 * camera differently in each, and cut them together.
 *
 * Every frame here is a real photograph of a real property. Nothing is
 * generated and nothing is restyled, so there is no vision gate on the
 * PLATE the way there is for a generated still. The judgement Grok vision
 * makes here is different: which of the forty-one photographs can carry a
 * camera move, and what is each one of.
 *
 * Adapter-injected and pure, so the sequence logic is testable without
 * spending a cent.
 */
import type { PhotoGrade } from '@/lib/grok/classify'
import type { ConcatResult } from '@/lib/video/concat'
import { buildMotionPrompt, assertCraftClean } from './craft'
import { listingShot } from './formats'
import { planShotList, describeSequence, type GradedPhoto, type PlannedShot } from './shotlist'
import { addSpend, assertBudget, videoCost, VISION_CALL_USD, type SpendLedger } from './spend'

/**
 * How many photographs we grade before choosing the sequence.
 *
 * Eight, not forty-one. Each grade is about three cents, MLS order is not
 * random (the listing agent led with their best frames), and a four-beat film
 * does not get better by looking at every bathroom.
 */
export const GRADE_BUDGET = 8

/**
 * Choose which photographs to grade.
 *
 * NOT the first eight. MLS order front-loads the exterior and the main living
 * space, so grading the head of a 41-photo set returned three exteriors and
 * five living rooms and no kitchen at all: the film had nothing to put in its
 * "room that sells the house" slot. Take the agent's first two picks, which
 * are chosen and usually the best frames, then stride across the rest so the
 * kitchen, the primary, and the view are actually in the running.
 */
export function sampleForGrading<T>(photos: T[], budget: number): T[] {
  if (photos.length <= budget) return photos
  const lead = photos.slice(0, 2)
  const rest = photos.slice(2)
  const want = budget - lead.length
  const stride = rest.length / want
  const spread: T[] = []
  for (let i = 0; i < want; i += 1) spread.push(rest[Math.floor(i * stride)])
  return [...lead, ...spread]
}

export type FilmAdapters = {
  getPhotos: (
    listingKey: string,
  ) => Promise<Array<{ url: string; gradeUrl?: string; order: number; isPrimary: boolean }>>
  gradePhoto: (input: { imageUrl: string }) => Promise<PhotoGrade>
  animate: (input: {
    prompt: string
    imageUrl: string
    aspectRatio: string
    seconds: number
  }) => Promise<{ url: string; model: string; durationSeconds: number; costTicks: number | null }>
  downloadUrl: (url: string) => Promise<Buffer>
  concat: (clips: Buffer[]) => Promise<ConcatResult>
}

export type FilmPlan = {
  shots: PlannedShot[]
  /** What the film will show, in order. Feeds the caption and the alt text. */
  describes: string
  /** First frame, used as the poster. */
  posterUrl: string
}

export type FilmResult =
  | {
      ok: true
      body: Buffer
      shots: PlannedShot[]
      /** True when we wanted a sequence and could only deliver one beat. */
      degradedToSingleBeat: boolean
      describes: string
      posterUrl: string
    }
  | { ok: false; error: string }

export type BuildFilmInput = {
  listingKey: string
  aspectRatio: string
  maxShots: number
  secondsPerShot: number
}

/**
 * PHASE 1, cheap: grade the photo set and choose the sequence.
 *
 * Split from the render on purpose. Grading ten frames costs about four
 * cents; animating four beats costs about two dollars. The caption is written
 * between the two, so a caption the voice gate rejects costs four cents
 * instead of two dollars.
 */
export async function planListingFilm(
  input: Pick<BuildFilmInput, 'listingKey' | 'maxShots' | 'secondsPerShot'>,
  adapters: Pick<FilmAdapters, 'getPhotos' | 'gradePhoto'>,
  ledger: SpendLedger,
): Promise<{ ok: true; plan: FilmPlan } | { ok: false; error: string }> {
  const photos = await adapters.getPhotos(input.listingKey)
  if (photos.length === 0) return { ok: false, error: 'That listing has no usable public photos.' }

  const candidates = sampleForGrading(photos, GRADE_BUDGET)
  const graded: GradedPhoto[] = []
  for (const photo of candidates) {
    assertBudget(ledger, VISION_CALL_USD, 'photo grading')
    try {
      const grade = await adapters.gradePhoto({ imageUrl: photo.gradeUrl ?? photo.url })
      addSpend(ledger, { step: 'photo grade', usd: VISION_CALL_USD, ticks: null })
      graded.push({ ...grade, url: photo.url, order: photo.order })
    } catch {
      // One unreadable photo is not a reason to abandon the film.
      addSpend(ledger, { step: 'photo grade (failed)', usd: VISION_CALL_USD, ticks: null })
    }
  }

  const shots = planShotList(graded, {
    maxShots: input.maxShots,
    secondsPerShot: input.secondsPerShot,
  })
  if (shots.length === 0) {
    return { ok: false, error: 'No photograph in this set could carry a camera move.' }
  }

  return {
    ok: true,
    plan: { shots, describes: describeSequence(shots), posterUrl: shots[0].url },
  }
}

/**
 * PHASE 2, expensive: animate each beat and cut them together.
 *
 * Degrades honestly rather than failing: when ffmpeg is unavailable in this
 * runtime we ship the FIRST beat alone and say so, because a good six-second
 * establishing shot is a real post and a broken file is not.
 */
export async function renderListingFilm(
  plan: FilmPlan,
  input: Pick<BuildFilmInput, 'aspectRatio'>,
  adapters: Pick<FilmAdapters, 'animate' | 'downloadUrl' | 'concat'>,
  ledger: SpendLedger,
): Promise<FilmResult> {
  const shots = plan.shots
  const clips: Buffer[] = []
  for (const shot of shots) {
    const prompt = buildMotionPrompt({ ...listingShot(), move: shot.move })
    assertCraftClean(prompt, `film beat (${shot.subject})`)
    assertBudget(ledger, videoCost('grok-imagine-video-1.5', shot.seconds), `beat: ${shot.subject}`)

    const clip = await adapters.animate({
      prompt,
      imageUrl: shot.url,
      aspectRatio: input.aspectRatio,
      seconds: shot.seconds,
    })
    addSpend(ledger, {
      step: `beat ${clips.length + 1}: ${shot.subject} (${shot.move})`,
      usd: videoCost(clip.model, clip.durationSeconds),
      ticks: clip.costTicks,
    })
    clips.push(await adapters.downloadUrl(clip.url))
  }

  const joined = await adapters.concat(clips)
  if (!joined.ok) {
    if (joined.reason === 'no-ffmpeg' && clips.length > 0) {
      return {
        ok: true,
        body: clips[0],
        shots: shots.slice(0, 1),
        degradedToSingleBeat: true,
        describes: shots[0].describes,
        posterUrl: shots[0].url,
      }
    }
    return { ok: false, error: `Could not cut the film: ${joined.error}` }
  }

  return {
    ok: true,
    body: joined.body,
    shots,
    degradedToSingleBeat: false,
    describes: plan.describes,
    posterUrl: plan.posterUrl,
  }
}
