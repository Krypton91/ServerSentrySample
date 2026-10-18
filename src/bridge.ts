import { ApiError, apiOrigin, clearReadCache, getJson, postJson, requireAccountActions } from "./api"
import { demoMode, safeOrigin } from "./config"
import { DEMO_CONTEXT } from "./demo"
import { getAvailableProviders, validateCheckout } from "./checkout"
import type {
  CheckoutPayload,
  ShopAccessStatus,
  ShopCustomer,
  ShopLandingSettings,
  ShopPaymentConfiguration,
  ShopProduct,
  StorefrontContext,
} from "./types"

const listeners = new Set<(context: StorefrontContext) => void>()
const errors = new Set<(error: Error) => void>()
let context: StorefrontContext | null = null
let lastError: Error | null = null
let started = false
let standaloneFlight: Promise<StorefrontContext> | null = null
let refreshFlight: Promise<StorefrontContext> | null = null
let checkoutPending = false

function publish(value: StorefrontContext) {
  context = value
  lastError = null
  for (const listener of listeners) listener(value)
}
function failed(error: unknown) {
  lastError = error instanceof Error ? error : new Error("The website could not be loaded.")
  for (const listener of errors) listener(lastError)
}
export function currentPath() {
  return window.location.pathname + window.location.search + window.location.hash
}

export function connectStorefront(
  onContext: (value: StorefrontContext) => void,
  onError: (error: Error) => void,
) {
  listeners.add(onContext)
  errors.add(onError)
  if (context) onContext(context)
  if (lastError) onError(lastError)
  if (!started) {
    started = true
    window.addEventListener("pageshow", (event) => {
      if (event.persisted && !demoMode) {
        checkoutPending = false
        void refreshStorefront().catch(failed)
      }
    })
    if (window.parent !== window)
      failed(
        new Error("This website requires custom_site mode. Save that mode in ServerSentry Landing settings."),
      )
    else if (demoMode) publish({ ...DEMO_CONTEXT, path: currentPath() })
    else void refreshStorefront().catch(failed)
  }
  return () => {
    listeners.delete(onContext)
    errors.delete(onError)
  }
}

function authenticate(path: string) {
  requireAccountActions()
  const url = new URL(path, apiOrigin)
  url.searchParams.set("returnUrl", currentPath())
  window.location.assign(url.href)
}
export function loginWithSteam() {
  authenticate("/api/shop-auth/steam/start")
}
export function linkDiscord() {
  authenticate("/api/shop-auth/discord/link/start")
}
export async function logout() {
  await postJson("/api/shop-auth/logout")
  await refreshStorefront()
}

export function loadStandaloneContext(fresh = false): Promise<StorefrontContext> {
  if (standaloneFlight) return standaloneFlight
  standaloneFlight = (async (): Promise<StorefrontContext> => {
    const [landing, access, customer] = await Promise.all([
      getJson<ShopLandingSettings>("/api/shop/landing", { fresh }),
      getJson<ShopAccessStatus>("/api/shop/access", { fresh }),
      getJson<ShopCustomer>("/api/shop-auth/me", { fresh }),
    ])
    if (
      !landing ||
      typeof landing.shopEnabled !== "boolean" ||
      typeof access?.allowed !== "boolean" ||
      typeof customer?.authenticated !== "boolean"
    )
      throw new Error("ServerSentry returned incomplete store data.")
    const open = landing.shopEnabled && access.allowed && access.mode !== "maintenance"
    const [products, payments] = open
      ? await Promise.all([
          getJson<ShopProduct[]>("/api/shop/products", { fresh }),
          getJson<ShopPaymentConfiguration>("/api/shop/payments", { fresh }),
        ])
      : [[], null]
    if (!Array.isArray(products)) throw new Error("ServerSentry returned an invalid product catalog.")
    return {
      version: 1,
      route: "shop",
      path: currentPath(),
      apiBaseUrl: apiOrigin,
      landing,
      customer,
      access,
      payments,
      products,
      isLoading: false,
    }
  })().finally(() => {
    standaloneFlight = null
  })
  return standaloneFlight
}

