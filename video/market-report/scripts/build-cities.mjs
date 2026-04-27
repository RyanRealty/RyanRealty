#!/usr/bin/env node
// Build Remotion props.json and VO script per city from verified data snapshots.
// Output: out/<slug>/props.json (no captionWords yet) + out/<slug>/script.json (VO segments)
// + out/<slug>/citations.json
//
// VO structure (55-58s target, ~750-820 chars):
//   seg-00-intro      (3.5-4.5s): city name + one anchoring framing sentence
//   seg-01-price-lbl  (2.5s):     "MEDIAN SALE PRICE" label beat
//   seg-02-price-val  (3.5s):     value + YoY
//   seg-03-supply-lbl (2.5s):     "MONTHS OF SUPPLY" label beat
//   seg-04-supply-val (3.5s):     value + market verdict
//   seg-05-dom-lbl    (2.5s):     "DAYS ON MARKET" label beat
//   seg-06-dom-val    (3.5s):     value + YoY framing
//   seg-07-stl-lbl    (2.5s):     "SALE TO LIST" label beat
//   seg-08-stl-val    (3.5s):     value + color sentence
//   seg-09-active     (5-7s):     active inventory count + closing observation
//   seg-10-outro      (5-7s):     CTA
// Total: 12 sub-beats = 12 × 3-4s + intro 4s + outro 6s = ~56s

import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const DATA = resolve(ROOT, 'data')
const OUT = resolve(ROOT, 'out')

const CITIES = [
  { slug: 'bend', dataFile: 'bend.json' },
  { slug: 'redmond', dataFile: 'redmond.json' },
  { slug: 'sisters', dataFile: 'sisters.json' },
  { slug: 'la-pine', dataFile: 'la pine.json' },
  { slug: 'prineville', dataFile: 'prineville.json' },
  { slug: 'sunriver', dataFile: 'sunriver.json' },
]

// Pronunciation overrides for ElevenLabs — phonetic respellings the model handles well.
const PRONOUNCE = {
  'Deschutes': 'duh-shoots',
  'La Pine': 'La Pine',
  'Sunriver': 'Sun River',
  'Sisters': 'Sisters',
  'Prineville': 'Prineville',
  'Redmond': 'Redmond',
  'Bend': 'Bend',
  'Tumalo': 'TOO-muh-low',
}

const slugToCity = (slug) => slug === 'la-pine' ? 'La Pine' : slug.charAt(0).toUpperCase() + slug.slice(1)

const fmtMoneyShort = (n) => {
  if (n == null) return '—'
  if (n >= 1_000_000) return '$' + (n / 1_000_000).toFixed(2).replace(/\.?0+$/, '') + 'M'
  if (n >= 1_000) {
    const k = Math.round(n / 1000)
    return '$' + k + 'K'
  }
  return '$' + Math.round(n).toLocaleString()
}

// Convert dollar amount to spoken words — round to nearest thousand for VO clarity
const moneyToWords = (n) => {
  const k = Math.round(n / 1000)
  if (k >= 1000) {
    // e.g. 1.2M
    const m = (n / 1_000_000).toFixed(1).replace(/\.0$/, '')
    return `${m} million dollars`
  }
  // Spell hundreds digit explicitly when non-zero: 699K → "six ninety-nine thousand"
  // Simple approach: speak the thousands number directly
  if (k >= 100) {
    const hundreds = Math.floor(k / 100)
    const remainder = k % 100
    const hundredWords = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine']
    const tensWords = ['', 'ten', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety']
    const onesWords = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
      'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen']
    let spoken = hundredWords[hundreds]
    if (remainder >= 20) {
      const tens = Math.floor(remainder / 10)
      const ones = remainder % 10
      spoken += ' ' + tensWords[tens]
      if (ones > 0) spoken += '-' + onesWords[ones]
    } else if (remainder > 0) {
      spoken += ' ' + onesWords[remainder]
    }
    return spoken.trim() + ' thousand dollars'
  }
  return `${k} thousand dollars`
}

// Spell out a percentage precisely — used for VO so Victoria speaks numbers correctly
const pctToWords = (p) => {
  const abs = Math.abs(p * 100)
  const rounded = Math.round(abs * 10) / 10
  const whole = Math.floor(rounded)
  const tenth = Math.round((rounded - whole) * 10)
  if (tenth === 0) return `${whole} percent`
  return `${whole} point ${tenth} percent`
}

