import { AbsoluteFill, Audio, Sequence, interpolate, staticFile, useVideoConfig } from 'remotion'
import { FPS, NAVY_DEEP } from './brand'
import { CaptionBand, CaptionSentence, CaptionWord } from './components/CaptionBand'
import { EquityBar } from './components/StackedEquityChart'
import { IntroBeat } from './beats/IntroBeat'
import { OutroBeat } from './beats/OutroBeat'
import { PillarBeat, PillarParams } from './beats/PillarBeat'
import { StackedSummaryBeat } from './beats/StackedSummaryBeat'
import { loadFonts } from './fonts'

export type EvergreenInput = {
  /** Per-beat durations in seconds. Length must equal 7 (intro + 4 pillars + summary + outro). */
  beatDurations: [number, number, number, number, number, number, number]
  /** Path to combined VO mp3 under public/ */
  voPath: string
  /** Path to background music mp3 under public/ */
  musicPath?: string
  /** Word-level caption timing across the full VO */
  captionWords: CaptionWord[]
  /** Sentence groupings for full-sentence caption display (preferred over word-window) */
  captionSentences?: CaptionSentence[]
  /** Illustrations per beat (slugs under public/4-pillars/illustrations/) */
  illustrations: {
    intro: string
    cashFlow: string
    appreciation: string
    loanPaydown: string
    taxBenefits: string
    outro: string
  }
  /** Optional Grok Video clips for beats 1 + 6 (cash flow + outro) */
  videoOverlays?: {
    cashFlow?: string | null
    outro?: string | null
  }
  /** Per-pillar parameters (drives the data viz inside each PillarBeat) */
  pillarParams: {
    cashFlow: Extract<PillarParams, { kind: 'cashFlow' }>
    appreciation: Extract<PillarParams, { kind: 'appreciation' }>
    loanPaydown: Extract<PillarParams, { kind: 'loanPaydown' }>
    taxBenefits: Extract<PillarParams, { kind: 'taxBenefits' }>
  }
  /** 4-bar stacked equity table for Beat 5 (3 / 5 / 10 / 20 yr) */
  equityBars: EquityBar[]
  /** Optional reveal times (seconds) for each bar in Beat 5 — synced to spoken numbers */
  barRevealTimesSec?: number[]
}

const toFrames = (sec: number) => Math.max(1, Math.round(sec * FPS))

export const computeBeatFrames = (input: EvergreenInput): number[] => input.beatDurations.map(toFrames)

export const computeDurationFrames = (input: EvergreenInput): number =>
  computeBeatFrames(input).reduce((s, x) => s + x, 0)

export const EvergreenExplainer: React.FC<EvergreenInput> = (input) => {
  void loadFonts()

  const { durationInFrames: totalFrames } = useVideoConfig()
  const beats = computeBeatFrames(input)

  let cursor = 0
  const [introF, cashFlowF, appreciationF, loanPaydownF, taxBenefitsF, summaryF, outroF] = beats

  // Music volume: gentle bed under VO. Swell slightly during summary chart hold (when VO is silent).
  const summaryStartFrame = introF + cashFlowF + appreciationF + loanPaydownF + taxBenefitsF
  const swellStartFrame = summaryStartFrame + Math.round(FPS * 4.5) // ~4.5s into summary
  const musicVolume = (f: number) =>
    interpolate(
      f,
      [0, FPS * 1.5, swellStartFrame, swellStartFrame + Math.round(FPS * 1.5), totalFrames - FPS * 2, totalFrames],
      [0, 0.16, 0.16, 0.24, 0.16, 0],
      { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
    )

  return (
    <AbsoluteFill style={{ backgroundColor: NAVY_DEEP }}>
      {/* VO track */}
      {input.voPath ? <Audio src={staticFile(input.voPath)} /> : null}

      {/* Music bed (optional) */}
      {input.musicPath ? (
        <Audio src={staticFile(input.musicPath)} volume={musicVolume} loop />
      ) : null}

      {/* Beat 0 — Intro */}
      <Sequence from={cursor} durationInFrames={introF}>
        <IntroBeat
          illustrationPath={input.illustrations.intro}
          title="The 4 Pillars of Real Estate Wealth"
          durationInFrames={introF}
        />
      </Sequence>
      {(cursor += introF, null)}

      {/* Beat 1 — Cash Flow */}
      <Sequence from={cursor} durationInFrames={cashFlowF}>
        <PillarBeat
          kind="cashFlow"
          pillarNumber={1}
          headline="Cash Flow"
          illustrationPath={input.illustrations.cashFlow}
          videoOverlayPath={input.videoOverlays?.cashFlow ?? null}
          params={input.pillarParams.cashFlow}
        />
      </Sequence>
      {(cursor += cashFlowF, null)}

      {/* Beat 2 — Appreciation */}
      <Sequence from={cursor} durationInFrames={appreciationF}>
        <PillarBeat
          kind="appreciation"
          pillarNumber={2}
          headline="Appreciation"
          illustrationPath={input.illustrations.appreciation}
          params={input.pillarParams.appreciation}
        />
      </Sequence>
      {(cursor += appreciationF, null)}

      {/* Beat 3 — Loan Paydown */}
      <Sequence from={cursor} durationInFrames={loanPaydownF}>
        <PillarBeat
          kind="loanPaydown"
          pillarNumber={3}
          headline="Loan Paydown"
          illustrationPath={input.illustrations.loanPaydown}
          params={input.pillarParams.loanPaydown}
        />
      </Sequence>
      {(cursor += loanPaydownF, null)}

      {/* Beat 4 — Tax Benefits */}
      <Sequence from={cursor} durationInFrames={taxBenefitsF}>
        <PillarBeat
          kind="taxBenefits"
          pillarNumber={4}
          headline="Tax Benefits"
          illustrationPath={input.illustrations.taxBenefits}
          params={input.pillarParams.taxBenefits}
        />
      </Sequence>
      {(cursor += taxBenefitsF, null)}

      {/* Beat 5 — Stacked Summary */}
      <Sequence from={cursor} durationInFrames={summaryF}>
        <StackedSummaryBeat bars={input.equityBars} barRevealTimesSec={input.barRevealTimesSec} />
      </Sequence>
      {(cursor += summaryF, null)}

      {/* Beat 6 — Outro */}
      <Sequence from={cursor} durationInFrames={outroF}>
        <OutroBeat
          illustrationPath={input.illustrations.outro}
          videoOverlayPath={input.videoOverlays?.outro ?? null}
          tagline="Stacked, they're the wealth most people can't see."
          durationInFrames={outroF}
        />
      </Sequence>

      {/* Caption band on top — always. Prefers full-sentence display via captionSentences. */}
      <CaptionBand words={input.captionWords} sentences={input.captionSentences} />
    </AbsoluteFill>
  )
}
