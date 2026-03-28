import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, setTokens, clearTokens, getAccessToken, getRefreshToken } from "@/lib/queryClient";
import type { Business } from "@shared/schema";

interface AuthUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: string;
  businessId: string | null;
  profileImageUrl: string | null;
  business?: Business | null;
}

interface LoginResponse {
  message: string;
  user: AuthUser;
  business?: Business | null;
  accessToken: string;
  refreshToken: string;
}

interface RegisterResponse {
  message: string;
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
}

export function useAuth() {
  const queryClient = useQueryClient();

  const { data: user, isLoading, error } = useQuery<AuthUser | null>({
    queryKey: ["/api/auth/user"],
    retry: false,
    enabled: !!getAccessToken(),
  });

  const loginMutation = useMutation({
    mutationFn: async (credentials: { email: string; password: string }) => {
      const res = await apiRequest("POST", "/api/auth/login", credentials);
      return res.json() as Promise<LoginResponse>;
    },
    onSuccess: (data) => {
      setTokens(data.accessToken, data.refreshToken);
      const userWithBusiness = { ...data.user, business: data.business };
      queryClient.setQueryData(["/api/auth/user"], userWithBusiness);
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (data: { email: string; password: string; firstName?: string; lastName?: string; businessId?: string }) => {
      const res = await apiRequest("POST", "/api/auth/register", data);
      return res.json() as Promise<RegisterResponse>;
    },
    onSuccess: (data) => {
      setTokens(data.accessToken, data.refreshToken);
      queryClient.setQueryData(["/api/auth/user"], data.user);
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    },
  });

  const logout = async () => {
    try {
      const token = getAccessToken();
      const refreshToken = getRefreshToken();
      
      await fetch("/api/auth/logout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { "Authorization": `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ refreshToken }),
      });
    } catch {
      // Ignore errors, we're logging out anyway
    }
    
    clearTokens();
    queryClient.setQueryData(["/api/auth/user"], null);
    queryClient.clear();
    window.location.href = "/";
  };

  const isSuperadmin = user?.role === "superadmin";
  const isAdmin = user?.role === "admin" || isSuperadmin;
  const isOperator = user?.role === "operator" || isAdmin;

  return {
    user,
    isLoading,
    isAuthenticated: !!user && !!getAccessToken(),
    isSuperadmin,
    isAdmin,
    isOperator,
    login: loginMutation.mutateAsync,
    loginPending: loginMutation.isPending,
    loginError: loginMutation.error,
    register: registerMutation.mutateAsync,
    registerPending: registerMutation.isPending,
    registerError: registerMutation.error,
    logout,
  };
}
