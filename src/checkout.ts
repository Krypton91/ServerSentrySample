import type { ShopCheckoutField, StorefrontContext } from "./types"

export function formatPrice(amountMinor: number, currency: string) {
  const formatter = new Intl.NumberFormat("en-GB", { style: "currency", currency: currency || "EUR" })
  return formatter.format(amountMinor / 10 ** (formatter.resolvedOptions().maximumFractionDigits ?? 2))
}

export function getBrowserCountryCode() {
  for (const locale of [navigator.language, ...(navigator.languages ?? [])]) {
    const country = locale.match(/(?:-|_)([A-Za-z]{2})(?:$|-|_)/u)?.[1]
    if (country) return country.toUpperCase()
  }
  return null
}

export function getAvailableProviders(context: StorefrontContext) {
  const payments = context.payments
  if (!payments) return []
  const country = getBrowserCountryCode()
  const blocked = (values?: string[]) =>
    Boolean(country && values?.some((value) => value.toUpperCase() === country))
  return [
    ...(payments.stripeEnabled && payments.stripeConfigured && !blocked(payments.stripeBlockedCountries)
      ? ["stripe"]
      : []),
    ...(payments.payPalEnabled && payments.payPalConfigured && !blocked(payments.payPalBlockedCountries)
      ? ["paypal"]
      : []),
  ].sort((a, b) => (a === payments.activeProvider ? -1 : b === payments.activeProvider ? 1 : 0))
}

export function isSelectField(type: string) {
  return ["select", "cftools_server_select", "game_server_select"].includes(type)
}

const supported = [
  "text",
  "textarea",
  "number",
  "color",
  "checkbox",
  "steam_id64",
  "select",
  "cftools_server_select",
  "game_server_select",
]
export function validateCheckout(
  fields: ShopCheckoutField[],
  details: Record<string, string>,
  recipientMode: "self" | "friend",
  friendSteamId: string,
) {
  if (recipientMode === "friend" && !/^7656119\d{10}$/.test(friendSteamId.trim()))
    return "Enter a valid SteamID64 for the recipient."
  for (const field of fields) {
    if (!supported.includes(field.type) || ["__proto__", "prototype", "constructor"].includes(field.id))
      return "This product needs an unsupported checkout field. Contact the store owner."
    const value = details[field.id] ?? ""
    if (field.isRequired && (field.type === "checkbox" ? value !== "true" : !value.trim()))
      return `Complete “${field.prompt?.trim() || field.label}”.`
    if (!value) continue
    if (isSelectField(field.type) && !field.options.some((option) => option.value === value))
      return `Choose a valid option for “${field.label}”.`
    if (field.type === "number" && !Number.isFinite(Number(value)))
      return `Enter a number for “${field.label}”.`
    if (field.type === "steam_id64" && !/^7656119\d{10}$/.test(value)) return "Enter a valid SteamID64."
    if (field.type === "color" && !/^#[0-9a-f]{6}$/i.test(value)) return "Choose a valid hex color."
  }
  return null
}
