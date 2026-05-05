import { AbsoluteFill, Audio, Sequence, interpolate, staticFile, useVideoConfig } from 'remotion'
import { FPS, NAVY_DEEP } from './brand'
import { CaptionBand, CaptionSentence, CaptionWord } from './components/CaptionBand'
import { ChapterBeat } from './beats/ChapterBeat'
import { InputsBeat } from './beats/InputsBeat'
import { OutroBeat } from './beats/OutroBeat'
import { CashFlowBreakdown } from './charts/CashFlowBreakdown'
import { AppreciationCurve } from './charts/AppreciationCurve'
import { AmortizationCurve } from './charts/AmortizationCurve'
import { DepreciationSchedule } from './charts/DepreciationSchedule'
import { StackedGrowthChart } from './charts/StackedGrowthChart'
import { loadFonts } from './fonts'

export type EquitySeriesPoint = {
  year: number
  cashFlow: number
  appreciation: number
  loanPaydown: number
  taxSavings: number
  total: number
}

export type MasterclassInput = {
  /** Per-chapter durations in seconds. Length must equal 8. */
  chapterDurations: [number, number, number, number, number, number, number, number]
  voPath: string
  musicPath?: string
  captionWords: CaptionWord[]
  captionSentences?: CaptionSentence[]
  inputs: {
    purchasePrice: number
    downPayment: number
    loanAmount: number
    interestRate: number
    termYears: number
    monthlyRent: number
    monthlyPI: number
    monthlyTaxes: number
    monthlyInsurance: number
    monthlyOpexReserves: number
    monthlyCashFlow: number
    appreciationRate: number
    depreciationYearly: number
    depreciationYears: number
    taxBracket: number
  }
  /** per-year equity series for chapters 4 (appreciation only) + 7 (all 4 layered) */
  equitySeries: EquitySeriesPoint[]
  /** Hero photos per chapter slot */
  photos?: {
    intro?: string | null
    cashFlow?: string | null
    appreciation?: string | null
    loanPaydown?: string | null
    taxBenefits?: string | null
    outro?: string | null
  }
}

const toFrames = (sec: number) => Math.max(1, Math.round(sec * FPS))

export const computeMasterclassFrames = (input: MasterclassInput): number[] =>
  input.chapterDurations.map(toFrames)

export const computeMasterclassDuration = (input: MasterclassInput): number =>
  computeMasterclassFrames(input).reduce((s, x) => s + x, 0)

