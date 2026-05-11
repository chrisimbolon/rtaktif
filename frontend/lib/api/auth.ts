import apiClient from "./client";
import type { LoginPayload, RegisterPayload, TokenResponse, AuthUser } from "@/types";

export const authApi = {
  login: (data: LoginPayload) =>
    apiClient.post<TokenResponse>("/auth/login", data).then((r) => r.data),

  register: (data: RegisterPayload) =>
    apiClient.post<{ id: string; email: string; status: string }>("/auth/register", data).then((r) => r.data),

  me: () =>
    apiClient.get<AuthUser>("/users/me").then((r) => r.data),
};
