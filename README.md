<div align="center">

# 🛡️ ServerSentry Custom Storefront

### A responsive React/Vite storefront for the ServerSentry platform

Build a branded gaming-community shop with Steam authentication, Discord linking, dynamic checkout fields, Stripe and PayPal support, subscriptions, gift purchases, and mobile-friendly checkout.

[![ServerSentry](https://img.shields.io/badge/Requires-ServerSentry-d6ff4b?style=for-the-badge)](https://serversentry.app)
[![React](https://img.shields.io/badge/React-Frontend-61DAFB?style=for-the-badge&logo=react&logoColor=white)](https://react.dev)
[![Vite](https://img.shields.io/badge/Vite-Build-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vite.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org)

[ServerSentry Website](https://serversentry.app) · [Development](#development) · [Production Build](#production-build) · [Integration](#serversentry-integration)

</div>

---

## About

ServerSentry Custom Storefront is a fully responsive shop frontend built for the **ServerSentry** platform.

It uses the existing `serversentry.context` iframe bridge to receive products, customer data, payment methods, landing-page settings, and shop configuration. When the bridge is unavailable, it can also communicate directly with ServerSentry's public shop API endpoints.

> [!IMPORTANT]
> This project is **not a standalone shop or payment backend**. It requires the main [ServerSentry](https://serversentry.app) product to provide products, authentication, checkout creation, payment processing, Discord checks, country restrictions, and order fulfillment.

---

## Main Product Requirement

To run this storefront with real shop data and payments, you need an installed and configured **ServerSentry** environment.

### Required platform

**ServerSentry — CMS and automation platform for game-server communities**

🌐 **Website:** [https://serversentry.app](https://serversentry.app)

ServerSentry provides the backend services used by this storefront, including:

- Product and category management
- Public shop and landing-page configuration
- Steam authentication
- Discord account linking and role workflows
- Stripe and PayPal checkout
- One-time purchases and subscriptions
- Country-based payment restrictions
- CFTools and game-server integrations
- Checkout validation and order fulfillment
- Server-agent automation
- Shop access protection and maintenance mode

The local demo can run without a ServerSentry backend, but it only displays example data and cannot complete real purchases.

---

## Features

### Storefront

- Dark gaming and survival-inspired design
- Live ServerSentry product data
- Product categories and search
- Product details and checkout dialog
- Responsive mobile navigation
- Mobile-optimized checkout
- Relative and absolute shop images
- Password-protected storefront support
- Maintenance mode support
- Landing content loaded from ServerSentry settings

### Authentication and integrations

- Steam login and logout
- Discord account linking
- Discord requirements for supported products
- Gift purchases for another SteamID64
- CF-Tools server selection
- Game-server selection

### Payments

- Stripe
- PayPal
- Payment-provider selection
- Provider-specific country restrictions
- One-time products
- Subscription products

### Dynamic checkout fields

| Field type | Purpose |
|---|---|
| `text` | Single-line text input |
| `textarea` | Multi-line text input |
| `number` | Numeric input |
| `color` | Color picker |
| `checkbox` | Boolean selection |
| `select` | Dropdown selection |
| `cftools-server` | CF-Tools server selection |
| `gameserver` | Game-server selection |
| `steamid64` | SteamID64 input |

---

## Technology

- React
- TypeScript
- Vite
- CSS
- ServerSentry iframe bridge
- ServerSentry public shop API

---

## Development

### Requirements

For local frontend development:

- Node.js
- npm

For real shop functionality:

- A configured [ServerSentry](https://serversentry.app) environment
- At least one active shop product
- A configured public shop or landing page
- A supported payment provider for real checkout
- Correct allowed-origin settings when externally hosted

### Install dependencies

```bash
npm install
```

### Start the development server

```bash
npm run dev
```

The application is normally available at:

```text
http://localhost:5173
```

---

## Demo Mode

Open the local demo with sample products:

```text
http://localhost:5173/?demo=1
```

> [!NOTE]
> Demo mode does not create real orders or payment sessions.

For real data, the storefront must either:

1. Be embedded by ServerSentry using the custom iframe storefront mode, or
2. Be opened with a valid `serversentryApiBaseUrl`.

---

## Production Build

Create the optimized production build:

```bash
npm run build
```

The generated files are written to:

```text
dist/
├── index.html
└── assets/
    └── ...
```

---

## ServerSentry Upload Structure

For a ServerSentry upload, `index.html` and the `assets` directory must be located directly in the root of the ZIP archive.

### Correct

```text
serversentry-custom-storefront-upload.zip
├── index.html
└── assets/
    └── ...
```

### Incorrect

```text
serversentry-custom-storefront-upload.zip
└── dist/
    ├── index.html
    └── assets/
```

The included file already uses the correct structure:

```text
serversentry-custom-storefront-upload.zip
```

---

## Using the Storefront in ServerSentry

1. Open the shop or landing-page builder in the ServerSentry admin area.
2. Select the `custom_iframe` storefront mode.
3. Upload `serversentry-custom-storefront-upload.zip`.
4. Save the changes.
5. Reload the public shop.

For an externally hosted storefront, add its origin to the allowed origins in ServerSentry.

---

## ServerSentry Integration

### Receiving storefront context

When the iframe loads, ServerSentry sends its context using `postMessage`:

```ts
window.addEventListener("message", (event) => {
  if (event.data?.type !== "serversentry.context") return

  const context = event.data.payload

  console.log(context.products)
  console.log(context.customer)
  console.log(context.payments)
})
```

The context can include:

- Landing-page configuration
- Products and categories
- Customer session
- Payment providers
- Shop-access status
- Discord-link status
- Available server options

### Registering the storefront

The storefront tells the parent window that it is ready:

```ts
window.parent.postMessage(
  {
    type: "serversentry.ready"
  },
  parentOrigin
)
```

---

## Starting Checkout

Send a `serversentry.checkout` message to the parent window:

```ts
window.parent.postMessage(
  {
    type: "serversentry.checkout",
    payload: {
      productId: "PRODUCT-ID",
      productSlug: "vip-pack",
      provider: "stripe",
      customerDetails: {
        server: "server-1"
      },
      targetSteamId64: "7656119..."
    }
  },
  parentOrigin
)
```

### Checkout payload

| Property | Description |
|---|---|
| `productId` | Unique ServerSentry product ID |
| `productSlug` | Human-readable product identifier |
| `provider` | Selected payment provider |
| `customerDetails` | Values from dynamic checkout fields |
| `targetSteamId64` | SteamID64 that receives the purchase |

The ServerSentry parent application handles:

- Customer authentication
- Product and price validation
- Country restrictions
- Discord requirements
- Checkout creation
- Payment-provider redirection
- Order fulfillment

---

## Authentication Bridge Actions

### Steam login

```ts
window.parent.postMessage(
  {
    type: "serversentry.login.steam"
  },
  parentOrigin
)
```

### Logout

```ts
window.parent.postMessage(
  {
    type: "serversentry.logout"
  },
  parentOrigin
)
```

### Discord linking

```ts
window.parent.postMessage(
  {
    type: "serversentry.discord.link"
  },
  parentOrigin
)
```

---

## Direct API Fallback

When the iframe bridge is unavailable, the storefront can use ServerSentry's public shop API directly.

Endpoints used include:

```http
GET    /api/shop/landing
GET    /api/shop/products
GET    /api/shop/payments
GET    /api/shop/access
POST   /api/shop/access
GET    /api/shop-auth/me
POST   /api/shop-auth/logout
POST   /api/shop/checkout
```

Requests are sent with credentials enabled:

```ts
fetch(url, {
  credentials: "include"
})
```

> [!WARNING]
> An externally hosted storefront must use an origin that is explicitly allowed in ServerSentry. Otherwise, authenticated cross-origin requests may be rejected.

---

## Customizing the Design

The most important files are:

```text
src/
├── App.tsx
├── bridge.ts
├── styles.css
└── types.ts
```

| File | Purpose |
|---|---|
| `src/App.tsx` | Layout, text, product cards, and checkout |
| `src/styles.css` | Colors, layout, animations, and responsive styling |
| `src/bridge.ts` | ServerSentry bridge and direct API fallback |
| `src/types.ts` | TypeScript data types |

---

## Accent Color

The primary storefront color is loaded automatically from:

```ts
landing.accentColor
```

Fallback:

```css
:root {
  --accent: #d6ff4b;
}
```

Example usage:

```css
.button-primary {
  background: var(--accent);
}
```

---

## Landing-Page Content

The storefront can automatically use the following ServerSentry landing settings:

- Shop name
- Hero title
- Hero subtitle
- Logo
- Hero image
- Accent color
- Footer content

This allows shop administrators to change public content without rebuilding the React application.

---

## Suggested Project Structure

```text
serversentry-custom-storefront/
├── public/
├── src/
│   ├── App.tsx
│   ├── bridge.ts
│   ├── main.tsx
│   ├── styles.css
│   └── types.ts
├── .npmrc
├── index.html
├── package.json
├── README.md
├── tsconfig.json
└── vite.config.ts
```

---

## Vite Configuration

The build uses a relative base path:

```ts
import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"

export default defineConfig({
  plugins: [react()],
  base: "./"
})
```

This allows generated assets to load correctly from nested locations such as:

```text
/api/shop/custom-storefront/
```

---

## Security

> [!CAUTION]
> Never place API keys, Stripe secrets, PayPal secrets, database credentials, or private ServerSentry credentials in this React project.

The browser should only submit:

- Selected product
- Selected payment provider
- Customer-entered checkout fields
- Target SteamID64

The ServerSentry backend must validate:

- Product identity
- Product status
- Product price
- Payment provider
- Customer session
- Country restrictions
- Discord requirements
- Checkout field values
- Target SteamID64
- Order fulfillment actions

Also restrict iframe messages and API access to trusted origins.

---

## Self-Contained Build

External font files are not included. The project uses system fonts so that it:

- Avoids third-party font requests
- Works in restricted environments
- Remains self-contained
- Loads faster on first visit

---

## Windows: npm Registry Troubleshooting

This project uses the public npm registry through the local `.npmrc` file.

If a previous installation failed, run the following commands in PowerShell:

```powershell
Remove-Item -Recurse -Force node_modules -ErrorAction SilentlyContinue
npm cache verify
npm install
npm run dev
```

Check the configured registry:

```powershell
npm config get registry
```

Test the registry connection:

```powershell
npm ping
```

Expected registry:

```text
https://registry.npmjs.org/
```

---

## Troubleshooting

### Products do not load

Verify that:

- The storefront is embedded through ServerSentry, or a valid API base URL is configured.
- The `serversentry.context` message is received.
- The storefront origin is allowed.
- Browser cookies are enabled.
- API requests use `credentials: "include"`.
- The ServerSentry shop contains active products.

### Checkout does not start

Verify that:

- The customer is signed in through Steam.
- A payment provider is selected.
- Required checkout fields are complete.
- The product is active.
- The provider is available in the customer's country.
- Discord is linked when required.
- The checkout payload contains a valid product ID.

### Assets do not load

Verify that:

- Vite uses `base: "./"`.
- `index.html` and `assets` are in the ZIP root.
- The complete `assets` directory was uploaded.
- Asset URLs are not hardcoded to the domain root.

### External authentication does not work

Verify that:

- The external origin is allowed in ServerSentry.
- Requests use `credentials: "include"`.
- HTTPS is enabled in production.
- Cookie and cross-origin settings match the deployment domain.

---

## Related Product

This storefront is designed specifically for:

### [ServerSentry](https://serversentry.app)

A self-hosted CMS and automation platform for game-server communities, combining public shop pages, Steam login, Discord workflows, payments, CFTools integration, and server automation.

---

<div align="center">

**Built for the [ServerSentry](https://serversentry.app) platform**

React · TypeScript · Vite

</div>
