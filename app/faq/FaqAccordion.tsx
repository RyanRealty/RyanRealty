'use client'

import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion'

type FaqEntry = { id: string; question: string; answer: string }

/**
 * Collapsible FAQ list using the design-system Accordion (Radix). Answers stay
 * mounted in the DOM (Radix only toggles visibility), so the FAQPage JSON-LD and
 * crawler-visible answer text are preserved while the page reads as a tidy,
 * scannable accordion instead of one long always-open scroll.
 */
export function FaqAccordion({ items }: { items: FaqEntry[] }) {
  return (
    <Accordion type="single" collapsible className="w-full">
      {items.map((item) => (
        <AccordionItem
          key={item.id}
          value={item.id}
          id={item.id}
          className="scroll-mt-24 border-b border-[color:var(--navy-12)]"
        >
          <AccordionTrigger className="text-left font-display text-lg text-[color:var(--navy)] hover:no-underline">
            {item.question}
          </AccordionTrigger>
          <AccordionContent className="text-base leading-relaxed text-[color:var(--navy-70)]">
            {item.answer}
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  )
}
