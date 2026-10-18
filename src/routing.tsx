import { useEffect, useState, type ComponentProps } from "react"
import { normalizePagePath, siteHref } from "./config"

export function usePath() {
  const [path, setPath] = useState(window.location.pathname)
  useEffect(() => {
    const update = () => setPath(window.location.pathname)
    window.addEventListener("popstate", update)
    window.addEventListener("website:navigate", update)
    return () => {
      window.removeEventListener("popstate", update)
      window.removeEventListener("website:navigate", update)
    }
  }, [])
  return normalizePagePath(path)
}
export function SiteLink({
  to,
  children,
  onClick,
  ...props
}: Omit<ComponentProps<"a">, "href"> & { to: string }) {
  return (
    <a
      {...props}
      href={siteHref(to)}
      onClick={(event) => {
        onClick?.(event)
        if (
          event.defaultPrevented ||
          event.button !== 0 ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey ||
          props.target
        )
          return
        event.preventDefault()
        window.history.pushState(null, "", siteHref(to))
        window.dispatchEvent(new Event("website:navigate"))
        window.scrollTo({ top: 0, behavior: "auto" })
      }}
    >
      {children}
    </a>
  )
}
