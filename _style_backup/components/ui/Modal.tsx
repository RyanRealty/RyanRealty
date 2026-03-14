'use client'

import {
  useEffect,
  useRef,
  useCallback,
  type ReactNode,
  type KeyboardEvent,
} from 'react'

export interface ModalProps {
  open: boolean
  onClose: () => void
  children: ReactNode
  /** Max width of content (e.g. "32rem" or "max-w-md"). */
  maxWidth?: string
  /** Accessible title for the modal (used for aria-labelledby). */
  titleId?: string
}

export default function Modal({
  open,
  onClose,
  children,
  maxWidth = '32rem',
  titleId = 'modal-title',
}: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  const handleEscape = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Escape') onClose()
    },
    [onClose]
  )

  useEffect(() => {
    if (!open) return
    const previouslyFocused = document.activeElement as HTMLElement | null
    const focusable = contentRef.current?.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
    const first = focusable?.[0]
    const last = focusable?.[focusable.length - 1]
    first?.focus()

    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key !== 'Tab' || !contentRef.current) return
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault()
          last?.focus()
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault()
          first?.focus()
        }
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      previouslyFocused?.focus()
    }
  }, [open])

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === overlayRef.current) onClose()
  }

  if (!open) return null

  return (
    <div
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-modal-overlay"
      onClick={handleOverlayClick}
      onKeyDown={handleEscape}
    >
      <div
        ref={contentRef}
        className="relative w-full max-h-[90vh] overflow-auto rounded-[var(--radius-card)] bg-white shadow-[var(--shadow-strong)] animate-modal-content"
        style={{ maxWidth }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 z-10 flex h-10 w-10 items-center justify-center rounded-[var(--radius-card)] text-[var(--gray-secondary)] hover:bg-[var(--gray-bg)] hover:text-[var(--gray-dark)] focus:outline-none focus:ring-2 focus:ring-[var(--color-cta)]"
          aria-label="Close"
        >
          <span className="text-xl leading-none">×</span>
        </button>
        {children}
      </div>
    </div>
  )
}
