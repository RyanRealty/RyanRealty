import { EvergreenInput } from '../EvergreenExplainer'
import { MasterclassInput } from '../EvergreenMasterclass'

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
  photos: {
    intro: null,
    cashFlow: null,
    appreciation: null,
    loanPaydown: null,
    taxBenefits: null,
    outro: null,
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

/**
 * Default props for the new EvergreenMasterclass composition (v2).
 * Real props are written at render time by scripts/render-masterclass.mjs.
 */
export const defaultMasterclassProps: MasterclassInput = {
  chapterDurations: [18, 14, 22, 18, 16, 18, 16, 13], // sums to 135s
  voPath: 'masterclass/voiceover.mp3',
  musicPath: '4-pillars/music.mp3',
  captionWords: [],
  captionSentences: [],
  inputs: {
    purchasePrice: 500000,
    downPayment: 125000,
    loanAmount: 375000,
    interestRate: 0.07,
    termYears: 30,
    monthlyRent: 3000,
    monthlyPI: 2495,
    monthlyTaxes: 625,
    monthlyInsurance: 80,
    monthlyOpexReserves: 200,
    monthlyCashFlow: 200,
    appreciationRate: 0.03,
    depreciationYearly: 14545,
    depreciationYears: 27.5,
    taxBracket: 0.24,
  },
  // Placeholder — overwritten by render-masterclass.mjs from compute-equity-table series
  equitySeries: Array.from({ length: 21 }, (_, n) => ({
    year: n,
    cashFlow: 200 * 12 * n,
    appreciation: Math.round(500000 * (Math.pow(1.03, n) - 1)),
    loanPaydown: Math.round(n === 0 ? 0 : (n / 30) * 375000), // rough placeholder
    taxSavings: Math.round(14545 * 0.24 * n),
    total: 0,
  })).map((r) => ({ ...r, total: r.cashFlow + r.appreciation + r.loanPaydown + r.taxSavings })),
  photos: {
    intro: null,
    cashFlow: null,
    appreciation: null,
    loanPaydown: null,
    taxBenefits: null,
    outro: null,
  },
}
