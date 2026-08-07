// @no-parity — internal admin surface, no public mockup contract
//
// The document-name hover preview, lifted out of page.tsx UNCHANGED at 11D so
// the page itself renders only the v2 language. Behaviour, markup and the two
// signed thumbnail URLs are byte-identical to the pre-11D helper.
//
// KNOWN, REPORTED: this island is still built on the shadcn HoverCard
// (@/components/ui/hover-card) and Tailwind semantic classes. It is not on the
// admin v2 language yet — v2 has no hover-card primitive, and dropping the
// preview would cost the one affordance that shows signature state without a
// click. It is mounted, not rewritten, exactly as the commission and file
// editors are.
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card'
import type { TcDocument } from '@/app/actions/tc'

/** Mouse-over preview: first page + last page (signature blocks live on the
 *  last page of most OREF forms) so signature state is visible without a click. */
export function DocumentName({ doc }: { doc: TcDocument }) {
  const name = (
    <p className="truncate font-medium text-foreground" title={doc.name}>
      {doc.name}
    </p>
  )
  if (!doc.thumbFirstUrl) return name
  const single = !doc.thumbLastUrl
  return (
    <HoverCard openDelay={150} closeDelay={80}>
      <HoverCardTrigger asChild>
        <p className="cursor-zoom-in truncate font-medium text-foreground underline decoration-dotted decoration-border underline-offset-4">
          {doc.name}
        </p>
      </HoverCardTrigger>
      <HoverCardContent side="right" align="start" className="w-auto max-w-[680px] p-3">
        <div className="flex gap-3">
          <figure className="m-0">
            {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL, remote loader not configured for storage host */}
            <img
              src={doc.thumbFirstUrl}
              alt={`First page of ${doc.name}`}
              className="max-h-[420px] w-auto rounded-md border border-border bg-white"
            />
            <figcaption className="mt-1 text-center text-[10px] text-muted-foreground">
              page 1{single ? ' (only page)' : ''}
            </figcaption>
          </figure>
          {doc.thumbLastUrl ? (
            <figure className="m-0">
              {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL */}
              <img
                src={doc.thumbLastUrl}
                alt={`Last page of ${doc.name}`}
                className="max-h-[420px] w-auto rounded-md border border-border bg-white"
              />
              <figcaption className="mt-1 text-center text-[10px] text-muted-foreground">
                last page · signatures
              </figcaption>
            </figure>
          ) : null}
        </div>
      </HoverCardContent>
    </HoverCard>
  )
}
