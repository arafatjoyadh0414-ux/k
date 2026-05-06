"""Periodic low-stock scanner.

Runs once at startup + every 30 minutes. For each product where
stock <= low_stock_threshold (default 5) and we haven't alerted about
it in the last 24h, push a notification to every workshop that has
ordered that SKU in the last 90 days.

Alerts are deduplicated via the `low_stock_alerts` collection (sku, last_alerted_at).
"""

import asyncio
from datetime import datetime, timedelta, timezone
from typing import List

from core import db, logger


LOW_STOCK_THRESHOLD = 5
ALERT_COOLDOWN_HOURS = 24
SCAN_INTERVAL_SECONDS = 30 * 60  # 30 min


async def _scan_once() -> int:
    from routes.push import send_push_to_user

    cutoff = (datetime.now(timezone.utc) - timedelta(hours=ALERT_COOLDOWN_HOURS)).isoformat()
    pushed_total = 0

    # Find low-stock products (stock > 0 to avoid noise on permanently OOS items)
    async for prod in db.products.find(
        {"stock": {"$gt": 0, "$lte": LOW_STOCK_THRESHOLD}},
        {"_id": 0, "sku": 1, "name": 1, "stock": 1},
    ):
        sku = prod["sku"]
        last = await db.low_stock_alerts.find_one({"sku": sku}, {"_id": 0, "last_alerted_at": 1})
        if last and last.get("last_alerted_at", "") > cutoff:
            continue

        # Find recent buyers of this SKU (last 90 days)
        recent_cutoff = (datetime.now(timezone.utc) - timedelta(days=90)).isoformat()
        buyer_ids = set()
        async for o in db.orders.find(
            {"items.sku": sku, "created_at": {"$gte": recent_cutoff},
             "status": {"$nin": ["cancelled"]}},
            {"_id": 0, "user_id": 1, "workshop_id": 1},
        ).limit(50):
            if o.get("user_id"):
                buyer_ids.add(o["user_id"])
            # Also include workshop members
            if o.get("workshop_id"):
                ws = await db.workshops.find_one({"workshop_id": o["workshop_id"]},
                                                  {"_id": 0, "user_id": 1, "member_user_ids": 1})
                if ws:
                    if ws.get("user_id"):
                        buyer_ids.add(ws["user_id"])
                    for m in ws.get("member_user_ids") or []:
                        buyer_ids.add(m)

        if not buyer_ids:
            continue

        title = "⚠️ Low stock alert"
        body = f"{prod['name']} — only {prod['stock']} left in stock"
        url = f"/products?search={sku}"
        for uid in buyer_ids:
            try:
                pushed_total += await send_push_to_user(uid, title=title, body=body, url=url, tag=f"low-stock-{sku}", category="low_stock")
            except Exception as e:  # noqa
                logger.warning(f"low-stock push failed for {uid}/{sku}: {e}")

        await db.low_stock_alerts.update_one(
            {"sku": sku},
            {"$set": {
                "sku": sku,
                "stock_at_alert": prod["stock"],
                "buyers_notified": len(buyer_ids),
                "last_alerted_at": datetime.now(timezone.utc).isoformat(),
            }},
            upsert=True,
        )
    return pushed_total


async def _worker_loop():
    # Initial 30s grace period to let the app warm up
    await asyncio.sleep(30)
    while True:
        try:
            sent = await _scan_once()
            if sent:
                logger.info(f"low-stock scan: pushed {sent} notifications")
        except Exception as e:
            logger.warning(f"low-stock scan crashed: {e}")
        await asyncio.sleep(SCAN_INTERVAL_SECONDS)


def start_low_stock_worker():
    asyncio.create_task(_worker_loop())
