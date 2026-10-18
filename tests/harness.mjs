import fs from "node:fs"
import path from "node:path"
import vm from "node:vm"
import ts from "typescript"

export function environment(options = {}) {
  const page = new URL(options.url || "https://community.example/store?category=vip#products")
  const requests = [],
    messages = [],
    navigations = [],
    handlers = new Map(),
    timers = new Map(),
    modules = new Map()
  let sequence = 0
  page.assign = (value) => navigations.push(value)
  const parent = { postMessage: (value, target) => messages.push({ value, target }) }
  const window = {
    location: page,
    parent,
    addEventListener(name, fn) {
      if (!handlers.has(name)) handlers.set(name, new Set())
      handlers.get(name).add(fn)
    },
    removeEventListener(name, fn) {
      handlers.get(name)?.delete(fn)
    },
  }
  if (!options.embedded) window.parent = window
  const customer = {
    authenticated: options.authenticated ?? false,
    steamId64: "76561198000000001",
    discordLinked: true,
  }
  const product = {
    id: "00000000-0000-0000-0000-000000000001",
    slug: "sample",
    name: "Sample product",
    description: "Fixture",
    currency: "EUR",
    priceAmountMinor: 500,
    purchaseType: "one_time",
    subscriptionInterval: "month",
    subscriptionIntervalCount: 1,
    isActive: true,
    sortOrder: 1,
    checkoutFields: [],
    allowFriendPurchase: true,
  }
  const landing = { storeName: "Test store", heroTitle: "Test", heroSubtitle: "", shopEnabled: true }
  const access = {
    allowed: true,
    restricted: false,
    mode: "open",
    title: "",
    message: "",
    passwordConfigured: false,
  }
  const payments = {
    activeProvider: "stripe",
    currency: "EUR",
    stripeEnabled: true,
    stripeConfigured: true,
    payPalEnabled: false,
    payPalConfigured: false,
  }
  const bodies = {
    "/api/shop/landing": landing,
    "/api/shop/access": access,
    "/api/shop-auth/me": customer,
    "/api/shop/products": [product],
    "/api/shop/payments": payments,
    "/api/auth/csrf": { token: "fixture-csrf" },
    "/api/shop-auth/logout": { ok: true },
    "/api/shop/checkout": { redirectUrl: "https://payments.example/session" },
  }
  const scope = vm.createContext({
    URL,
    URLSearchParams,
    structuredClone,
    AbortSignal,
    console,
    __DEV_BACKEND_CONFIGURED__: true,
    window,
    document: { referrer: options.referrer ?? "", getElementById: () => null },
    navigator: { language: "en-GB", languages: ["en-GB"] },
    setTimeout(fn, ms) {
      const id = ++sequence
      timers.set(id, { fn, ms })
      return id
    },
    clearTimeout(id) {
      timers.delete(id)
    },
    fetch: async (address, init = {}) => {
      const url = new URL(address, page.origin)
      requests.push({ url, init })
      const custom = await options.fetch?.(url, init, requests)
      if (custom) return custom
      return new Response(JSON.stringify(bodies[url.pathname] ?? { servers: [] }), {
        headers: { "Content-Type": "application/json" },
      })
    },
  })
  function load(name) {
    const file = path.resolve("src", name.endsWith(".ts") ? name : name + ".ts")
    if (modules.has(file)) return modules.get(file).exports
    const module = { exports: {} }
    modules.set(file, module)
    const source = fs.readFileSync(file, "utf8").replaceAll("import.meta.env.DEV", "false")
    const code = ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText
    const fn = vm.runInContext(`(function(require,module,exports){${code}\n})`, scope)
    fn(
      (relative) => load(path.relative(path.resolve("src"), path.resolve(path.dirname(file), relative))),
      module,
      module.exports,
    )
    return module.exports
  }
  const config = load("config")
  const api = load("api"),
    bridge = load("bridge"),
    checkout = load("checkout"),
    catalog = load("catalog"),
    community = load("community"),
    legal = load("legal")
  const context = {
    version: 1,
    route: "shop",
    path: page.pathname,
    apiBaseUrl: api.apiOrigin,
    endpoints: {},
    bridgeMessages: {},
    isLoading: false,
    dataReady: true,
    features: { refresh: true },
    landing,
    access,
    customer,
    payments,
    products: [product],
  }
  return {
    bridge,
    api,
    checkout,
    catalog,
    community,
    legal,
    config,
    requests,
    messages,
    navigations,
    product,
    bodies,
    context,
    parent,
    message(payload = context, origin = api.apiOrigin, source = parent) {
      for (const fn of handlers.get("message") ?? [])
        fn({ source, origin, data: { type: "serversentry.context", payload } })
    },
    async run(ms) {
      for (const [id, timer] of [...timers])
        if (timer.ms === ms) {
          timers.delete(id)
          timer.fn()
        }
      await new Promise(setImmediate)
    },
    async flush() {
      await new Promise(setImmediate)
    },
    restore() {
      for (const fn of handlers.get("pageshow") ?? []) fn({ persisted: true })
    },
  }
}
