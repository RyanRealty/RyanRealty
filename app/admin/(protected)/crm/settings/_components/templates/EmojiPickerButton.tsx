'use client'

/**
 * EmojiPickerButton — §13.2.3 emoji inserter for the text-template body.
 *
 * A small curated grid (dependency-free — an internal admin surface does not
 * need a full emoji keyboard). Clicking an emoji calls onInsert(emoji); the
 * caller places it at the textarea cursor.
 * §13.4.6 note: carrier filtering flags emoji in INITIAL outreach — the modal
 * hint keeps texts short; the compliance gates on the send path stay in charge.
 *
 * Admin v2 (11F): was a shadcn Popover wrapping a raw <button> grid. The locked
 * language has no popover, and Menu — the sanctioned anchored-actions primitive
 * — renders a 180px single column, which is the one shape 32 emoji must not
 * take. So the grid moved into <Dialog>, the language's one overlay, with each
 * cell an IconButton (whose required label carries the same accessible name the
 * raw buttons declared by hand).
 */
import { useState } from 'react'
import { Smile } from 'lucide-react'
import { Button, Dialog, IconButton } from '@/components/admin/v2'

const EMOJI = [
  '😀', '😂', '😊', '😉', '🙂', '🤝', '👍', '👋',
  '🙏', '💪', '🎉', '🥳', '❤️', '⭐', '🔥', '✅',
  '🏠', '🏡', '🔑', '📸', '📅', '📈', '💰', '☀️',
  '🌲', '🏔️', '🚚', '📍', '✍️', '⏰', '☕', '🐕',
]

export function EmojiPickerButton({ onInsert }: { onInsert: (emoji: string) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button
        type="button"
        variant="quiet"
        aria-label="Insert emoji"
        onClick={() => setOpen(true)}
        style={{ minHeight: 32, gap: 4 }}
      >
        <Smile className="h-3.5 w-3.5" />
        Emoji
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Insert emoji">
        <div className="grid grid-cols-6 justify-items-center gap-1 sm:grid-cols-8">
          {EMOJI.map((e) => (
            <IconButton
              key={e}
              label={`Insert ${e}`}
              onClick={() => {
                onInsert(e)
                setOpen(false)
              }}
              style={{ fontSize: 'var(--a-text-lg)', lineHeight: 1 }}
            >
              {e}
            </IconButton>
          ))}
        </div>
      </Dialog>
    </>
  )
}
