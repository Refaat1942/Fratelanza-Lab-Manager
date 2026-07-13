"""Thermal sample kit labels (38×25 mm) for lab orders."""

from __future__ import annotations

from dataclasses import dataclass
from io import BytesIO

from reportlab.graphics.barcode import code128
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas

LABEL_W = 38 * mm
LABEL_H = 25 * mm
DOUBLE_PAGE_W = 76 * mm


@dataclass(frozen=True)
class KitLabelData:
    patient_name: str
    patient_code: str
    test_name: str
    test_code: str
    sample_type: str
    order_number: str
    date_str: str
    barcode: str
    lab_name: str = ""


def _truncate(text: str, max_len: int) -> str:
    text = (text or "").strip()
    if len(text) <= max_len:
        return text
    return text[: max_len - 1] + "…"


def _draw_label(c: canvas.Canvas, x: float, y: float, label: KitLabelData) -> None:
    pad = 1.2 * mm
    lx = x + pad
    top = y + LABEL_H - pad

    if label.lab_name:
        c.setFont("Helvetica-Bold", 5)
        c.drawString(lx, top - 2.5 * mm, _truncate(label.lab_name, 16))

    c.setFont("Helvetica-Bold", 6.5)
    c.drawString(lx, top - 6 * mm, _truncate(label.patient_name, 18))

    c.setFont("Helvetica", 5.5)
    c.drawString(lx, top - 9 * mm, f"{label.patient_code}  {label.test_code}")
    c.drawString(lx, top - 12 * mm, _truncate(label.test_name, 22))

    sample = _truncate(label.sample_type, 14)
    if sample:
        c.setFont("Helvetica", 5)
        c.drawString(lx, top - 14.5 * mm, sample)

    c.setFont("Helvetica", 5)
    c.drawString(lx, top - 17 * mm, f"{label.order_number}  {label.date_str}")

    barcode_value = label.barcode[:40]
    bc = code128.Code128(
        barcode_value,
        barHeight=5.5 * mm,
        barWidth=0.14 * mm,
        humanReadable=False,
    )
    bc.drawOn(c, lx, y + 0.8 * mm)


def build_kit_labels_pdf(labels: list[KitLabelData], layout: str = "single") -> bytes:
    if not labels:
        raise ValueError("No labels to print")

    layout = layout if layout in {"single", "double"} else "single"
    buf = BytesIO()

    if layout == "double":
        c = canvas.Canvas(buf, pagesize=(DOUBLE_PAGE_W, LABEL_H))
        for i in range(0, len(labels), 2):
            if i > 0:
                c.showPage()
            _draw_label(c, 0, 0, labels[i])
            if i + 1 < len(labels):
                _draw_label(c, LABEL_W, 0, labels[i + 1])
        c.save()
    else:
        c = canvas.Canvas(buf, pagesize=(LABEL_W, LABEL_H))
        for i, label in enumerate(labels):
            if i > 0:
                c.showPage()
            _draw_label(c, 0, 0, label)
        c.save()

    return buf.getvalue()
