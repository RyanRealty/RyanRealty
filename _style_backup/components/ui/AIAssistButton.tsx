'use client'

import { useState, useRef, useEffect, type ReactNode } from 'react'

const ACTIONS = [
  { value: 'generate', label: 'Generate' },
  { value: 'rewrite', label: 'Rewrite' },
  { value: 'expand', label: 'Expand' },
  { value: 'condense', label: 'Condense' },
  { value: 'fix_grammar', label: 'Fix Grammar' },
] as const

const TONES = [
  { value: 'professional', label: 'Professional' },
  { value: 'friendly', label: 'Friendly' },
  { value: 'concise', label: 'Concise' },
  { value: 'enthusiastic', label: 'Enthusiastic' },
  { value: 'empathetic', label: 'Empathetic' },
  { value: 'luxury', label: 'Luxury' },
  { value: 'casual', label: 'Casual' },
  { value: 'urgent', label: 'Urgent' },
] as const

export interface AIAssistButtonProps {
  /** The textarea to wrap. Pass as children (single textarea element). */
  children: ReactNode
  /** Optional context passed to the API (e.g. "Listing description for 123 Main St"). */
  context?: string
}

export default function AIAssistButton({ children, context = '' }: AIAssistButtonProps) {
  const [open, setOpen] = useState(false)
  const [action, setAction] = useState<string>('generate')
  const [tone, setTone] = useState<string>('professional')
  const [prompt, setPrompt] = useState('')
  const [existingText, setExistingText] = useState('')
  const [generated, setGenerated] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  useEffect(() => {
    const el = containerRef.current?.querySelector('textarea')
    if (el) {
      textareaRef.current = el
      const sync = () => setExistingText(el.value)
      el.addEventListener('input', sync)
      sync()
      return () => el.removeEventListener('input', sync)
    }
  }, [children])

  const handleGenerate = async () => {
    setError(null)
    setLoading(true)
    try {
      const res = await fetch('/api/ai/generate-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          context: context || 'Real estate content for Ryan Realty.',
          tone,
          action,
          prompt: prompt || undefined,
          existingText: existingText || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data?.error ?? 'Failed to generate')
        return
      }
      setGenerated(data.text ?? '')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed')
    } finally {
      setLoading(false)
    }
  }

  const handleInsert = () => {
    if (textareaRef.current != null && generated) {
      textareaRef.current.value = generated
      textareaRef.current.dispatchEvent(new Event('input', { bubbles: true }))
      setExistingText(generated)
    }
    setOpen(false)
  }

  const handleRegenerate = () => {
    setGenerated('')
    setError(null)
    void handleGenerate()
  }

  return (
    <div ref={containerRef} className="relative">
      {children}
      <button
        type="button"
        onClick={() => {
          setOpen((o) => !o)
          setError(null)
          setGenerated('')
        }}
        className="absolute right-2 top-2 flex h-10 w-10 items-center justify-center rounded-[var(--radius-card)] bg-[var(--gray-bg)] text-[var(--gray-secondary)] hover:bg-[var(--color-cta)] hover:text-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-cta)]"
        aria-label="AI assist"
        aria-expanded={open}
      >
        <span aria-hidden>✨</span>
      </button>
      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            aria-hidden
            onClick={() => setOpen(false)}
          />
          <div
            className="absolute right-0 top-full z-50 mt-2 w-full min-w-[320px] max-w-[420px] rounded-[var(--radius-card)] border border-[var(--gray-border)] bg-white p-4 shadow-[var(--shadow-medium)]"
            role="dialog"
            aria-label="AI assist panel"
          >
            <div className="space-y-3">
              <label className="block text-sm font-medium text-[var(--gray-dark)]">
                Action
              </label>
              <select
                value={action}
                onChange={(e) => setAction(e.target.value)}
                className="w-full rounded-[6px] border border-[var(--gray-border)] px-3 py-2 text-sm focus:border-[var(--color-cta)] focus:ring-1 focus:ring-[var(--color-cta)]"
              >
                {ACTIONS.map((a) => (
                  <option key={a.value} value={a.value}>
                    {a.label}
                  </option>
                ))}
              </select>
              <label className="block text-sm font-medium text-[var(--gray-dark)]">
                Tone
              </label>
              <select
                value={tone}
                onChange={(e) => setTone(e.target.value)}
                className="w-full rounded-[6px] border border-[var(--gray-border)] px-3 py-2 text-sm focus:border-[var(--color-cta)] focus:ring-1 focus:ring-[var(--color-cta)]"
              >
                {TONES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
              <label className="block text-sm font-medium text-[var(--gray-dark)]">
                Optional prompt
              </label>
              <input
                type="text"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="e.g. Emphasize the mountain views"
                className="w-full rounded-[6px] border border-[var(--gray-border)] px-3 py-2 text-sm focus:border-[var(--color-cta)] focus:ring-1 focus:ring-[var(--color-cta)]"
              />
              <button
                type="button"
                onClick={() => void handleGenerate()}
                disabled={loading}
                className="w-full rounded-[var(--radius-card)] bg-[var(--color-cta)] py-2.5 font-semibold text-[var(--color-primary)] hover:opacity-90 disabled:opacity-50"
              >
                {loading ? 'Generating…' : 'Generate'}
              </button>
              {error && (
                <p className="text-sm text-[var(--urgent)]" role="alert">
                  {error}
                </p>
              )}
              {generated && (
                <>
                  <label className="block text-sm font-medium text-[var(--gray-dark)]">
                    Preview
                  </label>
                  <div className="max-h-40 overflow-auto rounded-[6px] border border-[var(--gray-border)] bg-[var(--gray-bg)] p-3 text-sm whitespace-pre-wrap">
                    {generated}
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleInsert}
                      className="flex-1 rounded-[var(--radius-card)] bg-[var(--color-primary)] py-2 text-sm font-semibold text-white hover:opacity-90"
                    >
                      Insert
                    </button>
                    <button
                      type="button"
                      onClick={handleRegenerate}
                      disabled={loading}
                      className="flex-1 rounded-[var(--radius-card)] border border-[var(--gray-border)] py-2 text-sm font-semibold hover:bg-[var(--gray-bg)] disabled:opacity-50"
                    >
                      Regenerate
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
