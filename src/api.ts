import { demoMode } from "./config"

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public retryAfterSeconds?: number,
  ) {
    super(message)
  }
}

export const apiOrigin = window.location.origin
const pending = new Map<string, Promise<unknown>>()
const cache = new Map<string, { value: unknown; until: number }>()
let generation = 0
let cooldownUntil = 0

export function clearReadCache() {
  generation++
  cache.clear()
  pending.clear()
}

function apiUrl(path: string) {
  const url = new URL(path, apiOrigin)
  if (
    url.origin !== apiOrigin ||
    !(url.pathname.startsWith("/api/shop/") || url.pathname === "/api/shop-auth/me")
  ) {
    throw new Error("Use a public ServerSentry shop API path.")
  }
  return url
}

async function body(response: Response): Promise<unknown> {
  const data: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    const message =
      data && typeof data === "object" && "error" in data && typeof data.error === "string"
        ? data.error
        : `API request failed (${response.status}).`
    throw new ApiError(message, response.status)
  }
  if (data === null) throw new Error("Expected JSON from ServerSentry. Check the /api proxy configuration.")
  return data
}

export async function getJson<T>(
  path: string,
  { fresh = false, ttlMs = 5_000 }: { fresh?: boolean; ttlMs?: number } = {},
): Promise<T> {
  if (demoMode) throw new Error("Backend actions are disabled in demo mode.")
  const url = apiUrl(path)
  const saved = cache.get(url.href)
  if (!fresh && saved && saved.until > Date.now()) return structuredClone(saved.value) as T
  if (!pending.has(url.href)) {
    const version = generation
    const request = (async () => {
      for (let attempt = 0; attempt < 2; attempt++) {
        if (cooldownUntil > Date.now())
          await new Promise((resolve) => setTimeout(resolve, cooldownUntil - Date.now()))
        const response = await fetch(url, {
          credentials: "include",
          headers: { Accept: "application/json" },
          signal: AbortSignal.timeout(15_000),
        })
        if (response.status === 429) {
          const data = (await response.json().catch(() => null)) as { retryAfterSeconds?: number } | null
          const header = response.headers.get("Retry-After")
          const wait =
            header && /^\d+$/.test(header)
              ? Number(header) * 1000
              : header && Number.isFinite(Date.parse(header))
                ? Math.max(0, Date.parse(header) - Date.now())
                : Math.max(1, Number(data?.retryAfterSeconds) || 60) * 1000
          cooldownUntil = Math.max(cooldownUntil, Date.now() + wait)
          if (attempt === 0 && wait <= 60_000) continue
          throw new ApiError("Too many requests. Please try again later.", 429, Math.ceil(wait / 1000))
        }
        const value = await body(response)
        // Keep the short cache limited to public settings/catalog and this session.
        if (version === generation && !url.pathname.includes("/checkout/")) {
          if (cache.size >= 100) cache.delete(cache.keys().next().value!)
          cache.set(url.href, { value, until: Date.now() + Math.min(60_000, Math.max(0, ttlMs)) })
        }
        return value
      }
      throw new Error("API request failed.")
    })()
    pending.set(url.href, request)
    void request
      .finally(() => {
        if (pending.get(url.href) === request) pending.delete(url.href)
      })
      .catch(() => {})
  }
  return structuredClone(await pending.get(url.href)) as T
}

export async function postJson<T>(
  path: "/api/shop/access" | "/api/shop-auth/logout" | "/api/shop/checkout",
  payload?: unknown,
): Promise<T> {
  requireAccountActions()
  const csrfResponse = await fetch("/api/auth/csrf", {
    credentials: "include",
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(15_000),
  })
  const csrf = (await body(csrfResponse)) as { token?: string }
  if (typeof csrf.token !== "string" || !csrf.token)
    throw new Error("Could not prepare this action. Reload the page.")
  const response = await fetch(path, {
    method: "POST",
    credentials: "include",
    redirect: "error",
    signal: AbortSignal.timeout(15_000),
    headers: { Accept: "application/json", "Content-Type": "application/json", "X-CSRF-TOKEN": csrf.token },
    ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
  })
  const value = await body(response)
  clearReadCache()
  return value as T // Mutations, including checkout, are never retried.
}

export function requireAccountActions() {
  if (demoMode) throw new Error("Account and payment actions are disabled in demo mode.")
  if (window.parent !== window) throw new Error("Use custom_site mode for this website.")
}
