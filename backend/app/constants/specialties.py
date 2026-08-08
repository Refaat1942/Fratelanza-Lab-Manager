"""Medical specialties for referring doctors (EN + AR)."""

SPECIALTIES: list[dict[str, str]] = [
    {"key": "internal", "en": "Internal Medicine", "ar": "باطنة"},
    {"key": "pediatrics", "en": "Pediatrics", "ar": "أطفال"},
    {"key": "gynecology", "en": "Obstetrics & Gynecology", "ar": "نساء وتوليد"},
    {"key": "surgery", "en": "General Surgery", "ar": "جراحة عامة"},
    {"key": "orthopedics", "en": "Orthopedics", "ar": "عظام"},
    {"key": "cardiology", "en": "Cardiology", "ar": "قلب"},
    {"key": "dermatology", "en": "Dermatology", "ar": "جلدية"},
    {"key": "ent", "en": "ENT", "ar": "أنف وأذن وحنجرة"},
    {"key": "ophthalmology", "en": "Ophthalmology", "ar": "عيون"},
    {"key": "urology", "en": "Urology", "ar": "مسالك بولية"},
    {"key": "neurology", "en": "Neurology", "ar": "أعصاب"},
    {"key": "psychiatry", "en": "Psychiatry", "ar": "نفسية"},
    {"key": "dentistry", "en": "Dentistry", "ar": "أسنان"},
    {"key": "family", "en": "Family Medicine", "ar": "طب أسرة"},
    {"key": "other", "en": "Other", "ar": "أخرى"},
]

SPECIALTY_BY_KEY = {s["key"]: s for s in SPECIALTIES}


def resolve_specialty(key: str | None) -> tuple[str | None, str | None]:
    if not key:
        return None, None
    row = SPECIALTY_BY_KEY.get(key)
    if not row:
        return key, key
    return row["en"], row["ar"]
