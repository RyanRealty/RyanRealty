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
 *
 * A paper film (plan.surface 'paper': the trend and map films) has no footage:
 * the page itself is the picture, navy ink on cream paper, so the cards drop
 * their scrim and the chart and map are drawn in SVG at film pixels.
 */
import type { MotionAssets } from './assets'
import { CUE_PARTS, type MotionCue, type MotionPlan } from './cues'
import { CHART_BOX, END_LABEL_DX, LABEL_MONTH_Y, LABEL_VALUE_Y, LEADER_TOP, SCALE_LABEL_X, TEXT_LEFT } from './chart'
import { ENDCARD, endcardLayout } from './endcard'
import { MAP_BOX } from './map'
import { CAPTION_STYLE } from '../voice/captionStyle'

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

function meterSvg(cue: Extract<MotionCue, { kind: 'meter' }>, ink: string, ground: string): string {
  const x = (v: number) => Math.round((Math.min(v, cue.domainMax) / cue.domainMax) * INNER * 100) / 100
  const [low, high] = cue.thresholds
  // The lit zone is the verdict's own kind, never a second comparison. It is
  // lit in its LABEL; the bar itself fills only to the value, because a fill
  // that ran to the zone's edge read as a gauge at 4 (critic pass 2026-10-07).
  const zones = [
    { from: 0, to: low, label: '4 mo', active: cue.verdictKind === 'sellers' },
    { from: low, to: high, label: '6 mo', active: cue.verdictKind === 'balanced' },
    { from: high, to: cue.domainMax, label: `${Math.round(cue.domainMax)} mo`, active: cue.verdictKind === 'buyers' },
  ]
  const trackY = 28
  const track = `<line x1="0" x2="${x(cue.domainMax)}" y1="${trackY}" y2="${trackY}" stroke="${ink}" stroke-opacity="0.38" stroke-width="3" stroke-linecap="butt"/>`
  const fill = `<line id="${cue.id}-fill" x1="0" x2="0" y1="${trackY}" y2="${trackY}" stroke="${ink}" stroke-width="6" stroke-linecap="butt"/>`
  const segments = track + fill
  const ticks = [low, high]
    .map(
      (v) =>
        `<line x1="${x(v)}" x2="${x(v)}" y1="${trackY - 14}" y2="${trackY + 14}" stroke="${ink}" stroke-width="1.5"/>` +
        `<text x="${x(v)}" y="${trackY - 22}" text-anchor="middle" class="tick" data-text>${v}</text>`,
    )
    .join('')
  const labels = zones
    .map(
      (z) =>
        `<text x="${(x(z.from) + x(z.to)) / 2}" y="${trackY + 48}" text-anchor="middle" class="zone${z.active ? ' on' : ''}" data-text>${esc(z.label)}</text>`,
    )
    .join('')
  const marker = `<circle id="${cue.id}-marker" cx="0" cy="${trackY}" r="12" fill="${ink}" stroke="${ground}" stroke-width="3" data-x0="0" data-x1="${x(cue.mos)}"/>`
  return `<svg class="meter-track" viewBox="0 -8 ${INNER} 96" width="${INNER}" height="96" aria-hidden="true">${segments}${ticks}${labels}${marker}</svg>`
}

/**
 * The trend chart (chart.ts has the why): gridlines at round values with
 * their labels in the gutter, no floor rule, the line revealed by a clip that
 * moves with time, a dot riding the tip, the first month above its own start
 * with a leader down to its ring, and the latest month beside its own dot.
 */
