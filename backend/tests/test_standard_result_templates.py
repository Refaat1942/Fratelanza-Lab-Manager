from app.constants.standard_result_templates import (
    CBC_RESULT_FIELDS,
    fields_for_test_code,
    form_fields_for_test,
    is_generic_result_template,
)


def test_cbc_fields_loaded():
    fields = fields_for_test_code("cbc")
    assert fields is not None
    assert len(fields) == len(CBC_RESULT_FIELDS)
    assert fields[0].parameter_name == "Haemoglobin"


def test_form_fields_for_cbc():
    form = form_fields_for_test("CBC")
    assert form is not None
    assert form[0]["parameter_name"] == "Haemoglobin"
    assert form[0]["reference"] == "12.5 - 17.5"
    assert any(f["section"] == "differential" for f in form)


def test_is_generic_result_template():
    class T:
        def __init__(self, name):
            self.parameter_name = name

    assert is_generic_result_template([]) is True
    assert is_generic_result_template([T("Result")]) is True
    assert is_generic_result_template([T("Haemoglobin"), T("WBCs Count")]) is False
