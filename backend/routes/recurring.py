"""Recurring orders scheduler.

Workshops can schedule a list of items to be auto-placed every N days
(weekly, biweekly, monthly, custom). A background task running every
hour scans `recurring_orders` collection for `next_run_at <= now` and:
  1. Creates a real order against the workshop's KYC + credit limits.
  2. Updates next_run_at = next_run_at + cadence_days.
  3. Logs success/failure in `recurring_runs`.

Workshops can pause, resume, edit, or delete schedules. A single
"run now" endpoint lets them trigger a one-off catch-up if the worker
is sleeping.

Notes:
- The worker is started in core.py (see startup hook).
- Order placement reuses the same logic as POST /orders to keep
  pricing, MOQ, credit-check rules in sync. We import lazily from
  routes.orders to avoid circular imports.
"""

import asyncio
import uuid
from datetime import datetime, timezone, timedelta

from fastapi import HTTPException, Request
from pydantic import BaseModel
from typing import List

from core import api_router, db, logger, require_user, tier_price, calc_discount
from notifications import notify_order_placed
from routes.insights import evaluate_and_apply_auto_upgrade


CADENCE_DAYS = {"weekly": 7, "biweekly": 14, "monthly": 30}


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _compute_next_run(start_at_iso: str, cadence_days: int) -> str:
    """Anchor next run to start_at. cadence_days must be > 0."""
    base = datetime.fromisoformat(start_at_iso.replace("Z", "+00:00"))
    if base.tzinfo is None:
        base = base.replace(tzinfo=timezone.utc)
    now = _now()
    if base > now:
        return base.isoformat()
    # Roll forward
    while base <= now:
        base += timedelta(days=cadence_days)
    return base.isoformat()


# ============= Models =============
class RecurringItem(BaseModel):
    product_id: str
    quantity: int


class RecurringCreate(BaseModel):
    name: str = ""
    items: List[RecurringItem]
    cadence: str = "monthly"   # weekly | biweekly | monthly | custom
    cadence_days: int = 0      # required when cadence == "custom"
    payment_method: str        # credit | cod
    shipping_address: str
    notes: str = ""
    starts_at: str = ""        # ISO; defaults to now+1day


class RecurringUpdate(BaseModel):
    name: str = ""
    cadence: str = ""
    cadence_days: int = 0
    payment_method: str = ""
    shipping_address: str = ""
    notes: str = ""
    is_active: bool = True


def _resolve_cadence(cadence: str, cadence_days: int) -> int:
    if cadence in CADENCE_DAYS:
        return CADENCE_DAYS[cadence]
    if cadence == "custom" and cadence_days > 0:
        return cadence_days
    raise HTTPException(400, "Invalid cadence. Use weekly|biweekly|monthly|custom (with cadence_days>0)")


# ============= Routes =============
@api_router.post("/recurring")
async def create_recurring(payload: RecurringCreate, request: Request):
    user = await require_user(request)
    ws = await db.workshops.find_one({"user_id": user["user_id"]}, {"_id": 0})
    if not ws:
        raise HTTPException(403, "Workshop only")
    if not payload.items:
        raise HTTPException(400, "At least one item required")
    if payload.payment_method not in ("credit", "cod"):
        raise HTTPException(400, "payment_method must be 'credit' or 'cod'")

    cad_days = _resolve_cadence(payload.cadence, payload.cadence_days)

    starts_at = payload.starts_at
    if not starts_at:
        starts_at = (_now() + timedelta(days=1)).isoformat()

    rid = f"rec_{uuid.uuid4().hex[:10]}"
    doc = {
        "recurring_id": rid,
        "user_id": user["user_id"],
        "workshop_id": ws["workshop_id"],
        "name": payload.name or f"Schedule · {payload.cadence}",
        "items": [it.model_dump() for it in payload.items],
        "cadence": payload.cadence if payload.cadence in CADENCE_DAYS else "custom",
        "cadence_days": cad_days,
        "payment_method": payload.payment_method,
        "shipping_address": payload.shipping_address,
        "notes": payload.notes,
        "is_active": True,
        "starts_at": starts_at,
        "next_run_at": starts_at,
        "last_run_at": None,
        "last_run_status": "",
        "last_run_order_id": "",
        "run_count": 0,
        "created_at": _now().isoformat(),
    }
    await db.recurring_orders.insert_one(dict(doc))
    doc.pop("_id", None)
    return doc


@api_router.get("/recurring")
async def list_recurring(request: Request):
    user = await require_user(request)
    items = await db.recurring_orders.find(
        {"user_id": user["user_id"]}, {"_id": 0},
    ).sort("created_at", -1).to_list(200)
    return items


