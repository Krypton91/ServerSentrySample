# Working on this sample

Read `README.md`, `docs/IMPLEMENTATION.md` and `docs/AI_DESIGN_GUIDE.md` before
editing. Use `docs/DESIGN_BRIEF.md` for the requested design. Follow the user's
visual choices while preserving the working ServerSentry integration.

## Architecture

- This is a complete website for `custom_site`, running in the full browser tab.
  Do not add iframe messaging, an iframe build or customer-specific hostnames.
- Use `src/routing.tsx`. Preserve clean URLs, direct refresh, back/forward,
  modifier clicks, the `/shop` alias and sign-in returns. Keep API, admin,
  checkout and order routes under platform control.
- Keep API paths relative to the current origin. `SERVERSENTRY_BACKEND_URL` is
  a local development proxy setting, never a bundled production URL.
- Keep `src/styles.css` as the theme source; do not overwrite it with backend
  accent/theme settings after loading. Preserve keyboard access, visible focus
  and responsive layouts.
- Change presentation components freely within the requested design. Reuse
  typed data, account and checkout helpers rather than duplicating them in UI.

## Integration rules

- Reuse `src/api.ts`: preserve shared requests, bounded caches, timeouts and
  HTTP 429 cooldowns. Do not add per-widget polling or automatic write retries.
- Preserve credentials and CSRF handling. Never expose private keys, admin
  commands or authentication tokens in public source or browser storage.
- Each purchasable variant is a full product with its own ID and terms. Group
  IDs and sibling summaries are not checkout products. Changing an offer must
  reset incompatible fields, recipient and payment selections.
- Use `startCheckout` with the concrete product ID and declared buyer fields.
  Preserve authoritative refresh and changed-offer checks. Never send a
  browser-calculated price or confirm fulfillment from a browser redirect.
- Preserve provider availability, friend eligibility, optional/required Discord
  delivery, dynamic field validation and disabled/locked/maintenance states.
- Use supported public endpoints for servers and players. Preserve stale,
  missing, empty and error states. Zero players is valid; missing data is not
  zero. Never replace a live failure with demo data.
- Keep demo content labeled and demo account/payment actions disabled.
- Use `src/legal.ts` to render visible backend Terms and Privacy documents.
  Do not invent an operator's policy or enable raw HTML.
- Keep payment verification, subscriptions and automation server-side.

## Verify and deliver

Install with `npm ci`. Run `npm run format`, `npm run check`, `npm test` and
`npm run build` after changes. Add focused regression coverage when changing
integration behavior. Inspect affected pages on desktop and narrow mobile
layouts, including keyboard navigation and loading/error states.

Use `npm run preview` with `?demo=1` for the built design. The optional
`node tests/qa-server.mjs` fixture simulates APIs; it does not verify real OAuth,
payments, webhooks or delivery. Test those on staging when relevant and describe
checks that could not be performed.

Commit source, tests and documentation. Exclude `node_modules`, `dist`, `release`,
local environment files and generated TypeScript artifacts. The upload is
`release/serversentry-custom-storefront.zip`, produced by `npm run build`.
Update docs when behavior or setup changes. Report results and validation;
claim an upload or deployment only if it was performed.
