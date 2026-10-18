import test from "node:test"
import assert from "node:assert/strict"
import { environment } from "./harness.mjs"

test("platform /shop return links resolve to the custom store without claiming order routes", () => {
  const app = environment()
  assert.equal(app.config.normalizePagePath("/shop"), "/store")
  assert.equal(app.config.normalizePagePath("/shop/"), "/store")
  assert.equal(app.config.normalizePagePath("/shop/orders"), "/shop/orders")
  assert.equal(app.config.normalizePagePath("/servers/"), "/servers")
})

test("optional Discord delivery does not block a purchase without a Discord link", async () => {
  const app = environment({ authenticated: true })
  app.product.requiresDiscordLink = true
  app.product.discordDeliveryOptional = true
  app.bodies["/api/shop-auth/me"].discordLinked = false
  await app.bridge.startCheckout({ provider: "stripe", customerDetails: {} }, app.product)
  assert.equal(app.requests.filter((item) => item.url.pathname === "/api/shop/checkout").length, 1)
})

function variantProducts(app) {
  const variantConfiguration = { groupId: "fixture-group", groupName: "Priority", label: "Standard" }
  const standard = { ...app.product, variantConfiguration }
  const plus = {
    ...standard,
    id: "00000000-0000-0000-0000-000000000002",
    slug: "plus-monthly",
    name: "Plus monthly",
    priceAmountMinor: 1200,
    purchaseType: "subscription",
    subscriptionEntitlementDays: 30,
    variantConfiguration: { ...variantConfiguration, label: "Plus" },
    allowFriendPurchase: false,
    checkoutFields: [
      {
        id: "server",
        type: "game_server_select",
        label: "Server",
        isRequired: true,
        sortOrder: 0,
        options: [{ label: "Plus server", value: "plus" }],
      },
    ],
  }
  // Match the backend: every full product plus one-level, incomplete sibling summaries.
  const summaries = [standard, plus].map(({ checkoutFields, allowFriendPurchase, ...item }) => item)
  return [standard, plus].map((item) => ({ ...item, variants: summaries }))
}

test("catalog groups full offers, preserves each price/currency and never inherits summary fields", () => {
  const app = environment()
  const [standard, plus] = variantProducts(app)
  const groups = app.catalog.groupCatalogProducts([
    standard,
    { ...plus, currency: "USD" },
    { ...app.product, id: "inactive", isActive: false },
    standard,
  ])
  assert.equal(groups.length, 1)
  assert.equal(groups[0].name, "Priority")
  assert.equal(groups[0].offers.length, 2)
  assert.equal(groups[0].representative.id, plus.id) // stable sort: name, not a cross-currency minimum
  assert.equal(groups[0].offers.find((item) => item.id === plus.id).checkoutFields[0].id, "server")
  assert.match(app.catalog.offerLabel(standard), /Standard.*One-time.*5\.00/)
  assert.match(app.catalog.offerLabel(plus), /Plus.*Every month.*30 days access.*12\.00/)
  assert.equal(app.catalog.groupCatalogProducts([app.product])[0].name, app.product.name)
  assert.equal(app.catalog.groupCatalogProducts([standard])[0].offers.length, 1)
})

test("selected variant checkout sends its own product ID, slug and fields with no client price", async () => {
  const app = environment({ authenticated: true })
  const offers = variantProducts(app),
    selected = offers[1]
  app.bodies["/api/shop/products"] = offers
  await app.bridge.startCheckout(
    { productId: offers[0].id, provider: "stripe", customerDetails: { server: "plus" }, priceAmountMinor: 1 },
    selected,
  )
  const body = JSON.parse(app.requests.find((item) => item.url.pathname === "/api/shop/checkout").init.body)
  assert.equal(body.productId, selected.id)
  assert.equal(body.productSlug, selected.slug)
  assert.deepEqual(body.customerDetails, { server: "plus" })
  assert.equal(body.priceAmountMinor, undefined)
  assert.equal(body.variantId, undefined)
})

