'use client'

import React, { createContext, useContext, useCallback, useState, useEffect, useRef } from 'react'

type ComparisonContextValue = {
  comparisonItems: string[]
  /** Returns true if added, false if already in list or at max (4). */
  addToComparison: (listingKey: string) => boolean
  removeFromComparison: (listingKey: string) => void
  clearComparison: () => void
  isInComparison: (listingKey: string) => boolean
}

const ComparisonContext = createContext<ComparisonContextValue | null>(null)

const STORAGE_KEY = 'ryan-realty-compare'
const MAX_ITEMS = 4

export function ComparisonProvider({ children }: { children: React.ReactNode }) {
  const itemsRef = useRef<string[]>([])
  const [items, setItems] = useState<string[]>(() => {
    if (typeof window === 'undefined') return []
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return []
      const parsed = JSON.parse(raw) as unknown
      return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string').slice(0, MAX_ITEMS) : []
    } catch {
      return []
    }
  })

  useEffect(() => {
    itemsRef.current = items
  }, [items])

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
    } catch {
      // ignore
    }
  }, [items])

  const addToComparison = useCallback((listingKey: string): boolean => {
    const key = String(listingKey).trim()
    if (!key) return false
    const current = itemsRef.current
    if (current.includes(key)) return false
    if (current.length >= MAX_ITEMS) return false
    setItems((prev) => [...prev, key])
    return true
  }, [])

  const removeFromComparison = useCallback((listingKey: string) => {
    setItems((prev) => prev.filter((k) => k !== String(listingKey).trim()))
  }, [])

  const clearComparison = useCallback(() => setItems([]), [])

  const isInComparison = useCallback(
    (listingKey: string) => items.includes(String(listingKey).trim()),
    [items]
  )

  const value: ComparisonContextValue = {
    comparisonItems: items,
    addToComparison,
    removeFromComparison,
    clearComparison,
    isInComparison,
  }

  return <ComparisonContext.Provider value={value}>{children}</ComparisonContext.Provider>
}

export function useComparison(): ComparisonContextValue {
  const ctx = useContext(ComparisonContext)
  if (!ctx) {
    return {
      comparisonItems: [],
      addToComparison: () => false,
      removeFromComparison: () => {},
      clearComparison: () => {},
      isInComparison: () => false,
    }
  }
  return ctx
}
