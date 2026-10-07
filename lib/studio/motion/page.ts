/**
 * lib/studio/motion/page.ts — the type layer as one self-contained HTML page.
 *
 * The page is a transparent canvas the size of the film. Each cue is a card;
 * render.ts sets every card's opacity and offset for frame t through
 * window.__rrApply and screenshots the result with a transparent background,
 * so the frames lay straight over the footage.
 *
 * Look: the heritage register for video (CLAUDE.md §3). Navy #102742 and
 * cream #faf8f4 only. Amboqia for words that are display, Geist for every
 * figure ("Amboqia never sits on a number", dataviz skill), Azo Sans for the
 * small capital eyebrow. Lead cards are navy scrim panels, the one sanctioned
 * treatment for type over moving picture (--v3-scrim-strong); the closing
 * card is cream with the navy wordmark, which is drawn from the image file
 * and never re-typeset.
 *
 * Geometry is authored at 1080 x 1920 and scales with the frame width. Cards
 * sit inside the portrait working area (x 90-990, y 280-1480) and stay out of
 * the caption band below it and the platform buttons on the right.
 */
import type { MotionAssets } from './assets'
import { CUE_PARTS, type MotionCue, type MotionPlan } from './cues'

const NAVY = '#102742'
const CREAM = '#faf8f4'

/** Width of a card's inner text column at 1080: 900 card minus 2 x 64 padding. */
const INNER = 772

