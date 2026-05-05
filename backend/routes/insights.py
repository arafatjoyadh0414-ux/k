"""Workshop Insights, Joy Score, and Auto-Tier-Upgrade engine.

Self-contained: all dependencies imported from `core`. Exposes
`evaluate_and_apply_auto_upgrade` for use by order-placement and
KYC-approval handlers in other route modules.
"""

import uuid
from datetime import datetime, timezone

from core import api_router, db, require_user, require_admin
from fastapi import HTTPException, Request


# ============= Joy Score =============
def _compute_joy_score(metrics: dict) -> dict:
    """Proprietary credit-rating based on order count, frequency, on-time
    payments, KYC, and credit utilization. Returns 0-100 score + grade +
    drivers."""
    orders = metrics.get("orders_total", 0)
    spend = metrics.get("spend_bdt_total", 0)
    on_time = metrics.get("on_time_payment_rate", 1.0)  # 0..1
    kyc_ok = 1 if metrics.get("kyc_status") == "approved" else 0
    util = metrics.get("credit_utilization", 0)  # 0..1
    months = metrics.get("active_months", 1)

    # Components (each 0-100)
    volume = min(100, orders * 4)               # 25 orders → 100
    spend_score = min(100, spend / 5000)        # 500k BDT → 100
    payment = on_time * 100
    longevity = min(100, months * 8)            # 12+ months → 100
    discipline = max(0, 100 - util * 100)       # high util → low score
    base_kyc = kyc_ok * 100

    score = round(
        0.20 * volume
        + 0.20 * spend_score
        + 0.25 * payment
        + 0.10 * longevity
        + 0.15 * discipline
        + 0.10 * base_kyc
    )
    if score >= 85:
        grade = "Anchor"
    elif score >= 70:
        grade = "Elite"
    elif score >= 50:
        grade = "Partner"
    else:
        grade = "Starter"
    return {"score": score, "grade": grade, "components": {
        "volume": round(volume), "spend": round(spend_score),
        "payment_punctuality": round(payment), "longevity": round(longevity),
        "credit_discipline": round(discipline), "kyc": base_kyc,
    }}


# ============= Auto-Tier-Upgrade Engine =============
TIER_ORDER = ["silver", "gold", "platinum"]

# Score thresholds and benefits unlocked at each grade
AUTO_UPGRADE_RULES = {
    50: {"tier": "silver",   "credit_floor_bdt": 100000,  "label": "Partner"},
    70: {"tier": "gold",     "credit_floor_bdt": 200000,  "label": "Elite"},
    85: {"tier": "platinum", "credit_floor_bdt": 500000,  "label": "Anchor"},
}


def _next_threshold(score: int):
    """Return the next score milestone above the given score, or None if at top."""
    for thresh in sorted(AUTO_UPGRADE_RULES.keys()):
        if score < thresh:
            return {"score_needed": thresh, **AUTO_UPGRADE_RULES[thresh]}
    return None


async def _gather_score_metrics(user_id: str, workshop: dict) -> dict:
    orders = await db.orders.find(
        {"user_id": user_id},
        {"_id": 0, "total_bdt": 1, "payment_method": 1,
         "payment_status": 1, "due_date": 1, "created_at": 1}
    ).to_list(1000)
    total_spend = sum(o.get("total_bdt", 0) for o in orders)
    total_orders = len(orders)

    credit_util = 0.0
    if workshop.get("credit_limit"):
        credit_util = (workshop.get("credit_used", 0) or 0) / workshop["credit_limit"]

    credit_orders = [o for o in orders if o.get("payment_method") == "credit"]
    on_time = 1.0
    if credit_orders:
        late = 0
        for o in credit_orders:
            try:
                due = o.get("due_date")
                if due and o.get("payment_status") != "paid":
                    due_dt = datetime.fromisoformat(due.replace("Z", "+00:00"))
                    if datetime.now(timezone.utc) > due_dt:
                        late += 1
            except Exception:
                pass
        on_time = max(0.0, 1.0 - late / len(credit_orders))

    months = 1
    if orders:
        try:
            sorted_orders = sorted(orders, key=lambda x: x.get("created_at", ""))
            first = datetime.fromisoformat(
                sorted_orders[0]["created_at"].replace("Z", "+00:00")
            )
            months = max(1, int((datetime.now(timezone.utc) - first).days / 30))
        except Exception:
            pass

    return {
        "orders_total": total_orders,
        "spend_bdt_total": total_spend,
        "on_time_payment_rate": on_time,
        "kyc_status": workshop.get("kyc_status", ""),
        "credit_utilization": credit_util,
        "active_months": months,
    }


