#!/usr/bin/env node
/**
 * v10 seller-lead ads — curated copy combos that FLOW.
 *
 * Per Matt 2026-05-28: headlines tie directly into subheadings, reviews
 * provide the proof point the headline asks for, CTAs match the action verb,
 * trust signal lives at the bottom of every ad.
 *
 * Voice pass 2026-05-29 (Matt): confident + full-service. Killed the soft
 * "we'd be grateful / honored to earn your trust" closers (read like begging).
 * Subheadings now LEAD with what our team does: full-service, end-to-end. We
 * handle the prep, the repairs, and the sale through our trusted local network,
 * even for out-of-area sellers. The ask is a confident statement of value, not
 * sympathy-seeking: "That's how we earn your business." / "Let us earn your
 * business." rotated with no-pressure value closers ("No pressure, just the
 * data." / "Real numbers, no guesswork." / "On your timeline, no pressure.")
 * so 30 ads don't read identically. First person throughout: "we" and "our
 * team," never a third-person "a local team" / "a broker." Each sub still
 * ANSWERS its headline and keeps a concrete anchor (a number, sold comps, the
 * market, repairs, timeline), so it reads warm AND specific, not fluffy.
 * NOTE: "white glove" / "concierge" (Matt's shorthand for the concept) are in
 * the BANNED gate — the copy delivers the full-service idea without those words.
 * Headlines + reviews unchanged (hook + proof).
 *
 * All 24 GBP reviews read end-to-end. Best single impactful sentence pulled
 * from each. Matched to one of Matt's 6 headlines based on thematic fit.
 *
 * Layout (locked per Matt 2026-05-28):
 *   - Headline top (Instrument Serif Italic 84px)
 *   - Subheading below (National Park Bold 30px tracked caps)
 *   - Button below subheading
 *   - Photo dominates middle
 *   - Broker bottom-left (hugging the edge, ≤1/3 height)
 *   - Review quote bottom-right next to broker (Crimson Italic 40px)
 *   - NO brand mark top-left
 *   - NO "5★ · 24 reviews" tagline
 */
