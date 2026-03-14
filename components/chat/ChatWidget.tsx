'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { trackEvent } from '@/lib/tracking'
import { HugeiconsIcon } from '@hugeicons/react'
import { MessageAdd01Icon, Cancel01Icon, SentIcon } from '@hugeicons/core-free-icons'
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
}

const WELCOME_MESSAGE: Message = {
  id: 'welcome',
  role: 'assistant',
  content:
    'Hi there! 👋 I\'m the Ryan Realty assistant. I can help with questions about Central Oregon real estate, neighborhoods, home values, and the buying or selling process. What can I help you with?',
}

function generateId() {
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export default function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [hasOpened, setHasOpened] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen])

  const toggleOpen = () => {
    const next = !isOpen
    setIsOpen(next)
    if (next && !hasOpened) {
      setHasOpened(true)
      trackEvent('ai_chat_started', { source: 'floating_widget' })
    }
  }

  const sendMessage = async () => {
    const text = input.trim()
    if (!text || loading) return

    const userMsg: Message = { id: generateId(), role: 'user', content: text }
    const updatedMessages = [...messages, userMsg]
    setMessages(updatedMessages)
    setInput('')
    setLoading(true)

    try {
      // Send only role+content to API (strip ids)
      const apiMessages = updatedMessages
        .filter((m) => m.id !== 'welcome')
        .map((m) => ({ role: m.role, content: m.content }))

      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: apiMessages }),
      })

      if (!res.ok) {
        const errData = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(errData.error ?? `Error ${res.status}`)
      }

      const data = (await res.json()) as { message: string }
      const assistantMsg: Message = {
        id: generateId(),
        role: 'assistant',
        content: data.message,
      }
      setMessages((prev) => [...prev, assistantMsg])
    } catch (err) {
      const errorMsg: Message = {
        id: generateId(),
        role: 'assistant',
        content:
          err instanceof Error && err.message.includes('Too many requests')
            ? "I'm getting a lot of questions right now. Please try again in a minute!"
            : "Sorry, I couldn't get a response. Please try again or contact us at /contact.",
      }
      setMessages((prev) => [...prev, errorMsg])
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <>
      {/* Chat panel */}
      {isOpen && (
        <div
          className="fixed bottom-20 right-4 z-50 flex w-[min(380px,calc(100vw-2rem))] flex-col rounded-xl border border-border bg-card shadow-lg sm:bottom-24 sm:right-6"
          style={{ height: 'min(520px, calc(100vh - 160px))' }}
          role="dialog"
          aria-label="Chat With Us"
        >
          {/* Header */}
          <div className="flex items-center justify-between rounded-t-2xl bg-primary px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent">
                <HugeiconsIcon icon={MessageAdd01Icon} className="h-4 w-4 text-primary" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-white">Chat With Us</h2>
                <p className="text-xs text-white/70">Ryan Realty • Central Oregon</p>
              </div>
            </div>
            <Button
              type="button"
              onClick={toggleOpen}
              className="rounded-lg p-1 text-white/80 hover:bg-card/10 hover:text-white"
              aria-label="Close chat"
            >
              <HugeiconsIcon icon={Cancel01Icon} className="h-5 w-5" />
            </Button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={[
                    'max-w-[85%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed',
                    msg.role === 'user'
                      ? 'bg-primary text-white rounded-br-md'
                      : 'bg-muted text-foreground rounded-bl-md',
                  ].join(' ')}
                >
                  {msg.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="rounded-xl rounded-bl-md bg-muted px-4 py-3">
                  <div className="flex gap-1">
                    <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground" style={{ animationDelay: '0ms' }} />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground" style={{ animationDelay: '150ms' }} />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="border-t border-border p-3">
            <div className="flex items-end gap-2">
              <Textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about Central Oregon real estate…"
                rows={1}
                className="flex-1 resize-none rounded-lg border border-border bg-card px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                style={{ maxHeight: '80px' }}
                disabled={loading}
              />
              <Button
                type="button"
                onClick={sendMessage}
                disabled={loading || !input.trim()}
                className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-accent text-primary hover:opacity-90 disabled:opacity-50"
                aria-label="Send message"
              >
                <HugeiconsIcon icon={SentIcon} className="h-5 w-5" />
              </Button>
            </div>
            <p className="mt-1.5 text-center text-[10px] text-muted-foreground">
              AI assistant • May not always be accurate
            </p>
          </div>
        </div>
      )}

      {/* Floating button */}
      <Button
        type="button"
        onClick={toggleOpen}
        className={[
          'fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-full px-5 py-3 font-semibold shadow-md transition-all hover:scale-105 sm:bottom-6 sm:right-6',
          isOpen
            ? 'bg-muted text-primary'
            : 'bg-primary text-white',
        ].join(' ')}
        aria-label={isOpen ? 'Close chat' : 'Chat With Us'}
      >
        {isOpen ? (
          <HugeiconsIcon icon={Cancel01Icon} className="h-5 w-5" />
        ) : (
          <>
            <HugeiconsIcon icon={MessageAdd01Icon} className="h-5 w-5" />
            <span className="hidden sm:inline">Chat With Us</span>
          </>
        )}
      </Button>
    </>
  )
}
