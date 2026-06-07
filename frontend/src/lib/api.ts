import axios, { AxiosError } from "axios";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

export const api = axios.create({
  baseURL: API_URL,
  headers: { "Content-Type": "application/json" },
  timeout: 30000,
});

api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("access_token");
    const isPlatform = localStorage.getItem("is_platform_admin") === "true";
    const url = config.url || "";

    if (token) config.headers.Authorization = `Bearer ${token}`;

    // Platform APIs must NOT send tenant header (causes 403/400)
    if (!isPlatform && !url.startsWith("/platform") && !url.startsWith("/auth/platform")) {
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
    if (error.response?.status === 401 && typeof window !== "undefined" && config) {
      const isPlatform = localStorage.getItem("is_platform_admin") === "true";
      const refresh = localStorage.getItem("refresh_token");
      if (refresh && !config._retry && !isPlatform) {
        config._retry = true;
        try {
          const { data } = await axios.post(`${API_URL}/auth/refresh`, { refresh_token: refresh });
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
    return error.message;
  }
  return "An error occurred";
}