test("unavailable variants and changed price, duration or billing stop checkout before a POST", async () => {
  for (const change of [
    "removed",
    "inactive",
    "priceAmountMinor",
    "currency",
    "subscriptionEntitlementDays",
    "subscriptionIntervalCount",
    "checkoutFields",
  ]) {
    const app = environment({ authenticated: true })
    const offers = variantProducts(app),
      selected = offers[1]
    const fresh = structuredClone(selected)
    if (change === "inactive") fresh.isActive = false
    if (change === "priceAmountMinor") fresh.priceAmountMinor++
    if (change === "currency") fresh.currency = "USD"
    if (change === "subscriptionEntitlementDays") fresh.subscriptionEntitlementDays = 15
    if (change === "subscriptionIntervalCount") fresh.subscriptionIntervalCount = 2
    if (change === "checkoutFields") fresh.checkoutFields[0].options = []
    app.bodies["/api/shop/products"] = change === "removed" ? [offers[0]] : [offers[0], fresh]
    await assert.rejects(
      app.bridge.startCheckout({ provider: "stripe", customerDetails: { server: "plus" } }, selected),
      /unavailable|changed/,
    )
    assert.equal(app.requests.filter((item) => item.init.method === "POST").length, 0, change)
  }
})

test("each selected offer enforces its own fields, friend and Discord requirements", async () => {
  for (const scenario of ["field", "friend", "discord"]) {
    const app = environment({ authenticated: true })
    const offers = variantProducts(app),
      selected = offers[1]
    if (scenario === "discord") {
      selected.requiresDiscordLink = true
      app.bodies["/api/shop-auth/me"].discordLinked = false
    }
    app.bodies["/api/shop/products"] = offers
    const payload = {
      provider: "stripe",
      customerDetails: scenario === "field" ? {} : { server: "plus" },
      targetSteamId64: scenario === "friend" ? "76561198000000002" : undefined,
    }
    await assert.rejects(app.bridge.startCheckout(payload, selected), /Complete|recipient|Discord/)
    assert.equal(app.requests.filter((item) => item.init.method === "POST").length, 0)
  }
})

test("native startup shares one load across Strict Mode mounts and ignores API query overrides", async () => {
  const app = environment({
    url: "https://community.example/store?serversentryApiBaseUrl=https://evil.example#products",
  })
  const updates = [],
    errors = []
  const unsubscribe = app.bridge.connectStorefront(
    (value) => updates.push(value),
    (error) => errors.push(error),
  )
  unsubscribe()
  app.bridge.connectStorefront(
    (value) => updates.push(value),
    (error) => errors.push(error),
  )
  await app.flush()
  assert.equal(app.requests.length, 5)
  assert.ok(app.requests.every((item) => item.url.origin === "https://community.example"))
  assert.equal(app.messages.length, 0)
  assert.equal(updates.at(-1).landing.storeName, "Test store")
  assert.deepEqual(errors, [])
})

test("sign-in and Discord returns retain clean path, query and fragment", () => {
  const app = environment()
  app.bridge.loginWithSteam()
  app.bridge.linkDiscord()
  for (const target of app.navigations) {
    const url = new URL(target)
    assert.equal(url.origin, "https://community.example")
    assert.equal(url.searchParams.get("returnUrl"), "/store?category=vip#products")
  }
})

test("demo mode makes no API requests or parent messages and blocks mutations", async () => {
  const app = environment({ url: "https://community.example/store?demo=1" })
  app.bridge.connectStorefront(() => {}, assert.fail)
  await app.flush()
  assert.equal(app.requests.length, 0)
  assert.equal(app.messages.length, 0)
  assert.throws(() => app.bridge.loginWithSteam(), /disabled/)
  await assert.rejects(app.bridge.logout(), /disabled/)
  await assert.rejects(app.bridge.startCheckout({}, app.product), /disabled/)
})

test("live connection failures stay errors instead of becoming demo data", async () => {
  const app = environment({
    fetch: async () => new Response("<!doctype html>", { headers: { "Content-Type": "text/html" } }),
  })
  const updates = [],
    errors = []
  app.bridge.connectStorefront(
    (value) => updates.push(value),
    (error) => errors.push(error),
  )
  await app.flush()
  assert.equal(updates.length, 0)
  assert.equal(errors.length, 1)
  assert.match(errors[0].message, /proxy/)
})

