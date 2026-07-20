import { FormEvent, useEffect, useMemo, useState } from "react"
import {
  announceReady,
  linkDiscord,
  loadStandaloneContext,
  loginWithSteam,
  logout,
  startCheckout,
  unlockShopAccess,
} from "./bridge"
import type {
  CheckoutPayload,
  ShopCheckoutField,
  ShopProduct,
  StorefrontContext,
} from "./types"

const DEMO_CONTEXT: StorefrontContext = {
  version: 1,
  route: "shop",
  path: "/shop",
  apiBaseUrl: "",
  endpoints: {},
  bridgeMessages: {},
  isLoading: false,
  landing: {
    storeName: "NORTHPOINT",
    heroTitle: "Your Story. Your Server. Your Advantage.",
    heroSubtitle: "Get exclusive packages while supporting the continued development of our server.",
    heroImageUrl: null,
    headerLogoUrl: null,
    brandTagline: "DAYZ COMMUNITY STORE",
    accentColor: "#d6ff4b",
    shopEnabled: true,
    shopProductsEyebrow: "SERVER STORE",
    shopProductsTitle: "Choose Your Package",
    shopProductsSubtitle: "Instant and automated delivery after a successful payment.",
    footerText: "Northpoint Community Store",
  },
  customer: { authenticated: false, discordLinked: false },
  access: { restricted: false, allowed: true, mode: "open", title: "", message: "", passwordConfigured: false },
  payments: {
    activeProvider: "stripe",
    currency: "EUR",
    payPalEnabled: true,
    stripeEnabled: true,
    payPalConfigured: true,
    stripeConfigured: true,
  },
  products: [
    {
      id: "demo-1",
      slug: "starter-pack",
      name: "Survivor Starter",
      shortDescription: "A quick start for your next adventure.",
      description: "Basic gear, supplies, and a small amount of starting cash for your character.",
      category: "Starter",
      imageUrl: null,
      priceAmountMinor: 799,
      currency: "EUR",
      purchaseType: "one_time",
      subscriptionInterval: "month",
      subscriptionIntervalCount: 1,
      isActive: true,
      sortOrder: 1,
      allowFriendPurchase: true,
      checkoutFields: [
        { id: "server", type: "select", label: "Server", prompt: "Which server do you play on?", isRequired: true, sortOrder: 1, options: [{ label: "Server 1", value: "server-1" }, { label: "Server 2", value: "server-2" }] },
      ],
    },
    {
      id: "demo-2",
      slug: "vip-30",
      name: "VIP Access",
      shortDescription: "Priority queue access and exclusive community benefits.",
      description: "30 days of VIP access, including priority queue access and a Discord role.",
      category: "VIP",
      imageUrl: null,
      priceAmountMinor: 1499,
      currency: "EUR",
      purchaseType: "one_time",
      subscriptionInterval: "month",
      subscriptionIntervalCount: 1,
      durationDays: 30,
      isActive: true,
      sortOrder: 2,
      requiresDiscordLink: true,
      allowFriendPurchase: false,
      checkoutFields: [],
    },
    {
      id: "demo-3",
      slug: "supporter",
      name: "Supporter Subscription",
      shortDescription: "Monthly support with recurring benefits.",
      description: "Support the server long-term and receive monthly supporter benefits.",
      category: "Supporter",
      imageUrl: null,
      priceAmountMinor: 999,
      currency: "EUR",
      purchaseType: "subscription",
      subscriptionInterval: "month",
      subscriptionIntervalCount: 1,
      isActive: true,
      sortOrder: 3,
      allowFriendPurchase: true,
      checkoutFields: [],
    },
  ],
}