function chartHtml(cue: Extract<MotionCue, { kind: 'chart' }>): string {
  const b = CHART_BOX
  const grid = cue.gridlines
    .map(
      (g) =>
        `<line x1="${b.left}" x2="${cue.x1}" y1="${g.y}" y2="${g.y}" class="grid"/>` +
        `<text x="${SCALE_LABEL_X}" y="${g.y + 9}" text-anchor="end" class="scale" data-text>${esc(g.label)}</text>`,
    )
    .join('')
  const f = cue.first
  const l = cue.last
  // The leader touches the ring's edge: no gap a reader has to bridge.
  const leader = f.y - 8 > LEADER_TOP + 8 ? `<line x1="${f.x}" x2="${f.x}" y1="${LEADER_TOP}" y2="${f.y - 8}" class="leader"/>` : ''
  const firstLabel =
    `<g id="${cue.id}-label0"><text x="${f.x}" y="${LABEL_MONTH_Y}" text-anchor="start" class="cmonth" data-text>${esc(f.tick)}</text>` +
    `<text x="${f.x}" y="${LABEL_VALUE_Y}" text-anchor="start" class="clabel" data-text>${esc(f.text)}</text>${leader}` +
    `<circle cx="${f.x}" cy="${f.y}" r="8" class="mark"/></g>`
  const lastLabel =
    `<g id="${cue.id}-label1" opacity="0"><text x="${l.x + END_LABEL_DX}" y="${l.y - 22}" text-anchor="start" class="cmonth" data-text>${esc(l.tick)}</text>` +
    `<text x="${l.x + END_LABEL_DX}" y="${l.y + 30}" text-anchor="start" class="clabel" data-text>${esc(l.text)}</text></g>`
  return `<section class="chart" id="${cue.id}-axis">
<svg class="plot" viewBox="0 0 1080 1920" width="1080" height="1920" aria-hidden="true">
<defs><clipPath id="${cue.id}-clip"><rect id="${cue.id}-reveal" x="0" y="0" width="0" height="1920"/></clipPath></defs>
${grid}
<path d="${cue.d}" class="series" clip-path="url(#${cue.id}-clip)"/>
${firstLabel}${lastLabel}
<circle id="${cue.id}-dot" cx="${cue.x0}" cy="${f.y}" r="10" class="dot" opacity="0"/>
</svg>
<footer class="chartfoot">${textEl('p', 'scope', cue.scope)}${textEl('p', 'asof', cue.asOf)}</footer>
</section>
<header class="head" id="${cue.id}-head">${textEl('p', 'eyebrow', cue.eyebrow || null)}${textEl('h1', 'line', cue.line)}</header>`
}

/**
 * The map: the city as a faint hairline, the place's outline drawn on through
 * a normalised dash (pathLength 1, so no length is measured in the page), one
 * path per ring drawn in turn (map.ts), a navy tint fill, and a locator dot. The camera is one group transform;
 * strokes are non-scaling, so a hairline stays a hairline at any zoom.
 */
function mapHtml(cue: Extract<MotionCue, { kind: 'map' }>): string {
  const g = cue.geometry
  const m = MAP_BOX
  const context = g.contextPath ? `<path d="${g.contextPath}" class="context"/>` : ''
  return `<section class="map" id="${cue.id}-card">
<svg class="mapview" viewBox="0 0 ${m.width} ${m.height}" width="${m.width}" height="${m.height}" aria-hidden="true">
<g id="${cue.id}-camera" transform="translate(${g.open.tx},${g.open.ty}) scale(${g.open.s})">
${context}
<path id="${cue.id}-ghost" d="${g.subjectPath}" class="ghost"/>
<path id="${cue.id}-fill" d="${g.subjectPath}" class="placefill" fill-rule="evenodd" opacity="0"/>
${g.rings.map((ring) => `<path d="${ring.d}" class="place" pathLength="1" stroke-dasharray="1 1" stroke-dashoffset="1" data-a="${ring.a}" data-b="${ring.b}"/>`).join('')}
<circle id="${cue.id}-locator" cx="${g.locator.x}" cy="${g.locator.y}" r="9" class="locator" opacity="0"/>
</g>
</svg>
</section>
<header class="head" id="${cue.id}-head" data-cue="${cue.id}">${textEl('p', 'eyebrow', cue.eyebrow || null)}${textEl('h1', 'line', cue.line)}</header>`
}

