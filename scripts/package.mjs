import { readFile, readdir, mkdir, writeFile, stat, unlink } from "node:fs/promises"
import { resolve, relative, sep } from "node:path"
import { zipSync, unzipSync, strFromU8 } from "fflate"

const root = resolve("dist")
const entries = Object.create(null)
let size = 0
async function collect(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = resolve(directory, entry.name)
    if (!file.startsWith(root + sep) || entry.isSymbolicLink())
      throw new Error("The build must contain only regular website files.")
    if (entry.isDirectory()) await collect(file)
    else {
      const name = relative(root, file).split(sep).join("/")
      if (
        name.split("/").some((part) => part.startsWith(".")) ||
        /(?:^|\/)(?:node_modules|src|scripts|tests)\//.test(name) ||
        /\.(?:map|ts|tsx)$/.test(name)
      )
        throw new Error(`Unexpected upload file: ${name}`)
      const data = await readFile(file)
      size += data.length
      entries[name] = data
    }
  }
}
await collect(root)
if (!entries["index.html"] || Object.keys(entries).length > 1200 || size > 512 * 1024 * 1024)
  throw new Error("Build is missing index.html or exceeds ServerSentry upload limits.")
if (process.argv.length > 2) throw new Error("This sample supports custom_site only. Run npm run build.")
const html = strFromU8(entries["index.html"])
if (!html.includes('data-cfasync="false"'))
  throw new Error("Module scripts must keep the Rocket Loader opt-out.")
if (!html.includes('src="/assets/') || !html.includes('href="/assets/'))
  throw new Error("Native website assets must use root paths.")
const output = zipSync(entries, { level: 6 })
if (output.length > 256 * 1024 * 1024) throw new Error("ZIP exceeds the 256 MiB upload limit.")
const verified = unzipSync(output)
if (Object.keys(verified).length !== Object.keys(entries).length) throw new Error("ZIP verification failed.")
await mkdir("release", { recursive: true })
await unlink("release/serversentry-custom-storefront-iframe.zip").catch((error) => {
  if (error.code !== "ENOENT") throw error
})
const file = "release/serversentry-custom-storefront.zip"
await writeFile(file, output)
console.log(`Upload: ${file} (${(await stat(file)).size.toLocaleString()} bytes)`)
console.log("Landing mode: custom_site. Enable Landing, upload this ZIP, save and reload the public website.")
