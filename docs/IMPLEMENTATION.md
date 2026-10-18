# Implementing a native community website

## 1. Deployment model

Use an updated ServerSentry frontend and host supporting `custom_site`. Upload a
built static website with index.html at the ZIP root. It runs as the full browser
document on the public installation origin. `/api`, admin, account and order
services remain on ServerSentry. Customer design changes require only a new upload.
This sample has no iframe build, context messages, parent origin list or API query
override. Do not load it as an embedded document.

The host must serve uploaded assets with their correct MIME types, fall back to
the uploaded index for public clean routes, and support the canonical legal paths
described below. Deploy the matching host/frontend changes before uploading this
sample. Uploading website files alone cannot add host routing support. There is
no customer-domain setting in the production bundle.

For visual customization, start with the [AI design guide](AI_DESIGN_GUIDE.md) and
[design brief](DESIGN_BRIEF.md). This document describes the integration contract.

## 2. Local development

Use Node.js 22.22+ and npm 10.9+. Run `npm ci` then `npm run dev` and open
http://127.0.0.1:5175/. No backend means labeled demo mode. `?demo=1` also works
with a production preview; account/payment actions stay disabled. `?demo=0` forces
live mode and shows connection failures instead of sample values.

For real data, copy `.env.example` to `.env.local` and set
`SERVERSENTRY_BACKEND_URL` to the backend's HTTPS origin. HTTP is accepted only for
loopback development. Restart Vite. This non-VITE environment setting configures a
development `/api` proxy; builds contain relative API paths, not a customer domain.

Test real OAuth and provider sandboxes on a staging installation with normal
cookies, trusted hosts/proxies and callback URLs configured for that origin.
The sample does not disable TLS checks or set cross-site cookie workarounds.

## 3. Your design and routes

The default theme lives in `src/styles.css`. Change its CSS variables to change
color. Backend `accentColor`, `themeJson` and `customCss` intentionally do not
override this custom website. Keeping one theme source prevents colors changing
when backend settings arrive after the initial render.

Edit landing copy and components in `src/CommunityPages.tsx`, website shell/store
in `src/App.tsx`, and defaults/data options in `src/config.ts`. Store name, tagline,
logo, footer text and catalog still come from the configured backend when loaded.
An empty Discord URL hides the community invite; set your HTTPS invite to enable it.

`src/routing.tsx` handles this sample's public pages with history.pushState and
popstate. SiteLink retains demo mode; modifier clicks still open normal links.
Platform API/order/admin links use normal document navigation. Native hosting
serves index.html for extensionless public routes, so direct access, refresh,
back/forward and OAuth returns work without DNS redirects. Unknown custom paths
show the sample's not-found page. The established /shop path is an alias for /store, so links back from platform checkout/order pages keep working.

Use Vite base `/`. Keep Custom page routes empty for this SPA. A multipage site
can map paths to real files, e.g. `{ "/servers": "servers.html" }`. Native route
targets must not contain query strings or fragments. Never claim platform paths
such as `/api`, `/admin`, `/uploads`, `/checkout` or `/shop/orders` in your router.

## 4. Store state and accounts

`connectStorefront(onContext, onError)` returns an unsubscribe function. One shared
load survives React Strict Mode mounts. Native requests use credentials:

| Endpoint             | Purpose                                                  |
| -------------------- | -------------------------------------------------------- |
| `/api/shop/landing`  | Public branding, legal documents and store configuration |
| `/api/shop/access`   | Open/password/maintenance state                          |
| `/api/shop-auth/me`  | Signed-in shop customer                                  |
| `/api/shop/products` | Full public product catalog                              |
| `/api/shop/payments` | Enabled/configured payment providers                     |

Catalog/providers are requested only when sales are enabled and accessible.
`loginWithSteam()` and `linkDiscord()` navigate to `/api/shop-auth/*` with the
current path, query and fragment as returnUrl. The backend validates the return.
`logout()` and `unlockShopAccess()` POST with platform CSRF then refresh state.
Returning through the browser back/forward cache resets checkout locks and
refreshes the account/catalog. Tokens are not put in localStorage.

## 5. Servers, players and leaderboard

Configure enabled DayZ servers and their agent telemetry in ServerSentry. In
`src/config.ts`, choose `data.provider: "serversentry"` for local snapshots or
`"cftools"` for a configured CFTools integration. The default is ServerSentry.
Set `serverIds` to restrict the display, `maxServers` to cap the page (maximum 12),
and `leaderboardLimit` for ranking length (maximum 25). These are display settings;
public/private exposure must be enforced by backend configuration and permissions.

