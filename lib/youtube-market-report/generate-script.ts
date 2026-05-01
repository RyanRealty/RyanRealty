/**
 * generate-script.ts — turn a populated VideoProps into the per-scene
 * voiceover script + YouTube publish metadata.
 *
 * Deterministic template fill-in. Anti-slop validation runs as a hard
 * post-pass; any banned-word hit throws so the orchestrator can decide
 * whether to retry, edit, or escalate.
 *
 * The output script is ready for ElevenLabs ingestion: numbers spelled out,
 * IPA-tagged place names, no banned punctuation.
 *
 * Hard rules (per skills/youtube-market-reports/SKILL.md Section 9.3 and
 * pipeline.md Phase 3):
 *   - No banned words (script-helpers.BANNED_WORDS).
 *   - No em-dashes, semicolons, exclamation marks (sanitizePunctuation).
 *   - Numbers spelled out (spellNumbersInLine).
 *   - IPA tags for tricky place names (tagPhonemes).
 *   - 150 WPM target pacing — emit a wpm estimate so the caller can flag drift.
 */

import {
  formatPercent,
  formatPriceCompact,
} from './aggregations';
import {
  findBannedTokens,
  sanitizePunctuation,
  spellNumbersInLine,
  tagPhonemes,
} from './script-helpers';
import type {
  VideoProps,
  YouTubeMetadata,
} from '../../video/market-report/src/VideoProps';

// ---------------------------------------------------------------------------
// Output shape
// ---------------------------------------------------------------------------

export interface SceneScript {
  /** 0-8. Index into the storyboard. */
  sceneIndex: number;
  /** Display text shown in captions and the script document — human-readable. */
  text: string;
  /** ElevenLabs-ready text — numbers spelled out, IPA tags for place names. */
  ttsText: string;
  /** Word count of the display text (basis for WPM estimation). */
  wordCount: number;
}

export interface ScriptBundle {
  scenes: SceneScript[];
  totalWordCount: number;
  /** Estimated runtime in seconds at 150 WPM. */
  estimatedDurationSeconds: number;
  /** Throws-on-banned-words validator output. Empty array means clean. */
  bannedWordHits: string[];
  /** YouTube publish metadata derived from the script + props. */
  youtube: YouTubeMetadata;
}

export class ScriptValidationError extends Error {
  constructor(
    message: string,
    readonly hits: readonly string[],
    readonly sceneIndex: number,
  ) {
    super(message);
    this.name = 'ScriptValidationError';
  }
}

// ---------------------------------------------------------------------------
// Per-scene template fill-in
// ---------------------------------------------------------------------------

function buildScene0Text(props: VideoProps): string {
  const { scene0, period } = props;
  const dirWord = scene0.direction === 'up' ? 'climbed' : scene0.direction === 'down' ? 'eased' : 'held';
  return [
    `${period.monthName} was a ${scene0.characterization} month for ${props.market} real estate.`,
    `The median home price ${dirWord} to ${formatPriceCompact(scene0.medianPrice)}.`,
    `But the number that really tells the story this month is ${anchorPhrase(scene0.anchorStatName)}: ${scene0.anchorStatDisplay}.`,
  ].join(' ');
}

function buildScene1Text(props: VideoProps): string {
  return [
    `This is the Ryan Realty Market Report for ${props.scene1.monthYear}.`,
    `Every month, the real MLS data for ${props.market} and Central Oregon, broken down for you.`,
    'No opinions, just numbers.',
  ].join(' ');
}

function buildScene2Text(props: VideoProps): string {
  const { scene2 } = props;
  const dirWord = scene2.yoyDirection === 'up' ? 'up' : scene2.yoyDirection === 'down' ? 'down' : 'flat';
  const yoyClause = Number.isFinite(scene2.yoyPct)
    ? `${dirWord} ${formatPercent(scene2.yoyPct, { arrow: false })} from ${formatPriceCompact(scene2.priorYearMedian)} a year ago`
    : 'with limited prior-year comparison data';
  return [
    `Here is ${props.market}'s median sale price over the last two years.`,
    `In ${scene2.currentMonthLabel}, the median landed at ${formatPriceCompact(scene2.currentMedian)}, ${yoyClause}.`,
    scene2.trendDescription,
    scene2.interpretation,
  ].join(' ');
}

