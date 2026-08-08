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


def _page_sizes(width_mm: float, height_mm: float) -> tuple[float, float, float]:
    w = width_mm * mm
    h = height_mm * mm
    return w, h, w * 2


@dataclass(frozen=True)
class KitLabelData:
    lab_name: str
    patient_name: str
    test_name: str
    collection_date: str
    barcode: str
    patient_code: str = ""
    test_code: str = ""


def _truncate(text: str, max_len: int) -> str:
    text = (text or "").strip()
    if len(text) <= max_len:
        return text
    return text[: max_len - 1] + "…"


def _draw_label(
    c: canvas.Canvas,
    x: float,
    y: float,
    label: KitLabelData,
    *,
    label_w: float = LABEL_W,
    label_h: float = LABEL_H,
) -> None:
    pad = 1.2 * mm
    lx = x + pad
    top = y + label_h - pad

    c.setFont("Helvetica-Bold", 5.5)
    c.drawString(lx, top - 2.8 * mm, _truncate(label.lab_name, 22))

    c.setFont("Helvetica-Bold", 6.5)
    c.drawString(lx, top - 6.5 * mm, _truncate(label.patient_name, 20))

    c.setFont("Helvetica", 6)
    c.drawString(lx, top - 10 * mm, _truncate(label.test_name, 24))

    c.setFont("Helvetica", 5)
    c.drawString(lx, top - 13 * mm, f"Collection: {label.collection_date}")

    barcode_value = label.barcode[:40]
    bc = code128.Code128(
        barcode_value,
        barHeight=5 * mm,
        barWidth=0.14 * mm,
        humanReadable=False,
    )
    bc.drawOn(c, lx, y + 0.6 * mm)


def apply_label_overrides(label: KitLabelData, overrides: dict) -> KitLabelData:
    data = {
        "lab_name": label.lab_name,
        "patient_name": label.patient_name,
        "test_name": label.test_name,
        "collection_date": label.collection_date,
        "barcode": label.barcode,
        "patient_code": label.patient_code,
        "test_code": label.test_code,
    }
    for key, value in overrides.items():
        if value is not None and str(value).strip():
            data[key] = str(value).strip()
    return KitLabelData(**data)


def build_kit_labels_pdf(
    labels: list[KitLabelData],
    layout: str = "single",
    *,
    width_mm: float = 38,
    height_mm: float = 25,
) -> bytes:
    if not labels:
        raise ValueError("No labels to print")

    layout = layout if layout in {"single", "double"} else "single"
    label_w, label_h, double_w = _page_sizes(width_mm, height_mm)
    buf = BytesIO()

    if layout == "double":
        c = canvas.Canvas(buf, pagesize=(double_w, label_h))
        for i in range(0, len(labels), 2):
            if i > 0:
                c.showPage()
            _draw_label(c, 0, 0, labels[i], label_w=label_w, label_h=label_h)
            if i + 1 < len(labels):
                _draw_label(c, label_w, 0, labels[i + 1], label_w=label_w, label_h=label_h)
        c.save()
    else:
        c = canvas.Canvas(buf, pagesize=(label_w, label_h))
        for i, label in enumerate(labels):
            if i > 0:
                c.showPage()
            _draw_label(c, 0, 0, label, label_w=label_w, label_h=label_h)
        c.save()

    return buf.getvalue()
