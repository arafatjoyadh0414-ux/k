"""Job Card PDF — shareable customer-facing service estimate.

Generates a clean A4 PDF with workshop branding, customer details, vehicle,
complaint, parts breakdown with prices, labour charge, total, and a unique
shareable URL with QR.
"""

from io import BytesIO
from datetime import datetime
from typing import Optional

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image, KeepTogether
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_RIGHT, TA_CENTER, TA_LEFT


JOY_RED = colors.HexColor("#E11D48")
JOY_DARK = colors.HexColor("#0F172A")
JOY_GREY = colors.HexColor("#475569")
JOY_LIGHT = colors.HexColor("#F1F5F9")
JOY_BORDER = colors.HexColor("#E2E8F0")


def _money(v) -> str:
    try:
        return f"BDT {float(v):,.2f}"
    except Exception:
        return f"BDT {v}"


def render_job_card_pdf(card: dict, workshop: Optional[dict] = None, share_url: Optional[str] = None) -> bytes:
    buf = BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        leftMargin=18 * mm, rightMargin=18 * mm,
        topMargin=18 * mm, bottomMargin=18 * mm,
        title=f"Job Card {card.get('job_id', '')}",
        author="JOY Automart",
    )
    styles = getSampleStyleSheet()
    h1 = ParagraphStyle("h1", parent=styles["Heading1"], fontSize=24, leading=28, textColor=JOY_DARK, spaceAfter=2, alignment=TA_LEFT)
    h2 = ParagraphStyle("h2", parent=styles["Heading2"], fontSize=11, leading=14, textColor=JOY_RED, spaceAfter=2, alignment=TA_LEFT)
    body = ParagraphStyle("body", parent=styles["BodyText"], fontSize=10, leading=14, textColor=JOY_DARK)
    small = ParagraphStyle("small", parent=styles["BodyText"], fontSize=8, leading=11, textColor=JOY_GREY)
    label = ParagraphStyle("label", parent=styles["BodyText"], fontSize=7, leading=10, textColor=JOY_GREY, alignment=TA_LEFT)
    bold = ParagraphStyle("bold", parent=styles["BodyText"], fontSize=10, leading=13, textColor=JOY_DARK, fontName="Helvetica-Bold")
    right_money = ParagraphStyle("rmoney", parent=styles["BodyText"], fontSize=10, leading=13, textColor=JOY_DARK, alignment=TA_RIGHT, fontName="Helvetica-Bold")

    elements = []

    # Header
    company = (workshop or {}).get("company_name") or "JOY Automart Trade Partner"
    joy_id = (workshop or {}).get("joy_id") or ""
    address = (workshop or {}).get("address") or ""
    city = (workshop or {}).get("city") or "Dhaka, Bangladesh"
    contact = (workshop or {}).get("contact_phone") or ""

    header_left = [
        Paragraph("SERVICE ESTIMATE", h2),
        Paragraph(f"Job Card #{card.get('job_id', '')}", h1),
        Paragraph(f"Issued {datetime.now().strftime('%d %b %Y, %I:%M %p')}", small),
    ]
    header_right = [
        Paragraph("<font color='#E11D48'><b>JOY</b></font> AUTOMART", bold),
        Paragraph(f"<b>{company}</b>", body),
        Paragraph(joy_id, small) if joy_id else Spacer(1, 0),
        Paragraph(address, small) if address else Spacer(1, 0),
        Paragraph(city, small),
        Paragraph(f"{contact}" if contact else "", small),
    ]
    elements.append(Table([[header_left, header_right]], colWidths=[100 * mm, 75 * mm], style=TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("ALIGN", (1, 0), (1, 0), "RIGHT"),
    ])))
    elements.append(Spacer(1, 6 * mm))

    # Customer + vehicle two-column block
    def kv(k, v):
        return [Paragraph(k, label), Paragraph(v if v else "—", body)]

    cust = [
        kv("CUSTOMER", card.get("customer_name") or ""),
        kv("PHONE", card.get("customer_phone") or ""),
    ]
    veh = [
        kv("VEHICLE", f"{card.get('vehicle_brand', '')} {card.get('vehicle_model', '')} {card.get('vehicle_year') or ''}".strip()),
        kv("PLATE / VIN", card.get("vehicle_plate") or card.get("vin") or ""),
    ]
    elements.append(Table([
        [Table(cust, style=TableStyle([("BOTTOMPADDING", (0, 0), (-1, -1), 4)])),
         Table(veh, style=TableStyle([("BOTTOMPADDING", (0, 0), (-1, -1), 4)]))],
    ], colWidths=[87 * mm, 87 * mm], style=TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("BACKGROUND", (0, 0), (-1, -1), JOY_LIGHT),
        ("BOX", (0, 0), (-1, -1), 0.5, JOY_BORDER),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ])))
    elements.append(Spacer(1, 4 * mm))

    # Complaint + mechanic
    elements.append(Paragraph("COMPLAINT", label))
    elements.append(Paragraph(card.get("complaint") or "—", body))
    if card.get("mechanic_name"):
        elements.append(Spacer(1, 2 * mm))
        elements.append(Paragraph(f"<b>Assigned mechanic:</b> {card['mechanic_name']}", small))
    elements.append(Spacer(1, 6 * mm))

    # Parts table
    parts = card.get("parts") or []
    rows = [[
        Paragraph("<b>SKU</b>", small),
        Paragraph("<b>PART</b>", small),
        Paragraph("<b>QTY</b>", small),
        Paragraph("<b>UNIT PRICE</b>", small),
        Paragraph("<b>SUBTOTAL</b>", small),
    ]]
    parts_total = 0.0
    for p in parts:
        qty = int(p.get("quantity") or 0)
        unit = float(p.get("price_bdt") or 0)
        sub = qty * unit
        parts_total += sub
        rows.append([
            Paragraph(p.get("sku") or "", small),
            Paragraph(p.get("name") or "—", body),
            Paragraph(str(qty), body),
            Paragraph(_money(unit), body),
            Paragraph(_money(sub), bold),
        ])
    if not parts:
        rows.append([Paragraph("No parts listed yet.", small), "", "", "", ""])

    parts_table = Table(rows, colWidths=[28 * mm, 70 * mm, 14 * mm, 30 * mm, 32 * mm])
    parts_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), JOY_DARK),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("LINEBELOW", (0, 0), (-1, -1), 0.3, JOY_BORDER),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    elements.append(parts_table)

    # Totals
    labour = float(card.get("labour_charge_bdt") or 0)
    grand = parts_total + labour
    totals_rows = [
        [Paragraph("Parts subtotal", small), Paragraph(_money(parts_total), right_money)],
        [Paragraph("Labour charge", small), Paragraph(_money(labour), right_money)],
        [Paragraph("<b>TOTAL</b>", bold), Paragraph(f"<font color='#E11D48'><b>{_money(grand)}</b></font>", right_money)],
    ]
    elements.append(Spacer(1, 2 * mm))
    elements.append(Table(totals_rows, colWidths=[143 * mm, 31 * mm], style=TableStyle([
        ("LINEABOVE", (0, -1), (-1, -1), 0.6, JOY_DARK),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ])))

    # Notes & status
    if card.get("notes"):
        elements.append(Spacer(1, 4 * mm))
        elements.append(Paragraph("NOTES", label))
        elements.append(Paragraph(card["notes"], body))

    elements.append(Spacer(1, 8 * mm))

    # Footer with share URL
    footer_lines = [
        "Parts sourced via JOY Automart — Bangladesh's first AI-powered B2B auto parts platform.",
        "Tier-priced parts, fastest sourcing, full traceability.",
    ]
    if share_url:
        footer_lines.append(f"<b>View online:</b> <font color='#E11D48'>{share_url}</font>")
    elements.append(Table([[Paragraph(line, small)] for line in footer_lines], colWidths=[174 * mm], style=TableStyle([
        ("BOX", (0, 0), (-1, -1), 0.5, JOY_BORDER),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ])))
    elements.append(Spacer(1, 6 * mm))
    elements.append(Paragraph(
        "Generated by JOY Automart · joyautomart.com · This estimate is provided for transparency. "
        "Final invoice issued on completion.",
        small,
    ))

    doc.build(elements)
    return buf.getvalue()
