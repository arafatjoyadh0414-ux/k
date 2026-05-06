"""Worldwide automotive news ticker — Google News RSS, no API keys required.

Refreshes every 1 hour (in-memory cache + DB fallback). Returns up to ~30
fresh, deduplicated headlines from MULTIPLE global automotive queries
(industry news, EVs, Toyota, BYD, hypercars, Bangladesh auto market, etc.)
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
MAX_TOTAL_ITEMS = 30
PER_TOPIC_LIMIT = 8
HTTP_TIMEOUT = 8

# Multiple queries → diverse global automotive coverage. Each runs in parallel.
NEWS_QUERIES = [
    "automotive industry when:1d",
    "electric vehicles when:1d",
    "Toyota OR Honda OR Nissan car news when:1d",
    "BYD OR Tesla OR BMW OR Mercedes when:1d",
    "supercar OR hypercar when:1d",
    "auto parts OR aftermarket when:1d",
    "Bangladesh car market OR Dhaka automotive when:7d",
    "F1 OR motorsport when:1d",
]

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


def _fetch_one_query(query: str) -> List[dict]:
    """Synchronously fetch + parse a single Google News RSS query."""
    url = (
        "https://news.google.com/rss/search?"
        "q=" + urllib.parse.quote(query) +
        "&hl=en-US&gl=US&ceid=US:en"
    )
    try:
        r = requests.get(
            url, headers={"User-Agent": "JoyAutomart-NewsTicker/1.0"}, timeout=HTTP_TIMEOUT,
        )
        r.raise_for_status()
        root = ET.fromstring(r.content)
    except Exception as e:
        logger.info(f"news-fetch query='{query}' failed: {e}")
        return []
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
        items.append({"title": title, "source": source, "link": link, "pub_date": pub, "topic": query.split(" when:")[0]})
        if len(items) >= PER_TOPIC_LIMIT:
            break
    return items


def _fetch_all_news() -> List[dict]:
    """Run all queries (sequentially in one executor call to keep things simple),
    deduplicate by title, return up to MAX_TOTAL_ITEMS items. Round-robin across
    topics so the ticker feels diverse."""
    buckets: List[List[dict]] = []
    for q in NEWS_QUERIES:
        buckets.append(_fetch_one_query(q))

    # Round-robin merge so different topics interleave on the ticker
    seen_titles: set = set()
    out: List[dict] = []
    max_per = max(len(b) for b in buckets) if buckets else 0
    for i in range(max_per):
        for bucket in buckets:
            if i < len(bucket):
                item = bucket[i]
                key = re.sub(r"[^a-z0-9]+", "", item["title"].lower())[:80]
                if key in seen_titles:
                    continue
                seen_titles.add(key)
                out.append(item)
                if len(out) >= MAX_TOTAL_ITEMS:
                    return out
    return out


async def _refresh_cache(force: bool = False) -> dict:
    """Refresh news cache if stale. Returns the cache dict."""
    now = time.time()
    if not force and _CACHE["items"] and (now - _CACHE["at"]) < CACHE_TTL_SECONDS:
        return _CACHE
    try:
        loop = asyncio.get_event_loop()
        items = await loop.run_in_executor(None, _fetch_all_news)
        if items:
            _CACHE["items"] = items
            _CACHE["at"] = now
            _CACHE["fetched_at"] = datetime.now(timezone.utc).isoformat()
            try:
                await db.cars_news_cache.update_one(
                    {"_id": "google_news_v2"},
                    {"$set": {"items": items, "fetched_at": _CACHE["fetched_at"]}},
                    upsert=True,
                )
            except Exception as e:  # noqa
                logger.info(f"news-cache db persist skipped: {e}")
        else:
            logger.info("news-fetch returned empty; keeping previous cache")
    except Exception as e:
        logger.warning(f"news-fetch failed: {e}")
        if not _CACHE["items"]:
            try:
                doc = await db.cars_news_cache.find_one({"_id": "google_news_v2"}, {"_id": 0})
                if doc and doc.get("items"):
                    _CACHE["items"] = doc["items"]
                    _CACHE["fetched_at"] = doc.get("fetched_at")
                    _CACHE["at"] = now
            except Exception as e2:  # noqa
                logger.warning(f"news-cache db read failed: {e2}")
    return _CACHE


@api_router.get("/public/cars-news")
async def get_cars_news():
    """Public endpoint — returns cached worldwide automotive headlines."""
    cache = await _refresh_cache(force=False)
    return {
        "items": cache.get("items") or [],
        "count": len(cache.get("items") or []),
        "fetched_at": cache.get("fetched_at"),
        "ttl_seconds": CACHE_TTL_SECONDS,
        "source": "Google News",
        "topics": [q.split(" when:")[0] for q in NEWS_QUERIES],
    }


# Bangladesh-specific news — separate query for richer Dhaka coverage
BD_NEWS_QUERIES = [
    "Bangladesh car market when:7d",
    "Dhaka automotive when:7d",
    "Bangladesh BRTA OR fuel price when:7d",
    "Bangladesh Toyota OR BYD OR Mahindra when:14d",
]
_BD_CACHE: dict = {"at": 0.0, "items": [], "fetched_at": None}
BD_MAX_ITEMS = 12


def _fetch_bd_news() -> List[dict]:
    buckets: List[List[dict]] = []
    for q in BD_NEWS_QUERIES:
        buckets.append(_fetch_one_query(q))
    seen: set = set()
    out: List[dict] = []
    max_per = max(len(b) for b in buckets) if buckets else 0
    for i in range(max_per):
        for bucket in buckets:
            if i < len(bucket):
                item = bucket[i]
                key = re.sub(r"[^a-z0-9]+", "", item["title"].lower())[:80]
                if key in seen:
                    continue
                seen.add(key)
                out.append(item)
                if len(out) >= BD_MAX_ITEMS:
                    return out
    return out


async def _refresh_bd_cache(force: bool = False) -> dict:
    now = time.time()
    if not force and _BD_CACHE["items"] and (now - _BD_CACHE["at"]) < CACHE_TTL_SECONDS:
        return _BD_CACHE
    try:
        loop = asyncio.get_event_loop()
        items = await loop.run_in_executor(None, _fetch_bd_news)
        if items:
            _BD_CACHE["items"] = items
            _BD_CACHE["at"] = now
            _BD_CACHE["fetched_at"] = datetime.now(timezone.utc).isoformat()
            try:
                await db.cars_news_cache.update_one(
                    {"_id": "google_news_bd_v1"},
                    {"$set": {"items": items, "fetched_at": _BD_CACHE["fetched_at"]}},
                    upsert=True,
                )
            except Exception:
                pass
    except Exception as e:
        logger.warning(f"bd-news fetch failed: {e}")
        if not _BD_CACHE["items"]:
            try:
                doc = await db.cars_news_cache.find_one({"_id": "google_news_bd_v1"}, {"_id": 0})
                if doc and doc.get("items"):
                    _BD_CACHE["items"] = doc["items"]
                    _BD_CACHE["fetched_at"] = doc.get("fetched_at")
                    _BD_CACHE["at"] = now
            except Exception:
                pass
    return _BD_CACHE


@api_router.get("/public/cars-news/bangladesh")
async def get_bd_cars_news():
    """Public — Bangladesh-specific automotive news (refreshes every 1 hour)."""
    cache = await _refresh_bd_cache(force=False)
    return {
        "items": cache.get("items") or [],
        "count": len(cache.get("items") or []),
        "fetched_at": cache.get("fetched_at"),
        "ttl_seconds": CACHE_TTL_SECONDS,
        "topic": "Bangladesh automotive",
    }

