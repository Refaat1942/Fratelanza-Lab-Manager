const SESSION_KEYS = ["access_token", "refresh_token", "tenant_id", "is_platform_admin", "labmaster-branding"];

/** End the session but keep per-browser preferences (last lab code, language). */
export function clearSession() {
  if (typeof window === "undefined") return;
  for (const key of SESSION_KEYS) localStorage.removeItem(key);
}