/**
 * The locked end card (endcard.ts): an opaque cream field over everything,
 * the real stacked logo, the three words, and the call block inside a box
 * that ends at the safe line (y 1540), so the slam rises from behind it and
 * nothing ever crosses the bottom 380 px. Each word is a full-width line
 * centred on x 540; the runtime moves its centre to the planned x and scales
 * it about that centre, on its baseline. The inner span is what the
 * every-frame check measures.
 *
 * Two layers: the cream field (`-card`: the cut in, the loop's iris) never
 * scales, so over footage it always covers the whole frame; the stage inside
 * it (`-stage`) carries the breathe and the punches.
 *
 * Over footage, the field's left-most pixel column is 254/255 opaque.
 * Chromium writes a fully opaque screenshot as an RGB PNG with no alpha
 * channel, and ffmpeg re-initialises its whole filter graph when the overlay
 * stream's pixel format changes mid-film: the first end card frames came out
 * black. One column at 254/255 keeps every frame RGBA, and the footage under
 * it moves that column by at most one code value.
 */
function endcardHtml(cue: Extract<MotionCue, { kind: 'endcard' }>, assets: MotionAssets): string {
  const words = (['quality', 'local', 'service'] as const)
    .map((part, i) => `<p class="ec-word" id="${cue.id}-${part}"><span data-text>${esc(cue.words[i])}</span></p>`)
    .join('')
  return `<section class="endcard" id="${cue.id}-card" data-cue="${cue.id}"><div class="ec-stage" id="${cue.id}-stage">
<img class="ec-logo" id="${cue.id}-logo" src="${assets.endcardLogo}" alt="Ryan Realty"/>
${words}
<div class="ec-callbox"><div class="ec-pill" id="${cue.id}-pill"><span data-text>${esc(cue.cta)}</span></div><p class="ec-phone" id="${cue.id}-phone" data-text>${esc(cue.phone)}</p></div>
</div></section>`
}

/** Over footage, the alpha of the field's left-most column (see endcardHtml). */
export const ENDCARD_FOOTAGE_EDGE_ALPHA = 0.996

/** The end card's CSS at frame width scale s. Every number comes from ENDCARD. */
function endcardCss(cue: Extract<MotionCue, { kind: 'endcard' }>, s: number, paper: boolean): string {
  const px = (n: number) => `${Math.round(n * s * 100) / 100}px`
  const E = ENDCARD
  const { fs } = endcardLayout(cue.options)
  const logoH = (E.logo.width * E.logo.naturalHeight) / E.logo.naturalWidth
  const pill = E.call.pill
  // The call block's clip lives inside the card, which breathes and punches.
  // Sized for the card's largest scale, so its edge never passes y 1540.
  const maxCard = 1 + E.card.breathe + E.card.punch
  const clipBottom = Math.floor((E.frame.centreY + (E.safe.bottom - E.frame.centreY) / maxCard) * 100) / 100
  const edge = `linear-gradient(to right,rgba(16,39,66,${ENDCARD_FOOTAGE_EDGE_ALPHA}) ${px(1)},${NAVY} ${px(1)})`
  const mask = paper ? '' : `-webkit-mask-image:${edge};mask-image:${edge};`
  return `
.endcard{position:absolute;left:0;top:0;width:${px(E.frame.width)};height:${px(E.frame.height)};background:${CREAM};opacity:0;overflow:hidden;${mask}will-change:opacity}
.ec-stage{position:absolute;left:0;top:0;width:${px(E.frame.width)};height:${px(E.frame.height)};transform-origin:${px(E.frame.centreX)} ${px(E.frame.centreY)};will-change:transform}
.ec-logo{position:absolute;left:${px(E.frame.centreX - E.logo.width / 2)};top:${px(E.logo.top)};width:${px(E.logo.width)};height:${px(logoH)};opacity:0;will-change:transform,opacity}
.ec-word{position:absolute;left:0;top:${px(E.words.top)};width:${px(E.frame.width)};text-align:center;white-space:nowrap;font:400 ${px(fs)}/1 'RR Amboqia I','RR Amboqia',serif;font-synthesis:none;letter-spacing:0;color:${NAVY};opacity:0;transform-origin:${px(E.frame.centreX)} ${px(fs * E.words.baselineEm)};will-change:transform,opacity}
.ec-callbox{position:absolute;left:0;top:0;width:${px(E.frame.width)};height:${px(clipBottom)};overflow:hidden}
.ec-pill{position:absolute;left:${px(pill.left)};top:${px(pill.top)};width:${px(pill.width)};height:${px(pill.height)};border-radius:${px(pill.height / 2)};background:${NAVY};color:${CREAM};display:flex;align-items:center;justify-content:center;font:600 ${px(E.call.ctaPx)}/1 'RR Geist',sans-serif;letter-spacing:0.01em;opacity:0;will-change:transform,opacity}
.ec-phone{position:absolute;left:0;top:${px(E.call.phoneTop)};width:${px(E.frame.width)};text-align:center;font:600 ${px(E.call.phonePx)}/1 'RR Geist',sans-serif;letter-spacing:0.02em;color:${NAVY};opacity:0;will-change:transform,opacity}
`
}

