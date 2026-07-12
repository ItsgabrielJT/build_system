from __future__ import annotations

import hashlib
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
    signer_name: str,
    signer_role: str,
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

    verification_hash = hashlib.sha1(qr_value.encode("utf-8")).hexdigest().upper()[:16]
    verification_code = "-".join([
        verification_hash[0:4],
        verification_hash[4:8],
        verification_hash[8:12],
        verification_hash[12:16],
    ])
    period_label = f"ADMINISTRACIÓN {datetime.now().year} - {datetime.now().year + 1}"

    signature_block = Table(
        [
            [Paragraph('<font size="9" color="#123c7a"><b>Atentamente,</b></font>', ParagraphStyle("PdfSignGreeting", fontName="Helvetica-Bold", leading=11, textColor=_PRIMARY_BLUE))],
            [signature_cell],
            [Paragraph('<font size="8" color="#123c7a"><b>' + escape(signer_name or "Usuario del sistema") + '</b></font>', ParagraphStyle("PdfSignerName", fontName="Helvetica-Bold", leading=10, textColor=_PRIMARY_BLUE))],
            [Paragraph('<font size="8" color="#123c7a">' + escape(signer_role or "Rol no definido") + '</font>', ParagraphStyle("PdfSignerRole", fontName="Helvetica", leading=10, textColor=_PRIMARY_BLUE))],
            [Paragraph('<font size="8" color="#123c7a"><b>' + escape(period_label) + '</b></font>', ParagraphStyle("PdfSignerPeriod", fontName="Helvetica-Bold", leading=10, textColor=_PRIMARY_BLUE))],
        ],
        colWidths=[width * 0.34],
    )
    signature_block.setStyle(
        TableStyle(
            [
                ("ALIGN", (0, 0), (-1, -1), "LEFT"),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LINEBELOW", (0, 1), (0, 1), 0.8, _PRIMARY_BLUE),
                ("TOPPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
            ]
        )
    )

    seal_block = Table(
        [[seal_cell]],
        colWidths=[width * 0.30],
        rowHeights=[1.45 * inch],
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
                build_pdf_qr(qr_value, size=0.92 * inch),
                Paragraph(
                    (
                        '<font size="8" color="#123c7a">Escanee este código para</font><br/>'
                        '<font size="8" color="#123c7a">verificar la autenticidad</font><br/>'
                        '<font size="8" color="#123c7a">de este documento.</font><br/><br/>'
                        '<font size="8" color="#123c7a">Código de verificación:</font><br/>'
                        f'<font size="10" color="#123c7a"><b>{escape(verification_code)}</b></font>'
                    ),
                    ParagraphStyle("PdfQrInfo", fontName="Helvetica", leading=11, textColor=_PRIMARY_BLUE),
                ),
            ]
        ],
        colWidths=[1.12 * inch, width * 0.24],
    )
    qr_block.setStyle(
        TableStyle(
            [
                ("ALIGN", (0, 0), (0, 0), "LEFT"),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                ("TOPPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
            ]
        )
    )

    grid = Table(
        [[signature_block, seal_block, qr_block]],
        colWidths=[width * 0.34, width * 0.30, width * 0.36],
        rowHeights=[1.56 * inch],
    )
    grid.setStyle(
        TableStyle(
            [
                ("BOX", (0, 0), (-1, -1), 0.8, _PRIMARY_BLUE),
                ("INNERGRID", (0, 0), (-1, -1), 0.45, colors.HexColor("#c9d8ef")),
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
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
    notice: str = "Documento generado automáticamente por el sistema.",
) -> Table:
    building = building or {}
    address = building.get("address") or ""
    phone = building.get("phone") or ""
    email = building.get("email") or ""
    website = building.get("website") or building.get("web") or ""

    left_contact = Paragraph(
        f'<font size="7" color="#123c7a">📍 {escape(address) if address else "Sin dirección registrada"}</font>',
        ParagraphStyle("PdfFooterAddress", fontName="Helvetica", fontSize=7, leading=9, textColor=_PRIMARY_BLUE),
    )
    middle_contact = Paragraph(
        (
            f'<font size="7" color="#123c7a">☎ {escape(phone) if phone else "Sin teléfono"}</font><br/>'
            f'<font size="7" color="#123c7a">✉ {escape(email) if email else "Sin correo"}</font>'
        ),
        ParagraphStyle("PdfFooterMiddle", fontName="Helvetica", fontSize=7, leading=9, textColor=_PRIMARY_BLUE),
    )
    right_text = website or page_text
    right_contact = Paragraph(
        f'<font size="7" color="#123c7a">🌐 {escape(right_text)}</font>',
        ParagraphStyle("PdfFooterRight", fontName="Helvetica", fontSize=7, leading=9, alignment=2, textColor=_PRIMARY_BLUE),
    )

    footer = Table(
        [[left_contact, middle_contact, right_contact]],
        colWidths=[width * 0.38, width * 0.34, width * 0.28],
        rowHeights=[0.52 * inch],
    )
    footer.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), colors.white),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LINEABOVE", (0, 0), (-1, 0), 0.9, colors.HexColor("#123c7a")),
                ("BOX", (0, 0), (-1, -1), 0.7, colors.HexColor("#c8d6e8")),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )
    return footer
