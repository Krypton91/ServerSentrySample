import { useEffect, useState } from "react"
import {
  aggregatePlayers,
  connectUrl,
  isStale,
  loadMyPlayer,
  loadPlayer,
  loadRanking,
  loadServers,
  rankingStats,
  serverState,
  type PlayerDetails,
  type Ranking,
  type RankingEntry,
  type ServerView,
} from "./community"
import { demoMode, siteConfig } from "./config"
import { SiteLink } from "./routing"
import type { StorefrontContext } from "./types"

export function Community({
  page,
  context,
}: {
  page: "home" | "servers" | "leaderboard"
  context: StorefrontContext | null
}) {
  const [servers, setServers] = useState<ServerView[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [revision, setRevision] = useState(0)
  const [ready, setReady] = useState(true)
  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)
    loadServers(revision > 0)
      .then((value) => {
        if (active) setServers(value)
      })
      .catch((caught) => {
        if (active) setError(caught instanceof Error ? caught.message : "Community data is unavailable.")
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [revision])
  useEffect(() => {
    if (!ready) {
      const timer = setTimeout(() => setReady(true), 30_000)
      return () => clearTimeout(timer)
    }
  }, [ready])
  const totals = aggregatePlayers(servers ?? [])
  const name = context?.landing.storeName || siteConfig.communityName
  const refresh = () => {
    if (!ready || loading) return
    setReady(false)
    setRevision((value) => value + 1)
  }
  return (
    <>
      {page === "home" ? (
        <section className="home-hero">
          <div className="hero-copy">
            <p className="eyebrow">
              <span className="small-cross">+</span> {context?.landing.brandTagline || siteConfig.tagline}
            </p>
            <h1>
              Find your people.
              <br />
              <em>Survive together.</em>
            </h1>
            <p className="hero-description">
              A good server is more than a place to play. Explore {name}, find your next home, and make your
              mark.
            </p>
            <div className="hero-actions">
              <SiteLink to="/servers" className="button button-primary">
                Explore servers <span aria-hidden="true">↗</span>
              </SiteLink>
              <SiteLink to="/store" className="button button-secondary">
                Community store
              </SiteLink>
            </div>
            <p className="hero-footnote">
              {demoMode
                ? "Preview environment · sample data"
                : "Player counts and server availability, with a timestamp on every update"}
            </p>
          </div>
          <aside className="network-panel" aria-label="Community status">
            <div className="panel-top">
              <span>{name} / network</span>
              <span className="tiny-label">{demoMode ? "DEMO" : "SNAPSHOTS"}</span>
            </div>
            <div className="network-art" aria-hidden="true">
              <div className="contour contour-one" />
              <div className="contour contour-two" />
              <div className="contour contour-three" />
              <span className="map-point point-one">01</span>
              <span className="map-point point-two">02</span>
              <span className="map-coordinate">COMMUNITY / NETWORK</span>
            </div>
            <div className="network-numbers">
              <div>
                <strong>{servers ? (totals.players ?? "—") : "—"}</strong>
                <span>players reported online</span>
              </div>
              <div>
                <strong>{servers ? `${totals.online}/${totals.total}` : "—"}</strong>
                <span>servers online</span>
              </div>
            </div>
            <p className="network-note">
              {error
                ? "Status unavailable"
                : loading
                  ? "Loading community data…"
                  : `${totals.reporting} of ${totals.total} servers reporting fresh player counts`}
            </p>
          </aside>
        </section>
      ) : (
        <header className="page-heading">
          <p className="eyebrow">
            {name} / {page === "servers" ? "Servers" : "Leaderboard"}
          </p>
          <h1>{page === "servers" ? "Choose your next chapter." : "Leave your mark."}</h1>
          <p>
            {page === "servers"
              ? "Server availability, player counts and the details you need before joining."
              : "Community rankings from the configured data provider. Choose a server and a metric."}
          </p>
        </header>
      )}

      <div className="data-toolbar">
        <p>
          {demoMode
            ? "Demonstration data"
            : `Data source: ${siteConfig.data.provider === "serversentry" ? "ServerSentry" : "CFTools"}`}{" "}
          <span>· Refresh to update</span>
        </p>
        <button type="button" className="text-button" disabled={loading || !ready} onClick={refresh}>
          {loading ? "Updating…" : ready ? "↻ Refresh data" : "Refresh available in 30 seconds"}
        </button>
      </div>
      {error && (
        <div className="notice danger" role="alert">
          <strong>Community data unavailable</strong>
          <p>
            {error} {servers && "Previously loaded values are retained; check their timestamps."}
          </p>
        </div>
      )}
      {loading && !servers && (
        <div className="loading-panel" role="status">
          Loading servers and published snapshots…
        </div>
      )}
      {servers?.length === 0 && (
        <div className="empty-state">
          <p className="eyebrow">NO PUBLIC SERVERS</p>
          <h2>
            {siteConfig.data.enabled ? "Your servers will appear here." : "Community data is disabled."}
          </h2>
          <p>
            {siteConfig.data.enabled
              ? "Enable a server and its telemetry in ServerSentry, or check the configured data provider."
              : "Enable data in src/config.ts to show public server information."}
          </p>
        </div>
      )}
      {servers && servers.length > 0 && (
        <>
          {page !== "leaderboard" && (
            <section className="servers-section" aria-labelledby="servers-title">
              <div className="section-head">
                <div>
                  <p className="eyebrow">YOUR NEXT DESTINATION</p>
                  <h2 id="servers-title">Room for one more.</h2>
                </div>
                {page === "home" && (
                  <SiteLink className="text-link" to="/servers">
                    All server details ↗
                  </SiteLink>
                )}
              </div>
              <div className="server-grid">
                {servers.map((server, index) => (
                  <ServerCard
                    key={server.gameServerId}
                    server={server}
                    index={index}
                    detailed={page === "servers"}
                  />
                ))}
              </div>
            </section>
          )}
          {page !== "servers" && (
            <Leaderboard
              key={revision}
              servers={servers}
              compact={page === "home"}
              self={context?.customer?.authenticated ? context.customer.steamId64 : null}
            />
          )}
        </>
      )}
      {page === "home" && siteConfig.discordUrl && /^https:\/\//i.test(siteConfig.discordUrl) && (
        <section className="community-invite">
          <div>
            <p className="eyebrow">BETTER WITH COMPANY</p>
            <h2>The conversation continues.</h2>
            <p>Find teammates, read community announcements and talk to the team.</p>
          </div>
          <a
            className="button button-secondary"
            href={siteConfig.discordUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            Join our Discord ↗
          </a>
        </section>
      )}
    </>
  )
}

function ServerCard({ server, index, detailed }: { server: ServerView; index: number; detailed: boolean }) {
  const snapshot = server.snapshot
  const state = serverState(snapshot)
  const current = snapshot?.available && !isStale(snapshot)
  const connection = snapshot && current && state === "Online" ? connectUrl(snapshot) : null
  const count = snapshot?.playerCount
  const capacity = snapshot?.maxPlayers
  return (
    <article className="server-card">
      <div className="server-card-top">
        <span className="server-index">0{index + 1}</span>
        <span className={`status-pill ${state.toLowerCase()}`}>
          <span aria-hidden="true">●</span> {state}
        </span>
      </div>
      <p className="server-map">{snapshot?.map || "Map unavailable"}</p>
      <h3>{server.name}</h3>
      <p className="server-description">
        {snapshot?.description ||
          (state === "Unavailable" ? "Waiting for a published server snapshot." : "Community game server")}
      </p>
      <div className="population">
        <div>
          <span>Players</span>
          <strong>
            {snapshot?.available && count != null ? count : "—"}
            <small> / {capacity ?? "—"}</small>
          </strong>
        </div>
        <div
          className="population-bar"
          role="img"
          aria-label={count == null ? "Player count unknown" : `${count} of ${capacity ?? "unknown"} slots`}
        >
          <span
            style={{
              width: `${count != null && capacity && capacity > 0 ? Math.min(100, Math.max(0, (count / capacity) * 100)) : 0}%`,
            }}
          />
        </div>
      </div>
      <dl className="server-facts">
        <div>
          <dt>Queue</dt>
          <dd>{snapshot?.queueSize ?? "Not reported"}</dd>
        </div>
        <div>
          <dt>Next restart</dt>
          <dd>{snapshot?.nextRestartUtc ? timeLabel(snapshot.nextRestartUtc) : "Not published"}</dd>
        </div>
        {detailed && (
          <>
            <div>
              <dt>Game time</dt>
              <dd>{snapshot?.gameTime || "—"}</dd>
            </div>
            <div>
              <dt>Version</dt>
              <dd>{snapshot?.version || "—"}</dd>
            </div>
            <div>
              <dt>Location</dt>
              <dd>{snapshot?.countryName || "—"}</dd>
            </div>
            <div>
              <dt>Access</dt>
              <dd>
                {snapshot?.passwordProtected
                  ? "Password"
                  : snapshot?.whitelist
                    ? "Whitelist"
                    : snapshot?.passwordProtected === false && snapshot?.whitelist === false
                      ? "Public"
                      : "—"}
              </dd>
            </div>
          </>
        )}
      </dl>
      {detailed && snapshot && snapshot.mods.length > 0 && (
        <details className="mods-list">
          <summary>{snapshot.mods.length} published mods</summary>
          <ul>
            {snapshot.mods.map((mod, i) => (
              <li key={`${mod.fileId}-${i}`}>{mod.name}</li>
            ))}
          </ul>
        </details>
      )}
      {(server.error || snapshot?.message) && (
        <p className="inline-warning">{server.error || snapshot?.message}</p>
      )}
      <div className="server-card-bottom">
        <p>
          {snapshot ? (
            <>
              <span>{state === "Stale" ? "Expired snapshot" : "Snapshot"}</span>
              <time dateTime={snapshot.fetchedAtUtc}>{timeLabel(snapshot.fetchedAtUtc)}</time>
            </>
          ) : (
            "Snapshot unavailable"
          )}
        </p>
        {connection ? (
          <a className="button button-secondary" href={connection}>
            Join server ↗
          </a>
        ) : (
          <span className="join-unavailable">{demoMode ? "Demo server" : "Join unavailable"}</span>
        )}
      </div>
      {detailed && snapshot?.address && (
        <p className="server-address">
          {snapshot.address}
          {snapshot.gamePort ? `:${snapshot.gamePort}` : ""}
        </p>
      )}
    </article>
  )
}

function Leaderboard({
  servers,
  compact,
  self,
}: {
  servers: ServerView[]
  compact: boolean
  self?: string | null
}) {
  const [serverId, setServerId] = useState(servers[0].gameServerId)
  const [stat, setStat] = useState("kills")
  const [ranking, setRanking] = useState<Ranking | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [player, setPlayer] = useState<{
    name: string
    data: PlayerDetails | null
    error: string | null
  } | null>(null)
  const [playerBusy, setPlayerBusy] = useState(false)
  useEffect(() => {
    let active = true
    setRanking(null)
    setError(null)
    setPlayer(null)
    loadRanking(serverId, stat)
      .then((value) => {
        if (active) setRanking(value)
      })
      .catch((caught) => {
        if (active) setError(caught.message)
      })
    return () => {
      active = false
    }
  }, [serverId, stat])
  async function showPlayer(entry: RankingEntry) {
    const id = entry.cftoolsId || entry.steamId64
    if (!id || playerBusy) return
    setPlayerBusy(true)
    setPlayer({ name: entry.name, data: null, error: null })
    try {
      const data = await loadPlayer(serverId, id)
      setPlayer({ name: entry.name, data, error: null })
    } catch (caught) {
      setPlayer({
        name: entry.name,
        data: null,
        error: caught instanceof Error ? caught.message : "Player details unavailable.",
      })
    } finally {
      setPlayerBusy(false)
    }
  }
  async function showSelf() {
    if (playerBusy) return
    setPlayerBusy(true)
    setPlayer({ name: "Your statistics", data: null, error: null })
    try {
      setPlayer({ name: "Your statistics", data: await loadMyPlayer(serverId), error: null })
    } catch (caught) {
      setPlayer({
        name: "Your statistics",
        data: null,
        error: caught instanceof Error ? caught.message : "Player details unavailable.",
      })
    } finally {
      setPlayerBusy(false)
    }
  }
  const metric = rankingStats.find((item) => item.id === stat)!.label
  return (
    <section className="leaderboard-section" aria-labelledby="leaderboard-title">
      <div className="section-head">
        <div>
          <p className="eyebrow">THE COMMUNITY, IN NUMBERS</p>
          <h2 id="leaderboard-title">A name worth remembering.</h2>
        </div>
        {compact && (
          <SiteLink to="/leaderboard" className="text-link">
            Full leaderboard ↗
          </SiteLink>
        )}
      </div>
      {self && (
        <div className="self-statistics">
          <button type="button" className="text-button" disabled={playerBusy} onClick={() => void showSelf()}>
            My statistics ↗
          </button>
        </div>
      )}
      <div className="ranking-panel">
        <div className="ranking-filters">
          <label className="field-label">
            Server
            <select
              value={serverId}
              disabled={playerBusy}
              onChange={(event) => setServerId(event.target.value)}
            >
              {servers.map((server) => (
                <option key={server.gameServerId} value={server.gameServerId}>
                  {server.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field-label">
            Ranking
            <select value={stat} disabled={playerBusy} onChange={(event) => setStat(event.target.value)}>
              {rankingStats.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <span className="ranking-scope">Published player statistics</span>
        </div>
        {error ? (
          <div className="empty-state" role="alert">
            <h3>Ranking unavailable</h3>
            <p>{error}</p>
          </div>
        ) : !ranking ? (
          <p className="loading-panel" role="status">
            Loading ranking…
          </p>
        ) : !ranking.available || !ranking.entries.length ? (
          <div className="empty-state">
            <h3>No ranking available yet.</h3>
            <p>{ranking.message || "No published values for this server and metric."}</p>
          </div>
        ) : (
          <>
            <div className="ranking-table-wrap">
              <table className="ranking-table">
                <caption className="sr-only">{metric} leaderboard</caption>
                <thead>
                  <tr>
                    <th scope="col">Rank</th>
                    <th scope="col">Player</th>
                    <th scope="col">{metric}</th>
                  </tr>
                </thead>
                <tbody>
                  {ranking.entries
                    .slice(0, compact ? 5 : siteConfig.data.leaderboardLimit)
                    .map((entry, index) => (
                      <tr key={`${entry.cftoolsId || entry.steamId64 || entry.name}-${index}`}>
                        <td className="rank-number">{String(entry.rank).padStart(2, "0")}</td>
                        <td>
                          {entry.cftoolsId || entry.steamId64 ? (
                            <button
                              type="button"
                              className="player-name"
                              disabled={playerBusy}
                              onClick={() => void showPlayer(entry)}
                            >
                              {entry.name} <span aria-hidden="true">↗</span>
                            </button>
                          ) : (
                            entry.name
                          )}
                        </td>
                        <td className="rank-value">{entry.displayValue ?? entry.value ?? "—"}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            <div className="ranking-footer">
              <span>
                {demoMode
                  ? "Sample ranking"
                  : `${ranking.source} · ${isStale(ranking) ? "Expired snapshot" : "Snapshot"}`}
              </span>
              <time dateTime={ranking.fetchedAtUtc}>{timeLabel(ranking.fetchedAtUtc)}</time>
            </div>
          </>
        )}
        {player && (
          <section className="player-details" aria-live="polite">
            <div>
              <h3>{player.name}</h3>
              <button
                type="button"
                className="text-button"
                disabled={playerBusy}
                onClick={() => setPlayer(null)}
              >
                Close details
              </button>
            </div>
            {playerBusy ? (
              <p>Loading player statistics…</p>
            ) : player.error || !player.data?.available ? (
              <p>{player.error || player.data?.message || "Player statistics unavailable."}</p>
            ) : (
              <>
                <dl className="player-metrics">
                  {player.data.metrics.map((item) => (
                    <div key={item.key}>
                      <dt>{item.label}</dt>
                      <dd>{item.displayValue ?? item.value ?? "—"}</dd>
                    </div>
                  ))}
                </dl>
                <p className="muted">
                  {isStale(player.data) ? "Expired snapshot" : "Snapshot"} ·{" "}
                  {timeLabel(player.data.fetchedAtUtc)}
                </p>
              </>
            )}
          </section>
        )}
      </div>
    </section>
  )
}
function timeLabel(value?: string | null) {
  const date = value ? new Date(value) : null
  return date && Number.isFinite(date.getTime())
    ? date.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
    : "—"
}