/**
 * A planned place (timeline films): the card's top edge, px at 1080, and
 * whether it sits on a cream paper beat. Format films leave it unset.
 */
function placeAttrs(cue: MotionCue, s: number): string {
  if (!cue.place) return ''
  const top = Math.round(cue.place.top * s * 100) / 100
  return ` style="top:${top}px;bottom:auto"`
}

/**
 * Timeline cards (text, number, call to action): the navy scrim panel over
 * footage, navy ink straight on a cream paper beat. Words are Amboqia; a
 * figure is Geist and never Amboqia ("Amboqia never sits on a number").
 */
function timelineCardHtml(cue: Extract<MotionCue, { kind: 'text' | 'number' | 'cta' }>, s: number): string {
  const id = `${cue.id}-card`
  const ground = cue.place?.paper ? ' on-paper' : ''
  const attrs = `id="${id}" data-cue="${cue.id}"${placeAttrs(cue, s)}`
  switch (cue.kind) {
    case 'text':
      return `<section class="tcard tone-${cue.tone}${ground}" ${attrs}>${textEl('p', 'eyebrow', cue.eyebrow)}${textEl('h2', 'tline', cue.line)}</section>`
    case 'number':
      return `<section class="tcard ncard${ground}" ${attrs}>${textEl('p', 'eyebrow', cue.eyebrow)}${textEl('p', 'nvalue', cue.value)}${textEl('p', 'nunit', cue.unit)}<div class="nfoot">${textEl('p', 'nscope', cue.scope)}${textEl('p', 'nasof', cue.asOf)}</div></section>`
    case 'cta':
      return `<section class="tcard ccard style-${cue.style}${ground}" ${attrs}>${textEl('h2', 'tline', cue.line)}</section>`
  }
}

/** A burned-in caption card: the look is lib/studio/voice/captionStyle.ts, data only. */
function captionHtml(cue: Extract<MotionCue, { kind: 'caption' }>): string {
  return `<p class="caption" id="${cue.id}-card" data-cue="${cue.id}"><span data-text>${esc(cue.text)}</span></p>`
}