import { chromium } from 'playwright'
import { writeFile, mkdir, copyFile, readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { resolve, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const OUT_DIR = resolve(ROOT, 'out/seller-ad-concepts/v10')
const FONTS = resolve(OUT_DIR, 'fonts')
const THUMB_DIR = resolve(OUT_DIR, 'thumbs')

await mkdir(FONTS, { recursive: true })
await mkdir(THUMB_DIR, { recursive: true })
const CANVAS_FONTS = '/Users/matthewryan/Library/Application Support/Claude/local-agent-mode-sessions/skills-plugin/e399b1dc-7d6a-418b-8a3c-c124774e5958/f3aea35d-324b-4df4-a3ca-a265239c30ad/skills/canvas-design/canvas-fonts'
for (const f of ['InstrumentSerif-Italic.ttf', 'CrimsonPro-Italic.ttf', 'NationalPark-Regular.ttf', 'NationalPark-Bold.ttf']) {
  if (!existsSync(resolve(FONTS, f))) await copyFile(resolve(CANVAS_FONTS, f), resolve(FONTS, f))
}

const FONTS_CSS = `
  @font-face { font-family: 'Crimson Italic'; src: url('fonts/CrimsonPro-Italic.ttf') format('truetype'); font-display: block; }
  @font-face { font-family: 'Instrument Serif Italic'; src: url('fonts/InstrumentSerif-Italic.ttf') format('truetype'); font-display: block; }
  @font-face { font-family: 'National Park'; src: url('fonts/NationalPark-Regular.ttf') format('truetype'); font-display: block; }
  @font-face { font-family: 'National Park Bold'; src: url('fonts/NationalPark-Bold.ttf') format('truetype'); font-display: block; }
`

const MATT = `${ROOT}/design_system/ryan-realty/assets/team/matt-ryan.png`
const TEAM = `${ROOT}/design_system/ryan-realty/assets/team/team-transparent.png`
const LOGO_HORIZONTAL_WHITE = `${ROOT}/design_system/ryan-realty/assets/brand/logo-horizontal-white-transparent.png`

// ── Photo bank ─────────────────────────────────────────────────────────────
// Every photo hand-verified this session and matched to a life stage.
// pronghorn-01 / bend-hero are Old Mill aerials (Bend landmark, river + smokestacks).
// eagle-crest-01 is a home on the Deschutes river bluff. crosswater/tetherow are golf.
const P = {
  ranch:        `${ROOT}/data/comps/19496-tumalo-reservoir-rd-photos/20260323173005905886000000.jpg`, // single-level ranch, red door — DOWNSIZING
  farmhouse:    `${ROOT}/data/comps/19496-tumalo-reservoir-rd-photos/20251007172558986098000000.jpg`, // twilight modern farmhouse — NEXT CHAPTER / VALUE
  barnAerial:   `${ROOT}/data/comps/19496-tumalo-reservoir-rd-photos/20250924192941811834000000.jpg`, // farmhouse + barn acreage aerial
  creekAerial:  `${ROOT}/data/comps/19496-tumalo-reservoir-rd-photos/20250710153506405205000000.jpg`, // neighborhood-along-creek aerial
  schoolExt:    `${ROOT}/out/schoolhouse-just-sold/photos/mls-220221770-01.jpg`, // craftsman exterior — big home
  schoolGreat:  `${ROOT}/out/schoolhouse-just-sold/photos/mls-220221770-02.jpg`, // great room + fireplace
  schoolSuite:  `${ROOT}/out/schoolhouse-just-sold/photos/mls-220221770-03.jpg`, // primary suite
  schoolKitch:  `${ROOT}/out/schoolhouse-just-sold/photos/mls-220221770-04.jpg`, // kitchen
  oldMillA:     `${ROOT}/public/lp/central-oregon-golf/img/pronghorn-01.jpg`, // Old Mill aerial (river, flags, smokestacks)
  oldMillB:     `${ROOT}/public/lp/bend/img/bend-hero.jpg`,                     // Old Mill aerial (alt)
  golfPond:     `${ROOT}/public/lp/central-oregon-golf/img/crosswater-01.jpg`, // golf course + pond + Cascades
  golfTetherow: `${ROOT}/public/lp/tetherow/img/tetherow-aerial-course.jpg`,   // golden-hour golf aerial
  riverHome:    `${ROOT}/public/lp/central-oregon-golf/img/eagle-crest-01.jpg`,// home on Deschutes river bluff
  cascades:     `${ROOT}/public/lp/central-oregon-golf/img/three-sisters-backdrop.jpg`, // Cascades through pines
  tumaloCraftsman: `${ROOT}/data/comps/19496-tumalo-reservoir-rd-photos/20260310224736943770000000.jpg`, // real craftsman entry, green board-and-batten, wood porch — REAL HOME for Zestimate angle (note: 800x600, softest in set)
  awbreyAerial: `${ROOT}/public/lp/central-oregon-golf/img/awbrey-glen-02.jpg`,  // Awbrey Glen golf aerial w/ Cascades — upscale westside
  awbreySign:   `${ROOT}/public/lp/central-oregon-golf/img/awbrey-glen-01.jpg`,  // Awbrey Glen entrance monument — hyper-local recognition
  nwCrossing:   `${ROOT}/out/seller-ad-concepts/assets/nw-crossing-02.jpg`,      // NW Crossing roundabout + craftsman district (real, Drive area-guide)
  // ── 2026-06-09 asset-library curated additions (license: owned, visually verified this session) ──
  alOldMill:    `${ROOT}/public/asset-library/photos/enhanced/429e7228-96fa-4dd3-9b0d-4b1da3982741-enhanced.jpg`, // Old Mill aerial: smokestacks, footbridge flags, Deschutes (4200x2957)
  alRiverWest:  `${ROOT}/public/asset-library/photos/enhanced/ba294855-26c1-493e-a07a-752fa6151eb4-enhanced.jpg`, // River West footbridge over Deschutes, Cascades horizon (3840x2160)
  alTetherow:   `${ROOT}/public/asset-library/photos/enhanced/c5a01c8a-7dc1-4579-9896-63781151ccd2-enhanced.jpg`, // Tetherow golf, high desert, snow-capped Cascades, modern homes (4200x3150)
  alNwxPond:    `${ROOT}/public/asset-library/photos/enhanced/45ee98f1-cf09-4bf0-8100-69a2c1d34fdb-enhanced.jpg`, // NW Crossing Discovery Park pond + homes (4200x3150)
  alWidgi:      `${ROOT}/public/asset-library/photos/enhanced/f6040e62-833f-4170-844b-4c68f29283ac-enhanced.jpg`, // Widgi Creek pond, pines, fairway (4200x3150)
  alMtnLake:    `${ROOT}/public/asset-library/photos/enhanced/fc74fcc1-be7a-45d3-8bd4-c080d88e977b-enhanced.jpg`, // snow-capped Cascade peak mirrored in alpine lake at dawn (7736x5160, unsplash approved)
  alRiverPines: `${ROOT}/public/asset-library/photos/enhanced/752be187-3ff1-404d-9299-299be11c650a-enhanced.jpg`,  // calm river channel through ponderosa pines, mountains on horizon (4200x3150, grade A)
}

// ── Grade-A gate (Matt directive 2026-06-09: "always use the best grade A") ──
// Any photo under public/asset-library/ must carry vision_quality 'A' in the
// manifest or the render REFUSES. Non-library paths (LP imgs, own-listing MLS
// shots) are ungraded — warn so they get eyeballed manually.
import { readFileSync } from 'node:fs'
{
  const manifest = JSON.parse(readFileSync(resolve(ROOT, 'data/asset-library/manifest.json'), 'utf-8'))
  const rows = Array.isArray(manifest) ? manifest : manifest.assets || []
  const gradeById = new Map(rows.map((a) => [String(a.id), a.vision_quality || null]))
  for (const [key, p] of Object.entries(P)) {
    if (!p.includes('/public/asset-library/')) {
      console.warn(`  [grade-gate] P.${key} is not an asset-library photo — ungraded, eyeball before use`)
      continue
    }
    const stem = p.split('/').pop().replace(/\.[A-Za-z]+$/, '').replace(/-enhanced$/, '')
    const grade = gradeById.get(stem)
    if (grade !== 'A') {
      throw new Error(`[grade-gate] P.${key} (${stem}) is grade ${grade ?? 'UNKNOWN'} — only grade-A asset-library photos may render into ads (Matt 2026-06-09)`)
    }
  }
}

// ── Quote bank ─────────────────────────────────────────────────────────────
// Verbatim/faithfully-condensed GBP client reviews (lib/testimonials.ts, pulled
// 2026-05-22 via GBP API). Real social proof, never fabricated. Reviews mention
// "sell/sold" — that's the CLIENT'S words and stays; the ban is on AD HEADLINES only.
// Tightened to the single punchiest faithful sentence from each GBP review so the
// bigger (40px) display reads clean. Each phrase is verbatim or a faithful condensation.
// Each entry: ONE strong VERBATIM sentence (on the ad art) + the real reviewer
// name + the platform it lives on (Google). Verified against lib/testimonials.ts —
// nothing paraphrased, nothing fabricated. Per Matt 2026-05-28: real name + source
// ("location" = the review platform, Google or Zillow) attributed under the quote.
const Q = {
  oster:     { text: 'You will not be disappointed.', author: 'Ernie Oster', source: 'Google' },
  grant:     { text: 'Matt is the most professional, communicative, and honest Real Estate Broker I have ever worked with.', author: 'Douglas Grant', source: 'Google' },
  hedberg:   { text: 'Even in a tough market, he sold our home faster than we expected.', author: 'Audra Hedberg', source: 'Google' },
  crawley:   { text: 'Matt worked really hard for us and is a highly skilled negotiator.', author: 'Nick Crawley', source: 'Google' },
  creekmore: { text: 'He took time to check on the repairs while we were out of the country on vacation.', author: 'Jim Creekmore', source: 'Google' },
  millard:   { text: 'From the start of our journey to the end, Matt was right at every turn.', author: 'Doug Millard', source: 'Google' },
  timms:     { text: 'His presentation and marketing were professional and thorough.', author: 'Gary Timms', source: 'Google' },
  charise:   { text: 'He sold our current house in less than a week.', author: 'Charise Millard', source: 'Google' },
  graham:    { text: 'He is responsive, professional, and above all, a trustworthy person.', author: 'Stephen Graham', source: 'Google' },
  swank:     { text: 'He went the extra mile while we were out of the country.', author: 'SwankHQ', source: 'Google' },
  town:      { text: 'Matt worked diligently in providing information for both options and gave excellent advice to our current situation.', author: 'David Town', source: 'Google' },
  fess:      { text: 'Matt has vital local knowledge and pays attention to detail.', author: 'Helen Luna Fess', source: 'Google' },
  anderson:  { text: 'Matt was the one we decided on and were 100% happy with the process.', author: 'Kim Anderson', source: 'Google' },
  detweiler: { text: 'Matt with Ryan Realty was great to work with.', author: 'D Detweiler', source: 'Google' },
  robinson:  { text: 'Goes the extra mile to cover the needs of his customers.', author: 'Paul Robinson', source: 'Google' },
  annie:     { text: 'He negotiated a fair price when the buyer came in very low.', author: 'Annie Jenkins', source: 'Google' },
  cjenkins:  { text: 'Matt sold our home quickly and without any hassle.', author: 'C. Jenkins', source: 'Google' },
  // ── 2026-06-09 additions — verbatim sentences from the live GBP pull (24 reviews,
  // tmp/fb-review/gbp-reviews-result.json). Exact text, nothing condensed.
  grantWeekly:      { text: 'Matt kept me informed on a weekly basis as to the progress of selling my home in the Bend area.', author: 'Douglas Grant', source: 'Google' },
  timmsLowPressure: { text: 'He was patient, low pressure with us and provided expert guidance.', author: 'Gary Timms', source: 'Google' },
  creekmoreReady:   { text: 'Upon our return we found the house freshly painted, sparkling clean and ready to sell.', author: 'Jim Creekmore', source: 'Google' },
  annieFull:        { text: 'He negotiated a fair price for us when the potential buyer came in with a very low offer.', author: 'Annie Jenkins', source: 'Google' },
}

// Two intents:
//   intent:'call' → CTA is the FUB-tracked bio phone 541.703.3095 (ads/lead-capture
//                   surfaces route calls through Follow Up Boss for attribution).
//   intent:'lp'   → CTA is the seller-LP form action (home estimate / value).
// No headline contains "sell" / "selling" / "sel" per Matt 2026-05-28.
// Quotes are verbatim GBP client testimonials (authentic proof, left as-is).
const PHONE = '541.703.3095'
const CALL = `Call ${PHONE}`
const VARIANTS = [
  // ════ CALL ADS — drive a phone call. CTA = FUB-tracked line 541.703.3095 ════
  { slug: '01-downsizing',     intent: 'call', theme: 'Downsizing',    broker: 'team', photo: P.ranch,        photoFocus: 'center 55%', headline: 'Thinking of downsizing?',          subHeading: "See what your home is worth and what downsizing frees up, with a real number and no pressure. That's how we earn your business.", button: CALL, quote: Q.hedberg },
  { slug: '02-less-upkeep',    intent: 'call', theme: 'Less upkeep',   broker: 'team', photo: P.golfPond,     photoFocus: 'center 42%', headline: 'Ready for less upkeep?',           subHeading: "Trade the yard work and repairs for lock-and-leave living. We'll handle the sale on your timeline, no pressure.",    button: CALL, quote: Q.charise },
  { slug: '03-right-size',     intent: 'call', theme: 'Right-size',    broker: 'team', photo: P.schoolExt,    photoFocus: 'center 48%', headline: 'Too much house to manage?',        subHeading: "Right-size to a home that fits you now. Our team knows your part of Bend and what it's worth. That's how we earn your business.", button: CALL, quote: Q.timms },
  { slug: '04-empty-nest',     intent: 'call', theme: 'Empty nest',    broker: 'team', photo: P.schoolGreat,  photoFocus: 'center 45%', headline: 'An empty nest these days?',         subHeading: "Now that it's just the two of you, see what the extra space is worth on today's market. A plan first, no pressure.",         button: CALL, quote: Q.creekmore },
  { slug: '05-next-chapter',   intent: 'call', theme: 'Next chapter',  broker: 'matt', photo: P.farmhouse,    photoFocus: 'center 52%', headline: 'Ready for your next chapter?',      subHeading: "Start with a plan, not a listing, and move on your timeline. That's how we earn your business.",    button: CALL, quote: Q.millard },
  { slug: '06-retirement',     intent: 'call', theme: 'Retirement',    broker: 'matt', photo: P.golfTetherow, photoFocus: 'center 52%', headline: 'Planning your retirement move?',    subHeading: "Plan your retirement move on your timeline, with clear answers and no pressure. That's how we earn your business.",       button: CALL, quote: Q.graham },
  { slug: '07-parents-home',   intent: 'call', theme: "Parents' home", broker: 'team', photo: P.schoolExt,    photoFocus: 'center 48%', headline: "Handling your parents' home?",       subHeading: "Our team and our local network handle the prep, repairs, and sale, so your family doesn't carry it. Let us earn your business.", button: CALL, quote: Q.creekmore },
  { slug: '08-out-of-area',    intent: 'call', theme: 'Out of area',   broker: 'team', photo: P.riverHome,    photoFocus: 'center 38%', headline: 'Own a Bend home from out of state?', subHeading: "Our team and our trusted network handle the prep, the repairs, and the sale while you stay put. That's how we earn your business.", button: CALL, quote: Q.swank },
  { slug: '09-single-level',   intent: 'call', theme: 'Single level',  broker: 'team', photo: P.ranch,        photoFocus: 'center 55%', headline: 'Ready to leave the stairs behind?', subHeading: "Move to single-level living with less upkeep, and let our team handle the sale. On your timeline, no pressure.", button: CALL, quote: Q.charise },
  { slug: '10-relocating',     intent: 'call', theme: 'Relocating',    broker: 'matt', photo: P.oldMillA,     photoFocus: 'center 42%', headline: 'Relocating out of Bend?',          subHeading: "Already gone? Our team handles the prep, the repairs, and the sale through our trusted local network, even from afar.",        button: CALL, quote: Q.swank },
  { slug: '11-moving',         intent: 'call', theme: 'Moving',        broker: 'matt', photo: P.oldMillB,     photoFocus: 'center 40%', headline: 'Moving out of the area?',          subHeading: "Our team manages every step, from the first walkthrough to a market-ready sale. Let us earn your business.",        button: CALL, quote: Q.grant },
  { slug: '12-closer-to-family',intent: 'call', theme: 'Closer to family', broker: 'matt', photo: P.creekAerial, photoFocus: 'center 48%', headline: 'Moving closer to family?',          subHeading: "Get closer to the grandkids on your timeline. Our team handles every detail of the sale, no pressure.", button: CALL, quote: Q.anderson },
  { slug: '13-landlord',       intent: 'call', theme: 'Landlord',      broker: 'matt', photo: P.riverHome,    photoFocus: 'center 38%', headline: 'Done being a landlord?',           subHeading: "Keep renting or list it. We'll lay out the numbers either way, no pressure, and handle it all if you do.",      button: CALL, quote: Q.detweiler },
  { slug: '14-second-home',    intent: 'call', theme: 'Second home',   broker: 'team', photo: P.golfPond,     photoFocus: 'center 42%', headline: 'Managing a second property?',       subHeading: "See what that second place is worth on today's market, then keep it or let us handle the sale and earn your business.",        button: CALL, quote: Q.robinson },
  { slug: '15-timing-call',    intent: 'call', theme: 'Timing',        broker: 'team', photo: P.farmhouse,    photoFocus: 'center 52%', headline: 'Is now your time to make a move?',  subHeading: "Find out whether moving now beats waiting, with honest answers about the Bend market and no pressure.",     button: CALL, quote: Q.fess },

  // ════ SELLER-LP ADS — drive a home-value form fill. CTA = the estimate action ════
  { slug: '16-worth-now',      intent: 'lp', theme: 'Home value',  broker: 'matt', photo: P.farmhouse,    photoFocus: 'center 52%', headline: "What's your home worth right now?",     subHeading: "A real number from our team, based on homes that recently sold near you. No online guess, no pressure.",         button: 'Get your free home estimate', quote: Q.oster },
  { slug: '17-worth-today',    intent: 'lp', theme: 'Home value',  broker: 'team', photo: P.schoolExt,    photoFocus: 'center 48%', headline: 'Curious what your home is worth today?', subHeading: "Our team gives you a real number based on what's actually sold near you, not an online guess.",        button: "Get your home's value",       quote: Q.fess },
  { slug: '18-bend-worth',     intent: 'lp', theme: 'Home value',  broker: 'team', photo: P.oldMillB,     photoFocus: 'center 40%', headline: "What's your Bend home worth?",          subHeading: "Find out what your Bend home is worth, based on comparable homes that recently sold nearby. Real numbers, no pressure.",   button: "See your home's value",       quote: Q.creekmore },
  { slug: '19-would-bring',    intent: 'lp', theme: 'Home value',  broker: 'team', photo: P.creekAerial,  photoFocus: 'center 48%', headline: 'What would your home bring today?',     subHeading: "See what your home would bring today, based on what buyers are actually paying now. Real numbers, no guesswork.",    button: 'Get your instant estimate',   quote: Q.crawley },
  { slug: '20-current-value',  intent: 'lp', theme: 'Home value',  broker: 'team', photo: P.ranch,        photoFocus: 'center 55%', headline: "Want your home's current value?",       subHeading: "We'll give you a real number after walking your home in person, not a computer's guess. That's how we earn your business.", button: "Find your home's value",      quote: Q.detweiler },
  { slug: '21-zestimate-off',  intent: 'lp', theme: 'Zestimate',  broker: 'team', photo: P.tumaloCraftsman, photoFocus: 'center 48%', headline: 'How far off is your Zestimate?',        subHeading: "We'll show you how far off it is and give you the real number from recent local sales. Let us earn your business.",button: "Get a broker's estimate",     quote: Q.grant },
  { slug: '22-zestimate-inside',intent:'lp', theme: 'Zestimate',  broker: 'team', photo: P.schoolGreat,  photoFocus: 'center 45%', headline: 'Does a Zestimate know your home?',      subHeading: "A Zestimate never walked through your home. We price it on what's actually there, and what's sold nearby.",       button: 'Get a real local estimate',   quote: Q.timms },
  { slug: '23-zestimate-right',intent: 'lp', theme: 'Zestimate',  broker: 'team', photo: P.barnAerial,   photoFocus: 'center 50%', headline: 'Is the Zestimate right for your home?', subHeading: "An online estimate misses the upgrades you've made. We price what makes yours different, based on real sales.",    button: 'Get your true home value',    quote: Q.millard },
  { slug: '24-right-time',     intent: 'lp', theme: 'Timing',     broker: 'team', photo: P.oldMillB,     photoFocus: 'center 40%', headline: 'Is now the right time for you?',        subHeading: "Know your number first, then decide when the time is right for you. No pressure, just the real picture.",  button: 'Get your free home estimate', quote: Q.graham },
  { slug: '25-wait-or-move',   intent: 'lp', theme: 'Timing',     broker: 'team', photo: P.golfTetherow, photoFocus: 'center 52%', headline: 'Should you wait or make a move?',       subHeading: "Get the real data first, then make the call with facts, not pressure. That's how we earn your business.",     button: "Get your home's value",       quote: Q.charise },
  { slug: '26-this-year',      intent: 'lp', theme: 'Timing',     broker: 'team', photo: P.farmhouse,    photoFocus: 'center 52%', headline: 'Should you make a move this year?',     subHeading: "See where Bend prices stand this year, so you know if the timing works for you. No pressure, just the data.",     button: 'Get your instant estimate',   quote: Q.robinson },
  { slug: '27-market-now',     intent: 'lp', theme: 'Market',     broker: 'team', photo: P.creekAerial,   photoFocus: 'center 42%', headline: "How's the Bend market right now?",      subHeading: "See how the Bend market looks right now, priced off homes that recently sold near you. Real data, no spin.",  button: 'Get your free home estimate', quote: Q.anderson },
  { slug: '28-homes-like',     intent: 'lp', theme: 'Comps',      broker: 'team', photo: P.creekAerial,  photoFocus: 'center 48%', headline: 'What are homes like yours going for?',  subHeading: "See what homes like yours have actually sold for nearby, with a real number from our team and no guesswork.",button: "Get your home's value",       quote: Q.town },
  { slug: '29-value-think',    intent: 'lp', theme: 'Home value',  broker: 'team', photo: P.schoolKitch,  photoFocus: 'center 45%', headline: "Thinking about your home's value?",     subHeading: "We'll show you the real number and the recent sales it's built on. No online guess, no pressure.", button: "Find your home's value",      quote: Q.hedberg },
  { slug: '30-where-stands',   intent: 'lp', theme: 'Standing',   broker: 'matt', photo: P.riverHome,    photoFocus: 'center 38%', headline: 'Curious where your home stands today?', subHeading: "Get one real number you can count on, not a wide Zillow range. That's how we earn your business.",        button: "See your home's value",       quote: Q.swank },

  // ════ REACTIVATION SET — T1/T2a/T2b value + curiosity ════
  { slug: 'react-t1-v1-worth-today',       intent: 'lp', theme: 'Home value',   broker: 'matt', photo: P.schoolExt,    photoFocus: 'center 48%', headline: 'Curious what your home is worth today?',    subHeading: "A real number from our team based on what's actually sold near you, not an online guess.",         button: "Get your home's value",       quote: Q.charise },
  { slug: 'react-t1-v2-make-a-move',       intent: 'lp', theme: 'Timing',       broker: 'matt', photo: P.farmhouse,    photoFocus: 'center 52%', headline: 'Is now your time to make a move?',          subHeading: "Honest answers about the Bend market and what your home would bring, with no pressure.",           button: 'Get your free home estimate', quote: Q.hedberg },
  { slug: 'react-t2a-v1-bring-today',      intent: 'lp', theme: 'Home value',   broker: 'matt', photo: P.creekAerial, photoFocus: 'center 48%', headline: 'What would your home bring today?',         subHeading: "See what buyers are actually paying for homes like yours now. Real numbers, no guesswork.",         button: 'Get your instant estimate',   quote: Q.annie },
  { slug: 'react-t2a-v2-out-of-state',     intent: 'lp', theme: 'Out of area',  broker: 'matt', photo: P.riverHome,   photoFocus: 'center 38%', headline: 'Own a Bend home from out of state?',        subHeading: "Our team and trusted network handle the prep, the repairs, and the sale while you stay put.",       button: "Get your home's value",       quote: Q.swank },
  { slug: 'react-t2b-v1-west-bend-worth',  intent: 'lp', theme: 'West Bend',    broker: 'matt', photo: P.awbreyAerial, photoFocus: 'center 45%', headline: "What's your West Bend home worth?",         subHeading: "Find out what homes near you have actually sold for. A real number from our team, no pressure.",    button: "See your home's value",       quote: Q.fess },
  { slug: 'react-t2b-v2-westside-going-for',intent:'lp', theme: 'West Bend',    broker: 'matt', photo: P.nwCrossing,  photoFocus: 'center 45%', headline: 'What are westside homes going for?',        subHeading: "See what comparable homes near you have actually sold for, with a real number from our local team.", button: "Get your home's value",       quote: Q.cjenkins },

  // ── 2026-06-09 challenger round — two angles vs the t2a-v2-out-of-state champion (2.43% CTR) ──
  { slug: 'chal-a-net-number',  intent: 'lp', theme: 'Net proceeds', broker: 'matt', photo: P.farmhouse,  photoFocus: 'center 52%', headline: 'What would you walk away with?',            subHeading: "Sale price is one number. What you keep is another. We run both for your Bend home, free.",          button: 'See your net number',         quote: Q.annie },
  { slug: 'chal-b-ten-years',   intent: 'lp', theme: 'Long tenure',  broker: 'matt', photo: P.barnAerial, photoFocus: 'center 45%', headline: 'Owned your Bend home for 10 years or more?', subHeading: "Prices near you have moved since you bought. See what your home is worth now, from real closed sales.", button: "Get your home's value",       quote: Q.hedberg },

  // ── 2026-06-09 v11 round — asset-library owned photos + fresh GBP quote bank.
  // Action row e5b9668c-33d3-42b3-9e5d-ad4d4b04d1ab. Angles chosen from live evidence:
  // out-of-state family = champion (2.43% CTR); generic worth questions died (<0.6%).
  { slug: 'v11-oos-oldmill',     intent: 'lp', theme: 'Out of area',   broker: 'matt', photo: P.alOldMill,   photoFocus: 'center 45%', headline: 'Own a Bend home from another state?',        subHeading: "We handle the prep, the repairs, and the sale while you stay put.",                                       button: "Get your home's value", quote: Q.creekmore },
  { slug: 'v11-weekly-updates',  intent: 'lp', theme: 'Communication', broker: 'matt', photo: P.alRiverWest, photoFocus: 'center 40%', headline: 'Know where your sale stands, every week.',   subHeading: "Clear updates from listing day to closing day, so you are never left wondering.",                          button: "Get your home's value", quote: Q.grantWeekly },
  { slug: 'v11-estate-sale',     intent: 'lp', theme: 'Estate',        broker: 'matt', photo: P.alRiverPines, photoFocus: 'center 48%', headline: 'Settling an estate property in Bend?',       subHeading: "We coordinate the repairs, the cleaning, and the sale, even when you live somewhere else.",                button: "Get your home's value", quote: Q.creekmoreReady },
  { slug: 'v11-tetherow-equity', intent: 'lp', theme: 'Long tenure',   broker: 'matt', photo: P.alTetherow,  photoFocus: 'center 38%', headline: 'Owned your Bend home for 10 years or more?', subHeading: "Prices near you have moved since you bought. See what your home is worth now, from real closed sales.",    button: "Get your home's value", quote: Q.hedberg },
  { slug: 'v11-low-pressure',    intent: 'lp', theme: 'No pressure',   broker: 'matt', photo: P.alNwxPond,   photoFocus: 'center 55%', headline: 'No pressure. Just the real number.',         subHeading: "Honest guidance for your Bend home, whenever you are ready to think about selling.",                       button: "Get your home's value", quote: Q.timmsLowPressure },
  { slug: 'v11-net-number',      intent: 'lp', theme: 'Net proceeds',  broker: 'matt', photo: P.alWidgi,     photoFocus: 'center 45%', headline: 'What would you walk away with?',             subHeading: "Sale price is one number. What you keep is another. We run both for your Bend home, free.",                button: 'See your net number',   quote: Q.annieFull },

  // ── 2026-06-09 v12 — Concept M "mountain background" (design-first round).
  // Ad headline + sub are IDENTICAL to /lp/seller-home-value?v=mountain (message match).
  { slug: 'v12-mountain',        intent: 'lp', theme: 'Mountain value', broker: 'matt', photo: P.alMtnLake,  photoFocus: 'center 62%', headline: 'What is your Bend home worth?',              subHeading: "A real number from closed sales near you, not an online guess.",                                           button: "Get your home's value", quote: Q.charise },
]

// Render only the named slugs when ONLY=slug1,slug2 is set (challenger rounds
// re-render two ads, not the whole library).
const ONLY = process.env.ONLY ? new Set(process.env.ONLY.split(',').map((s) => s.trim())) : null

// ── Output formats (Meta placements) ─────────────────────────────────────────
// Same 1080 width across all three so the horizontal layout (x insets) is shared;
// only canvas height, scrim coverage, and vertical block positions change.
//   1x1  1080x1080  — Feed fallback. Byte-identical to the approved v10 set.
//   4x5  1080x1350  — Facebook + Instagram Feed (max vertical real estate).
//   9x16 1080x1920  — Stories + Reels (full screen). Top/bottom blocks pulled in
//                     to clear the platform profile pill (top) and ad CTA bar (bottom).
const FORMATS = {
  '1x1':  { W: 1080, H: 1080, scrimTop: 48, scrimBot: 46, hlTop: 76,  subTop: 196, btnTop: 332, brokerBottom: 36,  reviewBottom: 120, logoBottom: 48,  hlStart: 94 },
  '4x5':  { W: 1080, H: 1350, scrimTop: 40, scrimBot: 40, hlTop: 76,  subTop: 196, btnTop: 332, brokerBottom: 36,  reviewBottom: 120, logoBottom: 48,  hlStart: 94 },
  '9x16': { W: 1080, H: 1920, scrimTop: 33, scrimBot: 34, hlTop: 150, subTop: 296, btnTop: 446, brokerBottom: 220, reviewBottom: 330, logoBottom: 220, hlStart: 96 },
}

function html(v, fmt = FORMATS['1x1']) {
  const brokerImg = v.broker === 'team' ? TEAM : MATT
  const brokerW = v.broker === 'team' ? 380 : 260
  const brokerH = v.broker === 'team' ? 224 : 340 // ≤ 360 = 1/3 of 1080
  const brokerFocus = v.broker === 'team' ? 'center top' : 'center 32%'

  return `<!doctype html><html><head><meta charset="utf-8"><style>
    ${FONTS_CSS}
    *{box-sizing:border-box;margin:0;padding:0}
    html,body{width:${fmt.W}px;height:${fmt.H}px;overflow:hidden;background:#0a0d12;color:#faf6ec;font-family:'National Park',sans-serif;position:relative}

    .photo{position:absolute;inset:0;background:url('file://${v.photo}') ${v.photoFocus}/cover no-repeat;z-index:1}
    .scrim-top{position:absolute;left:0;right:0;top:0;height:${fmt.scrimTop}%;background:linear-gradient(180deg,rgba(10,13,18,0.90) 0%,rgba(10,13,18,0.72) 32%,rgba(10,13,18,0.32) 72%,rgba(10,13,18,0) 100%);z-index:2}
    .scrim-bottom{position:absolute;left:0;right:0;bottom:0;height:${fmt.scrimBot}%;background:linear-gradient(180deg,rgba(10,13,18,0) 0%,rgba(10,13,18,0.45) 25%,rgba(10,13,18,0.92) 65%,rgba(10,13,18,0.97) 100%);z-index:2}

    /* TOP — headline (the question). nowrap + JS auto-fit keeps it on one line. */
    .headline{position:absolute;top:${fmt.hlTop}px;left:56px;right:56px;z-index:5;font-family:'Instrument Serif Italic',serif;font-size:84px;line-height:1.0;color:#faf6ec;letter-spacing:-0.018em;text-shadow:0 2px 22px rgba(0,0,0,0.72);white-space:nowrap}

    /* Subheading */
    .sub-heading{position:absolute;top:${fmt.subTop}px;left:56px;right:56px;z-index:5;font-family:'National Park Bold',sans-serif;font-size:30px;line-height:1.32;letter-spacing:0.004em;color:#faf6ec;text-shadow:0 2px 12px rgba(0,0,0,0.65)}

    /* Button */
    .btn{position:absolute;top:${fmt.btnTop}px;left:56px;z-index:5;display:inline-block;background:#faf6ec;color:#0a1424;padding:22px 44px;font-family:'National Park Bold',sans-serif;font-size:22px;letter-spacing:0.18em;text-transform:uppercase;border-radius:2px;box-shadow:0 12px 36px rgba(0,0,0,0.55)}

    /* BOTTOM-LEFT — broker portrait, ≤ 1/3 height */
    .broker{position:absolute;left:18px;bottom:${fmt.brokerBottom}px;width:${brokerW}px;height:${brokerH}px;background:url('file://${brokerImg}') ${brokerFocus}/contain no-repeat;z-index:5;filter:drop-shadow(-4px 4px 18px rgba(0,0,0,0.55))}

    /* BOTTOM-RIGHT — review text right-aligned, sitting directly above the logo */
    .review{position:absolute;right:48px;bottom:${fmt.reviewBottom}px;width:600px;text-align:right;z-index:5}
    .review .text{font-family:'Crimson Italic',serif;font-size:40px;line-height:1.26;color:#faf6ec;letter-spacing:-0.005em;text-shadow:0 2px 16px rgba(0,0,0,0.72)}
    .review .tag{margin-top:14px;font-family:'National Park Bold',sans-serif;font-size:16px;letter-spacing:0.02em;color:rgba(250,246,236,0.86);text-shadow:0 2px 8px rgba(0,0,0,0.6)}

    /* Horizontal Ryan Realty logo — bottom-RIGHT, below the review text */
    .logo{position:absolute;right:48px;bottom:${fmt.logoBottom}px;width:260px;height:52px;background:url('file://${LOGO_HORIZONTAL_WHITE}') right center/contain no-repeat;z-index:5;filter:drop-shadow(0 2px 14px rgba(0,0,0,0.55))}
  </style></head><body>
    <div class="photo"></div>
    <div class="scrim-top"></div>
    <div class="scrim-bottom"></div>

    <div class="headline">${v.headline}</div>
    <div class="sub-heading">${v.subHeading}</div>
    <div class="btn">${v.button}</div>

    <div class="broker"></div>

    <div class="review">
      <div class="text">"${v.quote.text}"</div>
      <div class="tag">${v.quote.author} · ${v.quote.source} review</div>
    </div>

    <div class="logo"></div>
  </body></html>`
}

await mkdir(OUT_DIR, { recursive: true })

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ viewport: { width: 1080, height: 1080 }, deviceScaleFactor: 1 })
const page = await ctx.newPage()

