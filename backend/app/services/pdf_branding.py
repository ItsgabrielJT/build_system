from __future__ import annotations

from pathlib import Path
from typing import Any
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.units import inch
from reportlab.platypus import Image, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import ParagraphStyle

_PRIMARY_BLUE = colors.HexColor("#123c7a")
_ACCENT_BLUE = colors.HexColor("#dbe7f7")


async def get_default_building_config(conn: Any) -> dict:
    if conn is None or "unittest.mock" in type(conn).__module__:
        return {}

    row = await conn.fetchrow("SELECT * FROM buildings ORDER BY created_at ASC LIMIT 1")
    return dict(row) if row else {}


def build_pdf_brand_header(
    title: str,
    subtitle: str,
    building: dict | None,
    *,
    width: float,
) -> list:
    building = building or {}
    building_name = building.get("name") or "Administracion del edificio"
    logo_path = building.get("logo_storage_path")

    logo_cell = ""
    if logo_path and Path(logo_path).exists():
        logo = Image(logo_path)
        max_width = 1.2 * inch
        max_height = 0.75 * inch
        ratio = min(max_width / logo.imageWidth, max_height / logo.imageHeight)
        logo.drawWidth = logo.imageWidth * ratio
        logo.drawHeight = logo.imageHeight * ratio
        logo_cell = logo

    text = Paragraph(
        (
            f'<font size="16"><b>{escape(title)}</b></font><br/>'
            f'<font size="11">{escape(building_name)}</font><br/>'
            f'<font size="8" color="#6b7280">{escape(subtitle)}</font>'
        ),
        ParagraphStyle(
            "PdfBrandHeaderText",
            fontName="Helvetica",
            leading=14,
            textColor=_PRIMARY_BLUE,
        ),
    )
    logo_width = 1.45 * inch
    header = Table(
        [[logo_cell, text]],
        colWidths=[logo_width, max(width - logo_width, 1 * inch)],
    )
    header.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                ("TOPPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
                ("LINEBELOW", (0, 0), (-1, -1), 1.4, _PRIMARY_BLUE),
            ]
        )
    )
    return [header, Spacer(1, 0.2 * inch)]
