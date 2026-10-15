# 2026-10-15 (Cursor, Sarah iOS voice loop)

Surface: Cursor cloud. Branch `cursor/sarah-ios-mic-9966`.

## Done
- iOS talk loop: resample 48 kHz → 24 kHz pcm16, fix pcm16ToBase64 stride, one AudioContext, HTMLAudioElement unlock.
- Server VAD + greeting + live transcripts. Debug stages to console and `/api/sarah/voice-debug`.
- Grok-style orb: one tap starts, one tap ends, Just start talking / Tap to end.
- Launcher: no AI strip, 68px, 24px inset, glow ring.

## Next
Land the PR to main, confirm Vercel READY, check live ryan-realty.com.

## Skills read
`.cursor/skills` site-queue not used. Voice work used repo Sarah/Grok realtime code and xAI speech-to-speech docs.