export function refreshStorefront(): Promise<StorefrontContext> {
  if (demoMode) {
    publish(DEMO_CONTEXT)
    return Promise.resolve(DEMO_CONTEXT)
  }
  if (refreshFlight) return refreshFlight
  clearReadCache()
  refreshFlight = loadStandaloneContext(true)
    .then((value) => {
      publish(value)
      return value
    })
    .finally(() => {
      refreshFlight = null
    })
  return refreshFlight
}
export async function unlockShopAccess(password: string) {
  await postJson("/api/shop/access", { password })
  return refreshStorefront()
}

export async function startCheckout(payload: CheckoutPayload, displayed: ShopProduct) {
  requireAccountActions()
  if (checkoutPending) throw new Error("Checkout is already starting.")
  checkoutPending = true
  try {
    const fresh = await loadStandaloneContext(true)
    publish(fresh)
    const product = fresh.products.find((item) => item.id === displayed.id && item.isActive)
    if (
      !fresh.landing.shopEnabled ||
      !fresh.access?.allowed ||
      fresh.access.mode === "maintenance" ||
      !product
    )
      throw new Error("This product is currently unavailable.")
    const terms = [
      "priceAmountMinor",
      "currency",
      "checkoutFields",
      "requiresDiscordLink",
      "discordDeliveryOptional",
      "allowFriendPurchase",
      "purchaseType",
      "subscriptionInterval",
      "subscriptionIntervalCount",
      "subscriptionEntitlementDays",
      "durationDays",
      "variantConfiguration",
      "payPalPlanId",
    ] as const
    if (terms.some((key) => JSON.stringify(product[key]) !== JSON.stringify(displayed[key])))
      throw new Error("Product details changed. Close and reopen this product to review them.")
    if (!fresh.customer?.authenticated) {
      loginWithSteam()
      return
    }
    const friend = payload.targetSteamId64 && payload.targetSteamId64 !== fresh.customer.steamId64
    if (friend && (!product.allowFriendPurchase || !/^7656119\d{10}$/.test(payload.targetSteamId64!)))
      throw new Error("This recipient is not allowed.")
    if (
      product.requiresDiscordLink &&
      !product.discordDeliveryOptional &&
      !friend &&
      !fresh.customer.discordLinked
    )
      throw new Error("Link your Discord account before purchasing this product.")
    const provider = payload.provider
    if (!provider || !getAvailableProviders(fresh).includes(provider))
      throw new Error("This payment provider is unavailable.")
    const issue = validateCheckout(
      product.checkoutFields,
      payload.customerDetails ?? {},
      friend ? "friend" : "self",
      payload.targetSteamId64 ?? "",
    )
    if (issue) throw new Error(issue)
    const request: CheckoutPayload = {
      productId: product.id,
      productSlug: product.slug,
      provider,
      customerDetails: payload.customerDetails,
      targetSteamId64: payload.targetSteamId64,
      countryCode: payload.countryCode,
    }
    const response = await postJson<{ redirectUrl: string }>("/api/shop/checkout", request)
    if (typeof response.redirectUrl !== "string" || !response.redirectUrl.trim())
      throw new Error("Checkout did not return a redirect URL.")
    const redirect = new URL(response.redirectUrl, apiOrigin)
    if (
      redirect.username ||
      redirect.password ||
      (redirect.protocol !== "https:" &&
        !(
          redirect.origin === window.location.origin &&
          redirect.protocol === "http:" &&
          safeOrigin(redirect.origin)
        ))
    )
      throw new Error("Checkout returned an invalid redirect URL.")
    window.location.assign(redirect.href)
  } catch (error) {
    checkoutPending = false
    if (error instanceof ApiError && error.status === 401) {
      loginWithSteam()
      return
    }
    throw error
  }
}