async def evaluate_and_apply_auto_upgrade(user_id: str):
    """Recompute Joy Score for a workshop and apply tier/credit upgrades.
    Idempotent — never downgrades. Logs every upgrade to `tier_upgrade_log`.
    Returns upgrade details if applied, else None."""
    ws = await db.workshops.find_one({"user_id": user_id}, {"_id": 0})
    if not ws or ws.get("kyc_status") != "approved":
        return None

    metrics = await _gather_score_metrics(user_id, ws)
    joy = _compute_joy_score(metrics)
    score = joy["score"]
    grade = joy["grade"]

    # Find highest-threshold rule satisfied
    eligible = None
    for thresh in sorted(AUTO_UPGRADE_RULES.keys()):
        if score >= thresh:
            eligible = {"score_threshold": thresh, **AUTO_UPGRADE_RULES[thresh]}

    update = {"joy_score": score, "joy_grade": grade,
              "joy_score_at": datetime.now(timezone.utc).isoformat()}
    upgraded = None

    if eligible:
        cur_tier = (ws.get("pricing_tier") or "silver").lower()
        cur_idx = TIER_ORDER.index(cur_tier) if cur_tier in TIER_ORDER else -1
        new_idx = TIER_ORDER.index(eligible["tier"])
        cur_credit = ws.get("credit_limit") or 0
        target_credit = eligible["credit_floor_bdt"]

        new_tier = cur_tier
        new_credit = cur_credit
        if new_idx > cur_idx:
            new_tier = eligible["tier"]
            update["pricing_tier"] = new_tier
        if target_credit > cur_credit:
            new_credit = target_credit
            update["credit_limit"] = new_credit

        if new_tier != cur_tier or new_credit != cur_credit:
            upgraded = {
                "from_tier": cur_tier,
                "to_tier": new_tier,
                "from_credit_bdt": cur_credit,
                "to_credit_bdt": new_credit,
                "score": score,
                "grade": grade,
            }
            # Audit log
            await db.tier_upgrade_log.insert_one(dict({
                "log_id": f"tup_{uuid.uuid4().hex[:10]}",
                "user_id": user_id,
                "workshop_id": ws["workshop_id"],
                "company_name": ws.get("company_name", ""),
                "score": score, "grade": grade,
                "from_tier": cur_tier, "to_tier": new_tier,
                "from_credit_bdt": cur_credit, "to_credit_bdt": new_credit,
                "trigger": "auto",
                "created_at": datetime.now(timezone.utc).isoformat(),
            }))

    await db.workshops.update_one({"user_id": user_id}, {"$set": update})
    return upgraded


# ============= Routes =============
@api_router.get("/admin/tier-upgrades")
async def admin_list_tier_upgrades(request: Request, limit: int = 100):
    await require_admin(request)
    items = await db.tier_upgrade_log.find(
        {}, {"_id": 0}
    ).sort("created_at", -1).to_list(min(limit, 500))
    return items


