/**
 * Presentational helpers for the buyer listing-alerts LP.
 * Extracted from page.tsx to hold the file-size budget (E7).
 * Hex utilities match the LP register (see .design-token-lint-ignore).
 */
import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'

export function ProcessStep({ num, title, body }: { num: string; title: string; body: string }) {
  return (
    <div className="flex flex-col items-center text-center sm:items-start sm:text-left">
      <span className="flex h-12 w-12 items-center justify-center border-[3px] border-navy bg-navy font-display text-lg tabular-nums text-cream">
        {num}
      </span>
      <p className="mt-4 font-display text-lg uppercase leading-none tracking-[-0.01em] text-navy">
        {title}
      </p>
      <p className="mt-2 max-w-xs text-sm leading-relaxed text-navy/70">{body}</p>
    </div>
  )
}

export function PlayIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      fill="currentColor"
      aria-hidden
    >
      <path d="M8 5.14v13.72a1 1 0 0 0 1.5.86l11-6.86a1 1 0 0 0 0-1.72l-11-6.86a1 1 0 0 0-1.5.86z" />
    </svg>
  )
}

export function PhoneIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.37 1.9.72 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.35 1.85.59 2.81.72A2 2 0 0 1 22 16.92z" />
    </svg>
  )
}

export function FAQ({ value, q, a }: { value: string; q: string; a: string }) {
  return (
    <AccordionItem value={value} className="border-[3px] border-navy bg-cream px-5">
      <AccordionTrigger className="py-4 font-display text-lg uppercase leading-snug tracking-[-0.01em] text-navy hover:no-underline">
        {q}
      </AccordionTrigger>
      <AccordionContent className="pb-4 text-base leading-relaxed text-navy/85">
        {a}
      </AccordionContent>
    </AccordionItem>
  )
}
