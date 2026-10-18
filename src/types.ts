export type ShopCheckoutFieldOption = {
  label: string
  value: string
}

export type ShopCheckoutField = {
  id: string
  type: string
  label: string
  prompt?: string | null
  isRequired: boolean
  sortOrder: number
  placeholder?: string | null
  helpText?: string | null
  options: ShopCheckoutFieldOption[]
}

export type ShopProductVariantConfiguration = {
  groupId?: string | null
  groupName?: string | null
  label?: string | null
}

// Public sibling summaries omit checkout fields. Use full catalog products for checkout.
export type ShopProductVariant = Pick<
  ShopProduct,
  | "id"
  | "slug"
  | "name"
  | "variantConfiguration"
  | "purchaseType"
  | "subscriptionInterval"
  | "subscriptionIntervalCount"
  | "subscriptionEntitlementDays"
  | "priceAmountMinor"
  | "currency"
  | "isActive"
  | "payPalPlanId"
>

export type ShopProduct = {
  id: string
  slug: string
  name: string
  description: string
  shortDescription?: string | null
  category?: string | null
  imageUrl?: string | null
  imageUrls?: string[]
  priceAmountMinor: number
  currency: string
  purchaseType: string
  subscriptionInterval: string
  subscriptionIntervalCount: number
  subscriptionEntitlementDays?: number | null
  durationDays?: number | null
  isActive: boolean
  sortOrder: number
  checkoutFields: ShopCheckoutField[]
  requiresDiscordLink?: boolean
  discordDeliveryOptional?: boolean
  allowFriendPurchase?: boolean
  variantConfiguration?: ShopProductVariantConfiguration | null
  variants?: ShopProductVariant[] | null
  payPalPlanId?: string | null
}

export type ShopCustomer = {
  authenticated: boolean
  steamId64?: string | null
  displayName?: string | null
  avatarUrl?: string | null
  steamProfileUrl?: string | null
  discordLinked?: boolean
  discordUserId?: string | null
}

export type ShopAccessStatus = {
  restricted: boolean
  allowed: boolean
  mode: string
  title: string
  message: string
  passwordConfigured: boolean
}

export type ShopPaymentConfiguration = {
  activeProvider: string
  currency: string
  payPalEnabled: boolean
  stripeEnabled: boolean
  payPalConfigured: boolean
  stripeConfigured: boolean
  payPalBlockedCountries?: string[]
  stripeBlockedCountries?: string[]
}

export type ShopLandingSettings = {
  storeName: string
  heroTitle: string
  heroSubtitle: string
  heroImageUrl?: string | null
  headerLogoUrl?: string | null
  brandTagline?: string | null
  accentColor?: string | null
  shopEnabled: boolean
  shopProductsEyebrow?: string | null
  shopProductsTitle?: string | null
  shopProductsSubtitle?: string | null
  footerText?: string | null
  legalPagesJson?: string | null
}

export type StorefrontContext = {
  version: number
  route: "landing" | "shop"
  path: string
  apiBaseUrl: string
  landing: ShopLandingSettings
  customer: ShopCustomer | null
  access: ShopAccessStatus | null
  payments: ShopPaymentConfiguration | null
  products: ShopProduct[]
  isLoading: boolean
}

export type CheckoutPayload = {
  productId?: string | null
  productSlug?: string | null
  provider?: string | null
  customerDetails?: Record<string, string>
  targetSteamId64?: string | null
  countryCode?: string | null
}
