import { AbsoluteFill, Audio, Sequence, interpolate, staticFile, useVideoConfig } from 'remotion'
import { CaptionBand, CaptionWord } from './CaptionBand'
import { IntroBeat } from './IntroBeat'
import { OutroBeat } from './OutroBeat'
import { StatBeat, StatBeatProps } from './StatBeat'
import { FPS, INTRO_SEC, OUTRO_SEC, STAT_SEC } from './brand'
import { loadFonts } from './fonts'

export type MarketReportInput = {
  city: string
  period: string
  subhead: string
  /** slug used for image paths e.g. "bend" → public/bend/img_N.jpg */
  citySlug?: string
  stats: Array<Omit<StatBeatProps, 'index' | 'total' | 'imageSrc' | 'durationInFrames'>>
  voPath: string
  captionWords: CaptionWord[]
  /**
   * Per-beat durations in seconds. Length = 1 (intro) + stats.length + 1 (outro).
   * If absent, falls back to fixed INTRO_SEC / STAT_SEC / OUTRO_SEC constants.
   */
  beatDurations?: number[]
}

const toFrames = (sec: number) => Math.max(1, Math.round(sec * FPS))

export const computeDurationFrames = (input: MarketReportInput): number => {
  const beats = computeBeatFrames(input)
  return beats.reduce((s, x) => s + x, 0)
}

export const computeBeatFrames = (input: MarketReportInput): number[] => {
  const expected = 1 + input.stats.length + 1
  if (input.beatDurations && input.beatDurations.length === expected) {
    return input.beatDurations.map(toFrames)
  }
  // Fallback constants
  return [
    toFrames(INTRO_SEC),
    ...input.stats.map(() => toFrames(STAT_SEC)),
    toFrames(OUTRO_SEC),
  ]
}

/**
 * Map beat index → image filename.
 * Beat 0 = intro → img_1
 * Beats 1-9 (stats) → img_2..img_7 (cycling)
 * Outro → img_7
 */
function beatImageSrc(citySlug: string, beatIndex: number, totalBeats: number): string {
  if (beatIndex === 0) return `${citySlug}/img_1.jpg`
  if (beatIndex === totalBeats - 1) return `${citySlug}/img_7.jpg`
  // stat beats 1..N cycle through img_2..img_6 (5 images for up to 9 beats)
  const imgIdx = ((beatIndex - 1) % 5) + 2
  return `${citySlug}/img_${imgIdx}.jpg`
}

export const MarketReport: React.FC<MarketReportInput> = (input) => {
  const { city, period, subhead, citySlug, stats, voPath, captionWords } = input
  void loadFonts()

  const { durationInFrames: totalFrames } = useVideoConfig()
  const beats = computeBeatFrames(input)
  const totalBeats = beats.length

  // Derive slug from city name if not provided
  const slug = citySlug || city.toLowerCase().replace(/\s+/g, '-')

  let cursor = 0
  const intro = beats[0]
  const outro = beats[beats.length - 1]
  const statFrames = beats.slice(1, 1 + stats.length)

  // Music volume: start at 0.18, swell to 0.30 in the last 8.5s
  const outroStartFrame = totalFrames - outro
  const swellStartFrame = outroStartFrame + 15 // ~0.5s into outro
  const musicVolume = (f: number) => interpolate(
    f,
    [swellStartFrame, swellStartFrame + 45],
    [0.18, 0.30],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  )

  return (
    <AbsoluteFill style={{ backgroundColor: '#0A1A2E' }}>
      {/* VO */}
      {voPath ? <Audio src={staticFile(voPath)} /> : null}

      {/* Music bed — full duration, ducked under VO */}
      <Audio
        src={staticFile('audio/music_bed.mp3')}
        volume={musicVolume}
        loop
      />

      {/* Intro beat */}
      <Sequence from={cursor} durationInFrames={intro}>
        <IntroBeat
          city={city}
          period={period}
          subhead={subhead}
          citySlug={slug}
          durationInFrames={intro}
        />
      </Sequence>
      {(cursor += intro, null)}

      {/* Stat sub-beats */}
      {stats.map((s, i) => {
        const f = statFrames[i]
        const beatIdx = i + 1 // intro is beat 0
        const imgSrc = beatImageSrc(slug, beatIdx, totalBeats)
        const seq = (
          <Sequence key={`stat-${i}`} from={cursor} durationInFrames={f}>
            <StatBeat
              {...s}
              index={i + 1}
              total={stats.length}
              imageSrc={imgSrc}
              durationInFrames={f}
            />
          </Sequence>
        )
        cursor += f
        return seq
      })}

      {/* Outro */}
      <Sequence from={cursor} durationInFrames={outro}>
        <OutroBeat
          city={city}
          imageSrc={beatImageSrc(slug, totalBeats - 1, totalBeats)}
          durationInFrames={outro}
        />
      </Sequence>

      {/* Caption band — always on top */}
      <CaptionBand words={captionWords} />
    </AbsoluteFill>
  )
}
