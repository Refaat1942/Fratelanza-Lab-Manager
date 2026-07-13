from app.services.label_service import KitLabelData, build_kit_labels_pdf


def _sample_label(**kwargs) -> KitLabelData:
    defaults = dict(
        lab_name="Ahram Laboratory",
        patient_name="Ahmed Ali",
        test_name="Glucose",
        collection_date="13/07/2026",
        barcode="ORD-00001-GLU",
        patient_code="P000001",
        test_code="GLU",
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