@api_router.patch("/recurring/{recurring_id}")
async def update_recurring(recurring_id: str, payload: RecurringUpdate, request: Request):
    user = await require_user(request)
    rec = await db.recurring_orders.find_one(
        {"recurring_id": recurring_id, "user_id": user["user_id"]}, {"_id": 0},
    )
    if not rec:
        raise HTTPException(404, "Schedule not found")
    update: dict = {}
    if payload.name:
        update["name"] = payload.name
    if payload.cadence:
        cad_days = _resolve_cadence(payload.cadence, payload.cadence_days or rec["cadence_days"])
        update["cadence"] = payload.cadence if payload.cadence in CADENCE_DAYS else "custom"
        update["cadence_days"] = cad_days
    if payload.payment_method:
        if payload.payment_method not in ("credit", "cod"):
            raise HTTPException(400, "payment_method must be 'credit' or 'cod'")
        update["payment_method"] = payload.payment_method
    if payload.shipping_address:
        update["shipping_address"] = payload.shipping_address
    if payload.notes:
        update["notes"] = payload.notes
    update["is_active"] = bool(payload.is_active)
    await db.recurring_orders.update_one({"recurring_id": recurring_id}, {"$set": update})
    return await db.recurring_orders.find_one({"recurring_id": recurring_id}, {"_id": 0})


@api_router.delete("/recurring/{recurring_id}")
async def delete_recurring(recurring_id: str, request: Request):
    user = await require_user(request)
    res = await db.recurring_orders.delete_one(
        {"recurring_id": recurring_id, "user_id": user["user_id"]}
    )
    if res.deleted_count == 0:
        raise HTTPException(404, "Not found")
    return {"ok": True}


@api_router.post("/recurring/{recurring_id}/run-now")
async def run_now(recurring_id: str, request: Request):
    """Manually trigger this schedule. Useful when the worker is sleeping or
    the workshop wants to fast-forward without waiting."""
    user = await require_user(request)
    rec = await db.recurring_orders.find_one(
        {"recurring_id": recurring_id, "user_id": user["user_id"]}, {"_id": 0},
    )
    if not rec:
        raise HTTPException(404, "Schedule not found")
    result = await _execute_schedule(rec, manual=True)
    return result


