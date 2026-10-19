import { useRouter, useSearchParams } from 'next/navigation'
import React from 'react'

export default function useQsState(initialState: Record<string, string | null>) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const defaults = React.useRef(initialState).current
  // Derive from the current URL so removed parameters return to their defaults.
  const paramValue = React.useMemo(() => ({
    ...defaults,
    ...Object.fromEntries(searchParams ?? []),
  }), [defaults, searchParams])
  const setParams = React.useCallback((params: Record<string, string | null>) => {
    const url = new URLSearchParams(window.location.search)
    for (const k in params) {
      const v = params[k]
      if (v === null) {
        url.delete(k)
      } else {
        url.set(k, v)
      }
    }
    router.replace(window.location.pathname + '?' + url.toString(), { scroll: false })
  }, [router])
  return [paramValue, setParams] as const
}