export function App() {
  const [context, setContext] = useState<StorefrontContext | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState("")
  const [category, setCategory] = useState("All")
  const [selectedProduct, setSelectedProduct] = useState<ShopProduct | null>(null)

  useEffect(() => {
    let active = true
    const isDemo = new URLSearchParams(window.location.search).get("demo") === "1"

    function handleMessage(event: MessageEvent) {
      if (event.source !== window.parent) return
      if (!event.data || event.data.type !== "serversentry.context") return
      if (active) setContext(event.data.payload as StorefrontContext)
    }

    window.addEventListener("message", handleMessage)
    announceReady()

    if (isDemo) {
      setContext(DEMO_CONTEXT)
    } else if (window.parent === window) {
      void loadStandaloneContext()
        .then((value) => active && setContext(value))
        .catch((caught) => active && setError(caught instanceof Error ? caught.message : "The store could not be loaded."))
    }

    return () => {
      active = false
      window.removeEventListener("message", handleMessage)
    }
  }, [])

  const landing = context?.landing ?? DEMO_CONTEXT.landing
  const products = useMemo(
    () => (context?.products ?? [])
      .filter((product) => product.isActive)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)),
    [context?.products],
  )

  const categories = useMemo(
    () => ["All", ...Array.from(new Set(products.map((product) => product.category?.trim()).filter(Boolean) as string[]))],
    [products],
  )

  const visibleProducts = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("en")
    return products.filter((product) => {
      const matchesCategory = category === "All" || product.category === category
      const matchesQuery = !normalizedQuery || [product.name, product.shortDescription, product.description, product.category]
        .filter(Boolean)
        .some((value) => value!.toLocaleLowerCase("en").includes(normalizedQuery))
      return matchesCategory && matchesQuery
    })
  }, [category, products, query])

  useEffect(() => {
    const accent = normalizeAccent(landing.accentColor)
    document.documentElement.style.setProperty("--accent", accent)
    document.title = landing.storeName || "Server Store"
  }, [landing.accentColor, landing.storeName])

  const accessBlocked = Boolean(context?.access?.restricted && !context.access.allowed)

  return (
    <div className="app-shell">
      <div className="noise" aria-hidden="true" />
      <Header context={context} />

      <main>
        <Hero context={context} onBrowse={() => document.getElementById("products")?.scrollIntoView({ behavior: "smooth" })} />

        <section className="trust-strip" aria-label="Store benefits">
          <TrustItem icon="bolt" title="Automatic delivery" text="Delivered after successful payment" />
          <TrustItem icon="shield" title="Secure payments" text="Using your enabled payment providers" />
          <TrustItem icon="headset" title="Support included" text="Orders remain easy to track" />
        </section>

        <section id="products" className="products-section">
          <div className="section-head">
            <div>
              <p className="eyebrow">{landing.shopProductsEyebrow || "COMMUNITY STORE"}</p>
              <h2>{landing.shopProductsTitle || "Choose Your Package"}</h2>
              <p>{landing.shopProductsSubtitle || "Products are loaded live from your ServerSentry store."}</p>
            </div>
            <div className="result-pill">{visibleProducts.length} {visibleProducts.length === 1 ? "Product" : "Products"}</div>
          </div>

          {error && <Notice tone="danger" title="Error">{error}</Notice>}
          {accessBlocked && context && (
            <AccessGate context={context} onUnlocked={setContext} />
          )}

          {!accessBlocked && (
            <>
              <div className="catalog-toolbar">
                <label className="search-box">
                  <Icon name="search" />
                  <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search products…" />
                </label>
                <div className="category-tabs" aria-label="Categories">
                  {categories.map((item) => (
                    <button key={item} type="button" className={category === item ? "active" : ""} onClick={() => setCategory(item)}>
                      {item}
                    </button>
                  ))}
                </div>
              </div>

              {!context && !error ? (
                <ProductSkeletons />
              ) : visibleProducts.length > 0 ? (
                <div className="product-grid">
                  {visibleProducts.map((product, index) => (
                    <ProductCard key={product.id} product={product} index={index} apiBaseUrl={context?.apiBaseUrl ?? ""} onSelect={setSelectedProduct} />
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  <span className="empty-icon"><Icon name="package" /></span>
                  <h3>No products found</h3>
                  <p>Change your search or select another category.</p>
                </div>
              )}
            </>
          )}
        </section>

        <section id="about" className="community-panel">
          <div>
            <p className="eyebrow">COMMUNITY FIRST</p>
            <h2>Your purchase supports the server.</h2>
            <p>Revenue helps fund hosting, development, events, and long-term gameplay.</p>
          </div>
          <div className="community-stats">
            <Stat value="24/7" label="Server uptime" />
            <Stat value="Fast" label="Delivery" />
            <Stat value="100%" label="Community" />
          </div>
        </section>
      </main>

      <Footer context={context} />

      {selectedProduct && (
        <CheckoutDialog
          product={selectedProduct}
          context={context ?? DEMO_CONTEXT}
          onClose={() => setSelectedProduct(null)}
          onError={setError}
        />
      )}
    </div>
  )
}

function Header({ context }: { context: StorefrontContext | null }) {
  const landing = context?.landing ?? DEMO_CONTEXT.landing
  const customer = context?.customer
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <header className="site-header">
      <a className="brand" href="#top" aria-label={landing.storeName || "Store"}>
        {landing.headerLogoUrl ? <img src={resolveAssetUrl(landing.headerLogoUrl, context?.apiBaseUrl)} alt="" /> : <span className="brand-mark"><Icon name="radar" /></span>}
        <span>
          <strong>{landing.storeName || "SERVER STORE"}</strong>
          <small>{landing.brandTagline || "COMMUNITY MARKET"}</small>
        </span>
      </a>

      <nav className={menuOpen ? "nav-open" : ""}>
        <a href="#products" onClick={() => setMenuOpen(false)}>Products</a>
        <a href="#about" onClick={() => setMenuOpen(false)}>About us</a>
        <a href="#footer" onClick={() => setMenuOpen(false)}>Support</a>
      </nav>

      <div className="header-actions">
        {customer?.authenticated ? (
          <div className="account-menu">
            {customer.avatarUrl ? <img src={customer.avatarUrl} alt="" /> : <span><Icon name="user" /></span>}
            <div>
              <strong>{customer.displayName || "Steam Player"}</strong>
              <button type="button" onClick={() => void logout()}>Log out</button>
            </div>
          </div>
        ) : (
          <button className="button button-secondary login-button" type="button" onClick={loginWithSteam}>
            <Icon name="steam" /> Sign in with Steam
          </button>
        )}
        <button className="mobile-menu" type="button" aria-label="Open menu" onClick={() => setMenuOpen((value) => !value)}>
          <Icon name={menuOpen ? "close" : "menu"} />
        </button>
      </div>
    </header>
  )
}

function Hero({ context, onBrowse }: { context: StorefrontContext | null; onBrowse: () => void }) {
  const landing = context?.landing ?? DEMO_CONTEXT.landing
  const customer = context?.customer
  const heroImage = resolveAssetUrl(landing.heroImageUrl, context?.apiBaseUrl)
  const imageStyle = heroImage ? { backgroundImage: `linear-gradient(90deg, rgba(6,9,8,.97) 0%, rgba(6,9,8,.84) 45%, rgba(6,9,8,.18) 100%), url(${heroImage})` } : undefined

  return (
    <section id="top" className="hero" style={imageStyle}>
      <div className="hero-grid" aria-hidden="true" />
      <div className="hero-copy">
        <div className="status-badge"><span /> SHOP ONLINE</div>
        <p className="hero-kicker">{landing.brandTagline || "OFFICIAL COMMUNITY STORE"}</p>
        <h1>{landing.heroTitle || "Ready for your next adventure?"}</h1>
        <p className="hero-subtitle">{landing.heroSubtitle || "Discover products and packages for your game server."}</p>
        <div className="hero-actions">
          <button type="button" className="button button-primary" onClick={onBrowse}>Browse products <Icon name="arrow" /></button>
          {!customer?.authenticated && <button type="button" className="button button-ghost" onClick={loginWithSteam}><Icon name="steam" /> Connect Steam</button>}
        </div>
        <div className="hero-meta">
          <span><Icon name="check" /> Secure payment</span>
          <span><Icon name="check" /> Automatic delivery</span>
          <span><Icon name="check" /> Transparent orders</span>
        </div>
      </div>
      <div className="hero-art" aria-hidden="true">
        <div className="hero-card hero-card-back"><span>COMMUNITY</span><strong>SUPPORTER</strong></div>
        <div className="hero-card hero-card-front"><span>PREMIUM ACCESS</span><strong>VIP</strong><small>SERVER PASS</small></div>
        <div className="floating-cross cross-one">+</div>
        <div className="floating-cross cross-two">+</div>
      </div>
    </section>
  )
}

function ProductCard({ product, index, apiBaseUrl, onSelect }: { product: ShopProduct; index: number; apiBaseUrl: string; onSelect: (product: ShopProduct) => void }) {
  const accentClass = ["lime", "orange", "blue"][index % 3]
  const image = resolveAssetUrl(product.imageUrl || product.imageUrls?.[0], apiBaseUrl)

  return (
    <article className={`product-card ${accentClass}`}>
      <div className="product-visual">
        {image ? <img src={image} alt="" /> : <ProductPlaceholder index={index} />}
        <span className="product-category">{product.category || "Package"}</span>
        {product.purchaseType === "subscription" && <span className="subscription-badge">SUBSCRIPTION</span>}
      </div>
      <div className="product-body">
        <div>
          <h3>{product.name}</h3>
          <p>{product.shortDescription || product.description}</p>
        </div>
        <div className="product-footer">
          <div className="price">
            <strong>{formatPrice(product.priceAmountMinor, product.currency)}</strong>
            <span>{getPriceSuffix(product)}</span>
          </div>
          <button type="button" className="card-button" onClick={() => onSelect(product)} aria-label={`View ${product.name}`}>
            <Icon name="arrow" />
          </button>
        </div>
      </div>
    </article>
  )
}

function CheckoutDialog({ product, context, onClose, onError }: { product: ShopProduct; context: StorefrontContext; onClose: () => void; onError: (message: string | null) => void }) {
  const fields = useMemo(() => [...(product.checkoutFields ?? [])].sort((a, b) => a.sortOrder - b.sortOrder), [product.checkoutFields])
  const providers = getAvailableProviders(context)
  const [provider, setProvider] = useState(providers[0] ?? "")
  const [details, setDetails] = useState<Record<string, string>>(() => createInitialDetails(fields))
  const [recipientMode, setRecipientMode] = useState<"self" | "friend">("self")
  const [friendSteamId, setFriendSteamId] = useState("")
  const [validationError, setValidationError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    document.body.style.overflow = "hidden"
    return () => {
      window.removeEventListener("keydown", onKey)
      document.body.style.overflow = ""
    }
  }, [onClose])

  async function submit(event: FormEvent) {
    event.preventDefault()
    const issue = validateCheckout(fields, details, recipientMode, friendSteamId)
    if (issue) {
      setValidationError(issue)
      return
    }

    if (!context.customer?.authenticated) {
      loginWithSteam()
      return
    }

    if (product.requiresDiscordLink && recipientMode === "self" && !context.customer.discordLinked) {
      setValidationError("Your Discord account must be linked for this product.")
      return
    }

    if (!provider) {
      setValidationError("No payment provider is currently available.")
      return
    }

    setSubmitting(true)
    setValidationError(null)
    onError(null)

    const payload: CheckoutPayload = {
      productId: product.id,
      productSlug: product.slug,
      provider,
      customerDetails: cleanDetails(details),
      targetSteamId64: recipientMode === "friend" ? friendSteamId.trim() : context.customer.steamId64,
    }

    try {
      await startCheckout(payload)
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Checkout could not be started."
      setValidationError(message)
      onError(message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="checkout-dialog" role="dialog" aria-modal="true" aria-labelledby="checkout-title">
        <button className="dialog-close" type="button" onClick={onClose} aria-label="Close"><Icon name="close" /></button>
        <div className="dialog-summary">
          <div className="dialog-product-art"><ProductPlaceholder index={product.sortOrder} /></div>
          <p className="eyebrow">CHECKOUT</p>
          <h2 id="checkout-title">{product.name}</h2>
          <p>{product.shortDescription || product.description}</p>
          <div className="dialog-price">{formatPrice(product.priceAmountMinor, product.currency)} <span>{getPriceSuffix(product)}</span></div>
          <ul>
            <li><Icon name="check" /> Secure payment redirect</li>
            <li><Icon name="check" /> Order saved to your customer account</li>
            <li><Icon name="check" /> Automated delivery</li>
          </ul>
        </div>

        <form className="checkout-form" onSubmit={submit}>
          <div className="form-heading">
            <p className="eyebrow">ORDER DETAILS</p>
            <h3>Complete your purchase</h3>
          </div>

          {product.allowFriendPurchase !== false && (
            <fieldset className="recipient-picker">
              <legend>Recipient</legend>
              <div>
                <button type="button" className={recipientMode === "self" ? "active" : ""} onClick={() => setRecipientMode("self")}><Icon name="user" /> For me</button>
                <button type="button" className={recipientMode === "friend" ? "active" : ""} onClick={() => setRecipientMode("friend")}><Icon name="gift" /> For a friend</button>
              </div>
              {recipientMode === "friend" && (
                <label className="field-label">
                  Recipient SteamID64 <span>*</span>
                  <input value={friendSteamId} onChange={(event) => setFriendSteamId(event.target.value)} placeholder="7656119…" inputMode="numeric" />
                </label>
              )}
            </fieldset>
          )}

          {fields.length > 0 && (
            <div className="fields-grid">
              {fields.map((field) => (
                <CheckoutField key={field.id} field={field} value={details[field.id] ?? ""} onChange={(value) => setDetails((current) => ({ ...current, [field.id]: value }))} />
              ))}
            </div>
          )}

          {product.requiresDiscordLink && recipientMode === "self" && (
            <div className={`discord-status ${context.customer?.discordLinked ? "linked" : ""}`}>
              <span><Icon name="discord" /></span>
              <div>
                <strong>{context.customer?.discordLinked ? "Discord linked" : "Discord link required"}</strong>
                <p>{context.customer?.discordLinked ? "Your role can be delivered automatically." : "Link Discord to your store account before purchasing."}</p>
              </div>
              {!context.customer?.discordLinked && <button type="button" onClick={linkDiscord}>Link</button>}
            </div>
          )}

          <fieldset className="payment-picker">
            <legend>Payment method</legend>
            <div>
              {providers.map((item) => (
                <button key={item} type="button" className={provider === item ? "active" : ""} onClick={() => setProvider(item)}>
                  <span className="payment-logo">{item === "paypal" ? "P" : "S"}</span>
                  <span>{item === "paypal" ? "PayPal" : "Stripe"}<small>{item === "paypal" ? "PayPal Checkout" : "Cards & wallets"}</small></span>
                  <span className="radio-dot" />
                </button>
              ))}
            </div>
          </fieldset>

          {validationError && <Notice tone="danger" title="Checkout unavailable">{validationError}</Notice>}

          <button className="button button-primary checkout-submit" type="submit" disabled={submitting}>
            {submitting ? "Starting checkout…" : context.customer?.authenticated ? `Pay ${formatPrice(product.priceAmountMinor, product.currency)}` : "Sign in with Steam & buy"}
            <Icon name="arrow" />
          </button>
          <p className="legal-note">By purchasing, you accept the terms and privacy information configured in the main store.</p>
        </form>
      </section>
    </div>
  )
}

function CheckoutField({ field, value, onChange }: { field: ShopCheckoutField; value: string; onChange: (value: string) => void }) {
  const label = field.prompt?.trim() || field.label
  const required = field.isRequired ? <span>*</span> : null

  if (field.type === "checkbox") {
    return (
      <label className="checkbox-field">
        <input type="checkbox" checked={value === "true"} onChange={(event) => onChange(event.target.checked ? "true" : "false")} />
        <span><strong>{label} {required}</strong>{field.helpText && <small>{field.helpText}</small>}</span>
      </label>
    )
  }

  if (isSelectField(field.type)) {
    return (
      <label className="field-label">
        {label} {required}
        <select value={value} required={field.isRequired} onChange={(event) => onChange(event.target.value)}>
          <option value="">{field.placeholder || "Please select"}</option>
          {(field.options ?? []).map((option) => <option key={`${field.id}-${option.value}`} value={option.value}>{option.label}</option>)}
        </select>
        {field.helpText && <small>{field.helpText}</small>}
      </label>
    )
  }

  if (field.type === "textarea") {
    return (
      <label className="field-label field-wide">
        {label} {required}
        <textarea value={value} required={field.isRequired} onChange={(event) => onChange(event.target.value)} placeholder={field.placeholder ?? ""} rows={4} />
        {field.helpText && <small>{field.helpText}</small>}
      </label>
    )
  }

  if (field.type === "color") {
    return (
      <label className="field-label">
        {label} {required}
        <div className="color-input"><input type="color" value={/^#[0-9a-f]{6}$/i.test(value) ? value : "#d6ff4b"} onChange={(event) => onChange(event.target.value)} /><input value={value} onChange={(event) => onChange(event.target.value)} placeholder="#d6ff4b" /></div>
        {field.helpText && <small>{field.helpText}</small>}
      </label>
    )
  }

  return (
    <label className="field-label">
      {label} {required}
      <input
        type={field.type === "number" ? "number" : "text"}
        value={value}
        required={field.isRequired}
        onChange={(event) => onChange(event.target.value)}
        placeholder={field.placeholder ?? ""}
        inputMode={field.type === "steam_id64" ? "numeric" : undefined}
      />
      {field.helpText && <small>{field.helpText}</small>}
    </label>
  )
}

function AccessGate({ context, onUnlocked }: { context: StorefrontContext; onUnlocked: (context: StorefrontContext) => void }) {
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const isPasswordMode = context.access?.mode === "password" && context.access.passwordConfigured

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!password.trim()) return
    setLoading(true)
    setError(null)
    try {
      onUnlocked(await unlockShopAccess(password))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The store could not be unlocked.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="access-gate">
      <span><Icon name="lock" /></span>
      <div>
        <p className="eyebrow">PROTECTED STORE</p>
        <h3>{context.access?.title || "Store currently unavailable"}</h3>
        <p>{context.access?.message || "The store is currently protected or undergoing maintenance."}</p>
        {isPasswordMode && (
          <form onSubmit={submit}>
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Store password" autoComplete="current-password" />
            <button className="button button-primary" type="submit" disabled={loading}>{loading ? "Checking…" : "Open store"}</button>
          </form>
        )}
        {error && <small>{error}</small>}
      </div>
    </div>
  )
}

function TrustItem({ icon, title, text }: { icon: IconName; title: string; text: string }) {
  return <div className="trust-item"><span><Icon name={icon} /></span><div><strong>{title}</strong><p>{text}</p></div></div>
}

function Stat({ value, label }: { value: string; label: string }) {
  return <div><strong>{value}</strong><span>{label}</span></div>
}

function Notice({ tone, title, children }: { tone: "danger" | "warning"; title: string; children: React.ReactNode }) {
  return <div className={`notice ${tone}`}><Icon name={tone === "danger" ? "warning" : "lock"} /><div><strong>{title}</strong><p>{children}</p></div></div>
}

function Footer({ context }: { context: StorefrontContext | null }) {
  const landing = context?.landing ?? DEMO_CONTEXT.landing
  return (
    <footer id="footer" className="site-footer">
      <div className="footer-brand"><span className="brand-mark"><Icon name="radar" /></span><div><strong>{landing.storeName || "SERVER STORE"}</strong><p>{landing.footerText || "Official Community Store"}</p></div></div>
      <div className="footer-links"><a href="#products">Products</a><a href="#top">Home</a><a href="#footer">Support</a></div>
      <p className="copyright">© {new Date().getFullYear()} {landing.storeName || "Server Store"}. Powered by ServerSentry.</p>
    </footer>
  )
}

function ProductSkeletons() {
  return <div className="product-grid">{[1, 2, 3].map((item) => <div key={item} className="product-card skeleton"><div className="product-visual" /><div className="product-body"><span /><span /><span /></div></div>)}</div>
}

function ProductPlaceholder({ index }: { index: number }) {
  return (
    <div className="product-placeholder">
      <div className="placeholder-grid" />
      <span className="placeholder-number">0{(Math.abs(index) % 9) + 1}</span>
      <Icon name={index % 2 === 0 ? "shield" : "package"} />
    </div>
  )
}

function formatPrice(amountMinor: number, currency: string) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: currency || "EUR" }).format((amountMinor || 0) / 100)
}