function cardHtml(cue: MotionCue, assets: MotionAssets, paper: boolean, s = 1): string {
  const id = `${cue.id}-card`
  const ink = paper ? NAVY : CREAM
  const ground = paper ? CREAM : NAVY
  switch (cue.kind) {
    case 'text':
    case 'number':
    case 'cta':
      return timelineCardHtml(cue, s)
    case 'caption':
      return captionHtml(cue)
    case 'endcard':
      return endcardHtml(cue, assets)
    case 'chart':
      return chartHtml(cue)
    case 'map':
      return mapHtml(cue)
    case 'title':
      return `<section class="card lead title" id="${id}" data-cue="${cue.id}"${placeAttrs(cue, s)}>${textEl('p', 'eyebrow', cue.eyebrow || null)}${textEl('h1', 'line', cue.line)}${textEl('p', 'value small', cue.value)}${textEl('p', 'detail', cue.detail)}</section>`
    case 'figure':
      return `<section class="card lead figure" id="${id}" data-cue="${cue.id}"${placeAttrs(cue, s)}>${textEl('p', 'eyebrow', cue.eyebrow)}${textEl('p', 'value', cue.value)}${textEl('p', 'detail', cue.detail)}${textEl('p', 'asof', cue.asOf)}</section>`
    case 'meter':
      return `<section class="card lead meter" id="${id}" data-cue="${cue.id}"${placeAttrs(cue, s)}>${textEl('p', 'eyebrow', cue.eyebrow)}${cue.showValue === false ? '' : `<div class="valuerow">${textEl('span', 'value', cue.value)}${textEl('span', 'unit', 'months of supply')}</div>`}${meterSvg(cue, ink, ground)}${textEl('p', 'verdict', cue.verdict, `${cue.id}-verdict`)}${textEl('p', 'asof', cue.asOf)}</section>`
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
    if (s.x != null || s.scale != null) {
      el.style.transform = 'translate3d(' + (s.x || 0) + 'px,' + s.y + 'px,0) scale(' + (s.scale == null ? 1 : s.scale) + ')';
    } else {
      el.style.transform = 'translate3d(0,' + s.y + 'px,0)';
    }
    if (s.clip !== undefined) {
      el.style.clipPath = s.clip == null ? 'none' : 'circle(' + s.clip + 'px at 50% 50%)';
    }
    if (s.marker != null) {
      var m = document.getElementById(s.id.replace(/-card$/, '-marker'));
      if (m) {
        var x0 = Number(m.getAttribute('data-x0'));
        var x1 = Number(m.getAttribute('data-x1'));
        m.setAttribute('cx', String(x0 + (x1 - x0) * s.marker));
        var fill = document.getElementById(s.id.replace(/-card$/, '-fill'));
        if (fill) fill.setAttribute('x2', String(x0 + (x1 - x0) * s.marker));
      }
    }
    var cue = s.id.replace(/-(card|axis)$/, '');
    if (s.reveal != null) {
      // The clip runs to the dot's centre plus half the stroke, so the line ends under the dot.
      document.getElementById(cue + '-reveal').setAttribute('width', String(s.reveal > 0 ? s.reveal + 3 : 0));
      var dot = document.getElementById(cue + '-dot');
      dot.setAttribute('cx', String(s.dot[0]));
      dot.setAttribute('cy', String(s.dot[1]));
      dot.setAttribute('opacity', String(s.dot[2]));
      document.getElementById(cue + '-label0').setAttribute('opacity', String(s.labels[0]));
      document.getElementById(cue + '-label1').setAttribute('opacity', String(s.labels[1]));
    }
    if (s.camera != null) {
      var k = s.camera[0];
      document.getElementById(cue + '-camera').setAttribute('transform', 'translate(' + s.camera[1] + ',' + s.camera[2] + ') scale(' + k + ')');
      // Strokes are set in screen pixels divided by the scale, so a hairline
      // stays a hairline at any zoom and the normalised dash still holds.
      var rings = document.querySelectorAll('#' + cue + '-card .place');
      for (var r = 0; r < rings.length; r++) {
        var a = Number(rings[r].getAttribute('data-a'));
        var b = Number(rings[r].getAttribute('data-b'));
        var own = b > a ? Math.min(1, Math.max(0, (s.draw - a) / (b - a))) : (s.draw >= 1 ? 1 : 0);
        rings[r].setAttribute('stroke-width', String(4 / k));
        rings[r].setAttribute('stroke-dashoffset', String(1 - own));
      }
      document.getElementById(cue + '-fill').setAttribute('opacity', String(s.fill));
      var loc = document.getElementById(cue + '-locator');
      loc.setAttribute('r', String(10 / k));
      loc.setAttribute('opacity', String(s.locator));
      var faint = document.querySelectorAll('#' + cue + '-card .context, #' + cue + '-card .ghost');
      for (var j = 0; j < faint.length; j++) faint[j].setAttribute('stroke-width', String(2 / k));
      var city = document.querySelector('#' + cue + '-card .context');
      if (city) city.setAttribute('opacity', String(s.context));
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
window.__rrTextBoxes = function () {
  var out = [];
  var nodes = document.querySelectorAll('[data-text]');
  for (var i = 0; i < nodes.length; i++) {
    var o = 1;
    for (var n = nodes[i]; n && n !== document.body; n = n.parentElement) {
      o *= Number(getComputedStyle(n).opacity);
    }
    if (!(o > 0.5)) continue;
    var r = nodes[i].getBoundingClientRect();
    var owner = nodes[i].closest('[data-cue]');
    out.push({
      cue: owner ? owner.getAttribute('data-cue') : null,
      text: nodes[i].textContent || '',
      x: Math.round(r.left * 100) / 100,
      y: Math.round(r.top * 100) / 100,
      w: Math.round(r.width * 100) / 100,
      h: Math.round(r.height * 100) / 100,
      opacity: Math.round(o * 1000) / 1000
    });
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

/**
 * Timeline cards and captions (lib/studio/timeline). Over footage a card is
 * the navy scrim panel, the one sanctioned treatment for type over a moving
 * picture; on a cream paper beat it is navy ink with no panel. Cards are 840
 * wide from x 90, so their right edge (930) stays inside the safe line at 960.
 * Captions take their whole look from CAPTION_STYLE (data only).
 */
/**
 * The timeline cards' navy panel. Denser than the site's 78% scrim
 * (--v3-scrim-strong): a drone plate keeps moving under a card for seconds,
 * and at 78% a bright structure behind the panel (the Old Mill stacks) reads
 * through the type. At 90% the footage is a texture, not a second picture.
 */
export const TIMELINE_SCRIM = 0.9

function timelineCardCss(px: (n: number) => string): string {
  const c = CAPTION_STYLE
  const b = c.box
  const family = [c.font.family, ...c.font.fallbacks].join(',')
  return `
.tcard{position:absolute;left:${px(90)};width:${px(840)};padding:${px(40)} ${px(48)} ${px(44)};background:rgba(16,39,66,${TIMELINE_SCRIM});border-radius:${px(14)};color:${CREAM};box-shadow:0 ${px(2)} ${px(24)} rgba(16,39,66,0.55);opacity:0;transform-origin:50% 50%;will-change:transform,opacity}
.tcard .eyebrow{margin-bottom:${px(14)}}
.tcard .tline{font:400 ${px(84)}/1.04 'RR Amboqia I','RR Amboqia',serif;letter-spacing:-0.01em;font-synthesis:none;text-wrap:balance}
.tcard.tone-plain,.tcard.tone-payoff,.tcard.tone-question,.tcard.tone-turn,.tcard.ccard{width:auto;max-width:${px(840)}}
.tcard.tone-question .tline{font-size:${px(80)}}
.tcard.tone-turn .tline{font-size:${px(72)}}
.tcard.tone-payoff .tline{font-size:${px(104)};line-height:1}
.ncard .nvalue{font:600 ${px(240)}/0.92 'RR Geist',sans-serif;letter-spacing:-0.035em;font-variant-numeric:tabular-nums;font-synthesis:none}
.ncard .nunit{font:400 ${px(64)}/1.05 'RR Amboqia I','RR Amboqia',serif;margin-top:${px(14)};font-synthesis:none}
.ncard .nfoot{margin-top:${px(26)};padding-top:${px(18)};border-top:${px(2)} solid rgba(250,248,244,0.28)}
.ncard .nscope{font:500 ${px(28)}/1.3 'RR Geist',sans-serif;color:rgba(250,248,244,0.86)}
.ncard .nasof{font:400 ${px(26)}/1.3 'RR Geist',sans-serif;color:rgba(250,248,244,0.72);margin-top:${px(4)}}
.ccard .tline{font-size:${px(72)}}
.tcard.on-paper{background:transparent;box-shadow:none;color:${NAVY}}
.tcard.on-paper .eyebrow{color:rgba(16,39,66,0.72)}
.tcard.on-paper .nfoot{border-top-color:rgba(16,39,66,0.2)}
.tcard.on-paper .nscope{color:rgba(16,39,66,0.86)}
.tcard.on-paper .nasof{color:rgba(16,39,66,0.62)}
.layout-captioned .card{left:${px(90)};width:${px(840)};padding:${px(44)} ${px(34)};background:rgba(16,39,66,${TIMELINE_SCRIM})}
.layout-captioned .card .meter-track{margin-top:${px(22)}}
.layout-captioned .card .verdict{font-size:${px(46)};text-wrap:balance}
.caption{position:absolute;left:${px(b.x)};top:${px(b.y)};width:${px(b.w)};height:${px(b.h)};display:flex;align-items:center;justify-content:center;opacity:0;margin:0;font-family:${family};font-weight:${c.font.weight};font-size:${px(c.sizePx)};line-height:${c.lineHeight};letter-spacing:${c.letterSpacingEm}em;text-transform:${c.textTransform};text-align:${c.align};color:${c.color.fill};-webkit-text-stroke:${px(c.outlinePx * 2)} ${c.color.outline};paint-order:stroke fill;text-shadow:0 ${px(c.shadow.offsetYPx)} ${px(c.shadow.blurPx)} ${c.color.shadow};font-synthesis:none}
`
}

/** The whole page for a plan. */
export function buildMotionPage(input: {
  plan: MotionPlan
  width: number
  height: number
  assets: MotionAssets
}): string {
  const { plan, width, height, assets } = input
  const paper = plan.surface === 'paper'
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
.asof{font:400 ${px(28)}/1.3 'RR Geist',sans-serif;color:rgba(250,248,244,0.72);margin-top:${px(22)}}
.valuerow{display:flex;align-items:baseline;gap:${px(22)}}
.unit{font:500 ${px(38)}/1.2 'RR Geist',sans-serif}
.meter-track{display:block;width:${px(INNER)};height:${px(96)};margin-top:${px(34)};overflow:visible}
.meter-track .tick{font:500 32px 'RR Geist',sans-serif;fill:${CREAM}}
.meter-track .zone{font:500 30px 'RR Geist',sans-serif;fill:${CREAM};fill-opacity:0.62}
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
  // Paper: navy ink straight on cream. The scrim panel exists to hold type
  // over a moving photograph; with no photograph it is a box for its own sake.
  const paperCss = paper
    ? `
html,body{background:${CREAM}}
.card{background:transparent;box-shadow:none;color:${NAVY};padding:0}
.card .eyebrow,.head .eyebrow{color:rgba(16,39,66,0.72)}
.card .asof{color:rgba(16,39,66,0.62)}
.card.meter{top:${px(640)};bottom:auto}
.card.figure{top:${px(1150)};bottom:auto}
.meter-track .tick,.meter-track .zone{fill:${NAVY}}
.closer.brand{background:transparent;box-shadow:none}
.chart{position:absolute;left:0;top:0;width:${px(1080)};height:${px(1920)};opacity:0}
.chart .plot{position:absolute;left:0;top:0;width:${px(1080)};height:${px(1920)};overflow:visible}
.chart .grid{stroke:rgba(16,39,66,0.14);stroke-width:2}
.chart .scale{font:500 24px 'RR Geist',sans-serif;fill:rgba(16,39,66,0.62)}
.chart .series{fill:none;stroke:${NAVY};stroke-width:5;stroke-linejoin:round;stroke-linecap:round}
.chart .dot{fill:${NAVY}}
.chart .clabel{font:600 50px 'RR Geist',sans-serif;fill:${NAVY};letter-spacing:-0.01em}
.chart .cmonth{font:500 28px 'RR Geist',sans-serif;fill:rgba(16,39,66,0.62)}
.chart .leader{stroke:${NAVY};stroke-width:2}
.chart .mark{fill:${CREAM};stroke:${NAVY};stroke-width:4}
.chart .chartfoot{position:absolute;left:${px(TEXT_LEFT)};top:${px(CHART_BOX.top + CHART_BOX.height + 44)};width:${px(900)}}
.chart .scope{font:500 ${px(28)}/1.3 'RR Geist',sans-serif;color:${NAVY}}
.chart .asof{font:400 ${px(24)}/1.3 'RR Geist',sans-serif;color:rgba(16,39,66,0.62);margin-top:${px(8)}}
`
    : ''
  // The map (and the paper films' heading) on cream: a paper film, or a timeline
  // film's outline_draw_zoom beat, which sits on a cream paper plate. Over a
  // timeline film the heading stops at x 960, the safe line video:check holds.
  const hasMap = plan.cues.some((cue) => cue.kind === 'map')
  const mapCss =
    paper || hasMap
      ? `
.head{position:absolute;left:${px(90)};top:${px(300)};width:${px(paper ? 900 : 870)};opacity:0;will-change:transform,opacity;color:${NAVY}}
.head .eyebrow{color:rgba(16,39,66,0.72)}
.map{position:absolute;left:0;top:0;width:${px(1080)};height:${px(1920)};opacity:0}
.map .mapview{position:absolute;left:${px(MAP_BOX.left)};top:${px(MAP_BOX.top)};width:${px(MAP_BOX.width)};height:${px(MAP_BOX.height)};overflow:hidden}
.map .context,.map .ghost{fill:none;stroke:${NAVY};stroke-opacity:0.32;stroke-linejoin:round}
.map .place{fill:none;stroke:${NAVY};stroke-linejoin:round;stroke-linecap:round}
.map .placefill{fill:${NAVY};fill-opacity:0.15;stroke:none}
.map .locator{fill:${NAVY}}
`
      : ''
  const endcard = plan.cues.find((cue): cue is Extract<MotionCue, { kind: 'endcard' }> => cue.kind === 'endcard')
  const endCss = endcard ? endcardCss(endcard, s, paper) : ''
  const timeline = plan.cues.some((cue) => cue.kind === 'text' || cue.kind === 'number' || cue.kind === 'cta' || cue.kind === 'caption')
  const hasCaptions = plan.cues.some((cue) => cue.kind === 'caption')
  // Fonts fail loudly: a caption without its bold face would be drawn in the
  // semibold one and nobody would notice.
  if (hasCaptions && !f.geist700) throw new Error('Captions need Geist Bold (assets.fonts.geist700); refusing to draw them in another weight')
  // Declared only when captions are drawn, so a format film's font set is unchanged.
  const boldFace = hasCaptions && f.geist700
    ? `@font-face{font-family:'RR Geist';src:url(${f.geist700}) format('woff2');font-weight:700;font-style:normal;font-display:block}\n`
    : ''
  const timelineCss = timeline ? timelineCardCss(px) : ''
  const classes = [paper ? 'paper' : '', plan.layout === 'captioned' ? 'layout-captioned' : ''].filter(Boolean).join(' ')
  const body = plan.cues.map((cue) => cardHtml(cue, assets, paper, s)).join('\n')
  return `<!doctype html><html><head><meta charset="utf-8"><style>${boldFace}${css}${paperCss}${mapCss}${timelineCss}${endCss}</style></head><body${classes ? ` class="${classes}"` : ''}>${body}<script>${RUNTIME}</script></body></html>`
}
