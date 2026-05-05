"""PDF Invoice generator for Joy Automart B2B."""
from io import BytesIO
from datetime import datetime
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_RIGHT, TA_CENTER, TA_LEFT


JOY_RED = colors.HexColor("#E11D48")
JOY_DARK = colors.HexColor("#0f172a")
JOY_GREY = colors.HexColor("#475569")
JOY_LIGHT = colors.HexColor("#f1f5f9")


def _money(v: float) -> str:
    try:
        return f"BDT {v:,.2f}"
    except Exception:
        return f"BDT {v}"


def render_invoice_pdf(order: dict, workshop: dict | None = None) -> bytes:
    buf = BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        leftMargin=15 * mm, rightMargin=15 * mm,
        topMargin=15 * mm, bottomMargin=15 * mm,
        title=f"Invoice {order.get('order_id', '')}",
    )

    styles = getSampleStyleSheet()
    h1 = ParagraphStyle("H1", parent=styles["Heading1"], fontSize=22, leading=26,
                       textColor=JOY_DARK, spaceAfter=2)
    h_red = ParagraphStyle("HRed", parent=styles["Heading2"], fontSize=14, leading=18,
                          textColor=JOY_RED, spaceAfter=2)
    label = ParagraphStyle("Label", parent=styles["Normal"], fontSize=7,
                          textColor=JOY_GREY, leading=10,
                          spaceBefore=0, spaceAfter=2, fontName="Helvetica-Bold")
    body = ParagraphStyle("Body", parent=styles["Normal"], fontSize=9,
                         textColor=JOY_DARK, leading=12)
    body_right = ParagraphStyle("BodyR", parent=body, alignment=TA_RIGHT)
    small = ParagraphStyle("Small", parent=styles["Normal"], fontSize=8,
                          textColor=JOY_GREY, leading=11)

    story = []

    # ===== Header =====
    header_data = [[
        Paragraph("<b>JOY AUTOMART</b>", h1),
        Paragraph("INVOICE", h_red),
    ]]
    header_data.append([
        Paragraph(
            "B2B Wholesale Portal · Bangladesh<br/>"
            "<font color='#475569' size='8'>www.joyautomart.com · sales@joyautomart.com</font>",
            body,
        ),
        Paragraph(
            f"<font color='#475569' size='8'>INVOICE NO.</font><br/>"
            f"<b>{order.get('order_id', '')}</b><br/>"
            f"<font color='#475569' size='8'>DATE</font><br/>"
            f"{_fmt_date(order.get('created_at'))}",
            body_right,
        ),
    ])
    header = Table(header_data, colWidths=[110 * mm, 70 * mm])
    header.setStyle(TableStyle([
        ("ALIGN", (1, 0), (1, -1), "RIGHT"),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LINEBELOW", (0, 1), (-1, 1), 1, JOY_RED),
        ("BOTTOMPADDING", (0, 1), (-1, 1), 8),
    ]))
    story.append(header)
    story.append(Spacer(1, 8 * mm))

    # ===== Bill-to / Ship-to / Status =====
    company = order.get("company_name") or (workshop or {}).get("company_name", "—")
    bill_lines = [f"<b>{company}</b>"]
    if workshop:
        if workshop.get("address"):
            bill_lines.append(workshop["address"])
        if workshop.get("city"):
            bill_lines.append(workshop["city"])
        if workshop.get("contact_phone"):
            bill_lines.append(f"Phone: {workshop['contact_phone']}")
        if workshop.get("trade_license_no"):
            bill_lines.append(f"Trade License: {workshop['trade_license_no']}")

    ship = order.get("shipping_address", "") or "—"

    payment_method = (order.get("payment_method") or "").upper()
    payment_status = (order.get("payment_status") or "").upper()
    pay_color = "#16a34a" if payment_status == "PAID" else "#ea580c"

    info = Table([[
        Paragraph("<b>BILL TO</b><br/><br/>" + "<br/>".join(bill_lines), body),
        Paragraph("<b>SHIP TO</b><br/><br/>" + ship.replace("\n", "<br/>"), body),
        Paragraph(
            "<b>PAYMENT</b><br/><br/>"
            f"{payment_method} · "
            f"<font color='{pay_color}'><b>{payment_status}</b></font><br/>"
            f"<font size='8' color='#475569'>"
            f"Tier: {(order.get('pricing_tier') or '—').upper()}"
            f"{('<br/>Due: ' + _fmt_date(order.get('due_date'))) if order.get('due_date') else ''}"
            f"</font>",
            body,
        ),
    ]], colWidths=[65 * mm, 60 * mm, 55 * mm])
    info.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("BACKGROUND", (0, 0), (-1, -1), JOY_LIGHT),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ]))
    story.append(info)
    story.append(Spacer(1, 8 * mm))

    # ===== Items table =====
    rows = [[
        Paragraph("<b>SKU</b>", body),
        Paragraph("<b>Description</b>", body),
        Paragraph("<b>Qty</b>", body_right),
        Paragraph("<b>Unit (BDT)</b>", body_right),
        Paragraph("<b>Total (BDT)</b>", body_right),
    ]]
    for it in order.get("items", []):
        rows.append([
            Paragraph(it.get("sku", ""), body),
            Paragraph(it.get("name", ""), body),
            Paragraph(str(it.get("quantity", 0)), body_right),
            Paragraph(f"{it.get('price_bdt', 0):,.2f}", body_right),
            Paragraph(f"{it.get('line_total', 0):,.2f}", body_right),
        ])

    items_tbl = Table(rows, colWidths=[28 * mm, 88 * mm, 14 * mm, 24 * mm, 26 * mm], repeatRows=1)
    items_tbl.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), JOY_DARK),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("LINEBELOW", (0, 0), (-1, 0), 1, JOY_DARK),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, JOY_LIGHT]),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    story.append(items_tbl)
    story.append(Spacer(1, 4 * mm))

    # ===== Totals =====
    sub = order.get("subtotal_bdt", 0)
    disc_amt = order.get("discount_amount_bdt", 0) or 0
    disc_label = order.get("discount_label", "")
    fee = order.get("delivery_fee_bdt", 0) or 0
    grand = order.get("total_bdt", 0)

    totals_rows = [[Paragraph("Subtotal", body_right), Paragraph(_money(sub), body_right)]]
    if disc_amt > 0:
        pct = (order.get("discount_pct", 0) or 0) * 100
        totals_rows.append([
            Paragraph(f"{disc_label or 'Discount'} ({pct:.0f}%)", body_right),
            Paragraph(f"-{_money(disc_amt)}", body_right),
        ])
    if fee > 0:
        totals_rows.append([Paragraph("Delivery Fee", body_right), Paragraph(_money(fee), body_right)])
    totals_rows.append([
        Paragraph("<b>GRAND TOTAL</b>", body_right),
        Paragraph(f"<b>{_money(grand)}</b>", body_right),
    ])

    totals_tbl = Table(totals_rows, colWidths=[120 * mm, 60 * mm])
    totals_tbl.setStyle(TableStyle([
        ("ALIGN", (0, 0), (-1, -1), "RIGHT"),
        ("LINEABOVE", (0, -1), (-1, -1), 1, JOY_DARK),
        ("TOPPADDING", (0, -1), (-1, -1), 6),
        ("BOTTOMPADDING", (0, -1), (-1, -1), 6),
        ("BACKGROUND", (0, -1), (-1, -1), JOY_LIGHT),
    ]))
    story.append(totals_tbl)
    story.append(Spacer(1, 10 * mm))

    # ===== Delivery info (if assigned) =====
    if order.get("delivery_person_name"):
        rider_lines = (
            f"<b>Out for delivery:</b> {order.get('delivery_person_name')}"
            f" · {order.get('delivery_person_phone', '')}"
        )
        if order.get("delivery_vehicle_no"):
            rider_lines += f" · {order['delivery_vehicle_no']}"
        if order.get("expected_delivery_date"):
            rider_lines += f"<br/>Expected delivery: {order['expected_delivery_date']}"
        story.append(Paragraph(rider_lines, small))
        story.append(Spacer(1, 5 * mm))

    # ===== Footer / Notes =====
    if order.get("notes"):
        story.append(Paragraph("NOTES", label))
        story.append(Paragraph(order["notes"].replace("\n", "<br/>"), small))
        story.append(Spacer(1, 5 * mm))

    footer_text = (
        "Thank you for partnering with JOY Automart.<br/>"
        "Bank transfer details and payment terms apply per your contract. "
        "Returns accepted within 7 days of delivery — see /returns in the workshop portal.<br/>"
        f"<font size='7' color='#94a3b8'>Generated {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}</font>"
    )
    story.append(Spacer(1, 5 * mm))
    sig = Table([[
        Paragraph("____________________________<br/>Authorised Signatory<br/>JOY Automart", small),
        Paragraph("____________________________<br/>Received by<br/>Workshop Authorised", small),
    ]], colWidths=[90 * mm, 90 * mm])
    sig.setStyle(TableStyle([
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("TOPPADDING", (0, 0), (-1, -1), 18),
    ]))
    story.append(sig)
    story.append(Spacer(1, 4 * mm))
    story.append(Paragraph(footer_text, small))

    # Brand stamp — workshops show this PDF to fleet customers / vehicle owners.
    story.append(Spacer(1, 6 * mm))
    brand = ParagraphStyle(
        "Brand", parent=small, alignment=TA_CENTER,
        textColor=JOY_GREY, fontSize=8, leading=11,
    )
    story.append(Paragraph(
        "<b><font color='#E11D48'>JOY Automart</font></b> · "
        "Bangladesh's B2B parts portal for auto repair workshops "
        "&nbsp;·&nbsp; <font color='#0f172a'>www.joyautomart.com</font>",
        brand,
    ))

    doc.build(story)
    return buf.getvalue()


def _fmt_date(s) -> str:
    if not s:
        return "—"
    try:
        if isinstance(s, str):
            dt = datetime.fromisoformat(s.replace("Z", "+00:00"))
        else:
            dt = s
        return dt.strftime("%d %b %Y")
    except Exception:
        return str(s)[:10]
