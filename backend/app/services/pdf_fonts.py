"""PDF fonts with Arabic shaping for lab reports."""

from __future__ import annotations

import html
import re
from pathlib import Path

from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

_FONT_READY = False
FONT_REGULAR = "LabRegular"
FONT_BOLD = "LabBold"

_ARABIC_RE = re.compile(r"[\u0600-\u06FF]")

_FONT_CANDIDATES = (
    Path("/usr/share/fonts/truetype/labmaster/NotoSansArabic-Regular.ttf"),
    Path("/usr/share/fonts/truetype/noto/NotoSansArabic-Regular.ttf"),
    Path("/usr/share/fonts/opentype/noto/NotoSansArabic-Regular.ttf"),
    Path("/usr/share/fonts/truetype/noto/NotoNaskhArabic-Regular.ttf"),
    Path(__file__).resolve().parent.parent / "assets" / "fonts" / "NotoSansArabic-Regular.ttf",
)

_BOLD_CANDIDATES = (
    Path("/usr/share/fonts/truetype/labmaster/NotoSansArabic-Bold.ttf"),
    Path("/usr/share/fonts/truetype/noto/NotoSansArabic-Bold.ttf"),
    Path("/usr/share/fonts/opentype/noto/NotoSansArabic-Bold.ttf"),
    Path(__file__).resolve().parent.parent / "assets" / "fonts" / "NotoSansArabic-Bold.ttf",
)


def ensure_lab_pdf_fonts() -> tuple[str, str]:
    global _FONT_READY
    if _FONT_READY:
        return FONT_REGULAR, FONT_BOLD

    regular_path = next((p for p in _FONT_CANDIDATES if p.exists()), None)
    if regular_path:
        pdfmetrics.registerFont(TTFont(FONT_REGULAR, str(regular_path)))
        bold_path = next((p for p in _BOLD_CANDIDATES if p.exists()), regular_path)
        pdfmetrics.registerFont(TTFont(FONT_BOLD, str(bold_path)))
        _FONT_READY = True
        return FONT_REGULAR, FONT_BOLD

    _FONT_READY = True
    return "Helvetica", "Helvetica-Bold"


def contains_arabic(text: str) -> bool:
    return bool(text and _ARABIC_RE.search(text))


def reshape_arabic(text: str | None) -> str:
    """Reshape Arabic glyphs for ReportLab Paragraph (no bidi reordering)."""
    if not text:
        return ""
    raw = str(text).strip()
    if not contains_arabic(raw):
        return raw
    try:
        import arabic_reshaper

        return arabic_reshaper.reshape(raw)
    except Exception:
        return raw


def shape_for_pdf(text: str | None) -> str:
    """Visual-order Arabic for canvas.drawString only — never mix with English labels."""
    if not text:
        return ""
    raw = str(text).strip()
    if not contains_arabic(raw):
        return raw
    try:
        import arabic_reshaper
        from bidi.algorithm import get_display

        return get_display(arabic_reshaper.reshape(raw))
    except Exception:
        return raw


def pdf_escape(text: str | None) -> str:
    return html.escape(str(text or ""), quote=True)


def pdf_text(text: str | None) -> str:
    """Safe text for Paragraph — reshape Arabic, keep English readable."""
    return pdf_escape(reshape_arabic(text))
