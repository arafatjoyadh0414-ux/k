"""Vehicle Health Passport PDF — branded, shareable, used-car-grade."""
from io import BytesIO
from datetime import datetime
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, KeepTogether, PageBreak,
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_RIGHT, TA_CENTER

JOY_RED = colors.HexColor("#E11D48")
SLATE_900 = colors.HexColor("#0F172A")
SLATE_500 = colors.HexColor("#64748B")
SLATE_200 = colors.HexColor("#E2E8F0")
SLATE_50 = colors.HexColor("#F8FAFC")


def _money(v) -> str:
    return f"BDT {int(round(float(v or 0))):,}"


def _fmt_date(s) -> str:
    if not s:
        return "—"
    if isinstance(s, datetime):
        return s.strftime("%d %b %Y")
    try:
        return datetime.fromisoformat(str(s).replace("Z", "+00:00")).strftime("%d %b %Y")
    except Exception:
        return str(s)[:10]


def render_passport_pdf(payload: dict) -> bytes:
    """Render a Vehicle Health Passport PDF.

    payload = {
        vin, decoded {make, model, year, body_class, engine, ...},
        stats {order_count, total_spend_bdt, photo_count, workshop_count, first_seen, last_seen},
        timeline [{type, date, company_name, title, note, items?}],
        workshop {company_name, kyc_tier, kyc_approved},
        share_url, generated_at,
    }
    """
    buf = BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        leftMargin=18 * mm, rightMargin=18 * mm,
        topMargin=18 * mm, bottomMargin=18 * mm,
        title=f"Vehicle Health Passport · {payload.get('vin', '')}",
    )

    styles = getSampleStyleSheet()
    h1 = ParagraphStyle("h1", parent=styles["Heading1"], fontName="Helvetica-Bold",
                        fontSize=22, leading=26, textColor=SLATE_900, spaceAfter=2)
    overline = ParagraphStyle("overline", parent=styles["Normal"], fontName="Helvetica-Bold",
                              fontSize=8, textColor=JOY_RED, leading=10, spaceAfter=4)
    h2 = ParagraphStyle("h2", parent=styles["Heading2"], fontName="Helvetica-Bold",
                        fontSize=12, leading=14, textColor=SLATE_900, spaceBefore=10, spaceAfter=6)
    body = ParagraphStyle("body", parent=styles["Normal"], fontName="Helvetica",
                          fontSize=9, leading=12, textColor=SLATE_900)
    small = ParagraphStyle("small", parent=styles["Normal"], fontName="Helvetica",
                           fontSize=8, leading=10, textColor=SLATE_500)

    story = []

    # ── Header
    decoded = payload.get("decoded") or {}
    vin = payload.get("vin", "")
    workshop = payload.get("workshop") or {}
    make = decoded.get("make") or ""
    model = decoded.get("model") or ""
    year = decoded.get("year") or ""

    story.append(Paragraph("VEHICLE HEALTH PASSPORT", overline))
    title_str = f"{year} {make} {model}".strip() or vin
    story.append(Paragraph(title_str, h1))
    story.append(Paragraph(f"VIN · {vin}", small))
    story.append(Spacer(1, 8))

    # ── Verified-by banner
    company = workshop.get("company_name") or "JOY Automart partner"
    tier = (workshop.get("kyc_tier") or "").title() or "Verified"
    kyc_ok = bool(workshop.get("kyc_approved"))
    banner_text = f"Last serviced & verified by <b>{company}</b> · {tier}-tier {'KYC verified' if kyc_ok else 'workshop'}"
    banner_tbl = Table([[Paragraph(banner_text, body)]], colWidths=[doc.width])
    banner_tbl.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), SLATE_50),
        ("BOX", (0, 0), (-1, -1), 0.5, SLATE_200),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ]))
    story.append(banner_tbl)
    story.append(Spacer(1, 12))

    # ── Vehicle info grid
    story.append(Paragraph("VEHICLE", h2))
    info_rows = [
        ["Make", make or "—", "Model", model or "—"],
        ["Year", str(year) if year else "—", "Body class", decoded.get("body_class") or "—"],
        ["Engine", decoded.get("engine") or "—", "Country", decoded.get("country") or "—"],
        ["Fuel", decoded.get("fuel_type") or "—", "Transmission", decoded.get("transmission") or "—"],
    ]
    info_tbl = Table(info_rows, colWidths=[28 * mm, (doc.width / 2) - 28 * mm, 28 * mm, (doc.width / 2) - 28 * mm])
    info_tbl.setStyle(TableStyle([
        ("FONT", (0, 0), (-1, -1), "Helvetica", 9),
        ("TEXTCOLOR", (0, 0), (0, -1), SLATE_500),
        ("TEXTCOLOR", (2, 0), (2, -1), SLATE_500),
        ("FONT", (1, 0), (1, -1), "Helvetica-Bold", 9),
        ("FONT", (3, 0), (3, -1), "Helvetica-Bold", 9),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LINEBELOW", (0, 0), (-1, -2), 0.25, SLATE_200),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
    ]))
    story.append(info_tbl)

    # ── Stats summary
    stats = payload.get("stats") or {}
    story.append(Paragraph("MAINTENANCE SUMMARY", h2))
    stat_cells = [
        [str(stats.get("order_count", 0)), _money(stats.get("total_spend_bdt", 0)),
         str(stats.get("workshop_count", 0)), str(stats.get("photo_count", 0))],
        ["Service orders", "Lifetime spend", "Workshops", "Photos on record"],
    ]
    stat_tbl = Table(stat_cells, colWidths=[doc.width / 4] * 4)
    stat_tbl.setStyle(TableStyle([
        ("FONT", (0, 0), (-1, 0), "Helvetica-Bold", 16),
        ("TEXTCOLOR", (0, 0), (-1, 0), SLATE_900),
        ("FONT", (0, 1), (-1, 1), "Helvetica", 7),
        ("TEXTCOLOR", (0, 1), (-1, 1), SLATE_500),
        ("ALIGN", (0, 0), (-1, -1), "LEFT"),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("BOX", (0, 0), (-1, -1), 0.5, SLATE_200),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, SLATE_200),
    ]))
    story.append(stat_tbl)

    # ── Service history timeline
    story.append(Paragraph("SERVICE HISTORY", h2))
    timeline = payload.get("timeline") or []
    if not timeline:
        story.append(Paragraph("No recorded service events yet.", small))
    else:
        rows = [["Date", "Event", "Workshop", "Detail"]]
        for ev in timeline[:40]:
            etype = (ev.get("type") or "").upper()
            rows.append([
                _fmt_date(ev.get("date")),
                Paragraph(f"<b>{ev.get('title', '—')}</b><br/><font size=7 color='#64748B'>{etype}</font>", body),
                Paragraph(ev.get("company_name", "—"), body),
                Paragraph((ev.get("note") or "")[:140], small),
            ])
        history_tbl = Table(rows, colWidths=[22 * mm, 60 * mm, 38 * mm, doc.width - 22 * mm - 60 * mm - 38 * mm])
        history_tbl.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), SLATE_900),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONT", (0, 0), (-1, 0), "Helvetica-Bold", 8),
            ("FONT", (0, 1), (-1, -1), "Helvetica", 9),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING", (0, 0), (-1, -1), 6),
            ("RIGHTPADDING", (0, 0), (-1, -1), 6),
            ("TOPPADDING", (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, SLATE_50]),
            ("BOX", (0, 0), (-1, -1), 0.5, SLATE_200),
            ("INNERGRID", (0, 1), (-1, -1), 0.25, SLATE_200),
        ]))
        story.append(history_tbl)

    # ── Authenticity footer
    story.append(Spacer(1, 14))
    story.append(Paragraph("VERIFY THIS PASSPORT", h2))
    share_url = payload.get("share_url") or ""
    if share_url:
        story.append(Paragraph(
            f"This passport is authentic and tamper-checked. Verify online at:<br/>"
            f"<font color='#E11D48'><b>{share_url}</b></font>",
            body
        ))
    story.append(Spacer(1, 4))
    story.append(Paragraph(
        f"Generated {_fmt_date(payload.get('generated_at'))} · "
        f"Powered by JOY Automart B2B Platform · "
        f"<a href='https://www.joyautomart.com' color='#E11D48'>www.joyautomart.com</a>",
        small
    ))

    doc.build(story)
    return buf.getvalue()
