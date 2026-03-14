'use client'

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'

const STORAGE_KEY = 'ryan-realty-compare'
const MAX_ITEMS = 4

type ComparisonContextValue = {
  /** Listing keys currently selected for comparison (max 4). */
  comparisonItems: string[]
  addToComparison: (listingKey: string) => void
  removeFromComparison: (listingKey: string) => void
  clearComparison: () => void
  isInComparison: (listingKey: string) => boolean
}

const ComparisonContext = createContext<ComparisonContextValue | null>(null)

export function ComparisonProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<string[]>([])

  // Hydrate from localStorage on mount (SSR-safe)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) {
          setItems(parsed.filter((v): v is string => typeof v === 'string').slice(0, MAX_ITEMS))
        }
      }
    } catch {
      // Ignore — localStorage may not be available
    }
  }, [])

  // Persist to localStorage on change (skip initial empty state before hydration)
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => {
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated) return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
    } catch {
      // Ignore quota errors
    }
  }, [items, hydrated])

  const addToComparison = useCallback((key: string) => {
    setItems((prev) => {
      if (prev.includes(key) || prev.length >= MAX_ITEMS) return prev
      return [...prev, key]
    })
  }, [])

  const removeFromComparison = useCallback((key: string) => {
    setItems((prev) => prev.filter((k) => k !== key))
  }, [])

  const clearComparison = useCallback(() => {
    setItems([])
  }, [])

  const isInComparison = useCallback(
    (key: string) => items.includes(key),
    [items],
  )

  return (
    <ComparisonContext value={{
      comparisonItems: items,
      addToComparison,
      removeFromComparison,
      clearComparison,
      isInComparison,
    }}>
      {children}
    </ComparisonContext>
  )
}

const FALLBACK: ComparisonContextValue = {
  comparisonItems: [],
  addToComparison: () => {},
  removeFromComparison: () => {},
  clearComparison: () => {},
  isInComparison: () => false,
}

export function useComparison(): ComparisonContextValue {
  const ctx = useContext(ComparisonContext)
  // During SSR the provider may not be mounted yet — return safe defaults instead of crashing.
  if (!ctx) return FALLBACK
  return ctx
}