function getPriceSuffix(product: ShopProduct) {
  if (product.purchaseType !== "subscription") return "one-time"
  const count = Math.max(1, product.subscriptionIntervalCount || 1)
  const singular = product.subscriptionInterval === "year" ? "year" : product.subscriptionInterval === "week" ? "week" : product.subscriptionInterval === "day" ? "day" : "month"
  const interval = count === 1 ? singular : `${singular}s`
  return count === 1 ? `/ ${interval}` : `/ ${count} ${interval}`
}

function getAvailableProviders(context: StorefrontContext) {
  const payments = context.payments
  if (!payments) return []
  const values: string[] = []
  const country = getBrowserCountryCode()
  if (payments.payPalEnabled && payments.payPalConfigured && !isCountryBlocked(payments.payPalBlockedCountries, country)) values.push("paypal")
  if (payments.stripeEnabled && payments.stripeConfigured && !isCountryBlocked(payments.stripeBlockedCountries, country)) values.push("stripe")
  return values.sort((a, b) => a === payments.activeProvider ? -1 : b === payments.activeProvider ? 1 : 0)
}

function createInitialDetails(fields: ShopCheckoutField[]) {
  return Object.fromEntries(fields.map((field) => [field.id, field.type === "checkbox" ? "false" : field.type === "color" ? field.placeholder || "#d6ff4b" : ""]))
}

