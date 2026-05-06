"""Worldwide automotive news ticker — Google News RSS, no API keys required.

Refreshes every 1 hour (in-memory cache + DB fallback). Returns up to 12
cleaned headlines (title + source) for the live ticker on the landing page.
"""

import asyncio
import re
import time
import urllib.parse
from datetime import datetime, timezone, timedelta
from typing import List, Optional
from xml.etree import ElementTree as ET

import requests
from fastapi import HTTPException

from core import api_router, db, logger

# --- Config ---
CACHE_TTL_SECONDS = 60 * 60  # 1 hour as the user requested
MAX_ITEMS = 12
GOOGLE_NEWS_TOPIC = "automotive industry"  # broad worldwide queries
GOOGLE_NEWS_RSS = (
    "https://news.google.com/rss/search?"
    "q=" + urllib.parse.quote(GOOGLE_NEWS_TOPIC + " when:1d") +
    "&hl=en-US&gl=US&ceid=US:en"
)
HTTP_TIMEOUT = 8

# In-memory cache. Backed up to db.cars_news_cache for persistence across restarts.
_CACHE: dict = {"at": 0.0, "items": [], "fetched_at": None}


def _strip_html(text: str) -> str:
    if not text:
        return ""
    cleaned = re.sub(r"<[^>]+>", "", text)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    return cleaned


def _parse_source(title: str, raw_source: str) -> tuple[str, str]:
    """Google News titles look like 'Headline - Source'. Split heuristically."""
    if raw_source:
        return title.strip(), raw_source.strip()
    parts = title.rsplit(" - ", 1)
    if len(parts) == 2 and 2 <= len(parts[1]) <= 40:
        return parts[0].strip(), parts[1].strip()
    return title.strip(), ""


def _fetch_google_news() -> List[dict]:
    """Synchronously fetch + parse Google News RSS. Pure function; safe to run in executor."""
    r = requests.get(
        GOOGLE_NEWS_RSS,
        headers={"User-Agent": "JoyAutomart-NewsTicker/1.0"},
        timeout=HTTP_TIMEOUT,
    )
    r.raise_for_status()
    root = ET.fromstring(r.content)
    items = []
    for item in root.iter("item"):
        title_raw = (item.findtext("title") or "").strip()
        if not title_raw:
            continue
        source_el = item.find("source")
        source_raw = (source_el.text if source_el is not None else "") or ""
        title, source = _parse_source(_strip_html(title_raw), source_raw)
        link = (item.findtext("link") or "").strip() or None
        pub = (item.findtext("pubDate") or "").strip() or None
        if not title or len(title) < 8:
            continue
        items.append({"title": title, "source": source, "link": link, "pub_date": pub})
        if len(items) >= MAX_ITEMS:
            break
    return items


async def _refresh_cache(force: bool = False) -> dict:
    """Refresh news cache if stale. Returns the cache dict."""
    now = time.time()
    if not force and _CACHE["items"] and (now - _CACHE["at"]) < CACHE_TTL_SECONDS:
        return _CACHE
    try:
        loop = asyncio.get_event_loop()
        items = await loop.run_in_executor(None, _fetch_google_news)
        if items:
            _CACHE["items"] = items
            _CACHE["at"] = now
            _CACHE["fetched_at"] = datetime.now(timezone.utc).isoformat()
            # Persist for cold-start fallback
            try:
                await db.cars_news_cache.update_one(
                    {"_id": "google_news_v1"},
                    {"$set": {"items": items, "fetched_at": _CACHE["fetched_at"]}},
                    upsert=True,
                )
            except Exception as e:  # noqa
                logger.info(f"news-cache db persist skipped: {e}")
        else:
            logger.info("news-fetch returned empty; keeping previous cache")
    except Exception as e:
        logger.warning(f"news-fetch failed: {e}")
        # If memory cache is empty, try DB fallback
        if not _CACHE["items"]:
            try:
                doc = await db.cars_news_cache.find_one({"_id": "google_news_v1"}, {"_id": 0})
                if doc and doc.get("items"):
                    _CACHE["items"] = doc["items"]
                    _CACHE["fetched_at"] = doc.get("fetched_at")
                    _CACHE["at"] = now  # treat as fresh enough for now
            except Exception as e2:  # noqa
                logger.warning(f"news-cache db read failed: {e2}")
    return _CACHE


@api_router.get("/public/cars-news")
async def get_cars_news():
    """Public endpoint — returns cached worldwide automotive headlines."""
    cache = await _refresh_cache(force=False)
    return {
        "items": cache.get("items") or [],
        "fetched_at": cache.get("fetched_at"),
        "ttl_seconds": CACHE_TTL_SECONDS,
        "source": "Google News",
        "topic": GOOGLE_NEWS_TOPIC,
    }
