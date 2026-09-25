/**
 * Typed text in a field box, drawn where the sealer draws it: the same lines
 * (lib/tc/text-areas.ts fitTextToBox), the same size and the same baselines
 * (lib/tc/seal-pdf.ts drawFieldValue), in the box's own points. Each line is
 * held to the width it prints at (textLength), so a phone whose sans-serif is
 * wider or narrower than Helvetica still shows every letter where it lands on
 * paper, and nothing is cut off at the box edge.
 */
import { fitTextToBox, helveticaWidth } from '@/lib/tc/text-areas'

/** The sealer's font first; textLength keeps any fallback at the printed width. */
const PRINT_FONT = 'Helvetica, Arial, sans-serif'

export function PrintedLines({ text, widthPts, heightPts }: { text: string; widthPts: number; heightPts: number }) {
  const { size, lines } = fitTextToBox(text, widthPts, heightPts)
  const lineH = size + 1.2
  // Baselines from the box top, as drawFieldValue places them: one line sits
  // centred, a wrapped paragraph starts at the top and steps down a line.
  const baseline = (i: number) => (lines.length === 1 ? (heightPts + size) / 2 - 1 : size + 1 + i * lineH)
  return (
    <svg
      aria-hidden
      className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
      viewBox={`0 0 ${widthPts} ${heightPts}`}
      preserveAspectRatio="xMinYMin meet"
    >
      {lines.map((line, i) =>
        line.trim() ? (
          <text
            key={i}
            x={2}
            y={baseline(i)}
            fontSize={size}
            fontFamily={PRINT_FONT}
            fill="currentColor"
            textLength={helveticaWidth(line, size)}
            lengthAdjust="spacingAndGlyphs"
            style={{ whiteSpace: 'pre' }}
          >
            {line}
          </text>
        ) : null
      )}
    </svg>
  )
}