| Public endpoint                                                                 | Website use                                                                            |
| ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `/api/shop/data/servers?provider=…`                                             | Server names and gameServerId values                                                   |
| `/api/shop/data/server-summary?provider=…&serverId=…`                           | Availability, status, players/capacity, queue, map, restart, mods, address and metrics |
| `/api/shop/data/leaderboard?provider=…&serverId=…&stat=kills&order=-1&limit=10` | Ranked players and formatted values                                                    |
| `/api/shop/data/player?provider=…&serverId=…&playerId=…`                        | Selected player's published metric details                                             |
| `/api/shop/data/me?provider=…&serverId=…`                                       | Resolve the signed-in Steam/CFTools identity for My statistics                         |

The supplied metric choices are kills, K/D, headshots, longest kill and playtime.
The data provider determines available statistics and formatting. Extend
`rankingStats` with supported backend metrics; unsupported/unpublished data should
remain unavailable, not invented. No admin token is needed for these public reads.
Player IDs are used for requests, not printed as public profile details by default.

One shared server load caches results for 30 seconds. It requests each selected
server once, with at most four concurrent snapshot requests. Partial failures
remain per-server errors. Rankings load only for the selected server/metric;
player details load only on demand. The refresh button has a 30-second UI cooldown.
There is no periodic fetch loop, per-card polling or external browser-to-CFTools call.

Snapshots show their timestamps. Missing counts use a dash; zero is a valid count.
The community total includes only fresh, available, online snapshots with known
counts and states how many servers contributed. Expired snapshots are labeled
Stale and excluded from the online total. Offline/unavailable values never become
invented live players. Join links use a validated backend address/port and are
absent when no usable current connection exists. Demo servers cannot be joined.

The website displays published snapshots, not a continuously updating live feed.
Backend freshness/cache intervals and telemetry availability still apply. Empty
servers/rankings and failed providers have explicit states and manual retry.

## 6. Terms and Privacy inside your website

Edit the Legal pages section in Landing settings and save. The section stays
available when custom_site is selected. Content is delivered in
`landing.legalPagesJson`: an array with `key`, `slug`, `title`, `body`, `isVisible`.
The sample uses the visible `terms` and `privacy` documents; it replaces
`{{storeName}}` and renders Markdown through react-markdown with raw HTML skipped.
Unsafe link protocols are not enabled. Markdown images are omitted. No policy is
invented when content is absent or hidden: the page says Document not published.

`/terms` and `/privacy` use the website's own navigation, colors and footer. The
matching host also serves the uploaded app at `/legal/terms-of-service` and
`/legal/privacy-policy`, so canonical links from platform flows keep this design.
Client navigation from the platform legal page returns to the matching sample path.
API, admin and order paths remain reserved; other platform legal documents keep
their existing routes. Add any additional legal pages deliberately if required.

Demo legal content illustrates layout only. Publish the operator's actual texts
in backend settings before using the site for sales. Updating content there does
not require rebuilding the website; changing its layout does.

## 7. Product variants and checkout

Each purchasable tier/billing option is a full backend product with its own ID,
price, currency, duration, fields and fulfillment. `variantConfiguration.groupId`
groups them for display; groupName and label supply names. A tier may have both
one-time and recurring offers. The group ID is never a checkout product ID.

The catalog remains a flat list of full products. `src/catalog.ts` groups those
records into one card per group. The card shows its first catalog offer's exact
price/billing and opens that same offer. It never compares different currencies.
Optional `variants` arrays are sibling summaries; they omit full buyer fields.
Do not merge a summary over another offer. A summary-only implementation must
fetch `/api/shop/products/{slug}` before using the product at checkout.

Product option selection changes price, billing interval, access duration,
description, fields, friend eligibility and Discord requirements together. It
resets inputs/recipient/payment choice so incompatible values cannot carry over.
`subscriptionEntitlementDays` is access duration, separate from the recurring
`subscriptionInterval` and `subscriptionIntervalCount`; durationDays is an alias.
Currency formatting respects minor units, including zero-decimal currencies.

```ts
await startCheckout(
  {
    productId: selectedOffer.id,
    provider: selectedProvider,
    customerDetails: fieldValues,
    targetSteamId64: recipientSteamId,
    countryCode: getBrowserCountryCode(),
  },
  selectedOffer,
)
```

