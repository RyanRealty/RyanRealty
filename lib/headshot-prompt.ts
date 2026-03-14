/**
 * Professional real estate broker headshot prompt for AI image generation.
 * Used with Replicate fofr/face-to-many (image + prompt → styled headshot).
 * Structure: [Subject], [Clothing], camera/expression, then Technical, Lighting, Texture, Background.
 */

export type HeadshotGender = 'Male' | 'Female'

function wardrobeForGender(gender: HeadshotGender): string {
  if (gender === 'Female') {
    return 'tailored blazer in navy, black, cream, or warm camel with clean blouse or silk shell in neutral or soft jewel tone, minimal jewelry'
  }
  return 'tailored navy or charcoal suit jacket, crisp white or light blue dress shirt, no tie or refined silk tie in burgundy, navy, or dark grey'
}

export function buildBrokerHeadshotPrompt(gender: HeadshotGender): string {
  const subject = `${gender} professional real estate broker, mid-close portrait (head and shoulders)`
  const clothing = wardrobeForGender(gender)
  const expression = 'confident, approachable, direct eye contact with camera, genuine soft smile or composed neutral expression'

  return `${subject}, wearing ${clothing}, looking directly at the camera, ${expression}.

Technical Specs: Shot on 85mm portrait lens, f/1.8 aperture, ISO 100, high-frequency detail, 4k resolution, raw photo.

Lighting & Atmosphere: Soft, natural, directional window lighting, subtle catchlights in eyes, cinematic, professional studio setting.

Texture: Realistic skin texture, visible pores, natural skin oils, sharp focus on eyes, detailed hair texture.

Background: Neutral gray background, soft bokeh.

Professional headshot, photorealistic, editorial quality, luxury real estate branding.`
}

/** Negative prompt for Replicate; avoids airbrushed/CGI/artificial look. */
export const BROKER_HEADSHOT_NEGATIVE_PROMPT =
  'airbrushed, plastic skin, wax figure, CGI, 3D render, cartoon, overly smooth, heavy makeup, artificial, distorted features'
