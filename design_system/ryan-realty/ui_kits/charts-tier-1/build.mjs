#!/usr/bin/env node
/**
 * charts-tier-1 — renders index.html from the verified rows in data.mjs.
 *
 *   node design_system/ryan-realty/ui_kits/charts-tier-1/build.mjs
 *
 * No dependencies. Every figure drawn comes from data.mjs, which carries the
 * SQL that produced it. Colour discipline: navy is the norm, --rr-exception
 * marks a data exception (a decline, a breached threshold) and nothing else.
 */
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as D from './data.mjs'

const OUT = join(dirname(fileURLToPath(import.meta.url)), 'index.html')

/* ── primitives ─────────────────────────────────────────────────────────── */
const NAVY = '#102742'
const EXC = 'var(--rr-exception)'
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const r1 = (n) => (Math.round(n * 10) / 10).toFixed(1)
const r2 = (n) => (Math.round(n * 100) / 100).toFixed(2)
const usd = (n) => '$' + Math.round(n).toLocaleString('en-US')
/** One decimal, but no trailing ".0" — "100%" reads better than "100.0%". */
const pct1 = (n) => (Number.isInteger(n) ? String(n) : r1(n))
const usdK = (n) => '$' + Math.round(n / 1000) + 'K'
const scale = (d0, d1, r0, r1_) => (v) => r0 + ((v - d0) / (d1 - d0)) * (r1_ - r0)
const path = (pts) => pts.map((p, i) => (i ? 'L' : 'M') + r2(p[0]) + ' ' + r2(p[1])).join(' ')

/** Sample-size chip. Drawn for every geography, flagged when thin. */
const nChip = (n) =>
  n < D.SMALL_N
    ? `<span class="n-chip thin" title="Fewer than ${D.SMALL_N} sales — read as directional">n=${n}</span>`
    : `<span class="n-chip">n=${n}</span>`

/* ── §1a  concession wedge: two lines + the shaded band between them ────── */
function wedgeChart() {
  const rows = D.CONCESSIONS_PAYERS.rows
  const W = 560, H = 300, L = 66, R = 16, T = 30, B = 44
  // Domain carries headroom above the peak and below the trough so the
  // attached labels sit in clear space instead of crossing a line.
  const lo = 564000, hi = 632000
  const x = scale(0, rows.length - 1, L, W - R)
  const y = scale(lo, hi, H - B, T)
  const gross = rows.map((d, i) => [x(i), y(d.gross)])
  const net = rows.map((d, i) => [x(i), y(d.net)])
  const band = path(gross) + ' L' + r2(net[net.length - 1][0]) + ' ' + r2(net[net.length - 1][1]) +
    ' ' + net.slice(0, -1).reverse().map((p) => 'L' + r2(p[0]) + ' ' + r2(p[1])).join(' ') + ' Z'
  // Widest wedge = the exception.
  let wi = 0
  rows.forEach((d, i) => { if (d.gross - d.net > rows[wi].gross - rows[wi].net) wi = i })
  const gap = rows[wi].gross - rows[wi].net

  const grid = [575000, 590000, 605000, 620000].map((v) =>
    `<line x1="${L}" y1="${r2(y(v))}" x2="${W - R}" y2="${r2(y(v))}" class="grid"/>
     <text x="${L - 8}" y="${r2(y(v) + 6)}" class="ax ar">${usdK(v)}</text>`).join('')

  const ticks = rows.map((d, i) => i % 2 === 0 || i === rows.length - 1
    ? `<text x="${r2(x(i))}" y="${H - B + 22}" class="ax mid">${d.qtr.replace('20', "'")}</text>` : '').join('')

  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Median gross price versus median seller net among sellers who paid a concession, by quarter">
  ${grid}
  <path d="${band}" fill="${NAVY}" fill-opacity="0.13"/>
  <path d="${path(gross)}" fill="none" stroke="${NAVY}" stroke-width="2.5"/>
  <path d="${path(net)}" fill="none" stroke="${NAVY}" stroke-width="2.5" stroke-dasharray="5 4" opacity="0.75"/>
  <line x1="${r2(x(wi))}" y1="${r2(y(rows[wi].gross))}" x2="${r2(x(wi))}" y2="${r2(y(rows[wi].net))}" stroke="${EXC}" stroke-width="3"/>
  <circle cx="${r2(x(wi))}" cy="${r2(y(rows[wi].gross))}" r="4" fill="${EXC}"/>
  <circle cx="${r2(x(wi))}" cy="${r2(y(rows[wi].net))}" r="4" fill="${EXC}"/>
  <text x="${r2(x(wi))}" y="${r2(y(rows[wi].gross) - 11)}" class="anno exc mid">${usd(gap)}</text>
  <text x="${r2(x(1) + 9)}" y="${r2(y(rows[1].gross) - 11)}" class="anno">gross close price</text>
  <text x="${r2(x(7) - 4)}" y="${r2(y(rows[7].net) + 25)}" class="anno dim mid">seller net after concession</text>
  ${ticks}
</svg>`
}

/* ── §1b  concession incidence ──────────────────────────────────────────── */
function incidenceChart() {
  const rows = D.CONCESSIONS_ALL.rows
  const W = 560, H = 250, L = 50, R = 16, T = 28, B = 44
  const x = scale(0, rows.length - 1, L, W - R)
  const y = scale(33, 55, H - B, T)
  const solid = rows.filter((d) => !d.partial)
  const line = path(solid.map((d, i) => [x(i), y(d.inc)]))
  const li = solid.length - 1
  const tail = path([[x(li), y(solid[li].inc)], [x(li + 1), y(rows[li + 1].inc)]])
  const grid = [35, 40, 45, 50].map((v) =>
    `<line x1="${L}" y1="${r2(y(v))}" x2="${W - R}" y2="${r2(y(v))}" class="grid"/>
     <text x="${L - 8}" y="${r2(y(v) + 6)}" class="ax ar">${v}%</text>`).join('')
  const dots = rows.map((d, i) =>
    `<circle cx="${r2(x(i))}" cy="${r2(y(d.inc))}" r="${d.partial ? 3.5 : 3}" fill="${d.partial ? '#fff' : NAVY}" ${d.partial ? `stroke="${NAVY}" stroke-width="2"` : ''}/>`).join('')
  const ticks = rows.map((d, i) => i % 2 === 0 || i === rows.length - 1
    ? `<text x="${r2(x(i))}" y="${H - B + 22}" class="ax mid">${d.qtr.replace('20', "'")}</text>` : '').join('')
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Share of closed sales carrying a seller concession, by quarter">
  ${grid}
  <path d="${line}" fill="none" stroke="${NAVY}" stroke-width="2.5"/>
  <path d="${tail}" fill="none" stroke="${NAVY}" stroke-width="2.5" stroke-dasharray="4 3" opacity="0.55"/>
  ${dots}
  <text x="${r2(x(0) + 3)}" y="${r2(y(rows[0].inc) + 21)}" class="anno">${r1(rows[0].inc)}% of sales</text>
  <text x="${r2(x(rows.length - 1) - 6)}" y="${r2(y(rows[rows.length - 1].inc) - 37)}" class="anno ar">${r1(rows[rows.length - 1].inc)}%</text>
  <text x="${r2(x(rows.length - 1) - 6)}" y="${r2(y(rows[rows.length - 1].inc) - 14)}" class="anno dim ar">quarter in progress</text>
  ${ticks}
</svg>`
}