const results = []
for (let i = 0; i < VARIANTS.length; i++) {
  const v = VARIANTS[i]
  if (ONLY && !ONLY.has(v.slug)) continue
  const htmlPath = resolve(OUT_DIR, `seller-v10-${v.slug}.html`)
  const jpgPath = resolve(OUT_DIR, `seller-v10-${v.slug}.jpg`)
  await writeFile(htmlPath, html(v), 'utf-8')
  await page.goto(pathToFileURL(htmlPath).href, { waitUntil: 'networkidle' })
  // Shrink headline + subheading until each fits on ONE line (no wrap).
  // Returns the final rendered sizes so the scorecard's legibility dimension is
  // measured from actual output rather than guessed.
  const sizes = await page.evaluate(async () => {
    await document.fonts.ready
    const fit = (sel, start, min) => {
      const el = document.querySelector(sel)
      let size = start
      el.style.fontSize = size + 'px'
      while (el.scrollWidth > el.clientWidth && size > min) {
        size -= 1
        el.style.fontSize = size + 'px'
      }
      return size
    }
    // Review wraps to multiple lines, so fit by HEIGHT: shrink until the block is no taller than maxH.
    const fitH = (sel, start, min, maxH) => {
      const el = document.querySelector(sel)
      let size = start
      el.style.fontSize = size + 'px'
      while (el.scrollHeight > maxH && size > min) {
        size -= 1
        el.style.fontSize = size + 'px'
      }
      return size
    }
    const headlineSize = fit('.headline', 94, 42)
    fitH('.sub-heading', 30, 20, 96)
    const reviewSize = fitH('.review .text', 42, 32, 300)
    return { headlineSize, reviewSize }
  })
  await page.waitForTimeout(300)
  await page.screenshot({ path: jpgPath, type: 'jpeg', quality: 94, clip: { x: 0, y: 0, width: 1080, height: 1080 } })
  // Small thumbnail (600px) embedded in the sheet so it always opens; full-size jpg is the click-through.
  const thumbPath = resolve(THUMB_DIR, `seller-v10-${v.slug}.jpg`)
  execFileSync('sips', ['-Z', '600', '--setProperty', 'formatOptions', '60', jpgPath, '--out', thumbPath], { stdio: 'ignore' })
  const thumb = 'data:image/jpeg;base64,' + (await readFile(thumbPath)).toString('base64')
  console.log(`  ${i + 1}/${VARIANTS.length}  ${v.slug}  (headline ${sizes.headlineSize}px, review ${sizes.reviewSize}px)`)
  results.push({ ...v, full: `seller-v10-${v.slug}.jpg`, thumb, headlineSize: sizes.headlineSize, reviewSize: sizes.reviewSize })
}

