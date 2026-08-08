"""Standard result form fields (e.g. CBC) — aligned with professional reference-lab layouts."""

from dataclasses import dataclass


@dataclass(frozen=True)
class ResultFieldDef:
    parameter_name: str
    parameter_name_ar: str
    unit: str
    reference: str
    sort_order: int
    section: str = "main"


CBC_RESULT_FIELDS: list[ResultFieldDef] = [
    ResultFieldDef("Haemoglobin", "هيموجلوبين", "g/dl", "12.5 - 17.5", 0),
    ResultFieldDef("RBCs Count", "عدد كرات الدم الحمراء", "10^6/µl", "4.5 - 5.5", 1),
    ResultFieldDef("HCT", "الحجم النسبي", " %", "40 - 50", 2),
    ResultFieldDef("MCV", "حجم الكرية الوسطي", "fl", "80 - 96", 3),
    ResultFieldDef("MCH", "هيموجلوبين الكرية", "pg", "27 - 32", 4),
    ResultFieldDef("MCHC", "تركيز الهيموجلوبين", "g/dl", "32 - 36", 5),
    ResultFieldDef("RDW-CV", "RDW-CV", " %", "11.5 - 14.5", 6),
    ResultFieldDef("WBCs Count", "عدد كرات الدم البيضاء", "10^3/µl", "4.0 - 11.0", 7),
    ResultFieldDef("Platelets", "الصفائح الدموية", "10^3/µl", "150 - 450", 8),
    ResultFieldDef("Neutrophils %", "Neutrophils", " %", "40 - 70", 10, "differential"),
    ResultFieldDef("Lymphocytes %", "Lymphocytes", " %", "20 - 45", 11, "differential"),
    ResultFieldDef("Monocytes %", "Monocytes", " %", "2 - 10", 12, "differential"),
    ResultFieldDef("Eosinophils %", "Eosinophils", " %", "1 - 6", 13, "differential"),
    ResultFieldDef("Basophils %", "Basophils", " %", "0 - 2", 14, "differential"),
    ResultFieldDef("Neutrophils Abs", "Neutrophils Abs", "10^9/L", "2.0 - 7.0", 15, "differential"),
    ResultFieldDef("Lymphocytes Abs", "Lymphocytes Abs", "10^9/L", "1.0 - 4.0", 16, "differential"),
    ResultFieldDef("Monocytes Abs", "Monocytes Abs", "10^9/L", "0.2 - 1.0", 17, "differential"),
    ResultFieldDef("Eosinophils Abs", "Eosinophils Abs", "10^9/L", "0.02 - 0.5", 18, "differential"),
    ResultFieldDef("Basophils Abs", "Basophils Abs", "10^9/L", "0.0 - 0.2", 19, "differential"),
]

STANDARD_TEMPLATES_BY_TEST_CODE: dict[str, list[ResultFieldDef]] = {
    "CBC": CBC_RESULT_FIELDS,
}


def fields_for_test_code(code: str | None) -> list[ResultFieldDef] | None:
    if not code:
        return None
    return STANDARD_TEMPLATES_BY_TEST_CODE.get(code.strip().upper())


def is_generic_result_template(templates: list) -> bool:
    """True when the test only has a placeholder single 'Result' field."""
    if not templates:
        return True
    return len(templates) == 1 and templates[0].parameter_name.strip().lower() == "result"


def form_fields_for_test(code: str | None) -> list[dict] | None:
    """API form field dicts from standard templates (e.g. CBC)."""
    fields = fields_for_test_code(code)
    if not fields:
        return None
    return [
        {
            "parameter_name": f.parameter_name,
            "parameter_name_ar": f.parameter_name_ar,
            "unit": f.unit,
            "field_type": "numeric",
            "sort_order": f.sort_order,
            "reference": f.reference,
            "section": f.section,
        }
        for f in fields
    ]
