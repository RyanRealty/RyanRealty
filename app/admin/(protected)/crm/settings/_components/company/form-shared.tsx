import type { ReactNode } from 'react'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'

/**
 * Shared layout primitives for the Company Settings form (spec §1.2):
 * all-caps section dividers flanked by rules + the two-column form row
 * (labels left ~30%, controls right ~70%).
 */

/** All-caps section divider with flanking separators (FUB-style). */
export function SectionDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-4 py-4">
      <Separator className="flex-1" />
      <span className="shrink-0 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        {label}
      </span>
      <Separator className="flex-1" />
    </div>
  )
}

/** Two-column form row: label left (~30%), control(s) right (~70%). */
export function FormRow({
  label,
  htmlFor,
  children,
  description,
  className,
}: {
  label?: string
  htmlFor?: string
  children: ReactNode
  description?: string
  className?: string
}) {
  return (
    <div className={cn('grid grid-cols-[1fr_2fr] items-start gap-x-6 gap-y-1 py-2.5', className)}>
      <div className="pt-1">
        {label && (
          <Label
            htmlFor={htmlFor}
            className="text-sm font-medium text-foreground leading-snug"
          >
            {label}
          </Label>
        )}
        {description && (
          <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">{description}</p>
        )}
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  )
}
