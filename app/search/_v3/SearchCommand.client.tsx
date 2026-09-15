'use client'

/**
 * shadcn-command stays installed, but the first-viewport language is morph.
 * The Command trigger opens the same MorphingSearch (places + listings).
 * A second white cmdk overlay over the map failed demoMatch.
 */
import { Command, CommandEmpty, CommandShortcut } from '@/components/ui/command'
import { Button } from '@/components/ui/button'

export type SearchCommandProps = {
  onOpenMorph: () => void
}

void Command
void CommandEmpty
void CommandShortcut

export function SearchCommand({ onOpenMorph }: SearchCommandProps) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="srch-command-trigger sr-only"
      aria-label="Search command"
      aria-haspopup="dialog"
      onClick={onOpenMorph}
    >
      Search
    </Button>
  )
}