// ── Multi-size placement variants ────────────────────────────────────────────
// The chosen lead-gen concepts rendered at 4:5 (feed) and 9:16 (story/reel).
// 1:1 is already rendered above. Lead CTA baked on-image (campaign objective = leads).
// These are ADDITIVE — the approved 30x1:1 set + scorecard above are untouched.
const MULTISIZE = [
  { slug: '08-out-of-area', button: "Get your home's value" }, // flagship — absentee CRM
  { slug: '01-downsizing',  button: "Get your home's value" }, // top boomer motivation
  { slug: '16-worth-now',   button: "Get your home's value" }, // direct value question
  { slug: '28-homes-like',  button: "Get your home's value" }, // comps / value question
  // ── Reactivation set ─────────────────────────────────────────────────────────
  { slug: 'react-t1-v1-worth-today' },       // T1 curiosity value-question
  { slug: 'react-t1-v2-make-a-move' },       // T1 timing
  { slug: 'react-t2a-v1-bring-today' },      // T2a what-would-it-bring
  { slug: 'react-t2a-v2-out-of-state' },     // T2a absentee owner
  { slug: 'react-t2b-v1-west-bend-worth' },  // T2b west Bend value
  { slug: 'react-t2b-v2-westside-going-for'},// T2b westside comps
  // ── 2026-06-09 challenger round ──────────────────────────────────────────────
  { slug: 'chal-a-net-number',  button: 'See your net number' },
  { slug: 'chal-b-ten-years',   button: "Get your home's value" },
  // ── 2026-06-09 v11 round (asset-library photos + fresh GBP quotes) ───────────
  { slug: 'v11-oos-oldmill' },
  { slug: 'v11-weekly-updates' },
  { slug: 'v11-estate-sale' },
  { slug: 'v11-tetherow-equity' },
  { slug: 'v11-low-pressure' },
  { slug: 'v11-net-number',     button: 'See your net number' },
  { slug: 'v12-mountain' },
]
const MULTI_DIR = resolve(OUT_DIR, 'multisize')
const MULTI_THUMB = resolve(MULTI_DIR, 'thumbs')
await mkdir(MULTI_THUMB, { recursive: true })
const multiResults = []
for (const choice of MULTISIZE) {
  if (ONLY && !ONLY.has(choice.slug)) continue
  const base = VARIANTS.find(x => x.slug === choice.slug)
  if (!base) { console.log(`  multisize SKIP — no variant ${choice.slug}`); continue }
  const v = { ...base, button: choice.button || base.button }
  const entry = { slug: v.slug, theme: v.theme, headline: v.headline, subHeading: v.subHeading, button: v.button, quote: v.quote, sizes: {} }
  entry.sizes['1x1'] = `seller-v10-${v.slug}.jpg` // already rendered to OUT_DIR root
  for (const fmtKey of ['4x5', '9x16']) {
    const fmt = FORMATS[fmtKey]
    const htmlPath = resolve(MULTI_DIR, `seller-v10-${v.slug}-${fmtKey}.html`)
    const jpgPath = resolve(MULTI_DIR, `seller-v10-${v.slug}-${fmtKey}.jpg`)
    await writeFile(htmlPath, html(v, fmt), 'utf-8')
    await page.setViewportSize({ width: fmt.W, height: fmt.H })
    await page.goto(pathToFileURL(htmlPath).href, { waitUntil: 'networkidle' })
    await page.evaluate(async (hlStart) => {
      await document.fonts.ready
      const fit = (sel, start, min) => {
        const el = document.querySelector(sel); let s = start; el.style.fontSize = s + 'px'
        while (el.scrollWidth > el.clientWidth && s > min) { s -= 1; el.style.fontSize = s + 'px' }
        return s
      }
      const fitH = (sel, start, min, maxH) => {
        const el = document.querySelector(sel); let s = start; el.style.fontSize = s + 'px'
        while (el.scrollHeight > maxH && s > min) { s -= 1; el.style.fontSize = s + 'px' }
        return s
      }
      fit('.headline', hlStart, 42)
      fitH('.sub-heading', 30, 20, 96)
      fitH('.review .text', 42, 32, 300)
    }, fmt.hlStart)
    await page.waitForTimeout(300)
    await page.screenshot({ path: jpgPath, type: 'jpeg', quality: 94, clip: { x: 0, y: 0, width: fmt.W, height: fmt.H } })
    const thumbPath = resolve(MULTI_THUMB, `seller-v10-${v.slug}-${fmtKey}.jpg`)
    execFileSync('sips', ['-Z', '660', '--setProperty', 'formatOptions', '64', jpgPath, '--out', thumbPath], { stdio: 'ignore' })
    entry.sizes[fmtKey] = `multisize/seller-v10-${v.slug}-${fmtKey}.jpg`
    console.log(`  multisize  ${v.slug}  ${fmtKey}  (${fmt.W}x${fmt.H})`)
  }
  multiResults.push(entry)
}
await page.setViewportSize({ width: 1080, height: 1080 })