/* ── §2a  long monthly path: two lines + cross-city range band ───────────── */
function stoBandChart() {
  const rows = D.STO_MONTHLY.rows
  // 680x400 rather than a wide-and-short box: at 390px the plot still stands
  // ~200px tall, enough for a 26-point range across 139 months.
  const W = 680, H = 400, L = 56, R = 14, T = 30, B = 48
  const lo = 84, hi = 110
  const x = scale(0, rows.length - 1, L, W - R)
  const y = scale(lo, hi, H - B, T)
  const hiPts = rows.map((d, i) => [x(i), y(d[4])])
  const loPts = rows.map((d, i) => [x(i), y(d[3])])
  const band = path(hiPts) + ' ' + loPts.reverse().map((p) => 'L' + r2(p[0]) + ' ' + r2(p[1])).join(' ') + ' Z'
  const bend = path(rows.map((d, i) => [x(i), y(d[1])]))
  const red = path(rows.map((d, i) => [x(i), y(d[2])]))
  const grid = [85, 90, 95, 100, 105, 110].map((v) =>
    `<line x1="${L}" y1="${r2(y(v))}" x2="${W - R}" y2="${r2(y(v))}" class="grid"/>
     <text x="${L - 8}" y="${r2(y(v) + 8)}" class="ax lg ar">${v}%</text>`).join('')
  // 100% = sold at the original asking price. The line that matters.
  const par = `<line x1="${L}" y1="${r2(y(100))}" x2="${W - R}" y2="${r2(y(100))}" stroke="${NAVY}" stroke-width="1.5" stroke-dasharray="6 5" opacity="0.55"/>
    <text x="${W - R - 4}" y="${r2(y(100) - 10)}" class="anno lg ar">100% = sold at the original ask</text>`
  const years = []
  rows.forEach((d, i) => {
    const [yr, mo] = d[0].split('-')
    if (mo === '01' && Number(yr) % 2 === 1) years.push(`<text x="${r2(x(i))}" y="${H - B + 34}" class="ax lg mid">${yr}</text>`)
  })
  const idx = (mo) => rows.findIndex((d) => d[0] === mo)
  const peak = idx('2021-05'), trough = idx('2022-12'), lab = idx('2025-11')
  // Series are labelled at 2025-11, where Bend (94.52) and Redmond (97.34) are
  // ~2.8 points apart — they cross too often to label at the right-hand edge.
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Median sale-to-original-ask by month since 2015, Bend and Redmond against the full range across all seven cities">
  ${grid}
  <path d="${band}" fill="${NAVY}" fill-opacity="0.10"/>
  ${par}
  <path d="${red}" fill="none" stroke="${NAVY}" stroke-width="2" stroke-dasharray="5 4" opacity="0.72"/>
  <path d="${bend}" fill="none" stroke="${NAVY}" stroke-width="2.6"/>
  <circle cx="${r2(x(peak))}" cy="${r2(y(rows[peak][1]))}" r="4.5" fill="${NAVY}"/>
  <text x="${r2(x(peak))}" y="${r2(y(rows[peak][1]) - 15)}" class="anno lg mid">Bend peaked at ${r2(rows[peak][1])}% — May 2021</text>
  <circle cx="${r2(x(trough))}" cy="${r2(y(rows[trough][1]))}" r="4.5" fill="${EXC}"/>
  <text x="${r2(x(trough) - 10)}" y="${r2(y(rows[trough][1]) + 5)}" class="anno exc lg ar">${r2(rows[trough][1])}% — Dec 2022</text>
  <text x="${r2(x(lab) + 8)}" y="${r2(y(rows[lab][2]) - 11)}" class="anno dim lg ar">Redmond</text>
  <text x="${r2(x(lab) + 8)}" y="${r2(y(rows[lab][1]) + 22)}" class="anno lg ar">Bend</text>
  <text x="${L + 6}" y="${T + 4}" class="anno dim lg">shaded band = full range across all seven cities</text>
  ${years.join('')}
</svg>`
}

/* ── §2b  ranked dumbbell, prior year → this year ────────────────────────── */
function stoDumbbell() {
  const rows = D.STO_QUARTER.rows
  // L=152 so "Black Butte Ranch" clears the left edge at 390px.
  const W = 560, H = 22 + rows.length * 30 + 46, L = 152, R = 58, T = 22
  const x = scale(89, 101, L, W - R)
  const rowY = (i) => T + 28 + i * 30
  const grid = [90, 93, 96, 99].map((v) =>
    `<line x1="${r2(x(v))}" y1="${T - 4}" x2="${r2(x(v))}" y2="${rowY(rows.length - 1) + 12}" class="grid"/>
     <text x="${r2(x(v))}" y="${rowY(rows.length - 1) + 30}" class="ax mid">${v}%</text>`).join('')
  const bars = rows.map((d, i) => {
    const yy = rowY(i)
    const down = d.v26 < d.v25
    const col = down ? EXC : NAVY
    const dl = (d.v26 - d.v25).toFixed(2)
    return `<text x="${L - 10}" y="${yy + 4}" class="lbl ar${d.n26 < D.SMALL_N ? ' thin' : ''}">${esc(d.city)}</text>
    <line x1="${r2(x(d.v25))}" y1="${yy}" x2="${r2(x(d.v26))}" y2="${yy}" stroke="${col}" stroke-width="2.5" opacity="0.5"/>
    <circle cx="${r2(x(d.v25))}" cy="${yy}" r="4" fill="#fff" stroke="${NAVY}" stroke-width="1.8" opacity="0.75"/>
    <circle cx="${r2(x(d.v26))}" cy="${yy}" r="5" fill="${col}"/>
    <text x="${W - R + 8}" y="${yy + 4}" class="val ${down ? 'exc' : ''}">${dl > 0 ? '+' : ''}${dl}</text>`
  }).join('')
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Median sale-to-original-ask by city, Q2 2025 hollow dot to Q2 2026 filled dot">
  ${grid}${bars}
  <text x="${L - 10}" y="${T + 2}" class="anno dim ar">city</text>
  <text x="${W - R + 8}" y="${T + 2}" class="anno dim">YoY pts</text>
</svg>`
}

