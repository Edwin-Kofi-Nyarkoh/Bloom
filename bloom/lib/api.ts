import axios from "axios";

const rawUrl = process.env.NEXT_PUBLIC_API_URL;
const baseURL =
  !rawUrl || rawUrl.includes("localhost:3001")
    ? "/api"
    : rawUrl.endsWith("/api")
    ? rawUrl
    : `${rawUrl.replace(/\/$/, "")}/api`;

const api = axios.create({
  baseURL,
});

/** The message the server sent with a failed request, or `fallback` if there wasn't one. */
export function apiErrorMessage(error: unknown, fallback: string) {
  if (axios.isAxiosError(error)) {
    const message = (error.response?.data as { error?: unknown } | undefined)?.error;
    if (typeof message === "string") return message;
  }
  return fallback;
}

export function apiErrorStatus(error: unknown) {
  return axios.isAxiosError(error) ? error.response?.status : undefined;
}

export default api;
