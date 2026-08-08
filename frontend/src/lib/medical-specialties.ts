export const MEDICAL_SPECIALTIES = [
  { key: "internal", en: "Internal Medicine", ar: "باطنة" },
  { key: "pediatrics", en: "Pediatrics", ar: "أطفال" },
  { key: "gynecology", en: "Obstetrics & Gynecology", ar: "نساء وتوليد" },
  { key: "surgery", en: "General Surgery", ar: "جراحة عامة" },
  { key: "orthopedics", en: "Orthopedics", ar: "عظام" },
  { key: "cardiology", en: "Cardiology", ar: "قلب" },
  { key: "dermatology", en: "Dermatology", ar: "جلدية" },
  { key: "ent", en: "ENT", ar: "أنف وأذن وحنجرة" },
  { key: "ophthalmology", en: "Ophthalmology", ar: "عيون" },
  { key: "urology", en: "Urology", ar: "مسالك بولية" },
  { key: "neurology", en: "Neurology", ar: "أعصاب" },
  { key: "psychiatry", en: "Psychiatry", ar: "نفسية" },
  { key: "dentistry", en: "Dentistry", ar: "أسنان" },
  { key: "family", en: "Family Medicine", ar: "طب أسرة" },
  { key: "other", en: "Other", ar: "أخرى" },
] as const;

export function specialtyLabel(key: string, locale: string): string {
  const row = MEDICAL_SPECIALTIES.find((s) => s.key === key);
  if (!row) return key;
  return locale === "ar" ? row.ar : row.en;
}

export function resolveSpecialtyKey(
  specialty?: string | null,
  specialtyAr?: string | null
): string {
  if (!specialty && !specialtyAr) return "";
  const row = MEDICAL_SPECIALTIES.find(
    (s) =>
      s.en === specialty ||
      s.ar === specialtyAr ||
      s.ar === specialty ||
      s.en === specialtyAr
  );
  return row?.key ?? "other";
}
