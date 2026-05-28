import { Body, Eyebrow, Stack } from '@/components/site/primitives'

/**
 * Listing-detail DescriptionBlock — renders the listing's public_remarks
 * (the agent-authored description that ships to the MLS and shows on
 * every consumer-facing portal).
 *
 * Per CLAUDE.md §3 brand voice: public_remarks IS user-facing prose, so
 * the brand-voice ESLint rule scans the JSX text. The remarks come from
 * the MLS and frequently carry the "Real estate cliché" set (stunning,
 * nestled, etc.) — those slips are caught by the producer pipeline
 * when listings are first authored, not at render time. The block
 * itself stays clean.
 *
 * Long remarks render with line-break preservation (paragraphs as-typed
 * by the listing agent). No truncation here — the listing page is the
 * canonical place to read the full description.
 *
 * Per plan §9 Layer 4.
 */

type Props = {
  publicRemarks: string | null
  className?: string
}

export function DescriptionBlock({ publicRemarks, className }: Props) {
  if (!publicRemarks || publicRemarks.trim().length === 0) return null

  // Preserve agent-authored paragraph breaks. Most MLS feeds use single
  // line breaks for paragraph separation; double-line-break also works.
  const paragraphs = publicRemarks
    .split(/\n{2,}|\r\n\r\n|\r{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0)

  return (
    <Stack gap="default" className={className}>
      <Eyebrow>Description</Eyebrow>
      <div className="flex flex-col gap-4 max-w-[68ch]">
        {paragraphs.map((p, i) => (
          <Body key={i} size="default" tone="muted" className="leading-[1.65]">
            {p}
          </Body>
        ))}
      </div>
    </Stack>
  )
}
