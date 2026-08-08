"""Unit tests for professional lab report PDF table layout."""

from app.services.lab_report_pdf_builder import LabReportPdfBuilder, ReportRow


class _FakeDb:
    pass


def test_results_table_renders_abnormal_marker():
    builder = LabReportPdfBuilder(_FakeDb())
    rows = [
        ReportRow("Haemoglobin", "16.5", "g/dl", "12.5 - 17.5"),
        ReportRow("RBCs Count", "6.08", "10^6/µl", "4.5 - 5.5", abnormal=True),
    ]
    table = builder._results_table(rows)
    data = table._cellvalues
    assert data[0][0] == "Test"
    assert "↑ 6.08" in data[2][1]


def test_results_sections_splits_differential():
    builder = LabReportPdfBuilder(_FakeDb())
    rows = [
        ReportRow("Haemoglobin", "14", "g/dl", "12.5 - 17.5", section="main"),
        ReportRow("Neutrophils %", "55", " %", "40 - 70", section="differential"),
    ]
    parts = builder._results_sections(rows)
    assert len(parts) >= 3
