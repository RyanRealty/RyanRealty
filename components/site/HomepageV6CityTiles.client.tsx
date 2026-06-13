'use client'

/**
 * HomepageV6CityTiles — live photoreal 3D Bend over the hero poster.
 *
 * Poster-first LCP: the server-rendered poster paints immediately; this
 * island lazy-loads three + 3d-tiles-renderer AFTER idle, on desktop only,
 * and fades the live canvas in (150ms, the only motion budget v6 allows)
 * once real imagery has streamed in. The camera is FIXED — no drift, no
 * orbit — per the locked Linear finish (precision over theatrics).
 *
 * Failure is silent by design: no key, no WebGL, save-data, small screen,
 * or a network error all leave the poster in place. The poster IS the page.
 *
 * Also owns the coords readout (data chrome) so the Feed row can flip
 * poster still -> live tiles honestly, and the Google attribution line
 * required by the Map Tiles API terms when live imagery is on screen.
 *
 * CSP note: tile.googleapis.com must be in connect-src and blob: in
 * connect-src + worker-src (three's ImageBitmapLoader fetches blob: URLs
 * for tile textures) — wired in next.config.ts.
 */

import { useEffect, useRef, useState } from 'react'

/** Fixed camera anchor over downtown Bend (locked in the v6 mockup). */
const ANCHOR_LAT = 44.0582
const ANCHOR_LON = -121.3153
/** Camera height above the local tangent plane, meters (code constant). */
const CAM_HEIGHT_M = 1450
const CAM_RADIUS_M = 2600
const CAM_AZIMUTH = 1.15

export default function HomepageV6CityTiles({ apiKey }: { apiKey: string | null }) {
  const mountRef = useRef<HTMLDivElement>(null)
  const [live, setLive] = useState(false)

  useEffect(() => {
    if (!apiKey) return
    if (window.innerWidth < 960) return
    const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection
    if (conn?.saveData) return

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
        const camera = new THREE.PerspectiveCamera(
          45,
          mount.clientWidth / mount.clientHeight,
          10,
          1e7,
        )

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

        // Fixed oblique camera — no cinematic drift (Linear discipline).
        camera.position.set(
          Math.cos(CAM_AZIMUTH) * CAM_RADIUS_M,
          CAM_HEIGHT_M,
          Math.sin(CAM_AZIMUTH) * CAM_RADIUS_M,
        )
        camera.lookAt(-600, 120, -300)
        camera.updateMatrixWorld()

        let raf = 0
        let running = true
        const frame = () => {
          if (!running) return
          tiles.update()
          renderer.render(scene, camera)
          raf = requestAnimationFrame(frame)
        }
        raf = requestAnimationFrame(frame)

        // Only burn frames while the hero is actually on screen.
        const io = new IntersectionObserver(([entry]) => {
          if (entry.isIntersecting && !running) {
            running = true
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

        // 'tiles-load-end' fires when the load queue empties — real imagery is
        // on screen. ('load-tileset' fires on the root JSON, long before any
        // visible tile, which would fade the poster into an untextured scene.)
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
        // Poster stays — graceful fallback by design. Warn for diagnostics only.
        console.warn('[v6-city-tiles] 3D tiles unavailable:', e)
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
      <div
        ref={mountRef}
        className={live ? 'v6-hero-city is-live' : 'v6-hero-city'}
        aria-hidden="true"
      />
      {live && <span className="v6-attribution">Imagery © Google</span>}
      <aside className="v6-coords v6-panel v6-tnum" aria-label="Camera telemetry">
        <div className="v6-row">
          <b>44.0582° N</b>
          <span>121.3153° W</span>
        </div>
        <div className="v6-row">
          <b>Cam</b>
          <span>1,450 m · fixed</span>
        </div>
        <div className="v6-row">
          <b>Feed</b>
          <span>{live ? 'live tiles' : 'poster still'}</span>
        </div>
        <div className="v6-row">
          <b>Source</b>
          <span>Google 3D Tiles</span>
        </div>
      </aside>
    </>
  )
}
