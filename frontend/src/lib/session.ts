/**
 * The lab app and the platform panel keep separate sessions, so the platform owner can
 * open a demo laboratory in another tab without being signed out of the panel.
 * The portal is decided by the current page: /platform/* is the platform panel.
 */
export type SessionScope = "lab" | "platform";

const KEYS: Record<SessionScope, { access: string; refresh: string }> = {
  lab: { access: "access_token", refresh: "refresh_token" },
  platform: { access: "platform_access_token", refresh: "platform_refresh_token" },
};

export function currentScope(): SessionScope {
  if (typeof window === "undefined") return "lab";
  return window.location.pathname.startsWith("/platform") ? "platform" : "lab";
}

export function getAccessToken(scope: SessionScope = currentScope()): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(KEYS[scope].access);
}

export function getRefreshToken(scope: SessionScope = currentScope()): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(KEYS[scope].refresh);
}

export function setTokens(accessToken: string, refreshToken: string, scope: SessionScope = currentScope()) {
  localStorage.setItem(KEYS[scope].access, accessToken);
  localStorage.setItem(KEYS[scope].refresh, refreshToken);
}

/** End the current portal's session but keep preferences (last lab code, language). */
export function clearSession(scope: SessionScope = currentScope()) {
  if (typeof window === "undefined") return;
  localStorage.removeItem(KEYS[scope].access);
  localStorage.removeItem(KEYS[scope].refresh);
  // Left over from when both portals shared one token.
  localStorage.removeItem("is_platform_admin");
  if (scope === "lab") {
    localStorage.removeItem("tenant_id");
    localStorage.removeItem("labmaster-branding");
  }
}
