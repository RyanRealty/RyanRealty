/**
 * REGISTRY §4: subdivision publishes counts and individual sales, never a
 * price statistic. 515 of 680 Bend plats never reach 10 detached sales in
 * 36 months, and the yearly series is an MLS SubdivisionName join, not
 * place_membership. A closed-sale median (or a YoY of that median) at this
 * grain is not a fact.
 *
 * Withhold. Do not swap in a parent-city median under the same label.
 * Live list median of the plat's own on-market inventory is a different
 * population and stays on publishPlatFigures.
 */

export function publishSubdivisionClosedPrice(
  _value: number | null | undefined,
): number | null {
  return null
}