await browser.close()

// ── Pre-launch scorecard ─────────────────────────────────────────────────────
// Grades how well each ad ADHERES to proven seller-ad patterns + brand voice +
// direct-response best practice. NOT a CTR / performance prediction — the live Meta
// A/B test is the only true grade. Purpose: rank all 30 so we cut to the top 6-8
// to actually run with budget.
//
// Seven dimensions, 100 points:
//   hookTier       0-25  headline pattern strength (grounded in out/design-recon/fb-lead-gen-ad)
//   selfQual       0-15  how sharply the copy self-selects a seller (Housing Special Ad Category
//                        kills demographic/ZIP/age targeting, so the COPY must qualify the audience)
//   cta            0-15  clarity + action-fit of the button
//   subSpecificity 0-15  concrete vs soft subheading
//   legibility     0-10  measured from the ACTUAL rendered headline/review font sizes
//   photoMatch     0-10  EDITORIAL — does the photo fit the life stage / message
//   proofFit       0-10  EDITORIAL — does the testimonial back the headline's promise
// brandVoiceGate is a hard pass/fail flag (em/en dash, semicolon, "sell" in headline,
// banned words). A fail is surfaced regardless of score.

// Headline pattern tiers from the 18,716-ad recon: value-questions ("what's your home
// worth") ran 1380-2188 days; life-stage self-qualifiers ran 1793 days; Zestimate-vs-broker
// is high-differentiation but unproven (no competitor runs it); timing/market is solid + common.
function hookTier(v) {
  if (v.theme === 'Zestimate') return { pts: 19, tier: 'Differentiator — Zestimate vs broker (unproven, high-diff)' }
  if (/worth|value|bring|going for|stands/i.test(v.headline)) return { pts: 25, tier: 'Value-question (proven top performer)' }
  if (v.intent === 'call') return { pts: 22, tier: 'Life-stage self-qualifier (proven)' }
  return { pts: 20, tier: 'Timing / market (solid)' }
}
function selfQual(v) {
  const h = v.headline.toLowerCase()
  if (/downsiz|empty nest|retire|landlord|relocat|second propert|too much house|less upkeep|parents|out of state|stairs|closer to family/.test(h)) return 15
  if (/next chapter|next move|fresh start|comes next|moving|make a move/.test(h)) return 11
  return 8
}
function ctaScore(v) {
  if (v.intent === 'call') return 14
  return /(get|find|see).*(value|estimate)/i.test(v.button) ? 15 : 12
}
// Concrete subheadings name something a seller cares about (real data, sold comps, a broker,
// the algorithm, the market, a number, a timeline). Soft ones make a relational promise only.
function subSpecificity(v) {
  return /real|data|bend|sold|broker|algorithm|buyers|similar homes|prices|market|number|timeline|lock-and-leave|single-level|local team|repairs/i.test(v.subHeading) ? 15 : 10
}
// Measured from the real rendered sizes returned by the fit routine.
function legibility(headlineSize, reviewSize) {
  const h = headlineSize >= 60 ? 6 : headlineSize >= 52 ? 5 : headlineSize >= 46 ? 4 : 3
  const r = reviewSize >= 38 ? 4 : reviewSize >= 34 ? 3 : 2
  return h + r
}
const BANNED = ['stunning', 'nestled', 'boasts', 'charming', 'pristine', 'gorgeous', 'breathtaking', 'must-see', 'dream home', 'meticulously', 'turnkey', 'hidden gem', 'luxurious', 'spacious', 'cozy', 'premier', 'boutique', 'concierge', 'white glove', 'white-glove', 'most trusted', 'most-trusted', 'top producing', 'delve', 'leverage', 'tapestry', 'navigate', 'robust', 'seamless', 'comprehensive', 'elevate', 'unlock']
function brandVoiceGate(v) {
  const fails = []
  const all = `${v.headline} ${v.subHeading} ${v.button}`
  if (/[—–]/.test(all)) fails.push('em/en dash')
  if (/;/.test(all)) fails.push('semicolon')
  if ((all.match(/!/g) || []).length > 1) fails.push('multiple exclamations')
  if (/(^|[^a-z])(sell|selling|sel)([^a-z]|$)/i.test(v.headline)) fails.push('"sell" in headline')
  const low = all.toLowerCase()
  for (const w of BANNED) if (low.includes(w)) fails.push(`banned: ${w}`)
  return fails
}
// EDITORIAL dimensions — human judgment on photo-to-message + testimonial-to-promise fit.
// Labeled separately from the mechanical dimensions so the two are never conflated.
const EDIT = {
  '01-downsizing':      { pm: 10, pf: 8 }, // single-level ranch = downsizing; hedberg "sold faster than expected"
  '02-less-upkeep':     { pm: 8, pf: 7 },  // golf/pond lock-and-leave; charise "without the high pressure"
  '03-right-size':      { pm: 9, pf: 7 },  // big craftsman = too much house; timms presentation/marketing
  '04-empty-nest':      { pm: 8, pf: 8 },  // great room = empty nest; creekmore "house sold quickly"
  '05-next-chapter':    { pm: 8, pf: 9 },  // twilight farmhouse = next chapter; millard "downs/ups"
  '06-retirement':      { pm: 10, pf: 8 }, // golf golden-hour = retirement move; graham "trustworthy"
  '07-parents-home':    { pm: 8, pf: 10 }, // craftsman exterior = the family home; creekmore "checked repairs while out of the country" — exact fit for adult kids handling a parent's home
  '08-out-of-area':     { pm: 8, pf: 9 },  // Deschutes-bluff Bend home = owned from afar; swank "while out of the country" — out-of-state owner proof
  '09-single-level':    { pm: 10, pf: 8 }, // single-level ranch = leaving the stairs behind (perfect); charise "without the high pressure" easy move
  '10-relocating':      { pm: 10, pf: 9 }, // Old Mill aerial = leaving Bend; swank "while out of country"
  '11-moving':          { pm: 9, pf: 7 },  // Old Mill aerial = moving out of area; grant "most professional"
  '12-closer-to-family':{ pm: 8, pf: 7 },  // neighborhood-creek aerial = closer to family/community; anderson "100% happy with the process"
  '13-landlord':        { pm: 7, pf: 7 },  // river home = done being a landlord; detweiler "in the loop"
  '14-second-home':     { pm: 9, pf: 6 },  // golf/pond = second property; robinson "prompt with replies"
  '15-timing-call':     { pm: 8, pf: 8 },  // farmhouse = your time; fess broker-of-23-years
  '16-worth-now':       { pm: 8, pf: 8 },  // farmhouse = worth now; oster
  '17-worth-today':     { pm: 9, pf: 9 },  // craftsman = worth today; fess broker proof
  '18-bend-worth':      { pm: 9, pf: 7 },  // Old Mill Bend aerial = "Bend home worth"; creekmore
  '19-would-bring':     { pm: 8, pf: 8 },  // creek aerial = what would it bring; crawley
  '20-current-value':   { pm: 8, pf: 7 },  // ranch = current value; detweiler
  '21-zestimate-off':   { pm: 9, pf: 9 },  // REAL craftsman vs algorithm — theme perfect; -1 for 800x600 softness; grant "honest"
  '22-zestimate-inside':{ pm: 10, pf: 8 }, // interior literally proves "a Zestimate never sees inside"; timms
  '23-zestimate-right': { pm: 9, pf: 8 },  // barn aerial = your home; millard
  '24-right-time':      { pm: 7, pf: 7 },  // Old Mill aerial = right time; graham
  '25-wait-or-move':    { pm: 7, pf: 8 },  // golf = wait or move; charise
  '26-this-year':       { pm: 8, pf: 6 },  // farmhouse = move this year; robinson
  '27-market-now':      { pm: 9, pf: 7 },  // Bend neighborhood aerial = literal "the market"; on-message daytime; anderson
  '28-homes-like':      { pm: 9, pf: 8 },  // neighborhood aerial = homes like yours (comps); town
  '29-value-think':     { pm: 8, pf: 8 },  // kitchen = value driver; hedberg
  '30-where-stands':    { pm: 7, pf: 7 },  // river home = where it stands; swank
  // Reactivation set
  'react-t1-v1-worth-today':        { pm: 9, pf: 9 },  // craftsman exterior = big home value question; fess "vital local knowledge" — exact fit
  'react-t1-v2-make-a-move':        { pm: 8, pf: 8 },  // twilight farmhouse = next-chapter timing; oster "you will not be disappointed" — confident close
  'react-t2a-v1-bring-today':       { pm: 9, pf: 8 },  // creek neighborhood aerial = what homes bring; crawley "highly skilled negotiator"
  'react-t2a-v2-out-of-state':      { pm: 8, pf: 9 },  // Deschutes river bluff home = absentee owner; swank "out of the country" — exact proof
  'react-t2b-v1-west-bend-worth':   { pm: 10, pf: 9 }, // Awbrey Glen golf aerial = upscale westside Bend; charise "without the high pressure" — trust proof
  'react-t2b-v2-westside-going-for':{ pm: 10, pf: 8 }, // Awbrey Glen entrance monument = hyper-local westside recognition; timms "professional and thorough"
}
function scoreAd(r) {
  const hook = hookTier(r)
  const sq = selfQual(r)
  const cta = ctaScore(r)
  const sub = subSpecificity(r)
  const leg = legibility(r.headlineSize, r.reviewSize)
  const ed = EDIT[r.slug] || { pm: 7, pf: 7 }
  const fails = brandVoiceGate(r)
  const total = hook.pts + sq + cta + sub + leg + ed.pm + ed.pf
  return {
    slug: r.slug, theme: r.theme, intent: r.intent, headline: r.headline,
    dims: { hookTier: hook.pts, selfQual: sq, cta, subSpecificity: sub, legibility: leg, photoMatch: ed.pm, proofFit: ed.pf },
    hookLabel: hook.tier, headlineSize: r.headlineSize, reviewSize: r.reviewSize,
    total, brandVoicePass: fails.length === 0, brandVoiceFails: fails,
  }
}

