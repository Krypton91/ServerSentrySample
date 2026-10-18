import { defineConfig, loadEnv } from "vite"
import react from "@vitejs/plugin-react"

export default defineConfig(({ mode }) => {
  const backend = loadEnv(mode, process.cwd(), "").SERVERSENTRY_BACKEND_URL?.trim()
  if (backend) {
    const url = new URL(backend)
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
    if (
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.pathname !== "/" ||
      !(url.protocol === "https:" || (local && url.protocol === "http:"))
    ) {
      throw new Error(
        "SERVERSENTRY_BACKEND_URL must be an HTTPS origin, or HTTP loopback for local development.",
      )
    }
  }
  const proxy = backend ? { "/api": { target: backend, changeOrigin: true } } : undefined
  return {
    plugins: [
      react(),
      {
        name: "cloudflare-module-scripts",
        transformIndexHtml: {
          order: "post",
          handler(html) {
            return html.replace(
              /<script\b(?=[^>]*\btype="module")(?![^>]*\bdata-cfasync=)/g,
              '<script data-cfasync="false"',
            )
          },
        },
      },
    ],
    base: "/",
    define: { __DEV_BACKEND_CONFIGURED__: JSON.stringify(Boolean(backend)) },
    server: { host: "127.0.0.1", port: 5175, strictPort: true, proxy },
    preview: { host: "127.0.0.1", port: 4175, strictPort: true, proxy },
    build: {
      outDir: "dist",
      emptyOutDir: true,
      sourcemap: false,
      rolldownOptions: {
        output: {
          hashCharacters: "hex",
          entryFileNames: "assets/[name]-[hash:16].js",
          chunkFileNames: "assets/[name]-[hash:16].js",
          assetFileNames: "assets/[name]-[hash:16][extname]",
        },
      },
    },
  }
})
