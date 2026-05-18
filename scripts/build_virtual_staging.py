#!/usr/bin/env python3
"""
Producer: virtual_staging
Output: Replicate-backed AI staging using adirik/interior-design.
Falls back gracefully if REPLICATE_API_TOKEN is missing or prediction fails.
"""
import sys
import os
import json
import time
import base64
import urllib.request
import urllib.error
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from _producer_lib import (
    NAVY, CREAM, INK, WHITE, font, text_w, draw_centered, wrap_text,
    load_payload, load_hero, round_to_thousand, add_scrim,
    write_citations, write_provenance, write_scorecard, write_card_json,
    grep_banned, REPO_ROOT,
)
from PIL import Image, ImageDraw
import datetime

PRODUCER = "virtual_staging"

MODEL = "adirik/interior-design"
MODEL_VERSION = None  # use latest

STAGING_PROMPT = (
    "warm contemporary interior, with sofa, area rug, framed wall art, floor lamp, "
    "natural light, clean and uncluttered"
)
GUIDANCE_SCALE = 15
POLL_INTERVAL = 8
MAX_WAIT = 180  # seconds


def _api_call(url: str, data=None, token: str = "") -> dict:
    """Simple urllib POST/GET wrapper — no external deps."""
    body = json.dumps(data).encode() if data else None
    headers = {
        "Authorization": f"Token {token}",
        "Content-Type": "application/json",
    }
    req = urllib.request.Request(url, data=body, headers=headers,
                                  method="POST" if body else "GET")
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode())


def _image_to_data_uri(path: Path) -> str:
    data = base64.b64encode(path.read_bytes()).decode()
    return f"data:image/jpeg;base64,{data}"


def _download(url: str, dest: Path):
    urllib.request.urlretrieve(url, dest)


def build(payload: dict, out_dir: Path):
    listing = payload["listing"]
    broker = payload["brokers"]["matt_ryan"]
    hero_path_str = payload["brand_assets"]["hero_photo_path"]

    token = os.environ.get("REPLICATE_API_TOKEN", "")

    # Save input photo first
    hero_img = load_hero(payload, 1080, 720)
    input_path = out_dir / "input.jpg"
    hero_img.save(input_path, "JPEG", quality=92)
    print(f"✓ wrote {input_path}")

    # Write disclosure
    disclosure = (
        "AI virtual staging.\n\n"
        "The original room is unchanged. Per NAR ethics, this image is labeled "
        "VIRTUALLY STAGED in all surfaces it appears.\n\n"
        f"Model: Replicate adirik/interior-design\n"
        f"Prompt: {STAGING_PROMPT}\n"
        f"Generated: {datetime.datetime.utcnow().isoformat()}Z\n"
    )
    disc_path = out_dir / "disclosure.md"
    disc_path.write_text(disclosure)
    print(f"✓ wrote {disc_path}")

    if not token:
        # Fallback: copy input as output + status file
        import shutil
        staged_path = out_dir / "staged.jpg"
        shutil.copy(input_path, staged_path)
        status = {
            "status": "placeholder",
            "reason": "REPLICATE_API_TOKEN not set — input photo copied as staged placeholder",
            "generated_at": datetime.datetime.utcnow().isoformat() + "Z",
        }
        (out_dir / "status.json").write_text(json.dumps(status, indent=2))
        print(f"✓ wrote {out_dir}/staged.jpg (placeholder — REPLICATE_API_TOKEN missing)")
        print(f"✓ wrote {out_dir}/status.json")
        _write_sidecars(out_dir, listing, broker, payload, success=False, note="API key missing")
        return

    # Attempt Replicate call
    try:
        # Convert input to data URI (avoids needing a public URL)
        image_uri = _image_to_data_uri(input_path)

        prediction_data = {
            "version": MODEL_VERSION,
            "input": {
                "image": image_uri,
                "prompt": STAGING_PROMPT,
                "guidance_scale": GUIDANCE_SCALE,
            },
        }
        # Use model shorthand endpoint
        url = f"https://api.replicate.com/v1/models/{MODEL}/predictions"

        print(f"  Submitting prediction to Replicate ({MODEL})...")
        result = _api_call(url, prediction_data, token)
        prediction_id = result.get("id")
        if not prediction_id:
            raise ValueError(f"No prediction ID in response: {result}")

        # Poll for completion
        poll_url = f"https://api.replicate.com/v1/predictions/{prediction_id}"
        elapsed = 0
        while elapsed < MAX_WAIT:
            time.sleep(POLL_INTERVAL)
            elapsed += POLL_INTERVAL
            status_resp = _api_call(poll_url, token=token)
            status = status_resp.get("status")
            print(f"  [{elapsed}s] status={status}")
            if status == "succeeded":
                output = status_resp.get("output")
                if isinstance(output, list) and output:
                    output_url = output[0]
                elif isinstance(output, str):
                    output_url = output
                else:
                    raise ValueError(f"Unexpected output format: {output}")
                staged_path = out_dir / "staged.jpg"
                _download(output_url, staged_path)
                print(f"✓ wrote {staged_path}")
                (out_dir / "status.json").write_text(json.dumps({
                    "status": "succeeded",
                    "prediction_id": prediction_id,
                    "output_url": output_url,
                    "generated_at": datetime.datetime.utcnow().isoformat() + "Z",
                }, indent=2))
                print(f"✓ wrote {out_dir}/status.json")
                _write_sidecars(out_dir, listing, broker, payload, success=True, note="Replicate adirik/interior-design")
                return
            elif status in ("failed", "canceled"):
                error = status_resp.get("error", "unknown error")
                raise RuntimeError(f"Prediction {status}: {error}")

        # Timeout
        raise TimeoutError(f"Prediction did not complete in {MAX_WAIT}s")

    except Exception as exc:
        # Graceful fallback
        import shutil
        staged_path = out_dir / "staged.jpg"
        if not staged_path.exists():
            shutil.copy(input_path, staged_path)
        status = {
            "status": "error",
            "error": str(exc),
            "fallback": "input photo copied as staged placeholder",
            "generated_at": datetime.datetime.utcnow().isoformat() + "Z",
        }
        (out_dir / "status.json").write_text(json.dumps(status, indent=2))
        print(f"WARNING: Replicate failed ({exc}) — using input as placeholder")
        print(f"✓ wrote {out_dir}/staged.jpg (placeholder)")
        print(f"✓ wrote {out_dir}/status.json")
        _write_sidecars(out_dir, listing, broker, payload, success=False, note=str(exc))