@api_router.get("/workshop/insights")
async def workshop_insights(request: Request):
    user = await require_user(request)
    ws = await db.workshops.find_one({"user_id": user["user_id"]}, {"_id": 0})
    if not ws:
        raise HTTPException(403, "Workshop only")

    orders = await db.orders.find({"user_id": user["user_id"]}, {"_id": 0}).to_list(1000)

    # Aggregate
    total_spend = sum(o.get("total_bdt", 0) for o in orders)
    total_orders = len(orders)
    discount_saved = sum(o.get("discount_amount_bdt", 0) for o in orders)
    last_order_date = orders[0]["created_at"] if orders else None

    # Top SKUs
    sku_count = {}
    sku_label = {}
    for o in orders:
        for it in o.get("items", []):
            k = it.get("sku", "unknown")
            sku_count[k] = sku_count.get(k, 0) + it.get("quantity", 0)
            sku_label[k] = it.get("name", k)
    top_skus = sorted(sku_count.items(), key=lambda x: -x[1])[:6]

    # Monthly spend (last 6 months)
    monthly = {}
    for o in orders:
        d = (o.get("created_at") or "")[:7]
        if d:
            monthly[d] = monthly.get(d, 0) + o.get("total_bdt", 0)
    monthly_list = sorted(
        [{"month": m, "spend": round(s)} for m, s in monthly.items()],
        key=lambda x: x["month"]
    )[-6:]

    # Reorder cadence per SKU (predictive nudge)
    sku_dates = {}
    for o in sorted(orders, key=lambda x: x.get("created_at", "")):
        for it in o.get("items", []):
            sku = it.get("sku")
            if sku:
                sku_dates.setdefault(sku, []).append(o["created_at"])
    nudges = []
    now = datetime.now(timezone.utc)
    for sku, dates in sku_dates.items():
        if len(dates) < 2:
            continue
        deltas = []
        for i in range(1, len(dates)):
            try:
                a = datetime.fromisoformat(dates[i].replace("Z", "+00:00"))
                b = datetime.fromisoformat(dates[i-1].replace("Z", "+00:00"))
                deltas.append((a - b).days)
            except Exception:
                pass
        if not deltas:
            continue
        avg_gap = sum(deltas) / len(deltas)
        try:
            last = datetime.fromisoformat(dates[-1].replace("Z", "+00:00"))
            since_last = (now - last).days
        except Exception:
            continue
        if avg_gap > 0 and since_last >= avg_gap * 0.85:
            nudges.append({
                "sku": sku,
                "name": sku_label.get(sku, sku),
                "avg_days": round(avg_gap),
                "days_since_last": since_last,
                "due_factor": round(since_last / avg_gap, 2),
            })
    nudges.sort(key=lambda x: -x["due_factor"])

    # Joy Score inputs
    credit_util = 0.0
    if ws.get("credit_limit"):
        credit_util = (ws.get("credit_used", 0) or 0) / ws["credit_limit"]
    credit_orders = [o for o in orders if o.get("payment_method") == "credit"]
    on_time = 1.0
    if credit_orders:
        late = 0
        for o in credit_orders:
            try:
                due = o.get("due_date")
                if due and o.get("payment_status") != "paid":
                    due_dt = datetime.fromisoformat(due.replace("Z", "+00:00"))
                    if datetime.now(timezone.utc) > due_dt:
                        late += 1
            except Exception:
                pass
        on_time = max(0.0, 1.0 - late / len(credit_orders))

    if orders:
        try:
            first = datetime.fromisoformat(orders[-1]["created_at"].replace("Z", "+00:00"))
            months = max(1, int((now - first).days / 30))
        except Exception:
            months = 1
    else:
        months = 0

    joy = _compute_joy_score({
        "orders_total": total_orders,
        "spend_bdt_total": total_spend,
        "on_time_payment_rate": on_time,
        "kyc_status": ws.get("kyc_status", ""),
        "credit_utilization": credit_util,
        "active_months": months,
    })

    return {
        "summary": {
            "total_orders": total_orders,
            "total_spend_bdt": round(total_spend),
            "discount_saved_bdt": round(discount_saved),
            "last_order_at": last_order_date,
            "active_months": months,
            "tier": ws.get("pricing_tier", "silver"),
            "credit_limit": ws.get("credit_limit", 0),
            "credit_used": ws.get("credit_used", 0),
            "credit_utilization_pct": round(credit_util * 100),
        },
        "monthly_spend": monthly_list,
        "top_skus": [{"sku": k, "name": sku_label.get(k, k), "qty": v} for k, v in top_skus],
        "reorder_nudges": nudges[:6],
        "joy_score": joy,
        "next_threshold": _next_threshold(joy["score"]),
    }