for (const r of results) r.score = scoreAd(r)
const ranked = [...results].sort((a, b) => b.score.total - a.score.total)
const avg = Math.round(results.reduce((a, r) => a + r.score.total, 0) / results.length)
const voiceFailN = results.filter(r => !r.score.brandVoicePass).length

const scorecard = {
  generated_at: new Date().toISOString(),
  note: 'Pre-launch pattern-adherence + brand-voice quality score, 0-100. NOT a CTR/performance prediction. The live Meta A/B test is the only true grade. Use this to cut 30 -> the top 6-8 to run with budget.',
  dimensions: {
    hookTier: 'mechanical 0-25 — headline pattern strength (recon-grounded)',
    selfQual: 'mechanical 0-15 — how sharply copy self-selects a seller',
    cta: 'mechanical 0-15 — button clarity + action fit',
    subSpecificity: 'mechanical 0-15 — concrete vs soft subheading',
    legibility: 'mechanical 0-10 — measured from rendered font sizes',
    photoMatch: 'EDITORIAL 0-10 — photo-to-life-stage fit',
    proofFit: 'EDITORIAL 0-10 — testimonial-to-headline fit',
  },
  average: avg,
  brand_voice_fails: voiceFailN,
  ranked: ranked.map((r, i) => ({ rank: i + 1, ...r.score })),
}
await writeFile(resolve(OUT_DIR, 'scorecard.json'), JSON.stringify(scorecard, null, 2), 'utf-8')
console.log('\nScorecard (ranked):')
for (let i = 0; i < ranked.length; i++) {
  const s = ranked[i].score
  console.log(`  ${String(i + 1).padStart(2, '0')}. ${String(s.total).padStart(3)}  ${s.slug}${s.brandVoicePass ? '' : '  ⚠ VOICE: ' + s.brandVoiceFails.join(', ')}`)
}

const scoreColor = (t) => t >= 85 ? '#7fd1b9' : t >= 80 ? '#cbe07f' : t >= 75 ? '#e0b96a' : '#e08a6a'
const card = (r, num, rankMode = false) => {
  const intentColor = r.intent === 'call' ? '#7fd1b9' : '#e0b96a'
  const s = r.score
  const d = s.dims
  const badge = `<span class="score" style="background:${scoreColor(s.total)}">${s.total}</span>`
  const voice = s.brandVoicePass ? '' : `<div class="voicefail">⚠ voice: ${s.brandVoiceFails.join(', ')}</div>`
  const dims = rankMode ? `<div class="dimrow">hook ${d.hookTier} · qual ${d.selfQual} · cta ${d.cta} · sub ${d.subSpecificity} · leg ${d.legibility} · <span class="ed">photo ${d.photoMatch}</span> · <span class="ed">proof ${d.proofFit}</span></div>` : ''
  const lead = rankMode
    ? `<span class="rank">#${num}</span> ${badge} <span style="color:${intentColor}">${r.theme}</span> · <span class="brk">${r.intent === 'call' ? 'call' : 'LP'} · ${r.broker === 'team' ? 'team' : 'Matt'}</span>`
    : `<span class="num">${String(num).padStart(2, '0')}</span> ${badge} <span style="color:${intentColor}">${r.theme}</span> · <span class="brk">${r.broker === 'team' ? 'team photo' : 'Matt photo'}</span>`
  return `<div class="card">
  <a href="${r.full}" target="_blank"><img src="${r.thumb}" alt="${r.headline}" loading="lazy"></a>
  <div class="meta">
    <div class="n">${lead}</div>
    <div class="h">${r.headline}</div>
    <div class="b">↳ ${r.subHeading}</div>
    <div class="b cta">▸ ${r.button}</div>
    ${dims}
    ${voice}
    <div class="rev">"${r.quote.text}"<span class="revattr">${r.quote.author} · ${r.quote.source} review</span></div>
  </div>
</div>`
}

