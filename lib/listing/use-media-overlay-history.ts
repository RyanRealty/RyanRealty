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
): { dismiss: () => void; closeInPlace: () => void } {
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
    const dest = overlayDest(url, hash, photoOneBased)
    const alreadyThere = overlayMatches(url, hash, photoOneBased)

    if (!alreadyThere) {
      if (pushedRef.current || (hash === 'gallery' && url.searchParams.has('photo'))) {
        history.replaceState({ listingMedia: hash }, '', dest)
      } else {
        history.pushState({ listingMedia: hash }, '', dest)
        pushedRef.current = true
      }
    } else if (
      hash === 'gallery' &&
      (photoOneBased == null || photoOneBased <= 0) &&
      !pushedRef.current
    ) {
      // Floor pane has no ?photo= dest. Still occupy a history entry so Back
      // closes the gallery; never write #tour.
      history.pushState({ listingMedia: hash }, '', dest)
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
    history.replaceState(null, '', listingUrlWithoutPhoto(url))
    onCloseRef.current()
  }, [])

  /** Close without history.back so a tour overlay can take #tour on this entry. */
  const closeInPlace = useCallback(() => {
    pushedRef.current = false
    fromPopRef.current = false
    const url = new URL(window.location.href)
    history.replaceState(null, '', listingUrlWithoutPhoto(url))
    onCloseRef.current()
  }, [])

  return { dismiss, closeInPlace }
}

function stripPhoto(search: string): string {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
  params.delete('photo')
  const next = params.toString()
  return next ? `?${next}` : ''
}

/** Listing path + search with `?photo=` removed and no `#tour`. */
export function listingUrlWithoutPhoto(url: URL): string {
  return `${url.pathname}${stripPhoto(url.search)}`
}

function galleryUrl(url: URL, photoOneBased: number): string {
  const params = new URLSearchParams(url.search)
  params.set('photo', String(photoOneBased))
  const qs = params.toString()
  return `${url.pathname}?${qs}`
}

function overlayDest(url: URL, hash: MediaOverlayHash, photoOneBased?: number | null): string {
  if (hash === 'gallery') {
    if (photoOneBased != null && photoOneBased > 0) return galleryUrl(url, photoOneBased)
    return listingUrlWithoutPhoto(url)
  }
  return `${listingUrlWithoutPhoto(url)}#tour`
}

function overlayMatches(url: URL, hash: MediaOverlayHash, photoOneBased?: number | null): boolean {
  if (hash === 'gallery') {
    if (photoOneBased != null && photoOneBased > 0) {
      return url.searchParams.get('photo') === String(photoOneBased)
    }
    return !url.searchParams.has('photo') && url.hash !== '#tour'
  }
  return url.hash === '#tour'
}
