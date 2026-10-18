import { createServer } from "vite"

if (process.env.NODE_ENV === "production") throw new Error("The QA fixture is for local development only.")
let mode = "open",
  customer = { authenticated: false },
  checkoutCount = 0,
  lastCheckout = null
const counts = {}
const product = {
  id: "00000000-0000-0000-0000-000000000001",
  slug: "fixture-pass",
  name: "Fixture Priority Pass",
  shortDescription: "Local QA product",
  description: "Local fixture only.",
  category: "Passes",
  imageUrl: null,
  priceAmountMinor: 500,
  currency: "EUR",
  purchaseType: "one_time",
  subscriptionInterval: "month",
  subscriptionIntervalCount: 1,
  isActive: true,
  sortOrder: 1,
  allowFriendPurchase: true,
  checkoutFields: [
    {
      id: "server",
      type: "game_server_select",
      label: "Server",
      isRequired: true,
      sortOrder: 0,
      options: [{ label: "Fixture server", value: "fixture" }],
    },
  ],
}
product.variantConfiguration = {
  groupId: "fixture-group",
  groupName: "Fixture Priority Pass",
  label: "Standard",
}
const plus = {
  ...product,
  id: "00000000-0000-0000-0000-000000000002",
  slug: "fixture-plus-monthly",
  name: "Fixture Plus Monthly",
  sortOrder: 2,
  priceAmountMinor: 1200,
  purchaseType: "subscription",
  subscriptionEntitlementDays: 30,
  variantConfiguration: { ...product.variantConfiguration, label: "Plus" },
  allowFriendPurchase: false,
  checkoutFields: [
    { id: "character", type: "text", label: "Character name", isRequired: true, sortOrder: 0, options: [] },
  ],
}
const server = await createServer({
  cacheDir: "node_modules/.vite-qa",
  define: { __DEV_BACKEND_CONFIGURED__: "true" },
  server: { host: "127.0.0.1", port: 5196, strictPort: false, open: false },
  plugins: [
    {
      name: "local-qa-api",
      configureServer(vite) {
        vite.middlewares.use((request, response, next) => {
          const url = new URL(request.url, `http://${request.headers.host}`)
          const json = (value) => {
            response.setHeader("Content-Type", "application/json")
            response.setHeader("Cache-Control", "no-store")
            response.end(JSON.stringify(value))
          }
          if (url.pathname === "/_fixture/mode") {
            mode = url.searchParams.get("value") || "open"
            return json({ mode })
          }
          if (url.pathname === "/_fixture/counts") return json({ counts, checkoutCount, lastCheckout })
          if (url.pathname === "/_fixture/checkout-created") {
            response.setHeader("Content-Type", "text/html")
            return response.end(
              "<!doctype html><h1>Fixture checkout</h1><p>No payment processor was contacted.</p>",
            )
          }
          if (!url.pathname.startsWith("/api/")) return next()
          counts[url.pathname] = (counts[url.pathname] || 0) + 1
          if (url.pathname.endsWith("/steam/start") || url.pathname.endsWith("/discord/link/start")) {
            customer = {
              authenticated: true,
              steamId64: "76561198000000001",
              displayName: "Fixture customer",
              discordLinked: url.pathname.endsWith("/discord/link/start"),
            }
            const target = new URL(url.searchParams.get("returnUrl") || "/store", url.origin)
            response.writeHead(302, {
              Location:
                target.origin === url.origin ? target.pathname + target.search + target.hash : "/store",
            })
            response.end()
            return
          }
          if (mode === "error") {
            response.statusCode = 503
            return json({ error: "Fixture backend unavailable" })
          }
          if (url.pathname === "/api/shop-auth/logout") customer = { authenticated: false }
          if (url.pathname === "/api/shop/access" && request.method === "POST") mode = "open"
          if (url.pathname === "/api/shop/checkout" && request.method === "POST") {
            let body = ""
            request.on("data", (chunk) => {
              body += chunk
            })
            request.on("end", () => {
              lastCheckout = JSON.parse(body)
              checkoutCount++
              json({ redirectUrl: url.origin + "/_fixture/checkout-created" })
            })
            return
          }
          const products =
            mode === "empty"
              ? []
              : mode === "removed"
                ? [product]
                : [
                    product,
                    { ...plus, priceAmountMinor: mode === "price-changed" ? 1300 : plus.priceAmountMinor },
                  ]
          const summaries = products.map(({ checkoutFields, allowFriendPurchase, ...item }) => item)
          const bodies = {
            "/api/shop/landing": {
              storeName: "Fixture Community",
              heroTitle: "Local integration test",
              heroSubtitle: "No live accounts or payments.",
              accentColor: "#2288ff",
              shopEnabled: mode !== "disabled",
              legalPagesJson: JSON.stringify([
                {
                  key: "terms",
                  title: "Fixture terms",
                  body: "## Our agreement\n\nTerms for {{storeName}}.\n\n<script>alert('unsafe')</script>\n\n[Unsafe link](javascript:alert(1))",
                  isVisible: true,
                },
                {
                  key: "privacy",
                  title: "Fixture privacy",
                  body: "## Your data\n\nConfigured privacy content for {{storeName}}.",
                  isVisible: true,
                },
              ]),
            },
            "/api/shop/access": {
              allowed: mode !== "locked" && mode !== "maintenance",
              restricted: mode === "locked" || mode === "maintenance",
              mode: mode === "locked" ? "password" : mode === "maintenance" ? "maintenance" : "open",
              passwordConfigured: true,
              title: mode === "locked" ? "Store password" : "Maintenance",
              message: "Local test access state.",
            },
            "/api/shop-auth/me": customer,
            "/api/shop/products": products.map((item) => ({ ...item, variants: summaries })),
            "/api/shop/payments": {
              currency: "EUR",
              activeProvider: "stripe",
              stripeEnabled: true,
              stripeConfigured: true,
              payPalEnabled: false,
              payPalConfigured: false,
            },
            "/api/auth/csrf": { token: "fixture-token" },
            "/api/shop-auth/logout": { ok: true },
          }
          const now = Date.now()
          if (url.pathname === "/api/shop/data/servers")
            return json(
              mode === "empty"
                ? []
                : [
                    { name: "Fixture Chernarus", gameServerId: "fixture-1" },
                    { name: "Fixture Livonia", gameServerId: "fixture-2" },
                  ],
            )
          if (url.pathname === "/api/shop/data/server-summary") {
            if (mode === "partial" && url.searchParams.get("serverId") === "fixture-2") {
              response.statusCode = 503
              return json({ error: "Fixture snapshot unavailable" })
            }
            return json({
              available: mode !== "unavailable",
              source: "fixture",
              fetchedAtUtc: new Date(now - 10000).toISOString(),
              expiresAtUtc: new Date(mode === "stale" ? now - 1000 : now + 60000).toISOString(),
              status: mode === "offline" ? "offline" : "online",
              playerCount: 24,
              maxPlayers: 60,
              queueSize: 2,
              map: "Chernarus",
              nextRestartUtc: new Date(now + 3600000).toISOString(),
              gameTime: "14:30",
              version: "Fixture",
              description: "Local browser verification server.",
              address: "127.0.0.1",
              gamePort: 2302,
              countryName: "Fixture location",
              passwordProtected: false,
              whitelist: false,
              mods: [{ fileId: null, name: "Fixture mod" }],
              metrics: [],
              message: mode === "unavailable" ? "No telemetry published." : null,
            })
          }
          if (url.pathname === "/api/shop/data/leaderboard")
            return json({
              available: true,
              source: "fixture",
              fetchedAtUtc: new Date(now).toISOString(),
              expiresAtUtc: new Date(now + 60000).toISOString(),
              stat: url.searchParams.get("stat"),
              entries:
                mode === "ranking-empty"
                  ? []
                  : [
                      {
                        rank: 1,
                        name: "Fixture player",
                        cftoolsId: "fixture-player",
                        steamId64: null,
                        value: 42,
                        displayValue: url.searchParams.get("stat") === "kdratio" ? "2.50" : "42",
                      },
                    ],
              message: null,
            })
          if (url.pathname === "/api/shop/data/player")
            return json({
              available: true,
              source: "fixture",
              fetchedAtUtc: new Date(now).toISOString(),
              expiresAtUtc: new Date(now + 60000).toISOString(),
              name: "Fixture player",
              metrics: [{ key: "kills", label: "Kills", value: 42, displayValue: "42" }],
              message: null,
            })
          if (url.pathname === "/api/shop/data/me")
            return json({
              authenticated: customer.authenticated,
              steamId64: customer.steamId64 || null,
              cftoolsId: customer.authenticated ? "fixture-player" : null,
              displayName: "Fixture customer",
              message: null,
            })
          if (!(url.pathname in bodies)) response.statusCode = 404
          json(bodies[url.pathname] || { error: "Unknown fixture endpoint" })
        })
      },
    },
  ],
})
await server.listen()
console.log(`Local QA fixture: ${server.resolvedUrls.local[0]}store`)
