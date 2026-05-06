"""Notifications service: emails (Resend) + SMS placeholder.
Gated behind env vars — no-ops gracefully if keys are missing.
"""
import os
import logging
from typing import Optional

logger = logging.getLogger(__name__)

RESEND_API_KEY = os.environ.get("RESEND_API_KEY", "").strip()
RESEND_FROM = os.environ.get("RESEND_FROM", "JOY Automart <noreply@joyautomart.com>").strip()
SMS_PROVIDER = os.environ.get("SMS_PROVIDER", "").strip().lower()  # twilio | bulksmsbd | ""
APP_URL = os.environ.get("APP_PUBLIC_URL", "").rstrip("/")

# Initialise Resend lazily
_resend_ready = False


def _ensure_resend():
    global _resend_ready
    if _resend_ready:
        return True
    if not RESEND_API_KEY:
        return False
    try:
        import resend
        resend.api_key = RESEND_API_KEY
        _resend_ready = True
        return True
    except Exception as e:
        logger.warning(f"Resend init failed: {e}")
        return False


def send_email(to: str, subject: str, html: str, text: Optional[str] = None) -> bool:
    """Send email via Resend. Returns True if delivered, False if skipped/failed."""
    if not to or not _ensure_resend():
        if not RESEND_API_KEY:
            logger.info(f"[email-skip] {to} | {subject} (RESEND_API_KEY not set)")
        return False
    try:
        import resend
        resend.Emails.send({
            "from": RESEND_FROM,
            "to": [to],
            "subject": subject,
            "html": html,
            "text": text or _strip_html(html),
        })
        logger.info(f"[email-sent] {to} | {subject}")
        return True
    except Exception as e:
        logger.warning(f"[email-fail] {to} | {subject} | {e}")
        return False


def send_sms(to: str, body: str) -> bool:
    """SMS scaffold. Currently no-op until SMS_PROVIDER is configured."""
    if not to:
        return False
    if not SMS_PROVIDER:
        logger.info(f"[sms-skip] {to} | {body[:60]} (SMS_PROVIDER not set)")
        return False
    # Future: dispatch to twilio / bulksmsbd / etc. based on SMS_PROVIDER
    logger.info(f"[sms-skip] provider={SMS_PROVIDER} not yet implemented for {to}")
    return False


def _strip_html(s: str) -> str:
    import re
    return re.sub(r"<[^>]+>", "", s)


# ============= Pre-built notification helpers =============
def _layout(title: str, body_html: str, cta_label: Optional[str] = None, cta_url: Optional[str] = None) -> str:
    cta = ""
    if cta_label and cta_url:
        cta = (
            f'<p style="margin:24px 0;"><a href="{cta_url}" '
            f'style="background:#E11D48;color:#fff;text-decoration:none;'
            f'padding:12px 22px;border-radius:4px;font-weight:600;'
            f'font-family:Helvetica,Arial,sans-serif;font-size:14px;display:inline-block;">'
            f'{cta_label}</a></p>'
        )
    return f"""<!doctype html>
<html><body style="margin:0;padding:24px;background:#f1f5f9;font-family:Helvetica,Arial,sans-serif;color:#0f172a;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:6px;overflow:hidden;">
    <div style="background:#0f172a;color:#fff;padding:16px 24px;">
      <div style="font-size:18px;font-weight:700;letter-spacing:-0.01em;">JOY Automart</div>
      <div style="font-size:11px;color:#cbd5e1;letter-spacing:0.12em;text-transform:uppercase;">B2B Workshop Portal</div>
    </div>
    <div style="padding:24px;">
      <div style="font-size:11px;color:#E11D48;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;">{title}</div>
      <div style="font-size:15px;line-height:1.55;margin-top:8px;">
        {body_html}
      </div>
      {cta}
    </div>
    <div style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:12px 24px;font-size:11px;color:#64748b;">
      JOY Automart · Bangladesh · www.joyautomart.com
    </div>
  </div>
</body></html>"""