function cleanDetails(details: Record<string, string>) {
  return Object.fromEntries(Object.entries(details).filter(([, value]) => value !== ""))
}

function validateCheckout(fields: ShopCheckoutField[], details: Record<string, string>, recipientMode: "self" | "friend", friendSteamId: string) {
  if (recipientMode === "friend" && !/^7656119\d{10}$/.test(friendSteamId.trim())) {
    return "Please enter a valid SteamID64 for the recipient."
  }
  const missing = fields.find((field) => field.isRequired && (field.type === "checkbox" ? details[field.id] !== "true" : !details[field.id]?.trim()))
  if (missing) return `Please complete “${missing.prompt?.trim() || missing.label}”.`
  return null
}

function isSelectField(type: string) {
  return type === "select" || type === "cftools_server_select" || type === "game_server_select"
}

function resolveAssetUrl(value?: string | null, apiBaseUrl = "") {
  if (!value?.trim()) return undefined
  try {
    return new URL(value, apiBaseUrl || window.location.origin).toString()
  } catch {
    return value
  }
}

function getBrowserCountryCode() {
  const locales = [navigator.language, ...(navigator.languages ?? [])]
  for (const locale of locales) {
    const match = locale.match(/(?:-|_)([A-Za-z]{2})(?:$|-|_)/u)
    if (match) return match[1].toUpperCase()
  }
  return null
}

