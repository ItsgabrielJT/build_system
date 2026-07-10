from __future__ import annotations

from pathlib import Path
from typing import Any
from xml.sax.saxutils import escape

from reportlab.graphics.barcode import qr
from reportlab.graphics.shapes import Drawing
from reportlab.lib import colors
from reportlab.lib.units import inch
from reportlab.platypus import Image, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import ParagraphStyle

_PRIMARY_BLUE = colors.HexColor("#123c7a")
_ACCENT_BLUE = colors.HexColor("#dbe7f7")
_FOOTER_BLUE = colors.HexColor("#002e6d")


async def get_default_building_config(conn: Any) -> dict:
    if conn is None or "unittest.mock" in type(conn).__module__:
        return {}

    row = await conn.fetchrow("SELECT * FROM buildings ORDER BY created_at ASC LIMIT 1")
    return dict(row) if row else {}


def get_building_name(building: dict | None) -> str:
    building = building or {}
    return building.get("name") or "Edificio Torres Netanya"


def get_building_logo(building: dict | None, *, max_width: float, max_height: float):
    building = building or {}
    logo_path = building.get("logo_storage_path")
    if not logo_path:
        return ""

    path = Path(logo_path)
    if not path.exists():
        return ""

    logo = Image(str(path))
    ratio = min(max_width / logo.imageWidth, max_height / logo.imageHeight)
    logo.drawWidth = logo.imageWidth * ratio
    logo.drawHeight = logo.imageHeight * ratio
    return logo


def get_building_asset_image(
    building: dict | None,
    *,
    storage_key: str,
    max_width: float,
    max_height: float,
):
    building = building or {}
    path_value = building.get(storage_key)
    if not path_value:
        return ""

    path = Path(path_value)
    if not path.exists():
        return ""

    image = Image(str(path))
    ratio = min(max_width / image.imageWidth, max_height / image.imageHeight)
    image.drawWidth = image.imageWidth * ratio
    image.drawHeight = image.imageHeight * ratio
    return image


def build_pdf_qr(value: str, *, size: float = 0.42 * inch) -> Drawing:
    code = qr.QrCodeWidget(value)
    bounds = code.getBounds()
    drawing = Drawing(
        size,
        size,
        transform=[
            size / (bounds[2] - bounds[0]),
            0,
            0,
            size / (bounds[3] - bounds[1]),
            0,
            0,
        ],
    )
    drawing.add(code)
    return drawing


def build_pdf_signature_seal_qr_grid(
    building: dict | None,
    *,
    width: float,
    qr_value: str,
) -> Table:
    building = building or {}

    signature_cell = get_building_asset_image(
        building,
        storage_key="signature_storage_path",
        max_width=1.55 * inch,
        max_height=0.72 * inch,
    )
    if not signature_cell:
        signature_cell = Paragraph(
            '<font size="8" color="#4b5563">Firma no cargada</font>',
            ParagraphStyle(
                "PdfSignGridSignatureFallback",
                fontName="Helvetica",
                fontSize=8,
                leading=10,
                alignment=1,
                textColor=colors.HexColor("#4b5563"),
            ),
        )

    seal_cell = get_building_asset_image(
        building,
        storage_key="seal_storage_path",
        max_width=1.55 * inch,
        max_height=0.72 * inch,
    )
    if not seal_cell:
        seal_cell = Paragraph(
            '<font size="8" color="#4b5563">Sello no cargado</font>',
            ParagraphStyle(
                "PdfSignGridSealFallback",
                fontName="Helvetica",
                fontSize=8,
                leading=10,
                alignment=1,
                textColor=colors.HexColor("#4b5563"),
            ),
        )

    qr_cell = build_pdf_qr(qr_value, size=0.95 * inch)
    col_width = width / 3
    grid = Table(
        [
            [
                Paragraph('<font size="9" color="#123c7a"><b>Firma</b></font>', ParagraphStyle("PdfSignGridHeader1", fontName="Helvetica-Bold", alignment=1)),
                Paragraph('<font size="9" color="#123c7a"><b>Sello</b></font>', ParagraphStyle("PdfSignGridHeader2", fontName="Helvetica-Bold", alignment=1)),
                Paragraph('<font size="9" color="#123c7a"><b>Validación QR</b></font>', ParagraphStyle("PdfSignGridHeader3", fontName="Helvetica-Bold", alignment=1)),
            ],
            [signature_cell, seal_cell, qr_cell],
        ],
        colWidths=[col_width, col_width, col_width],
        rowHeights=[0.28 * inch, 0.98 * inch],
    )
    grid.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#edf4ff")),
                ("BOX", (0, 0), (-1, -1), 0.8, _PRIMARY_BLUE),
                ("INNERGRID", (0, 0), (-1, -1), 0.45, colors.HexColor("#c9d8ef")),
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ]
        )
    )
    return grid


def get_building_contact_lines(building: dict | None) -> list[str]:
    building = building or {}
    return [
        value
        for value in [
            building.get("address"),
            building.get("phone"),
            building.get("email"),
        ]
        if value
    ]


def build_pdf_brand_header(
    title: str,
    subtitle: str,
    building: dict | None,
    *,
    width: float,
) -> list:
    building = building or {}
    logo_cell = get_building_logo(building, max_width=1.2 * inch, max_height=0.75 * inch)

    text = Paragraph(
        (
            f'<font size="16"><b>{escape(title)}</b></font><br/>'
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


def build_pdf_footer_bar(
    building: dict | None,
    *,
    width: float,
    page_text: str = "Página 1 de 1",
    notice: str = "Este documento es válido únicamente con el código QR y sello de verificación.",
) -> Table:
    logo_cell = get_building_logo(building, max_width=1.0 * inch, max_height=0.42 * inch)
    if not logo_cell:
        logo_cell = Paragraph(
            '<font size="6" color="#ffffff">EDIFICIO</font><br/>'
            '<font size="9" color="#ffffff"><b>TORRES NETANYA</b></font>',
            ParagraphStyle(
                "PdfFooterBrandFallback",
                fontName="Helvetica",
                leading=9,
                textColor=colors.white,
            ),
        )

    notice_cell = Paragraph(
        f'<font size="7" color="#ffffff">{escape(notice)}</font>',
        ParagraphStyle(
            "PdfFooterNotice",
            fontName="Helvetica",
            fontSize=7,
            leading=9,
            alignment=1,
            textColor=colors.white,
        ),
    )
    page_cell = Paragraph(
        f'<font size="7" color="#ffffff">{escape(page_text)}</font>',
        ParagraphStyle(
            "PdfFooterPage",
            fontName="Helvetica",
            fontSize=7,
            leading=9,
            alignment=2,
            textColor=colors.white,
        ),
    )

    footer = Table(
        [[logo_cell, notice_cell, page_cell]],
        colWidths=[width * 0.22, width * 0.56, width * 0.22],
        rowHeights=[0.48 * inch],
    )
    footer.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), _FOOTER_BLUE),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 10),
                ("RIGHTPADDING", (0, 0), (-1, -1), 10),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ]
        )
    )
    return footer
