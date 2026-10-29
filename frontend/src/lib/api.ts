import axios, { AxiosError } from "axios";
import { getApiBaseUrl } from "./api-base";
import { clearSession } from "./session";

const API_URL = getApiBaseUrl();

export const api = axios.create({
  baseURL: API_URL,
  headers: { "Content-Type": "application/json" },
  timeout: 60000,
});

api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    config.baseURL = getApiBaseUrl();
  }
  if (config.data instanceof FormData) {
    delete config.headers["Content-Type"];
  }
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("access_token");
    const isPlatform = localStorage.getItem("is_platform_admin") === "true";
    const url = config.url || "";

    if (token) config.headers.Authorization = `Bearer ${token}`;

    // Platform APIs must NOT send tenant header (causes 403/400)
    if (!isPlatform && !url.startsWith("/platform") && !url.startsWith("/auth/platform") && !url.startsWith("/public")) {
      const tenantId = localStorage.getItem("tenant_id");
      if (tenantId) config.headers["X-Tenant-Id"] = tenantId;
    }
  }
  return config;
});

// Refresh tokens are single-use, so concurrent 401s must share one refresh request —
// otherwise every request after the first fails and the user is signed out.
let refreshInFlight: Promise<string> | null = null;

function refreshAccessToken(): Promise<string> {
  if (!refreshInFlight) {
    const refresh_token = localStorage.getItem("refresh_token");
    refreshInFlight = axios
      .post(`${getApiBaseUrl()}/auth/refresh`, { refresh_token })
      .then(({ data }) => {
        localStorage.setItem("access_token", data.access_token);
        localStorage.setItem("refresh_token", data.refresh_token);
        return data.access_token as string;
      })
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}

const SIGN_IN_URLS = ["/auth/login", "/auth/platform/login", "/auth/demo-login"];

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const config = error.config as typeof error.config & { _retry?: boolean };
    // Sign-in screens show their own errors; never redirect away from them.
    const isAuthCall = SIGN_IN_URLS.some((u) => (config?.url || "").includes(u));
    if (error.response?.status === 403 && typeof window !== "undefined" && !isAuthCall) {
      const detail = (error.response?.data as { detail?: string })?.detail;
      if (typeof detail === "string" && detail.startsWith("Tenant account is")) {
        clearSession();
        sessionStorage.setItem("login_error", detail);
        window.location.href = "/login?suspended=1";
        return Promise.reject(error);
      }
    }
    if (error.response?.status === 401 && typeof window !== "undefined" && config) {
      const isPlatform = localStorage.getItem("is_platform_admin") === "true";
      if (localStorage.getItem("refresh_token") && !config._retry && !isAuthCall) {
        config._retry = true;
        try {
          const accessToken = await refreshAccessToken();
          config.headers = config.headers || {};
          config.headers.Authorization = `Bearer ${accessToken}`;
          return api(config);
        } catch {
          /* fall through to sign-out */
        }
      }
      if (!isAuthCall) {
        clearSession();
        window.location.href = isPlatform ? "/platform/login" : "/login";
      }
    }
    return Promise.reject(error);
  }
);

const ARABIC_MESSAGES: Record<string, string> = {
  "Invalid credentials": "اسم المستخدم أو كلمة المرور غير صحيحة",
  "Invalid tenant code": "كود المختبر غير صحيح",
  "Tenant code is required": "كود المختبر مطلوب",
  "Account is inactive": "هذا الحساب غير مفعّل",
  "Tenant account is suspended": "تم تعليق حساب المختبر. تواصل مع إدارة المنصة.",
  "Tenant account is locked": "تم قفل حساب المختبر. تواصل مع إدارة المنصة.",
  "Tenant account is expired": "انتهى اشتراك المختبر. جدّد الاشتراك لاستعادة الدخول.",
  "Demo link is invalid or has expired": "رابط العرض غير صالح أو انتهت صلاحيته",
  "This demo link is no longer active": "رابط العرض لم يعد مفعّلاً",
  "Current password is incorrect": "كلمة المرور الحالية غير صحيحة",
  "New password must be different from the current password": "يجب أن تختلف كلمة المرور الجديدة عن الحالية",
  "Subscription has expired — renew it to restore access": "انتهى الاشتراك — جدّده لاستعادة الدخول",
  "Enter the result values before releasing": "أدخل قيم النتيجة قبل الإصدار",
  "Laboratory code already exists": "كود المختبر مستخدم بالفعل",
  "Tenant code already exists": "كود المختبر مستخدم بالفعل",
};

function currentLocale(): "ar" | "en" {
  if (typeof window === "undefined") return "ar";
  try {
    const state = JSON.parse(localStorage.getItem("labmaster-auth") || "{}").state || {};
    const isPlatform = window.location.pathname.startsWith("/platform");
    return (isPlatform ? state.platformLocale ?? "en" : state.locale ?? "ar") === "ar" ? "ar" : "en";
  } catch {
    return "ar";
  }
}

/** Show known server messages in Arabic when the UI is in Arabic. */
export function localizeApiMessage(message: string, locale: "ar" | "en" = currentLocale()): string {
  if (locale !== "ar") return message;
  if (ARABIC_MESSAGES[message]) return ARABIC_MESSAGES[message];
  if (message.startsWith("Too Many Requests") || message.includes("Rate limit exceeded")) {
    return "محاولات كثيرة. انتظر دقيقة ثم حاول مرة أخرى.";
  }
  return message;
}

export function getApiError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    if (error.response?.status === 429) {
      return localizeApiMessage("Too many attempts. Wait a minute and try again.");
    }
    const detail = error.response?.data?.detail;
    if (typeof detail === "string") return localizeApiMessage(detail);
    if (Array.isArray(detail)) return detail.map((d) => d.msg || d).join(", ");
    if (detail && typeof detail === "object") {
      const message = (detail as { message?: string }).message;
      if (message) return message;
    }
    const status = error.response?.status;
    if (status) return `Request failed (${status})`;
    return error.message;
  }
  return "An error occurred";
}
