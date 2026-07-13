from app.services.label_service import KitLabelData, build_kit_labels_pdf


def _sample_label(**kwargs) -> KitLabelData:
    defaults = dict(
        patient_name="Ahmed Ali",
        patient_code="P000001",
        test_name="Glucose",
        test_code="GLU",
        sample_type="Serum",
        order_number="ORD-00001",
        date_str="13/06/2026",
        barcode="ORD-00001-GLU",
        lab_name="Ahram Lab",
    )
    defaults.update(kwargs)
    return KitLabelData(**defaults)


def test_single_label_pdf():
    pdf = build_kit_labels_pdf([_sample_label()], layout="single")
    assert pdf[:4] == b"%PDF"


def test_double_layout_pdf():
    pdf = build_kit_labels_pdf(
        [_sample_label(test_code="GLU"), _sample_label(test_code="CBC", barcode="ORD-00001-CBC")],
        layout="double",
    )
    assert pdf[:4] == b"%PDF"


def test_all_order_labels_single():
    labels = [
        _sample_label(test_code="GLU", barcode="ORD-00001-GLU"),
        _sample_label(test_code="CBC", test_name="CBC", barcode="ORD-00001-CBC"),
        _sample_label(test_code="TSH", test_name="TSH", barcode="ORD-00001-TSH"),
    ]
    pdf = build_kit_labels_pdf(labels, layout="single")
    assert len(pdf) > 500