function isCountryBlocked(values: string[] | undefined, country: string | null) {
  if (!country) return false
  return (values ?? []).some((value) => value.trim().toUpperCase() === country)
}

function normalizeAccent(value?: string | null) {
  return /^#[0-9a-f]{6}$/i.test(value ?? "") ? value! : "#d6ff4b"
}

type IconName = "arrow" | "bolt" | "check" | "close" | "discord" | "gift" | "headset" | "lock" | "menu" | "package" | "radar" | "search" | "shield" | "steam" | "user" | "warning"

function Icon({ name }: { name: IconName }) {
  const paths: Record<IconName, React.ReactNode> = {
    arrow: <><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></>,
    bolt: <path d="m13 2-9 12h7l-1 8 9-12h-7l1-8Z"/>,
    check: <path d="m5 12 4 4L19 6"/>,
    close: <><path d="m6 6 12 12"/><path d="m18 6-12 12"/></>,
    discord: <><path d="M8.5 8.5a8 8 0 0 1 7 0"/><path d="M7 17c-1.6-.5-2.8-1.3-3.7-2.3.7-4.6 2.1-7.8 4-9.5l2.5 1.2"/><path d="M17 17c1.6-.5 2.8-1.3 3.7-2.3-.7-4.6-2.1-7.8-4-9.5l-2.5 1.2"/><circle cx="9" cy="13" r="1"/><circle cx="15" cy="13" r="1"/><path d="M8 17c2.5 1.3 5.5 1.3 8 0"/></>,
    gift: <><path d="M20 12v10H4V12"/><path d="M2 7h20v5H2z"/><path d="M12 22V7"/><path d="M12 7H7.5A2.5 2.5 0 1 1 10 4.5C10 7 12 7 12 7Z"/><path d="M12 7h4.5A2.5 2.5 0 1 0 14 4.5C14 7 12 7 12 7Z"/></>,
    headset: <><path d="M4 14v-2a8 8 0 0 1 16 0v2"/><path d="M18 19c0 1.7-1.3 3-3 3h-3"/><path d="M4 14h3v5H4a2 2 0 0 1-2-2v-1a2 2 0 0 1 2-2Z"/><path d="M20 14h-3v5h3a2 2 0 0 0 2-2v-1a2 2 0 0 0-2-2Z"/></>,
    lock: <><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></>,
    menu: <><path d="M4 7h16"/><path d="M4 12h16"/><path d="M4 17h16"/></>,
    package: <><path d="m21 8-9 5-9-5"/><path d="m3 8 9-5 9 5v8l-9 5-9-5Z"/><path d="M12 13v8"/><path d="m7.5 5.5 9 5"/></>,
    radar: <><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/><path d="m12 12 6-6"/></>,
    search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
    shield: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/>,
    steam: <><circle cx="8" cy="15" r="3"/><circle cx="17" cy="8" r="3"/><path d="m10.5 13.5 4-3"/><path d="M5 14 2 12"/><path d="m11 16 3 1.5a3 3 0 1 0 3-5.5"/></>,
    user: <><circle cx="12" cy="8" r="4"/><path d="M4 22a8 8 0 0 1 16 0"/></>,
    warning: <><path d="M12 3 2 21h20L12 3Z"/><path d="M12 9v5"/><path d="M12 18h.01"/></>,
  }

  return <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>
}
