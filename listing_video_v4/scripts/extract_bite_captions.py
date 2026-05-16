#!/usr/bin/env python3
"""Extract per-bite caption tokens (word + start_sec relative to bite start).

For each entry in bites_inventory.json, pull the matching word chunks from the
source transcript and write a sidecar <label>.captions.json.
"""
import json
from pathlib import Path

ROOT = Path("/Users/matthewryan/RyanRealty/listing_video_v4/public/source_clips/bend_pulse")
LONG = ROOT / "long"
BITES = ROOT / "bites"


def main():
    inv = json.loads((LONG / "bites_inventory.json").read_text())
    for b in inv:
        src = LONG / f"{b['source_file']}.transcript.json"
        if not src.exists():
            print(f"[skip] no transcript for {b['label']}")
            continue
        d = json.loads(src.read_text())
        chunks = d["chunks"]
        bite_start = b["expanded_start_sec"]
        bite_end = b["expanded_end_sec"]
        # Pull chunks whose midpoint falls inside the bite window
        words = []
        for c in chunks:
            mid = (c["timestamp"][0] + c["timestamp"][1]) / 2
            if bite_start <= mid <= bite_end:
                words.append({
                    "text": c["text"].strip(),
                    "start": round(c["timestamp"][0] - bite_start, 3),
                    "end": round(c["timestamp"][1] - bite_start, 3),
                })
        out = BITES / f"{b['label']}.captions.json"
        out.write_text(json.dumps(words, indent=2))
        print(f"  {b['label']:35s} {len(words)} words")


if __name__ == "__main__":
    main()
