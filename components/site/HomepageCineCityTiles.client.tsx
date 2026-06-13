'use client'

/**
 * HomepageCineCityTiles — live photoreal 3D Bend behind the cinematic hero.
 *
 * The differentiator no Central Oregon competitor has: a living, photoreal
 * 3D city (Google Photorealistic 3D Tiles) that slowly drifts behind the
 * headline, fading in over the poster-first LCP once real imagery streams.
 *
 * Cinematic, not Linear: a gentle continuous azimuth drift (vs the v6 fixed
 * camera) gives the arrival its motion. Still respects reduced-motion (holds
 * the camera still) and only animates while on screen.
 *
 * Graceful by design: no key, no WebGL, save-data, small screen, or any
 * network error leaves the poster in place — the poster IS the hero.
 *
 * CSP: tile.googleapis.com in connect-src + blob: in connect-src/worker-src
 * (three's ImageBitmapLoader fetches blob: tile textures) — see next.config.ts.
 */

import { useEffect, useRef, useState } from 'react'

/** Camera anchor over downtown Bend. */
const ANCHOR_LAT = 44.0582
const ANCHOR_LON = -121.3153
const CAM_HEIGHT_M = 1500
const CAM_RADIUS_M = 2700
const CAM_AZIMUTH_0 = 1.05
/** Radians/second of slow orbital drift — cinematic, barely perceptible. */
const DRIFT_RATE = 0.012

export default function HomepageCineCityTiles({ apiKey }: { apiKey: string | null }) {
  const mountRef = useRef<HTMLDivElement>(null)
  const [live, setLive] = useState(false)

  useEffect(() => {
    if (!apiKey) return
    if (window.innerWidth < 960) return
    const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection
    if (conn?.saveData) return

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let disposed = false
    let cleanup: (() => void) | null = null

    const win = window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number
      cancelIdleCallback?: (h: number) => void
    }
    const idleHandle = win.requestIdleCallback
      ? win.requestIdleCallback(() => void init(), { timeout: 3000 })
      : window.setTimeout(() => void init(), 1500)

    async function init() {
      try {
        const probe = document.createElement('canvas')
        if (!probe.getContext('webgl2') && !probe.getContext('webgl')) return

        const [THREE, core, plugins] = await Promise.all([
          import('three'),
          import('3d-tiles-renderer'),
          import('3d-tiles-renderer/plugins'),
        ])
        const mount = mountRef.current
        if (disposed || !mount) return

        const renderer = new THREE.WebGLRenderer({ antialias: true })
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
        renderer.setSize(mount.clientWidth, mount.clientHeight)
        mount.appendChild(renderer.domElement)

        const scene = new THREE.Scene()
        const camera = new THREE.PerspectiveCamera(45, mount.clientWidth / mount.clientHeight, 10, 1e7)

        const tiles = new core.TilesRenderer()
        tiles.registerPlugin(new plugins.GoogleCloudAuthPlugin({ apiToken: apiKey as string }))
        tiles.registerPlugin(
          new plugins.ReorientationPlugin({
            lat: (ANCHOR_LAT * Math.PI) / 180,
            lon: (ANCHOR_LON * Math.PI) / 180,
          }),
        )
        tiles.setCamera(camera)
        tiles.setResolutionFromRenderer(camera, renderer)
        scene.add(tiles.group)

        const placeCamera = (az: number) => {
          camera.position.set(Math.cos(az) * CAM_RADIUS_M, CAM_HEIGHT_M, Math.sin(az) * CAM_RADIUS_M)
          camera.lookAt(-600, 120, -300)
          camera.updateMatrixWorld()
        }
        placeCamera(CAM_AZIMUTH_0)

        let raf = 0
        let running = true
        let last = 0
        let az = CAM_AZIMUTH_0
        const frame = (t: number) => {
          if (!running) return
          if (!reduceMotion) {
            if (last) az += ((t - last) / 1000) * DRIFT_RATE
            last = t
            placeCamera(az)
          }
          tiles.update()
          renderer.render(scene, camera)
          raf = requestAnimationFrame(frame)
        }
        raf = requestAnimationFrame(frame)

        const io = new IntersectionObserver(([entry]) => {
          if (entry.isIntersecting && !running) {
            running = true
            last = 0
            raf = requestAnimationFrame(frame)
          } else if (!entry.isIntersecting && running) {
            running = false
            cancelAnimationFrame(raf)
          }
        })
        io.observe(mount)

        const onResize = () => {
          if (!mountRef.current) return
          camera.aspect = mountRef.current.clientWidth / mountRef.current.clientHeight
          camera.updateProjectionMatrix()
          renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight)
        }
        window.addEventListener('resize', onResize)

        // 'tiles-load-end' = load queue empty = real imagery on screen.
        const onLoadEnd = () => {
          if (!disposed) setLive(true)
          tiles.removeEventListener('tiles-load-end', onLoadEnd)
        }
        tiles.addEventListener('tiles-load-end', onLoadEnd)

        cleanup = () => {
          running = false
          cancelAnimationFrame(raf)
          io.disconnect()
          window.removeEventListener('resize', onResize)
          tiles.dispose()
          renderer.dispose()
          renderer.domElement.remove()
        }
      } catch (e) {
        console.warn('[cine-city-tiles] 3D tiles unavailable:', e)
      }
    }

    return () => {
      disposed = true
      if (win.cancelIdleCallback) win.cancelIdleCallback(idleHandle as number)
      else window.clearTimeout(idleHandle as number)
      cleanup?.()
    }
  }, [apiKey])

  return (
    <>
      <div ref={mountRef} className={live ? 'cine-hero-city is-live' : 'cine-hero-city'} aria-hidden="true" />
      {live && <span className="cine-attribution">Imagery © Google</span>}
    </>
  )
}
