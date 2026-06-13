import axios, { AxiosError } from "axios";
import { getApiBaseUrl } from "./api-base";

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

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const config = error.config as typeof error.config & { _retry?: boolean };
    if (error.response?.status === 403 && typeof window !== "undefined") {
      const detail = (error.response?.data as { detail?: string })?.detail;
      if (typeof detail === "string" && detail.startsWith("Tenant account is")) {
        localStorage.clear();
        sessionStorage.setItem("login_error", detail);
        window.location.href = "/login?suspended=1";
        return Promise.reject(error);
      }
    }
    if (error.response?.status === 401 && typeof window !== "undefined" && config) {
      const isPlatform = localStorage.getItem("is_platform_admin") === "true";
      const refresh = localStorage.getItem("refresh_token");
      if (refresh && !config._retry && !isPlatform) {
        config._retry = true;
        try {
          const { data } = await axios.post(`${getApiBaseUrl()}/auth/refresh`, { refresh_token: refresh });
          localStorage.setItem("access_token", data.access_token);
          localStorage.setItem("refresh_token", data.refresh_token);
          config.headers = config.headers || {};
          config.headers.Authorization = `Bearer ${data.access_token}`;
          return api(config);
        } catch {
          localStorage.clear();
          window.location.href = "/login";
        }
      }
      if (isPlatform) {
        localStorage.clear();
        window.location.href = "/platform/login";
      }
    }
    return Promise.reject(error);
  }
);

export function getApiError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data?.detail;
    if (typeof detail === "string") return detail;
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
