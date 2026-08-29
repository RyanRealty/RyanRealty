'use client'

import { useCallback, useEffect, useRef } from 'react'

export type MediaOverlayHash = 'gallery' | 'tour'

/**
 * Gallery and tour overlays must occupy a history entry so browser Back
 * returns to the listing at the same scroll. Next router.push remounts the
 * page and loses scroll — this is window.history only.
 *
 * Gallery deep-links as `?photo=1`. Slide changes replace that same entry.
 * Tour still uses `#tour`.
 */
export function useMediaOverlayHistory(
  isOpen: boolean,
  onClose: () => void,
  hash: MediaOverlayHash,
  photoOneBased?: number | null,
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
    const dest =
      hash === 'gallery' && photoOneBased != null && photoOneBased > 0
        ? galleryUrl(url, photoOneBased)
        : `${url.pathname}${stripPhoto(url.search)}#tour`

    const alreadyThere =
      hash === 'gallery'
        ? url.searchParams.get('photo') === String(photoOneBased)
        : url.hash === '#tour'

    if (!alreadyThere) {
      if (pushedRef.current || (hash === 'gallery' && url.searchParams.has('photo'))) {
        history.replaceState({ listingMedia: hash }, '', dest)
      } else {
        history.pushState({ listingMedia: hash }, '', dest)
        pushedRef.current = true
      }
    }

    const onPop = () => {
      fromPopRef.current = true
      onCloseRef.current()
    }
    window.addEventListener('popstate', onPop)
    return () => {
      window.removeEventListener('popstate', onPop)
    }
  }, [isOpen, hash, photoOneBased])

  const dismiss = useCallback(() => {
    if (fromPopRef.current) {
      fromPopRef.current = false
      onCloseRef.current()
      return
    }
    if (pushedRef.current) {
      pushedRef.current = false
      history.back()
      return
    }
    const url = new URL(window.location.href)
    history.replaceState(null, '', `${url.pathname}${stripPhoto(url.search)}`)
    onCloseRef.current()
  }, [])

  return { dismiss }
}

function stripPhoto(search: string): string {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
  params.delete('photo')
  const next = params.toString()
  return next ? `?${next}` : ''
}

function galleryUrl(url: URL, photoOneBased: number): string {
  const params = new URLSearchParams(url.search)
  params.set('photo', String(photoOneBased))
  const qs = params.toString()
  return `${url.pathname}?${qs}`
}
