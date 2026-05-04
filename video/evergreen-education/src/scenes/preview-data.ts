import { EvergreenInput } from '../EvergreenExplainer'

/**
 * Default props for Remotion Studio + standalone rendering before the data pipeline runs.
 * Real props are written at render time by scripts/render.mjs from data/4-pillars.json.
 *
 * Numbers below MATCH the locked illustrative hypothetical:
 *   $500K rental, 25% down, $375K loan @ 7%/30yr, 3% appreciation,
 *   $200/mo cash flow, $400K building basis, 24% bracket
 */
export const defaultPreviewProps: EvergreenInput = {
  beatDurations: [4, 10, 11, 11, 13, 8, 3], // intro / cf / appr / paydown / tax / summary / outro = 60s
  voPath: '4-pillars/voiceover.mp3',
  musicPath: '4-pillars/music.mp3',
  captionWords: [
    // Empty by default — populated by synth-vo.mjs from forced alignment.
    // CaptionBand renders nothing if both lists empty; safe for Studio preview.
  ],
  captionSentences: [],
  illustrations: {
    intro: '4-pillars/illustrations/beat-0-hero.png',
    cashFlow: '4-pillars/illustrations/beat-1-cash-flow.png',
    appreciation: '4-pillars/illustrations/beat-2-appreciation.png',
    loanPaydown: '4-pillars/illustrations/beat-3-loan-paydown.png',
    taxBenefits: '4-pillars/illustrations/beat-4-tax-benefits.png',
    outro: '4-pillars/illustrations/beat-6-outro.png',
  },
  videoOverlays: {
    cashFlow: null,
    outro: null,
  },
  pillarParams: {
    cashFlow: { kind: 'cashFlow', cashFlowMonthly: 200 },
    appreciation: { kind: 'appreciation', ratePercent: 3, firstYearGain: 15000 },
    loanPaydown: { kind: 'loanPaydown', initialLoan: 375000, year1Paydown: 3800 },
    taxBenefits: {
      kind: 'taxBenefits',
      depreciationYearly: 14545,
      taxBracket: 24,
      taxSavingsYearly: 3491,
    },
  },
  // Computed by scripts/compute-equity-table.mjs — DO NOT edit by hand.
  // Re-run that script if any input in data/4-pillars.json changes.
  equityBars: [
    { year: 3, cashFlow: 7200, appreciation: 46364, loanPaydown: 12274, taxSavings: 10472, total: 76310 },
    { year: 5, cashFlow: 12000, appreciation: 79637, loanPaydown: 22007, taxSavings: 17454, total: 131098 },
    { year: 10, cashFlow: 24000, appreciation: 171958, loanPaydown: 53204, taxSavings: 34908, total: 284070 },
    { year: 20, cashFlow: 48000, appreciation: 403056, loanPaydown: 160125, taxSavings: 69816, total: 680997 },
  ],
}