# ============= Execution engine =============
async def _execute_schedule(rec: dict, manual: bool = False) -> dict:
    """Place a real order from a recurring schedule. Reuses pricing rules."""
    user = await db.users.find_one({"user_id": rec["user_id"]}, {"_id": 0})
    ws = await db.workshops.find_one({"user_id": rec["user_id"]}, {"_id": 0})
    run_log = {
        "log_id": f"rrun_{uuid.uuid4().hex[:10]}",
        "recurring_id": rec["recurring_id"],
        "user_id": rec["user_id"],
        "manual": manual,
        "started_at": _now().isoformat(),
    }

    if not user or not ws:
        run_log["status"] = "failed"
        run_log["error"] = "Workshop or user record missing"
        await db.recurring_runs.insert_one(dict(run_log))
        return run_log

    if ws.get("kyc_status") != "approved":
        run_log["status"] = "skipped"
        run_log["error"] = "KYC not approved"
        await db.recurring_runs.insert_one(dict(run_log))
        await db.recurring_orders.update_one(
            {"recurring_id": rec["recurring_id"]},
            {"$set": {"last_run_status": "skipped: kyc not approved",
                      "last_run_at": _now().isoformat()}},
        )
        return run_log

    tier = ws.get("pricing_tier", "silver")
    total = 0.0
    cost_total = 0.0
    line_items = []
    skip_reason = None

    for ci in rec.get("items", []):
        p = await db.products.find_one({"product_id": ci["product_id"]}, {"_id": 0})
        if not p:
            skip_reason = f"Product {ci['product_id']} no longer exists"
            break
        qty = max(int(ci.get("quantity", 1)), int(p.get("moq", 1)))
        unit_price = tier_price(p["price_bdt"], tier)
        line_total = unit_price * qty
        cost_total += p.get("cost_price_bdt", 0.0) * qty
        total += line_total
        line_items.append({
            "product_id": p["product_id"], "name": p["name"], "sku": p["sku"],
            "image_url": p.get("image_url", ""), "price_bdt": unit_price,
            "retail_price_bdt": p["price_bdt"], "cost_price_bdt": p.get("cost_price_bdt", 0.0),
            "quantity": qty, "line_total": line_total,
        })

    if skip_reason:
        run_log["status"] = "failed"
        run_log["error"] = skip_reason
        await db.recurring_runs.insert_one(dict(run_log))
        await db.recurring_orders.update_one(
            {"recurring_id": rec["recurring_id"]},
            {"$set": {"last_run_status": f"failed: {skip_reason}",
                      "last_run_at": _now().isoformat()}},
        )
        return run_log

    discount_pct, discount_amount, tier_label = calc_discount(total)
    grand_total = round(total - discount_amount, 2)

    if rec["payment_method"] == "credit":
        available = (ws.get("credit_limit", 0) - ws.get("credit_used", 0))
        if grand_total > available:
            run_log["status"] = "failed"
            run_log["error"] = f"Insufficient credit (need ৳{grand_total:.0f}, have ৳{available:.0f})"
            await db.recurring_runs.insert_one(dict(run_log))
            await db.recurring_orders.update_one(
                {"recurring_id": rec["recurring_id"]},
                {"$set": {"last_run_status": "failed: insufficient credit",
                          "last_run_at": _now().isoformat()}},
            )
            return run_log

    order_id = f"ORD-{datetime.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
    now = _now()
    due_date = (now + timedelta(days=30)).isoformat() if rec["payment_method"] == "credit" else None
    order = {
        "order_id": order_id,
        "user_id": rec["user_id"],
        "workshop_id": ws["workshop_id"],
        "company_name": ws.get("company_name", ""),
        "pricing_tier": tier,
        "items": line_items,
        "subtotal_bdt": total,
        "cost_total_bdt": cost_total,
        "discount_pct": discount_pct,
        "discount_amount_bdt": discount_amount,
        "discount_label": tier_label,
        "total_bdt": grand_total,
        "profit_bdt": round(grand_total - cost_total, 2),
        "payment_method": rec["payment_method"],
        "payment_status": "unpaid",
        "due_date": due_date,
        "shipping_address": rec["shipping_address"],
        "notes": (rec.get("notes") or "") + " · auto-placed by recurring schedule",
        "status": "placed",
        "status_history": [{"status": "placed", "at": now.isoformat(),
                            "note": f"Auto-placed by recurring schedule {rec['recurring_id']}"}],
        "source": "recurring",
        "recurring_id": rec["recurring_id"],
        "created_at": now.isoformat(),
    }
    await db.orders.insert_one(dict(order))
    if rec["payment_method"] == "credit":
        await db.workshops.update_one(
            {"workshop_id": ws["workshop_id"]},
            {"$inc": {"credit_used": grand_total}},
        )
    try:
        notify_order_placed(order, user.get("email", ""))
    except Exception as e:
        logger.warning(f"Recurring notify failed: {e}")
    try:
        await evaluate_and_apply_auto_upgrade(rec["user_id"])
    except Exception as e:
        logger.warning(f"Recurring auto-upgrade eval failed: {e}")

    # Advance the schedule
    next_run = _compute_next_run(rec.get("next_run_at") or now.isoformat(), rec["cadence_days"])
    await db.recurring_orders.update_one(
        {"recurring_id": rec["recurring_id"]},
        {
            "$set": {
                "last_run_at": now.isoformat(),
                "last_run_status": "ok",
                "last_run_order_id": order_id,
                "next_run_at": next_run,
            },
            "$inc": {"run_count": 1},
        },
    )
    run_log["status"] = "ok"
    run_log["order_id"] = order_id
    run_log["total_bdt"] = grand_total
    run_log["next_run_at"] = next_run
    await db.recurring_runs.insert_one(dict(run_log))
    return run_log


async def recurring_worker_loop(interval_seconds: int = 3600):
    """Background loop. Started once at app startup. Sleeps `interval_seconds`
    between scans. On each tick, finds active schedules due now and runs them."""
    logger.info(f"Recurring worker started (interval={interval_seconds}s)")
    while True:
        try:
            now_iso = _now().isoformat()
            cursor = db.recurring_orders.find(
                {"is_active": True, "next_run_at": {"$lte": now_iso}},
                {"_id": 0},
            )
            async for rec in cursor:
                try:
                    await _execute_schedule(rec)
                except Exception as e:
                    logger.error(f"Recurring run errored for {rec.get('recurring_id')}: {e}")
        except Exception as e:
            logger.error(f"Recurring worker tick failed: {e}")
        await asyncio.sleep(interval_seconds)


def start_recurring_worker():
    """Fire-and-forget. Called from the FastAPI startup event."""
    try:
        loop = asyncio.get_event_loop()
        loop.create_task(recurring_worker_loop())
        logger.info("Recurring worker scheduled")
    except Exception as e:
        logger.warning(f"Could not start recurring worker: {e}")
