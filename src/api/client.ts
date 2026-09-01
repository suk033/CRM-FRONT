import createClient from "openapi-fetch";
import type { paths } from "./schema";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";
let accessToken: string | null = null;
const listeners = new Set<() => void>();

export function setAccessToken(token: string | null) {
  accessToken = token;
  if (!token) listeners.forEach((listener) => listener());
}
export function getAccessToken() {
  return accessToken;
}
export function onAuthCleared(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export const api = createClient<paths>({
  baseUrl: apiBaseUrl,
  fetch: async (request) => {
    const headers = new Headers(request.headers);
    if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
    const response = await globalThis.fetch(new Request(request, { headers }));
    if (response.status === 401) setAccessToken(null);
    return response;
  },
});
