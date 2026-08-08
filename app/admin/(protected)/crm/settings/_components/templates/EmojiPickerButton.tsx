'use client'

/**
 * EmojiPickerButton — §13.2.3 emoji inserter for the text-template body.
 *
 * A design-system Popover holding a small curated grid (dependency-free —
 * an internal admin surface does not need a full emoji keyboard). Clicking an
 * emoji calls onInsert(emoji); the caller places it at the textarea cursor.
 * §13.4.6 note: carrier filtering flags emoji in INITIAL outreach — the modal
 * hint keeps texts short; the compliance gates on the send path stay in charge.
 */
import { useState } from 'react'
import { Smile } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

const EMOJI = [
  '😀', '😂', '😊', '😉', '🙂', '🤝', '👍', '👋',
  '🙏', '💪', '🎉', '🥳', '❤️', '⭐', '🔥', '✅',
  '🏠', '🏡', '🔑', '📸', '📅', '📈', '💰', '☀️',
  '🌲', '🏔️', '🚚', '📍', '✍️', '⏰', '☕', '🐕',
]

export function EmojiPickerButton({ onInsert }: { onInsert: (emoji: string) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="gap-1" aria-label="Insert emoji">
          <Smile className="h-3.5 w-3.5" />
          Emoji
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-2">
        <div className="grid grid-cols-6 gap-1 sm:grid-cols-8">
          {EMOJI.map((e) => (
            <button
              key={e}
              type="button"
              className="rounded-md p-1 text-lg leading-none transition-colors hover:bg-accent"
              onClick={() => {
                onInsert(e)
                setOpen(false)
              }}
              aria-label={`Insert ${e}`}
            >
              {e}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}
