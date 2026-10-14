/**
 * lib/studio/voice/captionStyle.ts: how a caption card looks. Data only.
 *
 * The TikTok look, inside the brand (design_system/ryan-realty/SKILL.md):
 *  - Type is Geist Bold. Short-form captions are UI-and-data type, not a
 *    display moment, and the design system keeps Amboqia off anything that
 *    must read at a glance or sits next to a figure ("Amboqia never sits on a
 *    number"). The face is the one the type layer already ships
 *    (design_system/ryan-realty/fonts/geist/Geist-Bold.woff2).
 *  - Two colours only: cream #faf8f4 for the letters and navy #102742 for the
 *    outline and the shadow that lift them off footage. No white, no black.
 *  - Large (84 px on the 1080 x 1920 canvas), centred, in the lower-middle of
 *    the frame at y 1180 to 1340, well inside the safe area (nothing right of
 *    x 960 or below y 1640 outside the end card: STUDIO_ONE_FACTORY.md check
 *    #11) and clear of the platform's own caption and button columns.
 *  - Cards hard-cut. A caption is timed to the word; a fade would put it up
 *    late and off late. (The "type never scales" rule of the motion ladder
 *    holds: no pop-scale.)
 *  - Case is the spoken words' case. The text in the manifest is what is said.
 *
 * The orchestrator's renderer reads this; nothing here touches a DOM, a font
 * file or a canvas.
 */

export const CANVAS = { width: 1080, height: 1920 } as const

/** The safe area of STUDIO_ONE_FACTORY.md check #11, in canvas pixels. */
export const SAFE_AREA = { left: 90, right: 960, bottom: 1640 } as const

/** A text box in canvas pixels: `texts[].box` in the manifest. */
export type Box = { x: number; y: number; w: number; h: number }

export type CaptionStyle = {
  font: {
    /** The family name the type layer registers (lib/studio/motion/page.ts: 'RR Geist'). */
    family: string
    /** Fallbacks, in order, if the registered face is missing. */
    fallbacks: readonly string[]
    /** CSS weight. 700 is Geist Bold. */
    weight: number
    /** Where the face ships in the repo. */
    file: string
  }
  /** Letter size, px at 1080 wide. Within the brief's 72 to 96. */
  sizePx: number
  /** Smallest size a renderer may step down to so a 4-word card fits in two lines. */
  minSizePx: number
  lineHeight: number
  letterSpacingEm: number
  textTransform: 'none' | 'uppercase'
  align: 'center'
  maxLines: number
  color: { fill: string; outline: string; shadow: string }
  /** Visible outline thickness, px, outside the letter edge. (CSS strokes on the edge, half under the fill, so captionCss doubles it.) */
  outlinePx: number
  /** Soft navy shadow under the letters: offset y, blur, as CSS px. */
  shadow: { offsetYPx: number; blurPx: number }
  /** The box every card is centred in. */
  box: Box
  /** The card's anchor: horizontal centre, vertical centre of the box. */
  anchor: { x: number; y: number }
  transition: 'cut'
  /** Optional word-by-word highlight: the word being said stays full strength, the others dim. Off by default. */
  activeWord: { enabled: boolean; inactiveOpacity: number }
}

export const CAPTION_STYLE: CaptionStyle = {
  font: {
    family: "'RR Geist'",
    fallbacks: ['Geist', 'system-ui', 'sans-serif'],
    weight: 700,
    file: 'design_system/ryan-realty/fonts/geist/Geist-Bold.woff2',
  },
  sizePx: 84,
  minSizePx: 72,
  lineHeight: 1.1,
  letterSpacingEm: 0,
  textTransform: 'none',
  align: 'center',
  maxLines: 2,
  color: { fill: '#faf8f4', outline: '#102742', shadow: 'rgba(16,39,66,0.55)' },
  outlinePx: 6,
  shadow: { offsetYPx: 4, blurPx: 18 },
  // x 120 to 960 is centred on 540 and ends on the safe edge; y 1160 to 1360 holds two 84 px lines and is centred on 1260.
  box: { x: 120, y: 1160, w: 840, h: 200 },
  anchor: { x: 540, y: 1260 },
  transition: 'cut',
  activeWord: { enabled: false, inactiveOpacity: 0.7 },
}

/** The box a caption occupies, for the manifest's `texts` entries (`kind: "caption"`). */
export function captionBox(style: CaptionStyle = CAPTION_STYLE): Box {
  return { ...style.box }
}

/** The ways a style leaves the brief: empty when it holds. */
export function styleProblems(style: CaptionStyle = CAPTION_STYLE): string[] {
  const out: string[] = []
  const { box } = style
  if (style.sizePx < 72 || style.sizePx > 96) out.push(`sizePx ${style.sizePx} is outside 72 to 96`)
  if (style.minSizePx > style.sizePx) out.push('minSizePx is above sizePx')
  if (box.x < SAFE_AREA.left) out.push(`box left ${box.x} is outside the safe area (${SAFE_AREA.left})`)
  if (box.x + box.w > SAFE_AREA.right) out.push(`box right ${box.x + box.w} is past x ${SAFE_AREA.right}`)
  if (box.y + box.h > SAFE_AREA.bottom) out.push(`box bottom ${box.y + box.h} is below y ${SAFE_AREA.bottom}`)
  if (style.anchor.y < 1180 || style.anchor.y > 1340) out.push(`anchor y ${style.anchor.y} is outside 1180 to 1340`)
  const needed = Math.ceil(style.maxLines * style.sizePx * style.lineHeight)
  if (box.h < needed) out.push(`box height ${box.h} cannot hold ${style.maxLines} lines (${needed})`)
  if (style.color.fill.toLowerCase() !== '#faf8f4' || style.color.outline.toLowerCase() !== '#102742') {
    out.push('colours must be the brand cream #faf8f4 and navy #102742')
  }
  return out
}

/**
 * The same look as CSS declarations for one caption element, for a renderer
 * that draws with HTML (lib/studio/motion/page.ts does). The outline is the
 * text stroke painted behind the fill, so the letters keep their full weight.
 */
export function captionCss(style: CaptionStyle = CAPTION_STYLE): string {
  const family = [style.font.family, ...style.font.fallbacks].join(', ')
  return [
    `font-family:${family}`,
    `font-weight:${style.font.weight}`,
    `font-size:${style.sizePx}px`,
    `line-height:${style.lineHeight}`,
    `letter-spacing:${style.letterSpacingEm}em`,
    `text-transform:${style.textTransform}`,
    `text-align:${style.align}`,
    `color:${style.color.fill}`,
    `-webkit-text-stroke:${style.outlinePx * 2}px ${style.color.outline}`,
    'paint-order:stroke fill',
    `text-shadow:0 ${style.shadow.offsetYPx}px ${style.shadow.blurPx}px ${style.color.shadow}`,
    'font-synthesis:none',
  ].join(';')
}