test("coalesced cached reads return independent values; 429 retries are bounded", async () => {
  let count = 0
  const app = environment({
    fetch: async (url) => {
      if (url.pathname.endsWith("/limited")) {
        count++
        return new Response('{"retryAfterSeconds":0}', { status: 429, headers: { "Retry-After": "0" } })
      }
    },
  })
  const [a, b] = await Promise.all([
    app.api.getJson("/api/shop/products"),
    app.api.getJson("/api/shop/products"),
  ])
  a.push({})
  assert.equal(b.length, 1)
  assert.equal(app.requests.length, 1)
  await app.api.getJson("/api/shop/products")
  assert.equal(app.requests.length, 1)
  await assert.rejects(app.api.getJson("/api/shop/data/limited"), (error) => error.status === 429)
  assert.equal(count, 2)
  await assert.rejects(app.api.getJson("/api/admin/settings"), /public/)
})

test("locked or disabled stores omit product and provider requests", async () => {
  for (const disabled of [false, true]) {
    const app = environment()
    if (disabled) app.bodies["/api/shop/landing"].shopEnabled = false
    else app.bodies["/api/shop/access"].allowed = false
    await app.bridge.loadStandaloneContext()
    assert.equal(app.requests.length, 3)
  }
})

test("checkout refreshes price, includes CSRF, posts once and keeps backend return defaults", async () => {
  const app = environment({ authenticated: true })
  const request = {
    productId: app.product.id,
    provider: "stripe",
    customerDetails: {},
    successUrl: "/unexpected-client-return",
  }
  const first = app.bridge.startCheckout(request, app.product)
  await assert.rejects(app.bridge.startCheckout(request, app.product), /already/)
  await first
  const posts = app.requests.filter((item) => item.url.pathname === "/api/shop/checkout")
  assert.equal(posts.length, 1)
  assert.equal(posts[0].init.headers["X-CSRF-TOKEN"], "fixture-csrf")
  assert.equal(JSON.parse(posts[0].init.body).successUrl, undefined)
  assert.equal(app.navigations.at(-1), "https://payments.example/session")
})

test("stale product terms block checkout and write errors are not automatically retried", async () => {
  const app = environment({ authenticated: true })
  await assert.rejects(
    app.bridge.startCheckout({ provider: "stripe" }, { ...app.product, priceAmountMinor: 999 }),
    /changed/,
  )
  assert.equal(app.requests.filter((item) => item.init.method === "POST").length, 0)
  let writes = 0
  const limited = environment({
    fetch: async (url, init) => {
      if (init.method === "POST") {
        writes++
        return new Response('{"error":"Rate limited"}', { status: 429 })
      }
    },
  })
  await assert.rejects(limited.bridge.logout(), (error) => error.status === 429)
  assert.equal(writes, 1)
})

test("returning through browser back/forward cache refreshes state and releases checkout lock", async () => {
  const app = environment({ authenticated: true })
  app.bridge.connectStorefront(() => {}, assert.fail)
  await app.flush()
  const request = { productId: app.product.id, provider: "stripe", customerDetails: {} }
  await app.bridge.startCheckout(request, app.product)
  app.restore()
  await app.flush()
  await app.bridge.startCheckout(request, app.product)
  assert.equal(app.requests.filter((item) => item.url.pathname === "/api/shop/checkout").length, 2)
})

test("checkout rejects unsafe redirects and field/currency helpers follow the contract", async () => {
  const app = environment({ authenticated: true })
  app.bodies["/api/shop/checkout"].redirectUrl = "javascript:alert(1)"
  await assert.rejects(
    app.bridge.startCheckout({ provider: "stripe", customerDetails: {} }, app.product),
    /invalid/,
  )
  assert.equal(app.navigations.length, 0)
  assert.match(app.checkout.formatPrice(100, "JPY"), /100/)
  const field = {
    id: "server",
    type: "game_server_select",
    label: "Server",
    isRequired: true,
    sortOrder: 0,
    options: [{ label: "A", value: "a" }],
  }
  assert.equal(app.checkout.validateCheckout([field], { server: "a" }, "self", ""), null)
  assert.match(app.checkout.validateCheckout([field], { server: "b" }, "self", ""), /valid option/)
  assert.match(app.checkout.validateCheckout([{ ...field, type: "unknown" }], {}, "self", ""), /unsupported/)
})

test("embedded documents fail clearly without API calls or parent messages", async () => {
  const app = environment({ embedded: true })
  const errors = []
  app.bridge.connectStorefront(assert.fail, (error) => errors.push(error))
  await app.flush()
  assert.match(errors[0].message, /custom_site/)
  assert.equal(app.requests.length, 0)
  assert.equal(app.messages.length, 0)
})