/* ── §3  days-to-offer vs CDOM, paired bars ─────────────────────────────── */
function dtoChart() {
  const rows = D.DTO_JULY.rows
  // CDOM sits INSIDE its tint bar and days-to-offer just outside the solid bar,
  // so neither number can collide with the year-over-year column on the right.
  const W = 560, H = 44 + rows.length * 44 + 26 + 34, L = 118, R = 78, T = 26
  const x = scale(0, 130, L, W - R)
  const bi = rows.findIndex((d) => d.city === 'Bend')
  // Rows below Bend drop 26 units so the gap callout gets a lane of its own
  // instead of sitting on top of the next city's bar.
  const rowY = (i) => T + 34 + i * 44 + (i > bi ? 26 : 0)
  const grid = [0, 30, 60, 90, 120].map((v) =>
    `<line x1="${r2(x(v))}" y1="${T + 8}" x2="${r2(x(v))}" y2="${rowY(rows.length - 1) + 18}" class="grid"/>
     <text x="${r2(x(v))}" y="${rowY(rows.length - 1) + 36}" class="ax mid">${v}d</text>`).join('')
  const bars = rows.map((d, i) => {
    const yy = rowY(i)
    const slower = d.dto26 > d.dto25
    const dl = (d.dto26 - d.dto25).toFixed(1).replace('.0', '')
    // CDOM label goes to the right of its bar when the YoY column leaves room,
    // otherwise inside the bar — either way it never runs into the DTO number.
    const outside = x(d.cdom26) + 56 < W - R + 4
    const cx = outside ? x(d.cdom26) + 7 : x(d.cdom26) - 7
    return `<text x="${L - 10}" y="${yy + 6}" class="lbl ar${d.n26 < D.SMALL_N ? ' thin' : ''}">${esc(d.city)}</text>
    <rect x="${L}" y="${yy - 8}" width="${r2(x(d.cdom26) - L)}" height="17" rx="3" fill="${NAVY}" fill-opacity="0.15"/>
    <rect x="${L}" y="${yy - 8}" width="${r2(x(d.dto26) - L)}" height="17" rx="3" fill="${NAVY}"/>
    <text x="${r2(cx)}" y="${yy + 5}" class="val sm dim${outside ? '' : ' ar'}">${d.cdom26}</text>
    <text x="${r2(x(d.dto26) + 7)}" y="${yy + 5}" class="val sm">${d.dto26}</text>
    <text x="${W - R + 10}" y="${yy + 5}" class="val sm ${slower ? 'exc' : ''}">${slower ? '+' : ''}${dl}d</text>`
  }).join('')
  // One gap callout, on the city with the sample to carry it.
  const gy = rowY(bi)
  const gap = `<line x1="${r2(x(rows[bi].dto26))}" y1="${gy + 14}" x2="${r2(x(rows[bi].cdom26))}" y2="${gy + 14}" stroke="${NAVY}" stroke-width="1" opacity="0.45"/>
    <line x1="${r2(x(rows[bi].dto26))}" y1="${gy + 10}" x2="${r2(x(rows[bi].dto26))}" y2="${gy + 18}" stroke="${NAVY}" stroke-width="1" opacity="0.45"/>
    <line x1="${r2(x(rows[bi].cdom26))}" y1="${gy + 10}" x2="${r2(x(rows[bi].cdom26))}" y2="${gy + 18}" stroke="${NAVY}" stroke-width="1" opacity="0.45"/>
    <text x="${r2((x(rows[bi].dto26) + x(rows[bi].cdom26)) / 2)}" y="${gy + 34}" class="anno mid">${rows[bi].cdom26 - rows[bi].dto26} — the two medians differ by this much</text>`
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Median days to offer against median days-on-market-at-close by city, July 2026">
  ${grid}${bars}${gap}
  <text x="${L}" y="${T + 2}" class="anno">solid = days to offer</text>
  <text x="${r2(x(130))}" y="${T + 2}" class="anno dim ar">tint = days on market at close</text>
  <text x="${W - R + 10}" y="${T + 2}" class="anno dim">vs Jul '25</text>
</svg>`
}

/* ── §4  price cuts, ranked, against the regional reference ─────────────── */
/** A city counts as an exception only at more than half again the regional
 *  rate. Marking everything a hair over 8.49% would paint four bars terracotta
 *  and turn the accent into decoration. */
const CUT_EXC_MULTIPLE = 1.5

function cutsChart() {
  const rows = D.CUTS.rows, reg = D.CUTS.region
  const thr = reg.pct * CUT_EXC_MULTIPLE
  // L=158 so "Black Butte Ranch" stays inside the card at 390px.
  const W = 560, H = 46 + rows.length * 32 + 34, L = 158, R = 96, T = 46
  const x = scale(0, 20, L, W - R)
  const rowY = (i) => T + 14 + i * 32
  const grid = [0, 5, 10, 15, 20].map((v) =>
    `<line x1="${r2(x(v))}" y1="${T - 10}" x2="${r2(x(v))}" y2="${rowY(rows.length - 1) + 14}" class="grid"/>
     <text x="${r2(x(v))}" y="${rowY(rows.length - 1) + 32}" class="ax mid">${v}%</text>`).join('')
  const ref = `<line x1="${r2(x(reg.pct))}" y1="${T - 10}" x2="${r2(x(reg.pct))}" y2="${rowY(rows.length - 1) + 14}" stroke="${NAVY}" stroke-width="1.5" stroke-dasharray="5 4" opacity="0.6"/>
    <text x="${r2(x(reg.pct) - 7)}" y="${T - 14}" class="anno ar">Central Oregon ${r2(reg.pct)}%</text>`
  const bars = rows.map((d, i) => {
    const yy = rowY(i)
    const above = d.pct > thr
    const zero = d.pct === 0
    // Value sits inside the bar once the bar can hold it; zeros get a tick and
    // an outside label so a thin sample stays visible instead of blank.
    const inside = !zero && x(d.pct) - L > 64
    return `<text x="${L - 10}" y="${yy + 5}" class="lbl ar${d.actives < D.SMALL_N ? ' thin' : ''}">${esc(d.city)}</text>
    ${zero ? `<line x1="${L}" y1="${yy - 7}" x2="${L}" y2="${yy + 7}" stroke="${NAVY}" stroke-width="2.5" opacity="0.4"/>`
      : `<rect x="${L}" y="${yy - 8}" width="${r2(x(d.pct) - L)}" height="16" rx="3" fill="${above ? EXC : NAVY}" fill-opacity="${above ? 1 : 0.88}"/>`}
    <text x="${r2(inside ? x(d.pct) - 8 : (zero ? L + 9 : x(d.pct) + 7))}" y="${yy + 5}" class="val sm ${inside ? 'inv' : (above ? 'exc' : '')}${inside ? ' ar' : ''}">${r2(d.pct)}%</text>
    <text x="${W - R + 46}" y="${yy + 5}" class="val sm dim ar">${d.drops.toFixed(2)}</text>`
  }).join('')
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Share of active listings carrying at least one price cut, by city, against the regional rate">
  ${grid}${ref}${bars}
  <text x="${W - R + 46}" y="${T - 34}" class="anno dim ar">avg cuts</text>
  <text x="${W - R + 46}" y="${T - 10}" class="anno dim ar">per listing</text>
</svg>`
}