function esc(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function textEl(tag: string, className: string, text: string | null, id?: string): string {
  if (!text) return ''
  return `<${tag} class="${className}"${id ? ` id="${id}"` : ''} data-text>${esc(text)}</${tag}>`
}

function meterSvg(cue: Extract<MotionCue, { kind: 'meter' }>): string {
  const x = (v: number) => Math.round((Math.min(v, cue.domainMax) / cue.domainMax) * INNER * 100) / 100
  const [low, high] = cue.thresholds
  // The lit zone is the verdict's own kind, never a second comparison.
  const zones = [
    { from: 0, to: low, label: "Seller's", active: cue.verdictKind === 'sellers' },
    { from: low, to: high, label: 'Balanced', active: cue.verdictKind === 'balanced' },
    { from: high, to: cue.domainMax, label: "Buyer's", active: cue.verdictKind === 'buyers' },
  ]
  const trackY = 28
  const segments = zones
    .map(
      (z) =>
        `<line x1="${x(z.from)}" x2="${x(z.to)}" y1="${trackY}" y2="${trackY}" stroke="${CREAM}" stroke-opacity="${z.active ? 1 : 0.38}" stroke-width="${z.active ? 6 : 3}" stroke-linecap="butt"/>`,
    )
    .join('')
  const ticks = [low, high]
    .map(
      (v) =>
        `<line x1="${x(v)}" x2="${x(v)}" y1="${trackY - 14}" y2="${trackY + 14}" stroke="${CREAM}" stroke-width="1.5"/>` +
        `<text x="${x(v)}" y="${trackY - 22}" text-anchor="middle" class="tick" data-text>${v}</text>`,
    )
    .join('')
  const labels = zones
    .map(
      (z) =>
        `<text x="${(x(z.from) + x(z.to)) / 2}" y="${trackY + 48}" text-anchor="middle" class="zone${z.active ? ' on' : ''}" data-text>${esc(z.label)}</text>`,
    )
    .join('')
  const marker = `<circle id="${cue.id}-marker" cx="0" cy="${trackY}" r="12" fill="${CREAM}" stroke="${NAVY}" stroke-width="3" data-x0="0" data-x1="${x(cue.mos)}"/>`
  return `<svg class="meter-track" viewBox="0 -8 ${INNER} 96" width="${INNER}" height="96" aria-hidden="true">${segments}${ticks}${labels}${marker}</svg>`
}

function cardHtml(cue: MotionCue, assets: MotionAssets): string {
  const id = `${cue.id}-card`
  switch (cue.kind) {
    case 'title':
      return `<section class="card lead title" id="${id}">${textEl('p', 'eyebrow', cue.eyebrow || null)}${textEl('h1', 'line', cue.line)}${textEl('p', 'value small', cue.value)}${textEl('p', 'detail', cue.detail)}</section>`
    case 'figure':
      return `<section class="card lead figure" id="${id}">${textEl('p', 'eyebrow', cue.eyebrow)}${textEl('p', 'value', cue.value)}${textEl('p', 'detail', cue.detail)}${textEl('p', 'asof', cue.asOf)}</section>`
    case 'meter':
      return `<section class="card lead meter" id="${id}">${textEl('p', 'eyebrow', cue.eyebrow)}<div class="valuerow">${textEl('span', 'value', cue.value)}${textEl('span', 'unit', 'months of supply')}</div>${meterSvg(cue)}${textEl('p', 'verdict', cue.verdict, `${cue.id}-verdict`)}${textEl('p', 'asof', cue.asOf)}</section>`
    case 'closer': {
      const mark = `<img class="mark" id="${cue.id}-mark" src="${assets.wordmark}" alt="Ryan Realty"/>`
      const cta = textEl('p', 'cta', cue.cta, `${cue.id}-cta`)
      if (!cue.agent) {
        return `<section class="closer brand" id="${id}">${mark}${cta}</section>`
      }
      const headshot = cue.agent.headshotPath ? assets.headshots[cue.agent.headshotPath] : undefined
      return `<section class="closer agent" id="${id}">${
        headshot ? `<img class="headshot" src="${headshot}" alt=""/>` : ''
      }<div class="who">${textEl('p', 'eyebrow', 'Listed by')}${textEl('p', 'name', cue.agent.name)}${mark}${cta}</div></section>`
    }
  }
}

/** The element ids render.ts will drive, in plan order. Exported for tests. */
export function drivenIds(plan: MotionPlan): string[] {
  return plan.cues.flatMap((cue) => CUE_PARTS[cue.kind].map(({ part }) => `${cue.id}-${part}`))
}

/**
 * The page runtime. Plain JavaScript in a string on purpose: nothing compiled
 * crosses into the browser, and the only thing the page does per frame is
 * apply numbers Node already computed.
 */
const RUNTIME = `
window.__rrApply = function (states) {
  for (var i = 0; i < states.length; i++) {
    var s = states[i];
    var el = document.getElementById(s.id);
    if (!el) continue;
    el.style.opacity = String(s.opacity);
    el.style.transform = 'translate3d(0,' + s.y + 'px,0)';
    if (s.marker != null) {
      var m = document.getElementById(s.id.replace(/-card$/, '-marker'));
      if (m) {
        var x0 = Number(m.getAttribute('data-x0'));
        var x1 = Number(m.getAttribute('data-x1'));
        m.setAttribute('cx', String(x0 + (x1 - x0) * s.marker));
      }
    }
  }
};
window.__rrVisibleText = function () {
  var out = [];
  var nodes = document.querySelectorAll('[data-text]');
  for (var i = 0; i < nodes.length; i++) {
    var o = 1;
    for (var n = nodes[i]; n && n !== document.body; n = n.parentElement) {
      o *= Number(getComputedStyle(n).opacity);
    }
    if (o > 0.5) out.push(nodes[i].textContent || '');
  }
  return out;
};
window.__rrPrepare = function () {
  var shots = document.querySelectorAll('img.headshot');
  for (var i = 0; i < shots.length; i++) {
    var img = shots[i];
    // A cut sits a few pixels inside the file's edge, not on it, so look at
    // the whole left 6% of the portrait for anything opaque.
    var band = Math.max(1, Math.round(img.naturalWidth * 0.06));
    var c = document.createElement('canvas');
    c.width = band;
    c.height = img.naturalHeight;
    var ctx = c.getContext('2d');
    if (!ctx || !img.naturalHeight) continue;
    ctx.drawImage(img, 0, 0, band, img.naturalHeight, 0, 0, band, img.naturalHeight);
    var a = ctx.getImageData(0, 0, band, img.naturalHeight).data;
    for (var k = 3; k < a.length; k += 4) {
      if (a[k] > 128) { img.classList.add('cut-left'); break; }
    }
  }
};
`

/** The whole page for a plan. */
export function buildMotionPage(input: {
  plan: MotionPlan
  width: number
  height: number
  assets: MotionAssets
}): string {
  const { plan, width, height, assets } = input
  const s = width / 1080
  const f = assets.fonts
  const px = (n: number) => `${Math.round(n * s * 100) / 100}px`
  const css = `
@font-face{font-family:'RR Amboqia';src:url(${f.amboqia}) format('opentype');font-weight:400;font-style:normal;font-display:block}
@font-face{font-family:'RR Amboqia I';src:url(${f.amboqiaI}) format('woff2');font-weight:400;font-style:normal;font-display:block;unicode-range:U+0049}
@font-face{font-family:'RR Azo';src:url(${f.azo}) format('truetype');font-weight:500;font-style:normal;font-display:block}
@font-face{font-family:'RR Geist';src:url(${f.geist400}) format('woff2');font-weight:400;font-style:normal;font-display:block}
@font-face{font-family:'RR Geist';src:url(${f.geist500}) format('woff2');font-weight:500;font-style:normal;font-display:block}
@font-face{font-family:'RR Geist';src:url(${f.geist600}) format('woff2');font-weight:600;font-style:normal;font-display:block}
*{box-sizing:border-box;margin:0;animation:none!important;transition:none!important}
html,body{width:${width}px;height:${height}px;background:transparent;overflow:hidden}
body{position:relative;-webkit-font-smoothing:antialiased;text-rendering:geometricPrecision}
.card,.closer{position:absolute;left:${px(90)};width:${px(900)};opacity:0;will-change:transform,opacity}
.card{bottom:${px(440)};padding:${px(52)} ${px(64)};background:rgba(16,39,66,0.78);border-radius:${px(14)};color:${CREAM};box-shadow:0 ${px(2)} ${px(24)} rgba(16,39,66,0.55)}
.eyebrow{font:500 ${px(28)}/1.2 'RR Azo','RR Geist',sans-serif;letter-spacing:0.12em;text-transform:uppercase;color:rgba(250,248,244,0.82);margin-bottom:${px(18)}}
.line{font:400 ${px(84)}/1.02 'RR Amboqia I','RR Amboqia',serif;letter-spacing:-0.01em;font-synthesis:none}
.value{font:600 ${px(124)}/1 'RR Geist',sans-serif;letter-spacing:-0.02em}
.value.small{font-size:${px(88)};margin-top:${px(24)}}
.detail{font:500 ${px(38)}/1.25 'RR Geist',sans-serif;margin-top:${px(16)}}
.asof{font:400 ${px(24)}/1.3 'RR Geist',sans-serif;color:rgba(250,248,244,0.72);margin-top:${px(22)}}
.valuerow{display:flex;align-items:baseline;gap:${px(22)}}
.unit{font:500 ${px(38)}/1.2 'RR Geist',sans-serif}
.meter-track{display:block;width:${px(INNER)};height:${px(96)};margin-top:${px(34)};overflow:visible}
.meter-track .tick{font:500 24px 'RR Geist',sans-serif;fill:${CREAM}}
.meter-track .zone{font:500 24px 'RR Geist',sans-serif;fill:${CREAM};fill-opacity:0.62}
.meter-track .zone.on{fill-opacity:1}
.verdict{font:400 ${px(64)}/1.05 'RR Amboqia I','RR Amboqia',serif;margin-top:${px(26)};font-synthesis:none;will-change:transform,opacity;opacity:0}
.closer{top:${px(760)};height:${px(660)};background:${CREAM};border-radius:${px(14)};color:${NAVY};box-shadow:0 ${px(2)} ${px(24)} rgba(16,39,66,0.35);overflow:hidden}
.closer .mark,.closer .cta{opacity:0;will-change:transform,opacity}
.closer.brand{top:${px(860)};height:${px(440)};display:flex;flex-direction:column;align-items:center;justify-content:center;gap:${px(40)}}
.closer.brand .mark{width:${px(640)};height:auto}
.cta{font:500 ${px(44)}/1.2 'RR Geist',sans-serif;letter-spacing:0.01em}
/* The broker PNGs are cut at their bottom and right edges (and Rebecca's at the
   left). Anchoring the portrait to the card's bottom-right corner lays those
   cuts on the card's own edges, so no hard line shows mid-card. The left fade
   applies only to a portrait the page finds cut on that side (__rrPrepare reads
   the alpha of its left 6%). No box behind a portrait. */
.closer.agent .headshot{position:absolute;right:0;bottom:0;height:${px(600)};width:auto}
.closer.agent .headshot.cut-left{-webkit-mask-image:linear-gradient(to right,transparent 0,black 9%);mask-image:linear-gradient(to right,transparent 0,black 9%)}
.closer.agent .who{position:absolute;left:${px(64)};width:${px(440)};top:0;bottom:0;display:flex;flex-direction:column;justify-content:center}
.closer.agent .eyebrow{color:rgba(16,39,66,0.7);font-size:${px(26)};margin-bottom:${px(10)}}
.closer.agent .name{font:400 ${px(62)}/1.04 'RR Amboqia I','RR Amboqia',serif;font-synthesis:none;margin-bottom:${px(40)}}
.closer.agent .mark{width:${px(380)};height:auto;margin-bottom:${px(26)}}
.closer.agent .cta{font-size:${px(36)}}
`
  const body = plan.cues.map((cue) => cardHtml(cue, assets)).join('\n')
  return `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body>${body}<script>${RUNTIME}</script></body></html>`
}
