"""Unit tests for professional lab report PDF table layout."""

from io import BytesIO
from unittest.mock import AsyncMock

from reportlab.lib.pagesizes import A4
from reportlab.platypus import SimpleDocTemplate, Spacer

from app.services.lab_report_pdf_builder import LabReportPdfBuilder, ReportRow


class _FakeDb:
    pass


def _cell_text(cell) -> str:
    if hasattr(cell, "text"):
        return cell.text
    return str(cell)


def test_results_table_renders_abnormal_marker():
    builder = LabReportPdfBuilder(_FakeDb())
    rows = [
        ReportRow("Haemoglobin", "16.5", "g/dl", "12.5 - 17.5"),
        ReportRow("RBCs Count", "6.08", "10^6/µl", "4.5 - 5.5", abnormal=True),
    ]
    table = builder._results_table(rows)
    header_text = _cell_text(table._cellvalues[0][0])
    assert "Test" in header_text
    abnormal_cell = _cell_text(table._cellvalues[2][1])
    assert "6.08" in abnormal_cell


def test_results_sections_splits_differential():
    builder = LabReportPdfBuilder(_FakeDb())
    rows = [
        ReportRow("Haemoglobin", "14", "g/dl", "12.5 - 17.5", section="main"),
        ReportRow("Neutrophils %", "55", " %", "40 - 70", section="differential"),
    ]
    parts = builder._results_sections(rows)
    assert len(parts) >= 3


def test_gray_title_bar_has_content_width():
    builder = LabReportPdfBuilder(_FakeDb())
    bar = builder._gray_title_bar("Complete Blood Picture")
    assert bar._colWidths[0] == builder.CONTENT_W


def test_sample_report_pdf_bytes():
    builder = LabReportPdfBuilder(_FakeDb())
    rows = [ReportRow("Result", "12", "", "—")]
    buf = BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        leftMargin=builder.MARGIN_X,
        rightMargin=builder.MARGIN_X,
        topMargin=builder.MARGIN_TOP,
        bottomMargin=builder.MARGIN_BOTTOM,
    )
    doc.build(
        [
            builder._gray_title_bar("Complete Blood Picture"),
            Spacer(1, 3),
            builder._results_table(rows),
        ]
    )
    pdf = buf.getvalue()
    assert pdf[:4] == b"%PDF"
    assert len(pdf) > 5000
