# TikTok burned-in captions

Source: Matt rule 2026-10-13

## Recipe
Word timings from TTS (ElevenLabs alignment or Grok with_timestamps). 2-4 words per card, bold sans 64px, white with 6px dark stroke, active word in brand cream, inside safe area (y<=1640). ffmpeg: `subtitles=caps.ass:force_style='Fontname=Inter Black,Fontsize=64,Outline=6,Alignment=2,MarginV=380'`.

## Use
List `tiktok_caption_burn` in brief.techniques. Mandatory spec_rules still apply.
