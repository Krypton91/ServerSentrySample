# ServerSentry Custom Storefront – React/Vite

Ein vollständig responsives Custom-Storefront für ServerSentry. Das Projekt verwendet die vorhandene `serversentry.context`-Bridge und kann zusätzlich direkt auf die öffentlichen Shop-Endpunkte zugreifen.

## Enthalten

- Eigene Landingpage im dunklen Gaming-/Survival-Design
- Live-Produkte aus ServerSentry
- Kategorien und Produktsuche
- Produkt-/Checkout-Dialog
- Steam-Login und Logout
- Discord-Verknüpfung für Produkte mit Discord-Actions
- PayPal- und Stripe-Auswahl
- Länder-Sperren der Zahlungsanbieter
- Einmalprodukte und Abonnements
- Geschenk-Käufe über eine fremde SteamID64
- Dynamische Checkout-Felder:
  - Text
  - Textarea
  - Number
  - Color
  - Checkbox
  - Select
  - CF-Tools-Serverauswahl
  - Gameserver-Auswahl
  - SteamID64
- Passwortgeschützter Shop und Wartungsmodus
- Relative und absolute Shop-Bilder
- Mobile Navigation und mobile Checkout-Ansicht

## Entwicklung starten

```bash
npm install
npm run dev
```

Lokale Demo mit Beispielprodukten:

```text
http://localhost:5173/?demo=1
```

Die Demo löst keine echten Käufe aus. Für echte Daten muss die Seite durch ServerSentry eingebettet oder mit einem gültigen `serversentryApiBaseUrl` aufgerufen werden.

## Produktions-Build

```bash
npm run build
```

Der fertige Upload befindet sich danach unter:

```text
dist/index.html
dist/assets/...
```

Wichtig: Für den ServerSentry-Upload müssen `index.html` und der Ordner `assets` direkt im Stamm der ZIP-Datei liegen. Die mitgelieferte Datei `serversentry-custom-storefront-upload.zip` erfüllt diese Struktur bereits.

## In ServerSentry verwenden

1. Im Adminbereich den Shop-/Landing-Builder öffnen.
2. Den Storefront-Modus `custom_iframe` auswählen.
3. `serversentry-custom-storefront-upload.zip` hochladen.
4. Änderungen speichern und den öffentlichen Shop neu laden.
5. Bei einer extern gehosteten Version zusätzlich die erlaubte Origin passend konfigurieren.

## Datenanbindung

ServerSentry sendet beim Laden folgenden Kontext an den iframe:

```ts
window.addEventListener("message", (event) => {
  if (event.data?.type !== "serversentry.context") return
  const context = event.data.payload

  console.log(context.products)
  console.log(context.customer)
  console.log(context.payments)
})
```

Das Projekt meldet sich beim Parent an mit:

```ts
window.parent.postMessage({ type: "serversentry.ready" }, parentOrigin)
```

### Checkout starten

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

Der Parent übernimmt Authentifizierung, Länderprüfung, Discord-Prüfung, Checkout-Erstellung und Weiterleitung zum Zahlungsanbieter.

### Weitere Bridge-Aktionen

```ts
{ type: "serversentry.login.steam" }
{ type: "serversentry.logout" }
{ type: "serversentry.discord.link" }
```

## Direkt verwendete API-Endpunkte

Die Direct-API-Fallbacks verwenden unter anderem:

```text
GET    /api/shop/landing
GET    /api/shop/products
GET    /api/shop/payments
GET    /api/shop/access
POST   /api/shop/access
GET    /api/shop-auth/me
POST   /api/shop-auth/logout
POST   /api/shop/checkout
```

Bei einer extern gehosteten Storefront muss deren Origin in ServerSentry erlaubt sein. Requests werden mit `credentials: "include"` ausgeführt.

## Design anpassen

Die wichtigsten Dateien:

```text
src/App.tsx       Aufbau, Texte, Produktkarten und Checkout
src/styles.css    Farben, Layout, Animationen und Responsive Design
src/bridge.ts     ServerSentry-Bridge und API-Fallback
src/types.ts      Shop-Datentypen
```

Die Hauptfarbe kommt automatisch aus `landing.accentColor`. Fallback:

```css
:root {
  --accent: #d6ff4b;
}
```

Die Texte für Shopname, Hero, Untertitel, Logo, Hero-Bild und Footer werden aus den ServerSentry-Landing-Einstellungen übernommen.

## Hinweise

- Keine API-Schlüssel oder Payment-Secrets gehören in das React-Projekt.
- Der Client sendet nur die Produktauswahl und Kundenfelder. Preis und Produktstatus müssen weiterhin serverseitig validiert werden; das übernimmt dein ServerSentry-Backend.
- Der Build verwendet `base: "./"`, damit die Assets auch unter `/api/shop/custom-storefront/` korrekt geladen werden.
- Externe Schriftdateien sind nicht enthalten. Das Projekt verwendet Systemschriften und bleibt dadurch vollständig eigenständig.

## Windows: npm registry

Dieses Projekt verwendet die öffentliche npm-Registry über die lokale `.npmrc`.
Falls eine frühere Installation fehlgeschlagen ist, in PowerShell ausführen:

```powershell
Remove-Item -Recurse -Force node_modules -ErrorAction SilentlyContinue
npm cache verify
npm install
npm run dev
```

Die Registry lässt sich prüfen mit:

```powershell
npm config get registry
npm ping
```
