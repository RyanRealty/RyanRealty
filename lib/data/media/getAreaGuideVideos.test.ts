import { describe, expect, it } from 'vitest'
import { youtubeFromUsedIn } from './getAreaGuideVideos'

describe('youtubeFromUsedIn', () => {
  it('reads the youtube usage stamp off an asset row', () => {
    const yt = youtubeFromUsedIn([
      { render_type: 'short-form', render_path: 'out/reel.mp4', scene_id: 'hero', used_at: '2026-05-01' },
      {
        render_type: 'youtube',
        render_path: 'https://www.youtube.com/watch?v=Ab3dEfGhIjK',
        scene_id: 'Ab3dEfGhIjK',
        title: 'Widgi Creek: Bend’s Premier Golf Course Retreat!',
        thumbnail_url: 'https://i.ytimg.com/vi/Ab3dEfGhIjK/maxresdefault.jpg',
        published_at: '2025-05-29',
        duration_seconds: 22,
        used_at: '2026-09-07',
      },
    ])
    expect(yt).toEqual({
      id: 'Ab3dEfGhIjK',
      url: 'https://www.youtube.com/watch?v=Ab3dEfGhIjK',
      title: 'Widgi Creek: Bend’s Premier Golf Course Retreat!',
      thumbnailUrl: 'https://i.ytimg.com/vi/Ab3dEfGhIjK/maxresdefault.jpg',
      publishedAt: '2025-05-29',
      durationSeconds: 22,
    })
  })

  it('ignores rows without a stamp, malformed ids, and non-array input', () => {
    expect(youtubeFromUsedIn(null)).toBeNull()
    expect(youtubeFromUsedIn([])).toBeNull()
    expect(youtubeFromUsedIn([{ render_type: 'short-form', scene_id: 'x' }])).toBeNull()
    expect(youtubeFromUsedIn([{ render_type: 'youtube', scene_id: 'too-short' }])).toBeNull()
  })

  it('rebuilds the watch URL when the stored path is not https', () => {
    const yt = youtubeFromUsedIn([{ render_type: 'youtube', scene_id: 'Ab3dEfGhIjK', render_path: 'youtube:Ab3dEfGhIjK' }])
    expect(yt?.url).toBe('https://www.youtube.com/watch?v=Ab3dEfGhIjK')
    expect(yt?.title).toBeNull()
  })
})
