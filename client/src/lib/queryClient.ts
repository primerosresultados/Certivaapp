import { QueryClient, QueryFunction } from "@tanstack/react-query";

// Token management
let accessToken: string | null = null;
let refreshToken: string | null = null;

export function setTokens(access: string | null, refresh: string | null) {
  accessToken = access;
  refreshToken = refresh;
  if (access) {
    localStorage.setItem("accessToken", access);
  } else {
    localStorage.removeItem("accessToken");
  }
  if (refresh) {
    localStorage.setItem("refreshToken", refresh);
  } else {
    localStorage.removeItem("refreshToken");
  }
}

export function getAccessToken(): string | null {
  if (!accessToken) {
    accessToken = localStorage.getItem("accessToken");
  }
  return accessToken;
}

export function getRefreshToken(): string | null {
  if (!refreshToken) {
    refreshToken = localStorage.getItem("refreshToken");
  }
  return refreshToken;
}

export function clearTokens() {
  accessToken = null;
  refreshToken = null;
  localStorage.removeItem("accessToken");
  localStorage.removeItem("refreshToken");
}

async function refreshAccessToken(): Promise<boolean> {
  const refresh = getRefreshToken();
  if (!refresh) return false;

  try {
    const res = await fetch("/api/auth/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: refresh }),
    });

    if (!res.ok) {
      clearTokens();
      return false;
    }

    const data = await res.json();
    setTokens(data.accessToken, data.refreshToken);
    return true;
  } catch {
    clearTokens();
    return false;
  }
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const token = getAccessToken();
  const headers: Record<string, string> = {};
  
  if (data) {
    headers["Content-Type"] = "application/json";
  }
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  let res = await fetch(url, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
  });

  // If unauthorized, try to refresh token
  if (res.status === 401 && getRefreshToken()) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      headers["Authorization"] = `Bearer ${getAccessToken()}`;
      res = await fetch(url, {
        method,
        headers,
        body: data ? JSON.stringify(data) : undefined,
      });
    }
  }

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const token = getAccessToken();
    const headers: Record<string, string> = {};
    
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    let res = await fetch(queryKey.join("/") as string, { headers });

    // If unauthorized, try to refresh token
    if (res.status === 401 && getRefreshToken()) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        headers["Authorization"] = `Bearer ${getAccessToken()}`;
        res = await fetch(queryKey.join("/") as string, { headers });
      }
    }

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
