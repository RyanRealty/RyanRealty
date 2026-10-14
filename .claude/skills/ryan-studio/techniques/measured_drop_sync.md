# Measured music drop

Category: sound

Planned: not on the menu yet (video_gate refuses it). Home when built: lib/studio/motion/sound.ts.

Source: video-skills-research #6

## Recipe
Only on licensed audio: find drop by band energy (librosa onset_strength on 60-250 Hz, argmax after 10 s), set IG picker start so drop lands on hero number. Loudnorm two-pass to -14 LUFS. Otherwise tap by ear.

## Use
List `measured_drop_sync` in brief.techniques. Mandatory spec_rules still apply. Once ready.
