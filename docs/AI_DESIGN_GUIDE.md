# Customize the website with an AI coding assistant

This is an editable React and TypeScript website. Replace its design, layout,
text and public pages while keeping ServerSentry's accounts, catalog, checkout
and automation. It runs in the full browser tab through `custom_site`.

## Open the source project

Clone this repository or extract its source download. Open the folder containing
`package.json`, `src` and `vite.config.ts` in your coding tool. Run npm commands
from that folder. An `ENOENT` error mentioning `package.json` means you are in
the wrong folder or only have the deployment ZIP.

Use Node.js 22.22+ and npm 10.9+:

```powershell
npm ci
npm run dev
```

Open http://127.0.0.1:5175/. Without a backend, development uses labeled demo
content. Account and payment actions stay disabled. This is enough for design work.

Give the assistant the whole source repository, including
[`AGENTS.md`](../AGENTS.md), the [implementation guide](IMPLEMENTATION.md) and your
completed [design brief](DESIGN_BRIEF.md). The deployment file
`release/serversentry-custom-storefront.zip` contains compiled public assets;
keep an independent source copy in Git for continued development.

Do not share `.env.local`, credentials, private player data or production tokens.
Screenshots and public references help explain the design, but do not replace
the integration contract in this repository.

## Describe the design

Fill in the brief with your community name, audience, language, colors,
typography, navigation and required pages. Supply artwork you own or may use.
Explain which details you like in a reference, such as spacing or navigation.
Separate requirements from optional ideas.

| Change                                                          | Start here                          |
| --------------------------------------------------------------- | ----------------------------------- |
| Branding, community invite, data provider, displayed server IDs | `src/config.ts`                     |
| Theme, typography, spacing, responsive layout                   | `src/styles.css`                    |
| Landing page, servers, leaderboard                              | `src/CommunityPages.tsx`            |
| Header, store, dialogs, legal page layout                       | `src/App.tsx`                       |
| Public routes and browser history                               | `src/routing.tsx`                   |
| Published server/player snapshots                               | `src/community.ts`                  |
| Variant groups, prices, buyer validation                        | `src/catalog.ts`, `src/checkout.ts` |
| Account state and checkout integration                          | `src/bridge.ts`, `src/api.ts`       |
| Configured legal content                                        | `src/legal.ts`                      |
| Demo catalog and regression checks                              | `src/demo.ts`, `tests/`             |

Prefer presentation and CSS changes for a redesign. API or checkout changes need
matching backend support and regression checks. Adding a TypeScript field alone
does not create a backend capability.

## Reusable prompt

Paste this into your coding assistant after opening the repository. Attach the
completed brief, assets and references.

```text
Customize this ServerSentry customer website using the attached design brief.
Read AGENTS.md, README.md and docs/IMPLEMENTATION.md before editing. Implement
the design in this source project, including responsive mobile layouts,
keyboard access and loading, empty, stale and error states.

Keep the native custom_site deployment model and relative same-origin API paths.
Use the existing routing, account, catalog, public data and checkout helpers.
Preserve clean URLs, refresh, back/forward and sign-in return paths. Render
configured backend Terms and Privacy documents inside our design.

Preserve variant-specific product IDs, prices, billing, fields, recipients,
Discord rules and payment checks. Prices and fulfillment remain authoritative
on the backend. Do not add client secrets, admin calls, polling loops,
browser-calculated checkout prices or automatic write retries.

Keep demo data labeled and demo account/payment actions disabled. Never replace
live errors with demo content. Optimize images and reserve their layout space.
Do not hardcode a customer's domain or override the theme with asynchronously
loaded backend accent values.

Run formatting, type checks, tests and the production build. Inspect changed
pages on desktop and mobile. Update documentation when behavior changes.
Report changed files, validation and checks that still require staging.
Produce the native upload ZIP using the existing build command.
```

## Connect staging data

Copy `.env.example` to `.env.local`, set `SERVERSENTRY_BACKEND_URL` to your staging
backend's HTTPS origin, and restart Vite. This configures the local `/api` proxy;
the production bundle does not contain that hostname. Verify actual OAuth
callbacks and provider sandboxes on the deployed staging origin.

Configure products, variants, payment providers, telemetry, legal content and
delivery actions in ServerSentry. A visual redesign does not create those
settings. Follow the [implementation guide](IMPLEMENTATION.md). The browser
must not receive provider credentials or execute automation commands.

## Review and publish

```powershell
npm run format
npm run check
npm test
npm run build
npm run preview
```

Inspect http://127.0.0.1:4175/?demo=1. Check mobile layouts, keyboard controls,
navigation, variants and legal page layout. Use staging data for account,
provider and unavailable-data checks. Fixtures simulate APIs; they do not prove
real OAuth, payments, webhooks or delivery.

Upload `release/serversentry-custom-storefront.zip` in Landing settings. Enable
Landing, select `custom_site` and save. Keep Shop enabled for sales. Leave Custom
page routes empty for this SPA. Use the compatible updated host/frontend
described in the implementation guide.

After uploading, directly open and refresh `/servers`, `/leaderboard`, `/store`,
`/terms` and `/privacy`. Test back/forward, sign-in returns and canonical legal
links from platform flows. Use payment sandboxes and verify the resulting order
and delivery in ServerSentry. Retain the previous known-good native ZIP for rollback.