/* ── source line ────────────────────────────────────────────────────────── */
const src = (parts) => `<details class="srcd"><summary>Source</summary><p>${parts.map(esc).join(' · ')}</p></details>`

/* ── page ───────────────────────────────────────────────────────────────── */
const cAll = D.CONCESSIONS_ALL.rows
const q2 = cAll.find((d) => d.qtr === '2026Q2')
const q1_24 = cAll[0]
const payersQ2 = D.CONCESSIONS_PAYERS.rows.find((d) => d.qtr === '2026Q2')
const bendD = D.DTO_JULY.rows.find((d) => d.city === 'Bend')
const redQ = D.STO_QUARTER.rows.find((d) => d.city === 'Redmond')
const bendQ = D.STO_QUARTER.rows.find((d) => d.city === 'Bend')
const bbr = D.STO_QUARTER.rows.find((d) => d.city === 'Black Butte Ranch')
const sisters = D.DTO_JULY.rows.find((d) => d.city === 'Sisters')
const bendCut = D.CUTS.rows.find((d) => d.city === 'Bend')
const bbrCut = D.CUTS.rows[0]
const terr = D.CUTS.rows.find((d) => d.city === 'Terrebonne')
const zeros = D.CUTS.rows.filter((d) => d.pct === 0)
const smallestZero = zeros.reduce((a, b) => (b.actives < a.actives ? b : a))
// Coverage of the concessions flag, derived rather than typed into the prose.
const covRows = D.CONCESSION_COVERAGE.byYear.map((y) => ({ ...y, pct: (100 * y.flagged) / y.n }))
const cov = {
  full: covRows.filter((y) => y.pct === 100),
  y2023: covRows.find((y) => y.yr === 2023),
}

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Tier 1 chart set. Ryan Realty</title>
<link rel="icon" href="../../assets/favicon.ico">
<link rel="stylesheet" href="../../colors_and_type.css">
<link rel="stylesheet" href="../_shared/site-mockup.css">
<style>
  body { background: var(--rr-cream); }
  .wrap { max-width: 1180px; margin: 0 auto; padding: 0 16px; }
  @media (min-width: 760px) { .wrap { padding: 0 32px; } }

  .kit-hero { background: var(--primary); color: #fff; padding: 40px 0 36px; }
  .kit-hero h1 { font-family: var(--font-display); color: #fff; font-size: clamp(2rem, 6vw, 3.25rem); line-height: 1.05; margin: 10px 0 0; font-weight: 700; letter-spacing: -0.02em; }
  .kit-hero p { color: rgba(255,255,255,0.82); font-size: 15px; line-height: 1.6; max-width: 62ch; margin: 14px 0 0; }
  .kit-hero .eye { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.12em; color: rgba(255,255,255,0.72); }

  section.sec { padding: 44px 0; border-top: 1px solid rgba(16,39,66,0.10); }
  section.sec:first-of-type { border-top: 0; }
  .sec-num { font-family: var(--font-mono); font-size: 12px; color: rgba(16,39,66,0.5); letter-spacing: 0.08em; }
  .sec h2 { font-family: var(--font-display); font-size: clamp(1.6rem, 4.4vw, 2.4rem); line-height: 1.12; letter-spacing: -0.015em; margin: 8px 0 0; max-width: 20ch; }
  .sec .metric { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.12em; color: rgba(16,39,66,0.55); margin-top: 14px; }
  .sec .stand { font-size: 15px; line-height: 1.65; color: rgba(16,39,66,0.78); max-width: 64ch; margin: 12px 0 0; }

  .card { background: #fff; border: 1px solid rgba(16,39,66,0.10); border-radius: 14px; padding: 18px 16px 14px; box-shadow: var(--shadow-sm); margin-top: 20px; }
  @media (min-width: 760px) { .card { padding: 24px 24px 18px; } }
  .card h3 { font-size: 15px; font-weight: 600; margin: 0 0 2px; letter-spacing: -0.005em; }
  .card .sub { font-size: 13px; color: rgba(16,39,66,0.6); margin: 0 0 14px; line-height: 1.5; }
  .duo { display: grid; grid-template-columns: 1fr; gap: 16px; }
  @media (min-width: 900px) { .duo { grid-template-columns: 1fr 1fr; gap: 20px; } .duo .card { margin-top: 0; } }

  svg { width: 100%; height: auto; display: block; overflow: visible; }
  .grid { stroke: rgba(16,39,66,0.11); stroke-width: 1; }
  text { font-family: var(--font-sans); fill: ${NAVY}; }
  /* Sized so the smallest label still clears ~10px at a 390px viewport. */
  .ax { font-size: 18px; fill: rgba(16,39,66,0.5); font-variant-numeric: tabular-nums; }
  .ax.lg { font-size: 26px; }
  .lbl { font-size: 19px; font-weight: 500; }
  .lbl.thin { fill: rgba(16,39,66,0.55); }
  .val { font-size: 19px; font-weight: 700; font-variant-numeric: tabular-nums; }
  .val.sm { font-size: 18px; font-weight: 600; }
  .anno { font-size: 17px; fill: rgba(16,39,66,0.72); font-weight: 500; }
  .anno.lg { font-size: 24px; }
  .dim { fill: rgba(16,39,66,0.5); font-weight: 400; }
  .exc { fill: var(--rr-exception); }
  .inv { fill: #fff; }
  .mid { text-anchor: middle; }
  .ar { text-anchor: end; }

  .stats { display: grid; grid-template-columns: 1fr 1fr; gap: 1px; background: rgba(16,39,66,0.10); border: 1px solid rgba(16,39,66,0.10); border-radius: 14px; overflow: hidden; margin-top: 20px; }
  @media (min-width: 760px) { .stats.four { grid-template-columns: repeat(4, 1fr); } }
  .stats .s { background: #fff; padding: 16px 14px; }
  .stats .s .k { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.09em; color: rgba(16,39,66,0.55); line-height: 1.35; }
  .stats .s .v { font-family: var(--font-display); font-size: 30px; font-weight: 700; letter-spacing: -0.01em; margin-top: 8px; font-variant-numeric: tabular-nums; line-height: 1; }
  .stats .s .v.exc { color: var(--rr-exception); }
  .stats .s .n { font-size: 12px; color: rgba(16,39,66,0.55); margin-top: 6px; font-variant-numeric: tabular-nums; }

  .src { font-family: var(--font-mono); font-size: 11px; line-height: 1.6; color: rgba(16,39,66,0.55); margin: 12px 0 0; padding-top: 10px; border-top: 1px solid rgba(16,39,66,0.09); word-break: break-word; }
  .n-chip { font-family: var(--font-mono); font-size: 11px; padding: 1px 6px; border-radius: 9999px; background: rgba(16,39,66,0.07); color: rgba(16,39,66,0.6); }
  .n-chip.thin { background: rgba(168,69,43,0.10); color: var(--rr-exception); }
  .caveat { font-size: 13px; line-height: 1.6; color: rgba(16,39,66,0.72); background: rgba(16,39,66,0.04); border-left: 2px solid var(--rr-exception); border-radius: 0 8px 8px 0; padding: 12px 14px; margin-top: 16px; }
  .caveat b { font-weight: 600; }

  footer.kit-foot { background: var(--primary); color: rgba(255,255,255,0.72); font-size: 12px; line-height: 1.7; padding: 28px 0; margin-top: 24px; }
  footer.kit-foot b { color: #fff; font-weight: 600; }

/* Collapsed §0 trace — visible copy stays clean; the receipt is one tap away */
.srcd{margin-top:14px}
.srcd summary{list-style:none;cursor:pointer;display:inline-block;font-size:10.5px;
 letter-spacing:.12em;text-transform:uppercase;font-weight:600;color:var(--mute,rgba(16,39,66,.45));
 border-bottom:1px dotted currentColor;padding-bottom:1px}
.srcd summary::-webkit-details-marker{display:none}
.srcd[open] summary{color:var(--navy,#102742)}
.srcd p{margin-top:8px;font-size:11.5px;line-height:1.65;color:var(--mute,rgba(16,39,66,.55));max-width:78ch}
.ts-sec .srcd summary{color:var(--mute-light,rgba(250,248,244,.5))}
.ts-sec .srcd p{color:var(--mute-light,rgba(250,248,244,.6))}
</style>
</head>
<body>

<div class="kit-hero">
  <div class="wrap">
    <div class="eye">Section mockups · Tier 1 chart set</div>
    <h1>Four charts nobody else in this market publishes.</h1>
    <p>Concessions, sale-to-original-ask, time-to-offer, and price-cut behaviour — each drawn from the closed-sale record rather than a headline median. Every figure carries its query. Sample sizes under ${D.SMALL_N} are marked, not dropped.</p>
  </div>
</div>

<!-- ══ 1 ══ -->
<section class="sec"><div class="wrap">
  <div class="sec-num">01</div>
  <div class="metric">Seller concessions</div>
  <h2>The concession didn't get bigger. It got normal.</h2>
  <p class="stand">Ten thousand dollars has been the median concession for seven straight quarters. What changed is how many sellers pay one: ${r1(q1_24.inc)}% of closings in ${q1_24.qtr.replace('Q', ' Q')}, ${r1(cAll[cAll.length - 1].inc)}% so far in ${cAll[cAll.length - 1].qtr.replace('Q', ' Q')}. A seller pricing off gross comps is budgeting for a cost that now lands on roughly half of all sales.</p>

  <div class="stats four">
    <div class="s"><div class="k">Sales with a concession</div><div class="v">${r1(q2.inc)}%</div><div class="n">${q2.qtr.replace('Q', ' Q')} · ${nChip(q2.n)}</div></div>
    <div class="s"><div class="k">Median concession</div><div class="v">${usd(q2.conc)}</div><div class="n">of those who paid · ${nChip(payersQ2.n)}</div></div>
    <div class="s"><div class="k">Median gross close</div><div class="v">${usdK(q2.gross)}</div><div class="n">all ${q2.n.toLocaleString('en-US')} closings</div></div>
    <div class="s"><div class="k">Median seller net</div><div class="v">${usdK(q2.net)}</div><div class="n">same ${q2.n.toLocaleString('en-US')} closings</div></div>
  </div>

  <div class="duo">
    <div class="card">
      <h3>Gross price vs what the seller kept</h3>
      <p class="sub">Sellers who paid a concession. The shaded wedge is the money that never reached them; terracotta marks the widest quarter of the run.</p>
      ${wedgeChart()}
      ${src([
        'sale_pricing_seller_net',
        "product_class='detached', concessions_yn='Yes', concessions_amount>0",
        'close_date 2024-01-01..2026-08-13',
        'median(close_price) vs median(seller_net) by quarter',
        `${D.CONCESSIONS_PAYERS.rows.reduce((a, b) => a + b.n, 0).toLocaleString('en-US')} rows`,
        `fetched ${D.FETCHED_AT}`,
      ])}
    </div>
    <div class="card">
      <h3>Share of closings carrying a concession</h3>
      <p class="sub">All detached closings, conceding and not. The dashed tail is a quarter still in progress.</p>
      ${incidenceChart()}
      ${src([
        'sale_pricing_seller_net',
        "product_class='detached'",
        'close_date 2024-01-01..2026-08-13',
        "count(concessions_yn='Yes') / count(*) by quarter",
        `${cAll.reduce((a, b) => a + b.n, 0).toLocaleString('en-US')} rows`,
        `fetched ${D.FETCHED_AT}`,
      ])}
    </div>
  </div>

  <div class="caveat"><b>Why this starts at 2024.</b> The concessions flag is only fully populated from ${D.CONCESSION_COVERAGE.nullFreeFrom}: ${cov.full.map((y) => y.yr).join(', ')} all carry it on ${pct1(cov.full[0].pct)}% of closings, against ${pct1(cov.y2023.pct)}% in 2023 and nothing usable before. An earlier start would read as a rising trend that is really rising <em>reporting</em>. Gross and net medians are taken over the same ${(q2.n).toLocaleString('en-US')}-row set — seller net is non-null for every row in this window, which is not true of the pre-2024 data.</div>
</div></section>

<!-- ══ 2 ══ -->
<section class="sec"><div class="wrap">
  <div class="sec-num">02</div>
  <div class="metric">Sale to original ask</div>
  <h2>Redmond gave back a point. Bend picked one up.</h2>
  <p class="stand">Measured against the <em>original</em> asking price, not the last one — so every price cut along the way stays in the number. Redmond sellers closed at ${r2(redQ.v26)}% of their opening ask last quarter, down ${r2(Math.abs(redQ.v26 - redQ.v25))} points from ${r2(redQ.v25)}% a year earlier. Bend went the other way, ${r2(bendQ.v25)}% to ${r2(bendQ.v26)}%.</p>

  <div class="card">
    <h3>Every month since 2015</h3>
    <p class="sub">Bend solid, Redmond dashed, and the band behind them is the full min-to-max range across all seven cities with at least five sales that month, Bend and Redmond included.</p>
    ${stoBandChart()}
    ${src([
      'pricing_market_index.median_sale_to_original',
      'monthly by city_slug, n>=5',
      '2015-01..2026-07',
      `${D.STO_MONTHLY.rows.length} months drawn`,
      'Aug 2026 excluded, month in progress',
      `fetched ${D.FETCHED_AT}`,
    ])}
  </div>

  <div class="card">
    <h3>Last complete quarter, ranked</h3>
    <p class="sub">Hollow dot ${D.STO_QUARTER.label2025}, filled dot ${D.STO_QUARTER.label2026}. Terracotta marks a city that gave ground.</p>
    ${stoDumbbell()}
    ${src([
      'sale_pricing_facts.sale_to_original',
      "product_class='detached'",
      'close_date 2026-04-01..2026-06-30 vs 2025-04-01..2025-06-30',
      'median by city_slug, n>=5',
      `fetched ${D.FETCHED_AT}`,
    ])}
  </div>

  <div class="caveat"><b>${bbr.city} is the outlier and it stays on the chart.</b> ${r2(bbr.v26)}% is a ${r2(Math.abs(bbr.v26 - bbr.v25))}-point fall, far past anything else here — but it rests on ${bbr.n26} sales against ${bbr.n25} a year earlier. At that size one heavily discounted cabin moves the median several points. Read it as a flag to go look, not as a measurement. The same caution applies to Culver, Sunriver, Terrebonne and Powell Butte, all under ${D.SMALL_N} sales and all marked. <b>Q3 2026 is deliberately not ranked here</b> — it is six weeks old, 286 Bend closings against 514 in Q2.</div>
</div></section>

<!-- ══ 3 ══ -->
<section class="sec"><div class="wrap">
  <div class="sec-num">03</div>
  <div class="metric">Days to offer</div>
  <h2>The MLS clock says ${bendD.cdom26} days. The offer came on day ${bendD.dto26}.</h2>
  <p class="stand">Days-on-market keeps counting through inspection, appraisal and financing — work that happens after a buyer has already committed. Time-to-offer stops the clock the day the listing goes pending, which is the only date a seller can actually influence. In Bend the two differ by ${bendD.cdom26 - bendD.dto26} days, so the number the market quotes is ${r1(bendD.cdom26 / bendD.dto26)}× the real wait.</p>

  <div class="stats four">
    <div class="s"><div class="k">Bend · days to offer</div><div class="v">${bendD.dto26}</div><div class="n">Jul 2026 · ${nChip(bendD.n26)}</div></div>
    <div class="s"><div class="k">Bend · CDOM</div><div class="v">${bendD.cdom26}</div><div class="n">same ${bendD.n26} sales</div></div>
    <div class="s"><div class="k">Median DOM minus median days-to-offer</div><div class="v">${bendD.cdom26 - bendD.dto26}d</div><div class="n">difference of medians, not a per-sale wait</div></div>
    <div class="s"><div class="k">Bend vs Jul 2025</div><div class="v exc">+${bendD.dto26 - bendD.dto25}d</div><div class="n">${bendD.dto25}d a year ago</div></div>
  </div>

  <div class="card">
    <h3>July 2026, by city</h3>
    <p class="sub">Solid bar is time to offer. The tint behind it runs out to days on market at close (the MLS cumulative field is empty on these closings, so this is the plain DOM figure). Terracotta on the right marks a city that slowed year over year.</p>
    ${dtoChart()}
    ${src([
      'sale_pricing_facts',
      'days_to_offer = on_market_date → pending_date',
      'cdom = MLS cumulative days on market',
      "product_class='detached', both columns non-null",
      'close_date 2026-07-01..2026-07-31 vs 2025-07-01..2025-07-31',
      'median by city_slug, n>=5',
      `fetched ${D.FETCHED_AT}`,
    ])}
  </div>

  <div class="caveat"><b>Read the small cities as direction, not measurement.</b> ${sisters.city} shows the sharpest improvement on the board, ${sisters.dto25} days to ${sisters.dto26} — but on ${sisters.n26} sales this July against ${sisters.n25} last July. Terrebonne's jump from ${D.DTO_JULY.rows[1].dto25} to ${D.DTO_JULY.rows[1].dto26} days rests on ${D.DTO_JULY.rows[1].n25} prior-year sales. Only Bend and Redmond clear ${D.SMALL_N} sales in both months. <b>July is used because August is a stub</b> — closed data runs to 2026-08-13.</div>
</div></section>

<!-- ══ 4 ══ -->
<section class="sec"><div class="wrap">
  <div class="sec-num">04</div>
  <div class="metric">Price-cut behaviour</div>
  <h2>Cutting is a resort-community habit, not a Bend one.</h2>
  <p class="stand">${r2(bendCut.pct)}% of Bend's ${bendCut.actives} active listings are carrying a price cut, below the regional ${r2(D.CUTS.region.pct)}%. ${bbrCut.city} runs at ${r2(bbrCut.pct)}% — ${(bbrCut.pct / D.CUTS.region.pct).toFixed(1)}x the regional rate — on ${bbrCut.actives} actives and ${bbrCut.mos} months of supply. This is a live snapshot of what is on the market right now, a different population from the closed sales in the three sections above.</p>

  <div class="card">
    <h3>Share of actives carrying at least one cut</h3>
    <p class="sub">Dashed line is the regional rate. Terracotta marks a city cutting at more than half again that rate — a hair over ${r2(D.CUTS.region.pct)}% is noise, not a signal.</p>
    ${cutsChart()}
    ${src([
      'market_pulse_live.price_reduction_share, avg_price_drops_active',
      "listings StandardStatus IN ('Active','Coming Soon','Active Under Contract')",
      "SFR sub-type, PropertyType='A'",
      'stored as percent 0-100, not a fraction',
      `methodology ${D.CUTS.methodology}`,
      `snapshot ${D.CUTS.updatedAt}`,
    ])}
  </div>

  <div class="caveat"><b>${zeros.length === 3 ? 'Three' : zeros.length} cities show 0% and the denominators say why.</b> ${zeros.map((z) => `${z.city} has ${z.actives} actives`).join(', ')}. Those are true zeros, not missing data — but on ${smallestZero.actives} listings, a single price cut would move the rate to ${pct1(100 / smallestZero.actives)}%. They are drawn as a tick at zero rather than an absent bar so the thin sample stays visible instead of implied. Terrebonne's ${r2(terr.pct)}% is ${Math.round((terr.pct / 100) * terr.actives)} cut out of ${terr.actives}.</div>
</div></section>

<footer class="kit-foot"><div class="wrap">
  <b>Tier 1 chart set</b> · section mockups for review, not a shipped page.<br>
  Sources: <b>sale_pricing_facts</b> (${D.COVERAGE.rows[0].n.toLocaleString('en-US')} closings, ${D.COVERAGE.rows[0].min} to ${D.COVERAGE.rows[0].max}) · <b>sale_pricing_seller_net</b> · <b>pricing_market_index</b> (${D.COVERAGE.rows[2].n.toLocaleString('en-US')} city-months) · <b>market_pulse_live</b> (${D.COVERAGE.rows[3].n} geographies, ${D.COVERAGE.rows[3].max}).<br>
  All closed-sale figures are detached single-family. Queried live ${D.FETCHED_AT}; every query is printed in <b>data.mjs</b> beside the rows it returned.
</div></footer>

</body>
</html>
`

writeFileSync(OUT, html)
console.log('wrote', OUT, html.length, 'bytes')