function buildScene3Text(props: VideoProps): string {
  const { scene3 } = props;
  const dirWord = scene3.sfrDirection === 'up' ? 'up' : scene3.sfrDirection === 'down' ? 'down' : 'flat';
  const sfrPpsfTxt = Number.isFinite(scene3.sfrPpsf) ? `$${Math.round(scene3.sfrPpsf)}` : 'an unavailable amount';
  const yoyTxt = Number.isFinite(scene3.sfrPct)
    ? `${dirWord} ${formatPercent(scene3.sfrPct, { arrow: false })} from last year`
    : 'with limited prior-year data';
  return [
    'Price per square foot tells a different story than raw sale price.',
    `Single family homes in ${props.market} are at ${sfrPpsfTxt} per square foot, ${yoyTxt}.`,
    scene3.condoComparison,
    scene3.manufacturedComparison,
  ].join(' ');
}

function buildScene4Text(props: VideoProps): string {
  const { scene4 } = props;
  const invDir = scene4.inventoryDirection === 'up' ? 'up' : scene4.inventoryDirection === 'down' ? 'down' : 'flat';
  const yoyClause = Number.isFinite(scene4.inventoryPct) && scene4.activeCountPriorYear > 0
    ? `That is ${invDir} ${formatPercent(scene4.inventoryPct, { arrow: false })} from last year.`
    : 'Year-over-year inventory comparison is unavailable for this snapshot.';
  const mosTxt = Number.isFinite(scene4.monthsOfSupply) ? scene4.monthsOfSupply.toFixed(1) : 'an unavailable';
  return [
    `There are currently ${scene4.activeCount} single-family homes for sale in ${props.market}.`,
    yoyClause,
    `At the current pace of sales, that gives us ${mosTxt} months of supply.`,
    scene4.marketConditionExplanation,
  ].join(' ');
}

function buildScene5Text(props: VideoProps): string {
  const { scene5 } = props;
  const fmtDays = (n: number) => (Number.isFinite(n) ? `${Math.round(n)} days` : 'unavailable');
  const absorbTxt = Number.isFinite(scene5.absorptionRatePct)
    ? `${formatPercent(scene5.absorptionRatePct, { arrow: false })}`
    : 'unavailable';
  return [
    'How long are homes sitting on the market?',
    `Under five hundred thousand, the median is ${fmtDays(scene5.domUnder500k)}.`,
    `Between five hundred and seven hundred thousand, ${fmtDays(scene5.dom500to700k)}.`,
    `Above a million dollars, expect ${fmtDays(scene5.dom1mPlus)}.`,
    `The absorption rate is ${absorbTxt}, meaning ${scene5.absorptionInterpretation.toLowerCase()}`,
  ].join(' ');
}

function buildScene6Text(props: VideoProps): string {
  const { scene6 } = props;
  const high = scene6.byZip.find((z) => z.postalCode === scene6.highestPriceZip);
  const low = scene6.byZip.find((z) => z.postalCode === scene6.bestValueZip);
  const hot = scene6.byZip.find((z) => z.postalCode === scene6.hottestZip);
  const lines = ['Now the neighborhood breakdown.'];
  if (high) {
    lines.push(`The ${high.areaName.toLowerCase()}, ZIP ${high.postalCode}, remains the most expensive area with a median of ${formatPriceCompact(high.medianPrice)}.`);
  }
  if (low && low.postalCode !== high?.postalCode) {
    lines.push(`The ${low.areaName.toLowerCase()}, ${low.postalCode}, continues to offer the best value at ${formatPriceCompact(low.medianPrice)}.`);
  }
  if (hot && Number.isFinite(hot.yoyPct)) {
    lines.push(`The biggest mover this month was ${hot.postalCode} at ${formatPercent(hot.yoyPct, { arrow: false })} year over year.`);
  }
  return lines.join(' ');
}

function buildScene7Text(props: VideoProps): string {
  const { scene7 } = props;
  const lines = ['So what does this mean for you?'];
  if (scene7.buyerTakeaways.length > 0) {
    lines.push(`Buyers: ${scene7.buyerTakeaways.join(' ')}`);
  }
  if (scene7.sellerTakeaways.length > 0) {
    lines.push(`Sellers: ${scene7.sellerTakeaways.join(' ')}`);
  }
  return lines.join(' ');
}

function buildScene8Text(props: VideoProps): string {
  const { scene8, period } = props;
  return [
    `That is the ${period.monthName} data.`,
    `If this was useful, subscribe for the next report on ${scene8.nextReportDate}.`,
    `Questions about any of these numbers? Reach out at ${scene8.url}.`,
    'I am Matt Ryan with Ryan Realty. I will see you in the data.',
  ].join(' ');
}

function anchorPhrase(name: string): string {
  switch (name) {
    case 'median_price': return 'the median sale price';
    case 'median_days_to_pending': return 'how fast homes are going under contract';
    case 'months_of_supply': return 'months of supply';
    case 'sale_to_list': return 'the sale-to-list ratio';
    case 'absorption_rate': return 'the absorption rate';
    case 'inventory_yoy': return 'inventory change year over year';
    default: return name;
  }
}