export const EvergreenMasterclass: React.FC<MasterclassInput> = (input) => {
  void loadFonts()
  const { durationInFrames: totalFrames } = useVideoConfig()
  const beats = computeMasterclassFrames(input)

  let cursor = 0
  const [c1, c2, c3, c4, c5, c6, c7, c8] = beats

  // Music: gentle bed at -16dB, swell to -10dB on chapter 7 chart hold + outro
  const ch7StartFrame = c1 + c2 + c3 + c4 + c5 + c6
  const swellStart = ch7StartFrame + Math.round(FPS * 4)
  const musicVolume = (f: number) =>
    interpolate(
      f,
      [0, FPS * 1.5, swellStart, swellStart + Math.round(FPS * 1.5), totalFrames - FPS * 2, totalFrames],
      [0, 0.16, 0.16, 0.24, 0.16, 0],
      { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
    )

  // Appreciation curve data: subset of series with just the property value
  const apprData = input.equitySeries.map((s) => ({
    year: s.year,
    value: input.inputs.purchasePrice + s.appreciation,
  }))

  return (
    <AbsoluteFill style={{ backgroundColor: NAVY_DEEP }}>
      {input.voPath ? <Audio src={staticFile(input.voPath)} /> : null}
      {input.musicPath ? <Audio src={staticFile(input.musicPath)} volume={musicVolume} loop /> : null}

      {/* Chapter 1 — Why real estate? (sourced hook per CLAUDE.md §0) */}
      <Sequence from={cursor} durationInFrames={c1}>
        <ChapterBeat
          chapterNumber={1}
          headline="Why real estate?"
          photoPath={input.photos?.intro ?? null}
          durationInFrames={c1}
        >
          <div
            style={{
              maxWidth: 880,
              padding: '0 60px',
              textAlign: 'center',
              color: '#faf8f4',
              fontFamily: "'Geist', 'Inter', system-ui, sans-serif",
              fontSize: 36,
              lineHeight: 1.4,
            }}
          >
            For the typical American household,
            <br />
            <span style={{ color: '#D4AF37', fontWeight: 700, fontSize: 44 }}>
              your home is the single biggest piece of your net worth.
            </span>
            <br />
            <span style={{ fontSize: 28, opacity: 0.8 }}>Source: Federal Reserve SCF</span>
          </div>
        </ChapterBeat>
      </Sequence>
      {(cursor += c1, null)}

      {/* Chapter 2 — The hypothetical (locked inputs card) */}
      <Sequence from={cursor} durationInFrames={c2}>
        <InputsBeat chapterNumber={2} durationInFrames={c2} inputs={input.inputs} />
      </Sequence>
      {(cursor += c2, null)}

      {/* Chapter 3 — Pillar 1: Cash flow (line-by-line breakdown for beginners) */}
      <Sequence from={cursor} durationInFrames={c3}>
        <ChapterBeat
          chapterNumber={3}
          headline="Pillar 1: Cash flow"
          photoPath={input.photos?.cashFlow ?? null}
          durationInFrames={c3}
        >
          <CashFlowBreakdown
            rent={input.inputs.monthlyRent}
            mortgage={input.inputs.monthlyPI}
            taxes={input.inputs.monthlyTaxes}
            insurance={input.inputs.monthlyInsurance}
            reserves={input.inputs.monthlyOpexReserves}
            net={input.inputs.monthlyCashFlow}
            enterDelaySec={1.0}
          />
        </ChapterBeat>
      </Sequence>
      {(cursor += c3, null)}

      {/* Chapter 4 — Pillar 2: Appreciation */}
      <Sequence from={cursor} durationInFrames={c4}>
        <ChapterBeat
          chapterNumber={4}
          headline="Pillar 2: Appreciation"
          photoPath={input.photos?.appreciation ?? null}
          durationInFrames={c4}
        >
          <AppreciationCurve data={apprData} enterDelaySec={0.3} />
        </ChapterBeat>
      </Sequence>
      {(cursor += c4, null)}

      {/* Chapter 5 — Pillar 3: Loan paydown */}
      <Sequence from={cursor} durationInFrames={c5}>
        <ChapterBeat
          chapterNumber={5}
          headline="Pillar 3: Loan paydown"
          photoPath={input.photos?.loanPaydown ?? null}
          durationInFrames={c5}
        >
          <AmortizationCurve
            loan={input.inputs.loanAmount}
            rate={input.inputs.interestRate}
            termYears={input.inputs.termYears}
            enterDelaySec={0.3}
          />
        </ChapterBeat>
      </Sequence>
      {(cursor += c5, null)}

      {/* Chapter 6 — Pillar 4: Tax benefits */}
      <Sequence from={cursor} durationInFrames={c6}>
        <ChapterBeat
          chapterNumber={6}
          headline="Pillar 4: Tax benefits"
          photoPath={input.photos?.taxBenefits ?? null}
          durationInFrames={c6}
        >
          <DepreciationSchedule
            yearlyAmount={input.inputs.depreciationYearly}
            years={input.inputs.depreciationYears}
            taxBracket={input.inputs.taxBracket}
            enterDelaySec={0.3}
          />
        </ChapterBeat>
      </Sequence>
      {(cursor += c6, null)}

      {/* Chapter 7 — Stack all four together */}
      <Sequence from={cursor} durationInFrames={c7}>
        <ChapterBeat chapterNumber={7} headline="Stack all four together" durationInFrames={c7}>
          <StackedGrowthChart series={input.equitySeries} enterDelaySec={0.3} />
        </ChapterBeat>
      </Sequence>
      {(cursor += c7, null)}

      {/* Chapter 8 — The honest part + outro */}
      <Sequence from={cursor} durationInFrames={c8}>
        <OutroBeat
          illustrationPath="4-pillars/illustrations/beat-6-outro.png"
          photoPath={input.photos?.outro ?? null}
          tagline="Illustrative. Your numbers will differ. The framework holds."
          durationInFrames={c8}
        />
      </Sequence>

      <CaptionBand words={input.captionWords} sentences={input.captionSentences} />
    </AbsoluteFill>
  )
}
