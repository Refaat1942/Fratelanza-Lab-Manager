"""PDF fonts with Arabic shaping for lab reports."""

from __future__ import annotations

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

    # Fallback — Arabic will not render correctly
    _FONT_READY = True
    return "Helvetica", "Helvetica-Bold"


def contains_arabic(text: str) -> bool:
    return bool(text and _ARABIC_RE.search(text))


def shape_for_pdf(text: str | None) -> str:
    if not text:
        return ""
    raw = str(text).strip()
    if not contains_arabic(raw):
        return raw
    try:
        import arabic_reshaper
        from bidi.algorithm import get_display

        reshaped = arabic_reshaper.reshape(raw)
        return get_display(reshaped)
    except Exception:
        return raw