// Spell a decimal number for VO (e.g. 5.8 → "five point eight")
const decimalToWords = (n) => {
  const rounded = Math.round(n * 10) / 10
  const whole = Math.floor(rounded)
  const tenth = Math.round((rounded - whole) * 10)
  const ones = ['zero','one','two','three','four','five','six','seven','eight','nine',
    'ten','eleven','twelve','thirteen','fourteen','fifteen','sixteen','seventeen','eighteen','nineteen',
    'twenty']
  if (tenth === 0) return ones[whole] || `${whole}`
  return `${ones[whole] || whole} point ${ones[tenth]}`
}

// Spell an integer for VO
const intToWords = (n) => {
  const digits = ['zero','one','two','three','four','five','six','seven','eight','nine',
    'ten','eleven','twelve','thirteen','fourteen','fifteen','sixteen','seventeen','eighteen','nineteen',
    'twenty','twenty-one','twenty-two','twenty-three','twenty-four','twenty-five','twenty-six','twenty-seven',
    'twenty-eight','twenty-nine','thirty','thirty-one','thirty-two','thirty-three','thirty-four',
    'thirty-five','thirty-six','thirty-seven','thirty-eight','thirty-nine','forty','forty-one','forty-two',
    'forty-three','forty-four','forty-five','forty-six','forty-seven','forty-eight','forty-nine','fifty',
    'fifty-one','fifty-two','fifty-three','fifty-four','fifty-five','fifty-six','fifty-seven','fifty-eight',
    'fifty-nine','sixty','sixty-one','sixty-two','sixty-three','sixty-four','sixty-five','sixty-six',
    'sixty-seven','sixty-eight','sixty-nine','seventy','seventy-one','seventy-two','seventy-three',
    'seventy-four','seventy-five','seventy-six','seventy-seven','seventy-eight','seventy-nine','eighty',
    'eighty-one','eighty-two','eighty-three','eighty-four','eighty-five','eighty-six','eighty-seven',
    'eighty-eight','eighty-nine','ninety','ninety-one','ninety-two','ninety-three','ninety-four',
    'ninety-five','ninety-six','ninety-seven','ninety-eight','ninety-nine','one hundred']
  if (n >= 0 && n < digits.length) return digits[n]
  if (n >= 100 && n < 1000) {
    const h = Math.floor(n / 100)
    const rem = n % 100
    const hw = digits[h] + ' hundred'
    if (rem === 0) return hw
    if (rem < digits.length) return hw + ' ' + digits[rem]
    // rem >= 100 won't happen since we're in [100,999]
    const tens2 = Math.floor(rem / 10)
    const ones2 = rem % 10
    const tensWords = ['', 'ten', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety']
    let part = tensWords[tens2]
    if (ones2 > 0) part += '-' + digits[ones2]
    return hw + ' ' + part
  }
  if (n >= 1000 && n < 10000) {
    const thousands = Math.floor(n / 1000)
    const rem = n % 1000
    const tWord = digits[thousands] + ' thousand'
    if (rem === 0) return tWord
    return tWord + ' ' + intToWords(rem)
  }
  return `${n}`
}

const monthName = (iso) => {
  const m = ['January','February','March','April','May','June','July','August','September','October','November','December']
  return m[new Date(iso + 'T12:00:00').getMonth()]
}

// Estimate VO duration from character count (ElevenLabs avg ~0.068s/char of speech)
const estimateDur = (text) => text.replace(/[^a-zA-Z0-9\s]/g, '').length * 0.068

const planForCity = (data) => {
  const city = data.city
  const cityVo = PRONOUNCE[city] || city
  const pulse = data.pulse
  const ytd = data.ytd_2026
  const der = data.derived

  // ---- Core stats ----
  const medianSale = ytd.medianSalePrice
  const yoy = der.yoy_median_sale_price
  const yoyPct = (yoy * 100)
  const yoyDir = yoy > 0.005 ? 'up' : yoy < -0.005 ? 'down' : 'flat'
  const yoyText = yoyDir === 'flat'
    ? 'flat vs 2025'
    : `${yoyDir === 'up' ? '+' : ''}${yoyPct.toFixed(1)}% vs 2025`

  const yoyVoText = yoyDir === 'up'
    ? `up ${pctToWords(Math.abs(yoy))} from last year`
    : yoyDir === 'down'
    ? `down ${pctToWords(Math.abs(yoy))} from last year`
    : `flat versus last year`

  const active = pulse.active_count
  const mos = pulse.months_of_supply
  const klass = der.market_classification
  const klassPill = klass === 'seller' ? "SELLER'S MARKET"
    : klass === 'balanced' ? 'BALANCED MARKET'
    : "BUYER'S MARKET"
  const klassVo = klass === 'seller' ? "a seller's market"
    : klass === 'balanced' ? 'a balanced market'
    : "a buyer's market"
  const klassImplication = klass === 'seller'
    ? 'Inventory is tight and pricing has held.'
    : klass === 'balanced'
    ? 'Buyers have options but the market is not soft.'
    : 'Buyers are in control. Sellers need to price to move.'

  const dom = Math.round(ytd.medianDOM)
  const slPct = ytd.medianSaleToOriginalListRatio * 100
  const slPctDisplay = slPct.toFixed(1).replace(/\.0$/, '')
  const slPctVoText = pctToWords(Math.abs(ytd.medianSaleToOriginalListRatio))
  const slColor = slPct >= 99
    ? 'Pricing has held. Sellers are getting full ask.'
    : slPct >= 97
    ? 'Negotiation is limited. Pricing has been firm.'
    : slPct >= 95
    ? 'There is room to negotiate, but not much.'
    : 'Buyers are finding room to negotiate on price.'

  const slBarPct = Math.max(0.05, Math.min(1, (slPct - 80) / 20))
  const ppsf = ytd.medianPPSF

  // YoY DOM framing
  const domYoY = der.yoy_median_dom
  const domYoYAbs = Math.abs(domYoY * 100)
  let domYoYVo = ''
  if (Math.abs(domYoYAbs) < 3) {
    domYoYVo = 'Pace is about the same as last year.'
  } else if (domYoY < 0) {
    const days2025 = Math.round(data.ytd_2025.medianDOM)
    const diff = days2025 - dom
    domYoYVo = diff === 1
      ? 'One day faster than last year.'
      : `${intToWords(diff)} days faster than last year.`
  } else {
    const days2025 = Math.round(data.ytd_2025.medianDOM)
    const diff = dom - days2025
    domYoYVo = diff === 1
      ? 'One day slower than last year.'
      : `${intToWords(diff)} days slower than last year.`
  }

  // Intro framing sentence — anchored in data, short declarative
  let introFraming = ''
  if (klass === 'seller') {
    introFraming = `With ${decimalToWords(mos)} months of supply, inventory is tight.`
  } else if (klass === 'balanced') {
    introFraming = `At ${decimalToWords(mos)} months of supply, this market is balanced.`
  } else {
    introFraming = `At ${decimalToWords(mos)} months of supply, buyers hold the cards.`
  }

  // Active inventory closing observation
  let activeObs = ''
  const pendingToActive = pulse.pending_to_active_ratio
  if (pendingToActive >= 0.4) {
    activeObs = 'Pending contracts are strong relative to active supply.'
  } else if (pendingToActive >= 0.25) {
    activeObs = 'Pending volume is moderate against current inventory.'
  } else {
    activeObs = 'A lot of supply, not enough buyers pulling the trigger.'
  }

  // ---- Sub-beat structure (12 beats + intro + outro = 14 sequences) ----
  // Beats 1-10: 5 stats × 2 sub-beats each (label card 2.5s, value card 3.5s)
  // Beat 11: active inventory (single beat, 5s)
  // Outro: 6s
  // Intro: 4s
  // Total target: 4 + (5×(2.5+3.5)) + 5 + 6 = 4 + 30 + 5 + 6 = 45s ... need more
  // Revised: use 3.5s labels + 4.5s values: 4 + (5×8) + 6 + 6 = 56s ✓

  const segments = [
    {
      id: 'intro',
      text: `${cityVo} homes, year-to-date 2026. ${introFraming}`,
    },
    {
      id: 'price-lbl',
      text: `Median sale price.`,
    },
    {
      id: 'price-val',
      // One punchy sentence: value + direction. Context shows on screen silently.
      text: `${moneyToWords(medianSale)} this year, ${yoyVoText}.`,
    },
    {
      id: 'supply-lbl',
      text: `Months of supply.`,
    },
    {
      id: 'supply-val',
      // State the number + market classification in one beat.
      text: `${decimalToWords(mos)} months. ${klassVo}.`,
    },
    {
      id: 'dom-lbl',
      text: `Median days on market.`,
    },
    {
      id: 'dom-val',
      // Number + one YoY sentence.
      text: `${intToWords(dom)} days to contract. ${domYoYVo}`,
    },
    {
      id: 'stl-lbl',
      text: `Sale to list ratio.`,
    },
    {
      id: 'stl-val',
      // One clear data sentence. Color sentence shows on screen.
      text: `Sellers getting ${slPctVoText} of ask. ${slColor}`,
    },
    {
      id: 'active',
      // Active count + observation. Use numeric string — ElevenLabs handles naturally.
      text: `${active} homes active. ${activeObs}`,
    },
    {
      id: 'outro',
      text: `Full report at ryan-realty.com. Subscribe for monthly updates.`,
    },
  ]

  // Estimate total VO duration
  const totalChars = segments.reduce((s, seg) => s + seg.text.length, 0)
  const estDur = segments.reduce((s, seg) => s + estimateDur(seg.text), 0)
  console.log(`  ${city}: ${segments.length} segments, ~${totalChars} chars, est VO ${estDur.toFixed(1)}s`)
  if (estDur < 40 || estDur > 62) {
    console.warn(`  WARNING: ${city} estimated VO ${estDur.toFixed(1)}s is outside 40-62s window. Review script.`)
  }

  // ---- Stats array for Remotion composition ----
  // Structure: intro (1) + 12 sub-beats (stat 1-5 × 2 + active × 1) + outro (1) = 14 total
  // StatBeat index maps to these sub-beat pairs.
  // We pass a flat stats array where the composition renders them sequentially.
  // Sub-beat 1 for each stat = label card (minimal text, big label)
  // Sub-beat 2 for each stat = value + YoY pill + context
  const stats = [
    // Stat 1 — Median Sale Price (2 sub-beats)
    {
      label: 'Median Sale Price',
      value: '',
      layout: 'label-only',
      bgVariant: 'navy',
    },
    {
      label: 'Median Sale Price',
      value: fmtMoneyShort(medianSale),
      layout: 'hero',
      bgVariant: 'navy',
      changeText: yoyText,
      changeDir: yoyDir,
      context: `YTD ${ytd.count} closed homes`,
    },
    // Stat 2 — Months of Supply (2 sub-beats)
    {
      label: 'Months of Supply',
      value: '',
      layout: 'label-only',
      bgVariant: 'navy-rich',
    },
    {
      label: 'Months of Supply',
      value: mos.toFixed(1).replace(/\.0$/, ''),
      unit: 'mo',
      layout: 'callout',
      bgVariant: 'navy-rich',
      pillText: klassPill,
      context: klassImplication,
    },
    // Stat 3 — Days on Market (2 sub-beats)
    {
      label: 'Days on Market',
      value: '',
      layout: 'label-only',
      bgVariant: 'gold-tint',
    },
    {
      label: 'Days on Market',
      value: String(dom),
      unit: 'days',
      layout: 'hero',
      bgVariant: 'gold-tint',
      context: domYoYVo,
    },
    // Stat 4 — Sale-to-List (2 sub-beats)
    {
      label: 'Sale-to-List Ratio',
      value: '',
      layout: 'label-only',
      bgVariant: 'cream',
    },
    {
      label: 'Sale-to-List Ratio',
      value: slPctDisplay,
      unit: '%',
      layout: 'bar',
      bgVariant: 'cream',
      barPct: slBarPct,
      context: slColor,
    },
    // Stat 5 — Active Inventory (1 beat — wider context)
    {
      label: 'Active Listings',
      value: active.toLocaleString(),
      layout: 'compare',
      bgVariant: 'navy',
      context: `${pulse.pending_count} pending · ${pulse.new_count_30d} new last 30 days`,
    },
  ]

  // Citations — every on-screen number traces to source
  const citations = {
    deliverable: `${city} Market Report YTD 2026`,
    rendered_at: new Date().toISOString(),
    verified_at: data.verified_at,
    source_primary: data.sources.live,
    source_secondary: data.sources.ytd_closed,
    sfr_filter: data.sfr_filter,
    period: data.period,
    figures: [
      {
        stat: 'Median Sale Price (YTD 2026)',
        on_screen: fmtMoneyShort(medianSale),
        exact: medianSale,
        query: `listings WHERE City ilike '${city}' AND StandardStatus ilike '%Closed%' AND CloseDate IN [${data.period.ytd_start}, ${data.period.ytd_end}] AND PropertyType='A', median(ClosePrice). n=${ytd.count} SFR.`,
      },
      {
        stat: 'YoY Median Sale Price',
        on_screen: yoyText,
        direction: yoyDir,
        exact: yoy,
        query: `(medianSale2026=${medianSale} - medianSale2025=${data.ytd_2025.medianSalePrice}) / medianSale2025. n2025=${data.ytd_2025.count}`,
      },
      {
        stat: 'Active Listings',
        on_screen: active.toLocaleString(),
        exact: active,
        query: `market_pulse_live property_type='A' geo_slug='${city.toLowerCase()}', updated_at=${pulse.pulse_updated_at}`,
      },
      {
        stat: 'Pending Listings',
        on_screen: `${pulse.pending_count}`,
        exact: pulse.pending_count,
        query: `market_pulse_live pending_count`,
      },
      {
        stat: 'New 30d',
        on_screen: `${pulse.new_count_30d}`,
        exact: pulse.new_count_30d,
        query: `market_pulse_live new_count_30d`,
      },
      {
        stat: 'Months of Supply',
        on_screen: mos.toFixed(1),
        exact: mos,
        query: `market_pulse_live months_of_supply (active / 90d sold run-rate)`,
      },
      {
        stat: 'Market Classification',
        on_screen: klassPill,
        exact: klass,
        query: `MoS ${mos.toFixed(2)} => seller (<4) | balanced (4-6) | buyer (>=6)`,
      },
      {
        stat: 'Median Days on Market',
        on_screen: `${dom} days`,
        exact: ytd.medianDOM,
        query: `listings YTD 2026 closed SFR, median(DaysOnMarket). n=${ytd.count}`,
      },
      {
        stat: 'Sale-to-List Ratio',
        on_screen: `${slPctDisplay}%`,
        exact: ytd.medianSaleToOriginalListRatio,
        query: `listings YTD 2026 closed SFR, median(ClosePrice/OriginalListPrice). n=${ytd.saleToListSampleSize}, clamped 0.5-1.5`,
      },
      {
        stat: 'Median $ / SqFt',
        on_screen: `$${ppsf}`,
        exact: ppsf,
        query: `listings YTD 2026 closed SFR, median(ClosePrice/TotalLivingAreaSqFt). n=${ytd.count}`,
      },
    ],
  }

  // Composition props (captionWords + beatDurations filled by synth-vo.mjs)
  // beatDurations: 1 intro + 9 stat sub-beats (4+1 active) + 1 outro = 11 entries
  // Defaults (synth-vo will override with VO-length-driven values):
  //   intro: 4s, label beats: 3.5s, value beats: 4.5s, active: 5.5s, outro: 6s
  const defaultBeatDurations = [
    4.0,    // intro
    3.5, 4.5, // stat 1 label + value
    3.5, 4.5, // stat 2 label + value
    3.5, 4.5, // stat 3 label + value
    3.5, 4.5, // stat 4 label + value
    5.5,    // active inventory (single beat)
    6.0,    // outro
  ]
  const totalDefault = defaultBeatDurations.reduce((s, x) => s + x, 0)
  console.log(`  ${city}: default beat total ${totalDefault.toFixed(1)}s (target 55-58s)`)

  const props = {
    city,
    citySlug: city.toLowerCase().replace(/\s+/g, '-'),
    period: '2026',
    subhead: `YTD Market Report ${monthName(data.period.ytd_end)} 2026`,
    voPath: 'voiceover.mp3',
    captionWords: [],
    beatDurations: defaultBeatDurations,
    stats,
  }

  return { props, segments, citations }
}

await mkdir(OUT, { recursive: true })
for (const { slug, dataFile } of CITIES) {
  const dataPath = resolve(DATA, dataFile)
  const raw = JSON.parse(await readFile(dataPath, 'utf8'))
  const { props, segments, citations } = planForCity(raw)
  const cityOut = resolve(OUT, slug)
  await mkdir(cityOut, { recursive: true })
  await writeFile(resolve(cityOut, 'props.json'), JSON.stringify(props, null, 2))
  await writeFile(resolve(cityOut, 'script.json'), JSON.stringify({ city: raw.city, segments }, null, 2))
  await writeFile(resolve(cityOut, 'citations.json'), JSON.stringify(citations, null, 2))
  console.log(`  Built ${slug}: ${segments.length} VO segments, ${props.stats.length} stat sub-beats`)
}
console.log('\nAll 6 cities planned. Next: scripts/synth-vo.mjs')
