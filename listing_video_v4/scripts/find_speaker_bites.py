#!/usr/bin/env python3
"""Find exact start/end timestamps in transcripts for target speaker bites.

For each chosen quote (substring of transcript), report the start time of the
first matching word and end time of the last matching word. Then we can extract
those clips precisely with ffmpeg.
"""
import json
from pathlib import Path

ROOT = Path("/Users/matthewryan/RyanRealty/listing_video_v4/public/source_clips/bend_pulse/long")

# Each entry: (transcript_file, target_substring, label)
# The substring is a span we want to find inside the transcript text.
# We'll match the EARLIEST occurrence of the first 4-6 words then expand.
TARGETS = [
    # PART 1 — Cassie Lacy explaining the fee
    ("feb11_intro_to_fee", "now we're going to review some analysis", "p1_cassie_intro"),
    ("feb11_intro_to_fee", "the fee is calculated on a per appliance basis", "p1_cassie_calc"),
    ("feb11_intro_to_fee", "social cost of carbon is the monetary value of climate change damages", "p1_cassie_scc"),
    ("feb11_intro_to_fee", "two key differences are the inclusion of the tier scaling factor", "p1_cassie_ashland"),
    ("feb11_council_qna", "we are talking about new construction. We're not talking about people's existing homes", "p1_council_new_only"),
    ("feb11_council_qna", "9,000 is way too high. I'm looking at something like 20%", "p1_council_too_high"),

    # PART 2 — Council deliberation, affordability arguments
    ("feb11_fee_levels_discuss", "33% of the fee. It's not quite any of the options", "p2_council_33pct"),
    ("feb11_fee_levels_discuss", "this is being framed as a false binary choice", "p2_council_false_binary"),
    ("feb11_fee_levels_discuss", "we can walk and chew gum. We can protect affordability", "p2_council_walk_chew"),
    ("feb11_fee_levels_discuss", "53% of people that drive in to Bend every day to go to work because they cannot afford", "p2_council_53pct_commute"),
    ("feb11_council_qna", "I just want to say, like, when I have gotten into homes in Bend, I didn't have much of an energy choice", "p2_council_no_choice"),
    ("feb11_council_qna", "We are nudging. We are sending a signal", "p2_council_nudge"),

    # PART 3 — what happens next, public engagement
    ("feb11_tcep_discuss", "what should the fee level be set at?", "p3_cassie_questions"),
    ("feb11_tcep_discuss", "what exemptions should there be and what should the effective date be?", "p3_cassie_three_questions"),
    ("feb11_tcep_discuss", "stakeholder engagement to inform all of these policy decisions", "p3_cassie_stakeholder"),
    ("feb11_tcep_discuss", "temporary committee on electrification policy", "p3_cassie_tcep"),
    ("feb11_council_qna", "we need to make a decision for our community so they know what decision we've made", "p3_council_decision"),
]


def normalize(s: str) -> str:
    return s.lower().replace(",", " ").replace("'", " ").replace("?", " ").replace(".", " ").split()


def find_span(chunks, target_words):
    """Return (start_sec, end_sec, matched_text, start_idx, end_idx) for first match."""
    norm_chunks = [normalize(c["text"])[0] if normalize(c["text"]) else "" for c in chunks]
    n = len(target_words)
    for i in range(len(norm_chunks) - n + 1):
        # Try matching n target words against chunks i..i+n
        match = True
        ci = i
        for tw in target_words:
            # advance ci past empty/punct chunks
            while ci < len(norm_chunks) and norm_chunks[ci] == "":
                ci += 1
            if ci >= len(norm_chunks) or norm_chunks[ci] != tw:
                match = False
                break
            ci += 1
        if match:
            start = chunks[i]["timestamp"][0]
            # find end of last matched word
            end_idx = ci - 1
            end = chunks[end_idx]["timestamp"][1]
            text = "".join(c["text"] for c in chunks[i:end_idx + 1]).strip()
            return (start, end, text, i, end_idx)
    return None


def expand_to_natural_sentence(chunks, start_idx, end_idx, max_extra_words=30):
    """Expand the matched span outward until we hit sentence boundaries (period, etc).
    Cap at max_extra_words on each side."""
    # Walk backward from start_idx
    s = start_idx
    while s > 0 and (start_idx - s) < max_extra_words:
        prev_text = chunks[s - 1]["text"].strip()
        if prev_text.endswith(("."," .","?","!")):
            break
        s -= 1
    # Walk forward from end_idx
    e = end_idx
    while e < len(chunks) - 1 and (e - end_idx) < max_extra_words:
        cur_text = chunks[e]["text"].strip()
        if cur_text.endswith((".","?","!")):
            break
        e += 1
    return (chunks[s]["timestamp"][0], chunks[e]["timestamp"][1], s, e)


def main():
    bites = []
    for fname, target, label in TARGETS:
        path = ROOT / f"{fname}.transcript.json"
        if not path.exists():
            print(f"[skip] {path.name} missing")
            continue
        d = json.loads(path.read_text())
        chunks = d["chunks"]
        target_words = normalize(target)
        match = find_span(chunks, target_words)
        if not match:
            print(f"[NOT FOUND] {label} :: {target!r} in {fname}")
            continue
        raw_start, raw_end, raw_text, si, ei = match
        nat_start, nat_end, ns, ne = expand_to_natural_sentence(chunks, si, ei)
        full_text = "".join(c["text"] for c in chunks[ns:ne + 1]).strip()
        dur = nat_end - nat_start
        print(f"\n=== {label} ===")
        print(f"  Source: {fname}.mp3 / .mp4")
        print(f"  Raw match: t={raw_start:.2f}-{raw_end:.2f} ({raw_end-raw_start:.1f}s)")
        print(f"  Expanded:  t={nat_start:.2f}-{nat_end:.2f} ({dur:.1f}s)")
        print(f"  Text: {full_text[:280]}")
        bites.append({
            "label": label,
            "source_file": fname,
            "raw_start_sec": round(raw_start, 2),
            "raw_end_sec": round(raw_end, 2),
            "expanded_start_sec": round(nat_start, 2),
            "expanded_end_sec": round(nat_end, 2),
            "duration_sec": round(dur, 2),
            "matched_text": full_text,
        })
    out = ROOT / "bites_inventory.json"
    out.write_text(json.dumps(bites, indent=2))
    print(f"\n\nWrote {out} ({len(bites)} bites)")


if __name__ == "__main__":
    main()