def _write_sidecars(out_dir, listing, broker, payload, success: bool, note: str):
    write_citations(out_dir, [
        {"figure": "input_photo", "source": payload["brand_assets"]["hero_photo_path"],
         "license": "listing photo — owner permission required for AI staging"},
        {"figure": "staging_model", "source": "Replicate adirik/interior-design",
         "prompt": STAGING_PROMPT},
    ])
    write_provenance(out_dir, [
        {"asset": "input_photo", "path": payload["brand_assets"]["hero_photo_path"], "license": "listing photo"},
        {"asset": "staged_output", "source": "Replicate adirik/interior-design",
         "license": "AI-generated — mark VIRTUALLY STAGED per NAR ethics"},
    ])
    write_scorecard(out_dir, [
        {"name": "input_photo_saved", "pass": (out_dir / "input.jpg").exists()},
        {"name": "staged_photo_saved", "pass": (out_dir / "staged.jpg").exists()},
        {"name": "disclosure_written", "pass": (out_dir / "disclosure.md").exists()},
        {"name": "status_json_written", "pass": (out_dir / "status.json").exists()},
        {"name": "replicate_success", "pass": success, "notes": note},
    ])
    write_card_json(out_dir, PRODUCER, "staged.jpg",
                    f"AI virtual staging for {listing['street_number']} {listing['street_name']} — {note}",
                    ["Replicate adirik/interior-design", payload["brand_assets"]["hero_photo_path"]],
                    artifacts=["input.jpg", "staged.jpg", "disclosure.md", "status.json"])
    print(f"✓ wrote {out_dir}/citations.json provenance.json design_scorecard.json card.json")


if __name__ == "__main__":
    payload, _ = load_payload()
    target_slug = payload.get("target_slug", "default")
    out_dir = REPO_ROOT / "out" / PRODUCER / target_slug
    out_dir.mkdir(parents=True, exist_ok=True)
    build(payload, out_dir)
