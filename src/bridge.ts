import type {
  CheckoutPayload,
  ShopAccessStatus,
  ShopCustomer,
  ShopLandingSettings,
  ShopPaymentConfiguration,
  ShopProduct,
  StorefrontContext,
} from "./types"

const query = new URLSearchParams(window.location.search)
const apiBaseUrlFromQuery = query.get("serversentryApiBaseUrl")?.replace(/\/$/, "") ?? ""
const parentOrigin = document.referrer ? new URL(document.referrer).origin : "*"

export function announceReady() {
  window.parent.postMessage({ type: "serversentry.ready" }, parentOrigin)
}

export function sendBridgeMessage(type: string, payload?: unknown) {
  window.parent.postMessage(payload === undefined ? { type } : { type, payload }, parentOrigin)
}

export function loginWithSteam() {
  if (window.parent !== window) {
    sendBridgeMessage("serversentry.login.steam")
    return
  }

  window.location.assign(`${apiBaseUrlFromQuery}/api/shop-auth/steam/start?returnUrl=${encodeURIComponent("/shop")}`)
}

export async function logout() {
  if (window.parent !== window) {
    sendBridgeMessage("serversentry.logout")
    return
  }

  await fetch(`${apiBaseUrlFromQuery}/api/shop-auth/logout`, {
    method: "POST",
    credentials: "include",
    headers: { Accept: "application/json" },
  })
  window.location.reload()
}

export function linkDiscord() {
  if (window.parent !== window) {
    sendBridgeMessage("serversentry.discord.link")
    return
  }

  window.location.assign(`${apiBaseUrlFromQuery}/api/shop-auth/discord/link/start?returnUrl=${encodeURIComponent("/shop")}`)
}

export async function startCheckout(payload: CheckoutPayload) {
  if (window.parent !== window) {
    sendBridgeMessage("serversentry.checkout", payload)
    return
  }

  const response = await fetch(`${apiBaseUrlFromQuery}/api/shop/checkout`, {
    method: "POST",
    credentials: "include",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      productId: payload.productId,
      provider: payload.provider,
      customerDetails: payload.customerDetails,
      targetSteamId64: payload.targetSteamId64,
      successUrl: "/checkout/success",
      cancelUrl: "/checkout/cancel",
    }),
  })

  if (response.status === 401) {
    loginWithSteam()
    return
  }

  const data = await parseJson(response)
  if (!response.ok) {
    throw new Error(getErrorMessage(data, "Checkout could not be started."))
  }

  if (!data || typeof data !== "object" || !("redirectUrl" in data)) {
    throw new Error("Checkout did not return a redirect URL.")
  }

  window.location.assign(String(data.redirectUrl))
}

export async function unlockShopAccess(password: string) {
  const response = await fetch(`${apiBaseUrlFromQuery}/api/shop/access`, {
    method: "POST",
    credentials: "include",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ password }),
  })
  const data = await parseJson(response)
  if (!response.ok) {
    throw new Error(getErrorMessage(data, "The store could not be unlocked."))
  }
  return loadStandaloneContext()
}

export async function loadStandaloneContext(): Promise<StorefrontContext> {
  const apiBaseUrl = apiBaseUrlFromQuery
  const [landing, access, customer] = await Promise.all([
    getJson<ShopLandingSettings>(`${apiBaseUrl}/api/shop/landing`),
    getJson<ShopAccessStatus>(`${apiBaseUrl}/api/shop/access`),
    getJson<ShopCustomer>(`${apiBaseUrl}/api/shop-auth/me`),
  ])

  let products: ShopProduct[] = []
  let payments: ShopPaymentConfiguration | null = null

  if (!access.restricted || access.allowed) {
    ;[products, payments] = await Promise.all([
      getJson<ShopProduct[]>(`${apiBaseUrl}/api/shop/products`),
      getJson<ShopPaymentConfiguration>(`${apiBaseUrl}/api/shop/payments`),
    ])
  }

  return {
    version: 1,
    route: (query.get("serversentryRoute") === "landing" ? "landing" : "shop"),
    path: window.location.pathname + window.location.search,
    apiBaseUrl,
    endpoints: {},
    bridgeMessages: {},
    landing,
    customer,
    access,
    payments,
    products,
    isLoading: false,
  }
}

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    credentials: "include",
    headers: { Accept: "application/json" },
  })
  const data = await parseJson(response)

  if (!response.ok) {
    throw new Error(getErrorMessage(data, `API request failed (${response.status}).`))
  }

  return data as T
}

async function parseJson(response: Response): Promise<unknown> {
  const text = await response.text()
  if (!text) return null

  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

function getErrorMessage(data: unknown, fallback: string) {
  if (typeof data === "string" && data.trim()) return data
  if (data && typeof data === "object" && "error" in data && typeof data.error === "string") {
    return data.error
  }
  return fallback
}
