import { FormEvent, useEffect, useMemo, useRef, useState } from "react"
import Markdown from "react-markdown"
import {
  connectStorefront,
  refreshStorefront,
  linkDiscord,
  loginWithSteam,
  logout,
  startCheckout,
  unlockShopAccess,
} from "./bridge"
import type { CheckoutPayload, ShopLandingSettings, ShopCheckoutField, StorefrontContext } from "./types"
import { demoMode, siteConfig } from "./config"
import { DEMO_CONTEXT } from "./demo"
import {
  formatPrice,
  getAvailableProviders,
  getBrowserCountryCode,
  isSelectField,
  validateCheckout,
} from "./checkout"
import { billingLabel, groupCatalogProducts, offerLabel, type CatalogGroup } from "./catalog"
import { Community } from "./CommunityPages"
import { SiteLink, usePath } from "./routing"
import { legalDocument } from "./legal"

const FALLBACK_LANDING: ShopLandingSettings = {
  storeName: siteConfig.communityName,
  heroTitle: "Community store",
  heroSubtitle: "",
  shopEnabled: false,
}

export function App() {
  const path = usePath()
  const [context, setContext] = useState<StorefrontContext | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState("")
  const [category, setCategory] = useState("All")
  const [selectedProduct, setSelectedProduct] = useState<CatalogGroup | null>(null)
  const callbackQuery = new URLSearchParams(window.location.search)
  const authNotice = callbackQuery.has("auth_error")
    ? "Steam sign-in did not complete. Please try again."
    : callbackQuery.has("discord_link_error")
      ? "Discord linking did not complete. Please try again."
      : null
  useEffect(
    () =>
      connectStorefront(
        (value) => {
          setContext(value)
          setError(null)
        },
        (caught) => setError(caught.message),
      ),
    [],
  )
  useEffect(() => {
    const restored = (event: PageTransitionEvent) => {
      if (event.persisted) setSelectedProduct(null)
    }
    window.addEventListener("pageshow", restored)
    return () => window.removeEventListener("pageshow", restored)
  }, [])
  useEffect(() => {
    setSelectedProduct(null)
  }, [path])
  const landing = context?.landing ?? FALLBACK_LANDING
  const products = useMemo(() => groupCatalogProducts(context?.products ?? []), [context?.products])
  const categories = useMemo(
    () => [
      "All",
      ...Array.from(
        new Set(products.map((group) => group.representative.category?.trim()).filter(Boolean) as string[]),
      ),
    ],
    [products],
  )
  const visibleProducts = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("en")
    return products.filter(
      (group) =>
        (category === "All" || group.representative.category === category) &&
        (!normalized ||
          [group.name, ...group.offers.map(offerLabel), group.representative.description].some((value) =>
            value.toLocaleLowerCase("en").includes(normalized),
          )),
    )
  }, [category, products, query])
  const legalKey =
    path === "/terms" || path === "/legal/terms-of-service"
      ? "terms"
      : path === "/privacy" || path === "/legal/privacy-policy"
        ? "privacy"
        : null
  const communityPage =
    path === "/" ? "home" : path === "/servers" ? "servers" : path === "/leaderboard" ? "leaderboard" : null
  useEffect(() => {
    const page =
      legalKey === "terms"
        ? "Terms"
        : legalKey === "privacy"
          ? "Privacy"
          : path === "/store"
            ? "Store"
            : path === "/servers"
              ? "Servers"
              : path === "/leaderboard"
                ? "Leaderboard"
                : "Home"
    document.title = `${page} · ${landing.storeName || siteConfig.communityName}`
  }, [path, legalKey, landing.storeName])
  const accessBlocked = Boolean(
    context &&
    (!context.landing.shopEnabled || !context.access?.allowed || context.access.mode === "maintenance"),
  )
  return (
    <div className="app-shell">
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <Header context={context} path={path} onError={setError} />
      {demoMode && (
        <div className="demo-banner" role="status">
          Preview / sample server and product data. Account and payment actions are disabled.
        </div>
      )}
      <main id="main-content" tabIndex={-1}>
        {authNotice && (
          <Notice tone="warning" title="Account update">
            {authNotice}
          </Notice>
        )}
        {error && (
          <Notice tone="danger" title="Website connection">
            {error}{" "}
            <button
              className="text-button"
              type="button"
              onClick={() => void refreshStorefront().catch((caught) => setError(caught.message))}
            >
              Try again
            </button>
          </Notice>
        )}
        {communityPage && <Community page={communityPage} context={context} />}
        {path === "/store" && (
          <>
            <header className="page-heading">
              <p className="eyebrow">COMMUNITY STORE</p>
              <h1>
                A little support.
                <br />
                <em>A lasting difference.</em>
              </h1>
              <p>
                Explore community products. Review the price, duration and included benefits before you buy.
              </p>
            </header>
            <section id="products" className="products-section">
              <div className="section-head">
                <div>
                  <p className="eyebrow">{landing.shopProductsEyebrow || "COMMUNITY STORE"}</p>
                  <h2>{landing.shopProductsTitle || "Choose Your Package"}</h2>
                  <p>
                    {landing.shopProductsSubtitle ||
                      "Choose a product to see its options and delivery requirements."}
                  </p>
                </div>
                <div className="result-pill">
                  {visibleProducts.length} {visibleProducts.length === 1 ? "Product" : "Products"}
                </div>
              </div>

              {accessBlocked && context && <AccessGate context={context} onUnlocked={setContext} />}

              {!accessBlocked && (
                <>
                  <div className="catalog-toolbar">
                    <label className="search-box">
                      <Icon name="search" />
                      <input
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder="Search products…"
                        aria-label="Search products"
                      />
                    </label>
                    <div className="category-tabs" aria-label="Categories">
                      {categories.map((item) => (
                        <button
                          key={item}
                          type="button"
                          className={category === item ? "active" : ""}
                          aria-pressed={category === item}
                          onClick={() => setCategory(item)}
                        >
                          {item}
                        </button>
                      ))}
                    </div>
                  </div>

                  {!context ? (
                    error ? null : (
                      <ProductSkeletons />
                    )
                  ) : visibleProducts.length > 0 ? (
                    <div className="product-grid">
                      {visibleProducts.map((product, index) => (
                        <ProductCard
                          key={product.id}
                          group={product}
                          index={index}
                          apiBaseUrl={context?.apiBaseUrl ?? ""}
                          onSelect={setSelectedProduct}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="empty-state">
                      <span className="empty-icon">
                        <Icon name="package" />
                      </span>
                      <h3>{products.length ? "No products found" : "No products available"}</h3>
                      <p>
                        {products.length
                          ? "Change your search or select another category."
                          : "The store has no active products. Check back later."}
                      </p>
                    </div>
                  )}
                </>
              )}
            </section>
          </>
        )}
        {legalKey && <LegalContent context={context} pageKey={legalKey} />}
        {!communityPage && path !== "/store" && !legalKey && (
          <section className="empty-state page-heading">
            <p className="eyebrow">404</p>
            <h1>Off the map.</h1>
            <p>This page does not exist.</p>
            <SiteLink to="/" className="button button-primary">
              Back home
            </SiteLink>
          </section>
        )}
      </main>
      <Footer context={context} />
      {selectedProduct && (
        <CheckoutDialog
          group={selectedProduct}
          context={context ?? DEMO_CONTEXT}
          onClose={() => setSelectedProduct(null)}
          onError={setError}
        />
      )}
    </div>
  )
}

function Header({
  context,
  path,
  onError,
}: {
  context: StorefrontContext | null
  path: string
  onError: (message: string) => void
}) {
  const landing = context?.landing ?? FALLBACK_LANDING
  const customer = context?.customer
  const [menuOpen, setMenuOpen] = useState(false)
  useEffect(() => setMenuOpen(false), [path])
  return (
    <header className="site-header">
      <SiteLink className="brand" to="/" aria-label={landing.storeName}>
        {landing.headerLogoUrl ? (
          <img src={resolveAssetUrl(landing.headerLogoUrl)} alt="" width={38} height={38} decoding="async" />
        ) : (
          <span className="brand-mark">
            <Icon name="radar" />
          </span>
        )}
        <span>
          <strong>{landing.storeName}</strong>
          <small>{landing.brandTagline || siteConfig.tagline}</small>
        </span>
      </SiteLink>
      <nav id="main-navigation" aria-label="Main navigation" className={menuOpen ? "nav-open" : ""}>
        {[
          ["/", "Home"],
          ["/servers", "Servers"],
          ["/leaderboard", "Leaderboard"],
          ["/store", "Store"],
        ].map(([to, label]) => (
          <SiteLink key={to} to={to} aria-current={path === to ? "page" : undefined}>
            {label}
          </SiteLink>
        ))}
        {customer?.authenticated && (
          <button
            className="mobile-account-action"
            type="button"
            onClick={() => {
              setMenuOpen(false)
              void logout().catch((caught) => onError(caught.message))
            }}
          >
            Log out
          </button>
        )}
      </nav>
      <div className="header-actions">
        {customer?.authenticated ? (
          <div className="account-menu">
            <span className="account-avatar">
              {customer.avatarUrl ? (
                <img src={resolveAssetUrl(customer.avatarUrl)} alt="" width={32} height={32} />
              ) : (
                <Icon name="user" />
              )}
            </span>
            <div>
              <strong>{customer.displayName || "Steam player"}</strong>
              <button type="button" onClick={() => void logout().catch((caught) => onError(caught.message))}>
                Log out
              </button>
            </div>
          </div>
        ) : (
          <button
            className="button button-secondary login-button"
            type="button"
            aria-label="Sign in with Steam"
            disabled={demoMode || !context}
            onClick={loginWithSteam}
          >
            <Icon name="steam" />
            <span>Sign in</span>
          </button>
        )}
        <button
          className="mobile-menu"
          type="button"
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
          aria-controls="main-navigation"
          onClick={() => setMenuOpen((value) => !value)}
        >
          <Icon name={menuOpen ? "close" : "menu"} />
        </button>
      </div>
    </header>
  )
}

function LegalContent({
  context,
  pageKey,
}: {
  context: StorefrontContext | null
  pageKey: "terms" | "privacy"
}) {
  const page = context ? legalDocument(context.landing, pageKey) : null
  return (
    <section className="legal-layout">
      <aside>
        <p className="eyebrow">COMMUNITY INFORMATION</p>
        <SiteLink to="/terms" aria-current={pageKey === "terms" ? "page" : undefined}>
          Terms of service ↗
        </SiteLink>
        <SiteLink to="/privacy" aria-current={pageKey === "privacy" ? "page" : undefined}>
          Privacy policy ↗
        </SiteLink>
        <SiteLink to="/">← Back home</SiteLink>
      </aside>
      <article className="legal-content">
        <p className="eyebrow">{context?.landing.storeName || siteConfig.communityName}</p>
        <h1>{page?.title || (pageKey === "terms" ? "Terms of service" : "Privacy policy")}</h1>
        {!context ? (
          <p role="status">Loading document…</p>
        ) : page ? (
          <Markdown skipHtml components={{ img: () => null, h1: ({ children }) => <h2>{children}</h2> }}>
            {page.body}
          </Markdown>
        ) : (
          <div className="empty-state">
            <h2>Document not published.</h2>
            <p>This document has not been configured or is hidden. Contact the community operator.</p>
          </div>
        )}
      </article>
    </section>
  )
}

function ProductCard({
  group,
  index,
  apiBaseUrl,
  onSelect,
}: {
  group: CatalogGroup
  index: number
  apiBaseUrl: string
  onSelect: (group: CatalogGroup) => void
}) {
  const product = group.representative
  const image = resolveAssetUrl(product.imageUrl || product.imageUrls?.[0], apiBaseUrl)

  return (
    <article className="product-card">
      <div className="product-visual">
        {image ? (
          <img src={image} alt="" width={640} height={360} loading="lazy" decoding="async" />
        ) : (
          <ProductPlaceholder index={index} />
        )}
        <span className="product-category">{product.category || "Package"}</span>
        {product.purchaseType === "subscription" && <span className="subscription-badge">SUBSCRIPTION</span>}
      </div>
      <div className="product-body">
        <div>
          <h3>{group.name}</h3>
          <p>{product.shortDescription || product.description}</p>
          {group.offers.length > 1 && (
            <p className="product-options">
              {group.offers.length} options · {product.variantConfiguration?.label || product.name} shown
            </p>
          )}
        </div>
        <div className="product-footer">
          <div className="price">
            <strong>{formatPrice(product.priceAmountMinor, product.currency)}</strong>
            <span>{billingLabel(product)}</span>
          </div>
          <button
            type="button"
            className="card-button"
            onClick={() => onSelect(group)}
            aria-label={`View ${group.name}`}
          >
            <Icon name="arrow" />
          </button>
        </div>
      </div>
    </article>
  )
}

function CheckoutDialog({
  group,
  context,
  onClose,
  onError,
}: {
  group: CatalogGroup
  context: StorefrontContext
  onClose: () => void
  onError: (message: string | null) => void
}) {
  const [product, setProduct] = useState(group.representative)
  const fields = useMemo(
    () => [...(product.checkoutFields ?? [])].sort((a, b) => a.sortOrder - b.sortOrder),
    [product.checkoutFields],
  )
  const providers = getAvailableProviders(context)
  const [provider, setProvider] = useState(providers[0] ?? "")
  const [details, setDetails] = useState<Record<string, string>>(() => createInitialDetails(fields))
  const [recipientMode, setRecipientMode] = useState<"self" | "friend">("self")
  const [friendSteamId, setFriendSteamId] = useState("")
  const [validationError, setValidationError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const dialogRef = useRef<HTMLDialogElement>(null)
  const submittingRef = useRef(false)

  function chooseOffer(id: string) {
    if (submittingRef.current) return
    const next = group.offers.find((offer) => offer.id === id)
    if (!next) return
    setProduct(next)
    setDetails(createInitialDetails(next.checkoutFields))
    setRecipientMode("self")
    setFriendSteamId("")
    setProvider(providers[0] ?? "")
    setValidationError(null)
  }
  useEffect(() => {
    const dialog = dialogRef.current
    const returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const previousOverflow = document.body.style.overflow
    dialog?.showModal()
    document.body.style.overflow = "hidden"
    return () => {
      dialog?.close()
      document.body.style.overflow = previousOverflow
      returnFocus?.focus()
    }
  }, [])

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (demoMode || submittingRef.current) return
    const issue = validateCheckout(fields, details, recipientMode, friendSteamId)
    if (issue) {
      setValidationError(issue)
      return
    }

    if (!context.customer?.authenticated) {
      loginWithSteam()
      return
    }

    if (
      product.requiresDiscordLink &&
      !product.discordDeliveryOptional &&
      recipientMode === "self" &&
      !context.customer.discordLinked
    ) {
      setValidationError("Your Discord account must be linked for this product.")
      return
    }

    if (!provider) {
      setValidationError("No payment provider is currently available.")
      return
    }

    submittingRef.current = true
    setSubmitting(true)
    setValidationError(null)
    onError(null)

    const payload: CheckoutPayload = {
      countryCode: getBrowserCountryCode(),
      productId: product.id,
      productSlug: product.slug,
      provider,
      customerDetails: cleanDetails(details),
      targetSteamId64: recipientMode === "friend" ? friendSteamId.trim() : context.customer.steamId64,
    }

    try {
      await startCheckout(payload, product)
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Checkout could not be started."
      setValidationError(message)
      onError(message)
      submittingRef.current = false
      setSubmitting(false)
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="dialog-backdrop"
      aria-labelledby="checkout-title"
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      onClick={(event) => event.target === event.currentTarget && onClose()}
    >
      <section className="checkout-dialog">
        <button className="dialog-close" type="button" onClick={onClose} aria-label="Close">
          <Icon name="close" />
        </button>
        <div className="dialog-summary">
          <p className="eyebrow">CHECKOUT</p>
          <h2 id="checkout-title">{product.name}</h2>
          <p>{product.shortDescription || product.description}</p>
          <div className="dialog-price" aria-live="polite">
            {formatPrice(product.priceAmountMinor, product.currency)} <span>{billingLabel(product)}</span>
          </div>
          <ul>
            <li>
              <Icon name="check" /> Secure payment redirect
            </li>
            <li>
              <Icon name="check" /> Order saved to your customer account
            </li>
            <li>
              <Icon name="check" /> Automated delivery
            </li>
          </ul>
        </div>

        <form className="checkout-form" onSubmit={submit}>
          <div className="form-heading">
            <p className="eyebrow">ORDER DETAILS</p>
            <h3>Complete your purchase</h3>
          </div>

          {group.offers.length > 1 && (
            <label className="field-label offer-picker">
              Product option
              <select
                value={product.id}
                disabled={submitting}
                onChange={(event) => chooseOffer(event.target.value)}
              >
                {group.offers.map((offer) => (
                  <option key={offer.id} value={offer.id}>
                    {offerLabel(offer)}
                  </option>
                ))}
              </select>
              <small>
                Each option has its own price, access duration and included benefits. Subscriptions renew at
                the displayed interval.
              </small>
            </label>
          )}

          {product.allowFriendPurchase === true && (
            <fieldset className="recipient-picker">
              <legend>Recipient</legend>
              <div>
                <button
                  type="button"
                  className={recipientMode === "self" ? "active" : ""}
                  onClick={() => setRecipientMode("self")}
                >
                  <Icon name="user" /> For me
                </button>
                <button
                  type="button"
                  className={recipientMode === "friend" ? "active" : ""}
                  onClick={() => setRecipientMode("friend")}
                >
                  <Icon name="gift" /> For a friend
                </button>
              </div>
              {recipientMode === "friend" && (
                <label className="field-label">
                  Recipient SteamID64 <span>*</span>
                  <input
                    value={friendSteamId}
                    onChange={(event) => setFriendSteamId(event.target.value)}
                    placeholder="7656119…"
                    inputMode="numeric"
                  />
                </label>
              )}
            </fieldset>
          )}

          {fields.length > 0 && (
            <div className="fields-grid">
              {fields.map((field) => (
                <CheckoutField
                  key={field.id}
                  field={field}
                  value={details[field.id] ?? ""}
                  onChange={(value) => setDetails((current) => ({ ...current, [field.id]: value }))}
                />
              ))}
            </div>
          )}

          {product.requiresDiscordLink && recipientMode === "self" && (
            <div className={`discord-status ${context.customer?.discordLinked ? "linked" : ""}`}>
              <span>
                <Icon name="discord" />
              </span>
              <div>
                <strong>
                  {context.customer?.discordLinked
                    ? "Discord linked"
                    : product.discordDeliveryOptional
                      ? "Optional Discord benefits"
                      : "Discord link required"}
                </strong>
                <p>
                  {context.customer?.discordLinked
                    ? "Your role can be delivered automatically."
                    : product.discordDeliveryOptional
                      ? "Link Discord to receive the optional Discord benefits. You can continue without linking."
                      : "Link Discord to your store account before purchasing."}
                </p>
              </div>
              {!context.customer?.discordLinked && (
                <button
                  type="button"
                  disabled={demoMode || !context.customer?.authenticated}
                  onClick={linkDiscord}
                >
                  Link
                </button>
              )}
            </div>
          )}

          <fieldset className="payment-picker">
            <legend>Payment method</legend>
            <div>
              {providers.map((item) => (
                <button
                  key={item}
                  type="button"
                  className={provider === item ? "active" : ""}
                  onClick={() => setProvider(item)}
                >
                  <span className="payment-logo">{item === "paypal" ? "P" : "S"}</span>
                  <span>
                    {item === "paypal" ? "PayPal" : "Stripe"}
                    <small>{item === "paypal" ? "PayPal Checkout" : "Cards & wallets"}</small>
                  </span>
                  <span className="radio-dot" />
                </button>
              ))}
            </div>
          </fieldset>

          {!providers.length && (
            <Notice tone="warning" title="Payments unavailable">
              No payment provider is available for this account and country.
            </Notice>
          )}

          {validationError && (
            <Notice tone="danger" title="Checkout unavailable">
              {validationError}
            </Notice>
          )}

          <button
            className="button button-primary checkout-submit"
            type="submit"
            disabled={demoMode || submitting || !providers.length}
          >
            {demoMode
              ? "Demo — payments disabled"
              : submitting
                ? "Starting checkout…"
                : context.customer?.authenticated
                  ? `Pay ${formatPrice(product.priceAmountMinor, product.currency)}`
                  : "Sign in with Steam & buy"}
            <Icon name="arrow" />
          </button>
          <p className="legal-note">
            Review our <SiteLink to="/terms">Terms</SiteLink> and{" "}
            <SiteLink to="/privacy">Privacy policy</SiteLink> before continuing to payment.
          </p>
        </form>
      </section>
    </dialog>
  )
}

function CheckoutField({
  field,
  value,
  onChange,
}: {
  field: ShopCheckoutField
  value: string
  onChange: (value: string) => void
}) {
  const label = field.prompt?.trim() || field.label
  const required = field.isRequired ? <span>*</span> : null

  if (field.type === "checkbox") {
    return (
      <label className="checkbox-field">
        <input
          type="checkbox"
          checked={value === "true"}
          onChange={(event) => onChange(event.target.checked ? "true" : "false")}
        />
        <span>
          <strong>
            {label} {required}
          </strong>
          {field.helpText && <small>{field.helpText}</small>}
        </span>
      </label>
    )
  }

  if (isSelectField(field.type)) {
    return (
      <label className="field-label">
        {label} {required}
        <select value={value} required={field.isRequired} onChange={(event) => onChange(event.target.value)}>
          <option value="">{field.placeholder || "Please select"}</option>
          {(field.options ?? []).map((option) => (
            <option key={`${field.id}-${option.value}`} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {field.helpText && <small>{field.helpText}</small>}
      </label>
    )
  }

  if (field.type === "textarea") {
    return (
      <label className="field-label field-wide">
        {label} {required}
        <textarea
          value={value}
          required={field.isRequired}
          onChange={(event) => onChange(event.target.value)}
          placeholder={field.placeholder ?? ""}
          rows={4}
        />
        {field.helpText && <small>{field.helpText}</small>}
      </label>
    )
  }

  if (field.type === "color") {
    return (
      <label className="field-label">
        {label} {required}
        <div className="color-input">
          <input
            type="color"
            value={/^#[0-9a-f]{6}$/i.test(value) ? value : "#b9d6a3"}
            onChange={(event) => onChange(event.target.value)}
          />
          <input value={value} onChange={(event) => onChange(event.target.value)} placeholder="#b9d6a3" />
        </div>
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

function AccessGate({
  context,
  onUnlocked,
}: {
  context: StorefrontContext
  onUnlocked: (context: StorefrontContext) => void
}) {
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
      <span>
        <Icon name="lock" />
      </span>
      <div>
        <p className="eyebrow">PROTECTED STORE</p>
        <h3>{context.access?.title || "Store currently unavailable"}</h3>
        <p>{context.access?.message || "The store is currently protected or undergoing maintenance."}</p>
        {isPasswordMode && (
          <form onSubmit={submit}>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Store password"
              aria-label="Store password"
              autoComplete="current-password"
              required
            />
            <button className="button button-primary" type="submit" disabled={loading}>
              {loading ? "Checking…" : "Open store"}
            </button>
          </form>
        )}
        {error && <small>{error}</small>}
      </div>
    </div>
  )
}

function Notice({
  tone,
  title,
  children,
}: {
  tone: "danger" | "warning"
  title: string
  children: React.ReactNode
}) {
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={`notice ${tone}`}>
      <Icon name={tone === "danger" ? "warning" : "lock"} />
      <div>
        <strong>{title}</strong>
        <p>{children}</p>
      </div>
    </div>
  )
}

function Footer({ context }: { context: StorefrontContext | null }) {
  const landing = context?.landing ?? FALLBACK_LANDING
  return (
    <footer id="footer" className="site-footer">
      <div className="footer-brand">
        <strong>{landing.storeName}</strong>
        <p>{landing.footerText || "A community worth coming back to."}</p>
      </div>
      <div className="footer-links">
        <SiteLink to="/servers">Servers</SiteLink>
        <SiteLink to="/store">Store</SiteLink>
        <SiteLink to="/terms">Terms</SiteLink>
        <SiteLink to="/privacy">Privacy</SiteLink>
        {!demoMode && <a href="/shop/orders">My orders ↗</a>}
      </div>
      <p className="copyright">
        © {new Date().getFullYear()} {landing.storeName}. Powered by ServerSentry.
      </p>
    </footer>
  )
}

function ProductSkeletons() {
  return (
    <div className="product-grid">
      {[1, 2, 3].map((item) => (
        <div key={item} className="product-card skeleton">
          <div className="product-visual" />
          <div className="product-body">
            <span />
            <span />
            <span />
          </div>
        </div>
      ))}
    </div>
  )
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

function createInitialDetails(fields: ShopCheckoutField[]) {
  return Object.fromEntries(
    fields.map((field) => [
      field.id,
      field.type === "checkbox" ? "false" : field.type === "color" ? field.placeholder || "#b9d6a3" : "",
    ]),
  )
}

function cleanDetails(details: Record<string, string>) {
  return Object.fromEntries(Object.entries(details).filter(([, value]) => value !== ""))
}

function resolveAssetUrl(value?: string | null, apiBaseUrl = "") {
  if (!value?.trim()) return undefined
  try {
    const url = new URL(value, apiBaseUrl || window.location.origin)
    return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password ? url.href : undefined
  } catch {
    return undefined
  }
}

type IconName =
  | "arrow"
  | "bolt"
  | "check"
  | "close"
  | "discord"
  | "gift"
  | "headset"
  | "lock"
  | "menu"
  | "package"
  | "radar"
  | "search"
  | "shield"
  | "steam"
  | "user"
  | "warning"

function Icon({ name }: { name: IconName }) {
  const paths: Record<IconName, React.ReactNode> = {
    arrow: (
      <>
        <path d="M5 12h14" />
        <path d="m13 6 6 6-6 6" />
      </>
    ),
    bolt: <path d="m13 2-9 12h7l-1 8 9-12h-7l1-8Z" />,
    check: <path d="m5 12 4 4L19 6" />,
    close: (
      <>
        <path d="m6 6 12 12" />
        <path d="m18 6-12 12" />
      </>
    ),
    discord: (
      <>
        <path d="M8.5 8.5a8 8 0 0 1 7 0" />
        <path d="M7 17c-1.6-.5-2.8-1.3-3.7-2.3.7-4.6 2.1-7.8 4-9.5l2.5 1.2" />
        <path d="M17 17c1.6-.5 2.8-1.3 3.7-2.3-.7-4.6-2.1-7.8-4-9.5l-2.5 1.2" />
        <circle cx="9" cy="13" r="1" />
        <circle cx="15" cy="13" r="1" />
        <path d="M8 17c2.5 1.3 5.5 1.3 8 0" />
      </>
    ),
    gift: (
      <>
        <path d="M20 12v10H4V12" />
        <path d="M2 7h20v5H2z" />
        <path d="M12 22V7" />
        <path d="M12 7H7.5A2.5 2.5 0 1 1 10 4.5C10 7 12 7 12 7Z" />
        <path d="M12 7h4.5A2.5 2.5 0 1 0 14 4.5C14 7 12 7 12 7Z" />
      </>
    ),
    headset: (
      <>
        <path d="M4 14v-2a8 8 0 0 1 16 0v2" />
        <path d="M18 19c0 1.7-1.3 3-3 3h-3" />
        <path d="M4 14h3v5H4a2 2 0 0 1-2-2v-1a2 2 0 0 1 2-2Z" />
        <path d="M20 14h-3v5h3a2 2 0 0 0 2-2v-1a2 2 0 0 0-2-2Z" />
      </>
    ),
    lock: (
      <>
        <rect x="4" y="10" width="16" height="11" rx="2" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3" />
      </>
    ),
    menu: (
      <>
        <path d="M4 7h16" />
        <path d="M4 12h16" />
        <path d="M4 17h16" />
      </>
    ),
    package: (
      <>
        <path d="m21 8-9 5-9-5" />
        <path d="m3 8 9-5 9 5v8l-9 5-9-5Z" />
        <path d="M12 13v8" />
        <path d="m7.5 5.5 9 5" />
      </>
    ),
    radar: (
      <>
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="5" />
        <circle cx="12" cy="12" r="1" />
        <path d="m12 12 6-6" />
      </>
    ),
    search: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-4-4" />
      </>
    ),
    shield: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />,
    steam: (
      <>
        <circle cx="8" cy="15" r="3" />
        <circle cx="17" cy="8" r="3" />
        <path d="m10.5 13.5 4-3" />
        <path d="M5 14 2 12" />
        <path d="m11 16 3 1.5a3 3 0 1 0 3-5.5" />
      </>
    ),
    user: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 22a8 8 0 0 1 16 0" />
      </>
    ),
    warning: (
      <>
        <path d="M12 3 2 21h20L12 3Z" />
        <path d="M12 9v5" />
        <path d="M12 18h.01" />
      </>
    ),
  }

  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name]}
    </svg>
  )
}
