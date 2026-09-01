import createClient from "openapi-fetch";
import type { paths } from "./schema";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

export const api = createClient<paths>({
  baseUrl: apiBaseUrl,
  fetch: (...args) => globalThis.fetch(...args),
});
