export const LAB_MODULE_KEYS = [
  "dashboard",
  "patients",
  "doctors",
  "referrals",
  "tests",
  "results",
  "billing",
  "expenses",
  "inventory",
  "purchasing",
  "suppliers",
  "crm",
  "marketing",
  "accounting",
  "reports",
  "users",
  "branches",
  "settings",
] as const;

export type LabModuleKey = (typeof LAB_MODULE_KEYS)[number];

/** Map pathname to module key for route guards. */
export function pathnameToModule(pathname: string): LabModuleKey | null {
  const segment = pathname.split("/").filter(Boolean)[0];
  if (!segment) return "dashboard";
  if (LAB_MODULE_KEYS.includes(segment as LabModuleKey)) {
    return segment as LabModuleKey;
  }
  return null;
}
