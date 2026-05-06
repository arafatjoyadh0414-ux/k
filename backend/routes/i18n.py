"""Auto-translation endpoint — Claude Sonnet 4.5 via Emergent LLM key.

Takes a list of English UI strings, returns Bengali translations.
Aggressively cached in MongoDB so each unique phrase is translated only once
across the entire user base.

Schema:
  i18n_cache: { lang, src, hash, translated, created_at }   (unique idx on (lang, hash))
"""

import hashlib
import json
import os
import re
from datetime import datetime, timezone
from typing import List

from fastapi import HTTPException
from pydantic import BaseModel

from core import api_router, db, logger
from emergentintegrations.llm.chat import LlmChat, UserMessage

EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "").strip()
SUPPORTED_LANGS = {"bn"}  # Source is always English; only Bengali for now
MAX_BATCH = 80  # strings per request — keep prompt size reasonable


class TranslateReq(BaseModel):
    lang: str  # "bn"
    texts: List[str]


def _hash(s: str) -> str:
    return hashlib.sha256(s.strip().encode("utf-8")).hexdigest()[:24]


_SYSTEM = (
    "You are a precise UI translator for a Bangladesh B2B auto parts platform "
    "called JOY Automart. Translate each English string to Bangla (Bengali). "
    "Rules:\n"
    "1. Keep brand names (JOY Automart, Toyota, BYD, Stripe, Bosch, Brembo, NHTSA, VIN, KYC, BDT, etc.) in English.\n"
    "2. Keep product SKU codes, IDs, numbers, currency symbols (৳), and dates AS-IS.\n"
    "3. Keep punctuation, ellipses, em-dashes, line breaks intact.\n"
    "4. Use natural everyday Bangla used by Dhaka workshop owners, not formal/literary Bangla.\n"
    "5. Where an automotive English term is universally used by mechanics in Bangladesh "
    "(e.g. brake, engine, oil, tyre, battery, AC, GPS, VIN), keep that English word in Latin script.\n"
    "6. Return ONLY a strict JSON array of translated strings, in the SAME ORDER as input. No prose, no keys."
)


@api_router.post("/i18n/translate")
async def translate_strings(req: TranslateReq):
    """Public endpoint — anyone visiting the site needs this. Cached aggressively."""
    if req.lang not in SUPPORTED_LANGS:
        raise HTTPException(400, f"Unsupported lang: {req.lang}")
    if not req.texts:
        return {"translations": {}}
    if not EMERGENT_LLM_KEY:
        raise HTTPException(503, "Translation service not configured")

    # Normalise + dedupe + filter trivial strings
    cleaned: List[str] = []
    seen: set = set()
    for raw in req.texts:
        if not raw or not isinstance(raw, str):
            continue
        s = raw.strip()
        if len(s) < 2 or len(s) > 600:
            continue
        # Skip if pure number/punctuation/whitespace/symbols
        if re.fullmatch(r"[\d\s\W_·•★●◆◇—–\-→←↑↓✓×]+", s):
            continue
        if s in seen:
            continue
        seen.add(s)
        cleaned.append(s)

    out: dict = {}

    # Cache lookup
    misses: List[str] = []
    for s in cleaned:
        h = _hash(s)
        doc = await db.i18n_cache.find_one({"lang": req.lang, "hash": h}, {"_id": 0, "translated": 1})
        if doc and doc.get("translated"):
            out[s] = doc["translated"]
        else:
            misses.append(s)

    # Batch translate misses
    while misses:
        batch = misses[:MAX_BATCH]
        misses = misses[MAX_BATCH:]
        try:
            chat = LlmChat(
                api_key=EMERGENT_LLM_KEY,
                session_id=f"i18n_{req.lang}_{_hash(json.dumps(batch))[:8]}",
                system_message=_SYSTEM,
            ).with_model("anthropic", "claude-sonnet-4-5-20250929")
            user_text = (
                f"Target language: Bangla (bn). Translate this JSON array. "
                f"Return ONLY a JSON array of {len(batch)} translated strings.\n\n"
                + json.dumps(batch, ensure_ascii=False)
            )
            raw = await chat.send_message(UserMessage(text=user_text))
        except Exception as e:
            logger.error(f"i18n batch translate failed: {e}")
            # Fall back to original strings — caller still gets a response
            for s in batch:
                out[s] = s
            continue

        cleaned_raw = (raw or "").strip()
        cleaned_raw = re.sub(r"^```(?:json)?\s*|\s*```$", "", cleaned_raw, flags=re.MULTILINE)
        m = re.search(r"\[.*\]", cleaned_raw, flags=re.DOTALL)
        translations: list = []
        if m:
            try:
                translations = json.loads(m.group(0))
            except Exception as e:  # noqa
                logger.warning(f"i18n JSON parse failed: {e}")
        if len(translations) != len(batch):
            logger.warning(f"i18n length mismatch: got {len(translations)} expected {len(batch)}")
            for s in batch:
                out[s] = s
            continue

        # Persist + collect
        now = datetime.now(timezone.utc).isoformat()
        for src, tgt in zip(batch, translations):
            if not isinstance(tgt, str) or not tgt.strip():
                tgt = src
            out[src] = tgt
            try:
                await db.i18n_cache.update_one(
                    {"lang": req.lang, "hash": _hash(src)},
                    {"$set": {
                        "lang": req.lang,
                        "src": src,
                        "hash": _hash(src),
                        "translated": tgt,
                        "updated_at": now,
                    }},
                    upsert=True,
                )
            except Exception as e:  # noqa
                logger.info(f"i18n cache write skipped: {e}")

    # Build the final response in the SAME shape the FE expects: { src: translated }
    return {"translations": {s: out.get(s, s) for s in cleaned}}
