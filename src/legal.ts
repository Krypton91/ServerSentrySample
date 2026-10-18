import type { ShopLandingSettings } from "./types"

export type LegalDocument = { key: string; slug: string; title: string; body: string; isVisible: boolean }
export function legalDocument(landing: ShopLandingSettings, key: "terms" | "privacy"): LegalDocument | null {
  try {
    const pages: unknown = JSON.parse(landing.legalPagesJson || "[]")
    if (!Array.isArray(pages)) return null
    const slug = key === "terms" ? "terms-of-service" : "privacy-policy"
    const page = pages.find(
      (item) => item && typeof item === "object" && (item.key === key || item.slug === slug),
    )
    if (!page || page.isVisible === false || typeof page.body !== "string" || !page.body.trim()) return null
    const name = landing.storeName || "Community Store"
    return {
      key,
      slug,
      title:
        typeof page.title === "string" && page.title.trim()
          ? page.title
          : key === "terms"
            ? "Terms of service"
            : "Privacy policy",
      body: page.body.replace(/{{\s*storeName\s*}}/gi, () => name),
      isVisible: true,
    }
  } catch {
    return null
  }
}
