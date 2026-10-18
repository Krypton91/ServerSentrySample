export const siteConfig = {
  communityName: "Northpoint",
  tagline: "DayZ community",
  discordUrl: "", // Optional HTTPS invite URL. Empty hides the link.
  data: {
    enabled: true,
    provider: "serversentry" as "serversentry" | "cftools",
    serverIds: [] as string[], // Empty uses the configured public server list.
    maxServers: 12,
    leaderboardLimit: 10,
  },
}

export const demoMode =
  new URLSearchParams(window.location.search).get("demo") === "1" ||
  (import.meta.env.DEV &&
    !__DEV_BACKEND_CONFIGURED__ &&
    new URLSearchParams(window.location.search).get("demo") !== "0")

export function siteHref(path: string) {
  return `${path}${demoMode ? "?demo=1" : ""}`
}
export function publicHref(anchor: string) {
  return `${siteHref("/store")}#${anchor}`
}

export function normalizePagePath(path: string) {
  const normalized = path.replace(/\/$/, "") || "/"
  // Platform order/payment pages retain their established /shop return links.
  return normalized === "/shop" ? "/store" : normalized
}

export function safeOrigin(value: string | null | undefined): string | null {
  if (!value) return null
  try {
    const url = new URL(value)
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
    if (url.username || url.password || url.search || url.hash || url.pathname !== "/") return null
    return url.protocol === "https:" || (url.protocol === "http:" && local) ? url.origin : null
  } catch {
    return null
  }
}