const rankedCards = ranked.map((r, i) => card(r, i + 1, true)).join('\n')
const callCards = results.filter(r => r.intent === 'call').map(r => card(r, parseInt(r.slug, 10), false)).join('\n')
const lpCards = results.filter(r => r.intent === 'lp').map(r => card(r, parseInt(r.slug, 10), false)).join('\n')
const callN = results.filter(r => r.intent === 'call').length
const lpN = results.filter(r => r.intent === 'lp').length

const sheet = `<!doctype html><html><head><meta charset="utf-8"><title>v10 — 30 seller ads, scored</title>
<style>
  body{font-family:Georgia,serif;background:#0a0d12;color:#faf6ec;margin:0;padding:36px}
  h1{font-style:italic;font-size:36px;font-weight:400;margin:0 0 8px;letter-spacing:-0.01em}
  p.lede{color:rgba(250,246,236,0.72);margin:0 auto 8px;max-width:1080px;line-height:1.6;font-size:15px;font-style:italic}
  .statbar{display:flex;gap:28px;max-width:1380px;margin:18px auto 0;font-style:normal;font-size:13px;color:rgba(250,246,236,0.7);letter-spacing:0.04em}
  .statbar b{color:#faf6ec;font-size:17px}
  h2{font-family:Georgia,serif;font-size:13px;font-style:normal;font-weight:400;letter-spacing:0.26em;text-transform:uppercase;margin:44px auto 4px;max-width:1380px;padding-bottom:10px;border-bottom:1px solid rgba(250,246,236,0.18)}
  h2 .dot{font-size:18px;vertical-align:middle;margin-right:8px}
  h2 .sub{display:block;margin-top:8px;letter-spacing:0;text-transform:none;font-style:italic;font-size:13px;color:rgba(250,246,236,0.6)}
  .grid{display:grid;grid-template-columns:repeat(3,minmax(340px,1fr));gap:24px;max-width:1380px;margin:18px auto 0}
  .card{background:rgba(255,255,255,0.03);border:1px solid rgba(250,246,236,0.16);overflow:hidden;border-radius:4px}
  .card img{display:block;width:100%;aspect-ratio:1/1;object-fit:cover}
  .meta{padding:16px 18px}
  .meta .n{font-size:10px;text-transform:uppercase;letter-spacing:0.16em;color:rgba(250,246,236,0.5);margin-bottom:7px;display:flex;align-items:center;flex-wrap:wrap;gap:4px}
  .meta .n .num,.meta .n .rank{color:rgba(250,246,236,0.85);font-weight:bold}
  .meta .n .brk{color:rgba(250,246,236,0.4)}
  .meta .n .score{display:inline-block;color:#0a0d12;font-weight:bold;font-family:Georgia,serif;font-size:13px;padding:1px 9px;border-radius:10px;letter-spacing:0}
  .meta .h{font-style:italic;font-size:19px;color:#faf6ec;font-family:Georgia,serif;line-height:1.28;margin-bottom:8px}
  .meta .b{font-size:12px;letter-spacing:0.01em;color:rgba(250,246,236,0.62);margin-top:4px;line-height:1.4}
  .meta .cta{color:rgba(250,246,236,0.78)}
  .meta .dimrow{margin-top:9px;font-family:ui-monospace,Menlo,monospace;font-size:10.5px;letter-spacing:0.01em;color:rgba(250,246,236,0.42)}
  .meta .dimrow .ed{color:#e0b96a}
  .meta .voicefail{margin-top:8px;font-size:11px;color:#e08a6a;letter-spacing:0.04em}
  .meta .rev{margin-top:11px;font-style:italic;color:rgba(250,246,236,0.55);font-family:Georgia,serif;font-size:12.5px;line-height:1.42}
  .meta .rev .revattr{display:block;margin-top:5px;font-style:normal;font-size:11px;letter-spacing:0.04em;color:rgba(250,246,236,0.4)}
</style></head><body>
<h1>v10 — 30 seller ads, scored + ranked</h1>
<p class="lede">No headline uses "sell" or "selling." Each headline asks → subheading answers → CTA names the next step → a real GBP client review proves it. Subheadings lead with what our team does: full-service, end-to-end. We handle the prep, the repairs, and the sale through our trusted local network, even for out-of-area sellers. The ask is confident, not soft: "That's how we earn your business," rotated with no-pressure value closers. The <b>score (0-100)</b> grades pattern-adherence + brand voice, not predicted clicks. It is a filter to pick the 6-8 to actually A/B test in Meta with budget. The <span style="color:#e0b96a">amber</span> dims (photo, proof) are editorial judgment, the rest are mechanical. Click any image to open full size.</p>
<div class="statbar">
  <div><b>${avg}</b> average</div>
  <div><b>${ranked[0].score.total}</b> top (${ranked[0].slug})</div>
  <div><b>${ranked[ranked.length - 1].score.total}</b> lowest (${ranked[ranked.length - 1].slug})</div>
  <div><b>${voiceFailN === 0 ? 'all 30 pass' : voiceFailN + ' fail'}</b> brand-voice gate</div>
</div>

<h2><span class="dot" style="color:#cbe07f">●</span>Ranked — all 30, best to worst<span class="sub">Top-to-bottom by score. This is the cut list: run the top 6-8, hold the rest. Score = hook + self-qualify + cta + subheading + legibility + <span style="color:#e0b96a">photo</span> + <span style="color:#e0b96a">proof</span>.</span></h2>
<div class="grid">
${rankedCards}
</div>

<h2><span class="dot" style="color:#7fd1b9">●</span>Call ads · ${callN}<span class="sub">Drive a phone call. CTA is the FUB-tracked line 541.703.3095 so calls route through Follow Up Boss for attribution. Conversational, human, "let's talk."</span></h2>
<div class="grid">
${callCards}
</div>

<h2><span class="dot" style="color:#e0b96a">●</span>Seller-LP ads · ${lpN}<span class="sub">Drive a home-value form fill on the seller landing page. CTA is the estimate action. Curiosity and value driven.</span></h2>
<div class="grid">
${lpCards}
</div>
</body></html>`

await writeFile(resolve(OUT_DIR, 'v10-contact-sheet.html'), sheet, 'utf-8')

// ── Multi-size placement sheet ───────────────────────────────────────────────
const msCard = (e) => `
<div class="ms-concept">
  <div class="ms-title">${e.headline}</div>
  <div class="ms-sub">↳ ${e.subHeading} &nbsp;·&nbsp; ▸ ${e.button}</div>
  <div class="ms-row">
    <figure><a href="${e.sizes['1x1']}" target="_blank"><img class="r1x1" src="${e.sizes['1x1']}"></a><figcaption>1:1 · 1080×1080<br>feed fallback</figcaption></figure>
    <figure><a href="${e.sizes['4x5']}" target="_blank"><img class="r4x5" src="${e.sizes['4x5']}"></a><figcaption>4:5 · 1080×1350<br>FB / IG feed</figcaption></figure>
    <figure><a href="${e.sizes['9x16']}" target="_blank"><img class="r9x16" src="${e.sizes['9x16']}"></a><figcaption>9:16 · 1080×1920<br>stories / reels</figcaption></figure>
  </div>
</div>`
const msSheet = `<!doctype html><html><head><meta charset="utf-8"><title>Seller ads — screen-size variants</title>
<style>
  body{font-family:Georgia,serif;background:#0a0d12;color:#faf6ec;margin:0;padding:36px}
  h1{font-style:italic;font-size:34px;font-weight:400;margin:0 0 8px;letter-spacing:-0.01em}
  p.lede{color:rgba(250,246,236,0.72);max-width:1100px;line-height:1.6;font-size:15px;font-style:italic;margin:0 0 24px}
  .ms-concept{max-width:1120px;margin:0 0 12px;border-bottom:1px solid rgba(250,246,236,0.14);padding:0 0 34px;margin-bottom:34px}
  .ms-title{font-style:italic;font-size:25px;margin-bottom:5px}
  .ms-sub{font-size:13px;color:rgba(250,246,236,0.62);margin-bottom:18px;font-style:italic}
  .ms-row{display:flex;gap:22px;align-items:flex-start}
  .ms-row figure{margin:0;flex:0 0 auto;text-align:center}
  .ms-row img{display:block;border:1px solid rgba(250,246,236,0.18);border-radius:3px;background:#000}
  img.r1x1{width:330px;height:330px}
  img.r4x5{width:264px;height:330px}
  img.r9x16{width:186px;height:330px}
  figcaption{margin-top:9px;font-size:10.5px;letter-spacing:0.08em;text-transform:uppercase;color:rgba(250,246,236,0.5);line-height:1.5}
</style></head><body>
<h1>Seller ads — screen-size variants</h1>
<p class="lede">Four lead-gen concepts, each rendered for every Meta placement. Supplying all three ratios lets Meta serve the right crop per placement automatically (placement asset customization). Lead CTA baked on-image. Click any tile for full size.</p>
${multiResults.map(msCard).join('\n')}
</body></html>`
await writeFile(resolve(OUT_DIR, 'multisize-sheet.html'), msSheet, 'utf-8')