Import the helpers from `src/bridge.ts` and `src/checkout.ts`. Checkout refreshes
authoritative state, blocks unavailable offers or changed price/billing/duration/
fields/eligibility, prepares CSRF, then POSTs once to `/api/shop/checkout`.
Send the concrete product ID, never a client price or separate variantId. Leave
success/cancel URLs to backend defaults so tracking parameters remain intact.
The returned redirect is validated before navigation. Payments/fulfillment are
confirmed by backend order state and webhooks, not browser redirects.

Supported buyer fields: text, textarea, number, color, checkbox, select,
cftools_server_select, game_server_select and steam_id64. Options come from the
backend. Unknown types block checkout. Friend/Discord rules and country/provider
restrictions remain enforced by ServerSentry; browser locale is only a country hint.

`discordDeliveryOptional` distinguishes an offer that can deliver without a linked
Discord account from one that requires linking. Use the selected full offer's
setting; do not impose a blanket Discord requirement on every product.

## 8. Automation stays in ServerSentry

Configure delivery/cancellation actions per backend offer: the existing action
handlers run after verified payment and entitlement events. The website only
selects a product and supplies its declared buyer fields. Different prices need
backend offers; arbitrary field values do not invent price modifiers or actions.
Never put provider keys, bot tokens, CFTools credentials, admin APIs or server
commands into public browser code. This sample does not expose restart/kick/ban
or an automation editor to unauthenticated visitors.

Order tracking, subscription management and delivery support continue through
`/shop/orders`. Those authenticated platform flows use their existing backend.
Provider credentials, recurring plan creation, webhooks, retries and duplicate
protection stay server-side. Configure and test actual provider sandboxes before
accepting payments; the included fixtures do not perform live OAuth or payments.

## 9. Requests, assets and Cloudflare

`src/api.ts` shares simultaneous GETs and returns cloned cached data. Store state
has a five-second memory cache; community data uses 30 seconds. Reads time out
after 15 seconds. HTTP 429 honors Retry-After and shares a cooldown. A GET retries
at most once when the wait is at most 60 seconds. Writes never automatically retry.
Reuse this helper rather than adding fetch loops or one startup batch per widget.

Import optimized artwork from src/assets so Vite packages it. Prefer WebP/AVIF,
appropriate sizes, responsive sources, explicit dimensions and lazy loading below
the first screen. Product uploads are separate; optimize their originals too.
The design works without remote fonts or large background images. Product images
reserve space and decode asynchronously.

Build filenames use 16-character hexadecimal content hashes for immutable asset
caching. HTML must revalidate. Let Cloudflare respect origin headers; bypass shared
cache for API/auth/customer/order responses and avoid caching 404/429 responses.
Module scripts keep data-cfasync=false for Rocket Loader. Configure trusted
proxies in ServerSentry so rate limits see the visitor IP, not only the proxy.

## 10. Build, upload and verify

```powershell
npm run check
npm test
npm run build
```

The build creates dist and release/serversentry-custom-storefront.zip. Only built
public files enter the ZIP, with index.html at the root. Source, environment files,
dependencies and maps are excluded. File count/extracted/ZIP limits are checked.
The obsolete iframe archive is removed on build to avoid uploading the wrong file.
Enable Landing, select custom_site, upload, save. Do not zip a dist wrapper folder.

After deploying the matching host/frontend and uploading, check refresh on every
route, back/forward, Steam/Discord return paths, logout, canonical legal links,
configured legal content, server/ranking selection, stale/offline/empty/errors,
mobile navigation, variant changes and one submitted checkout per click.
Use `npm run preview` with `?demo=1` to inspect the production bundle locally.
`node tests/qa-server.mjs` provides a separate local fixture with simulated APIs.

If the page is blank, verify the saved mode is custom_site and asset URLs are
root-relative /assets references. Inspect actual JS/CSS requests, MIME types,
failed imports and runtime errors. A native ZIP cannot be loaded as an iframe.
After correcting old mode/cache state, reload with Ctrl+F5. Unsupported
Permissions-Policy warnings are separate from missing assets.

For rollback, retain the previous known-good upload and configuration. Re-upload
that native archive if necessary, or switch to Managed to restore the platform's
builder. Uploaded scripts have the public origin's privileges: upload trusted
site-owner code and keep private credentials out of both source and bundles.