def notify_kyc_decision(workshop: dict, email: str) -> None:
    decision = workshop.get("kyc_status", "")
    name = workshop.get("company_name") or "Workshop Owner"
    if decision == "approved":
        title = "KYC Approved"
        body = (
            f"Hi {name},<br/><br/>"
            f"Great news — your trade documents have been verified and your JOY Automart B2B account is fully active. "
            f"You can now place orders, request parts and access tier pricing."
        )
        if workshop.get("credit_limit"):
            body += f"<br/><br/>Your initial credit limit: <b>BDT {workshop['credit_limit']:,.0f}</b>."
        cta = ("Open Dashboard", f"{APP_URL}/dashboard" if APP_URL else None)
    elif decision == "rejected":
        title = "KYC Update Required"
        remark = workshop.get("kyc_remark") or "Please review and resubmit your documents."
        body = (
            f"Hi {name},<br/><br/>"
            f"We were unable to verify the documents you submitted. <b>Reason:</b> {remark}<br/><br/>"
            f"Please update and resubmit via your Profile page. Reach us anytime if you need help."
        )
        cta = ("Update Profile", f"{APP_URL}/profile" if APP_URL else None)
    else:
        return
    send_email(email, f"JOY Automart · {title}", _layout(title, body, *cta))


def notify_order_placed(order: dict, email: str) -> None:
    if not email:
        return
    name = order.get("company_name") or "Workshop"
    title = "Order received"
    items = "<br/>".join(
        f"&bull; {it.get('quantity', 1)} × {it.get('name', '')}" for it in order.get("items", [])[:8]
    )
    extra = ""
    if len(order.get("items", [])) > 8:
        extra = f"<br/>&bull; …and {len(order['items']) - 8} more"
    body = (
        f"Hi {name},<br/><br/>"
        f"We've received your order <b>{order.get('order_id')}</b>. "
        f"Total: <b>BDT {order.get('total_bdt', 0):,.0f}</b> · "
        f"{(order.get('payment_method') or '').upper()}.<br/><br/>"
        f"{items}{extra}<br/><br/>"
        f"You'll receive updates as your order moves through confirmed → packed → shipped → delivered."
    )
    cta = ("View Order", f"{APP_URL}/orders/{order.get('order_id')}" if APP_URL else None)
    send_email(email, f"JOY · Order {order.get('order_id')} received", _layout(title, body, *cta))


def notify_order_status(order: dict, email: str, new_status: str) -> None:
    if not email:
        return
    label_map = {
        "confirmed": "Order Confirmed",
        "packed":    "Order Packed",
        "shipped":   "Order Shipped",
        "delivered": "Order Delivered",
        "cancelled": "Order Cancelled",
    }
    title = label_map.get(new_status, f"Order {new_status}")
    body = (
        f"Order <b>{order.get('order_id')}</b> is now <b>{new_status.upper()}</b>."
    )
    if new_status == "shipped" and order.get("delivery_person_name"):
        body += (
            f"<br/><br/>Your rider: <b>{order['delivery_person_name']}</b> "
            f"({order.get('delivery_person_phone', '')})"
        )
        if order.get("delivery_vehicle_no"):
            body += f" · {order['delivery_vehicle_no']}"
        if order.get("expected_delivery_date"):
            body += f"<br/>Expected: {order['expected_delivery_date']}"
    cta = ("Track Order", f"{APP_URL}/orders/{order.get('order_id')}" if APP_URL else None)
    send_email(email, f"JOY · {title} ({order.get('order_id')})", _layout(title, body, *cta))


def notify_delivery_assigned(order: dict, email: str) -> None:
    if not email or not order.get("delivery_person_name"):
        return
    title = "Rider assigned"
    body = (
        f"<b>{order['delivery_person_name']}</b> ({order.get('delivery_person_phone', '')}) "
        f"will deliver order <b>{order.get('order_id')}</b>."
    )
    if order.get("expected_delivery_date"):
        body += f"<br/>Expected delivery: {order['expected_delivery_date']}"
    cta = ("View Order", f"{APP_URL}/orders/{order.get('order_id')}" if APP_URL else None)
    send_email(email, f"JOY · Rider assigned ({order.get('order_id')})", _layout(title, body, *cta))



async def notify_team_invite(email: str, workshop_name: str, token: str, role: str) -> None:
    """Async wrapper to keep the call site non-blocking. Best-effort — no-op when keys missing."""
    if not email:
        return
    title = f"You're invited to join {workshop_name} on JOY Automart"
    accept_url = f"{APP_URL}/accept-invite?token={token}" if APP_URL else f"https://b2bjoymart.com/accept-invite?token={token}"
    role_label = role.replace("_", " ").title()
    body = (
        f"<b>{workshop_name}</b> has invited you to join their workspace as a "
        f"<b>{role_label}</b> on JOY Automart — Bangladesh's first AI-powered B2B auto parts platform."
        "<br/><br/>Click the button below to accept and start ordering parts under their account."
        "<br/><br/><i>This invitation expires in 7 days.</i>"
    )
    send_email(email, title, _layout(title, body, "Accept invitation", accept_url))