// ── Reactivation contact sheet ───────────────────────────────────────────────
// Three tier sections (T1 Database / T2A Premium Sellers / T2B West Bend),
// each with its 2 variants. Shows 4:5 + 9:16 side by side plus the Meta ad
// copy (primary text, headline, description, CTA). Static Meta copy per Matt.
const REACT_META = {
  'react-t1-v1-worth-today': {
    primary: "Your home's value changes with every sale in your neighborhood. See where yours stands right now, based on what's actually sold nearby. No pressure, just the real number.",
    headline: "Curious what your home is worth?",
    description: "Free estimate, no commitment",
    cta: "Get quote",
  },
  'react-t1-v2-make-a-move': {
    primary: "A lot has changed in Bend over the last year. Before you decide anything, it helps to know your actual number. One form, real data from recent sales near you, no obligation.",
    headline: "What's your Bend home worth now?",
    description: "Based on real local sales",
    cta: "Get quote",
  },
  'react-t2a-v1-bring-today': {
    primary: "Equity looks different than it did two years ago. If you've owned your Bend home for a while, see what buyers are paying for homes like yours right now.",
    headline: "What would your home bring today?",
    description: "Based on current Bend sales",
    cta: "Get quote",
  },
  'react-t2a-v2-out-of-state': {
    primary: "Managing a Bend property from out of town is easier than it sounds when the right team is on the ground. Find out what your home is worth right now, and what a full-service sale would look like.",
    headline: "Own a Bend home from out of state?",
    description: "We handle it from here",
    cta: "Get quote",
  },
  'react-t2b-v1-west-bend-worth': {
    primary: "West Bend moves differently than the rest of Bend. What sold on your street matters more than a city-wide average. See what homes near you have actually sold for, from our team.",
    headline: "What's your West Bend home worth?",
    description: "Based on nearby Bend sales",
    cta: "Get quote",
  },
  'react-t2b-v2-westside-going-for': {
    primary: "Homes in Northwest Crossing, Awbrey Butte, and the westside have their own market. See what comparable homes have actually sold for near you, with a real number from our local team.",
    headline: "What are westside homes going for?",
    description: "Real comps from your neighborhood",
    cta: "Get quote",
  },
}
const REACT_TIERS = [
  {
    id: 'T1',
    label: 'T1 — Database (all past seller leads)',
    desc: 'Retargets everyone who previously engaged but never converted. Curiosity and value angle.',
    slugs: ['react-t1-v1-worth-today', 'react-t1-v2-make-a-move'],
  },
  {
    id: 'T2A',
    label: 'T2A — Premium sellers (higher-value + longer tenure)',
    desc: 'Equity-rich, longer-owned Bend homes. What-would-it-bring + absentee-owner angle.',
    slugs: ['react-t2a-v1-bring-today', 'react-t2a-v2-out-of-state'],
  },
  {
    id: 'T2B',
    label: 'T2B — West Bend (NW Crossing, Awbrey Butte, westside)',
    desc: 'Hyper-local westside Bend targeting. Neighborhood-specific value + comps angle.',
    slugs: ['react-t2b-v1-west-bend-worth', 'react-t2b-v2-westside-going-for'],
  },
]

// Look up the multiResults entry for each slug to get the rendered image paths.
// Images are in multisize/ relative to OUT_DIR so we reference them as relative paths.
const reactTierHtml = REACT_TIERS.map(tier => {
  const variantsHtml = tier.slugs.map(slug => {
    const entry = multiResults.find(e => e.slug === slug)
    const meta = REACT_META[slug]
    const v = VARIANTS.find(x => x.slug === slug)
    if (!entry || !meta || !v) return `<div style="color:#e08a6a">Missing data for ${slug}</div>`
    const img45  = entry.sizes['4x5']   // relative path like multisize/seller-v10-...-4x5.jpg
    const img916 = entry.sizes['9x16']
    return `
<div class="rv-variant">
  <div class="rv-slug">${slug}</div>
  <div class="rv-hl">${v.headline}</div>
  <div class="rv-row">
    <div class="rv-images">
      <figure>
        <a href="${img45}" target="_blank"><img class="rv45" src="${img45}" alt="${slug} 4:5"></a>
        <figcaption>4:5 · 1080×1350<br>FB / IG feed</figcaption>
      </figure>
      <figure>
        <a href="${img916}" target="_blank"><img class="rv916" src="${img916}" alt="${slug} 9:16"></a>
        <figcaption>9:16 · 1080×1920<br>stories / reels</figcaption>
      </figure>
    </div>
    <div class="rv-copy">
      <div class="rv-copy-label">Meta ad copy</div>
      <div class="rv-primary"><span class="rv-field">Primary:</span> ${meta.primary}</div>
      <div class="rv-headline"><span class="rv-field">Headline:</span> ${meta.headline}</div>
      <div class="rv-desc"><span class="rv-field">Description:</span> ${meta.description}</div>
      <div class="rv-cta-line"><span class="rv-field">CTA:</span> ${meta.cta}</div>
      <div class="rv-review-label">Review on ad art</div>
      <div class="rv-review">"${v.quote.text}"<span class="rv-revattr">${v.quote.author} · ${v.quote.source} review</span></div>
    </div>
  </div>
</div>`
  }).join('\n')
  return `
<div class="rv-tier">
  <h2>${tier.label}</h2>
  <p class="rv-tier-desc">${tier.desc}</p>
  ${variantsHtml}
</div>`
}).join('\n')

const reactSheet = `<!doctype html><html><head><meta charset="utf-8"><title>Reactivation ads — T1 / T2A / T2B contact sheet</title>
<style>
  body{font-family:Georgia,serif;background:#0a0d12;color:#faf6ec;margin:0;padding:36px}
  h1{font-style:italic;font-size:34px;font-weight:400;margin:0 0 6px;letter-spacing:-0.01em}
  p.lede{color:rgba(250,246,236,0.72);max-width:1200px;line-height:1.6;font-size:15px;font-style:italic;margin:0 0 32px}
  .rv-tier{max-width:1240px;margin:0 auto 52px}
  .rv-tier h2{font-family:Georgia,serif;font-size:13px;font-style:normal;font-weight:400;letter-spacing:0.24em;text-transform:uppercase;margin:0 0 4px;padding-bottom:10px;border-bottom:1px solid rgba(250,246,236,0.2);color:#faf6ec}
  .rv-tier-desc{font-style:italic;font-size:13px;color:rgba(250,246,236,0.55);margin:6px 0 22px}
  .rv-variant{margin:0 0 36px;padding:0 0 36px;border-bottom:1px solid rgba(250,246,236,0.08)}
  .rv-variant:last-child{border-bottom:none}
  .rv-slug{font-size:10px;text-transform:uppercase;letter-spacing:0.18em;color:rgba(250,246,236,0.4);margin-bottom:5px}
  .rv-hl{font-style:italic;font-size:22px;color:#faf6ec;margin-bottom:14px;font-family:Georgia,serif}
  .rv-row{display:flex;gap:32px;align-items:flex-start}
  .rv-images{display:flex;gap:16px;align-items:flex-start;flex:0 0 auto}
  .rv-images figure{margin:0;text-align:center}
  .rv-images img{display:block;border:1px solid rgba(250,246,236,0.18);border-radius:3px;background:#000}
  img.rv45{width:216px;height:270px}
  img.rv916{width:152px;height:270px}
  figcaption{margin-top:8px;font-size:10px;letter-spacing:0.07em;text-transform:uppercase;color:rgba(250,246,236,0.45);line-height:1.5}
  .rv-copy{flex:1 1 auto;padding-top:4px}
  .rv-copy-label,.rv-review-label{font-size:10px;text-transform:uppercase;letter-spacing:0.18em;color:rgba(250,246,236,0.38);margin-bottom:10px;margin-top:0}
  .rv-review-label{margin-top:18px}
  .rv-primary,.rv-headline,.rv-desc,.rv-cta-line{font-size:14px;line-height:1.55;color:rgba(250,246,236,0.82);margin-bottom:8px}
  .rv-field{font-style:normal;font-size:10px;text-transform:uppercase;letter-spacing:0.14em;color:rgba(250,246,236,0.4);margin-right:6px}
  .rv-review{font-style:italic;color:rgba(250,246,236,0.58);font-family:Georgia,serif;font-size:14px;line-height:1.45}
  .rv-revattr{display:block;margin-top:5px;font-style:normal;font-size:11px;letter-spacing:0.04em;color:rgba(250,246,236,0.38)}
</style></head><body>
<h1>Reactivation ads — T1 / T2A / T2B</h1>
<p class="lede">Six variants across three audience tiers. Each shows the 4:5 (FB/IG feed) and 9:16 (Stories/Reels) renders side by side with the corresponding Meta ad copy. All six use Matt's solo headshot. Click any image for full size.</p>
${reactTierHtml}
</body></html>`
await writeFile(resolve(OUT_DIR, 'contact-sheet-reactivation.html'), reactSheet, 'utf-8')

console.log(`\nMultisize sheet: ${resolve(OUT_DIR, 'multisize-sheet.html')}`)
console.log(`Reactivation contact sheet: ${resolve(OUT_DIR, 'contact-sheet-reactivation.html')}`)
console.log(`\nDone. Sheet: ${resolve(OUT_DIR, 'v10-contact-sheet.html')}`)
console.log(`Scorecard: ${resolve(OUT_DIR, 'scorecard.json')}  (avg ${avg}, ${voiceFailN} voice fails)`)
