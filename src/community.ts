import { getJson } from "./api"
import { demoMode, siteConfig } from "./config"

export type Metric = {
  key: string
  label: string
  value: number | null
  displayValue: string | null
  unit?: string | null
}
export type Snapshot = {
  available: boolean
  source: string
  fetchedAtUtc: string
  expiresAtUtc: string
  serverName: string | null
  status: string | null
  playerCount: number | null
  maxPlayers: number | null
  queueSize: number | null
  nextRestartUtc: string | null
  uptimeSeconds: number | null
  map: string | null
  version: string | null
  gameTime: string | null
  description: string | null
  address: string | null
  gamePort: number | null
  countryName?: string | null
  modded?: boolean | null
  whitelist?: boolean | null
  passwordProtected?: boolean | null
  mods: { fileId: number | null; name: string }[]
  metrics: Metric[]
  message: string | null
}
export type PublicServer = { name: string; gameServerId: string }
export type ServerView = PublicServer & { snapshot: Snapshot | null; error: string | null }
export type RankingEntry = {
  rank: number
  name: string
  cftoolsId: string | null
  steamId64: string | null
  value: number | null
  displayValue: string | null
}
export type Ranking = {
  available: boolean
  source: string
  fetchedAtUtc: string
  expiresAtUtc: string
  stat: string
  entries: RankingEntry[]
  message: string | null
}
export type PlayerDetails = {
  available: boolean
  source: string
  fetchedAtUtc: string
  expiresAtUtc: string
  name: string | null
  metrics: Metric[]
  message: string | null
}

export const rankingStats = [
  { id: "kills", label: "Kills" },
  { id: "kdratio", label: "K/D ratio" },
  { id: "headshots", label: "Headshots" },
  { id: "longest_kill", label: "Longest kill" },
  { id: "playtime", label: "Playtime" },
]
const dataPath = (name: string, parameters: Record<string, string> = {}) =>
  `/api/shop/data/${name}?${new URLSearchParams({ provider: siteConfig.data.provider, ...parameters })}`
let serverFlight: Promise<ServerView[]> | null = null
let serverCache: { value: ServerView[]; until: number } | null = null

export function loadServers(fresh = false): Promise<ServerView[]> {
  if (!siteConfig.data.enabled) return Promise.resolve([])
  if (demoMode) return Promise.resolve(demoServers())
  if (serverFlight) return serverFlight
  if (!fresh && serverCache && serverCache.until > Date.now())
    return Promise.resolve(structuredClone(serverCache.value))
  serverFlight = (async () => {
    const all = await getJson<PublicServer[]>(dataPath("servers"), { fresh, ttlMs: 30_000 })
    if (!Array.isArray(all)) throw new Error("Invalid server list from the backend.")
    const servers = all
      .filter(
        (item) =>
          typeof item.gameServerId === "string" &&
          typeof item.name === "string" &&
          (!siteConfig.data.serverIds.length || siteConfig.data.serverIds.includes(item.gameServerId)),
      )
      .filter(
        (item, index, list) => list.findIndex((other) => other.gameServerId === item.gameServerId) === index,
      )
      .slice(0, Math.min(12, Math.max(1, siteConfig.data.maxServers)))
    const result: ServerView[] = []
    // Limit fan-out, even for installations exposing many servers.
    for (let offset = 0; offset < servers.length; offset += 4) {
      result.push(
        ...(await Promise.all(
          servers.slice(offset, offset + 4).map(async (server) => {
            try {
              const snapshot = await getJson<Snapshot>(
                dataPath("server-summary", { serverId: server.gameServerId }),
                { fresh, ttlMs: 30_000 },
              )
              if (!snapshot || typeof snapshot.available !== "boolean")
                throw new Error("Invalid server snapshot.")
              return {
                ...server,
                snapshot: {
                  ...snapshot,
                  mods: Array.isArray(snapshot.mods) ? snapshot.mods : [],
                  metrics: Array.isArray(snapshot.metrics) ? snapshot.metrics : [],
                },
                error: null,
              }
            } catch (error) {
              return {
                ...server,
                snapshot: null,
                error: error instanceof Error ? error.message : "Snapshot unavailable.",
              }
            }
          }),
        )),
      )
    }
    serverCache = { value: result, until: Date.now() + 30_000 }
    return structuredClone(result)
  })().finally(() => {
    serverFlight = null
  })
  return serverFlight
}