// ---------------------------------------------------------------------------
// YouTube metadata
// ---------------------------------------------------------------------------

function buildYouTubeMetadata(props: VideoProps): YouTubeMetadata {
  const medianTxt = formatPriceCompact(props.scene2.currentMedian);
  const title = clipTitle(`${props.market} Oregon Housing: Median Hits ${medianTxt} | ${props.period.label} Market Data`);
  const titleVariants: readonly string[] = [
    clipTitle(`${props.market} Real Estate Update: ${medianTxt} Median, ${props.scene4.activeCount} Active`),
    clipTitle(`${props.period.monthName} ${props.period.year}: ${props.scene0.closedCount} Homes Closed in ${props.market}`),
  ];

  const description = [
    `${props.market} Oregon market data for ${props.period.label}.`,
    `Median sale price ${medianTxt}, ${props.scene4.activeCount} active listings, ${Number.isFinite(props.scene4.monthsOfSupply) ? `${props.scene4.monthsOfSupply.toFixed(1)} months of supply` : 'inventory snapshot'}.`,
    'Days to pending, neighborhood breakdown, buyer/seller takeaways inside.',
  ].join(' ');

  return {
    title,
    titleVariants,
    description,
    tags: [
      `${props.market.toLowerCase()} oregon real estate`,
      'central oregon homes',
      `${props.market.toLowerCase()} housing market`,
      'oregon real estate',
      'monthly market report',
    ],
    categoryId: 25,
    hashtags: [
      `#${props.market.replace(/\s+/g, '')}OregonRealEstate`,
      '#CentralOregonHomes',
      `#${props.market.replace(/\s+/g, '')}HousingMarket`,
    ],
    publishAtIso: defaultPublishAt(props.period),
  };
}

function clipTitle(s: string): string {
  return s.length <= 60 ? s : `${s.slice(0, 59)}…`;
}

function defaultPublishAt(period: VideoPeriod): string {
  const [y, m] = period.monthId.split('-').map((s) => parseInt(s, 10));
  // Default to the second Sunday after month-end at 10am PT.
  // Build at noon UTC so the Pacific-zone formatter doesn't slide the day.
  const nextMonth = m === 12 ? 1 : m! + 1;
  const nextYear = m === 12 ? y! + 1 : y!;
  const candidate = new Date(Date.UTC(nextYear, nextMonth - 1, 14, 17, 0, 0)); // 10am PT == 17:00 UTC during PDT
  return candidate.toISOString();
}

// Re-import for the helper above.
import type { VideoPeriod } from '../../video/market-report/src/VideoProps';

// ---------------------------------------------------------------------------
// Top-level entry point
// ---------------------------------------------------------------------------

export interface GenerateScriptInput {
  props: VideoProps;
  /**
   * If `true` (default), throw on any banned-word hit. Set false to allow
   * downstream review (e.g. surface to Matt for manual fix).
   */
  strict?: boolean;
  /** Words per minute for runtime estimation. Default 150. */
  wpm?: number;
}

export function generateScript(input: GenerateScriptInput): ScriptBundle {
  const strict = input.strict ?? true;
  const wpm = input.wpm ?? 150;

  const builders: Array<(p: VideoProps) => string> = [
    buildScene0Text,
    buildScene1Text,
    buildScene2Text,
    buildScene3Text,
    buildScene4Text,
    buildScene5Text,
    buildScene6Text,
    buildScene7Text,
    buildScene8Text,
  ];

  const scenes: SceneScript[] = [];
  const allHits: string[] = [];
  let totalWords = 0;

  for (let i = 0; i < builders.length; i += 1) {
    const rawText = builders[i]!(input.props);
    const sanitized = sanitizePunctuation(rawText);
    const ttsBare = spellNumbersInLine(sanitized);
    const ttsText = tagPhonemes(ttsBare);

    const hits = findBannedTokens(sanitized);
    if (hits.length > 0) {
      allHits.push(...hits);
      if (strict) {
        throw new ScriptValidationError(
          `Scene ${i} script tripped banned-word filter: ${hits.join(', ')}`,
          hits,
          i,
        );
      }
    }

    const wordCount = countWords(sanitized);
    totalWords += wordCount;
    scenes.push({ sceneIndex: i, text: sanitized, ttsText, wordCount });
  }

  return {
    scenes,
    totalWordCount: totalWords,
    estimatedDurationSeconds: Math.round((totalWords / wpm) * 60),
    bannedWordHits: allHits,
    youtube: buildYouTubeMetadata(input.props),
  };
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}
