import { formatPrice } from "./checkout"
import type { ShopProduct } from "./types"

export type CatalogGroup = {
  id: string
  name: string
  representative: ShopProduct
  offers: ShopProduct[]
}

// The API retains every full product in its flat list. Never combine a sibling
// summary with another offer's fields, delivery requirements or permissions.
export function groupCatalogProducts(products: ShopProduct[]): CatalogGroup[] {
  const groups = new Map<string, CatalogGroup>()
  const seen = new Set<string>()
  for (const product of [...products]
    .filter((item) => item.isActive)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))) {
    if (seen.has(product.id)) continue
    seen.add(product.id)
    const groupId = product.variantConfiguration?.groupId
    const id = groupId ? `group:${groupId}` : `product:${product.id}`
    const group = groups.get(id)
    if (group) group.offers.push(product)
    else
      groups.set(id, {
        id,
        name: product.variantConfiguration?.groupName?.trim() || product.name,
        representative: product,
        offers: [product],
      })
  }
  return [...groups.values()]
}

export function billingLabel(product: ShopProduct) {
  const count = Math.max(1, product.subscriptionIntervalCount || 1)
  const interval = product.subscriptionInterval || "month"
  const billing =
    product.purchaseType === "subscription"
      ? count === 1
        ? `Every ${interval}`
        : `Every ${count} ${interval}s`
      : "One-time"
  const days = product.subscriptionEntitlementDays ?? product.durationDays
  return days ? `${billing} · ${days} ${days === 1 ? "day" : "days"} access` : billing
}

export function offerLabel(product: ShopProduct) {
  return `${product.variantConfiguration?.label || product.name} — ${billingLabel(product)} — ${formatPrice(product.priceAmountMinor, product.currency)}`
}
