/**
 * WHEN FOCUS LEAVES THE BAR (V3Chrome.tsx wires the DOM into this).
 *
 * Keyboard focus in the sticky bar drops the page's scroll padding
 * (V3Chrome.css): the bar never leaves the top, so a browser honoring the
 * padding scrolled the page about 400px to "reveal" a control that never
 * moved. The padding has to be back before any scroll that moves the reader
 * to an anchor, or that anchor lands under the bar. Following a link out of
 * the chrome is one such moment, and this decides which activations count.
 *
 * Pure: plain values in, so it is tested without a DOM.
 */

/** What a plain activation of a chrome link does to the reader. */
export type ChromeLinkMove = 'page' | 'anchor' | null

type Activation = {
  button: number
  metaKey: boolean
  ctrlKey: boolean
  shiftKey: boolean
  altKey: boolean
}

type Place = { origin: string; pathname: string; search: string }

type LinkParts = Place & { protocol: string; target: string; hash: string }

/**
 * 'anchor' when the link points at an anchor (its target will be scrolled to),
 * 'page' when it leaves for another page, null when it moves nobody: a
 * modified click (a new tab or window), a call or mail link, a link that opens
 * elsewhere, or a link to the page already showing. Enter on a link arrives as
 * a primary click with no modifier, so the keyboard counts the same.
 */
export function chromeLinkMove(activation: Activation, link: LinkParts, here: Place): ChromeLinkMove {
  if (activation.button !== 0) return null
  if (activation.metaKey || activation.ctrlKey || activation.shiftKey || activation.altKey) return null
  if (!/^https?:$/.test(link.protocol)) return null
  if (link.target && link.target !== '_self') return null
  if (link.hash) return 'anchor'
  const elsewhere = link.origin !== here.origin || link.pathname !== here.pathname || link.search !== here.search
  return elsewhere ? 'page' : null
}
