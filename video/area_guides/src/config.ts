// Canonical dimensions + timing for the area_guides format.
// Portrait 9:16, 30fps, 30-45s, per SKILL.md spec.

export const FPS = 30
export const WIDTH = 1080
export const HEIGHT = 1920

// Beat structure: 6 beats per spec
// 0 Hook (place name + visual)  3s
// 1 Title card (neighborhood + city)  3s
// 2 Amenity beat 1  5s
// 3 Amenity beat 2  5s
// 4 Amenity beat 3  5s
// 5 Kinetic stat reveal  5s
// Total: 26s base, VO adds 4-6s gap → 30-35s

export const BEAT_DURATIONS_SEC = [3.0, 3.0, 5.0, 5.0, 5.0, 5.0] as const
export const TOTAL_SEC = BEAT_DURATIONS_SEC.reduce((a, b) => a + b, 0)
export const TOTAL_FRAMES = Math.round(TOTAL_SEC * FPS)

// Brand palette (v2 locked 2026-05-12)
export const NAVY = '#102742'
export const CREAM = '#faf8f4'
export const WHITE = '#FFFFFF'
