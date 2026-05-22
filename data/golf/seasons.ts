/**
 * Central Oregon golf season calendar — month-by-month playing conditions.
 *
 * Source: out/golf-lp-research/research-notes.md §8.
 * Temperature data sourced from NOAA Bend Airport (KBDN) climate normals
 * 1991-2020. Locals\' notes verified via published interviews with course
 * superintendents (research file footnotes).
 *
 * Voice rules per CLAUDE.md §3 — no banned words. Stays factual + direct.
 */

export interface SeasonMonth {
  month: string
  avgHighF: number
  avgLowF: number
  /** Most courses' playing status this month. */
  courseStatus:
    | 'mostly-closed'
    | 'shoulder'
    | 'prime'
    | 'high-season'
    | 'late-season'
  /** Local move — what an experienced player does this month. */
  localsMove: string
}

export const GOLF_SEASON: SeasonMonth[] = [
  {
    month: 'January',
    avgHighF: 41,
    avgLowF: 22,
    courseStatus: 'mostly-closed',
    localsMove:
      'Eagle Crest Ridge and Meadow Lakes are the year-round options if a thaw window opens. Bring the all-weather glove.',
  },
  {
    month: 'February',
    avgHighF: 46,
    avgLowF: 25,
    courseStatus: 'mostly-closed',
    localsMove:
      'Same year-round shortlist as January. Tee times widely available; play before 2pm to beat the freeze.',
  },
  {
    month: 'March',
    avgHighF: 52,
    avgLowF: 28,
    courseStatus: 'shoulder',
    localsMove:
      'Most of the high-desert public courses begin opening in late March. River\'s Edge and Widgi Creek typically first.',
  },
  {
    month: 'April',
    avgHighF: 59,
    avgLowF: 32,
    courseStatus: 'shoulder',
    localsMove:
      'Tetherow opens. Glaze Meadow opens. Greens are slower, conditioning still ramping. Shoulder-rate prices.',
  },
  {
    month: 'May',
    avgHighF: 66,
    avgLowF: 37,
    courseStatus: 'shoulder',
    localsMove:
      'Every destination course is open. Bunkers still occasionally soft. Beat the summer rates before Memorial Day.',
  },
  {
    month: 'June',
    avgHighF: 74,
    avgLowF: 42,
    courseStatus: 'prime',
    localsMove:
      'The play of the year. Dry fairways, long daylight, shoulder rates at most courses through mid-June.',
  },
  {
    month: 'July',
    avgHighF: 84,
    avgLowF: 47,
    courseStatus: 'high-season',
    localsMove:
      'High-season rates in full effect. Tee off before 8am or after 4pm — the afternoons run hot and the smoke season starts late month.',
  },
  {
    month: 'August',
    avgHighF: 84,
    avgLowF: 47,
    courseStatus: 'high-season',
    localsMove:
      'Smoke from regional fires can interrupt play. AirNow.gov before you commit. Cooler resort-course mornings.',
  },
  {
    month: 'September',
    avgHighF: 75,
    avgLowF: 39,
    courseStatus: 'prime',
    localsMove:
      'Many locals\' favorite month. Crowds thin after Labor Day, weather holds, larch trees start their gold turn at Black Butte.',
  },
  {
    month: 'October',
    avgHighF: 62,
    avgLowF: 32,
    courseStatus: 'late-season',
    localsMove:
      'Shoulder rates return mid-October. Aerification windows hit some courses; check before booking. Last reliable month for Brasada and Crosswater.',
  },
  {
    month: 'November',
    avgHighF: 48,
    avgLowF: 27,
    courseStatus: 'late-season',
    localsMove:
      'Most resort courses close by mid-November. Eagle Crest Ridge and Meadow Lakes stay open weather-permitting.',
  },
  {
    month: 'December',
    avgHighF: 41,
    avgLowF: 23,
    courseStatus: 'mostly-closed',
    localsMove:
      'Same year-round shortlist. Cheap rates, midday-only play, frost-delay common.',
  },
]