export async function loadRanking(serverId: string, stat: string, fresh = false): Promise<Ranking> {
  if (!rankingStats.some((item) => item.id === stat)) throw new Error("Unsupported ranking metric.")
  if (demoMode) return demoRanking(stat)
  const value = await getJson<Ranking>(
    dataPath("leaderboard", {
      serverId,
      stat,
      order: "-1",
      limit: String(Math.min(25, Math.max(1, siteConfig.data.leaderboardLimit))),
    }),
    { fresh, ttlMs: 30_000 },
  )
  if (!value || typeof value.available !== "boolean" || !Array.isArray(value.entries))
    throw new Error("Invalid leaderboard from the backend.")
  return value
}
export async function loadPlayer(serverId: string, playerId: string): Promise<PlayerDetails> {
  if (demoMode)
    return {
      available: true,
      source: "demo",
      fetchedAtUtc: new Date().toISOString(),
      expiresAtUtc: new Date(Date.now() + 60_000).toISOString(),
      name: "Demo player",
      message: null,
      metrics: [
        { key: "kills", label: "Kills", value: 148, displayValue: "148" },
        { key: "kdratio", label: "K/D ratio", value: 2.47, displayValue: "2.47" },
      ],
    }
  const value = await getJson<PlayerDetails>(dataPath("player", { serverId, playerId }), { ttlMs: 30_000 })
  if (!value || typeof value.available !== "boolean" || !Array.isArray(value.metrics))
    throw new Error("Invalid player details.")
  return value
}
export async function loadMyPlayer(serverId: string): Promise<PlayerDetails> {
  if (demoMode) throw new Error("Sign in to view your statistics.")
  const identity = await getJson<{
    authenticated: boolean
    steamId64: string | null
    cftoolsId: string | null
    message: string | null
  }>(dataPath("me", { serverId }), { ttlMs: 30_000 })
  const id = siteConfig.data.provider === "cftools" ? identity.cftoolsId : identity.steamId64
  if (!identity.authenticated || !id)
    throw new Error(identity.message || "No linked player identity is available.")
  return loadPlayer(serverId, id)
}
export function isStale(snapshot: Pick<Snapshot, "expiresAtUtc">) {
  const expiry = Date.parse(snapshot.expiresAtUtc)
  return !Number.isFinite(expiry) || expiry <= Date.now()
}
export function serverState(snapshot: Snapshot | null) {
  if (!snapshot?.available) return "Unavailable"
  if (isStale(snapshot)) return "Stale"
  return snapshot.status?.toLowerCase() === "online"
    ? "Online"
    : snapshot.status?.toLowerCase() === "offline"
      ? "Offline"
      : "Unknown"
}
export function aggregatePlayers(servers: ServerView[]) {
  const online = servers.filter((item) => serverState(item.snapshot) === "Online")
  const known = online.filter((item) => item.snapshot?.playerCount != null)
  return {
    online: online.length,
    reporting: known.length,
    total: servers.length,
    players: known.length
      ? known.reduce((sum, item) => sum + Math.max(0, item.snapshot!.playerCount!), 0)
      : null,
  }
}
export function connectUrl(snapshot: Snapshot) {
  if (
    !snapshot.address ||
    !/^[a-z0-9.:[\]-]+$/i.test(snapshot.address) ||
    !snapshot.gamePort ||
    snapshot.gamePort < 1 ||
    snapshot.gamePort > 65535
  )
    return null
  const host =
    snapshot.address.includes(":") && !snapshot.address.startsWith("[")
      ? `[${snapshot.address}]`
      : snapshot.address
  return `steam://connect/${host}:${snapshot.gamePort}`
}

function demoServers(): ServerView[] {
  const now = Date.now()
  return [
    { name: "Northpoint / Chernarus", gameServerId: "demo-chernarus" },
    { name: "Northpoint / Livonia", gameServerId: "demo-livonia" },
  ].map((server, index) => ({
    ...server,
    error: null,
    snapshot: {
      available: true,
      source: "demo",
      fetchedAtUtc: new Date(now).toISOString(),
      expiresAtUtc: new Date(now + 60_000).toISOString(),
      serverName: server.name,
      status: "online",
      playerCount: index ? 24 : 48,
      maxPlayers: 60,
      queueSize: 0,
      nextRestartUtc: new Date(now + 3600_000).toISOString(),
      uptimeSeconds: 7200,
      map: index ? "Livonia" : "Chernarus",
      version: "Demo build",
      gameTime: "14:30",
      description: "Sample server data. No game server is contacted.",
      address: null,
      gamePort: null,
      modded: true,
      whitelist: false,
      passwordProtected: false,
      mods: [{ fileId: null, name: "Example community mod" }],
      metrics: [],
      message: null,
    },
  }))
}
function demoRanking(stat: string): Ranking {
  return {
    available: true,
    source: "demo",
    fetchedAtUtc: new Date().toISOString(),
    expiresAtUtc: new Date(Date.now() + 60_000).toISOString(),
    stat,
    message: null,
    entries: ["Wanderer", "Juniper", "Atlas", "Marlow", "Rook"].map((name, index) => ({
      rank: index + 1,
      name,
      cftoolsId: `demo-${index}`,
      steamId64: null,
      value: 148 - index * 19,
      displayValue:
        stat === "kdratio"
          ? (2.47 - index * 0.2).toFixed(2)
          : stat === "playtime"
            ? `${120 - index * 9} h`
            : stat === "longest_kill"
              ? `${520 - index * 24} m`
              : String(148 - index * 19),
    })),
  }
}