test("server loading coalesces reads, bounds fan-out and preserves partial failures", async () => {
  let active = 0,
    maximum = 0
  const app = environment({
    fetch: async (url) => {
      if (url.pathname.endsWith("/server-summary")) {
        active++
        maximum = Math.max(maximum, active)
        await new Promise(setImmediate)
        active--
        if (url.searchParams.get("serverId") === "server-1")
          return new Response('{"error":"Snapshot failed"}', { status: 503 })
        return new Response(
          JSON.stringify({
            available: true,
            status: "online",
            playerCount: 0,
            maxPlayers: 60,
            expiresAtUtc: new Date(Date.now() + 60000).toISOString(),
            mods: [],
            metrics: [],
          }),
        )
      }
    },
  })
  app.bodies["/api/shop/data/servers"] = Array.from({ length: 20 }, (_, i) => ({
    name: `Server ${i}`,
    gameServerId: `server-${i}`,
  }))
  const [a, b] = await Promise.all([app.community.loadServers(), app.community.loadServers()])
  assert.equal(a.length, 12)
  assert.equal(b.length, 12)
  assert.ok(maximum <= 4)
  assert.equal(a[1].snapshot, null)
  assert.match(a[1].error, /Snapshot failed/)
  assert.equal(app.requests.length, 13)
  await app.community.loadServers()
  assert.equal(app.requests.length, 13)
})

test("unknown and expired snapshots cannot become online player totals", () => {
  const app = environment()
  const fresh = {
    available: true,
    status: "online",
    playerCount: 0,
    maxPlayers: 60,
    expiresAtUtc: new Date(Date.now() + 60000).toISOString(),
  }
  const stale = { ...fresh, playerCount: 50, expiresAtUtc: new Date(0).toISOString() }
  const totals = app.community.aggregatePlayers([
    { snapshot: fresh },
    { snapshot: stale },
    { snapshot: null },
  ])
  assert.equal(totals.online, 1)
  assert.equal(totals.players, 0)
  assert.equal(totals.reporting, 1)
  assert.equal(app.community.aggregatePlayers([{ snapshot: null }]).players, null)
  assert.equal(app.community.serverState(stale), "Stale")
  assert.equal(app.community.serverState({ ...fresh, status: null }), "Unknown")
  assert.equal(app.community.connectUrl({ address: "evil/path", gamePort: 2302 }), null)
  assert.equal(
    app.community.connectUrl({ address: "127.0.0.1", gamePort: 2302 }),
    "steam://connect/127.0.0.1:2302",
  )
})

test("legal content comes only from visible configured documents", () => {
  const app = environment()
  assert.equal(app.legal.legalDocument({ legalPagesJson: "broken" }, "terms"), null)
  assert.equal(app.legal.legalDocument({ legalPagesJson: "[]" }, "privacy"), null)
  const landing = {
    storeName: "Test $& shop",
    legalPagesJson: JSON.stringify([
      { key: "terms", title: "Our terms", body: "Hello {{storeName}}", isVisible: true },
    ]),
  }
  assert.equal(app.legal.legalDocument(landing, "terms").body, "Hello Test $& shop")
  landing.legalPagesJson = JSON.stringify([{ key: "terms", body: "Hidden", isVisible: false }])
  assert.equal(app.legal.legalDocument(landing, "terms"), null)
})

test("personal statistics use the authenticated provider identity, never an invented player ID", async () => {
  const app = environment()
  app.config.siteConfig.data.provider = "cftools"
  app.bodies["/api/shop/data/me"] = { authenticated: true, steamId64: "steam-id", cftoolsId: "provider-id" }
  app.bodies["/api/shop/data/player"] = { available: true, metrics: [] }
  await app.community.loadMyPlayer("server-1")
  const request = app.requests.find((item) => item.url.pathname === "/api/shop/data/player")
  assert.equal(request.url.searchParams.get("playerId"), "provider-id")
  assert.equal(request.url.searchParams.get("provider"), "cftools")
  const anonymous = environment()
  anonymous.bodies["/api/shop/data/me"] = { authenticated: false, steamId64: null, cftoolsId: null }
  await assert.rejects(anonymous.community.loadMyPlayer("server-1"), /identity/)
  assert.equal(anonymous.requests.length, 1)
})
