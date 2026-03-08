/**
 * Photo classification pipeline for listing images (master instruction set).
 * Tags and quality score for hero selection. Uses OpenAI Vision if OPENAI_API_KEY is set.
 */

export const PHOTO_TAGS = [
  'exterior_front',
  'aerial_drone',
  'pool_outdoor_living',
  'great_room',
  'kitchen',
  'primary_suite',
  'bathroom',
  'office_flex',
  'view_mountain',
  'view_water',
  'view_forest',
  'community_amenity',
  'neighborhood_streetscape',
  'seasonal',
] as const

export type PhotoTag = (typeof PHOTO_TAGS)[number]

export type ClassificationResult = {
  tags: PhotoTag[]
  qualityScore: number
}

const TAG_LIST = PHOTO_TAGS.join(', ')

/**
 * Classify one listing photo via OpenAI GPT-4o Vision. Returns tags and quality score (0-100).
 * If OPENAI_API_KEY is not set, returns null (caller can skip or use stub).
 */
export async function classifyListingPhoto(imageUrl: string): Promise<ClassificationResult | null> {
  const apiKey = process.env.OPENAI_API_KEY?.trim()
  if (!apiKey) return null

  const prompt = `You are classifying a real estate listing photo for hero image selection and search.

Choose ALL that apply from this exact list (return only these identifiers, comma-separated, no other text):
${TAG_LIST}

Then assign a quality score from 0 to 100 for use as a hero image: consider resolution, aspect ratio suitability for a wide hero (e.g. 16:9 or 3:2), composition, and visual appeal. Reply with a single number.

Respond in exactly this format, nothing else:
TAGS: tag1, tag2, tag3
SCORE: 85`

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        max_tokens: 200,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: imageUrl } },
            ],
          },
        ],
      }),
    })
    if (!res.ok) return null
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> }
    const content = data.choices?.[0]?.message?.content?.trim()
    if (!content) return null

    const tags: PhotoTag[] = []
    const tagMatch = content.match(/TAGS:\s*([\s\S]+?)(?=\n|SCORE:|$)/i)
    if (tagMatch) {
      const raw = tagMatch[1].replace(/\s/g, '').toLowerCase()
      for (const t of PHOTO_TAGS) {
        if (raw.includes(t.toLowerCase())) tags.push(t)
      }
    }

    let qualityScore = 50
    const scoreMatch = content.match(/SCORE:\s*(\d+)/i)
    if (scoreMatch) {
      const n = parseInt(scoreMatch[1], 10)
      if (Number.isFinite(n)) qualityScore = Math.max(0, Math.min(100, n))
    }

    return { tags, qualityScore }
  } catch {
    return null
  }
}
