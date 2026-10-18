# ServerSentry custom website sample

A complete customer website for ServerSentry's `custom_site` mode. Your uploaded
website owns the browser tab, layout, navigation and styling. ServerSentry supplies
public game data, accounts, catalog, payments and fulfillment. No installation
hostname or private credentials belong in the build.

## Customize with an AI coding assistant

Open this source repository in your coding tool and follow the
[AI design guide](docs/AI_DESIGN_GUIDE.md). Complete the
[design brief](docs/DESIGN_BRIEF.md) and give it to the assistant together with the
repository. The guide includes a reusable prompt, a file map and review steps.
[`AGENTS.md`](AGENTS.md) records the integration rules that a redesign must preserve.

Use the source folder containing `package.json` for development. The generated
upload ZIP contains compiled assets and is not an editable source project.

## Develop

Requires Node.js 22.22+ and npm 10.9+.

```powershell
npm ci
npm run dev
```

Open http://127.0.0.1:5175/. Without a configured backend, local development uses a
labeled demo. Account and payment actions are disabled. For real data, copy
`.env.example` to `.env.local`, set `SERVERSENTRY_BACKEND_URL` to the development
backend's HTTPS origin, and restart Vite. This setting configures a local `/api`
proxy; the hostname is not embedded in the website bundle.

## Included pages

| Route                | Content                                                                 |
| -------------------- | ----------------------------------------------------------------------- |
| `/`                  | Community landing page, reported players, servers and ranking preview   |
| `/servers`           | Player counts, capacity, queue, map, restart, mods and connection       |
| `/leaderboard`       | Server/metric selection, public player details and signed-in statistics |
| `/store`             | Catalog groups, tier/billing options, dynamic fields and checkout       |
| `/terms`, `/privacy` | Configured Markdown documents in the website's own design               |

Navigation preserves browser history. Refresh and sign-in return to the same
clean path. Missing or stale backend values are labeled; production errors never
turn into demo data. Public data uses bounded parallel reads and manual refresh.

## Customize

| File                                | Purpose                                                              |
| ----------------------------------- | -------------------------------------------------------------------- |
| `src/config.ts`                     | Default branding, Discord invite, provider and server selection      |
| `src/styles.css`                    | Colors, typography, responsive layout; the only theme source         |
| `src/CommunityPages.tsx`            | Landing, server cards, ranking and player detail layout              |
| `src/community.ts`                  | Typed public data, shared cache and request limits                   |
| `src/App.tsx`                       | Website shell, store, checkout dialog and legal layout               |
| `src/legal.ts`                      | Read visible backend legal documents; never invent a fallback policy |
| `src/bridge.ts`, `src/api.ts`       | Native account, state and checkout API helpers                       |
| `src/catalog.ts`, `src/checkout.ts` | Variant groups, pricing display and buyer validation                 |
| `src/demo.ts`                       | Clearly marked demo catalog and legal layout examples                |

Backend accent/theme/CSS values do not override this website's stylesheet. Change
`--accent` in `src/styles.css` to change the design without a loading color switch.
Run `npm run format` after editing to keep the customer source consistently formatted.

## Publish

```powershell
npm run check
npm test
npm run build
```

Upload **release/serversentry-custom-storefront.zip** in Landing settings. Enable
Landing, select **custom_site**, keep Shop enabled for sales, and save. Leave Custom
page routes empty for this React app. Use the matching updated ServerSentry host:
its native middleware serves clean paths and the canonical Terms/Privacy URLs.

There is one deployment mode and one upload ZIP. The iframe build and bridge have
been removed. Existing embedded installations must rebuild/upload this native
website before switching and saving `custom_site`.

Read [the implementation guide](docs/IMPLEMENTATION.md) for data configuration,
legal content, variants, authentication, automation, caching and deployment checks.
Run `npm run preview` and open http://127.0.0.1:4175/?demo=1 to inspect the build.
Tests and the local QA fixture never contact live payment providers.
