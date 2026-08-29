'use client'

import { useCallback, useEffect, useRef } from 'react'

export type MediaOverlayHash = 'gallery' | 'tour'

/**
 * Gallery and tour overlays must occupy a history entry so browser Back
 * returns to the listing at the same scroll. Next router.push remounts the
 * page and loses scroll — this is window.history only.
 */
export function useMediaOverlayHistory(
  isOpen: boolean,
  onClose: () => void,
  hash: MediaOverlayHash,
): { dismiss: () => void } {
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  const pushedRef = useRef(false)
  const fromPopRef = useRef(false)

  useEffect(() => {
    if (!isOpen) {
      pushedRef.current = false
      fromPopRef.current = false
      return
    }

    const url = new URL(window.location.href)
    const want = `#${hash}`
    if (url.hash !== want) {
      history.pushState({ listingMedia: hash }, '', `${url.pathname}${url.search}${want}`)
      pushedRef.current = true
    }

    const onPop = () => {
      fromPopRef.current = true
      onCloseRef.current()
    }
    window.addEventListener('popstate', onPop)
    return () => {
      window.removeEventListener('popstate', onPop)
    }
  }, [isOpen, hash])

  const dismiss = useCallback(() => {
    if (fromPopRef.current) {
      fromPopRef.current = false
      onCloseRef.current()
      return
    }
    if (pushedRef.current && window.location.hash === `#${hash}`) {
      pushedRef.current = false
      history.back()
      return
    }
    onCloseRef.current()
  }, [hash])

  return { dismiss }
}
