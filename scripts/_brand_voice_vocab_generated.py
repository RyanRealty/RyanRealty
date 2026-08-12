# GENERATED — DO NOT EDIT. Source of truth: scripts/brand-voice-vocabulary.cjs
# Regenerate: node scripts/gen-brand-voice-consumers.mjs --write
#
# The single mirror of the canonical banned vocabulary for the build_*.py
# producer fleet. Import from here (via scripts/_producer_lib.py) instead of
# hand-typing a list — ci:voice-vocab-parity fails on any drift.

PUNCTUATION_CHARS = ["—", "–", ";", "!"]

BANNED_WORD_STRINGS = [
    "what is my home worth",
    "what is your home worth",
    "what's my home worth",
    "what's your home worth",
    "whats my home worth",
    "whats your home worth",
]

BANNED_WORDS = [
    {"word": "what is my home worth", "category": "worth-cta"},
    {"word": "what is your home worth", "category": "worth-cta"},
    {"word": "what's my home worth", "category": "worth-cta"},
    {"word": "what's your home worth", "category": "worth-cta"},
    {"word": "whats my home worth", "category": "worth-cta"},
    {"word": "whats your home worth", "category": "worth-cta"},
]
