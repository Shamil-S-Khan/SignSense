export const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

class ApiClient {
  private getAuthHeader(): Record<string, string> {
    const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  async fetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers = {
      "Content-Type": "application/json",
      ...this.getAuthHeader(),
      ...options.headers,
    };

    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      if (response.status === 401) {
        // Implement token refresh logic here
        // For now, clear token and redirect
        if (typeof window !== "undefined") {
          localStorage.removeItem("access_token");
          if (!window.location.pathname.includes("/login") && !window.location.pathname.includes("/register")) {
            window.location.href = "/login";
          }
        }
      }
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `Request failed with status ${response.status}`);
    }

    return response.json();
  }

  get<T>(endpoint: string, options: RequestInit = {}) {
    return this.fetch<T>(endpoint, { ...options, method: "GET" });
  }

  post<T>(endpoint: string, data: unknown, options: RequestInit = {}) {
    return this.fetch<T>(endpoint, {
      ...options,
      method: "POST",
      body: JSON.stringify(data),
    });
  }
}

export const apiClient = new ApiClient();
