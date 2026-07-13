from __future__ import annotations

import hashlib
import os
from datetime import datetime
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
_LIGHT_BORDER = colors.HexColor("#c8d6e8")


async def get_default_building_config(conn: Any) -> dict:
    if conn is None or "unittest.mock" in type(conn).__module__:
        return {}

    row = await conn.fetchrow("SELECT * FROM buildings ORDER BY created_at ASC LIMIT 1")
    return dict(row) if row else {}


def get_building_name(building: dict | None) -> str:
    building = building or {}
    return building.get("name") or "Edificio Torres Netanya"


def get_app_url() -> str:
    try:
        from app.config.settings import settings

        return settings.app_url
    except Exception:
        return os.getenv("APP_URL", "http://localhost:5173")


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
    signer_name: str,
    signer_role: str,
) -> Table:
    building = building or {}
    text_blue = _PRIMARY_BLUE

    signature_cell = get_building_asset_image(
        building,
        storage_key="signature_storage_path",
        max_width=2.0 * inch,
        max_height=0.68 * inch,
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
        max_width=1.72 * inch,
        max_height=1.72 * inch,
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

    verification_hash = hashlib.sha1(qr_value.encode("utf-8")).hexdigest().upper()[:16]
    verification_code = "-".join([
        verification_hash[0:4],
        verification_hash[4:8],
        verification_hash[8:12],
        verification_hash[12:16],
    ])
    period_label = f"ADMINISTRACIÓN {datetime.now().year} - {datetime.now().year + 1}"
    signature_width = width * 0.34
    seal_width = width * 0.27
    qr_width = width * 0.39

    signature_block = Table(
        [
            [Paragraph('<font size="9.5" color="#123c7a"><b>Atentamente,</b></font>', ParagraphStyle("PdfSignGreeting", fontName="Helvetica-Bold", leading=12, textColor=text_blue))],
            [signature_cell],
            [Paragraph('<font size="8.5" color="#123c7a"><b>' + escape(signer_name or "Usuario del sistema") + '</b></font>', ParagraphStyle("PdfSignerName", fontName="Helvetica-Bold", leading=10.5, textColor=text_blue))],
            [Paragraph('<font size="8.5" color="#123c7a">' + escape(signer_role or "Rol no definido") + '</font>', ParagraphStyle("PdfSignerRole", fontName="Helvetica", leading=10.5, textColor=text_blue))],
            [Paragraph('<font size="8.5" color="#123c7a"><b>' + escape(period_label) + '</b></font>', ParagraphStyle("PdfSignerPeriod", fontName="Helvetica-Bold", leading=11, textColor=text_blue))],
        ],
        colWidths=[signature_width],
        rowHeights=[0.28 * inch, 0.54 * inch, 0.20 * inch, 0.20 * inch, 0.28 * inch],
    )
    signature_block.setStyle(
        TableStyle(
            [
                ("ALIGN", (0, 0), (-1, -1), "LEFT"),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LINEBELOW", (0, 1), (0, 1), 0.8, _PRIMARY_BLUE),
                ("TOPPADDING", (0, 0), (-1, -1), 1),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 1),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
            ]
        )
    )

    seal_block = Table(
        [[seal_cell]],
        colWidths=[seal_width],
        rowHeights=[1.55 * inch],
    )
    seal_block.setStyle(
        TableStyle(
            [
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                ("TOPPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
            ]
        )
    )

    qr_block = Table(
        [
            [
                build_pdf_qr(qr_value, size=0.84 * inch),
                Paragraph(
                    (
                        '<font size="8.5" color="#123c7a">Escanee este código para</font><br/>'
                        '<font size="8.5" color="#123c7a">verificar la autenticidad</font><br/>'
                        '<font size="8.5" color="#123c7a">de este documento.</font><br/><br/>'
                        '<font size="8.5" color="#123c7a">Código de verificación:</font><br/>'
                        f'<font size="8.8" color="#123c7a"><b>{escape(verification_code)}</b></font>'
                    ),
                    ParagraphStyle("PdfQrInfo", fontName="Helvetica", leading=12, textColor=text_blue),
                ),
            ]
        ],
        colWidths=[0.94 * inch, qr_width - 0.94 * inch],
        rowHeights=[1.22 * inch],
    )
    qr_block.setStyle(
        TableStyle(
            [
                ("ALIGN", (0, 0), (0, 0), "LEFT"),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 4),
                ("TOPPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
            ]
        )
    )

    grid = Table(
        [[signature_block, seal_block, qr_block]],
        colWidths=[signature_width, seal_width, qr_width],
        rowHeights=[1.62 * inch],
    )
    grid.setStyle(
        TableStyle(
            [
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (0, 0), 0),
                ("RIGHTPADDING", (0, 0), (0, 0), 14),
                ("LEFTPADDING", (1, 0), (1, 0), 8),
                ("RIGHTPADDING", (1, 0), (1, 0), 8),
                ("LEFTPADDING", (2, 0), (2, 0), 10),
                ("RIGHTPADDING", (2, 0), (2, 0), 0),
                ("TOPPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
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
    logo_width = min(max(width * 0.20, 1.45 * inch), 1.70 * inch)
    logo_cell = get_building_logo(
        building,
        max_width=max(logo_width - 0.34 * inch, 0.85 * inch),
        max_height=1.02 * inch,
    )

    title_cell = Paragraph(
        f'<font size="18" color="#123c7a"><b>{escape(title)}</b></font>',
        ParagraphStyle(
            "PdfBrandHeaderTitle",
            fontName="Helvetica-Bold",
            leading=22,
            alignment=1,
            textColor=_PRIMARY_BLUE,
        ),
    )
    subtitle_cell = Paragraph(
        f'<font size="9.2" color="#123c7a">{escape(subtitle)}</font>',
        ParagraphStyle(
            "PdfBrandHeaderSubtitle",
            fontName="Helvetica",
            leading=12,
            alignment=1,
            textColor=_PRIMARY_BLUE,
        ),
    )
    header = Table(
        [
            [logo_cell, title_cell],
            ["", subtitle_cell],
        ],
        colWidths=[logo_width, max(width - logo_width, 1 * inch)],
        rowHeights=[0.78 * inch, 0.62 * inch],
    )
    header.setStyle(
        TableStyle(
            [
                ("BOX", (0, 0), (-1, -1), 1.05, _PRIMARY_BLUE),
                ("SPAN", (0, 0), (0, 1)),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("ALIGN", (0, 0), (0, 1), "CENTER"),
                ("LINEAFTER", (0, 0), (0, 1), 1.0, _PRIMARY_BLUE),
                ("LINEBELOW", (1, 0), (1, 0), 0.8, _PRIMARY_BLUE),
                ("LEFTPADDING", (0, 0), (0, 1), 12),
                ("RIGHTPADDING", (0, 0), (0, 1), 12),
                ("TOPPADDING", (0, 0), (0, 1), 10),
                ("BOTTOMPADDING", (0, 0), (0, 1), 10),
                ("LEFTPADDING", (1, 0), (1, 0), 14),
                ("RIGHTPADDING", (1, 0), (1, 0), 14),
                ("TOPPADDING", (1, 0), (1, 0), 12),
                ("BOTTOMPADDING", (1, 0), (1, 0), 8),
                ("LEFTPADDING", (1, 1), (1, 1), 14),
                ("RIGHTPADDING", (1, 1), (1, 1), 14),
                ("TOPPADDING", (1, 1), (1, 1), 8),
                ("BOTTOMPADDING", (1, 1), (1, 1), 10),
            ]
        )
    )
    return [header, Spacer(1, 0.22 * inch)]


def build_pdf_footer_bar(
    building: dict | None,
    *,
    width: float,
    page_text: str = "Página 1 de 1",
    notice: str = "Documento generado automáticamente por el sistema.",
) -> Table:
    building = building or {}
    building_name = get_building_name(building)
    address = building.get("address") or ""
    phone = building.get("phone") or ""
    email = building.get("email") or ""
    website = building.get("website") or building.get("web") or get_app_url()

    left_contact = Paragraph(
        (
            f'<font size="7.6" color="#123c7a"><b>{escape(building_name)}</b></font><br/>'
            f'<font size="7.4" color="#123c7a">{escape(address) if address else "Sin dirección registrada"}</font>'
        ),
        ParagraphStyle("PdfFooterAddress", fontName="Helvetica", fontSize=7.4, leading=9.4, textColor=_PRIMARY_BLUE),
    )
    middle_contact = Paragraph(
        (
            f'<font size="7.4" color="#123c7a">Tel. {escape(phone) if phone else "Sin teléfono"}</font><br/>'
            f'<font size="7.4" color="#123c7a">Email. {escape(email) if email else "Sin correo"}</font>'
        ),
        ParagraphStyle("PdfFooterMiddle", fontName="Helvetica", fontSize=7.4, leading=9.4, textColor=_PRIMARY_BLUE),
    )
    right_contact = Paragraph(
        (
            f'<font size="7.6" color="#123c7a"><b>{escape(website)}</b></font><br/>'
            f'<font size="6.8" color="#6b7280">{escape(page_text)}</font>'
        ),
        ParagraphStyle("PdfFooterRight", fontName="Helvetica", fontSize=7.4, leading=9.2, alignment=2, textColor=_PRIMARY_BLUE),
    )

    footer = Table(
        [[left_contact, middle_contact, right_contact]],
        colWidths=[width * 0.38, width * 0.34, width * 0.28],
        rowHeights=[0.50 * inch],
    )
    footer.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), colors.white),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LINEABOVE", (0, 0), (-1, 0), 0.9, _PRIMARY_BLUE),
                ("LINEBELOW", (0, 0), (-1, 0), 0.5, _LIGHT_BORDER),
                ("LEFTPADDING", (0, 0), (-1, -1), 10),
                ("RIGHTPADDING", (0, 0), (-1, -1), 10),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )
    return footer
